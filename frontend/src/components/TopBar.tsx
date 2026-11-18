import { useState } from 'react';
import { MetaMaskLogo } from './MetaMaskLogo';
import { AddressDisplay } from './Shared';
import { ChevronDown, LogOut, Lock, AlertTriangle } from 'lucide-react';
import { useCase } from '../context/CaseContext';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  currentRouteTitle?: string;
  activeAccount: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  onConnectWallet: () => void;
  onSwitchNetwork: () => void;
  onDisconnectWallet: () => void;
}

export function TopBar({ 
  currentRouteTitle = 'Case Workspace', 
  activeAccount, 
  chainId,
  isCorrectNetwork,
  onConnectWallet,
  onSwitchNetwork,
  onDisconnectWallet
}: TopBarProps) {
  const { caseData, lockCase } = useCase();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLockWorkspace = () => {
    lockCase();
    navigate('/');
  };

  return (
    <header className="cp-topbar">
      {/* Active Case Context & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--cp-teal)', letterSpacing: '0.04em' }}>
              {caseData ? caseData.caseRef : 'AUTHENTICATED CASE'}
            </span>
            {caseData && <span className="cp-badge cp-badge--info">{caseData.status}</span>}
          </div>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--cp-text-primary)' }}>
            {currentRouteTitle}
          </h2>
        </div>
      </div>

      {/* Right Controls: Lock, Network Status, MetaMask Signer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Network Status Badge */}
        {activeAccount && !isCorrectNetwork ? (
          <button 
            onClick={onSwitchNetwork}
            className="cp-btn cp-btn--secondary"
            style={{ 
              background: 'var(--cp-warning-bg)', 
              borderColor: 'var(--cp-warning-border)', 
              color: 'var(--cp-warning-text)',
              padding: '4px 8px',
              fontSize: '0.75rem',
              gap: 4
            }}
            title="Click to switch MetaMask to local Anvil (31337)"
          >
            <AlertTriangle size={13} />
            <span>Switch to Anvil (31337)</span>
          </button>
        ) : (
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6, 
              padding: '3px 8px', 
              background: 'var(--cp-surface-subtle)', 
              border: '1px solid var(--cp-border)', 
              borderRadius: 'var(--cp-radius-sm)',
              fontSize: '0.6875rem',
              color: 'var(--cp-text-secondary)'
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeAccount && isCorrectNetwork ? 'var(--cp-verified-text)' : 'var(--cp-text-tertiary)' }} />
            <span>Anvil 31337</span>
          </div>
        )}

        {/* Lock Case Button */}
        <button
          onClick={handleLockWorkspace}
          className="cp-btn cp-btn--secondary"
          style={{ padding: '5px 10px', fontSize: '0.75rem', gap: 5 }}
          title="Invalidate session and lock case workspace"
        >
          <Lock size={13} color="var(--cp-warning-text)" />
          <span>Lock Case</span>
        </button>

        {/* MetaMask Signer Integration */}
        {activeAccount ? (
          <div style={{ position: 'relative' }}>
            <button 
              className="cp-btn cp-btn--secondary"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ padding: '5px 10px', gap: 6, fontSize: '0.75rem' }}
              aria-label="Wallet menu"
            >
              <MetaMaskLogo size={16} />
              <span className="mono">{activeAccount.slice(0, 6)}…{activeAccount.slice(-4)}</span>
              <ChevronDown size={12} />
            </button>

            {isDropdownOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  background: 'var(--cp-surface)',
                  border: '1px solid var(--cp-border)',
                  borderRadius: 'var(--cp-radius-md)',
                  boxShadow: 'var(--cp-shadow-dropdown)',
                  padding: 12,
                  minWidth: 240,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  zIndex: 50
                }}
              >
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Connected Signer
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <AddressDisplay address={activeAccount} />
                  </div>
                </div>

                <div style={{ fontSize: '0.6875rem', color: 'var(--cp-text-secondary)', borderTop: '1px solid var(--cp-border)', paddingTop: 6 }}>
                  Chain ID: <code className="mono">{chainId || '31337'}</code>
                </div>

                <button 
                  onClick={() => {
                    onDisconnectWallet();
                    setIsDropdownOpen(false);
                  }}
                  className="cp-btn cp-btn--secondary"
                  style={{ 
                    marginTop: 4, 
                    fontSize: '0.6875rem', 
                    padding: '4px 8px',
                    color: 'var(--cp-tamper-text)',
                    borderColor: 'var(--cp-tamper-border)'
                  }}
                >
                  <LogOut size={12} />
                  <span>Disconnect from App</span>
                </button>
                <div style={{ fontSize: '0.625rem', color: 'var(--cp-text-tertiary)', lineHeight: 1.3 }}>
                  * Disconnecting the frontend does not revoke MetaMask browser permissions.
                </div>
              </div>
            )}
          </div>
        ) : (
          <button 
            className="cp-btn cp-btn--primary"
            onClick={onConnectWallet}
            style={{ padding: '5px 12px', fontSize: '0.75rem', gap: 6 }}
            title="Connect MetaMask to execute verified smart contract transactions"
          >
            <MetaMaskLogo size={16} />
            <span>Connect Wallet</span>
          </button>
        )}
      </div>
    </header>
  );
}
