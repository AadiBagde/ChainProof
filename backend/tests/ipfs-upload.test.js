import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017';
process.env.MONGODB_DB_NAME = 'ChainProof_ipfs_upload_test';
process.env.SESSION_SECRET = 'test_session_secret_for_ipfs_uploads_only';
process.env.RPC_URL = 'http://127.0.0.1:8545';
process.env.EVIDENCE_REGISTRY_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
process.env.CUSTODY_MANAGER_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
process.env.PINATA_JWT = 'test-only-provider-token';
process.env.IPFS_API_URL = '';

const [{ createApp }, { generateSessionToken }, { config }, { isPlausibleIpfsCid }] = await Promise.all([
  import('../dist/app.js'),
  import('../dist/auth.js'),
  import('../dist/config.js'),
  import('../dist/ipfs.js'),
]);

const originalFetch = globalThis.fetch;
function makeCidV1() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  const bytes = [1, 0x55, 0x12, 0x20, ...Array.from({ length: 32 }, (_, index) => index)];
  let accumulator = 0;
  let bits = 0;
  let encoded = 'b';
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      encoded += alphabet[(accumulator >> bits) & 31];
      accumulator &= (1 << bits) - 1;
    }
  }
  if (bits > 0) encoded += alphabet[(accumulator << (5 - bits)) & 31];
  return encoded;
}

const cid = makeCidV1();
const fileBytes = Buffer.from('synthetic test evidence bytes');
const digest = createHash('sha256').update(fileBytes).digest('hex');
let providerResponse;
let server;
let baseUrl;
let requestCount = 0;
const token = generateSessionToken({
  caseRef: 'CASE-IPFS-TEST',
  caseTitle: 'Synthetic IPFS upload test',
  authenticatedAt: Date.now(),
});

before(async () => {
  const app = createApp();
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith('https://api.pinata.cloud/')) {
      requestCount += 1;
      return providerResponse(input, init);
    }
    return originalFetch(input, init);
  };
});

async function postUpload(bytes = fileBytes, sha256 = digest) {
  const form = new FormData();
  form.append('file', new Blob([bytes]), 'synthetic-evidence.bin');
  form.append('sha256', sha256);
  return originalFetch(`${baseUrl}/api/ipfs/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

test('authenticated upload pins the actual file and returns the provider CID', async () => {
  assert.equal(isPlausibleIpfsCid(cid), true);
  providerResponse = async (_url, init) => {
    assert.equal(init.method, 'POST');
    const uploadedFile = init.body.get('file');
    assert.equal(await uploadedFile.text(), fileBytes.toString());
    return new Response(JSON.stringify({ IpfsHash: cid }), { status: 200 });
  };

  const response = await postUpload();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.cid, cid);
  assert.equal(body.size, fileBytes.length);
});

test('Kubo newline-delimited response returns its structurally valid CID', () => {
  const moduleUrl = new URL('../dist/ipfs.js', import.meta.url).href;
  const source = `
    globalThis.fetch = async () => new Response(
      JSON.stringify({ Hash: ${JSON.stringify(cid)} }) + String.fromCharCode(10),
      { status: 200 }
    );
    const { uploadToIpfs } = await import(${JSON.stringify(moduleUrl)});
    process.stdout.write(await uploadToIpfs(Buffer.from('test'), 'evidence.bin', 'application/octet-stream'));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    encoding: 'utf8',
    env: { ...process.env, PINATA_JWT: '', IPFS_API_URL: 'http://127.0.0.1:5001' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, cid);
});

test('mismatched file digest is rejected before contacting IPFS', async () => {
  const beforeCount = requestCount;
  const response = await postUpload(fileBytes, '0'.repeat(64));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.error, /do not match/);
  assert.equal(requestCount, beforeCount);
});

test('invalid provider CID fails instead of reporting upload success', async () => {
  assert.equal(isPlausibleIpfsCid(`b${'a'.repeat(58)}`), false);
  providerResponse = async () =>
    new Response(JSON.stringify({ IpfsHash: 'not-a-cid' }), { status: 200 });
  const response = await postUpload();
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(body.success, false);
  assert.match(body.error, /invalid content identifier/i);
});

test('provider rejection is reported without exposing provider response content', async () => {
  providerResponse = async () => new Response('private provider diagnostics', { status: 503 });
  const response = await postUpload();
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(body.success, false);
  assert.doesNotMatch(body.error, /private provider diagnostics/);
});

test('missing provider configuration fails without returning a fabricated CID', () => {
  const moduleUrl = new URL('../dist/ipfs.js', import.meta.url).href;
  const source = `
    const { uploadToIpfs, IpfsNotConfiguredError } = await import(${JSON.stringify(moduleUrl)});
    try {
      await uploadToIpfs(Buffer.from('test'), 'evidence.bin', 'application/octet-stream');
      process.exitCode = 1;
    } catch (error) {
      if (!(error instanceof IpfsNotConfiguredError)) process.exitCode = 1;
      else process.stdout.write('not-configured');
    }
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    encoding: 'utf8',
    env: { ...process.env, PINATA_JWT: '', IPFS_API_URL: '' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'not-configured');
});

test('upload without a valid case session is rejected', async () => {
  const form = new FormData();
  form.append('file', new Blob([fileBytes]), 'synthetic-evidence.bin');
  form.append('sha256', digest);
  const response = await originalFetch(`${baseUrl}/api/ipfs/upload`, {
    method: 'POST',
    body: form,
  });
  assert.equal(response.status, 401);
});

test('oversized upload is rejected by the backend limit', async () => {
  const oversized = Buffer.alloc(config.maxUploadBytes + 1, 1);
  const response = await postUpload(oversized, createHash('sha256').update(oversized).digest('hex'));
  const body = await response.json();
  assert.equal(response.status, 413);
  assert.match(body.error, /upload limit/);
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (server) await new Promise((resolve) => server.close(resolve));
});
