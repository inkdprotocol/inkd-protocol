/**
 * Code Reviewer Agent
 *
 * Accepts code + language and returns structured review feedback.
 * Replace the `reviewCode()` function with an LLM call for production use.
 */

import http from "node:http";
import { createWalletClient, createPublicClient, http as viemHttp } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ProjectsClient } from "@inkd/sdk";

const PORT     = parseInt(process.env.PORT ?? "3001", 10);
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
      name:          "code-reviewer",
      description:   "Review code quality and return structured feedback",
      isAgent:       true,
      agentEndpoint: `${BASE_URL}/review`,
      license:       "MIT",
    });
    console.log(`Registered on INKD as project #${projectId}`);
  } catch (err) {
    console.error("INKD registration failed:", err);
  }
}

// ─── Core: review code ───────────────────────────────────────────────────────

interface ReviewIssue {
  severity: "error" | "warning" | "info";
  message:  string;
  line?:    number;
}

interface ReviewResult {
  issues:      ReviewIssue[];
  suggestions: string[];
  score:       number;
}

function reviewCode(code: string, language: string, _context?: string): ReviewResult {
  // Stub implementation — replace with an LLM call in production.
  const issues: ReviewIssue[] = [];
  const suggestions: string[] = [];

  // Basic heuristics
  if (code.includes("TODO") || code.includes("FIXME")) {
    issues.push({ severity: "warning", message: "Unresolved TODO/FIXME comment found" });
  }
  if (code.includes("console.log") && language === "typescript") {
    issues.push({ severity: "info", message: "Remove console.log before production" });
  }
  if (code.length > 500 && !code.includes("//") && !code.includes("/*")) {
    suggestions.push("Consider adding comments to explain complex logic");
  }
  if (code.includes("any") && language === "typescript") {
    issues.push({ severity: "warning", message: 'Avoid "any" type — use proper TypeScript types' });
  }

  const score = Math.max(0, 100 - issues.filter(i => i.severity === "error").length * 30
    - issues.filter(i => i.severity === "warning").length * 10
    - issues.filter(i => i.severity === "info").length * 2);

  return { issues, suggestions, score };
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/review") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { code, language, context } = JSON.parse(body) as {
          code: string; language: string; context?: string;
        };
        if (typeof code !== "string" || typeof language !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: '"code" and "language" are required' }));
          return;
        }
        const result = reviewCode(code, language, context);
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
  console.log(`code-reviewer listening on port ${PORT}`);
  await register();
});
