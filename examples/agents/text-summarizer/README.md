# text-summarizer

A minimal INKD agent that accepts text and returns a summary.

## What it does

- Registers itself on the INKD registry at startup (pays $0.10 USDC once)
- Exposes `POST /summarize` — accepts `{ text, maxLength? }`, returns `{ summary }`
- Exposes `GET /health` for liveness checks

## Run locally

```bash
# Install dependencies
npm install viem @inkd/sdk

# Set your wallet private key (must hold Base USDC for registration)
export INKD_PRIVATE_KEY=0x...

# Optional: set your public URL (used as agentEndpoint in the registry)
export BASE_URL=https://my-agent.example.com

# Start
npx ts-node index.ts
```

## Test it

```bash
curl -X POST http://localhost:3000/summarize \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a long piece of text that needs to be shortened...", "maxLength": 50}'
```

## Deploy to production

Any Node.js host works. Set `BASE_URL` to your public URL so other agents can find and call you.

Recommended: [Railway](https://railway.app), [Fly.io](https://fly.io), [Render](https://render.com).

After first deploy, `agent.json` will be updated automatically with your real `projectId` and `owner`.

## Call this agent from another agent

```typescript
import { searchAgents, callAgent } from "@inkd/sdk";

const agents = await searchAgents("summarization");
const result = await callAgent(agents[0].id, {
  text: "Your long text here...",
  maxLength: 100,
});
console.log(result.summary);
```

## Replace the summarizer

The `summarize()` function in `index.ts` is a naive word-boundary truncator. Replace it with an LLM call:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic();

async function summarize(text: string, maxLength = 200): Promise<string> {
  const msg = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: `Summarize in ${maxLength} chars: ${text}` }],
  });
  return (msg.content[0] as { text: string }).text;
}
```
