/**
 * inkd — Clanker Token Launch Script
 *
 * Deploys $INKD on Base Mainnet via Clanker SDK v4.
 * Uniswap V4 pool, automatic LP, sniper protection, creator fees.
 *
 * Prerequisites:
 *   - npm install clanker-sdk viem (in project root or scripts/)
 *   - PRIVATE_KEY env var (deployer wallet)
 *   - Enough ETH on Base for gas (~0.01 ETH)
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx scripts/clanker-launch.ts
 *   PRIVATE_KEY=0x... DRY_RUN=true npx tsx scripts/clanker-launch.ts
 *
 * Docs: https://clanker.gitbook.io/clanker-documentation
 */

import { Clanker }               from 'clanker-sdk/v4'
import { FEE_CONFIGS, POOL_POSITIONS } from 'clanker-sdk'
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem'
import { privateKeyToAccount }   from 'viem/accounts'
import { base }                  from 'viem/chains'

// ─── Config ───────────────────────────────────────────────────────────────────

const PRIVATE_KEY = (process.env['PRIVATE_KEY'] ?? '') as `0x${string}`
const DRY_RUN    = process.env['DRY_RUN'] === 'true'

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable required')
  process.exit(1)
}

// Token config
const TOKEN_CONFIG = {
  name:   'inkd',
  symbol: 'INKD',
  // Upload logo to IPFS first (e.g. via nft.storage or Pinata)
  // Replace with actual IPFS hash before launch
  image:  'ipfs://bafybeig5fqkqyosig3b5lgubg3qn5nrsmntmflsqhv7ydkbrjnx4wwn2e',
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const account      = privateKeyToAccount(PRIVATE_KEY)
  const publicClient = createPublicClient({ chain: base, transport: http() }) as PublicClient
  const wallet       = createWalletClient({ account, chain: base, transport: http() })
  const clanker      = new Clanker({ wallet, publicClient })

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  inkd — Clanker Token Launch')
  console.log('══════════════════════════════════════════════════════════')
  console.log(`  Token:      ${TOKEN_CONFIG.name} ($${TOKEN_CONFIG.symbol})`)
  console.log(`  Deployer:   ${account.address}`)
  console.log(`  Network:    Base Mainnet`)
  console.log(`  Dry run:    ${DRY_RUN}`)
  console.log('══════════════════════════════════════════════════════════\n')

  if (DRY_RUN) {
    console.log('DRY RUN — config only, no transaction sent:\n')
    console.log(JSON.stringify({
      ...TOKEN_CONFIG,
      tokenAdmin: account.address,
      chainId: base.id,
      fees: 'FEE_CONFIGS.DynamicBasic (1-5% volatility-based)',
      sniperFees: { startingFee: '66.6%', endingFee: '4.2%', secondsToDecay: 15 },
      pool: { pairedToken: 'WETH', positions: 'POOL_POSITIONS.Standard' },
    }, null, 2))
    return
  }

  console.log('Deploying...\n')

  const { txHash, waitForTransaction, error } = await clanker.deploy({
    name:       TOKEN_CONFIG.name,
    symbol:     TOKEN_CONFIG.symbol,
    image:      TOKEN_CONFIG.image,
    tokenAdmin: account.address,
    chainId:    base.id,

    // 1-5% dynamic fee based on volatility — rises during pumps/dumps
    // Creator earns 100% of LP fees (via clanker.world)
    fees: FEE_CONFIGS.DynamicBasic,

    // Sniper protection — starts at 66.6% fee, decays to 4.2% over 15 seconds
    // Protects against bots sniping at launch
    sniperFees: {
      startingFee:    666_777, // 66.6777%
      endingFee:      41_673,  // 4.1673%
      secondsToDecay: 15,
    },

    // Standard full-range liquidity pool
    pool: {
      pairedToken: 'WETH',
      positions:   POOL_POSITIONS.Standard,
    },

    // Social provenance — marks this as an official inkd deploy
    context: {
      interface: 'inkd-launch-script',
      platform:  'base',
    },
  })

  if (error) {
    console.error('Deploy failed:', error.message)
    process.exit(1)
  }

  console.log(`  TX Hash: ${txHash}`)
  console.log('  Waiting for confirmation...\n')

  const { address, error: txError } = await waitForTransaction()

  if (txError) {
    console.error('Transaction failed:', txError.message)
    process.exit(1)
  }

  console.log('══════════════════════════════════════════════════════════')
  console.log('  ✅ $INKD launched successfully!')
  console.log('══════════════════════════════════════════════════════════')
  console.log(`  Token address: ${address}`)
  console.log(`  TX Hash:       ${txHash}`)
  console.log(`  Basescan:      https://basescan.org/token/${address}`)
  console.log(`  Clanker admin: https://www.clanker.world/clanker/${address}/admin`)
  console.log(`  Uniswap:       https://app.uniswap.org/explore/tokens/base/${address}`)
  console.log('')
  console.log('  Next steps:')
  console.log('  1. Update INKD_TOKEN_ADDRESS in api/.env')
  console.log('  2. Deploy Registry + Treasury contracts with new token address')
  console.log('  3. Set up Safe Multisig as Registry/Treasury owner')
  console.log('  4. Claim LP fees via clanker.world/admin')
  console.log('══════════════════════════════════════════════════════════\n')

  // Save deployment info
  const fs = await import('fs')
  const deployInfo = {
    deployedAt:   new Date().toISOString(),
    network:      'base-mainnet',
    tokenAddress: address,
    txHash,
    deployer:     account.address,
    tokenName:    TOKEN_CONFIG.name,
    tokenSymbol:  TOKEN_CONFIG.symbol,
  }
  fs.writeFileSync(
    'scripts/clanker-deploy-result.json',
    JSON.stringify(deployInfo, null, 2)
  )
  console.log('  Deploy info saved to scripts/clanker-deploy-result.json')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
