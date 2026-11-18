import { BrowserProvider, Contract, JsonRpcProvider, getAddress, isAddress, ZeroAddress } from 'ethers';
import {
  ANVIL_CHAIN_ID,
  ANVIL_RPC_URL,
  CUSTODY_MANAGER_ADDRESS,
  EVIDENCE_REGISTRY_ADDRESS,
} from '../config';
import { CustodyManagerABI, EvidenceRegistryABI } from './contracts';

export const ANVIL_NETWORK = {
  chainId: `0x${ANVIL_CHAIN_ID.toString(16)}`,
  chainName: 'Anvil Local',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: [ANVIL_RPC_URL],
};

export function getInjectedProvider(): (Window['ethereum']) | undefined {
  if (typeof window === 'undefined') return undefined;
  const injected = window.ethereum;
  const providers = injected?.providers ?? (injected ? [injected] : []);
  return providers.find((provider) => provider?.isMetaMask) ?? (providers.length === 1 ? providers[0] : undefined);
}

export async function readNetworkChainId(ethereum: NonNullable<Window['ethereum']>): Promise<number> {
  const hex = (await ethereum.request({ method: 'eth_chainId' })) as string;
  return Number.parseInt(hex, 16);
}

export async function hasContractBytecode(address: string): Promise<boolean> {
  const provider = new JsonRpcProvider(ANVIL_RPC_URL, ANVIL_CHAIN_ID);
  const code = await provider.getCode(address);
  return code !== '0x';
}

export async function contractsDeployed(): Promise<{ registry: boolean; manager: boolean }> {
  const [registry, manager] = await Promise.all([
    hasContractBytecode(EVIDENCE_REGISTRY_ADDRESS),
    hasContractBytecode(CUSTODY_MANAGER_ADDRESS),
  ]);
  return { registry, manager };
}

function toSha256(fileHash: string): string {
  return fileHash.replace(/^0x/, '').toLowerCase();
}

export interface OnChainEvidence {
  evidenceId: string;
  fileHash: string;
  cid: string;
  description: string;
  registrant: string;
  registeredAt: number;
  currentCustodian: string;
  exists: boolean;
}

export async function readEvidence(evidenceId: string, signerProvider?: BrowserProvider): Promise<OnChainEvidence | null> {
  const provider = signerProvider ?? new JsonRpcProvider(ANVIL_RPC_URL, ANVIL_CHAIN_ID);
  const registry = new Contract(EVIDENCE_REGISTRY_ADDRESS, EvidenceRegistryABI, provider);
  const exists = await registry.evidenceExists(evidenceId);
  if (!exists) return null;
  const data = await registry.getEvidence(evidenceId);
  return {
    evidenceId,
    fileHash: toSha256(data.fileHash),
    cid: data.cid,
    description: data.description,
    registrant: data.registrant,
    registeredAt: Number(data.registeredAt),
    currentCustodian: data.currentCustodian,
    exists: Boolean(data.exists),
  };
}

export function registryContract(signer: Awaited<ReturnType<BrowserProvider['getSigner']>>) {
  return new Contract(EVIDENCE_REGISTRY_ADDRESS, EvidenceRegistryABI, signer);
}

export function custodyManagerContract(signer: Awaited<ReturnType<BrowserProvider['getSigner']>>) {
  return new Contract(CUSTODY_MANAGER_ADDRESS, CustodyManagerABI, signer);
}

export function parseWalletAddress(value: string): string {
  const trimmed = value.trim();
  if (!isAddress(trimmed) || trimmed === ZeroAddress) {
    throw new Error('Enter a valid non-zero Ethereum address.');
  }
  return getAddress(trimmed);
}
