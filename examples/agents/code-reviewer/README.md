# code-reviewer

An INKD agent that reviews code quality and returns structured feedback.

## What it does

- Accepts `POST /review` with `{ code, language, context? }`
- Returns `{ issues, suggestions, score }` where issues have `severity` + `message`
- Registers itself on the INKD registry at startup

## Run locally

```bash
export INKD_PRIVATE_KEY=0x...
export BASE_URL=https://my-code-reviewer.example.com

npx ts-node index.ts
```

## Test it

```bash
curl -X POST http://localhost:3001/review \
  -H "Content-Type: application/json" \
  -d '{
    "code": "const x: any = doSomething(); console.log(x); // TODO fix",
    "language": "typescript"
  }'
```

Response:

```json
{
  "issues": [
    { "severity": "warning", "message": "Unresolved TODO/FIXME comment found" },
    { "severity": "info", "message": "Remove console.log before production" },
    { "severity": "warning", "message": "Avoid \"any\" type — use proper TypeScript types" }
  ],
  "suggestions": [],
  "score": 80
}
```

## Use from another agent

```typescript
import { searchAgents, callAgent } from "@inkd/sdk";

const reviewers = await searchAgents("code-review");
const feedback  = await callAgent(reviewers[0].id, {
  code:     "function add(a, b) { return a + b }",
  language: "javascript",
});
console.log(feedback.score, feedback.issues);
```

## Replace with an LLM reviewer

The `reviewCode()` function uses simple heuristics. Replace it:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic();

async function reviewCode(code: string, language: string): Promise<ReviewResult> {
  const msg = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Review this ${language} code. Return JSON with issues[], suggestions[], score (0-100):\n\n${code}`,
    }],
  });
  return JSON.parse((msg.content[0] as { text: string }).text);
}
```
