"use strict";
/**
 * Inkd API Server — Error types & helpers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceUnavailableError = exports.UnauthorizedError = exports.BadRequestError = exports.NotFoundError = exports.ApiError = void 0;
exports.sendError = sendError;
class ApiError extends Error {
    statusCode;
    code;
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'ApiError';
    }
}
exports.ApiError = ApiError;
class NotFoundError extends ApiError {
    constructor(resource) {
        super(404, `${resource} not found`, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class BadRequestError extends ApiError {
    constructor(message) {
        super(400, message, 'BAD_REQUEST');
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends ApiError {
    constructor(message = 'Invalid or missing API key') {
        super(401, message, 'UNAUTHORIZED');
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ServiceUnavailableError extends ApiError {
    constructor(message) {
        super(503, message, 'SERVICE_UNAVAILABLE');
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
// Known contract error selectors → human-readable messages
const CONTRACT_ERROR_SELECTORS = {
    '0x9e4b2685': { code: 'NAME_TAKEN', message: 'Project name is already taken' },
    '0xd13f0e39': { code: 'EMPTY_NAME', message: 'Project name cannot be empty' },
    '0xa9597f01': { code: 'NAME_TOO_LONG', message: 'Project name is too long (max 64 chars)' },
    '0xece5114d': { code: 'DESCRIPTION_TOO_LONG', message: 'Description is too long' },
    '0x9345107e': { code: 'EMPTY_ARWEAVE_HASH', message: 'Arweave hash cannot be empty' },
    '0x1e53dd91': { code: 'EMPTY_VERSION_TAG', message: 'Version tag cannot be empty' },
    '0xa8122cf6': { code: 'PROJECT_NOT_FOUND', message: 'Project not found' },
    '0x01f82199': { code: 'NOT_OWNER', message: 'Not the project owner' },
    '0x3acf1427': { code: 'NOT_OWNER_OR_COLLABORATOR', message: 'Not owner or collaborator' },
    '0xdf269a67': { code: 'INSUFFICIENT_ALLOWANCE', message: 'Insufficient USDC allowance' },
    '0x7ad0269b': { code: 'INSUFFICIENT_FEE', message: 'Insufficient fee' },
    '0x94b7950d': { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    '0xeb4111cd': { code: 'ZERO_ADDRESS', message: 'Zero address not allowed' },
};
function sendError(res, err) {
    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            error: {
                code: err.code ?? 'ERROR',
                message: err.message,
            },
        });
        return;
    }
    // Unknown / RPC errors
    const message = err instanceof Error ? err.message : String(err);
    // Check for known contract error selectors
    for (const [selector, info] of Object.entries(CONTRACT_ERROR_SELECTORS)) {
        if (message.includes(selector)) {
            res.status(400).json({
                error: { code: info.code, message: info.message },
            });
            return;
        }
    }
    const isRpc = message.toLowerCase().includes('rpc') ||
        message.toLowerCase().includes('contract');
    if (isRpc) {
        res.status(502).json({
            error: { code: 'RPC_ERROR', message: `RPC call failed: ${message}` },
        });
        return;
    }
    console.error('[inkd-api] Unhandled error:', err);
    res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
}
//# sourceMappingURL=errors.js.map