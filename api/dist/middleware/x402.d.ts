/**
 * Inkd API — x402 Payment Middleware
 *
 * Agents pay in USDC on Base — no API keys, no accounts, no humans.
 *
 * Flow:
 *   1. Agent sends POST /v1/projects (no payment yet)
 *   2. Server returns 402 with payment details ($5 USDC → Treasury Contract)
 *   3. Agent auto-pays via @x402/fetch (EIP-3009 signed transfer)
 *   4. Coinbase facilitator verifies USDC landed in Treasury
 *   5. Request proceeds — server calls Treasury.settle() to split revenue
 *   6. Registry transaction goes on-chain — payer address = owner
 *
 * Pricing:
 *   POST /v1/projects              → $5.00 USDC (create project)
 *   POST /v1/projects/:id/versions → $2.00 USDC (push version)
 *
 * Revenue split (handled by InkdTreasury.settle()):
 *   $1.00 → arweaveWallet   (Arweave storage)
 *   $2.00 → InkdBuyback     (auto-buys $INKD at $50 threshold)
 *   $2.00 → Treasury        (protocol revenue)
 *
 * Docs: https://x402.org | https://docs.cdp.coinbase.com/x402
 */
import type { RequestHandler, Request } from 'express';
import type { Address } from 'viem';
export declare const NETWORK_BASE_MAINNET = "eip155:8453";
export declare const NETWORK_BASE_SEPOLIA = "eip155:84532";
export declare const USDC_BASE_MAINNET: Address;
export declare const USDC_BASE_SEPOLIA: Address;
export interface X402Config {
    /** InkdTreasury contract address — receives all USDC payments */
    treasuryAddress: Address;
    /** Coinbase facilitator URL. Default: https://x402.org/facilitator */
    facilitatorUrl: string;
    /** Network to accept payments on */
    network: 'mainnet' | 'testnet';
    /** CDP API Key ID — required for Mainnet CDP facilitator */
    cdpApiKeyId?: string | null;
    /** CDP API Key Secret — required for Mainnet CDP facilitator */
    cdpApiKeySecret?: string | null;
}
/**
 * Build x402 USDC payment middleware for Inkd write endpoints.
 *
 * Agents pay with their wallet — USDC goes directly to InkdTreasury.
 * After payment verification, server calls Treasury.settle() to split revenue.
 */
export declare function buildX402Middleware(cfg: X402Config): RequestHandler;
/**
 * Extract the payer's wallet address from x402 payment headers.
 * This address becomes the on-chain owner of the project/version.
 */
export declare function getPayerAddress(req: Request): Address | undefined;
/**
 * Extract the amount paid (in USDC base units, 6 decimals).
 * Returns 5_000_000 for $5.00, 2_000_000 for $2.00, etc.
 */
export declare function getPaymentAmount(req: Request): bigint | undefined;
//# sourceMappingURL=x402.d.ts.map