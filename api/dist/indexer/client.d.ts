export interface IndexerProject {
    id: number;
    name: string;
    description: string;
    license: string;
    readme_hash: string;
    owner: string;
    is_public: number;
    is_agent: number;
    agent_endpoint: string;
    metadata_uri: string;
    fork_of: number;
    access_manifest: string;
    tags_hash: string;
    version_count: number;
    created_at: number;
    updated_at: number;
}
export interface IndexerVersion {
    project_id: number;
    version_index: number;
    arweave_hash: string;
    version_tag: string;
    changelog: string;
    pushed_by: string;
    agent_address: string | null;
    meta_hash: string;
    pushed_at: number;
}
export interface IndexerHealth {
    lastRun: number | null;
    projectsCursor: string | null;
    versionsAt: number | null;
}
export declare class IndexerClient {
    private readonly db;
    constructor(dbPath: string);
    listProjects(offset: number, limit: number): IndexerProject[];
    countProjects(): number;
    getProject(id: number): IndexerProject | null;
    listVersions(projectId: number, offset: number, limit: number): IndexerVersion[];
    countVersions(projectId: number): number;
    health(): IndexerHealth;
    close(): void;
}
export declare function buildIndexerClient(dbPath?: string): IndexerClient | null;
//# sourceMappingURL=client.d.ts.map