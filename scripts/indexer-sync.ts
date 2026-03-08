#!/usr/bin/env ts-node

import Database from 'better-sqlite3'
import { GraphQLClient, gql } from 'graphql-request'
import { DateTime } from 'luxon'
import path from 'node:path'
import fs from 'node:fs'

type ProjectRow = {
  id: number
  owner: string
  name: string
  description: string
  license: string
  readme_hash: string
  is_public: number
  is_agent: number
  agent_endpoint: string
  metadata_uri: string
  fork_of: number
  access_manifest: string
  tags_hash: string
  version_count: number
  created_at: number
  updated_at: number
}

type VersionRow = {
  project_id: number
  version_index: number
  arweave_hash: string
  version_tag: string
  changelog: string
  pushed_by: string
  agent_address: string | null
  meta_hash: string
  pushed_at: number
}

type Sqlite = Database.Database

const GRAPH_URL = process.env.INKD_GRAPH_URL ?? 'https://api.studio.thegraph.com/query/1743853/inkd/v0.1.0'
const DB_PATH   = path.join(process.cwd(), 'data/indexer.db')

const client = new GraphQLClient(GRAPH_URL)

const PROJECTS_QUERY = gql`
  query Projects($lastId: ID!) {
    projects(first: 100, where: { id_gt: $lastId }, orderBy: id, orderDirection: asc) {
      id
      projectId
      name
      description
      license
      readmeHash
      owner { id }
      isPublic
      isAgent
      agentEndpoint
      metadataUri
      forkOf { projectId }
      accessManifest
      versionCount
      createdAt
    }
  }
`

const VERSIONS_QUERY = gql`
  query Versions($projectId: ID!, $cursor: ID!) {
    versions(
      first: 200,
      where: { project: $projectId, id_gt: $cursor },
      orderBy: id,
      orderDirection: asc
    ) {
      id
      arweaveHash
      versionTag
      changelog
      pushedBy { id }
      agentAddress { id }
      pushedAt
      blockNumber
      transactionHash
    }
  }
`

function requireDb(): Sqlite {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`indexer db missing at ${DB_PATH}. Run sqlite3 data/indexer.db < scripts/indexer-schema.sql`)
  }
  return new Database(DB_PATH)
}

function readCursor(db: Sqlite, source: string, fallback = '0'): string {
  const row = db.prepare('SELECT cursor FROM cursors WHERE source = ?').get(source) as { cursor: string } | undefined
  return row?.cursor ?? fallback
}

function writeCursor(db: Sqlite, source: string, value: string) {
  db.prepare(`
    INSERT INTO cursors (source, cursor, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(source) DO UPDATE SET
      cursor = excluded.cursor,
      updated_at = excluded.updated_at
  `).run(source, value, Math.floor(Date.now() / 1000))
}

async function syncProjects() {
  const db = requireDb()
  try {
    let lastId = readCursor(db, 'projects:lastId', '0')
    const insert = db.prepare(`
      INSERT INTO projects (
        id, owner, name, description, license, readme_hash, is_public, is_agent, agent_endpoint,
        metadata_uri, fork_of, access_manifest, tags_hash, version_count, created_at, updated_at
      ) VALUES (
        @id, @owner, @name, @description, @license, @readme_hash, @is_public, @is_agent, @agent_endpoint,
        @metadata_uri, @fork_of, @access_manifest, @tags_hash, @version_count, @created_at, @updated_at
      ) ON CONFLICT(id) DO UPDATE SET
        owner = excluded.owner,
        name = excluded.name,
        description = excluded.description,
        license = excluded.license,
        readme_hash = excluded.readme_hash,
        is_public = excluded.is_public,
        is_agent = excluded.is_agent,
        agent_endpoint = excluded.agent_endpoint,
        metadata_uri = excluded.metadata_uri,
        fork_of = excluded.fork_of,
        access_manifest = excluded.access_manifest,
        tags_hash = excluded.tags_hash,
        version_count = excluded.version_count,
        updated_at = excluded.updated_at
    `)

    while (true) {
      const { projects } = await client.request(PROJECTS_QUERY, { lastId }) as any
      if (!projects.length) break
      const tx = db.transaction((rows: any[]) => {
        rows.forEach((p) => insert.run({
          id:            Number(p.projectId),
          owner:         p.owner.id,
          name:          p.name,
          description:   p.description ?? '',
          license:       p.license ?? 'MIT',
          readme_hash:   p.readmeHash ?? '',
          is_public:     p.isPublic ? 1 : 0,
          is_agent:      p.isAgent ? 1 : 0,
          agent_endpoint: p.agentEndpoint ?? '',
          metadata_uri:  p.metadataUri ?? '',
          fork_of:       p.forkOf?.projectId ? Number(p.forkOf.projectId) : 0,
          access_manifest: p.accessManifest ?? '',
          tags_hash:     '',
          version_count: Number(p.versionCount ?? 0),
          created_at:    Number(p.createdAt ?? 0),
          updated_at:    Number(p.createdAt ?? 0),
        }))
      })
      tx(projects)
      lastId = projects[projects.length - 1].id
    }

    writeCursor(db, 'projects:lastId', lastId)
    writeCursor(db, 'projects:lastSyncedAt', Date.now().toString())
    console.log(`✅ Projects synced up to ID ${lastId}`)
  } finally {
    db.close()
  }
}

