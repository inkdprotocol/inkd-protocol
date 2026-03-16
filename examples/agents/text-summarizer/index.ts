/**
 * Text Summarizer Agent
 *
 * A minimal HTTP agent that:
 * 1. Registers itself on the INKD registry at startup
 * 2. Accepts POST /summarize with { text, maxLength? }
 * 3. Returns { summary }
 *
 * Payment enforcement is handled by the agent itself (or via x402 middleware).
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createWalletClient, createPublicClient, http as viemHttp } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ProjectsClient } from "@inkd/sdk";

const PORT     = parseInt(process.env.PORT ?? "3000", 10);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

// ─── Startup: register on INKD ────────────────────────────────────────────────

async function register() {
  const privateKey = process.env.INKD_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    console.warn("INKD_PRIVATE_KEY not set — skipping registration");
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const wallet  = createWalletClient({ account, chain: base, transport: viemHttp() });
  const reader  = createPublicClient({ chain: base, transport: viemHttp() });
  const client  = new ProjectsClient({ wallet, publicClient: reader });

  try {
    const { projectId } = await client.createProject({
      name:          "text-summarizer",
      description:   "Summarize any text to a configurable length",
      isAgent:       true,
      agentEndpoint: `${BASE_URL}/summarize`,
      license:       "MIT",
    });

    // Update agent.json with the real projectId and owner
    const descriptor = JSON.parse(
      fs.readFileSync(path.join(__dirname, "agent.json"), "utf8")
    );
    descriptor.inkd.projectId = projectId;
    descriptor.inkd.owner     = account.address;
    descriptor.endpoint       = `${BASE_URL}/v1`;
    fs.writeFileSync(
      path.join(__dirname, "agent.json"),
      JSON.stringify(descriptor, null, 2)
    );

    console.log(`Registered on INKD as project #${projectId}`);
  } catch (err) {
    console.error("INKD registration failed:", err);
  }
}

// ─── Core: summarize text ────────────────────────────────────────────────────

function summarize(text: string, maxLength = 200): string {
  if (text.length <= maxLength) return text;
  // Naive truncate-at-word-boundary summarizer.
  // Replace with an LLM call for production use.
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/summarize") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { text, maxLength } = JSON.parse(body) as { text: string; maxLength?: number };
        if (typeof text !== "string" || text.trim() === "") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: '"text" is required' }));
          return;
        }
        const summary = summarize(text, maxLength);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ summary }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, async () => {
  console.log(`text-summarizer listening on port ${PORT}`);
  await register();
});
