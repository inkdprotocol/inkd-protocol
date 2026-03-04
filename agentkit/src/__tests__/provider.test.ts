/**
 * @inkd/agentkit — InkdActionProvider test suite
 *
 * Tests all four actions:
 *   inkd_create_project, inkd_push_version, inkd_get_project, inkd_list_agents
 *
 * Coverage:
 *   - Happy paths (success responses)
 *   - Error paths (non-ok responses, 404s, thrown errors)
 *   - Constructor defaults vs config overrides
 *   - getActions() registration shape
 *   - buildFetch fallback (no walletProvider, no @x402/fetch)
 *   - getWalletAddress (with/without context)
 *
 * IMPORTANT: InkdActionProvider captures globalThis.fetch at constructor time
 * (this.fetch = globalThis.fetch). Each test must stub BEFORE constructing.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { InkdActionProvider } from '../provider.js'
import {
  INKD_ACTIONS,
  CreateProjectSchema,
  PushVersionSchema,
  GetProjectSchema,
  ListAgentsSchema,
} from '../actions.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a mock fetch response. Must stub BEFORE constructing InkdActionProvider. */
function stubFetch(body: unknown, status = 200) {
  const mock = vi.fn().mockResolvedValue({
    ok:         status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
    json:       () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

/** Construct a fresh provider AFTER the global fetch stub is in place. */
function makeProvider(apiUrl?: string) {
  return new InkdActionProvider(apiUrl ? { apiUrl } : undefined)
}

function getAction(provider: InkdActionProvider, name: string) {
  return provider.getActions().find(a => a.name === name)!
}

afterEach(() => vi.unstubAllGlobals())

// ─── Constructor / getActions ─────────────────────────────────────────────────

describe('InkdActionProvider — constructor & getActions', () => {
  it('has name = "inkd"', () => {
    stubFetch({})
    expect(makeProvider().name).toBe('inkd')
  })

  it('exposes 4 actions', () => {
    stubFetch({})
    expect(makeProvider().getActions()).toHaveLength(4)
  })

  it('action names match INKD_ACTIONS constants', () => {
    stubFetch({})
    const names = makeProvider().getActions().map(a => a.name)
    expect(names).toContain(INKD_ACTIONS.CREATE_PROJECT)
    expect(names).toContain(INKD_ACTIONS.PUSH_VERSION)
    expect(names).toContain(INKD_ACTIONS.GET_PROJECT)
    expect(names).toContain(INKD_ACTIONS.LIST_AGENTS)
  })

  it('each action has name, description, schema, invoke', () => {
    stubFetch({})
    for (const action of makeProvider().getActions()) {
      expect(action.name).toBeTypeOf('string')
      expect(action.description).toBeTypeOf('string')
      expect(action.schema).toBeDefined()
      expect(action.invoke).toBeTypeOf('function')
    }
  })

  it('uses default API URL (api.inkdprotocol.com) for fetch calls', async () => {
    const mock = stubFetch({ projectId: '1', txHash: '0xabc', owner: '0x123' })
    const action = getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT)
    await action.invoke({ name: 'test' } as any)
    expect(mock.mock.calls[0][0]).toContain('api.inkdprotocol.com')
  })

  it('uses custom apiUrl from config', async () => {
    const mock = stubFetch({ projectId: '2', txHash: '0xdef', owner: '0x456' })
    const action = getAction(makeProvider('https://staging.inkdprotocol.com'), INKD_ACTIONS.CREATE_PROJECT)
    await action.invoke({ name: 'x' } as any)
    expect(mock.mock.calls[0][0]).toContain('staging.inkdprotocol.com')
  })
})

// ─── inkd_create_project ──────────────────────────────────────────────────────

describe('inkd_create_project', () => {
  it('returns success with projectId, txHash, owner', async () => {
    stubFetch({ projectId: '42', txHash: '0xTX', owner: '0xOWNER' })
    const res = await getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT)
      .invoke({ name: 'my-tool', license: 'MIT' } as any)
    expect(res).toMatchObject({ success: true, projectId: '42', txHash: '0xTX', owner: '0xOWNER' })
    expect(res.message).toContain('my-tool')
    expect(res.message).toContain('#42')
  })

  it('sends correct JSON body with all fields', async () => {
    const mock = stubFetch({ projectId: '5', txHash: '0xHASH', owner: '0xW' })
    await getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT).invoke({
      name:          'agent-x',
      description:   'an AI agent',
      license:       'Apache-2.0',
      isPublic:      false,
      isAgent:       true,
      agentEndpoint: 'https://agent.example.com',
    } as any)
    const body = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({
      name:          'agent-x',
      description:   'an AI agent',
      license:       'Apache-2.0',
      isPublic:      false,
      isAgent:       true,
      agentEndpoint: 'https://agent.example.com',
    })
  })

  it('applies defaults for optional fields', async () => {
    const mock = stubFetch({ projectId: '3', txHash: '0xH', owner: '0xW' })
    await getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'minimal' } as any)
    const body = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.description).toBe('')
    expect(body.license).toBe('MIT')
    expect(body.isPublic).toBe(true)
    expect(body.isAgent).toBe(false)
    expect(body.agentEndpoint).toBe('')
  })

  it('throws when API returns non-ok status', async () => {
    stubFetch({ error: { message: 'Name taken' } }, 409)
    await expect(
      getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'dup' } as any)
    ).rejects.toThrow('inkd createProject failed')
  })

  it('throws with fallback message when json parse fails on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('no json')),
    }))
    await expect(
      getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'err' } as any)
    ).rejects.toThrow('inkd createProject failed')
  })

  it('uses POST method with Content-Type application/json', async () => {
    const mock = stubFetch({ projectId: '1', txHash: '0x', owner: '0x' })
    await getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'test' } as any)
    const opts = mock.mock.calls[0][1] as RequestInit
    expect(opts.method).toBe('POST')
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('falls back owner to walletAddress from context when API omits owner', async () => {
    stubFetch({ projectId: '7', txHash: '0xTX' /* no owner */ })
    const context = { walletProvider: { getAddress: async () => '0xWALLET' } }
    const res = await getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT)
      .invoke({ name: 'test' } as any, context)
    expect(res.owner).toBe('0xWALLET')
  })

  it('handles walletProvider.getAddress throwing gracefully', async () => {
    stubFetch({ projectId: '8', txHash: '0xTX', owner: '0xOWN' })
    const context = { walletProvider: { getAddress: async () => { throw new Error('wallet error') } } }
    const res = await getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT)
      .invoke({ name: 'test' } as any, context)
    expect(res.success).toBe(true)
  })

  it('falls back to plain fetch when x402 unavailable (no privateKey)', async () => {
    stubFetch({ projectId: '9', txHash: '0xTX', owner: '0xOWN' })
    // walletProvider present but no privateKey → buildFetch falls back to this.fetch
    const context = { walletProvider: { someOtherProp: true } }
    const res = await getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT)
      .invoke({ name: 'fallback' } as any, context)
    expect(res.success).toBe(true)
  })

  it('posts to correct endpoint path', async () => {
    const mock = stubFetch({ projectId: '10', txHash: '0xT', owner: '0xO' })
    await getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'test' } as any)
    expect(mock.mock.calls[0][0]).toContain('/v1/projects')
  })
})

