/**
 * agent.json — machine-readable descriptor for INKD agents.
 *
 * Every agent publishes an agent.json alongside its code. Other agents
 * use it to understand capabilities, inputs, outputs, and pricing before
 * calling the agent — no human docs required.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentJsonField {
  type:     "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  default?:  unknown;
  description?: string;
}

export interface AgentJsonPricing {
  /** Price per unit as a decimal string (e.g. "0.01"). */
  price:    string;
  currency: "USDC";
  per:      "request" | "token" | "second" | "byte";
}

export interface AgentJsonInkd {
  /** INKD registry project ID. */
  projectId: number;
  /** Owner wallet address. */
  owner: string;
}

export interface AgentJson {
  /** Unique name for the agent (lowercase, hyphens allowed). */
  name:         string;
  /** Semantic version string. */
  version:      string;
  /** Human and machine readable description of what this agent does. */
  description:  string;
  /** List of capability tags for discovery (e.g. ["summarization", "nlp"]). */
  capabilities: string[];
  /** Input schema: map of field name to field descriptor. */
  inputs:       Record<string, AgentJsonField>;
  /** Output schema: map of field name to field descriptor. */
  outputs:      Record<string, AgentJsonField>;
  /** Pricing information. */
  pricing:      AgentJsonPricing;
  /** Base URL of the agent's HTTP API. */
  endpoint:     string;
  /** INKD registry metadata. */
  inkd:         AgentJsonInkd;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface AgentJsonValidationResult {
  valid:  boolean;
  errors: string[];
}

/**
 * Validate an agent.json descriptor.
 *
 * Checks all required fields are present and correctly typed.
 * Does not make network requests.
 *
 * @example
 * ```ts
 * import { validateAgentJson } from "@inkd/sdk";
 *
 * const result = validateAgentJson(descriptor);
 * if (!result.valid) {
 *   console.error("Invalid agent.json:", result.errors);
 * }
 * ```
 */
export function validateAgentJson(json: unknown): AgentJsonValidationResult {
  const errors: string[] = [];

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return { valid: false, errors: ["agent.json must be a non-null object"] };
  }

  const obj = json as Record<string, unknown>;

  // Required string fields
  for (const field of ["name", "version", "description", "endpoint"] as const) {
    if (typeof obj[field] !== "string" || (obj[field] as string).trim() === "") {
      errors.push(`"${field}" is required and must be a non-empty string`);
    }
  }

  // capabilities: string[]
  if (!Array.isArray(obj["capabilities"])) {
    errors.push('"capabilities" is required and must be an array of strings');
  } else if ((obj["capabilities"] as unknown[]).some(c => typeof c !== "string")) {
    errors.push('"capabilities" must contain only strings');
  }

  // inputs: object
  if (typeof obj["inputs"] !== "object" || obj["inputs"] === null || Array.isArray(obj["inputs"])) {
    errors.push('"inputs" is required and must be an object');
  }

  // outputs: object
  if (typeof obj["outputs"] !== "object" || obj["outputs"] === null || Array.isArray(obj["outputs"])) {
    errors.push('"outputs" is required and must be an object');
  }

  // pricing: object with price, currency, per
  if (typeof obj["pricing"] !== "object" || obj["pricing"] === null) {
    errors.push('"pricing" is required and must be an object');
  } else {
    const pricing = obj["pricing"] as Record<string, unknown>;
    if (typeof pricing["price"] !== "string" || pricing["price"].trim() === "") {
      errors.push('"pricing.price" is required and must be a non-empty string (e.g. "0.01")');
    }
    if (pricing["currency"] !== "USDC") {
      errors.push('"pricing.currency" must be "USDC"');
    }
    if (!["request", "token", "second", "byte"].includes(pricing["per"] as string)) {
      errors.push('"pricing.per" must be one of: "request", "token", "second", "byte"');
    }
  }

  // inkd: object with projectId (number) and owner (string)
  if (typeof obj["inkd"] !== "object" || obj["inkd"] === null) {
    errors.push('"inkd" is required and must be an object');
  } else {
    const inkd = obj["inkd"] as Record<string, unknown>;
    if (typeof inkd["projectId"] !== "number" || !Number.isInteger(inkd["projectId"])) {
      errors.push('"inkd.projectId" is required and must be an integer');
    }
    if (typeof inkd["owner"] !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(inkd["owner"] as string)) {
      errors.push('"inkd.owner" is required and must be a valid Ethereum address (0x...)');
    }
  }

  return { valid: errors.length === 0, errors };
}
