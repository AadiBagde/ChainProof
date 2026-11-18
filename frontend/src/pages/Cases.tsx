import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Search, 
  KeyRound, 
  FolderOpen,
  Loader2
} from 'lucide-react';
import { 
  PageHeader, 
  StatusBadge, 
  HashDisplay, 
  AddressDisplay,
  CopyButton
} from '../components/Shared';
import { useCase } from '../context/CaseContext';
import { api, type OnChainEvidenceItem } from '../services/api';

export function Cases() {
  const { caseData, token } = useCase();
  const { caseId } = useParams();
  const activeRef = caseId || caseData?.caseRef || '';

  const [evidenceList, setEvidenceList] = useState<OnChainEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvidence() {
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
    fetchEvidence();
  }, [activeRef, token]);

  const filtered = evidenceList.filter((ev) => {
    const q = searchQuery.toLowerCase();
    return (
      ev.evidenceId.toLowerCase().includes(q) ||
      ev.fileName.toLowerCase().includes(q) ||
      ev.sha256.toLowerCase().includes(q) ||
      (ev.onChainStatus.description && ev.onChainStatus.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="cp-cases-page">
      <PageHeader 
        title={`Evidence Catalog: ${activeRef}`}
        subtitle="Cryptographically verified items linked to the active case in EvidenceRegistry.sol."
      />

      {/* Security Disclaimer */}
      <div className="cp-notice cp-notice--info">
        <KeyRound size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Access-Controlled Portfolio:</strong> This evidence catalog is filtered exclusively to the active authenticated session for case <strong>{activeRef}</strong>. Records are verified directly with smart contract storage.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="cp-card" style={{ padding: '16px' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--cp-text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Evidence ID, file artifact name, or SHA-256..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              border: '1px solid var(--cp-border)',
              borderRadius: 'var(--cp-radius-md)',
              fontSize: '0.875rem'
            }}
          />
        </div>
      </div>

      {/* Evidence Table */}
      <div className="cp-card">
        <h3 className="cp-card__title">Verified Case Evidence</h3>
        <p className="cp-card__desc">
          Total verified records matching filter: {filtered.length}
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--cp-text-muted)' }}>
            <Loader2 size={32} className="cp-spin" style={{ margin: '0 auto 8px' }} />
            <div>Loading verified items from EvidenceRegistry...</div>
          </div>
        ) : error ? (
          <div className="cp-notice cp-notice--warning">{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', background: 'var(--cp-bg)', borderRadius: 'var(--cp-radius-md)' }}>
            <FolderOpen size={36} color="var(--cp-text-muted)" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600 }}>No Evidence Matches Filter</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--cp-text-secondary)', marginTop: 4 }}>
              Register new digital artifacts using the Register Evidence workbench.
            </div>
          </div>
        ) : (
          <div className="cp-table-container">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Evidence ID</th>
                  <th>Description</th>
                  <th>File Artifact</th>
                  <th>SHA-256 Digest</th>
                  <th>IPFS CID</th>
                  <th>Current Custodian</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ev) => (
                  <tr key={ev.evidenceId}>
                    <td style={{ fontWeight: 600, color: 'var(--cp-navy)' }}>{ev.evidenceId}</td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--cp-text)' }}>
                        {ev.onChainStatus.description || 'Forensic artifact'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500, fontFamily: 'var(--cp-font-mono)', fontSize: '0.8125rem' }}>
                          {ev.fileName}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--cp-text-muted)' }}>
                          {(ev.fileSize / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </td>
                    <td>
                      <HashDisplay hash={ev.sha256} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="mono" title={ev.ipfsCid}>
                          {ev.ipfsCid.slice(0, 10)}…{ev.ipfsCid.slice(-6)}
                        </span>
                        <CopyButton text={ev.ipfsCid} label="Copy CID" />
                      </div>
                    </td>
                    <td>
                      {ev.onChainStatus.currentCustodian ? (
                        <AddressDisplay address={ev.onChainStatus.currentCustodian} />
                      ) : (
                        <span style={{ color: 'var(--cp-text-muted)' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {ev.onChainStatus.registered ? (
                        <StatusBadge variant="success">On-Chain</StatusBadge>
                      ) : (
                        <StatusBadge variant="warning">Unconfirmed</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
