import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  KeyRound, 
  Shield, 
  Lock, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  FolderOpen,
  Eye,
  EyeOff
} from 'lucide-react';
import { ChainProofLogo } from '../components/ChainProofLogo';
import { api, type PublicCaseItem } from '../services/api';
import { useCase } from '../context/CaseContext';

const demoCaseOptions = [
  {
    caseRef: 'CASE-CR-2026-88',
    title: 'Port Facility Security Perimeter Incident',
  },
  {
    caseRef: 'CASE-CYBER-2026-14',
    title: 'Exfiltrated Corporate Data Media Acquisition',
  },
];

export function Landing() {
  const navigate = useNavigate();
  const { login } = useCase();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PublicCaseItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected case & password state
  const [selectedCase, setSelectedCase] = useState<PublicCaseItem | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // New case creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    caseRef: '',
    title: '',
    description: '',
    leadInvestigator: '',
    password: '',
    confirmPassword: '',
  });
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setSelectedCase(null);
    setPassword('');
    setAuthError(null);

    try {
      const results = await api.searchCases(searchQuery);
      setSearchResults(results);
    } catch (err) {
      setSearchError((err as Error).message || 'Case search service is currently unavailable.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleDemoCaseClick = useCallback(async (caseRef: string) => {
    setSearchQuery(caseRef);
    setSelectedCase(null);
    setPassword('');
    setAuthError(null);
    setHasSearched(true);
    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await api.searchCases(caseRef);
      setSearchResults(results);
      const exactMatch = results.find((item) => item.caseRef.toUpperCase() === caseRef.toUpperCase());
      if (exactMatch) {
        setSelectedCase(exactMatch);
      }
    } catch (err) {
      setSearchError((err as Error).message || 'Case search service is currently unavailable.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleAuthenticate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !password) return;

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const result = await api.authenticateCase(selectedCase.caseRef, password);
      login(selectedCase.caseRef, result.token, result.case);
      navigate(`/workspace/${encodeURIComponent(selectedCase.caseRef)}`);
    } catch (err) {
      setAuthError((err as Error).message || 'Authentication failed. Please verify case identifier and access password.');
    } finally {
      setIsAuthenticating(false);
    }
  }, [selectedCase, password, login, navigate]);

  const handleCreateCase = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.caseRef.trim() || !createForm.title.trim() || !createForm.password.trim()) {
      setCreateError('Case reference, title, and password are required.');
      return;
    }

    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('Password confirmation does not match.');
      return;
    }

    setIsCreatingCase(true);
    setCreateError(null);

    try {
      const result = await api.createCase({
        caseRef: createForm.caseRef,
        title: createForm.title,
        description: createForm.description,
        leadInvestigator: createForm.leadInvestigator,
        password: createForm.password,
        confirmPassword: createForm.confirmPassword,
      });

      setSelectedCase(null);
      setPassword('');
      login(result.case.caseRef, result.token, result.case);
      navigate(`/workspace/${encodeURIComponent(result.case.caseRef)}`);
    } catch (err) {
      setCreateError((err as Error).message || 'Unable to create the case.');
    } finally {
      setIsCreatingCase(false);
    }
  }, [createForm, login, navigate]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cp-canvas)', display: 'flex', flexDirection: 'column' }}>
      {/* Precision Forensic Header */}
      <header style={{ background: 'var(--cp-navy)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChainProofLogo size={28} color="#FFFFFF" />
            <div>
              <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>
                ChainProof
              </div>
              <div style={{ color: '#94A3B8', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Digital Evidence & Custody Management
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: '0.75rem' }}>
            <Shield size={14} color="var(--cp-teal-border)" />
            <span>Restricted Investigation Access</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Entry Container */}
      <main style={{ flex: 1, maxWidth: 840, width: '100%', margin: '40px auto', padding: '0 20px' }}>
        {/* Concise Educational Banner */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cp-teal)', marginBottom: 6 }}>
            Evidence Integrity Verification System
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--cp-text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Case Evidence Access Portal
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--cp-text-secondary)', lineHeight: 1.6 }}>
            Access to evidence portfolios and chain-of-custody ledgers is strictly scoped by case reference. Enter a registered case identifier to verify authorization and enter the workspace.
          </p>
        </div>

        {/* Case Access Card */}
        <div className="cp-card" style={{ padding: 28, boxShadow: 'var(--cp-shadow-card)', marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--cp-text-primary)', marginBottom: 4 }}>
            Case Verification & Access
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--cp-text-secondary)', marginBottom: 20 }}>
            Search for an active investigative case (e.g., <code>CASE-CR-2026-88</code> or <code>CASE-CYBER-2026-14</code>).
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--cp-text-tertiary)' }} />
              <input
                type="text"
                placeholder="Enter Case Reference ID (e.g. CASE-CR-2026-88)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <button type="submit" disabled={isSearching || !searchQuery.trim()} className="cp-btn cp-btn--primary">
              {isSearching ? <Loader2 size={15} className="cp-spin" /> : <Search size={15} />}
              <span>Search Case</span>
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
            <button
              type="button"
              className="cp-btn cp-btn--secondary"
              onClick={() => {
                setShowCreateForm((current) => !current);
                setCreateError(null);
              }}
            >
              <span>{showCreateForm ? 'Hide' : 'Create New Case'}</span>
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateCase} style={{ display: 'grid', gap: 12, padding: '18px 0 6px', borderTop: '1px solid var(--cp-border)', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Case Reference</span>
                  <input
                    value={createForm.caseRef}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, caseRef: e.target.value }))}
                    placeholder="CASE-CR-2026-88"
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Case Title</span>
                  <input
                    value={createForm.title}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Port Facility Security Perimeter Incident"
                  />
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Case Description</span>
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Short, non-sensitive description of the investigation context."
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Lead Investigator / Team</span>
                <input
                  value={createForm.leadInvestigator}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, leadInvestigator: e.target.value }))}
                  placeholder="Det. Sarah Lin"
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Case Password</span>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Minimum 8 characters"
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Confirm Password</span>
                  <input
                    type="password"
                    value={createForm.confirmPassword}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Repeat password"
                  />
                </label>
              </div>

              {createError && (
                <div className="cp-notice cp-notice--warning" style={{ margin: 0 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{createError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="cp-btn cp-btn--secondary" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={isCreatingCase} className="cp-btn cp-btn--primary">
                  {isCreatingCase ? <Loader2 size={14} className="cp-spin" /> : <Lock size={14} />}
                  <span>Create Case</span>
                </button>
              </div>
            </form>
          )}

          {!selectedCase && !showCreateForm && (
            <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--cp-surface-subtle)', border: '1px solid var(--cp-border)', borderRadius: 'var(--cp-radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--cp-text-tertiary)' }}>
                  Provisioned Demo Cases
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-secondary)' }}>
                  Select a local sample case to test the access workflow.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {demoCaseOptions.map((demoCase) => (
                  <button
                    key={demoCase.caseRef}
                    type="button"
                    onClick={() => handleDemoCaseClick(demoCase.caseRef)}
                    className="cp-btn cp-btn--secondary"
                    style={{
                      justifyContent: 'space-between',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{demoCase.caseRef}</span>
                    <span style={{ opacity: 0.8, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {demoCase.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search feedback & results */}
          {searchError && (
            <div className="cp-notice cp-notice--warning">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{searchError}</span>
            </div>
          )}

          {hasSearched && !isSearching && searchResults.length === 0 && !searchError && (
            <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--cp-surface-subtle)', border: '1px dashed var(--cp-border)', borderRadius: 'var(--cp-radius-md)' }}>
              <FolderOpen size={28} color="var(--cp-text-tertiary)" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>No Matching Case Found</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--cp-text-secondary)', marginTop: 2 }}>
                Verify the exact case reference code. Only provisioned active cases are indexed.
              </div>
            </div>
          )}

          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--cp-text-tertiary)' }}>
                Matching Registered Cases
              </div>
              {searchResults.map((item) => {
                const isSelected = selectedCase?.caseRef === item.caseRef;
                return (
                  <div
                    key={item.caseRef}
                    onClick={() => {
                      setSelectedCase(item);
                      setPassword('');
                      setAuthError(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 'var(--cp-radius-md)',
                      border: isSelected ? '1px solid var(--cp-teal)' : '1px solid var(--cp-border)',
                      background: isSelected ? 'var(--cp-teal-light)' : 'var(--cp-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: 'var(--cp-text-primary)', fontSize: '0.875rem' }}>
                          {item.caseRef}
                        </span>
                        <span className="cp-badge cp-badge--info">{item.status}</span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--cp-text-secondary)', marginTop: 2 }}>
                        {item.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`cp-btn ${isSelected ? 'cp-btn--primary' : 'cp-btn--secondary'}`}
                      style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                    >
                      <span>{isSelected ? 'Selected' : 'Select'}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Password Entry Prompt */}
          {selectedCase && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--cp-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <KeyRound size={16} color="var(--cp-teal)" />
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--cp-text-primary)' }}>
                  Enter Password for {selectedCase.caseRef}
                </h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--cp-text-secondary)', marginBottom: 14 }}>
                Enter the authorized investigator credentials provisioned for this case portfolio.
              </p>

              <form onSubmit={handleAuthenticate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Case Access Password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', paddingRight: 36 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: 8,
                      background: 'none',
                      border: 'none',
                      color: 'var(--cp-text-tertiary)',
                      cursor: 'pointer'
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {authError && (
                  <div className="cp-notice cp-notice--warning" style={{ margin: 0 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{authError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    className="cp-btn cp-btn--secondary"
                    onClick={() => {
                      setSelectedCase(null);
                      setPassword('');
                      setAuthError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAuthenticating || !password}
                    className="cp-btn cp-btn--primary"
                  >
                    {isAuthenticating ? <Loader2 size={14} className="cp-spin" /> : <Lock size={14} />}
                    <span>Open Case Workspace</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Security & Architecture Boundary Notice */}
        <div className="cp-notice cp-notice--info">
          <Shield size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Forensic Platform Governance:</strong>
            <div style={{ fontSize: '0.75rem', marginTop: 4, lineHeight: 1.5 }}>
              • <strong>Role Separation:</strong> Case access is validated server-side via MongoDB. Blockchain transactions require explicit cryptographic approval via connected MetaMask signer.
              <br />
              • <strong>Public IPFS Advisory:</strong> IPFS CIDs stored on public networks are accessible by identifier. Do not upload classified real-world evidence to public decentralized nodes.
            </div>
          </div>
        </div>
      </main>

      {/* Workstation Footer */}
      <footer style={{ borderTop: '1px solid var(--cp-border)', padding: '16px 28px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--cp-text-secondary)', background: 'var(--cp-surface)' }}>
        ChainProof Forensic Workstation • Local Development Sandbox (Anvil Chain ID 31337)
      </footer>
    </div>
  );
}
