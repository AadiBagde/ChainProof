import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

export interface CaseSessionPayload {
  caseRef: string;
  caseTitle: string;
  authenticatedAt: number;
}

export function generateSessionToken(payload: CaseSessionPayload): string {
  return jwt.sign(payload, config.sessionSecret, {
    expiresIn: '8h',
  });
}

export function verifySessionToken(token: string): CaseSessionPayload | null {
  try {
    const decoded = jwt.verify(token, config.sessionSecret) as CaseSessionPayload;
    return decoded;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  caseSession?: CaseSessionPayload;
}

export function getRequestSessionToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const rawCookies = req.headers.cookie;
  if (!rawCookies) {
    return undefined;
  }

  for (const entry of rawCookies.split(';')) {
    const trimmedEntry = entry.trim();
    if (!trimmedEntry) continue;

    const separatorIndex = trimmedEntry.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmedEntry.slice(0, separatorIndex).trim();
    const value = decodeURIComponent(trimmedEntry.slice(separatorIndex + 1).trim());
    if (key === 'caseSession' || key === 'case_session' || key === 'token') {
      return value || undefined;
    }
  }

  return undefined;
}

export function requireCaseSession(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = getRequestSessionToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. No case session token provided.',
    });
    return;
  }

  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired case session. Please re-authenticate.',
    });
    return;
  }

  const requestedCase = req.params.caseId || req.params.caseRef || req.body?.caseId || req.body?.caseRef;
  if (requestedCase && requestedCase.toUpperCase() !== session.caseRef.toUpperCase()) {
    res.status(403).json({
      success: false,
      error: `Access denied. Active session is for case ${session.caseRef}, not ${requestedCase}.`,
    });
    return;
  }

  req.caseSession = session;
  next();
}
