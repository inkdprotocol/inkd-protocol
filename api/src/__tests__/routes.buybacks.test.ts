/**
 * @inkd/api — /v1/buybacks route tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const mockGetBuybacks = vi.fn()

vi.mock('../graph.js', () => ({
  getGraphClient: vi.fn(() => ({ getBuybacks: mockGetBuybacks })),
  initGraphClient: vi.fn(),
}))

async function makeApp() {
  const { buybacksRouter } = await import('../routes/buybacks.js')
  const app = express()
  app.use(express.json())
  app.use('/v1/buybacks', buybacksRouter())
  return app
}

const sample = {
  id: '0xabc-0',
  caller: '0x1234567890abcdef1234567890abcdef12345678',
  usdcIn: '50000000',
  inkdOut: '1234567890000000000000',
  timestamp: '1741000000',
  txHash: '0xabc123',
}

describe('GET /v1/buybacks', () => {
  beforeEach(() => mockGetBuybacks.mockReset())

  it('returns 200 with buyback list', async () => {
    mockGetBuybacks.mockResolvedValue([sample])
    const app = await makeApp()
    const res = await request(app).get('/v1/buybacks')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].usdcInUsd).toBe('$50.00')
    expect(res.body.data[0].txUrl).toBe('https://basescan.org/tx/0xabc123')
    expect(res.body.summary.count).toBe(1)
  })

  it('returns correct totals for multiple events', async () => {
    mockGetBuybacks.mockResolvedValue([
      sample,
      { ...sample, id: '0xabc-1', usdcIn: '25000000', inkdOut: '500000000000000000000' },
    ])
    const app = await makeApp()
    const res = await request(app).get('/v1/buybacks')
    expect(res.body.summary.totalUsdcInUsd).toBe('$75.00')
    expect(res.body.summary.count).toBe(2)
  })

  it('returns 503 when graph not configured', async () => {
    const graphMod = await import('../graph.js')
    vi.mocked(graphMod.getGraphClient).mockReturnValueOnce(null)
    const app = await makeApp()
    const res = await request(app).get('/v1/buybacks')
    expect(res.status).toBe(503)
  })

  it('passes limit and skip to graph', async () => {
    mockGetBuybacks.mockResolvedValue([])
    const app = await makeApp()
    await request(app).get('/v1/buybacks?limit=5&skip=10')
    expect(mockGetBuybacks).toHaveBeenCalledWith(5, 10)
  })

  it('handles empty list gracefully', async () => {
    mockGetBuybacks.mockResolvedValue([])
    const app = await makeApp()
    const res = await request(app).get('/v1/buybacks')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
    expect(res.body.summary.totalUsdcInUsd).toBe('$0.00')
    expect(res.body.summary.totalInkdOut).toBe('0')
  })

  it('rejects invalid limit param', async () => {
    mockGetBuybacks.mockResolvedValue([])
    const app = await makeApp()
    const res = await request(app).get('/v1/buybacks?limit=999')
    expect(res.status).toBe(400)
  })
})
