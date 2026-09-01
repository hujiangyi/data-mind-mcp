#!/usr/bin/env node
/**
 * DataMind MCP Server — pure Node.js, zero external dependencies.
 *
 * Reads DATAMIND_CREDENTIAL / DATAMIND_MASTER_KEY from env,
 * issues short-lived HS256 JWTs, and exposes DataMind tools
 * over the MCP stdio transport (JSON-RPC 2.0).
 */

import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import { createInterface } from 'node:readline'

// ─── Constants ───────────────────────────────────────────────────────────────

const CREDENTIAL_PREFIX = 'ENC:V1:'
const MASTER_KEY_PREFIX = 'MKEY:'
const JWT_TTL_MS = 5 * 60 * 1000
const REFRESH_BEFORE_MS = 30_000
const VALID_SCOPES = new Set(['query', 'describe', 'admin'])

// ─── Types ───────────────────────────────────────────────────────────────────

/** @typedef {{ userId: number, scopes: string[], issuedAt: string }} DecodedCredential */
/** @typedef {{ token: string, expiresAt: number, jti: string }} TokenEntry */

// ─── Crypto ──────────────────────────────────────────────────────────────────

/**
 * Decrypt an AES-256-GCM credential (mirrors Go's mcp/crypto.go DecryptCredential).
 * Format: ENC:V1:{base64(nonce(12B) || ciphertext || authTag(16B))}
 */
function decryptCredential(encodedCredential, masterKeyB64) {
  if (!encodedCredential.startsWith(CREDENTIAL_PREFIX)) {
    throw new Error('invalid credential format: missing ENC:V1: prefix')
  }
  if (!masterKeyB64.startsWith(MASTER_KEY_PREFIX)) {
    throw new Error('invalid master key format: missing MKEY: prefix')
  }

  const key = Buffer.from(masterKeyB64.slice(MASTER_KEY_PREFIX.length), 'base64')
  if (key.length !== 32) {
    throw new Error('master key must be exactly 32 bytes')
  }

  const inner = encodedCredential.slice(CREDENTIAL_PREFIX.length)
  const raw = Buffer.from(inner, 'base64')

  if (raw.length < 12 + 16) {
    throw new Error('credential ciphertext too short')
  }

  const nonce = raw.subarray(0, 12)
  const ciphertext = raw.subarray(12, raw.length - 16)
  const authTag = raw.subarray(raw.length - 16)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}

function generateMasterKey() {
  const key = crypto.randomBytes(32)
  return MASTER_KEY_PREFIX + key.toString('base64')
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

/**
 * Create a raw HS256 JWT matching Go's verifyShortLivedJWT format exactly.
 * No jsonwebtoken dependency needed — Node's crypto module handles it.
 */
function signJWT(payload, key) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signingInput = `${header}.${payloadB64}`
  const sig = crypto.createHmac('sha256', key).update(signingInput).digest('base64url')
  return `${signingInput}.${sig}`
}

// ─── Token Manager ───────────────────────────────────────────────────────────

class TokenManager extends EventEmitter {
  /** @type {DecodedCredential} */
  #credential
  /** @type {Buffer} */
  #masterKey
  /** @type {string} */
  #apiBase
  /** @type {TokenEntry | null} */
  #current = null
  #refreshTimer = null
  #abortController = null
  #refreshPromise = null

  constructor(credential, masterKey, apiBase) {
    super()
    this.#credential = credential
    this.#masterKey = masterKey
    this.#apiBase = apiBase
  }

