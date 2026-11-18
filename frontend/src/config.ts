const chainIdRaw = import.meta.env.VITE_CHAIN_ID || '31337';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
export const ANVIL_CHAIN_ID = Number(chainIdRaw);
export const ANVIL_RPC_URL = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545';
export const EVIDENCE_REGISTRY_ADDRESS = (
  import.meta.env.VITE_EVIDENCE_REGISTRY_ADDRESS ||
  import.meta.env.VITE_EVIDENCE_REGISTRY ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3'
) as `0x${string}`;
export const CUSTODY_MANAGER_ADDRESS = (
  import.meta.env.VITE_CUSTODY_MANAGER_ADDRESS ||
  import.meta.env.VITE_CUSTODY_MANAGER ||
  '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
) as `0x${string}`;
