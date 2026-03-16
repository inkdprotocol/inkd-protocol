/**
 * Inkd API — /v1/buybacks routes
 *
 * GET /v1/buybacks — List recent $INKD buyback events from The Graph
 */
import { Router } from 'express'
import { z, ZodError } from 'zod'
import { getGraphClient } from '../graph.js'
import { sendError, ServiceUnavailableError, BadRequestError } from '../errors.js'

const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  skip:  z.coerce.number().int().min(0).default(0),
})

export function buybacksRouter(): Router {
  const router = Router()

  // GET /v1/buybacks
  router.get('/', async (req, res) => {
    try {
      const { limit, skip } = PaginationQuery.parse(req.query)
      const graph = getGraphClient()
      if (!graph) throw new ServiceUnavailableError('Graph client not configured')

      const buybacks = await graph.getBuybacks(limit, skip)

      const totalUsdcIn  = buybacks.reduce((sum, b) => sum + BigInt(b.usdcIn),  0n)
      const totalInkdOut = buybacks.reduce((sum, b) => sum + BigInt(b.inkdOut), 0n)

      res.setHeader('Cache-Control', 'public, max-age=30')
      res.json({
        data: buybacks.map(b => ({
          id:                   b.id,
          caller:               b.caller,
          usdcIn:               b.usdcIn,
          usdcInUsd:            `$${(Number(b.usdcIn) / 1e6).toFixed(2)}`,
          inkdOut:              b.inkdOut,
          inkdOutFormatted:     (Number(b.inkdOut) / 1e18).toFixed(4),
          timestamp:            b.timestamp,
          txHash:               b.txHash,
          txUrl:                `https://basescan.org/tx/${b.txHash}`,
        })),
        summary: {
          count:                 buybacks.length,
          totalUsdcIn:           totalUsdcIn.toString(),
          totalUsdcInUsd:        `$${(Number(totalUsdcIn) / 1e6).toFixed(2)}`,
          totalInkdOut:          totalInkdOut.toString(),
          totalInkdOutFormatted: (Number(totalInkdOut) / 1e18).toFixed(4),
        },
        limit,
        skip,
      })
    } catch (err) {
      if (err instanceof ZodError) {
        sendError(res, new BadRequestError(err.errors.map(e => e.message).join(', ')))
      } else {
        sendError(res, err)
      }
    }
  })

  return router
}
