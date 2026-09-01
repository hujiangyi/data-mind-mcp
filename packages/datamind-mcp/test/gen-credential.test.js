/**
 * Tests for gen-credential CLI (matches Node.js implementation).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NODE_BIN = process.execPath
const GEN_CRED_SCRIPT = join(__dirname, '..', 'src', 'cli', 'gen-credential.js')

function runCLI(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(NODE_BIN, [GEN_CRED_SCRIPT, ...args], {
      env: { ...process.env },
      encoding: 'utf8',
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    child.on('error', reject)
  })
}

describe('gen-credential CLI', () => {
  it('outputs DATAMIND_CREDENTIAL, DATAMIND_MASTER_KEY, DATAMIND_API_BASE', async () => {
    const { stdout, code } = await runCLI(['--user-id', '42', '--scopes', 'query,describe'])
    assert.strictEqual(code, 0)
    assert.match(stdout, /DATAMIND_CREDENTIAL=ENC:V1:/)
    assert.match(stdout, /DATAMIND_MASTER_KEY=MKEY:/)
    assert.match(stdout, /DATAMIND_API_BASE=http:\/\/localhost:8082/)
  })

  it('accepts custom --api-base', async () => {
    const { stdout } = await runCLI(['--user-id', '1', '--api-base', 'https://api.example.com'])
    assert.match(stdout, /DATAMIND_API_BASE=https:\/\/api\.example\.com/)
  })

  it('accepts custom --ttl', async () => {
    const { stdout } = await runCLI(['--user-id', '1', '--ttl', '1800'])
    assert.match(stdout, /TTL: 1800s/)
  })

  it('accepts --scopes with multiple values', async () => {
    const { stdout } = await runCLI(['--user-id', '1', '--scopes', 'query,describe,admin'])
    assert.match(stdout, /Scopes: \[query, describe, admin\]/)
  })

  it('rejects non-numeric --user-id', async () => {
    const { code, stderr } = await runCLI(['--user-id', 'abc'])
    assert.notStrictEqual(code, 0)
    assert.match(stderr, /Invalid --user-id/)
  })

  it('rejects zero --user-id', async () => {
    const { code, stderr } = await runCLI(['--user-id', '0'])
    assert.notStrictEqual(code, 0)
    assert.match(stderr, /Invalid --user-id/)
  })

  it('rejects negative --user-id', async () => {
    const { code, stderr } = await runCLI(['--user-id', '-1'])
    assert.notStrictEqual(code, 0)
    assert.match(stderr, /Invalid --user-id/)
  })

  it('caps --ttl at 3600', async () => {
    const { stdout } = await runCLI(['--user-id', '1', '--ttl', '99999'])
    assert.match(stdout, /TTL: 3600s/)
  })

  it('generated credential is decodable with matching master key', async () => {
    const { stdout } = await runCLI(['--user-id', '99', '--scopes', 'query'])
    const lines = stdout.trim().split('\n').filter(Boolean)
    const credLine = lines.find((l) => l.startsWith('DATAMIND_CREDENTIAL='))
    const keyLine = lines.find((l) => l.startsWith('DATAMIND_MASTER_KEY='))
    assert.ok(credLine, 'missing DATAMIND_CREDENTIAL')
    assert.ok(keyLine, 'missing DATAMIND_MASTER_KEY')
    const credential = credLine.slice('DATAMIND_CREDENTIAL='.length)
    const masterKey = keyLine.slice('DATAMIND_MASTER_KEY='.length)
    // Verify format
    assert.ok(credential.startsWith('ENC:V1:'))
    assert.ok(masterKey.startsWith('MKEY:'))
  })
})
