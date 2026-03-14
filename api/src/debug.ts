import express from 'express'
const app = express()
app.get('/', (_req, res) => res.json({ ok: true, time: Date.now() }))
app.get('/test', (_req, res) => res.json({ test: 'works' }))
export default app
