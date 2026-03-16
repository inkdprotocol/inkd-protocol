/**
 * Inkd API — /v1/upload
 *
 * POST /v1/upload
 *   Upload content to Arweave via Irys. Returns ar:// hash.
 *   Free endpoint — cost is covered by the $2 USDC paid in pushVersion.
 *
 * Supports:
 *   - multipart/form-data   { file: <binary>, contentType?: string }
 *   - application/json      { data: "<base64>", contentType: string, filename?: string }
 *   - application/octet-stream  (raw bytes in body)
 *
 * Response: { hash: "ar://TxId", txId: "TxId", bytes: N, url: "https://arweave.net/TxId" }
 */

import { Router }    from 'express'
import type { ApiConfig } from '../config.js'
import { sendError, BadRequestError, ServiceUnavailableError } from '../errors.js'
import { getArweaveCostUsdc } from '../arweave.js'

// ─── Irys upload helper ───────────────────────────────────────────────────────

const ARWEAVE_GW        = 'https://arweave.net'
const TURBO_PAYMENT_URL = 'https://payment.ardrive.io/v1'
const TURBO_DEPOSIT     = '0x6A0A10FFD285c971B841bee8892878c0d583Bf67'
const USDC_BASE         = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const MAX_BYTES         = 50 * 1024 * 1024  // 50 MB

