import { MongoClient, Db } from 'mongodb';
import { config } from './config.js';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db && client) {
    return db;
  }

  client = new MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 4000,
  });

  await client.connect();
  db = client.db(config.dbName);

  try {
    const casesCol = db.collection('cases');
    await casesCol.createIndex({ caseRef: 1 }, { unique: true });

    const associationsCol = db.collection('case_evidence');
    await associationsCol.createIndex({ caseId: 1, evidenceId: 1 }, { unique: true });
    await associationsCol.createIndex({ evidenceId: 1 });

    const auditCol = db.collection('access_audit');
    await auditCol.createIndex({ caseRef: 1, timestamp: -1 });
  } catch (err) {
    console.warn('Notice: index verification:', (err as Error).message);
  }

  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectMongo() first.');
  }
  return db;
}

export async function checkMongoHealth(): Promise<{ status: 'connected' | 'disconnected'; error?: string }> {
  try {
    if (!client) {
      await connectMongo();
    }

    const admin = client!.db(config.dbName).admin();
    await admin.ping();
    return { status: 'connected' };
  } catch (err) {
    return {
      status: 'disconnected',
      error: (err as Error).message,
    };
  }
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
