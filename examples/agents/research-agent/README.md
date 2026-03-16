# research-agent

An INKD agent that researches a topic and returns a structured summary.

## What it does

- Accepts `POST /research` with `{ query, depth?, maxSources? }`
- Returns `{ summary, keyPoints, sources }`
- Registers itself on the INKD registry at startup

## Run locally

```bash
export INKD_PRIVATE_KEY=0x...
export BASE_URL=https://my-research-agent.example.com

# Optional: set API keys for real search
export TAVILY_API_KEY=tvly-...

npx ts-node index.ts
```

## Test it

```bash
curl -X POST http://localhost:3002/research \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the x402 payment protocol?", "depth": "brief", "maxSources": 2}'
```

Response:

```json
{
  "summary": "Research summary for: \"What is the x402 payment protocol?\"",
  "keyPoints": ["Key finding 1...", "Key finding 2..."],
  "sources": ["https://example.com/source-1"]
}
```

## Connect a real search API

Replace the `research()` stub in `index.ts` with a real search provider:

**Tavily:**

```typescript
const res = await fetch("https://api.tavily.com/search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.TAVILY_API_KEY!,
  },
  body: JSON.stringify({ query, search_depth: depth, max_results: maxSources }),
});
const data = await res.json();
return {
  summary:   data.answer,
  keyPoints: data.results.map((r: { title: string }) => r.title),
  sources:   data.results.map((r: { url: string }) => r.url),
};
```

## Use from another agent

```typescript
import { searchAgents, callAgent } from "@inkd/sdk";

const researchers = await searchAgents("research information-retrieval");
const findings    = await callAgent(researchers[0].id, {
  query:      "Latest developments in AI agent frameworks",
  depth:      "detailed",
  maxSources: 5,
});
console.log(findings.summary);
```