  async getAccessToken() {
    const now = Date.now()
    if (this.#current && this.#current.expiresAt - now > REFRESH_BEFORE_MS) {
      return this.#current.token
    }
    if (this.#refreshPromise) return this.#refreshPromise
    return this.#refresh()
  }

  dispose() {
    if (this.#refreshTimer) { clearTimeout(this.#refreshTimer); this.#refreshTimer = null }
    if (this.#abortController) { this.#abortController.abort(); this.#abortController = null }
    this.#current = null
  }

  /** Stop pending token fetch so the process can exit when stdin closes. */
  stopPendingFetches() {
    if (this.#abortController) { this.#abortController.abort(); this.#abortController = null }
  }

  async #refresh() {
    if (this.#refreshPromise) return this.#refreshPromise
    this.#refreshPromise = (async () => {
      const previous = this.#current
      const jti = crypto.randomBytes(16).toString('hex')
      const nowSec = Math.floor(Date.now() / 1000)
      const exp = nowSec + JWT_TTL_MS / 1000

      const payload = { sub: this.#credential.userId, scopes: this.#credential.scopes, jti, iat: nowSec, exp }
      const token = signJWT(payload, this.#masterKey)
      const expiresAt = exp * 1000

      this.#current = { token, expiresAt, jti }

      const msUntilRefresh = expiresAt - Date.now() - REFRESH_BEFORE_MS
      if (this.#refreshTimer) clearTimeout(this.#refreshTimer)
      this.#refreshTimer = setTimeout(() => {
        this.#refresh().catch(() => {})
        this.#refreshTimer = null
      }, Math.max(msUntilRefresh, 1000))

      if (previous) {
        this.#reportJTI(jti, expiresAt, previous.token).catch(() => {})
      }

      this.emit('token-refreshed', jti)
      return token
    })()
    try {
      return await this.#refreshPromise
    } finally {
      this.#refreshPromise = null
    }
  }

  async #reportJTI(jti, expiresAtMs, previousToken) {
    try {
      this.#abortController = new AbortController()
      const controller = this.#abortController
      const timeout = setTimeout(() => controller.abort(), 5_000)
      await fetch(`${this.#apiBase}/api/v1/mcp/tokens/rotate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${previousToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jti, expiresAt: expiresAtMs }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
    } catch {
      // Rotation is a revocation hint; token expiry remains the fallback.
    } finally {
      this.#abortController = null
    }
  }
}

// ─── Tools ───────────────────────────────────────────────────────────────────

function createTools(tokenManager, apiBase) {

  return [
    {
      name: 'datamind_list_datasources',
      description: '列出当前用户有权限访问的所有数据源。返回每个数据源的名称、类型、数据库列表。',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const token = await tokenManager.getAccessToken()
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10_000)
        try {
          const res = await fetch(`${apiBase}/api/v1/datamind/datasources`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          })
          if (!res.ok) throw new Error(`list_datasources failed (${res.status}): ${await res.text()}`)
          return res.json()
        } finally { clearTimeout(timeout) }
      },
    },
    {
      name: 'datamind_describe_table',
      description: '查看表的结构信息、字段统计和样本数据。用于在不熟悉的表上编写查询前了解字段含义。',
      inputSchema: {
        type: 'object',
        required: ['datasource_id', 'table_name'],
        properties: {
          datasource_id: { type: 'string', description: '数据源 ID 或名称' },
          database_name: { type: 'string', description: '数据库名称（可选）' },
          table_name: { type: 'string', description: '表名' },
        },
      },
      execute: async ({ datasource_id, table_name, database_name }) => {
        const token = await tokenManager.getAccessToken()
        const body = { datasourceId: datasource_id, tableName: table_name }
        if (database_name) body.databaseName = database_name
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10_000)
        try {
          const res = await fetch(`${apiBase}/api/v1/datamind/table/probe`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
          if (!res.ok) throw new Error(`describe_table failed (${res.status}): ${await res.text()}`)
          return res.json()
        } finally { clearTimeout(timeout) }
      },
    },
  ]
}

function createQueryTool(tokenManager, apiBase) {
  return {
    name: 'datamind_query',
    description: '在数据范围权限控制下执行 SQL。系统自动注入行级权限过滤条件，确保查询结果不超出用户授权范围。支持 mysql 和 postgresql。',
    inputSchema: {
      type: 'object',
      required: ['datasource_id', 'sql', 'db_type'],
      properties: {
        datasource_id: { type: 'string', description: '数据源 ID 或名称' },
        sql: { type: 'string', description: 'SQL 查询语句' },
        db_type: { type: 'string', enum: ['mysql', 'postgresql'], description: '数据库类型' },
      },
    },
    execute: async ({ datasource_id, sql, db_type }) => {
      const token = await tokenManager.getAccessToken()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30_000)
      try {
        const res = await fetch(`${apiBase}/api/v1/datamind/query`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ datasourceId: datasource_id, sql, dbType: db_type }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`query failed (${res.status}): ${await res.text()}`)
        return res.json()
      } finally { clearTimeout(timeout) }
    },
  }
}

function createManageIdentityTool(tokenManager, apiBase) {
  return {
    name: 'datamind_manage_identity',
    description: '管理员工具：查看和修改用户的外部身份绑定状态。用于排查 identity_unresolved 错误，批量管理数据源身份绑定。',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'bind'], description: '操作类型' },
        user_id: { type: 'number', description: '目标用户 ID（list 时不传则查当前用户）' },
        datasource_id: { type: 'string', description: '数据源 ID' },
        external_value: { type: 'string', description: '外部身份值（bind 时必填）' },
      },
    },
    execute: async ({ action, user_id, datasource_id, external_value }) => {
      const token = await tokenManager.getAccessToken()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      try {
        const res = await fetch(`${apiBase}/api/v1/datamind/identities`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, userId: user_id, datasourceId: datasource_id, externalValue: external_value }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`manage_identity failed (${res.status}): ${await res.text()}`)
        return res.json()
      } finally { clearTimeout(timeout) }
    },
  }
}

// ─── Minimal MCP stdio transport ─────────────────────────────────────────────
// Implements JSON-RPC 2.0 over Node stdin/stdout without any SDK dependency.

function sendResponse(id, result, isError = false) {
  const msg = isError
    ? { jsonrpc: '2.0', id, error: { code: -32000, message: String(result) } }
    : { jsonrpc: '2.0', id, result }
  process.stdout.write(JSON.stringify(msg) + '\n')
}

function sendInitializeResponse(id, serverName, serverVersion) {
  const capabilities = {
    tools: { listChanged: false },
    logging: {},
    prompts: { listChanged: false },
    resources: { listChanged: false },
  }
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities,
      serverInfo: { name: serverName, version: serverVersion },
    },
  }) + '\n')
}

// ─── Stdio message reader ────────────────────────────────────────────────────

/**
 * Parse JSON-RPC messages from stdin, one per line.
 */
function createMessageReader() {
  const rl = createInterface({ input: process.stdin, terminal: false })
  const queue = []
  let resolveNext = null

  rl.on('line', (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      queue.push(JSON.parse(trimmed))
      if (resolveNext) {
        const fn = resolveNext
        resolveNext = null
        fn(queue.shift())
      }
    } catch (e) {
      console.error(`[datamind-mcp] parse error: ${e.message}`)
    }
  })

  rl.on('close', () => {
    if (resolveNext) {
      const fn = resolveNext
      resolveNext = null
      fn(null)
    }
  })

  return {
    next() {
      return new Promise((resolve) => {
        if (queue.length > 0) resolve(queue.shift())
        else resolveNext = resolve
      })
    },
    close() { rl.close() },
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const credential = process.env.DATAMIND_CREDENTIAL
  const masterKeyB64 = process.env.DATAMIND_MASTER_KEY
  const apiBase = process.env.DATAMIND_API_BASE ?? 'http://localhost:8082'

  if (!credential) {
    console.error('[datamind-mcp] DATAMIND_CREDENTIAL is required')
    process.exit(1)
  }

  if (!masterKeyB64) {
    console.error('[datamind-mcp] DATAMIND_MASTER_KEY is required')
    process.exit(1)
  }

  // Validate by attempting decryption
  let decoded
  try {
    decoded = decryptCredential(credential, masterKeyB64)
    validateDecodedCredential(decoded)
  } catch (err) {
    console.error(`[datamind-mcp] failed to decrypt credential: ${err}`)
    process.exit(1)
  }

  const masterKeyBytes = Buffer.from(masterKeyB64.slice(MASTER_KEY_PREFIX.length), 'base64')
  const tokenManager = new TokenManager(decoded, masterKeyBytes, apiBase)

  // Build tool list based on scopes
  const tools = []
  if (decoded.scopes.includes('describe')) {
    tools.push(...createTools(tokenManager, apiBase))
  }
  if (decoded.scopes.includes('query')) {
    tools.push(createQueryTool(tokenManager, apiBase))
  }
  if (decoded.scopes.includes('admin')) {
    tools.push(createManageIdentityTool(tokenManager, apiBase))
  }

  const messageReader = createMessageReader()

  // Register cleanup BEFORE the message loop so it fires even on early break
  const cleanup = () => {
    tokenManager.dispose()
    messageReader.close()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.stdin.on('end', () => {
    tokenManager.stopPendingFetches()
    process.exit(0)
  })

  // Wait for client's initialize request first
  const initMsg = await messageReader.next()
  if (!initMsg || initMsg.method !== 'initialize') {
    console.error('[datamind-mcp] expected initialize as first message')
    process.exit(1)
  }
  // Respond to initialize
  sendInitializeResponse(initMsg.id ?? null, 'datamind', '1.0.0')

  // Wait for initialized notification
  const notifMsg = await messageReader.next()
  if (!notifMsg || notifMsg.method !== 'initialized') {
    console.error('[datamind-mcp] expected initialized notification after initialize')
    process.exit(1)
  }

  // Handle subsequent requests
  let running = true
  while (running) {
    const msg = await messageReader.next()
    if (!msg) break // stdin closed

    const { id, method, params } = msg

    try {
      if (method === 'tools/list') {
        sendResponse(id, { tools })
      } else if (method === 'tools/call') {
        if (!params || typeof params !== 'object') {
          sendResponse(id, 'invalid tools/call params', true)
          continue
        }
        const { name, arguments: args } = params
        const tool = tools.find((t) => t.name === name)
        if (!tool) {
          sendResponse(id, 'unknown tool', true)
          continue
        }
        try {
          const result = await tool.execute(args ?? {})
          sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(result) }] })
        } catch (err) {
          sendResponse(id, err.message ?? String(err), true)
        }
      } else if (method === 'ping') {
        sendResponse(id, null)
      } else {
        sendResponse(id, 'method not found', true)
      }
    } catch (err) {
      sendResponse(id, String(err), true)
    }
  }

}

main().catch((err) => {
  console.error('[datamind-mcp] fatal:', err)
  process.exit(1)
})

function validateDecodedCredential(decoded) {
  if (!decoded || !Number.isSafeInteger(decoded.userId) || decoded.userId <= 0) {
    throw new Error('credential userId must be a positive integer')
  }
  if (!Array.isArray(decoded.scopes) || decoded.scopes.length === 0) {
    throw new Error('credential scopes must be a non-empty array')
  }
  const seen = new Set()
  for (const scope of decoded.scopes) {
    if (typeof scope !== 'string' || !VALID_SCOPES.has(scope)) {
      throw new Error('credential contains an unknown scope')
    }
    if (seen.has(scope)) {
      throw new Error('credential contains duplicate scopes')
    }
    seen.add(scope)
  }
  if (typeof decoded.issuedAt !== 'string' || Number.isNaN(Date.parse(decoded.issuedAt))) {
    throw new Error('credential issuedAt is invalid')
  }
}
