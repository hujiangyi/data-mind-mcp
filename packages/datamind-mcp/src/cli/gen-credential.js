#!/usr/bin/env node
/**
 * gen-credential CLI: one-off credential generator for administrators.
 *
 * Usage:
 *   node packages/datamind-mcp/src/cli/gen-credential.js --user-id 42 --scopes query,describe --api-base http://localhost:8082
 *
 * Outputs DATAMIND_CREDENTIAL and DATAMIND_MASTER_KEY suitable for config.json env block.
 */

import crypto from 'node:crypto'

const CREDENTIAL_PREFIX = 'ENC:V1:'
const MASTER_KEY_PREFIX = 'MKEY:'

function encryptCredential(plaintext, key) {
  const nonce = crypto.randomBytes(12)
  const gcm = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const ciphertext = Buffer.concat([gcm.update(plaintext, 'utf8'), gcm.final()])
  const authTag = gcm.getAuthTag()
  const combined = Buffer.concat([nonce, ciphertext, authTag])
  return CREDENTIAL_PREFIX + combined.toString('base64')
}

function generateMasterKey() {
  const key = crypto.randomBytes(32)
  return MASTER_KEY_PREFIX + key.toString('base64')
}

function parseArgs(argv) {
  const opts = { userId: null, scopes: 'query,describe', apiBase: 'http://localhost:8082', ttl: '600' }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      // Normalize kebab-case to camelCase: --user-id → userId, --api-base → apiBase
      const rawKey = arg.slice(2)
      const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      const val = argv[i + 1]
      if (val !== undefined && !val.startsWith('--')) {
        opts[key] = val
        i++
      } else {
        opts[key] = true
      }
    }
  }
  return opts
}

const opts = parseArgs(process.argv)
const userId = parseInt(opts.userId, 10)
if (isNaN(userId) || userId <= 0) {
  console.error('Invalid --user-id: must be a positive integer')
  process.exit(1)
}

const requestedTTL = Number(opts.ttl)
if (!Number.isInteger(requestedTTL) || requestedTTL <= 0) {
  console.error('Invalid --ttl: must be a positive integer')
  process.exit(1)
}
const ttl = Math.min(requestedTTL, 3600)

let apiBase
try {
  apiBase = new URL(opts.apiBase)
  if (!['http:', 'https:'].includes(apiBase.protocol) || apiBase.username || apiBase.password) {
    throw new Error('unsupported API base')
  }
} catch {
  console.error('Invalid --api-base: must be an HTTP or HTTPS URL')
  process.exit(1)
}

const allowedScopes = new Set(['query', 'describe', 'admin'])
const scopes = String(opts.scopes).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
if (scopes.length === 0) {
  console.error('Invalid --scopes: at least one scope is required')
  process.exit(1)
}
const seenScopes = new Set()
for (const scope of scopes) {
  if (!allowedScopes.has(scope)) {
    console.error(`Invalid --scopes: unknown scope ${scope}`)
    process.exit(1)
  }
  if (seenScopes.has(scope)) {
    console.error(`Invalid --scopes: duplicate scope ${scope}`)
    process.exit(1)
  }
  seenScopes.add(scope)
}

const masterKeyB64 = generateMasterKey()
const key = Buffer.from(masterKeyB64.slice(MASTER_KEY_PREFIX.length), 'base64')

const payload = JSON.stringify({
  userId,
  scopes,
  issuedAt: new Date().toISOString(),
})
const credential = encryptCredential(payload, key)

console.log(`DATAMIND_CREDENTIAL=${credential}`)
console.log(`DATAMIND_MASTER_KEY=${masterKeyB64}`)
console.log(`DATAMIND_API_BASE=${apiBase.toString().replace(/\/$/, '')}`)
console.log(`\nTTL: ${ttl}s | Scopes: [${scopes.join(', ')}] | User: ${userId}`)
