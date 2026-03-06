/**
 * @inkd/api — middleware/x402.ts unit tests
 *
 * Tests buildX402Middleware(), getPayerAddress(), and NETWORK_BASE_* constants.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request } from 'express'
import type { Address } from 'viem'

// ── Mocks (factories must be self-contained — hoisted to top of file) ─────────

vi.mock('@x402/express', () => {
  const paymentMiddleware = vi.fn((_routes: unknown, _server: unknown) => {
    return (_req: unknown, _res: unknown, next: () => void) => next()
  })
  const x402ResourceServer = vi.fn(function (this: object) {
    (this as { register: () => typeof this }).register = vi.fn().mockReturnThis()
  })
  return { paymentMiddleware, x402ResourceServer }
})

vi.mock('@x402/core/http', () => {
  const HTTPFacilitatorClient = vi.fn(function (this: { url: string }, opts: { url: string }) {
    this.url = opts.url
  })
  return { HTTPFacilitatorClient }
})

vi.mock('@x402/evm/exact/server', () => ({
  ExactEvmScheme: vi.fn(function () {}),
}))

import {
  getPayerAddress,
  buildX402Middleware,
  NETWORK_BASE_MAINNET,
  NETWORK_BASE_SEPOLIA,
} from '../middleware/x402.js'
import { paymentMiddleware as _paymentMiddleware } from '@x402/express'
import { HTTPFacilitatorClient } from '@x402/core/http'

const paymentMiddleware = _paymentMiddleware as ReturnType<typeof vi.fn>

// ─── buildX402Middleware() ────────────────────────────────────────────────────

describe('buildX402Middleware()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-stub after clearAllMocks wipes return values
    paymentMiddleware.mockImplementation((_routes: unknown, _server: unknown) =>
      (_req: unknown, _res: unknown, next: () => void) => next()
    )
  })

  const baseConfig = {
    treasuryAddress: '0xABCDEF1234567890ABCDef1234567890AbCdEf01' as Address,
    facilitatorUrl:  'https://x402.org/facilitator',
    network:         'testnet' as const,
  }

  it('returns a middleware function', () => {
    const mw = buildX402Middleware(baseConfig)
    expect(typeof mw).toBe('function')
  })

  it('instantiates HTTPFacilitatorClient with the given facilitatorUrl', () => {
    buildX402Middleware(baseConfig)
    expect(HTTPFacilitatorClient).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://x402.org/facilitator' })
    )
  })

  it('calls paymentMiddleware with routes containing both endpoints', () => {
    buildX402Middleware(baseConfig)
    expect(paymentMiddleware).toHaveBeenCalledTimes(1)
    const [routes] = paymentMiddleware.mock.calls[0] as [Record<string, unknown>]
    expect(routes).toHaveProperty('POST /projects')
    expect(routes).toHaveProperty('POST /projects/:id/versions')
  })

  it('uses NETWORK_BASE_SEPOLIA for testnet', () => {
    buildX402Middleware({ ...baseConfig, network: 'testnet' })
    const [routes] = paymentMiddleware.mock.calls[0] as [Record<string, { accepts: { network: string } }>]
    expect(routes['POST /projects']!.accepts.network).toBe(NETWORK_BASE_SEPOLIA)
  })

  it('uses NETWORK_BASE_MAINNET for mainnet', () => {
    buildX402Middleware({ ...baseConfig, network: 'mainnet' })
    const [routes] = paymentMiddleware.mock.calls[0] as [Record<string, { accepts: { network: string } }>]
    expect(routes['POST /projects']!.accepts.network).toBe(NETWORK_BASE_MAINNET)
  })

  it('sets treasuryAddress in both route configs', () => {
    buildX402Middleware(baseConfig)
    const [routes] = paymentMiddleware.mock.calls[0] as [Record<string, { accepts: { payTo: string } }>]
    expect(routes['POST /projects']!.accepts.payTo).toBe(baseConfig.treasuryAddress)
    expect(routes['POST /projects/:id/versions']!.accepts.payTo).toBe(baseConfig.treasuryAddress)
  })

  it('sets correct prices in route configs', () => {
    buildX402Middleware(baseConfig)
    const [routes] = paymentMiddleware.mock.calls[0] as [Record<string, { accepts: { price: string } }>]
    expect(routes['POST /projects']!.accepts.price).toBe('$5.00')
    expect(routes['POST /projects/:id/versions']!.accepts.price).toBe('$2.00')
  })

  it('uses custom facilitatorUrl when provided', () => {
    buildX402Middleware({ ...baseConfig, facilitatorUrl: 'https://custom.facilitator.io' })
    expect(HTTPFacilitatorClient).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://custom.facilitator.io' })
    )
  })
})

// ─── NETWORK constants ────────────────────────────────────────────────────────

describe('NETWORK constants', () => {
  it('NETWORK_BASE_MAINNET is correct CAIP-2', () => {
    expect(NETWORK_BASE_MAINNET).toBe('eip155:8453')
  })
  it('NETWORK_BASE_SEPOLIA is correct CAIP-2', () => {
    expect(NETWORK_BASE_SEPOLIA).toBe('eip155:84532')
  })
})

describe('getPayerAddress()', () => {
  it('returns payer address when x402 payment exists', () => {
    const req = {
      x402: {
        payment: {
          payload: {
            authorization: {
              from: '0xABCDEF1234567890ABCDef1234567890AbCdEf01',
            },
          },
        },
      },
    } as unknown as Request

    expect(getPayerAddress(req)).toBe('0xABCDEF1234567890ABCDef1234567890AbCdEf01')
  })

  it('returns undefined when no x402 payment', () => {
    const req = {} as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })

  it('returns undefined when x402 is present but payment is missing', () => {
    const req = { x402: {} } as unknown as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })

  it('returns undefined when authorization.from is missing', () => {
    const req = {
      x402: { payment: { payload: { authorization: {} } } },
    } as unknown as Request
    expect(getPayerAddress(req)).toBeUndefined()
  })
})