// ─── inkd_push_version ────────────────────────────────────────────────────────

describe('inkd_push_version', () => {
  it('returns success with txHash, projectId, tag', async () => {
    stubFetch({ txHash: '0xVERSION_TX' })
    const res = await getAction(makeProvider(), INKD_ACTIONS.PUSH_VERSION)
      .invoke({ projectId: '42', tag: 'v1.0.0', contentHash: 'ar://Qmabc123' } as any)
    expect(res).toMatchObject({ success: true, txHash: '0xVERSION_TX', projectId: '42', tag: 'v1.0.0' })
    expect(res.message).toContain('v1.0.0')
    expect(res.message).toContain('#42')
  })

  it('sends correct URL and body', async () => {
    const mock = stubFetch({ txHash: '0xV' })
    await getAction(makeProvider(), INKD_ACTIONS.PUSH_VERSION).invoke({
      projectId: '5', tag: 'alpha', contentHash: 'ipfs://QmFoo', metadataHash: 'ipfs://QmBar'
    } as any)
    expect(mock.mock.calls[0][0]).toContain('/v1/projects/5/versions')
    const body = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({ tag: 'alpha', contentHash: 'ipfs://QmFoo', metadataHash: 'ipfs://QmBar' })
  })

  it('defaults metadataHash to empty string when not provided', async () => {
    const mock = stubFetch({ txHash: '0xV' })
    await getAction(makeProvider(), INKD_ACTIONS.PUSH_VERSION)
      .invoke({ projectId: '1', tag: 'v0.1.0', contentHash: 'ar://Qm' } as any)
    const body = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.metadataHash).toBe('')
  })

  it('throws when API returns non-ok status', async () => {
    stubFetch({ error: 'Not found' }, 404)
    await expect(
      getAction(makeProvider(), INKD_ACTIONS.PUSH_VERSION)
        .invoke({ projectId: '99', tag: 'v1', contentHash: 'ar://x' } as any)
    ).rejects.toThrow('inkd pushVersion failed')
  })

  it('throws with fallback message when json fails on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, statusText: 'Server Error',
      json: () => Promise.reject(new Error('not json')),
    }))
    await expect(
      getAction(makeProvider(), INKD_ACTIONS.PUSH_VERSION)
        .invoke({ projectId: '1', tag: 'x', contentHash: 'ar://x' } as any)
    ).rejects.toThrow('inkd pushVersion failed')
  })

  it('uses POST method', async () => {
    const mock = stubFetch({ txHash: '0xV' })
    await getAction(makeProvider(), INKD_ACTIONS.PUSH_VERSION)
      .invoke({ projectId: '1', tag: 'v1', contentHash: 'ar://h' } as any)
    expect((mock.mock.calls[0][1] as RequestInit).method).toBe('POST')
  })
})

