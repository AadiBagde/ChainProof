import { API_BASE_URL } from '../config';
import { isPlausibleIpfsCid } from './ipfs';

export interface PublicCaseItem {
  caseRef: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface CaseSessionData {
  caseRef: string;
  title: string;
  status: string;
  description?: string;
  leadInvestigator?: string;
}

export interface OnChainEvidenceItem {
  evidenceId: string;
  caseId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256: string;
  ipfsCid: string;
  associatedAt: string;
  onChainStatus: {
    registered: boolean;
    registrant?: string;
    currentCustodian?: string;
    registeredAt?: number;
    description?: string;
    note?: string;
  };
}

export interface CustodyEventItem {
  type: 'Registration' | 'Transfer';
  from: string;
  to: string;
  timestamp: number;
  initiator?: string;
  txHash: string;
  blockNumber: number;
}

const authHeaders = (token?: string | null) => ({
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const api = {
  searchCases: async (query: string): Promise<PublicCaseItem[]> => {
    if (!query.trim()) return [];
    const res = await fetch(`${API_BASE_URL}/cases/search?q=${encodeURIComponent(query.trim())}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to search cases');
    return data.cases;
  },

  createCase: async (payload: {
    caseRef: string;
    title: string;
    description?: string;
    leadInvestigator?: string;
    password: string;
    confirmPassword: string;
  }): Promise<{ token: string; case: CaseSessionData }> => {
    const res = await fetch(`${API_BASE_URL}/cases/create`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create the case.');
    }
    return { token: data.token, case: data.case };
  },

  authenticateCase: async (caseRef: string, password: string): Promise<{ token: string; case: CaseSessionData }> => {
    const res = await fetch(`${API_BASE_URL}/cases/access`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseRef, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Authentication failed. Please verify case identifier and password.');
    }
    return { token: data.token, case: data.case };
  },

  getSession: async (token: string): Promise<{ success: boolean; session?: { caseRef: string } }> => {
    const res = await fetch(`${API_BASE_URL}/auth/session`, {
      credentials: 'include',
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Session validation failed');
    }
    return data;
  },

  logout: async (token: string): Promise<void> => {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(token),
    });
  },

  getCaseDetails: async (caseRef: string, token: string): Promise<CaseSessionData> => {
    const res = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseRef)}`, {
      credentials: 'include',
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch case details');
    }
    return data.case;
  },

  lockCase: async (token: string): Promise<void> => {
    try {
      await fetch(`${API_BASE_URL}/cases/lock`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(token),
      });
    } catch {
      // Ignored.
    }
  },

  getCaseEvidence: async (caseRef: string, token: string): Promise<OnChainEvidenceItem[]> => {
    const res = await fetch(`${API_BASE_URL}/evidence/${encodeURIComponent(caseRef)}`, {
      credentials: 'include',
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to load case evidence');
    }
    return data.evidence;
  },

  associateEvidence: async (
    payload: {
      evidenceId: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      sha256: string;
      ipfsCid: string;
    },
    token: string
  ): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/evidence/associate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to associate evidence with case');
    }
  },

  uploadEvidenceFile: async (file: File, sha256: string, token: string): Promise<string> => {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('sha256', sha256);
    const res = await fetch(`${API_BASE_URL}/ipfs/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(token),
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || 'IPFS upload failed. No blockchain transaction was submitted.');
    }
    if (!isPlausibleIpfsCid(data.cid)) {
      throw new Error('The IPFS service returned an invalid CID. No blockchain transaction was submitted.');
    }
    return data.cid;
  },

  getCustodyHistory: async (
    caseRef: string,
    evidenceId: string,
    token: string
  ): Promise<{ evidenceId: string; currentCustodian: string | null; history: CustodyEventItem[] }> => {
    const res = await fetch(
      `${API_BASE_URL}/evidence/${encodeURIComponent(caseRef)}/history/${encodeURIComponent(evidenceId)}`,
      {
        credentials: 'include',
        headers: authHeaders(token),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to load custody history');
    }
    return data;
  },

  getHealth: async () => {
    const res = await fetch(`${API_BASE_URL}/health`, { credentials: 'include' });
    return await res.json();
  },
};