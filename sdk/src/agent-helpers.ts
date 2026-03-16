/**
 * Standalone agent discovery and calling helpers.
 *
 * These functions do not require a wallet or x402 payment — discovery and
 * calling are free read operations (from the registry's perspective).
 * Agent-to-agent payment happens at the agent's own endpoint.
 */

import type { Project } from "./ProjectsClient.js";

const DEFAULT_API_URL = "https://api.inkdprotocol.com";

/**
 * Search for agents on the INKD registry by capability or keyword.
 *
 * Hits GET /v1/search/projects?q=...&isAgent=true
 * No wallet required — discovery is free.
 *
 * @example
 * ```ts
 * import { searchAgents } from "@inkd/sdk";
 *
 * const agents = await searchAgents("text summarization");
 * console.log(agents[0].agentEndpoint); // https://summarizer.example.com/v1
 * ```
 */
export async function searchAgents(
  query: string,
  options: { limit?: number; apiUrl?: string } = {}
): Promise<Project[]> {
  const base   = options.apiUrl ?? DEFAULT_API_URL;
  const params = new URLSearchParams({ q: query, isAgent: "true" });
  if (options.limit) params.set("limit", String(options.limit));

  const res  = await fetch(`${base}/v1/search/projects?${params}`);
  const body = await res.json() as { data?: Project[] } & Record<string, unknown>;
  if (!res.ok) throw new Error(`searchAgents failed [${res.status}]`);
  return (body["data"] ?? body) as Project[];
}

/**
 * Call a registered agent by INKD project ID.
 *
 * Fetches the project's `agentEndpoint` from the registry, then POSTs
 * `input` to that endpoint. Returns the parsed JSON response.
 *
 * @example
 * ```ts
 * import { callAgent } from "@inkd/sdk";
 *
 * const result = await callAgent(42, { text: "Summarize this", maxLength: 100 });
 * console.log(result); // { summary: "..." }
 * ```
 */
export async function callAgent(
  projectId: number | string,
  input: Record<string, unknown>,
  options: { apiUrl?: string } = {}
): Promise<unknown> {
  const base    = options.apiUrl ?? DEFAULT_API_URL;
  const res     = await fetch(`${base}/v1/projects/${projectId}`);
  const body    = await res.json() as { data?: { agentEndpoint?: string } } & Record<string, unknown>;
  if (!res.ok) throw new Error(`callAgent: project fetch failed [${res.status}]`);

  const project = (body["data"] ?? body) as { agentEndpoint?: string };
  if (!project.agentEndpoint) {
    throw new Error(`Project ${projectId} has no agentEndpoint registered`);
  }

  const callRes = await fetch(project.agentEndpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(input),
  });

  if (!callRes.ok) {
    const text = await callRes.text();
    throw new Error(`callAgent failed [${callRes.status}]: ${text}`);
  }

  return callRes.json();
}
