import { ObjectId } from 'mongodb';

export interface CaseDocument {
  _id?: ObjectId;
  caseRef: string; // e.g. "CASE-CR-2026-88"
  title: string;   // e.g. "Port Facility Perimeter Incident"
  description?: string;
  leadInvestigator?: string;
  passwordHash: string; // bcrypt hash
  status: 'active' | 'archived' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseEvidenceAssociation {
  _id?: ObjectId;
  caseId: string;       // caseRef string
  evidenceId: string;   // on-chain evidenceId
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256: string;
  ipfsCid: string;
  associatedBy?: string; // wallet address or session
  associatedAt: Date;
}

export interface AccessAuditLog {
  _id?: ObjectId;
  caseRef: string;
  action: 'search' | 'login_success' | 'login_failed' | 'logout' | 'evidence_registered' | 'custody_transferred';
  ipAddress?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}
