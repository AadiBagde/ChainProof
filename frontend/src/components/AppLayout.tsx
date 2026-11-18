import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, Navigate, useParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useCase } from '../context/CaseContext';
import { ANVIL_CHAIN_ID, API_BASE_URL } from '../config';
import { getInjectedProvider } from '../services/chain';

export function AppLayout() {
  const { isAuthenticated, caseData, token, clearSession } = useCase();
  const { caseId } = useParams();
  const location = useLocation();

  // EIP-1193 MetaMask Wallet State
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [ethereum, setEthereum] = useState<Window['ethereum']>(() => getInjectedProvider());
  const [walletError, setWalletError] = useState<string | null>(null);

  // MetaMask can announce itself through EIP-6963, particularly when other wallets are installed.
  useEffect(() => {
    const announceProvider = (event: Event) => {
      const detail = (event as CustomEvent<{ info?: { rdns?: string }; provider?: Window['ethereum'] }>).detail;
      if (detail?.info?.rdns === 'io.metamask' && detail.provider) {
        setEthereum(detail.provider);
        setWalletError(null);
      }
    };
    const handleInitialized = () => {
      const provider = getInjectedProvider();
      if (provider) setEthereum(provider);
    };

    window.addEventListener('eip6963:announceProvider', announceProvider);
    window.addEventListener('ethereum#initialized', handleInitialized);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    return () => {
      window.removeEventListener('eip6963:announceProvider', announceProvider);
      window.removeEventListener('ethereum#initialized', handleInitialized);
    };
  }, []);

  useEffect(() => {
    if (!ethereum) return;

    let isMounted = true;
    const handleAccountsChanged = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? accounts : [];
      setActiveAccount(typeof list[0] === 'string' ? list[0] : null);
    };
    const handleChainChanged = (cidHex: unknown) => {
      if (typeof cidHex === 'string') setChainId(Number.parseInt(cidHex, 16));
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);
    ethereum.request({ method: 'eth_accounts' })
      .then(handleAccountsChanged)
      .catch((err: unknown) => {
        if (isMounted) setWalletError(err instanceof Error ? err.message : 'Could not read wallet accounts.');
      });
    ethereum.request({ method: 'eth_chainId' })
      .then(handleChainChanged)
      .catch((err: unknown) => {
        if (isMounted) setWalletError(err instanceof Error ? err.message : 'Could not read the wallet network.');
      });

    return () => {
      isMounted = false;
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [ethereum]);

  const handleConnectWallet = useCallback(async () => {
    if (!ethereum) {
      setWalletError('MetaMask was not detected in this browser tab. Open this app directly in Edge at its localhost URL, enable MetaMask for this site in edge://extensions, then reload the page.');
      return;
    }
    try {
      setWalletError(null);
      const accounts: unknown = await ethereum.request({ method: 'eth_requestAccounts' });
      if (Array.isArray(accounts) && typeof accounts[0] === 'string') {
        setActiveAccount(accounts[0]);
        const cidHex: unknown = await ethereum.request({ method: 'eth_chainId' });
        if (typeof cidHex === 'string') setChainId(Number.parseInt(cidHex, 16));
      } else {
        setWalletError('MetaMask returned no accounts. Unlock the wallet and allow this site to connect.');
      }
    } catch (err) {
      const error = err as { code?: number; message?: string };
      if (error.code === 4001) {
        setWalletError('Wallet connection was rejected in MetaMask. Click Connect Wallet and approve the request to continue.');
      } else {
        setWalletError(error.message || 'Could not connect to MetaMask. Unlock the extension and reload this page.');
      }
    }
  }, [ethereum]);

  const handleSwitchNetwork = useCallback(async () => {
    if (!ethereum) {
      setWalletError('MetaMask was not detected in this browser tab. Enable the extension for this site and reload.');
      return;
    }

    const anvilHex = '0x' + ANVIL_CHAIN_ID.toString(16);
    try {
      setWalletError(null);
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: anvilHex }],
      });
    } catch (switchError) {
      const error = switchError as { code?: number; message?: string };
      // Chain not added to MetaMask: prompt to add Anvil RPC
      if (error.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: anvilHex,
              chainName: 'Anvil Localnet',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['http://127.0.0.1:8545'],
            }],
          });
        } catch (addError) {
          const message = addError instanceof Error ? addError.message : 'Failed to add Anvil network.';
          setWalletError(message);
        }
      } else {
        setWalletError(error.code === 4001
          ? 'Network switch was rejected in MetaMask.'
          : error.message || 'Could not switch MetaMask to Anvil Localnet.');
      }
    }
  }, [ethereum]);

  const handleDisconnectWallet = useCallback(() => {
    setActiveAccount(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !caseData || !token) return;

    let isMounted = true;
    const validateSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseData.caseRef)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok && (response.status === 401 || response.status === 403)) {
          if (isMounted) {
            clearSession();
          }
        }
      } catch {
        if (isMounted) {
          clearSession();
        }
      }
    };

    validateSession();
    return () => {
      isMounted = false;
    };
  }, [caseData, clearSession, isAuthenticated, token]);

  // Authorization Guard: redirect unauthenticated visitors directly to landing page
  if (!isAuthenticated || !caseData) {
    return <Navigate to="/" replace />;
  }

  // Mismatched Case ID protection
  if (caseId && caseId.toUpperCase() !== caseData.caseRef.toUpperCase()) {
    return <Navigate to={`/workspace/${encodeURIComponent(caseData.caseRef)}`} replace />;
  }

  const getRouteTitle = () => {
    const path = location.pathname;
    if (path.endsWith('/evidence')) return 'Evidence Catalog';
    if (path.endsWith('/register')) return 'Register Evidence';
    if (path.endsWith('/verify')) return 'Integrity Verification';
    if (path.endsWith('/custody')) return 'Chain of Custody';
    if (path.endsWith('/reports')) return 'Audit Certificate';
    return 'Case Overview';
  };

  const isCorrectNetwork = chainId === ANVIL_CHAIN_ID;
  const hasMetaMask = Boolean(ethereum);

  const walletStatus = walletError
    ? { tone: 'warning', message: walletError }
    : !hasMetaMask
    ? {
        tone: 'warning',
        message: 'Waiting for MetaMask in this browser tab. If installed, enable it for this site and reload the page.',
      }
    : !activeAccount
      ? {
          tone: 'info',
          message: 'No signer is connected yet. Connect MetaMask to submit on-chain registration or transfer transactions.',
        }
      : !isCorrectNetwork
        ? {
            tone: 'warning',
            message: 'MetaMask is connected to a different network. Switch to Anvil Localnet (31337) before transacting.',
          }
        : {
            tone: 'success',
            message: 'MetaMask signer is connected and verified on Anvil Localnet (31337).',
          };

  return (
    <div className="cp-shell">
      <Sidebar />
      <div className="cp-shell__main">
        <TopBar 
          currentRouteTitle={getRouteTitle()} 
          activeAccount={activeAccount}
          chainId={chainId}
          isCorrectNetwork={isCorrectNetwork}
          onConnectWallet={handleConnectWallet}
          onSwitchNetwork={handleSwitchNetwork}
          onDisconnectWallet={handleDisconnectWallet}
        />
        <div style={{ padding: '12px 16px 0' }}>
          <div
            className={walletStatus.tone === 'warning' ? 'cp-notice cp-notice--warning' : 'cp-notice cp-notice--info'}
            style={walletStatus.tone === 'success' ? {
              margin: 0,
              background: 'var(--cp-verified-bg)',
              border: '1px solid var(--cp-verified-border)',
              color: 'var(--cp-verified-text)',
            } : { margin: 0 }}
          >
            <span style={{ fontWeight: 700, marginRight: 6 }}>Wallet Status:</span>
            {walletStatus.message}
          </div>
        </div>
        <main className="cp-shell__content">
          <Outlet context={{ activeAccount, isCorrectNetwork, ethereum, handleConnectWallet, handleSwitchNetwork }} />
        </main>
      </div>
    </div>
  );
}
