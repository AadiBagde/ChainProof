import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, type CaseSessionData } from '../services/api';

interface CaseContextType {
  caseData: CaseSessionData | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (caseRef: string, token: string, data: CaseSessionData) => void;
  lockCase: () => void;
  clearSession: () => void;
}

const CaseContext = createContext<CaseContextType | null>(null);

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('cp_session_token'));
  const [caseData, setCaseData] = useState<CaseSessionData | null>(() => {
    const cached = sessionStorage.getItem('cp_case_data');
    return cached ? JSON.parse(cached) : null;
  });

  const clearSession = useCallback(() => {
    sessionStorage.removeItem('cp_session_token');
    sessionStorage.removeItem('cp_case_data');
    setToken(null);
    setCaseData(null);
  }, []);

  useEffect(() => {
    const currentToken = sessionStorage.getItem('cp_session_token');
    if (!currentToken) {
      return;
    }

    api.getSession(currentToken)
      .then(() => {
        const cached = sessionStorage.getItem('cp_case_data');
        if (cached) {
          setCaseData(JSON.parse(cached));
        }
      })
      .catch(() => {
        clearSession();
      });
  }, [clearSession]);

  const login = useCallback((_caseRef: string, sessionToken: string, data: CaseSessionData) => {
    sessionStorage.setItem('cp_session_token', sessionToken);
    sessionStorage.setItem('cp_case_data', JSON.stringify(data));
    setToken(sessionToken);
    setCaseData(data);
  }, []);

  const lockCase = useCallback(async () => {
    if (token) {
      try {
        await api.lockCase(token);
      } catch {
        // Ignore backend lock failures; the local session still needs to be invalidated.
      }
    }
    clearSession();
  }, [clearSession, token]);

  return (
    <CaseContext.Provider
      value={{
        caseData,
        token,
        isAuthenticated: !!token && !!caseData,
        login,
        lockCase,
        clearSession,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
}

export function useCase() {
  const ctx = useContext(CaseContext);
  if (!ctx) {
    throw new Error('useCase must be used within a CaseProvider');
  }
  return ctx;
}