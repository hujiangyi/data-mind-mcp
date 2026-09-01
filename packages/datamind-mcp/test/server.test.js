/**
 * Tests for MCP server protocol handling (stdio transport).
 * Uses spawn to test the actual server process.
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NODE_BIN = process.execPath
const SERVER_SCRIPT = join(__dirname, '..', 'src', 'index.js')

// Valid credential with scopes: [query, describe, admin], userId=42
const TEST_CREDENTIAL = 'ENC:V1:G4NmM/BHL62g8UVhTULXJbzkr/I8D2j6kziiQnXmav3YHqkGcsSnOxNOjfALoibopz5S+YwocMKxVsrXuyNWliqCmvPuMpSxfBvzuG4LGDgXkXMtNW/IiZ5N7mPJj1VHVD8TMB93tBf8C6eYdN8V9nl10d8p'
const TEST_MASTER_KEY = 'MKEY:HyHvdmqCdpxcb3KN61og5h/uTYeBd2rQP7M3YWlONgE='
const TEST_API_BASE = 'http://localhost:8082'

function makeCredential(userId, scopes) {
  const key = crypto.randomBytes(32)
  const nonce = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const plaintext = Buffer.from(JSON.stringify({
    userId,
    scopes,
    issuedAt: new Date().toISOString(),
  }))
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const raw = Buffer.concat([nonce, ciphertext, cipher.getAuthTag()])
  return {
    credential: `ENC:V1:${raw.toString('base64')}`,
    masterKey: `MKEY:${key.toString('base64')}`,
  }
}

function spawnServer(overrides = {}) {
  const child = spawn(NODE_BIN, [SERVER_SCRIPT], {
    env: {
      ...process.env,
      DATAMIND_CREDENTIAL: TEST_CREDENTIAL,
      DATAMIND_MASTER_KEY: TEST_MASTER_KEY,
      DATAMIND_API_BASE: TEST_API_BASE,
      ...overrides,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
  return child
}

/**
 * Parse JSON-RPC messages from raw stdout data, skipping non-JSON lines
 * (e.g. log lines written to stdout by the server).
 */
function parseMessages(chunk) {
  const str = typeof chunk === 'string' ? chunk : (chunk?.toString() ?? '')
  const msgs = []
  for (const line of str.trim().split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      msgs.push(JSON.parse(trimmed))
    } catch {
      // skip non-JSON lines (info logs, etc.)
    }
  }
  return msgs
}

