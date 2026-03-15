"use strict";
/**
 * Inkd API Server — Configuration
 *
 * All config is via environment variables. See api/.env.example for defaults.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADDRESSES = void 0;
exports.loadConfig = loadConfig;
exports.getChain = getChain;
const node_path_1 = __importDefault(require("node:path"));
const chains_1 = require("viem/chains");
// ─── Network addresses (populated after contract deployment) ──────────────────
exports.ADDRESSES = {
    mainnet: {
        token: (process.env['INKD_TOKEN_ADDRESS'] ?? ''),
        registry: (process.env['INKD_REGISTRY_ADDRESS'] ?? ''),
        treasury: (process.env['INKD_TREASURY_ADDRESS'] ?? ''),
    },
    testnet: {
        token: (process.env['INKD_TOKEN_ADDRESS'] ?? ''),
        registry: (process.env['INKD_REGISTRY_ADDRESS'] ?? ''),
        treasury: (process.env['INKD_TREASURY_ADDRESS'] ?? ''),
    },
};
function loadConfig() {
    const network = (process.env['INKD_NETWORK'] ?? 'testnet');
    if (network !== 'mainnet' && network !== 'testnet') {
        throw new Error(`Invalid INKD_NETWORK: "${network}". Must be "mainnet" or "testnet".`);
    }
    // Force reliable RPC — publicnode.com has intermittent "replacement transaction underpriced" errors
    const defaultRpc = network === 'mainnet'
        ? 'https://mainnet.base.org'
        : 'https://sepolia.base.org';
    // Override env var if it points to publicnode (known flaky)
    const envRpc = process.env['INKD_RPC_URL'];
    const safeRpc = (envRpc && !envRpc.includes('publicnode')) ? envRpc : defaultRpc;
    const serverWalletKey = process.env['SERVER_WALLET_KEY'] ?? null;
    const serverWalletAddress = (process.env['SERVER_WALLET_ADDRESS'] ?? null);
    const treasuryAddress = (process.env['INKD_TREASURY_ADDRESS'] ?? null);
    return {
        port: parseInt(process.env['PORT'] ?? '3000', 10),
        network,
        rpcUrl: safeRpc,
        apiKey: process.env['INKD_API_KEY'] ?? null,
        corsOrigin: process.env['CORS_ORIGIN'] ?? '*',
        rateLimitWindowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '60000', 10),
        rateLimitMax: parseInt(process.env['RATE_LIMIT_MAX'] ?? '60', 10),
        // x402
        serverWalletKey,
        serverWalletAddress,
        treasuryAddress,
        usdcAddress: (network === 'mainnet'
            ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
            : '0x036CbD53842c5426634e7929541eC2318f3dCF7e'),
        x402FacilitatorUrl: process.env['X402_FACILITATOR_URL'] ?? 'https://x402.org/facilitator',
        x402Enabled: Boolean(treasuryAddress) && process.env['X402_ENABLED'] !== 'false',
        cdpApiKeyId: process.env['CDP_API_KEY_ID'] ?? null,
        cdpApiKeySecret: process.env['CDP_API_KEY_SECRET'] ?? null,
        graphEndpoint: process.env['GRAPH_ENDPOINT'] || 'https://api.studio.thegraph.com/query/1743853/inkd/v0.1.0',
        indexerDbPath: process.env['INKD_INDEXER_DB'] ?? node_path_1.default.resolve(process.cwd(), '../data/indexer.db'),
    };
}
// ─── Chain helper ─────────────────────────────────────────────────────────────
function getChain(network) {
    return network === 'mainnet' ? chains_1.base : chains_1.baseSepolia;
}
//# sourceMappingURL=config.js.map