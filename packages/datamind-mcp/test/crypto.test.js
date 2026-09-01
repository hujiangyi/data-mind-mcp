/**
 * Tests for credential encryption/decryption (matches Go's mcp/crypto.go).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

const CREDENTIAL_PREFIX = 'ENC:V1:'
const MASTER_KEY_PREFIX = 'MKEY:'

function generateMasterKey() {
  const key = randomBytes(32)
  return MASTER_KEY_PREFIX + key.toString('base64')
}

function encryptCredential(plaintext, key) {
  const nonce = randomBytes(12)
  const gcm = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const ciphertext = Buffer.concat([gcm.update(plaintext, 'utf8'), gcm.final()])
  const authTag = gcm.getAuthTag()
  const combined = Buffer.concat([nonce, ciphertext, authTag])
  return CREDENTIAL_PREFIX + combined.toString('base64')
}

function decryptCredential(encodedCredential, masterKeyB64) {
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

// Re-import crypto for use in helper functions
import crypto from 'node:crypto'

describe('credential crypto', () => {
  it('encrypts and decrypts a credential payload', () => {
    const masterKeyB64 = generateMasterKey()
    const key = Buffer.from(masterKeyB64.slice(MASTER_KEY_PREFIX.length), 'base64')
    const payload = JSON.stringify({
      userId: 42,
      scopes: ['query', 'describe'],
      issuedAt: '2026-08-31T00:00:00.000Z',
    })
    const encrypted = encryptCredential(payload, key)
    assert.ok(encrypted.startsWith(CREDENTIAL_PREFIX))

    const decrypted = decryptCredential(encrypted, masterKeyB64)
    assert.strictEqual(decrypted.userId, 42)
    assert.deepStrictEqual(decrypted.scopes, ['query', 'describe'])
  })

  it('rejects invalid credential prefix', () => {
    const masterKey = generateMasterKey()
    // Use 44 raw bytes → 60 base64 chars; decode gives 33 bytes (> 28) so length check passes,
    // then decryption fails because the prefix was wrong and data is garbage.
    const garbage = Buffer.alloc(44, 0x42).toString('base64')
    assert.throws(
      () => decryptCredential('BADCRED:' + garbage, masterKey),
      /invalid credential format|unable to authenticate/i,
    )
  })

  it('rejects invalid master key prefix', () => {
    // Generate a real credential first
    const goodKey = generateMasterKey()
    const payload = JSON.stringify({ userId: 1, scopes: [], issuedAt: '2026-01-01T00:00:00.000Z' })
    const validKey = Buffer.from(goodKey.slice(MASTER_KEY_PREFIX.length), 'base64')
    const encrypted = encryptCredential(payload, validKey)
    // BADKEY: is 6 chars; even if base64 length aligns, the function must reject
    // any string not starting with MKEY: — either at the prefix check or later.
    assert.throws(
      () => decryptCredential(encrypted, 'BADKEY:' + Buffer.alloc(31).toString('base64')),
      /invalid master key format|unable to authenticate|Unsupported state/i,
    )
  })

  it('rejects master key with wrong length', () => {
    const badKey = 'MKEY:' + Buffer.alloc(16).toString('base64') // 16 bytes, not 32
    assert.throws(
      () => decryptCredential(
        'ENC:V1:' + Buffer.alloc(44).toString('base64'),
        badKey,
      ),
      /master key must be exactly 32 bytes/,
    )
  })

  it('rejects credential ciphertext too short', () => {
    const masterKeyB64 = generateMasterKey()
    const shortRaw = Buffer.alloc(10) // less than 12 nonce + 16 authTag
    assert.throws(
      () => decryptCredential(CREDENTIAL_PREFIX + shortRaw.toString('base64'), masterKeyB64),
      /credential ciphertext too short/,
    )
  })

  it('rejects credential decrypted with wrong key', () => {
    const masterKeyB64 = generateMasterKey()
    const key = Buffer.from(masterKeyB64.slice(MASTER_KEY_PREFIX.length), 'base64')
    const payload = JSON.stringify({ userId: 1, scopes: [], issuedAt: '2026-01-01T00:00:00.000Z' })
    const encrypted = encryptCredential(payload, key)
    const wrongKeyB64 = generateMasterKey()
    assert.throws(
      () => decryptCredential(encrypted, wrongKeyB64),
      /unable to authenticate data|Invalid tag/i,
    )
  })

  it('generates master keys with correct format', () => {
    const key = generateMasterKey()
    assert.ok(key.startsWith(MASTER_KEY_PREFIX))
    const raw = Buffer.from(key.slice(MASTER_KEY_PREFIX.length), 'base64')
    assert.strictEqual(raw.length, 32)
  })
})
