/**
 * Inkd API — x402 Payment Middleware
 *
 * Agents pay in USDC on Base — no API keys, no accounts, no humans.
 *
 * Flow:
 *   1. Agent sends POST /v1/projects (no payment yet)
 *   2. Server returns 402 with payment details (amount → Treasury Contract)
 *   3. Agent auto-pays via @x402/fetch (EIP-3009 signed transfer)
 *   4. LocalFacilitator verifies the payment signature + amount
 *   5. Request proceeds — server calls Treasury.settle() to split revenue
 *   6. Registry transaction goes on-chain — payer address = owner
 *
 * Pricing:
 *   POST /v1/projects              → $0.10 USDC minimum (create project)
 *   POST /v1/projects/:id/versions → arweaveCost × 1.20, min $0.10 (push version)
 *
 * Revenue split (handled by InkdTreasury.settle()):
 *   arweaveCost → arweaveWallet (Arweave storage, forwarded to Irys)
 *   10% markup  → InkdBuyback  (auto-buys $INKD at $50 threshold)
 *   $2.00 → Treasury        (protocol revenue)
 */
import type { RequestHandler, Request } from 'express';
import type { Address } from 'viem';
export declare const NETWORK_BASE_MAINNET = "eip155:8453";
export declare const NETWORK_BASE_SEPOLIA = "eip155:84532";
export declare const USDC_BASE_MAINNET: Address;
export declare const USDC_BASE_SEPOLIA: Address;
/** Minimum / fallback payment amounts per route (USDC, 6 decimals).
 *  createProject = $0.10 flat (spam prevention + gas coverage)
 *  pushVersion   = dynamic (Arweave cost + 20% markup), floor $0.10
 */
export declare const PRICE_CREATE_PROJECT = 100000n;
export declare const PRICE_PUSH_VERSION_MIN = 100000n;
export interface X402Config {
    treasuryAddress: Address;
    facilitatorUrl: string;
    network: 'mainnet' | 'testnet';
    cdpApiKeyId?: string | null;
    cdpApiKeySecret?: string | null;
}
/**
 * Build x402 USDC payment middleware.
 * Uses LocalFacilitatorClient — no CDP dependency, no external HTTP calls on startup.
 *
 * Routes are relative to /v1 mount point (app.use('/v1', x402)).
 */
export declare function buildX402Middleware(cfg: X402Config): RequestHandler;
/** Extract payer address — becomes on-chain owner of the project/version. */
export declare function getPayerAddress(req: Request): Address | undefined;
/**
 * Extract USDC amount paid (6 decimals).
 * Falls back to route-hardcoded amounts if header absent.
 */
export declare function getPaymentAmount(req: Request): bigint | undefined;
export interface PaymentAuthorizationData {
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: `0x${string}`;
    v: number;
    r: `0x${string}`;
    s: `0x${string}`;
}
/**
 * Extract full EIP-3009 authorization from X-PAYMENT header.
 * Returns null if header is absent or malformed.
 */
export declare function getPaymentAuthorizationData(req: Request): PaymentAuthorizationData | null;
/**
 * Intercepts POST /projects/:id/versions BEFORE x402 middleware.
 * If no X-PAYMENT header: computes dynamic price (Arweave cost + 20%) from
 * req.body.contentSize and returns a 402 with the correct amount.
 * If X-PAYMENT header is present: passes through to x402 for verification.
 *
 * This is needed because x402 RoutesConfig only supports static prices,
 * but Arweave upload cost depends on content size.
 */
export declare function buildDynamicVersionPriceMiddleware(cfg: X402Config): RequestHandler;
//# sourceMappingURL=x402.d.ts.map