// ─── inkd_get_project ─────────────────────────────────────────────────────────

const sampleProject = {
  id:            '42',
  name:          'my-ai-tool',
  description:   'A tool',
  license:       'MIT',
  owner:         '0xOWNER',
  isPublic:      true,
  isAgent:       false,
  agentEndpoint: '',
  createdAt:     '2025-01-01',
  versionCount:  '3',
}

describe('inkd_get_project', () => {
  it('returns success with project data', async () => {
    stubFetch({ data: sampleProject })
    const res = await getAction(makeProvider(), INKD_ACTIONS.GET_PROJECT)
      .invoke({ projectId: '42' } as any)
    expect(res.success).toBe(true)
    expect(res.project).toMatchObject({ id: '42', name: 'my-ai-tool' })
    expect(res.message).toContain('#42')
    expect(res.message).toContain('my-ai-tool')
  })

  it('returns failure for 404', async () => {
    stubFetch({}, 404)
    const res = await getAction(makeProvider(), INKD_ACTIONS.GET_PROJECT)
      .invoke({ projectId: '999' } as any)
    expect(res.success).toBe(false)
    expect(res.message).toContain('#999')
    expect(res.message).toContain('not found')
  })

  it('throws on other non-ok statuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, statusText: 'Internal Error',
      json: () => Promise.resolve({}),
    }))
    await expect(
      getAction(makeProvider(), INKD_ACTIONS.GET_PROJECT).invoke({ projectId: '1' } as any)
    ).rejects.toThrow('inkd getProject failed')
  })

  it('calls correct URL', async () => {
    const mock = stubFetch({ data: sampleProject })
    await getAction(makeProvider(), INKD_ACTIONS.GET_PROJECT).invoke({ projectId: '7' } as any)
    expect(mock.mock.calls[0][0]).toContain('/v1/projects/7')
  })

  it('message includes owner, version count, and license', async () => {
    stubFetch({ data: sampleProject })
    const res = await getAction(makeProvider(), INKD_ACTIONS.GET_PROJECT)
      .invoke({ projectId: '42' } as any)
    expect(res.message).toContain('0xOWNER')
    expect(res.message).toContain('3 versions')
    expect(res.message).toContain('MIT')
  })
})

// ─── inkd_list_agents ─────────────────────────────────────────────────────────

const sampleAgents = [
  { id: '1', name: 'agent-alpha', owner: '0xA1', agentEndpoint: 'https://alpha.ai', isAgent: true },
  { id: '2', name: 'agent-beta',  owner: '0xA2', agentEndpoint: '',                 isAgent: true },
]

