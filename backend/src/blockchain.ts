import { ethers } from 'ethers';
import { config } from './config.js';
import { EvidenceRegistryABI, CustodyManagerABI } from './contracts.js';

let provider: ethers.JsonRpcProvider | null = null;
let registryContract: ethers.Contract | null = null;
let custodyManagerContract: ethers.Contract | null = null;

export function getBlockchainProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, {
      staticNetwork: ethers.Network.from({
        chainId: config.chainId,
        name: 'anvil',
      }),
    });
  }
  return provider;
}

export function getRegistryContract(): ethers.Contract {
  if (!registryContract) {
    registryContract = new ethers.Contract(
      config.evidenceRegistryAddress,
      EvidenceRegistryABI,
      getBlockchainProvider()
    );
  }
  return registryContract;
}

export function getCustodyManagerContract(): ethers.Contract {
  if (!custodyManagerContract) {
    custodyManagerContract = new ethers.Contract(
      config.custodyManagerAddress,
      CustodyManagerABI,
      getBlockchainProvider()
    );
  }
  return custodyManagerContract;
}

export async function checkBlockchainHealth(): Promise<{
  status: 'connected' | 'disconnected';
  blockNumber?: number;
  contractsVerified?: boolean;
  error?: string;
}> {
  try {
    const prov = getBlockchainProvider();
    const network = await prov.getNetwork();
    if (Number(network.chainId) !== config.chainId) {
      return {
        status: 'disconnected',
        error: `RPC chain ID ${network.chainId} does not match configured ${config.chainId}.`,
      };
    }
    const blockNumber = await prov.getBlockNumber();
    const regCode = await prov.getCode(config.evidenceRegistryAddress);
    const mgrCode = await prov.getCode(config.custodyManagerAddress);
    return {
      status: 'connected',
      blockNumber,
      contractsVerified: regCode !== '0x' && mgrCode !== '0x',
    };
  } catch (err) {
    return { status: 'disconnected', error: (err as Error).message };
  }
}

function bytes32ToSha256Hex(value: string): string {
  return value.startsWith('0x') ? value.slice(2).toLowerCase() : value.toLowerCase();
}

export async function queryOnChainEvidence(evidenceId: string) {
  const registry = getRegistryContract();
  const exists = await registry.evidenceExists(evidenceId);
  if (!exists) return null;
  const data = await registry.getEvidence(evidenceId);
  return {
    evidenceId,
    fileHash: bytes32ToSha256Hex(data.fileHash),
    cid: data.cid as string,
    description: data.description as string,
    registrant: data.registrant as string,
    registeredAt: Number(data.registeredAt),
    currentCustodian: data.currentCustodian as string,
    status: Number(data.status) === 0 ? 'Registered' : 'Unknown',
    exists: Boolean(data.exists),
  };
}

export async function queryCustodyHistoryFromEvents(evidenceId: string) {
  const manager = getCustodyManagerContract();
  const registry = getRegistryContract();
  const history: Array<{
    type: 'Registration' | 'Transfer';
    from: string;
    to: string;
    timestamp: number;
    initiator?: string;
    txHash: string;
    blockNumber: number;
  }> = [];

  try {
    const regLogs = await registry.queryFilter(registry.filters.EvidenceRegistered(), 0, 'latest');
    for (const log of regLogs) {
      if (!('args' in log) || !log.args) continue;
      const id = String(log.args.evidenceId ?? log.args[0]);
      if (id !== evidenceId) continue;
      history.push({
        type: 'Registration',
        from: ethers.ZeroAddress,
        to: String(log.args.custodian ?? log.args[4]),
        timestamp: Number(log.args.timestamp ?? log.args[5]),
        initiator: String(log.args.registrant ?? log.args[3]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    }

    const xferLogs = await manager.queryFilter(manager.filters.CustodyTransferred(), 0, 'latest');
    for (const log of xferLogs) {
      if (!('args' in log) || !log.args) continue;
      const id = String(log.args.evidenceId ?? log.args[0]);
      if (id !== evidenceId) continue;
      history.push({
        type: 'Transfer',
        from: String(log.args.previousCustodian ?? log.args[1]),
        to: String(log.args.newCustodian ?? log.args[2]),
        timestamp: Number(log.args.timestamp ?? log.args[3]),
        initiator: String(log.args.initiator ?? log.args[4]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    }

    history.sort((a, b) => a.timestamp - b.timestamp || a.blockNumber - b.blockNumber);
  } catch (err) {
    console.warn('Error reading contract logs:', (err as Error).message);
  }

  return history;
}
