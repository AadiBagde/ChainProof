import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CaseProvider } from './context/CaseContext';
import { Landing } from './pages/Landing';
import { AppLayout } from './components/AppLayout';
import { Overview } from './pages/Overview';
import { Cases } from './pages/Cases';
import { RegisterEvidence } from './pages/RegisterEvidence';
import { VerifyIntegrity } from './pages/VerifyIntegrity';
import { ChainOfCustody } from './pages/ChainOfCustody';
import { AuditReports } from './pages/AuditReports';
import './index.css';

export default function App() {
  return (
    <CaseProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing & Case Search / Password Access */}
          <Route path="/" element={<Landing />} />

          {/* Authenticated Case Workspace Routes */}
          <Route path="/workspace/:caseId" element={<AppLayout />}>
            <Route index element={<Overview />} />
            <Route path="evidence" element={<Cases />} />
            <Route path="register" element={<RegisterEvidence />} />
            <Route path="verify" element={<VerifyIntegrity />} />
            <Route path="custody" element={<ChainOfCustody />} />
            <Route path="reports" element={<AuditReports />} />
          </Route>

          {/* Redirects */}
          <Route path="/cases" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/verify" element={<Navigate to="/" replace />} />
          <Route path="/custody" element={<Navigate to="/" replace />} />
          <Route path="/reports" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </CaseProvider>
  );
}
