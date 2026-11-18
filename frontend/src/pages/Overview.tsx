import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  FilePlus, 
  ArrowRight,
  FolderOpen,
  Loader2,
  Info
} from 'lucide-react';
import { 
  PageHeader, 
  StatusBadge, 
  HashDisplay, 
  AddressDisplay 
} from '../components/Shared';
import { useCase } from '../context/CaseContext';
import { api, type OnChainEvidenceItem } from '../services/api';

export function Overview() {
  const { caseData, token } = useCase();
  const { caseId } = useParams();
  const activeRef = caseId || caseData?.caseRef || '';

  const [evidenceList, setEvidenceList] = useState<OnChainEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!token || !activeRef) return;
      setLoading(true);
      setError(null);
      try {
        const items = await api.getCaseEvidence(activeRef, token);
        setEvidenceList(items);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeRef, token]);

  const registeredCount = evidenceList.filter((e) => e.onChainStatus.registered).length;
  const uniqueCustodians = new Set(
    evidenceList.map((e) => e.onChainStatus.currentCustodian).filter(Boolean)
  ).size;

  return (
    <div className="cp-overview-page">
      <PageHeader 
        title={`Case Workspace: ${activeRef}`} 
        subtitle={caseData?.title || 'Investigative Evidence Dossier'}
        actions={
          <Link to={`/workspace/${encodeURIComponent(activeRef)}/register`} className="cp-btn cp-btn--primary">
            <FilePlus size={15} />
            <span>Register Evidence Item</span>
          </Link>
        }
      />

      {/* Structured Case Summary Dossier */}
      <div className="cp-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--cp-text-tertiary)' }}>
              Case Metadata & Scope
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--cp-text-primary)', marginTop: 2 }}>
              {caseData?.title}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--cp-text-secondary)', marginTop: 4, maxWidth: 640 }}>
              {caseData?.description || 'Active digital forensic investigation subject to cryptographic custody tracking.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, borderLeft: '1px solid var(--cp-border)', paddingLeft: 16 }}>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Lead Investigator
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--cp-text-primary)', marginTop: 2 }}>
                {caseData?.leadInvestigator || 'Assigned Officer'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Status
              </div>
              <div style={{ marginTop: 2 }}>
                <span className="cp-badge cp-badge--info">{caseData?.status || 'active'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real Summary Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--cp-border)' }}>
          <div style={{ padding: '8px 12px', background: 'var(--cp-surface-subtle)', borderRadius: 'var(--cp-radius-sm)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Indexed Evidence
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--cp-text-primary)', marginTop: 2 }}>
              {loading ? '—' : `${evidenceList.length} Items`}
            </div>
          </div>
          <div style={{ padding: '8px 12px', background: 'var(--cp-surface-subtle)', borderRadius: 'var(--cp-radius-sm)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              On-Chain Verified
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--cp-text-primary)', marginTop: 2 }}>
              {loading ? '—' : `${registeredCount} Records`}
            </div>
          </div>
          <div style={{ padding: '8px 12px', background: 'var(--cp-surface-subtle)', borderRadius: 'var(--cp-radius-sm)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Active Custodians
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--cp-text-primary)', marginTop: 2 }}>
              {loading ? '—' : `${uniqueCustodians} Verified`}
            </div>
          </div>
        </div>
      </div>

      {/* Registered Evidence Table */}
      <div className="cp-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h4 className="cp-card__title">Case Evidence Records</h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--cp-text-secondary)' }}>
              Verified items retrieved directly from smart contract storage and case index.
            </div>
          </div>
          <Link to={`/workspace/${encodeURIComponent(activeRef)}/evidence`} className="cp-btn cp-btn--secondary" style={{ fontSize: '0.75rem', padding: '5px 10px' }}>
            <span>Full Catalog</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--cp-text-secondary)' }}>
            <Loader2 size={24} className="cp-spin" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '0.8125rem' }}>Querying EvidenceRegistry contract state...</div>
          </div>
        ) : error ? (
          <div className="cp-notice cp-notice--warning">{error}</div>
        ) : evidenceList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', background: 'var(--cp-surface-subtle)', border: '1px dashed var(--cp-border)', borderRadius: 'var(--cp-radius-md)' }}>
            <FolderOpen size={32} color="var(--cp-text-tertiary)" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>No Evidence Registered for This Case</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--cp-text-secondary)', marginTop: 4, marginBottom: 16 }}>
              Select a synthetic digital artifact and commit its cryptographic SHA-256 fingerprint to EvidenceRegistry.sol.
            </p>
            <Link to={`/workspace/${encodeURIComponent(activeRef)}/register`} className="cp-btn cp-btn--primary">
              <FilePlus size={14} />
              <span>Register First Evidence Item</span>
            </Link>
          </div>
        ) : (
          <div className="cp-table-container">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Evidence ID</th>
                  <th>Artifact</th>
                  <th>SHA-256 Fingerprint</th>
                  <th>IPFS CID</th>
                  <th>Current Custodian</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {evidenceList.map((ev) => (
                  <tr key={ev.evidenceId}>
                    <td>
                      <strong style={{ color: 'var(--cp-text-primary)' }}>{ev.evidenceId}</strong>
                    </td>
                    <td>
                      <div>{ev.fileName}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-tertiary)' }}>
                        {(ev.fileSize / 1024).toFixed(1)} KB
                      </div>
                    </td>
                    <td>
                      <HashDisplay hash={ev.sha256} />
                    </td>
                    <td>
                      <span className="mono" title={ev.ipfsCid}>
                        {ev.ipfsCid.slice(0, 10)}…{ev.ipfsCid.slice(-6)}
                      </span>
                    </td>
                    <td>
                      {ev.onChainStatus.currentCustodian ? (
                        <AddressDisplay address={ev.onChainStatus.currentCustodian} />
                      ) : (
                        <span style={{ color: 'var(--cp-text-tertiary)' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {ev.onChainStatus.registered ? (
                        <StatusBadge variant="success">On-Chain</StatusBadge>
                      ) : (
                        <StatusBadge variant="warning">Pending</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Forensic Legal Advisory Callout */}
      <div className="cp-notice cp-notice--info">
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Blockchain Verification Standard:</strong> Cryptographic registration commits a 32-byte SHA-256 digest to <code>EvidenceRegistry.sol</code> at block execution time. A valid record confirms byte identity from the timestamp of registration onward; it does not independently certify pre-registration origin.
        </div>
      </div>
    </div>
  );
}
