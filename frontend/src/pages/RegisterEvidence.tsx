import { useState, useCallback } from 'react';
import type { Eip1193Provider } from 'ethers';
import { useParams, useOutletContext } from 'react-router-dom';
import { 
  UploadCloud, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  Lock
} from 'lucide-react';
import { PageHeader, HashDisplay, AddressDisplay } from '../components/Shared';
import { useCase } from '../context/CaseContext';
import { api } from '../services/api';
import { ANVIL_CHAIN_ID, ANVIL_RPC_URL, EVIDENCE_REGISTRY_ADDRESS } from '../config';
import { isPlausibleIpfsCid } from '../services/ipfs';

const EVIDENCE_REGISTRY_ABI = [
  "function registerEvidence(string evidenceId, bytes32 fileHash, string cid, string description) external",
  "function getEvidence(string evidenceId) view returns (tuple(bytes32 fileHash, string cid, string description, address registrant, uint64 registeredAt, address currentCustodian, uint8 status, bool exists))"
];

interface OutletContextType {
  activeAccount: string | null;
  isCorrectNetwork: boolean;
  ethereum?: Eip1193Provider;
  handleConnectWallet: () => void;
  handleSwitchNetwork: () => void;
}

interface EvidenceAssociation {
  evidenceId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256: string;
  ipfsCid: string;
}

interface RegisteredRecord {
  evidenceId: string;
  fileHash: string;
  cid: string;
  description: string;
  registrant: string;
  currentCustodian: string;
}

interface UncertainTransaction {
  hash: string;
  association: EvidenceAssociation;
  registrant: string;
}