async function uploadViaTurbo(
  data:        Buffer,
  contentType: string,
  serverKey:   string,
  tags?:       Record<string, string>,
): Promise<{ txId: string; url: string }> {
  // @ts-ignore — @ardrive/turbo-sdk types
  const { TurboFactory, EthereumSigner } = await import('@ardrive/turbo-sdk/node')
  const { Readable } = await import('stream')

  const signer = new EthereumSigner(serverKey)
  const turbo  = TurboFactory.authenticated({ signer })

  // Check balance — top up with $1 USDC if needed
  const { winc } = await turbo.getBalance()
  const [cost]   = await turbo.getUploadCosts({ bytes: [data.length] })
  if (BigInt(winc) < BigInt(cost.winc)) {
    const { ethers } = await import('ethers')
    const rpc    = process.env['INKD_RPC_URL'] ?? 'https://1rpc.io/base'
    const wallet = new ethers.Wallet(serverKey, new ethers.JsonRpcProvider(rpc))
    const usdc   = new ethers.Contract(USDC_BASE, ['function transfer(address,uint256) returns (bool)'], wallet)
    const tx     = await usdc.transfer(TURBO_DEPOSIT, 1_000_000n)
    await tx.wait()
    const creditRes = await fetch(`${TURBO_PAYMENT_URL}/account/balance/base-usdc`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx_id: tx.hash }),
    })
    if (!creditRes.ok) throw new Error(`Turbo credit failed: ${await creditRes.text()}`)
  }

  const tagList = [
    { name: 'Content-Type', value: contentType },
    { name: 'App-Name',     value: 'inkd-protocol' },
    ...(tags ? Object.entries(tags).map(([n, v]) => ({ name: n, value: v })) : []),
  ]

  const result = await turbo.uploadFile({
    fileStreamFactory: () => Readable.from(data),
    fileSizeFactory:   () => data.length,
    dataItemOpts:      { tags: tagList },
  })

  return { txId: result.id, url: `${ARWEAVE_GW}/${result.id}` }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function buildUploadRouter(cfg: ApiConfig): Router {
  const router = Router()

  /**
   * POST /v1/upload
   * Upload content to Arweave via Irys.
   */
  router.post('/', async (req, res) => {
    try {
      if (!cfg.serverWalletKey) {
        throw new ServiceUnavailableError('Server wallet not configured — uploads unavailable.')
      }

      let data:        Buffer
      let contentType: string
      const extraTags: Record<string, string> = {}

      const ct = req.headers['content-type'] ?? ''

      if (ct.includes('application/json')) {
        // JSON mode: { data: "<base64>", contentType: string, filename?: string }
        const { data: b64, contentType: ct2, filename } = req.body as {
          data: string; contentType: string; filename?: string
        }
        if (!b64 || !ct2) throw new BadRequestError('body must have: data (base64), contentType')
        data        = Buffer.from(b64, 'base64')
        contentType = ct2
        if (filename) extraTags['File-Name'] = filename

      } else if (ct.includes('multipart/form-data')) {
        // Multipart not natively supported without multer — return helpful error
        throw new BadRequestError(
          'multipart/form-data not supported. Use application/json: ' +
          '{ data: base64, contentType: "..." }'
        )

      } else {
        // Raw binary body
        contentType = ct.split(';')[0]?.trim() || 'application/octet-stream'
        data = req.body instanceof Buffer ? req.body
          : Buffer.isBuffer(req.body)     ? req.body
          : Buffer.from(req.body as string | Uint8Array)
      }

      if (!data || data.length === 0) throw new BadRequestError('Empty upload')
      if (data.length > MAX_BYTES) throw new BadRequestError(`Max upload size is ${MAX_BYTES / 1024 / 1024}MB`)

      // Estimate cost for informational purposes
      let costUsdc = '0'
      try {
        const cost = await getArweaveCostUsdc(data.length)
        costUsdc   = cost.toString()
      } catch { /* non-fatal */ }

      const { txId, url } = await uploadViaTurbo(
        data,
        contentType,
        cfg.serverWalletKey,
        extraTags,
      )

      // IPFS dual-storage (optional, requires IPFS_GATEWAY_URL + IPFS_TOKEN env vars)
      let ipfsHash: string | undefined
      const ipfsGateway = process.env['IPFS_GATEWAY_URL']
      const ipfsToken   = process.env['IPFS_TOKEN']
      if (ipfsGateway && ipfsToken) {
        try {
          const ipfsRes = await fetch('https://api.web3.storage/upload', {
            method:  'POST',
            headers: {
              Authorization:  `Bearer ${ipfsToken}`,
              'Content-Type': contentType,
            },
            body: new Uint8Array(data),
            signal: AbortSignal.timeout(30000),
          })
          if (ipfsRes.ok) {
            const ipfsJson = await ipfsRes.json() as { cid?: string }
            if (ipfsJson.cid) ipfsHash = `ipfs://${ipfsJson.cid}`
          } else {
            console.warn('[upload] IPFS pin failed:', ipfsRes.status, await ipfsRes.text().catch(() => ''))
          }
        } catch (ipfsErr) {
          console.warn('[upload] IPFS pin error:', ipfsErr instanceof Error ? ipfsErr.message : String(ipfsErr))
        }
      }

      res.status(201).json({
        hash:  `ar://${txId}`,
        txId,
        url,
        bytes: data.length,
        ...(ipfsHash ? { ipfsHash } : {}),
        cost:  {
          usdc: costUsdc,
          usd:  `$${(Number(costUsdc) / 1e6).toFixed(4)}`,
        },
      })

    } catch (err) {
      sendError(res, err)
    }
  })

  /**
   * GET /v1/upload/price?bytes=N
   * Estimate Arweave upload cost in USDC for a given number of bytes.
   */
  router.get('/price', async (req, res) => {
    try {
      const bytes = parseInt(req.query['bytes'] as string ?? '0', 10)
      if (!bytes || bytes <= 0) throw new BadRequestError('bytes must be a positive integer')
      if (bytes > MAX_BYTES)   throw new BadRequestError(`Max ${MAX_BYTES / 1024 / 1024}MB`)

      const costUsdc = await getArweaveCostUsdc(bytes)
      res.json({
        bytes,
        costUsdc:  costUsdc.toString(),
        costUsd:   `$${(Number(costUsdc) / 1e6).toFixed(4)}`,
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  return router
}
