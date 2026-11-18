import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  UploadCloud, 
  CheckCircle2, 
  XCircle, 
  FileSearch, 
  Loader2, 
  FolderOpen,
  Info
} from 'lucide-react';
import { PageHeader } from '../components/Shared';
import { useCase } from '../context/CaseContext';
import { api, type OnChainEvidenceItem } from '../services/api';
import { readEvidence } from '../services/chain';

export function VerifyIntegrity() {
  const { caseData, token } = useCase();
  const { caseId } = useParams();
  const activeRef = caseId || caseData?.caseRef || '';

  const [evidenceList, setEvidenceList] = useState<OnChainEvidenceItem[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>('');
  const [onChainDigest, setOnChainDigest] = useState<string | null>(null);
  const [testFile, setTestFile] = useState<File | null>(null);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [fetchingContract, setFetchingContract] = useState(false);
  const [chainReadError, setChainReadError] = useState<string | null>(null);
  const [evidenceLoadError, setEvidenceLoadError] = useState<string | null>(null);
  const [hashError, setHashError] = useState<string | null>(null);

  useEffect(() => {
    async function loadItems() {
      if (!token || !activeRef) return;
      try {
        const items = await api.getCaseEvidence(activeRef, token);
        setEvidenceList(items);
        if (items.length > 0) {
          setSelectedEvidenceId(items[0].evidenceId);
        }
      } catch (err) {
        console.warn('Failed to load case evidence for verification:', err);
        setEvidenceLoadError(err instanceof Error ? err.message : 'Failed to load case evidence.');
      } finally {
        setLoadingItems(false);
      }
    }
    loadItems();
  }, [activeRef, token]);

  // Read the reference SHA-256 digest directly from EvidenceRegistry.sol
  useEffect(() => {
    async function fetchOnChainDigest() {
      if (!selectedEvidenceId) {
        setOnChainDigest(null);
        setChainReadError(null);
        return;
      }
      setFetchingContract(true);
      setOnChainDigest(null);
      setChainReadError(null);
      try {
        const evidence = await readEvidence(selectedEvidenceId);
        if (!evidence) {
          setChainReadError(`Evidence ID "${selectedEvidenceId}" was not found in the deployed contract.`);
          return;
        }
        setOnChainDigest(evidence.fileHash.toLowerCase().replace(/^0x/, ''));
      } catch (err) {
        console.error('Failed to read authoritative on-chain evidence digest:', err);
        setChainReadError(err instanceof Error ? err.message : 'Could not read the evidence record from the blockchain.');
      } finally {
        setFetchingContract(false);
      }
    }
    fetchOnChainDigest();
  }, [selectedEvidenceId, evidenceList]);

  const targetRecord = evidenceList.find((e) => e.evidenceId === selectedEvidenceId);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTestFile(file);
    setIsHashing(true);
    setComputedHash(null);
    setHashError(null);

    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setComputedHash(hashHex.toLowerCase());
    } catch (err) {
      console.error('Failed to hash candidate file:', err);
      setHashError(err instanceof Error ? err.message : 'Could not read the selected file.');
    } finally {
      setIsHashing(false);
    }
  }, []);

  const normalizedOnChain = onChainDigest ? onChainDigest.toLowerCase().replace(/^0x/, '') : null;
  const normalizedCandidate = computedHash ? computedHash.toLowerCase().replace(/^0x/, '') : null;
  const isMatch = normalizedOnChain && normalizedCandidate && normalizedOnChain === normalizedCandidate;

  return (
    <div className="cp-verify-page">
      <PageHeader 
        title="Evidence Integrity Verification" 
        subtitle={`Audit bit-for-bit file authenticity against EvidenceRegistry.sol storage for ${activeRef}.`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
        {/* Verification Controls */}
        <div className="cp-card">
          <h3 className="cp-card__title">Select Registered Record</h3>
          <p className="cp-card__desc">Choose an indexed evidence item to audit against incoming files.</p>

          {loadingItems ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--cp-text-secondary)' }}>
              <Loader2 size={20} className="cp-spin" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: '0.8125rem' }}>Loading evidence records...</div>
            </div>
          ) : evidenceLoadError ? (
            <div className="cp-notice cp-notice--warning">{evidenceLoadError}</div>
          ) : evidenceList.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', background: 'var(--cp-surface-subtle)', border: '1px dashed var(--cp-border)', borderRadius: 'var(--cp-radius-md)' }}>
              <FolderOpen size={28} color="var(--cp-text-tertiary)" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>No Evidence Registered</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--cp-text-secondary)', marginTop: 2 }}>
                Register evidence in this case before verifying file integrity.
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)', marginBottom: 4 }}>
                  Target Evidence Record
                </label>
                <select
                  value={selectedEvidenceId}
                  onChange={(e) => {
                    setSelectedEvidenceId(e.target.value);
                    setComputedHash(null);
                    setTestFile(null);
                  }}
                  style={{ width: '100%' }}
                >
                  {evidenceList.map((item) => (
                    <option key={item.evidenceId} value={item.evidenceId}>
                      {item.evidenceId} — {item.fileName}
                    </option>
                  ))}
                </select>
              </div>

              {/* On-Chain Reference Digest Display */}
              <div style={{ background: 'var(--cp-surface-subtle)', border: '1px solid var(--cp-border)', padding: 12, borderRadius: 'var(--cp-radius-md)', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Reference Digest from EvidenceRegistry.sol:
                  </div>
                  {fetchingContract && <Loader2 size={12} className="cp-spin" color="var(--cp-teal)" />}
                </div>
                <div className="mono" style={{ fontSize: '0.75rem', wordBreak: 'break-all', marginTop: 4, color: 'var(--cp-text-primary)' }}>
                  {onChainDigest ? `0x${onChainDigest}` : 'Reading on-chain slot...'}
                </div>
                {targetRecord && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-secondary)', marginTop: 4 }}>
                    Artifact: {targetRecord.fileName} • CID: {targetRecord.ipfsCid}
                  </div>
                )}
                {chainReadError && (
                  <div className="cp-notice cp-notice--warning" style={{ marginTop: 8 }}>
                    On-chain record unavailable: {chainReadError}
                  </div>
                )}
              </div>

              {/* Candidate File Picker */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)', marginBottom: 4 }}>
                  Select Candidate File to Audit
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
                    {testFile ? testFile.name : 'Select file to compute candidate SHA-256'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-tertiary)', marginTop: 2 }}>
                    Exact raw bytes will be read and verified in browser memory
                  </div>
                  <input
                    type="file"
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
                  <span>Computing SHA-256 over candidate bytes...</span>
                </div>
              )}
              {hashError && (
                <div className="cp-notice cp-notice--warning">{hashError}</div>
              )}
            </>
          )}
        </div>

        {/* Verification Verdict Box */}
        <div>
          <div className="cp-card">
            <h3 className="cp-card__title">Verification Outcome</h3>
            <p className="cp-card__desc">Bit-for-bit comparison between candidate file bytes and contract state.</p>

            {!computedHash ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--cp-text-tertiary)' }}>
                <FileSearch size={32} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                <div style={{ fontSize: '0.8125rem' }}>Awaiting candidate file selection</div>
              </div>
            ) : chainReadError ? (
              <div className="cp-notice cp-notice--warning">
                Cannot verify against blockchain state: {chainReadError}
              </div>
            ) : fetchingContract || !onChainDigest ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--cp-text-tertiary)' }}>
                <Loader2 size={20} className="cp-spin" style={{ margin: '0 auto 6px' }} />
                <div style={{ fontSize: '0.8125rem' }}>Waiting for the authoritative on-chain digest...</div>
              </div>
            ) : isMatch ? (
              <div style={{ background: 'var(--cp-verified-bg)', border: '1px solid var(--cp-verified-border)', borderRadius: 'var(--cp-radius-md)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CheckCircle2 size={22} color="var(--cp-verified-text)" />
                  <div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--cp-verified-text)' }}>
                      MATCH — Integrity Confirmed
                    </h4>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--cp-verified-text)' }}>0 bitwise discrepancies detected</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--cp-verified-text)', lineHeight: 1.5, marginBottom: 12 }}>
                  The candidate file bytes match the SHA-256 digest recorded in <code>EvidenceRegistry.sol</code>.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.6875rem' }}>
                  <div>
                    <strong>On-Chain Reference:</strong>
                    <div className="mono" style={{ wordBreak: 'break-all' }}>{onChainDigest}</div>
                  </div>
                  <div>
                    <strong>Candidate Digest:</strong>
                    <div className="mono" style={{ wordBreak: 'break-all' }}>{computedHash}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--cp-tamper-bg)', border: '1px solid var(--cp-tamper-border)', borderRadius: 'var(--cp-radius-md)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <XCircle size={22} color="var(--cp-tamper-text)" />
                  <div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--cp-tamper-text)' }}>
                      MISMATCH — Discrepancy Detected
                    </h4>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--cp-tamper-text)' }}>Candidate digest differs from on-chain storage</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--cp-tamper-text)', lineHeight: 1.5, marginBottom: 12 }}>
                  The candidate file differs from the registered artifact. A single modified bit alters the entire SHA-256 digest string.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.6875rem' }}>
                  <div>
                    <strong>On-Chain Reference:</strong>
                    <div className="mono" style={{ wordBreak: 'break-all' }}>{onChainDigest}</div>
                  </div>
                  <div>
                    <strong>Candidate Digest:</strong>
                    <div className="mono" style={{ wordBreak: 'break-all' }}>{computedHash}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legal Scope Disclaimer */}
          <div className="cp-notice cp-notice--info">
            <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Integrity Scope:</strong> A <code>MATCH</code> confirms that the selected file is identical to the payload registered at the recorded timestamp. It does not certify the authenticity of the file prior to registration or guarantee judicial admissibility.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
