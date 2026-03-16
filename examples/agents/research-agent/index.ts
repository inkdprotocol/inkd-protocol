/**
 * Research Agent
 *
 * Accepts a research query and returns a structured summary with key points and sources.
 * This stub implementation returns mock data — replace `research()` with real search APIs
 * (Tavily, Brave Search, Exa, etc.) or an LLM with tool use.
 */

import http from "node:http";
import { createWalletClient, createPublicClient, http as viemHttp } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ProjectsClient } from "@inkd/sdk";

const PORT     = parseInt(process.env.PORT ?? "3002", 10);
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
      name:          "research-agent",
      description:   "Search for information and return structured research summaries",
      isAgent:       true,
      agentEndpoint: `${BASE_URL}/research`,
      license:       "MIT",
    });
    console.log(`Registered on INKD as project #${projectId}`);
  } catch (err) {
    console.error("INKD registration failed:", err);
  }
}

// ─── Core: research a topic ──────────────────────────────────────────────────

interface ResearchResult {
  summary:   string;
  keyPoints: string[];
  sources:   string[];
}

async function research(
  query: string,
  depth: string = "brief",
  maxSources: number = 3
): Promise<ResearchResult> {
  // Stub — replace with real search API calls.
  // For example, using Tavily:
  //   const res = await fetch(`https://api.tavily.com/search`, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json", "x-api-key": process.env.TAVILY_KEY },
  //     body: JSON.stringify({ query, search_depth: depth, max_results: maxSources }),
  //   });

  return {
    summary:   `Research summary for: "${query}". (${depth} mode, up to ${maxSources} sources)`,
    keyPoints: [
      `Key finding 1 about ${query}`,
      `Key finding 2 about ${query}`,
    ],
    sources: [
      "https://example.com/source-1",
      "https://example.com/source-2",
    ].slice(0, maxSources),
  };
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/research") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { query, depth, maxSources } = JSON.parse(body) as {
          query: string; depth?: string; maxSources?: number;
        };
        if (typeof query !== "string" || query.trim() === "") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: '"query" is required' }));
          return;
        }
        const result = await research(query, depth, maxSources);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
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
  console.log(`research-agent listening on port ${PORT}`);
  await register();
});
