/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_EVIDENCE_REGISTRY_ADDRESS?: string;
  readonly VITE_EVIDENCE_REGISTRY?: string;
  readonly VITE_CUSTODY_MANAGER_ADDRESS?: string;
  readonly VITE_CUSTODY_MANAGER?: string;
}

interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    providers?: Window['ethereum'][];
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  };
}
