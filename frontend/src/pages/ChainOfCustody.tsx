import { useState, useEffect } from 'react';
import type { Eip1193Provider } from 'ethers';
import { useParams, useOutletContext } from 'react-router-dom';
import { 
  ArrowRight, 
  Clock, 
  Send, 
  CheckCircle2, 
  Loader2,
  FolderOpen,
  AlertTriangle
} from 'lucide-react';
import { 
  PageHeader, 
  AddressDisplay, 
  HashDisplay, 
  StatusBadge 
} from '../components/Shared';
import { useCase } from '../context/CaseContext';
import { api, type OnChainEvidenceItem, type CustodyEventItem } from '../services/api';
import { CUSTODY_MANAGER_ADDRESS } from '../config';

const CUSTODY_MANAGER_ABI = [
  "function transferCustody(string evidenceId, address newCustodian) external",
  "function currentCustodian(string evidenceId) view returns (address)"
];

interface OutletContextType {
  activeAccount: string | null;
  isCorrectNetwork: boolean;
  ethereum?: Eip1193Provider;
  handleConnectWallet: () => void;
  handleSwitchNetwork: () => void;
}

export function ChainOfCustody() {
  const { caseData, token } = useCase();
  const { caseId } = useParams();
  const activeRef = caseId || caseData?.caseRef || '';
  const { activeAccount, isCorrectNetwork, ethereum, handleConnectWallet, handleSwitchNetwork } = useOutletContext<OutletContextType>();

  const [evidenceList, setEvidenceList] = useState<OnChainEvidenceItem[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>('');
  const [custodyHistory, setCustodyHistory] = useState<CustodyEventItem[]>([]);
  const [currentCustodian, setCurrentCustodian] = useState<string | null>(null);

  const [newCustodian, setNewCustodian] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load evidence for case
  useEffect(() => {
    async function loadCaseData() {
      if (!token || !activeRef) return;
      try {
        const items = await api.getCaseEvidence(activeRef, token);
        setEvidenceList(items);
        if (items.length > 0) {
          setSelectedEvidenceId(items[0].evidenceId);
        }
      } catch (err) {
        console.warn('Failed to load evidence for custody:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCaseData();
  }, [activeRef, token]);

  // Load live custody history & current custodian directly from blockchain event logs & contract state
  useEffect(() => {
    async function loadHistory() {
      if (!token || !activeRef || !selectedEvidenceId) return;
      try {
        const res = await api.getCustodyHistory(activeRef, selectedEvidenceId, token);
        setCustodyHistory(res.history);
        setCurrentCustodian(res.currentCustodian);
      } catch (err) {
        console.warn('Failed to load custody history:', err);
      }
    }
    loadHistory();
  }, [activeRef, token, selectedEvidenceId, transferSuccess]);

  const isCurrentAuthorized = activeAccount && currentCustodian && activeAccount.toLowerCase() === currentCustodian.toLowerCase();

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustodian || !selectedEvidenceId) return;

    if (!activeAccount) {
      setTransferError('Please connect MetaMask with the current custodian address.');
      return;
    }
    if (!isCorrectNetwork) {
      setTransferError('Please switch MetaMask to Anvil Localnet (Chain ID 31337).');
      return;
    }
    if (!isCurrentAuthorized) {
      setTransferError(`Unauthorized: Connected wallet (${activeAccount.slice(0, 8)}…) is not the on-chain current custodian.`);
      return;
    }
    if (!ethereum) {
      setTransferError('MetaMask is not detected in this browser tab. Enable the extension for this site and reload.');
      return;
    }

    setIsTransferring(true);
    setTransferError(null);

    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const managerContract = new ethers.Contract(CUSTODY_MANAGER_ADDRESS, CUSTODY_MANAGER_ABI, signer);

      const tx = await managerContract.transferCustody(selectedEvidenceId.trim(), newCustodian.trim());
      await tx.wait();

      setTransferSuccess(true);
    } catch (err: any) {
      console.error('Custody transfer transaction error:', err);
      if (err?.code === 'ACTION_REJECTED') {
        setTransferError('Transaction was rejected by user in MetaMask.');
      } else {
        setTransferError(err?.message || 'Custody transfer transaction failed on-chain.');
      }
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="cp-custody-page">
      <PageHeader 
        title="Chain of Custody Tracking" 
        subtitle={`Chronological, tamper-proof record of custody handovers managed via CustodyManager.sol for ${activeRef}.`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.3fr)', gap: 24, alignItems: 'start' }}>
        {/* Custody Transfer Action Card */}
        <div className="cp-card">
          <h3 className="cp-card__title">Initiate Custody Handover</h3>
          <p className="cp-card__desc">
            Enforced by <code>CustodyManager.sol</code>: Only the currently recorded custodian wallet can execute this transfer.
          </p>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--cp-text-secondary)' }}>
              <Loader2 size={20} className="cp-spin" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: '0.8125rem' }}>Loading evidence items...</div>
            </div>
          ) : evidenceList.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', background: 'var(--cp-surface-subtle)', border: '1px dashed var(--cp-border)', borderRadius: 'var(--cp-radius-md)' }}>
              <FolderOpen size={28} color="var(--cp-text-tertiary)" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>No Evidence Records</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--cp-text-secondary)', marginTop: 2 }}>
                Register evidence in this case before initiating custody handovers.
              </div>
            </div>
          ) : transferSuccess ? (
            <div style={{ padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--cp-verified-bg)', border: '1px solid var(--cp-verified-border)', borderRadius: 'var(--cp-radius-md)', marginBottom: 16 }}>
                <CheckCircle2 size={22} color="var(--cp-verified-text)" />
                <div>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--cp-verified-text)' }}>
                    Custody Transfer Committed On-Chain!
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cp-verified-text)' }}>
                    Record <strong>{selectedEvidenceId}</strong> has been transferred to {newCustodian.slice(0, 8)}…
                  </div>
                </div>
              </div>
              <button 
                type="button"
                className="cp-btn cp-btn--secondary"
                onClick={() => {
                  setTransferSuccess(false);
                  setNewCustodian('');
                  setTransferReason('');
                  setTransferError(null);
                }}
              >
                Perform Another Custody Transfer
              </button>
            </div>
          ) : (
            <form onSubmit={handleTransferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)', marginBottom: 4 }}>
                  Target Evidence Record
                </label>
                <select
                  value={selectedEvidenceId}
                  onChange={(e) => setSelectedEvidenceId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {evidenceList.map((item) => (
                    <option key={item.evidenceId} value={item.evidenceId}>
                      {item.evidenceId} — {item.fileName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Verified Current Custodian Box */}
              {currentCustodian && (
                <div style={{ background: 'var(--cp-surface-subtle)', border: '1px solid var(--cp-border)', padding: 10, borderRadius: 'var(--cp-radius-md)' }}>
                  <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--cp-text-tertiary)', fontWeight: 600 }}>
                    Current On-Chain Custodian:
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <AddressDisplay address={currentCustodian} />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)', marginBottom: 4 }}>
                  Recipient Ethereum Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                  value={newCustodian}
                  onChange={(e) => setNewCustodian(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)', marginBottom: 4 }}>
                  Forensic Justification / Transfer Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Evidence handover to forensics hardware analyst..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* Authorization feedback */}
              {!activeAccount ? (
                <div className="cp-notice cp-notice--warning" style={{ margin: 0 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <div>
                    <span>MetaMask is disconnected. </span>
                    <button type="button" onClick={handleConnectWallet} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                      Connect Wallet
                    </button>
                  </div>
                </div>
              ) : !isCorrectNetwork ? (
                <div className="cp-notice cp-notice--warning" style={{ margin: 0 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <div>
                    <span>Wrong network. </span>
                    <button type="button" onClick={handleSwitchNetwork} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                      Switch to Anvil (31337)
                    </button>
                  </div>
                </div>
              ) : !isCurrentAuthorized && currentCustodian ? (
                <div className="cp-notice cp-notice--warning" style={{ margin: 0 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>
                    Connected wallet ({activeAccount.slice(0, 8)}…) is not the current custodian. Custody transfer is restricted to the recorded custodian.
                  </span>
                </div>
              ) : null}

              {transferError && (
                <div className="cp-notice cp-notice--warning" style={{ margin: 0 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{transferError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!newCustodian || isTransferring || !isCurrentAuthorized}
                className="cp-btn cp-btn--primary"
                style={{ marginTop: 4 }}
              >
                {isTransferring ? (
                  <>
                    <Loader2 size={14} className="cp-spin" />
                    <span>Signing Handover on Anvil...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Execute Custody Transfer</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Real Chronological Audit Timeline */}
        <div className="cp-card">
          <h3 className="cp-card__title">Chronological Custody Timeline</h3>
          <p className="cp-card__desc">
            Immutable events retrieved directly from <code>EvidenceRegistry</code> and <code>CustodyManager</code> contract logs.
          </p>

          {custodyHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--cp-text-tertiary)' }}>
              <Clock size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <div style={{ fontSize: '0.8125rem' }}>No custody events logged yet for {selectedEvidenceId || 'record'}.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {custodyHistory.map((item, idx) => (
                <div 
                  key={`${item.txHash}-${idx}`}
                  style={{
                    borderLeft: '2px solid var(--cp-teal)',
                    paddingLeft: 14,
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Clock size={13} color="var(--cp-teal)" />
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>
                      {new Date(item.timestamp * 1000).toUTCString()}
                    </span>
                    <StatusBadge variant={item.type === 'Registration' ? 'success' : 'info'}>
                      {item.type}
                    </StatusBadge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--cp-text-tertiary)' }}>From:</span>
                    <AddressDisplay address={item.from} />
                    <ArrowRight size={12} color="var(--cp-text-tertiary)" />
                    <span style={{ color: 'var(--cp-text-tertiary)' }}>To:</span>
                    <AddressDisplay address={item.to} />
                  </div>

                  <div style={{ fontSize: '0.6875rem' }}>
                    <HashDisplay hash={item.txHash} label="Tx" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