describe('inkd_list_agents', () => {
  it('returns success with agents list', async () => {
    stubFetch({ data: sampleAgents, total: '2' })
    const res = await getAction(makeProvider(), INKD_ACTIONS.LIST_AGENTS).invoke({} as any)
    expect(res.success).toBe(true)
    expect(res.agents).toHaveLength(2)
    expect(res.total).toBe('2')
    expect(res.message).toContain('2')
  })

  it('sends default limit=20 and offset=0', async () => {
    const mock = stubFetch({ data: [], total: '0' })
    await getAction(makeProvider(), INKD_ACTIONS.LIST_AGENTS).invoke({} as any)
    const url = mock.mock.calls[0][0] as string
    expect(url).toContain('limit=20')
    expect(url).toContain('offset=0')
  })

  it('sends custom limit and offset', async () => {
    const mock = stubFetch({ data: [], total: '0' })
    await getAction(makeProvider(), INKD_ACTIONS.LIST_AGENTS).invoke({ limit: 5, offset: 10 } as any)
    const url = mock.mock.calls[0][0] as string
    expect(url).toContain('limit=5')
    expect(url).toContain('offset=10')
  })

  it('calls /v1/agents endpoint', async () => {
    const mock = stubFetch({ data: [], total: '0' })
    await getAction(makeProvider(), INKD_ACTIONS.LIST_AGENTS).invoke({} as any)
    expect(mock.mock.calls[0][0]).toContain('/v1/agents')
  })

  it('throws when API returns non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, statusText: 'Service Unavailable',
      json: () => Promise.resolve({}),
    }))
    await expect(
      getAction(makeProvider(), INKD_ACTIONS.LIST_AGENTS).invoke({} as any)
    ).rejects.toThrow('inkd listAgents failed')
  })

  it('returns empty agents array for empty response', async () => {
    stubFetch({ data: [], total: '0' })
    const res = await getAction(makeProvider(), INKD_ACTIONS.LIST_AGENTS).invoke({} as any)
    expect(res.agents).toEqual([])
    expect(res.total).toBe('0')
  })

  it('uses limit=1 edge case', async () => {
    const mock = stubFetch({ data: [sampleAgents[0]], total: '100' })
    await getAction(makeProvider(), INKD_ACTIONS.LIST_AGENTS).invoke({ limit: 1 } as any)
    expect(mock.mock.calls[0][0]).toContain('limit=1')
  })
})

// ─── Zod Schema validation ────────────────────────────────────────────────────

