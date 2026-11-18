import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { generateSessionToken, verifySessionToken } from '../dist/auth.js';

test('Password hashing and comparison with bcrypt', async () => {
  const password = 'TestSecretPassword@2026';
  const hash = await bcrypt.hash(password, 10);
  
  assert.ok(hash.startsWith('$2b$'), 'Hash should be a valid bcrypt hash');
  const isMatch = await bcrypt.compare(password, hash);
  assert.equal(isMatch, true, 'Correct password should match');

  const isBadMatch = await bcrypt.compare('WrongPassword', hash);
  assert.equal(isBadMatch, false, 'Wrong password should fail');
});

test('Case session token generation and verification', () => {
  const payload = {
    caseRef: 'CASE-CR-2026-88',
    caseTitle: 'Port Incident',
    authenticatedAt: Date.now(),
  };

  const token = generateSessionToken(payload);
  assert.ok(typeof token === 'string', 'Token should be a string');

  const verified = verifySessionToken(token);
  assert.ok(verified, 'Verified session should not be null');
  assert.equal(verified?.caseRef, 'CASE-CR-2026-88');
  assert.equal(verified?.caseTitle, 'Port Incident');

  const invalid = verifySessionToken('invalid.garbage.token');
  assert.equal(invalid, null, 'Invalid token should return null');
});
