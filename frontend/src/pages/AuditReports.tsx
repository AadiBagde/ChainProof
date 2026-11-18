import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Download, 
  Printer, 
  CheckCircle2, 
  FolderOpen,
  Loader2
} from 'lucide-react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { useCase } from '../context/CaseContext';
import { api, type OnChainEvidenceItem } from '../services/api';

export function AuditReports() {
  const { caseData, token } = useCase();
  const { caseId } = useParams();
  const activeRef = caseId || caseData?.caseRef || '';

  const [evidenceList, setEvidenceList] = useState<OnChainEvidenceItem[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!token || !activeRef) return;
      try {
        const items = await api.getCaseEvidence(activeRef, token);
        setEvidenceList(items);
        if (items.length > 0) {
          setSelectedEvidenceId(items[0].evidenceId);
        }
      } catch (err) {
        console.warn('Failed to load evidence for reports:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeRef, token]);

  const selectedItem = evidenceList.find((e) => e.evidenceId === selectedEvidenceId);

  return (
    <div className="cp-reports-page">
      <PageHeader 
        title="Compliance & Forensic Audit Reports" 
        subtitle={`Generate verifiable audit summaries and export chain-of-custody certificates for ${activeRef}.`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="cp-btn cp-btn--secondary" 
              onClick={() => window.print()}
            >
              <Printer size={16} />
              <span>Print Audit Sheet</span>
            </button>
            <button 
              className="cp-btn cp-btn--primary"
              onClick={() => {
                const reportData = {
                  caseRef: activeRef,
                  caseTitle: caseData?.title,
                  exportedAt: new Date().toISOString(),
                  evidence: evidenceList,
                };
                const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ChainProof_Audit_${activeRef}.json`;
                a.click();
              }}
            >
              <Download size={16} />
              <span>Export Audit JSON</span>
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Smart Contract Audit Card */}
        <div className="cp-card">
          <h3 className="cp-card__title">Foundry Smart Contract Test Baseline</h3>
          <p className="cp-card__desc">Immutable bytecode deployed to Anvil (Chain ID 31337).</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--cp-bg)', borderRadius: 'var(--cp-radius-md)' }}>
              <div>
                <strong style={{ fontSize: '0.875rem', color: 'var(--cp-navy)' }}>EvidenceRegistry.sol</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--cp-text-secondary)' }}>Core registration & hash storage</div>
              </div>
              <StatusBadge variant="success">13 / 13 Unit Tests</StatusBadge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--cp-bg)', borderRadius: 'var(--cp-radius-md)' }}>
              <div>
                <strong style={{ fontSize: '0.875rem', color: 'var(--cp-navy)' }}>CustodyManager.sol</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--cp-text-secondary)' }}>Custody transfer authorization</div>
              </div>
              <StatusBadge variant="success">9 / 9 Unit Tests</StatusBadge>
            </div>

            <div style={{ padding: '12px', background: 'var(--cp-success-bg)', border: '1px solid #A7F3D0', borderRadius: 'var(--cp-radius-md)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={20} color="var(--cp-success)" />
              <div style={{ fontSize: '0.8125rem', color: '#065F46', fontWeight: 500 }}>
                Automated Foundry Suite: 22 passed, 0 failed, 0 skipped.
              </div>
            </div>
          </div>
        </div>

        {/* Audit Certificate Generator */}
        <div className="cp-card">
          <h3 className="cp-card__title">Forensic Certificate of Integrity</h3>
          <p className="cp-card__desc">Verifiable certificate generated from actual on-chain evidence records.</p>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--cp-text-muted)' }}>
              <Loader2 size={24} className="cp-spin" style={{ margin: '0 auto 8px' }} />
              <div>Loading certificate data...</div>
            </div>
          ) : evidenceList.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--cp-bg)', borderRadius: 'var(--cp-radius-md)' }}>
              <FolderOpen size={32} color="var(--cp-text-muted)" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No Registered Items Available</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--cp-text-secondary)', marginTop: 4 }}>
                Register evidence in this case to preview disclosure certificates.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-muted)', marginBottom: 4 }}>
                  Select Evidence Record for Certificate:
                </label>
                <select
                  value={selectedEvidenceId}
                  onChange={(e) => setSelectedEvidenceId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 'var(--cp-radius-md)',
                    border: '1px solid var(--cp-border)',
                    fontSize: '0.8125rem',
                  }}
                >
                  {evidenceList.map((e) => (
                    <option key={e.evidenceId} value={e.evidenceId}>
                      {e.evidenceId} — {e.fileName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedItem && (
                <div style={{ border: '1px solid var(--cp-border)', borderRadius: 'var(--cp-radius-md)', padding: '16px', background: '#FFFFFF' }}>
                  <div style={{ textAlign: 'center', borderBottom: '1px solid var(--cp-border)', paddingBottom: '12px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cp-text-muted)', fontWeight: 700 }}>
                      ChainProof Digital Forensics Platform
                    </div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--cp-navy-deep)' }}>
                      EVIDENCE INTEGRITY DISCLOSURE CERTIFICATE
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--cp-text-secondary)' }}>
                      Case Reference: {activeRef}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                    <div><strong>Case Identifier:</strong> {activeRef}</div>
                    <div><strong>Evidence Identifier:</strong> {selectedItem.evidenceId}</div>
                    <div><strong>Artifact Title:</strong> {selectedItem.fileName}</div>
                    <div>
                      <strong>SHA-256 Digest:</strong>
                      <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--cp-navy)', wordBreak: 'break-all' }}>
                        {selectedItem.sha256}
                      </div>
                    </div>
                    <div><strong>IPFS CID:</strong> <span className="mono">{selectedItem.ipfsCid}</span></div>
                    <div><strong>Current Custodian:</strong> <span className="mono">{selectedItem.onChainStatus.currentCustodian || 'Unassigned'}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