export function RegisterEvidence() {
  const { caseData, token } = useCase();
  const { caseId } = useParams();
  const activeRef = caseId || caseData?.caseRef || '';
  const { activeAccount, isCorrectNetwork, ethereum, handleConnectWallet, handleSwitchNetwork } = useOutletContext<OutletContextType>();

  const [evidenceId, setEvidenceId] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [computedSha256, setComputedSha256] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  
  // Transaction lifecycle
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [txSuccess, setTxSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [registeredRecord, setRegisteredRecord] = useState<RegisteredRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAssociation, setPendingAssociation] = useState<EvidenceAssociation | null>(null);
  const [associationError, setAssociationError] = useState<string | null>(null);
  const [uncertainTransaction, setUncertainTransaction] = useState<UncertainTransaction | null>(null);

  // Real browser WebCrypto SHA-256 over exact raw file bytes
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size === 0) {
      setSelectedFile(null);
      setComputedSha256(null);
      setErrorMessage('Empty files cannot be registered as evidence.');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    setIsHashing(true);
    setComputedSha256(null);
    setErrorMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setComputedSha256(hashHex);
    } catch (err) {
      console.error('Failed to calculate SHA-256:', err);
      setErrorMessage('Failed to read file bytes for SHA-256 computation.');
    } finally {
      setIsHashing(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEvidenceId = evidenceId.trim();
    const trimmedDescription = description.trim();
    if (!trimmedEvidenceId || !trimmedDescription || !selectedFile || !computedSha256 || !token || !activeRef) {
      setErrorMessage('Enter an evidence ID and description, select a file, and verify the case session before continuing.');
      return;
    }
    if (new TextEncoder().encode(trimmedEvidenceId).length > 64) {
      setErrorMessage('Evidence ID must be no more than 64 UTF-8 bytes.');
      return;
    }
    if (new TextEncoder().encode(trimmedDescription).length > 256) {
      setErrorMessage('Description must be no more than 256 UTF-8 bytes.');
      return;
    }

    if (!activeAccount) {
      setErrorMessage('Please connect MetaMask to sign and commit this evidence record on-chain.');
      return;
    }
    if (!isCorrectNetwork) {
      setErrorMessage('MetaMask is connected to the wrong network. Please switch to Anvil Localnet (Chain ID 31337).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    let uploadedCid: string | null = null;
    let confirmedTransactionHash: string | null = null;

    try {
      setStatusMessage('Uploading the selected file to the configured IPFS service...');
      const ipfsCid = await api.uploadEvidenceFile(selectedFile, computedSha256, token);
      uploadedCid = ipfsCid;
      if (!isPlausibleIpfsCid(ipfsCid) || new TextEncoder().encode(ipfsCid).length > 128) {
        throw new Error('The IPFS service returned an invalid CID. No blockchain transaction was submitted.');
      }

      setStatusMessage('Checking MetaMask account and configured Anvil network...');
      const { ethers } = await import('ethers');
      if (!ethereum) {
        throw new Error('MetaMask is unavailable. The file was uploaded to IPFS, but no blockchain transaction was submitted.');
      }
      const provider = new ethers.BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== ANVIL_CHAIN_ID) {
        throw new Error(`MetaMask is connected to chain ${network.chainId}, not the configured chain ${ANVIL_CHAIN_ID}. The file was uploaded, but no transaction was submitted.`);
      }
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== activeAccount.toLowerCase()) {
        throw new Error('The connected MetaMask account changed during upload. The file was uploaded, but no transaction was submitted.');
      }
      const registryContract = new ethers.Contract(EVIDENCE_REGISTRY_ADDRESS, EVIDENCE_REGISTRY_ABI, signer);
      const fileHashBytes32 = `0x${computedSha256.toLowerCase()}`;
      const association: EvidenceAssociation = {
        evidenceId: trimmedEvidenceId,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type || 'application/octet-stream',
        sha256: computedSha256.toLowerCase(),
        ipfsCid,
      };

      setStatusMessage('Waiting for MetaMask approval for evidence registration...');
      const tx = await registryContract.registerEvidence(
        trimmedEvidenceId,
        fileHashBytes32,
        ipfsCid,
        trimmedDescription
      );
      setTxHash(tx.hash);
      setStatusMessage(`Transaction broadcast: ${tx.hash.slice(0, 10)}… Waiting for confirmation...`);
      let receipt;
      try {
        receipt = await tx.wait();
      } catch {
        try {
          receipt = await provider.getTransactionReceipt(tx.hash);
        } catch {
          receipt = null;
        }
        if (!receipt) {
          setUncertainTransaction({
            hash: tx.hash,
            association,
            registrant: tx.from,
          });
          throw new Error(`Transaction status is not yet known. Check transaction ${tx.hash} before retrying; do not submit this evidence ID again until its status is confirmed.`);
        }
      }
      if (!receipt || receipt.status !== 1) {
        if (!receipt) {
          setUncertainTransaction({
            hash: tx.hash,
            association,
            registrant: tx.from,
          });
        }
        throw new Error(`The blockchain transaction reverted (${tx.hash}). No evidence registration was confirmed.`);
      }

      setUncertainTransaction({
        hash: tx.hash,
        association,
        registrant: tx.from,
      });
      setTxHash(receipt.hash);
      setPendingAssociation(association);
      setRegisteredRecord({
        evidenceId: trimmedEvidenceId,
        fileHash: fileHashBytes32,
        cid: ipfsCid,
        description: trimmedDescription,
        registrant: tx.from,
        currentCustodian: tx.from,
      });
      setStatusMessage('Reading verified record from EvidenceRegistry storage...');
      const onChainData = await registryContract.getEvidence(trimmedEvidenceId);
      if (
        !onChainData[7] ||
        String(onChainData[0]).toLowerCase().replace(/^0x/, '') !== computedSha256.toLowerCase() ||
        String(onChainData[1]) !== ipfsCid ||
        String(onChainData[3]).toLowerCase() !== tx.from.toLowerCase()
      ) {
        throw new Error('The confirmed on-chain record did not match the submitted evidence details.');
      }
      confirmedTransactionHash = receipt.hash;
      setUncertainTransaction(null);
      setTxSuccess(true);
      setRegisteredRecord({
        evidenceId: trimmedEvidenceId,
        fileHash: onChainData[0],
        cid: onChainData[1],
        description: onChainData[2],
        registrant: onChainData[3],
        currentCustodian: onChainData[5],
      });
      setStatusMessage('Saving the evidence-to-case association...');
      try {
        await api.associateEvidence(association, token);
        setPendingAssociation(null);
      } catch (err) {
        setAssociationError(err instanceof Error ? err.message : 'Case association failed.');
      }
    } catch (err) {
      console.error('Registration workflow failed:', err);
      const error = err as { code?: string; message?: string };
      if (confirmedTransactionHash) {
        setAssociationError(
          `${error.message || 'The case association could not be confirmed.'} The blockchain transaction is confirmed (${confirmedTransactionHash}); retry case association only and do not register again.`
        );
      } else if (error.code === 'ACTION_REJECTED') {
        setErrorMessage(uploadedCid
          ? `MetaMask transaction was rejected. The file was uploaded to IPFS (CID: ${uploadedCid}), but it was not registered on-chain.`
          : 'MetaMask transaction was rejected.');
      } else if (error.message?.includes('EvidenceAlreadyRegistered')) {
        setErrorMessage(`Evidence ID "${trimmedEvidenceId}" has already been registered on-chain. Verify the existing record before retrying.`);
      } else {
        setErrorMessage(error.message || 'Evidence registration failed.');
      }
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  const retryAssociation = async () => {
    if (!pendingAssociation || !token) return;
    setAssociationError(null);
    setIsSubmitting(true);
    setStatusMessage('Retrying case association only; no blockchain transaction will be sent...');
    try {
      await api.associateEvidence(pendingAssociation, token);
      setPendingAssociation(null);
      setAssociationError(null);
    } catch (err) {
      setAssociationError(err instanceof Error ? err.message : 'Case association failed.');
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  const checkUncertainTransaction = async () => {
    if (!uncertainTransaction || !token) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage('Checking the transaction receipt and registry state...');
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(ANVIL_RPC_URL, ANVIL_CHAIN_ID);
      const receipt = await provider.getTransactionReceipt(uncertainTransaction.hash);
      if (!receipt) {
        setErrorMessage('The transaction is still pending or the RPC has not indexed it yet. Check again before attempting any new registration.');
        return;
      }
      if (receipt.status !== 1) {
        setUncertainTransaction(null);
        setTxHash(null);
        setErrorMessage(`Transaction ${uncertainTransaction.hash} reverted. No registration was confirmed; you may review the inputs and retry.`);
        return;
      }

      const registryCode = await provider.getCode(EVIDENCE_REGISTRY_ADDRESS);
      if (registryCode === '0x') {
        throw new Error(`No contract is deployed at the configured EvidenceRegistry address ${EVIDENCE_REGISTRY_ADDRESS} on chain ${ANVIL_CHAIN_ID}. Update the contract address and check the transaction again.`);
      }

      const contract = new ethers.Contract(EVIDENCE_REGISTRY_ADDRESS, EVIDENCE_REGISTRY_ABI, provider);
      const exists = await contract.evidenceExists(uncertainTransaction.association.evidenceId);
      if (!exists) {
        setUncertainTransaction(null);
        setTxHash(null);
        setErrorMessage(
          `Transaction ${uncertainTransaction.hash} succeeded, but evidence ID "${uncertainTransaction.association.evidenceId}" is not registered at the configured EvidenceRegistry (${EVIDENCE_REGISTRY_ADDRESS}). No record exists in this registry, so you can retry this evidence ID.`
        );
        return;
      }

      const data = await contract.getEvidence(uncertainTransaction.association.evidenceId);
      if (
        !data[7] ||
        String(data[0]).toLowerCase().replace(/^0x/, '') !== uncertainTransaction.association.sha256 ||
        String(data[1]) !== uncertainTransaction.association.ipfsCid ||
        String(data[3]).toLowerCase() !== uncertainTransaction.registrant.toLowerCase()
      ) {
        setErrorMessage(`Transaction ${uncertainTransaction.hash} succeeded, but the registry data could not be reconciled with this submission. Do not register this evidence ID again.`);
        return;
      }

      setTxHash(receipt.hash);
      setRegisteredRecord({
        evidenceId: uncertainTransaction.association.evidenceId,
        fileHash: data[0],
        cid: data[1],
        description: data[2],
        registrant: data[3],
        currentCustodian: data[5],
      });
      setTxSuccess(true);
      setPendingAssociation(uncertainTransaction.association);
      setUncertainTransaction(null);
      try {
        await api.associateEvidence(uncertainTransaction.association, token);
        setPendingAssociation(null);
      } catch (err) {
        setAssociationError(err instanceof Error ? err.message : 'Case association failed.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error
        ? `Could not verify transaction status: ${err.message}. Do not submit this evidence ID again until status is known.`
        : 'Could not verify transaction status. Do not submit this evidence ID again until status is known.');
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="cp-register-page">
      <PageHeader 
        title="Register Digital Evidence" 
        subtitle={`Compute bitwise SHA-256 digest and execute registerEvidence() on EvidenceRegistry for ${activeRef}.`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
        {/* Registration Form / Success Confirmation */}
        <div className="cp-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 className="cp-card__title" style={{ marginBottom: 0 }}>On-Chain Evidence Ingestion</h3>
            <span className="cp-badge cp-badge--info">Case: {activeRef}</span>
          </div>
          <p className="cp-card__desc">
            Deterministic SHA-256 digest and IPFS CID are immutably written to <code>EvidenceRegistry.sol</code>.
          </p>

          {txSuccess && registeredRecord ? (
            <div style={{ padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--cp-verified-bg)', border: '1px solid var(--cp-verified-border)', borderRadius: 'var(--cp-radius-md)', marginBottom: 20 }}>
                <CheckCircle2 size={24} color="var(--cp-verified-text)" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--cp-verified-text)' }}>
                    Evidence Confirmed On-Chain
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cp-verified-text)' }}>
                    {pendingAssociation
                      ? <>Blockchain confirmation succeeded; linking the record to case <strong>{activeRef}</strong> still needs completion.</>
                      : <>Record committed to the blockchain and linked to case <strong>{activeRef}</strong>.</>}
                  </div>
                </div>
              </div>

              {associationError && (
                <div className="cp-notice cp-notice--warning" style={{ marginBottom: 16 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <div>
                    <div>On-chain registration is confirmed, but case association failed: {associationError}</div>
                    {pendingAssociation && (
                      <button
                        type="button"
                        className="cp-btn cp-btn--secondary"
                        disabled={isSubmitting}
                        onClick={retryAssociation}
                        style={{ marginTop: 8 }}
                      >
                        Retry Case Association
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Verified Details Sheet */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8125rem', marginBottom: 20 }}>
                <div>
                  <strong>Evidence Identifier:</strong> <span className="mono">{registeredRecord.evidenceId}</span>
                </div>
                <div>
                  <strong>SHA-256 Digest:</strong>
                  <div className="mono" style={{ fontSize: '0.75rem', wordBreak: 'break-all', marginTop: 2 }}>
                    {registeredRecord.fileHash}
                  </div>
                </div>
                <div>
                  <strong>IPFS CID:</strong> <span className="mono">{registeredRecord.cid}</span>
                </div>
                <div>
                  <strong>Registered by:</strong>
                  <div style={{ marginTop: 2 }}>
                    <AddressDisplay address={registeredRecord.registrant} />
                  </div>
                </div>
                <div>
                  <strong>Initial Custodian:</strong>
                  <div style={{ marginTop: 2 }}>
                    <AddressDisplay address={registeredRecord.currentCustodian} />
                  </div>
                </div>
                {txHash && (
                  <div>
                    <strong>Transaction Hash:</strong>
                    <div style={{ marginTop: 2 }}>
                      <HashDisplay hash={txHash} label="Tx" truncate={false} />
                    </div>
                  </div>
                )}
              </div>

              <button 
                type="button"
                className="cp-btn cp-btn--secondary"
                onClick={() => {
                  setTxSuccess(false);
                  setEvidenceId('');
                  setDescription('');
                  setSelectedFile(null);
                  setComputedSha256(null);
                  setTxHash(null);
                  setRegisteredRecord(null);
                  setPendingAssociation(null);
                  setAssociationError(null);
                  setErrorMessage(null);
                  setUncertainTransaction(null);
                }}
              >
                Register Another Evidence Item
              </button>
            </div>
          ) : uncertainTransaction ? (
            <div style={{ padding: '16px 0' }}>
              <div className="cp-notice cp-notice--warning" style={{ marginBottom: 12 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <div>
                  The transaction was broadcast, but its receipt or registry record could not be verified. Do not resubmit this evidence ID.
                  <div className="mono" style={{ wordBreak: 'break-all', marginTop: 6 }}>{uncertainTransaction.hash}</div>
                </div>
              </div>
              {errorMessage && <div className="cp-notice cp-notice--warning" style={{ marginBottom: 12 }}>{errorMessage}</div>}
              <button
                type="button"
                className="cp-btn cp-btn--primary"
                disabled={isSubmitting}
                onClick={checkUncertainTransaction}
              >
                {isSubmitting ? statusMessage || 'Checking status...' : 'Check Transaction Status'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)', marginBottom: 4 }}>
                  Unique Evidence Identifier *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  placeholder="e.g. EVID-2026-0104"
                  value={evidenceId}
                  onChange={(e) => setEvidenceId(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)', marginBottom: 4 }}>
                  Case Identifier (Locked to Session)
                </label>
                <div style={{ padding: '6px 10px', background: 'var(--cp-surface-subtle)', border: '1px solid var(--cp-border)', borderRadius: 'var(--cp-radius-md)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lock size={13} color="var(--cp-teal)" />
                  <strong>{activeRef}</strong>
                  <span style={{ color: 'var(--cp-text-secondary)', fontSize: '0.75rem' }}>({caseData?.title})</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)', marginBottom: 4 }}>
                  Forensic Description & Provenance *
                </label>
                <textarea
                  required
                  rows={2}
                  disabled={isSubmitting}
                  placeholder="Description of physical provenance, device serial, acquisition tool..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* Raw File Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)', marginBottom: 4 }}>
                  Select File for Exact Byte Hashing *
                </label>
                <div 
                  style={{
                    border: '1px dashed var(--cp-border-strong)',
                    borderRadius: 'var(--cp-radius-md)',
                    padding: '18px 14px',
                    textAlign: 'center',
                    background: 'var(--cp-surface-subtle)',
                    position: 'relative'
                  }}
                >
                  <UploadCloud size={24} color="var(--cp-teal)" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                    {selectedFile ? selectedFile.name : 'Choose raw file for WebCrypto hashing'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-tertiary)', marginTop: 2 }}>
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'All formats supported. Pure byte-stream SHA-256 digest'}
                  </div>
                  <input
                    type="file"
                    required
                    disabled={isSubmitting}
                    onChange={handleFileChange}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                </div>
              </div>

              {isHashing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--cp-teal)', fontSize: '0.75rem' }}>
                  <Loader2 size={13} className="cp-spin" />
                  <span>Computing SHA-256 over exact file bytes...</span>
                </div>
              )}

              {computedSha256 && (
                <div style={{ background: 'var(--cp-surface-subtle)', border: '1px solid var(--cp-border)', borderRadius: 'var(--cp-radius-sm)', padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--cp-text-tertiary)' }}>
                    Computed SHA-256:
                  </div>
                  <div className="mono" style={{ fontSize: '0.75rem', wordBreak: 'break-all', marginTop: 2 }}>
                    {computedSha256}
                  </div>
                </div>
              )}

              {/* Wallet Requirement Warning if disconnected */}
              {!activeAccount ? (
                <div className="cp-notice cp-notice--warning" style={{ margin: 0 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <div>
                    <span>MetaMask is not connected. </span>
                    <button type="button" onClick={handleConnectWallet} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                      Connect Wallet
                    </button>
                    <span> to sign this transaction.</span>
                  </div>
                </div>
              ) : !isCorrectNetwork ? (
                <div className="cp-notice cp-notice--warning" style={{ margin: 0 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <div>
                    <span>Connected to wrong network. </span>
                    <button type="button" onClick={handleSwitchNetwork} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                      Switch to Anvil (31337)
                    </button>
                  </div>
                </div>
              ) : null}

              {errorMessage && (
                <div className="cp-notice cp-notice--warning" style={{ margin: 0 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!evidenceId || !selectedFile || !computedSha256 || isSubmitting || !activeAccount || !isCorrectNetwork}
                className="cp-btn cp-btn--primary"
                style={{ marginTop: 4 }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="cp-spin" />
                    <span>{statusMessage || 'Awaiting Confirmation...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} />
                    <span>Approve & Sign via MetaMask</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Forensic Standards & Instructions Panel */}
        <div>
          <div className="cp-card">
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cp-text-primary)', marginBottom: 8 }}>
              Evidence Registration Workflow
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--cp-text-secondary)', display: 'flex', flexDirection: 'column', gap: 10, lineHeight: 1.5 }}>
              <p>
                <strong>1. Deterministic Digest:</strong> The file is hashed in memory via <code>crypto.subtle.digest('SHA-256')</code>. No filename or text transcoding is performed.
              </p>
              <p>
                <strong>2. IPFS Upload:</strong> The original file is sent to the configured backend IPFS provider. Its returned CID—not the digest—is used as the content address. The configured upload limit is enforced by the backend.
              </p>
              <p>
                <strong>3. On-Chain Commit:</strong> After MetaMask confirms the account and network, <code>EvidenceRegistry.registerEvidence()</code> commits the SHA-256 digest and real CID. MetaMask account <code>{activeAccount ? activeAccount.slice(0, 10) + '…' : 'wallet'}</code> becomes registrant and initial custodian.
              </p>
              <p>
                <strong>4. Case Association:</strong> After transaction confirmation, the verified record is associated with case <code>{activeRef}</code> in MongoDB. If this step fails, retrying it does not submit another blockchain transaction.
              </p>
              <p>
                <strong>Privacy:</strong> Public IPFS content is retrievable by anyone with its CID. Do not upload confidential or personal evidence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
