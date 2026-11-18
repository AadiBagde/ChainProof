import { NavLink, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FilePlus, 
  ShieldCheck, 
  Link2, 
  FileText,
  Shield,
  FolderArchive
} from 'lucide-react';
import { ChainProofLogo } from './ChainProofLogo';
import { useCase } from '../context/CaseContext';

export function Sidebar() {
  const { caseId } = useParams();
  const { caseData } = useCase();
  const activeRef = caseId || caseData?.caseRef || '';

  const navItems = [
    { path: `/workspace/${encodeURIComponent(activeRef)}`, label: 'Case Overview', icon: LayoutDashboard, end: true },
    { path: `/workspace/${encodeURIComponent(activeRef)}/evidence`, label: 'Evidence Catalog', icon: FolderArchive, end: false },
    { path: `/workspace/${encodeURIComponent(activeRef)}/register`, label: 'Register Evidence', icon: FilePlus, end: false },
    { path: `/workspace/${encodeURIComponent(activeRef)}/verify`, label: 'Verify Integrity', icon: ShieldCheck, end: false },
    { path: `/workspace/${encodeURIComponent(activeRef)}/custody`, label: 'Chain of Custody', icon: Link2, end: false },
    { path: `/workspace/${encodeURIComponent(activeRef)}/reports`, label: 'Audit Reports', icon: FileText, end: false },
  ];

  return (
    <aside className="cp-sidebar">
      <div className="cp-sidebar__brand">
        <ChainProofLogo size={32} color="#FFFFFF" />
        <div className="cp-sidebar__brand-text">
          <span className="cp-sidebar__brand-title">ChainProof</span>
          <span className="cp-sidebar__brand-subtitle">Forensic Workspace</span>
        </div>
      </div>

      {caseData && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: '#8E99AB', fontWeight: 600 }}>
            Active Case
          </div>
          <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.875rem', marginTop: 2 }}>
            {caseData.caseRef}
          </div>
          <div style={{ color: '#B0BFCF', fontSize: '0.75rem', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {caseData.title}
          </div>
        </div>
      )}

      <nav className="cp-sidebar__nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `cp-sidebar__link ${isActive ? 'cp-sidebar__link--active' : ''}`
              }
              end={item.end}
            >
              <Icon size={18} className="cp-sidebar__link-icon" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="cp-sidebar__footer">
        <div className="cp-sidebar__env-badge">
          <Shield size={14} />
          <span>Anvil Sandbox (31337)</span>
        </div>
        <p className="cp-sidebar__disclaimer">
          Session authorized for {activeRef || 'active case'}.
        </p>
      </div>
    </aside>
  );
}
