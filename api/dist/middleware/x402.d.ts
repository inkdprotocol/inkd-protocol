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
export declare const PRICE_CREATE_PROJECT = 5000000n;
export declare const PRICE_PUSH_VERSION = 2000000n;
export interface X402Config {
    /** InkdTreasury contract address — receives all USDC payments */
    treasuryAddress: Address;
    /** Coinbase facilitator URL. Default: https://x402.org/facilitator */
    facilitatorUrl: string;
    /** Network to accept payments on */
    network: 'mainnet' | 'testnet';
}
/**
 * Build x402 USDC payment middleware for Inkd write endpoints.
 *
 * NOTE: Routes are relative to /v1 mount point — no /v1 prefix here.
 * NOTE: syncFacilitatorOnStart=false — avoids blocking cold starts on Vercel.
 */
export declare function buildX402Middleware(cfg: X402Config): RequestHandler;
/**
 * Extract the payer's wallet address from x402 payment headers.
 * This address becomes the on-chain owner of the project/version.
 *
 * EIP-3009 exact scheme: payload.authorization.from
 */
export declare function getPayerAddress(req: Request): Address | undefined;
/**
 * Extract the amount paid (in USDC base units, 6 decimals).
 *
 * Falls back to route-hardcoded amounts if header is absent:
 *   POST /projects          → 5_000_000 ($5.00)
 *   POST /projects/.../versions → 2_000_000 ($2.00)
 */
export declare function getPaymentAmount(req: Request): bigint | undefined;
//# sourceMappingURL=x402.d.ts.map