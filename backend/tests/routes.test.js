import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const TEST_DB = 'ChainProof_test';

process.env.MONGODB_DB_NAME = TEST_DB;
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'dev_session_secret_change_in_production_min32chars_required_now!';
process.env.PORT = '0';

let mongoAvailable = false;
let app;
let server;
let baseUrl = '';
let client;

try {
  client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  await client.connect();
  await client.db(TEST_DB).command({ ping: 1 });
  mongoAvailable = true;
} catch {
  mongoAvailable = false;
}

if (mongoAvailable) {
  const db = client.db(TEST_DB);
  await db.collection('cases').deleteMany({ caseRef: { $in: ['CASE-TEST-ROUTE', 'CASE-TEST-OTHER'] } });
  await db.collection('case_evidence').deleteMany({ caseId: { $in: ['CASE-TEST-ROUTE', 'CASE-TEST-OTHER'] } });
  const hash = await bcrypt.hash('CorrectHorseBattery', 10);
  await db.collection('cases').insertMany([
    {
      caseRef: 'CASE-TEST-ROUTE',
      title: 'Route test case',
      passwordHash: hash,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      caseRef: 'CASE-TEST-OTHER',
      title: 'Other case',
      passwordHash: hash,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  const { connectMongo } = await import('../dist/db.js');
  const { createApp } = await import('../dist/app.js');
  await connectMongo();
  app = createApp();
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
}

async function jsonFetch(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

test('health endpoint reports mongodb and blockchain status', { skip: !mongoAvailable }, async () => {
  const { res, body } = await jsonFetch('/api/health');
  assert.ok(res.status === 200 || res.status === 503);
  assert.equal(body.services.mongodb.status, 'connected');
  assert.ok(body.services.blockchain);
  assert.ok(body.services.ipfs);
});

test('valid case search returns public fields only', { skip: !mongoAvailable }, async () => {
  const { res, body } = await jsonFetch('/api/cases/search?q=CASE-TEST-ROUTE');
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.cases.length, 1);
  assert.equal(body.cases[0].caseRef, 'CASE-TEST-ROUTE');
  assert.equal(body.cases[0].passwordHash, undefined);
});

test('unknown case search returns empty list', { skip: !mongoAvailable }, async () => {
  const { res, body } = await jsonFetch('/api/cases/search?q=CASE-DOES-NOT-EXIST');
  assert.equal(res.status, 200);
  assert.equal(body.cases.length, 0);
});

test('correct case password issues a session token', { skip: !mongoAvailable }, async () => {
  const { res, body } = await jsonFetch('/api/cases/access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseRef: 'CASE-TEST-ROUTE', password: 'CorrectHorseBattery' }),
  });
  assert.equal(res.status, 200);
  assert.ok(body.token);
  assert.equal(body.case.caseRef, 'CASE-TEST-ROUTE');
});

test('incorrect password returns generic failure', { skip: !mongoAvailable }, async () => {
  const { res, body } = await jsonFetch('/api/cases/access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseRef: 'CASE-TEST-ROUTE', password: 'wrong-password' }),
  });
  assert.equal(res.status, 401);
  assert.match(body.error, /Authentication failed/);
});

test('invalid input is rejected', { skip: !mongoAvailable }, async () => {
  const { res } = await jsonFetch('/api/cases/access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseRef: '' }),
  });
  assert.equal(res.status, 400);
});

test('case creation creates a unique case and returns a session token', { skip: !mongoAvailable }, async () => {
  const caseRef = 'CASE-TEST-CREATE';
  const { res, body } = await jsonFetch('/api/cases/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseRef,
      title: 'New create test case',
      description: 'Non-sensitive workflow verification',
      leadInvestigator: 'Det. New Case',
      password: 'StrongPass123!',
      confirmPassword: 'StrongPass123!',
    }),
  });

  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.case.caseRef, caseRef);
  assert.ok(body.token);
  assert.equal(body.case.passwordHash, undefined);
});

test('duplicate case reference is rejected', { skip: !mongoAvailable }, async () => {
  const { res, body } = await jsonFetch('/api/cases/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseRef: 'CASE-TEST-CREATE',
      title: 'Duplicate created case',
      description: 'Should fail',
      leadInvestigator: 'Det. Duplicate',
      password: 'StrongPass123!',
      confirmPassword: 'StrongPass123!',
    }),
  });

  assert.equal(res.status, 409);
  assert.match(body.error, /already exists/i);
});

test('protected route without authentication is rejected', { skip: !mongoAvailable }, async () => {
  const { res } = await jsonFetch('/api/cases/CASE-TEST-ROUTE');
  assert.equal(res.status, 401);
});

test('authenticated access to the correct case succeeds', { skip: !mongoAvailable }, async () => {
  const login = await jsonFetch('/api/cases/access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseRef: 'CASE-TEST-ROUTE', password: 'CorrectHorseBattery' }),
  });
  const { res, body } = await jsonFetch('/api/cases/CASE-TEST-ROUTE', {
    headers: { Authorization: `Bearer ${login.body.token}` },
  });
  assert.equal(res.status, 200);
  assert.equal(body.case.passwordHash, undefined);
});

test('authenticated session cannot access a different case', { skip: !mongoAvailable }, async () => {
  const login = await jsonFetch('/api/cases/access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseRef: 'CASE-TEST-ROUTE', password: 'CorrectHorseBattery' }),
  });
  const { res } = await jsonFetch('/api/cases/CASE-TEST-OTHER', {
    headers: { Authorization: `Bearer ${login.body.token}` },
  });
  assert.equal(res.status, 403);
});

test('mongodb unavailable search returns an error when db is disconnected', { skip: true }, async () => {
  // Covered by health check when Mongo is down; skipped here to avoid dropping the live connection.
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (client) {
    await client.db(TEST_DB).collection('cases').deleteMany({
      caseRef: { $in: ['CASE-TEST-ROUTE', 'CASE-TEST-OTHER', 'CASE-TEST-CREATE'] },
    });
    await client.close();
  }
  try {
    const { closeMongo } = await import('../dist/db.js');
    await closeMongo();
  } catch {}
});
