/**
 * @file search.ts
 * @description Graph-powered search and discovery routes.
 *
 * GET /v1/search?q=<query>           — full-text search projects + agents
 * GET /v1/search/projects?q=<query>  — search projects only
 * GET /v1/search/agents?q=<query>    — search agents only
 * GET /v1/search/stats               — protocol stats
 * GET /v1/search/by-owner/:address   — projects owned by address
 */
import { Router } from 'express';
export declare function buildSearchRouter(): Router;
//# sourceMappingURL=search.d.ts.map