async function syncVersions() {
  const db = requireDb()
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY id').all() as ProjectRow[]
    const selectCursor   = db.prepare('SELECT MAX(version_index) as maxIdx FROM versions WHERE project_id = ?')
    const upsertVersion  = db.prepare(`
      INSERT INTO versions (
        project_id, version_index, arweave_hash, version_tag, changelog,
        pushed_by, agent_address, meta_hash, pushed_at
      ) VALUES (
        @project_id, @version_index, @arweave_hash, @version_tag, @changelog,
        @pushed_by, @agent_address, @meta_hash, @pushed_at
      ) ON CONFLICT(project_id, version_index) DO UPDATE SET
        arweave_hash = excluded.arweave_hash,
        version_tag  = excluded.version_tag,
        changelog    = excluded.changelog,
        pushed_by    = excluded.pushed_by,
        agent_address = excluded.agent_address,
        meta_hash     = excluded.meta_hash,
        pushed_at     = excluded.pushed_at
    `)

    const tx = db.transaction((rows: VersionRow[]) => {
      rows.forEach(row => upsertVersion.run(row))
    })

    for (const project of projects) {
      const cursorRow = selectCursor.get(project.id) as { maxIdx: number | null } | undefined
      let cursorIdx = cursorRow?.maxIdx ?? -1
      let cursorId  = `${project.id}-${cursorIdx}`

      while (true) {
        const { versions } = await client.request(VERSIONS_QUERY, {
          projectId: project.id.toString(),
          cursor: cursorId,
        }) as any
        if (!versions.length) break
        const rows = versions.map((v: any) => {
          const [, versionIndex] = v.id.split('-')
          return {
            project_id:    project.id,
            version_index: Number(versionIndex ?? 0),
            arweave_hash:  v.arweaveHash,
            version_tag:   v.versionTag,
            changelog:     v.changelog ?? '',
            pushed_by:     v.pushedBy?.id ?? '0x0000000000000000000000000000000000000000',
            agent_address: v.agentAddress?.id ?? null,
            meta_hash:     '',
            pushed_at:     Number(v.pushedAt ?? 0),
          }
        }) as VersionRow[]
        tx(rows)
        cursorId = versions[versions.length - 1].id
      }
    }

    writeCursor(db, 'versions:lastSyncedAt', Date.now().toString())
    console.log('✅ Versions synced')
  } finally {
    db.close()
  }
}

async function main() {
  console.log(`[${DateTime.utc().toISO()}] Starting indexer sync...`)
  await syncProjects()
  await syncVersions()
  const db = requireDb()
  try {
    writeCursor(db, 'indexer:lastRun', Date.now().toString())
  } finally {
    db.close()
  }
  console.log(`[${DateTime.utc().toISO()}] Done.`)
}

main().catch(err => {
  console.error('❌', err)
  process.exit(1)
})
