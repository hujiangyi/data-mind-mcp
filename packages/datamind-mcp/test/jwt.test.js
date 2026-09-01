/**
 * Tests for JWT signing (matches Go's verifyShortLivedJWT).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

function signJWT(payload, key) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signingInput = `${header}.${payloadB64}`
  const sig = crypto.createHmac('sha256', key).update(signingInput).digest('base64url')
  return `${signingInput}.${sig}`
}

function verifyJWT(token, key) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('invalid JWT format')
  const [headerB64, payloadB64, sigB64] = parts
  const expectedSig = crypto
    .createHmac('sha256', key)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url')
  if (expectedSig !== sigB64) throw new Error('JWT signature mismatch')
  return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
}

import crypto from 'node:crypto'

describe('JWT signing', () => {
  it('produces a valid HS256 JWT with correct structure', () => {
    const key = randomBytes(32)
    const payload = { sub: 42, scopes: ['query'], jti: 'abc', iat: 1000, exp: 10300 }
    const token = signJWT(payload, key)
    const parts = token.split('.')
    assert.strictEqual(parts.length, 3)

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    assert.deepStrictEqual(header, { alg: 'HS256', typ: 'JWT' })
  })

  it('can verify a signed JWT', () => {
    const key = randomBytes(32)
    const payload = { sub: 42, scopes: ['query', 'describe'], jti: 'test-jti', iat: 1000, exp: 5000 }
    const token = signJWT(payload, key)
    const decoded = verifyJWT(token, key)
    assert.strictEqual(decoded.sub, 42)
    assert.deepStrictEqual(decoded.scopes, ['query', 'describe'])
    assert.strictEqual(decoded.jti, 'test-jti')
  })

  it('rejects a JWT signed with a different key', () => {
    const key = randomBytes(32)
    const wrongKey = randomBytes(32)
    const payload = { sub: 1, scopes: ['query'], jti: 'x', iat: 1, exp: 9999 }
    const token = signJWT(payload, key)
    assert.throws(() => verifyJWT(token, wrongKey), /signature mismatch/)
  })

  it('uses base64url encoding (no + / = padding)', () => {
    const key = randomBytes(32)
    const token = signJWT({ sub: 1, scopes: [], jti: 'a', iat: 1, exp: 9999 }, key)
    assert.ok(!token.includes('+'))
    assert.ok(!token.includes('/'))
    assert.ok(!token.includes('='))
  })

  it('produces deterministic output for same input', () => {
    const key = randomBytes(32)
    const payload = { sub: 1, scopes: ['query'], jti: 'same', iat: 100, exp: 400 }
    const token1 = signJWT(payload, key)
    const token2 = signJWT(payload, key)
    assert.strictEqual(token1, token2)
  })
})