describe('MCP server protocol', () => {
  let child

  afterEach(() => {
    if (child && !child.killed) {
      child.kill()
    }
  })

  it('responds to initialize with correct protocol version and server info', (t) => {
    return new Promise((resolve, reject) => {
      child = spawnServer()
      const responses = []
      child.stdout.on('data', (d) => {
        responses.push(...parseMessages(d))
      })
      child.stderr.on('data', () => {}) // ignore stderr
      child.on('error', reject)

      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n')
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n')

      setTimeout(() => {
        const initResp = responses.find((l) => l.id === 1 && l.result?.protocolVersion)
        assert.ok(initResp, 'missing initialize response, got: ' + JSON.stringify(responses.map(r => ({ id: r.id, method: r.method }))))
        assert.strictEqual(initResp.result.protocolVersion, '2024-11-05')
        assert.deepStrictEqual(initResp.result.serverInfo, { name: 'datamind', version: '1.0.0' })
        assert.ok(initResp.result.capabilities.tools)
        child.kill()
        resolve()
      }, 3000)
    })
  })

  it('responds to tools/list with all available tools', (t) => {
    return new Promise((resolve, reject) => {
      child = spawnServer()
      const responses = []
      child.stdout.on('data', (d) => {
        responses.push(...parseMessages(d))
      })
      child.stderr.on('data', () => {})
      child.on('error', reject)

      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n')
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n')
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n')

      setTimeout(() => {
        const toolList = responses.find((l) => l.id === 2 && l.result?.tools)
        assert.ok(toolList, 'missing tools/list response, got: ' + JSON.stringify(responses.map(r => ({ id: r.id, method: r.method }))))
        const names = toolList.result.tools.map((t) => t.name)
        assert.ok(names.includes('datamind_list_datasources'))
        assert.ok(names.includes('datamind_describe_table'))
        assert.ok(names.includes('datamind_query'))
        child.kill()
        resolve()
      }, 3000)
    })
  })

  it('registers tools according to describe, query, and admin scopes', () => {
    const cases = [
      {
        name: '普通用户 describe',
        scopes: ['describe'],
        want: ['datamind_list_datasources', 'datamind_describe_table'],
        absent: ['datamind_query', 'datamind_manage_identity'],
      },
      {
        name: '分析师 query describe',
        scopes: ['query', 'describe'],
        want: ['datamind_list_datasources', 'datamind_describe_table', 'datamind_query'],
        absent: ['datamind_manage_identity'],
      },
      {
        name: '管理员 admin query describe',
        scopes: ['admin', 'query', 'describe'],
        want: ['datamind_list_datasources', 'datamind_describe_table', 'datamind_query', 'datamind_manage_identity'],
        absent: [],
      },
    ]

    return Promise.all(cases.map(({ scopes, want, absent }) => new Promise((resolve, reject) => {
      const credentials = makeCredential(42, scopes)
      const scopedChild = spawnServer({
        DATAMIND_CREDENTIAL: credentials.credential,
        DATAMIND_MASTER_KEY: credentials.masterKey,
      })
      const responses = []
      scopedChild.stdout.on('data', (d) => responses.push(...parseMessages(d)))
      scopedChild.stderr.on('data', () => {})
      scopedChild.on('error', reject)
      scopedChild.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n')
      scopedChild.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n')
      scopedChild.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n')
      setTimeout(() => {
        try {
          const response = responses.find((message) => message.id === 2)
          assert.ok(response?.result?.tools, `missing tools/list response: ${JSON.stringify(responses)}`)
          const names = response.result.tools.map((tool) => tool.name)
          for (const name of want) assert.ok(names.includes(name), `${name} should be registered`)
          for (const name of absent) assert.ok(!names.includes(name), `${name} should not be registered`)
          scopedChild.kill()
          resolve()
        } catch (error) {
          scopedChild.kill()
          reject(error)
        }
      }, 1000)
    })))
  })

  it('responds to unknown tool call with error', (t) => {
    return new Promise((resolve, reject) => {
      child = spawnServer()
      const responses = []
      child.stdout.on('data', (d) => {
        responses.push(...parseMessages(d))
      })
      child.stderr.on('data', () => {})
      child.on('error', reject)

      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n')
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n')
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'nonexistent_tool', arguments: {} } }) + '\n')

      setTimeout(() => {
        const resp = responses.find((l) => l.id === 2 && l.error)
        assert.ok(resp, 'expected error response for unknown tool, got: ' + JSON.stringify(responses.map(r => ({ id: r.id, method: r.method }))))
        assert.strictEqual(resp.error.code, -32000)
        child.kill()
        resolve()
      }, 5000)
    })
  })

  it('responds to ping with null result', (t) => {
    return new Promise((resolve, reject) => {
      child = spawnServer()
      const responses = []
      child.stdout.on('data', (d) => {
        responses.push(...parseMessages(d))
      })
      child.stderr.on('data', () => {})
      child.on('error', reject)

      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n')
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n')
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping', params: {} }) + '\n')

      setTimeout(() => {
        const resp = responses.find((l) => l.id === 2)
        assert.ok(resp, 'expected ping response, got: ' + JSON.stringify(responses.map(r => ({ id: r.id, method: r.method }))))
        assert.strictEqual(resp.result, null)
        child.kill()
        resolve()
      }, 5000)
    })
  })

  it('exits cleanly when stdin closes', (t) => {
    return new Promise((resolve, reject) => {
      child = spawnServer()
      let stderr = ''
      child.stderr.on('data', (d) => { stderr += d })
      child.on('error', reject)

      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n')
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n')
      child.stdin.end()

      let resolved = false
      child.on('exit', (code) => {
        if (resolved) return
        resolved = true
        // Exit 0 is ideal; exit 1 acceptable if cleanup fires before stdin fully drains
        assert.ok(code === 0 || code === null, `unexpected exit code ${code}. stderr: ${stderr}`)
        resolve()
      })
      child.on('close', () => {
        if (resolved) return
        resolved = true
        resolve()
      })
      setTimeout(() => {
        if (!resolved) {
          child.kill()
          reject(new Error('timed out waiting for exit'))
        }
      }, 5000)
    })
  })
})

describe('MCP server missing env', () => {
  it('exits with code 1 when DATAMIND_CREDENTIAL is missing', (t) => {
    return new Promise((resolve, reject) => {
      const child = spawn(NODE_BIN, [SERVER_SCRIPT], {
        env: {
          DATAMIND_CREDENTIAL: '',
          DATAMIND_MASTER_KEY: TEST_MASTER_KEY,
          DATAMIND_API_BASE: TEST_API_BASE,
          ...process.env,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf8',
      })
      let stderr = ''
      child.stderr.on('data', (d) => (stderr += d))
      child.on('exit', (code) => {
        assert.notStrictEqual(code, 0)
        assert.match(stderr, /DATAMIND_CREDENTIAL is required/)
        resolve()
      })
      child.on('error', reject)
      setTimeout(() => {
        child.kill()
        reject(new Error('timed out'))
      }, 3000)
    })
  })

  it('exits with code 1 when DATAMIND_MASTER_KEY is missing', (t) => {
    return new Promise((resolve, reject) => {
      const child = spawn(NODE_BIN, [SERVER_SCRIPT], {
        env: {
          DATAMIND_CREDENTIAL: TEST_CREDENTIAL,
          DATAMIND_MASTER_KEY: '',
          DATAMIND_API_BASE: TEST_API_BASE,
          ...process.env,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf8',
      })
      let stderr = ''
      child.stderr.on('data', (d) => (stderr += d))
      child.on('exit', (code) => {
        assert.notStrictEqual(code, 0)
        assert.match(stderr, /DATAMIND_MASTER_KEY is required/)
        resolve()
      })
      child.on('error', reject)
      setTimeout(() => {
        child.kill()
        reject(new Error('timed out'))
      }, 3000)
    })
  })
})
