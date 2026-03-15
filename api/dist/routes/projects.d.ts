/**
 * Inkd API — /v1/projects routes
 *
 * GET  /v1/projects                     List all projects (paginated)
 * GET  /v1/projects/estimate?bytes=N    Estimate USDC cost for a content upload
 * GET  /v1/projects/:id                 Get a single project by id (with V2 metadata)
 * POST /v1/projects                     Create a new project (createProjectV2, fee via x402)
 * GET  /v1/projects/:id/versions        List versions for a project
 * POST /v1/projects/:id/versions        Push a new version (pushVersionV2, fee via x402)
 */
import { Router } from 'express';
import { type ApiConfig } from '../config.js';
export declare function projectsRouter(cfg: ApiConfig): Router;
//# sourceMappingURL=projects.d.ts.map