describe('Action schemas', () => {
  describe('CreateProjectSchema', () => {
    it('rejects empty name', () => {
      expect(() => CreateProjectSchema.parse({ name: '' })).toThrow()
    })
    it('rejects name > 64 chars', () => {
      expect(() => CreateProjectSchema.parse({ name: 'a'.repeat(65) })).toThrow()
    })
    it('accepts valid minimal name', () => {
      expect(() => CreateProjectSchema.parse({ name: 'my-tool' })).not.toThrow()
    })
    it('rejects description > 256 chars', () => {
      expect(() => CreateProjectSchema.parse({ name: 'x', description: 'a'.repeat(257) })).toThrow()
    })
    it('accepts description at 256 chars', () => {
      expect(() => CreateProjectSchema.parse({ name: 'x', description: 'a'.repeat(256) })).not.toThrow()
    })
    it('rejects invalid license', () => {
      expect(() => CreateProjectSchema.parse({ name: 'x', license: 'BSD' })).toThrow()
    })
    it.each(['MIT', 'Apache-2.0', 'GPL-3.0', 'Proprietary', 'UNLICENSED'])(
      'accepts license=%s', (lic) => {
        expect(() => CreateProjectSchema.parse({ name: 'x', license: lic })).not.toThrow()
      }
    )
    it('rejects invalid agentEndpoint URL', () => {
      expect(() => CreateProjectSchema.parse({ name: 'x', agentEndpoint: 'not-a-url' })).toThrow()
    })
    it('accepts valid agentEndpoint URL', () => {
      expect(() => CreateProjectSchema.parse({ name: 'x', agentEndpoint: 'https://agent.example.com' })).not.toThrow()
    })
    it('accepts name at max length (64 chars)', () => {
      expect(() => CreateProjectSchema.parse({ name: 'a'.repeat(64) })).not.toThrow()
    })
  })

  describe('PushVersionSchema', () => {
    it('requires projectId', () => {
      expect(() => PushVersionSchema.parse({ tag: 'v1', contentHash: 'ar://x' })).toThrow()
    })
    it('requires tag', () => {
      expect(() => PushVersionSchema.parse({ projectId: '1', contentHash: 'ar://x' })).toThrow()
    })
    it('requires contentHash', () => {
      expect(() => PushVersionSchema.parse({ projectId: '1', tag: 'v1' })).toThrow()
    })
    it('accepts valid params', () => {
      expect(() => PushVersionSchema.parse({ projectId: '1', tag: 'v1.0.0', contentHash: 'ar://QmAbc' })).not.toThrow()
    })
    it('rejects empty tag', () => {
      expect(() => PushVersionSchema.parse({ projectId: '1', tag: '', contentHash: 'ar://x' })).toThrow()
    })
    it('rejects empty contentHash', () => {
      expect(() => PushVersionSchema.parse({ projectId: '1', tag: 'v1', contentHash: '' })).toThrow()
    })
    it('accepts optional metadataHash', () => {
      expect(() => PushVersionSchema.parse({
        projectId: '1', tag: 'v1', contentHash: 'ar://x', metadataHash: 'ar://meta'
      })).not.toThrow()
    })
  })

  describe('GetProjectSchema', () => {
    it('requires projectId', () => {
      expect(() => GetProjectSchema.parse({})).toThrow()
    })
    it('accepts projectId string', () => {
      expect(() => GetProjectSchema.parse({ projectId: '42' })).not.toThrow()
    })
  })

  describe('ListAgentsSchema', () => {
    it('accepts empty object', () => {
      expect(() => ListAgentsSchema.parse({})).not.toThrow()
    })
    it('rejects limit < 1', () => {
      expect(() => ListAgentsSchema.parse({ limit: 0 })).toThrow()
    })
    it('rejects limit > 100', () => {
      expect(() => ListAgentsSchema.parse({ limit: 101 })).toThrow()
    })
    it('rejects negative offset', () => {
      expect(() => ListAgentsSchema.parse({ offset: -1 })).toThrow()
    })
    it('accepts limit=1 (min)', () => {
      expect(() => ListAgentsSchema.parse({ limit: 1 })).not.toThrow()
    })
    it('accepts limit=100 (max)', () => {
      expect(() => ListAgentsSchema.parse({ limit: 100 })).not.toThrow()
    })
    it('accepts limit=50, offset=20', () => {
      expect(() => ListAgentsSchema.parse({ limit: 50, offset: 20 })).not.toThrow()
    })
  })
})

// ─── INKD_ACTIONS constants ───────────────────────────────────────────────────

describe('INKD_ACTIONS', () => {
  it('has correct string values', () => {
    expect(INKD_ACTIONS.CREATE_PROJECT).toBe('inkd_create_project')
    expect(INKD_ACTIONS.PUSH_VERSION).toBe('inkd_push_version')
    expect(INKD_ACTIONS.GET_PROJECT).toBe('inkd_get_project')
    expect(INKD_ACTIONS.LIST_AGENTS).toBe('inkd_list_agents')
  })

  it('has 4 keys', () => {
    expect(Object.keys(INKD_ACTIONS)).toHaveLength(4)
  })
})

// ─── buildFetch / no wallet context paths ────────────────────────────────────

describe('buildFetch — no wallet context', () => {
  it('uses globalThis.fetch when no context provided', async () => {
    const mock = stubFetch({ projectId: '1', txHash: '0xT', owner: '0xO' })
    await getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT).invoke({ name: 'no-context' } as any)
    expect(mock).toHaveBeenCalled()
  })

  it('uses globalThis.fetch when context has no walletProvider', async () => {
    const mock = stubFetch({ projectId: '2', txHash: '0xT', owner: '0xO' })
    await getAction(makeProvider(), INKD_ACTIONS.CREATE_PROJECT)
      .invoke({ name: 'no-wallet' } as any, { someOtherContext: true })
    expect(mock).toHaveBeenCalled()
  })

  it('still calls fetch for read-only listAgents with no context', async () => {
    const mock = stubFetch({ data: sampleAgents, total: '2' })
    await getAction(makeProvider(), INKD_ACTIONS.LIST_AGENTS).invoke({} as any)
    expect(mock).toHaveBeenCalledOnce()
  })
})
