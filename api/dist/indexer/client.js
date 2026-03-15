"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexerClient = void 0;
exports.buildIndexerClient = buildIndexerClient;
// Optional dependency — not available on Vercel/serverless environments
// eslint-disable-next-line @typescript-eslint/no-require-imports
let Database = null;
try {
    Database = require('better-sqlite3');
}
catch { /* not available */ }
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
class IndexerClient {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db;
    constructor(dbPath) {
        const resolved = node_path_1.default.resolve(dbPath);
        if (!node_fs_1.default.existsSync(resolved)) {
            throw new Error(`Indexer DB not found at ${resolved}`);
        }
        if (!Database)
            throw new Error('better-sqlite3 not available in this environment');
        this.db = new Database(resolved, { readonly: true, fileMustExist: true });
    }
    listProjects(offset, limit) {
        return this.db.prepare('SELECT * FROM projects ORDER BY id LIMIT ? OFFSET ?').all(limit, offset);
    }
    countProjects() {
        const row = this.db.prepare('SELECT COUNT(*) as total FROM projects').get();
        return row?.total ?? 0;
    }
    getProject(id) {
        return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) ?? null;
    }
    listVersions(projectId, offset, limit) {
        return this.db.prepare(`
      SELECT * FROM versions
      WHERE project_id = ?
      ORDER BY version_index DESC
      LIMIT ? OFFSET ?
    `).all(projectId, limit, offset);
    }
    countVersions(projectId) {
        const row = this.db.prepare('SELECT COUNT(*) as total FROM versions WHERE project_id = ?').get(projectId);
        return row?.total ?? 0;
    }
    health() {
        const lastRun = this.db.prepare('SELECT cursor FROM cursors WHERE source = ?').get('indexer:lastRun');
        const proj = this.db.prepare('SELECT cursor FROM cursors WHERE source = ?').get('projects:lastId');
        const ver = this.db.prepare('SELECT cursor FROM cursors WHERE source = ?').get('versions:lastSyncedAt');
        return {
            lastRun: lastRun ? Number(lastRun.cursor) : null,
            projectsCursor: proj?.cursor ?? null,
            versionsAt: ver ? Number(ver.cursor) : null,
        };
    }
    close() {
        this.db.close();
    }
}
exports.IndexerClient = IndexerClient;
function buildIndexerClient(dbPath) {
    try {
        if (!dbPath)
            return null;
        return new IndexerClient(dbPath);
    }
    catch (err) {
        console.warn('IndexerClient disabled:', err.message);
        return null;
    }
}
//# sourceMappingURL=client.js.map