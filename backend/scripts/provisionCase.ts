import bcrypt from 'bcrypt';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'ChainProof';

async function provisionCase() {
  const args = process.argv.slice(2);
  if (args.length < 2 || !args[0].trim()) {
    console.error('Usage: npm run provision:case -- <CASE_ID> <PASSWORD> [TITLE] [INVESTIGATOR]');
    process.exit(1);
  }

  const caseRef = args[0].trim().toUpperCase();
  const password = args[1];
  const title = args[2] || 'Port Facility Security Perimeter Incident';
  const leadInvestigator = args[3] || 'Det. Sarah Lin';

  console.log('--- ChainProof Case Provisioning CLI ---');
  console.log(`Target Database: ${dbName}`);
  console.log(`Case Reference:  ${caseRef}`);
  console.log(`Case Title:      ${title}`);
  console.log(`Lead Officer:    ${leadInvestigator}`);

  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters.');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const casesCol = db.collection('cases');

    // Hash password securely with bcrypt (12 salt rounds)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const now = new Date();
    const result = await casesCol.updateOne(
      { caseRef },
      {
        $set: {
          caseRef,
          title,
          description: 'Official digital forensics evidence portfolio for investigative incident tracking.',
          leadInvestigator,
          passwordHash,
          status: 'active',
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    console.log('--- Provisioning Result ---');
    if (result.upsertedCount > 0) {
      console.log(`Case ${caseRef} created successfully.`);
    } else {
      console.log(`Case ${caseRef} updated with new password hash.`);
    }
    console.log(`  Case Identifier: ${caseRef}`);
    console.log('---------------------------');
  } catch (err) {
    console.error('Provisioning failed:', (err as Error).message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

provisionCase();
