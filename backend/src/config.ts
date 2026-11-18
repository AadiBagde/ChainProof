import dotenv from 'dotenv';
dotenv.config();

function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const sessionSecret = optionalEnv(
  'SESSION_SECRET',
  'dev_session_secret_change_in_production_min32chars_required_now!'
);

if (sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters.');
}

const port = Number.parseInt(optionalEnv('PORT', '5000'), 10);
const chainId = Number.parseInt(optionalEnv('CHAIN_ID', '31337'), 10);
const maxUploadBytes = Number.parseInt(optionalEnv('MAX_UPLOAD_BYTES', String(8 * 1024 * 1024)), 10);

if (!Number.isFinite(port) || port < 0) {
  throw new Error('PORT must be a non-negative integer.');
}
if (!Number.isFinite(chainId) || chainId <= 0) {
  throw new Error('CHAIN_ID must be a valid positive integer.');
}
if (!Number.isFinite(maxUploadBytes) || maxUploadBytes <= 0) {
  throw new Error('MAX_UPLOAD_BYTES must be a valid positive integer.');
}

requireEnv('MONGODB_URI');
requireEnv('MONGODB_DB_NAME');
requireEnv('RPC_URL');
requireEnv('EVIDENCE_REGISTRY_ADDRESS');
requireEnv('CUSTODY_MANAGER_ADDRESS');

export const config = {
  port,
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  frontendOrigin: optionalEnv('FRONTEND_ORIGIN', 'http://localhost:5173'),
  mongoUri: optionalEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017'),
  dbName: optionalEnv('MONGODB_DB_NAME', 'ChainProof'),
  sessionSecret,
  rpcUrl: optionalEnv('RPC_URL', 'http://127.0.0.1:8545'),
  chainId,
  evidenceRegistryAddress: optionalEnv(
    'EVIDENCE_REGISTRY_ADDRESS',
    '0x5FbDB2315678afecb367f032d93F642f64180aa3'
  ),
  custodyManagerAddress: optionalEnv(
    'CUSTODY_MANAGER_ADDRESS',
    '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
  ),
  ipfsGateway: optionalEnv('IPFS_GATEWAY', 'https://ipfs.io/ipfs/'),
  ipfsApiUrl: optionalEnv('IPFS_API_URL'),
  pinataJwt: optionalEnv('PINATA_JWT'),
  maxUploadBytes,
};

export function describeIpfsMode(): 'pinata' | 'kubo' | 'unconfigured' {
  if (config.pinataJwt) return 'pinata';
  if (config.ipfsApiUrl) return 'kubo';
  return 'unconfigured';
}
