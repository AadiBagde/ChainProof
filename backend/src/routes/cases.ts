import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db.js';
import { CaseDocument, AccessAuditLog } from '../models.js';
import { generateSessionToken, requireCaseSession, AuthenticatedRequest } from '../auth.js';
import { caseAccessBody, caseCreateBody, caseSearchQuery, escapeRegex } from '../validation.js';

export const caseRouter = express.Router();

const GENERIC_AUTH_ERROR =
  'Authentication failed. Please verify the case identifier and access password.';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const caseCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: {
    success: false,
    error: 'Too many case creation attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

async function createCaseRecord(req: Request, res: Response) {
  try {
    const parsed = caseCreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid case details. Check the case reference, title, and password requirements.',
      });
      return;
    }

    const { caseRef, title, description, leadInvestigator, password } = parsed.data;
    const cleanRef = caseRef.trim().toUpperCase();
    const db = getDb();
    const casesCol = db.collection<CaseDocument>('cases');

    const existing = await casesCol.findOne({ caseRef: cleanRef });
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'A case with that reference already exists. Choose a different case identifier.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const createdCase: CaseDocument = {
      caseRef: cleanRef,
      title: title.trim(),
      description: description?.trim() || 'Digital forensics case workspace.',
      leadInvestigator: leadInvestigator?.trim() || 'Assigned investigator',
      passwordHash,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await casesCol.insertOne(createdCase);

    const token = generateSessionToken({
      caseRef: cleanRef,
      caseTitle: createdCase.title,
      authenticatedAt: Date.now(),
    });

    res.status(201).json({
      success: true,
      token,
      case: {
        caseRef: cleanRef,
        title: createdCase.title,
        status: createdCase.status,
        description: createdCase.description,
        leadInvestigator: createdCase.leadInvestigator,
      },
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Unable to create the case at this time.',
    });
  }
}

async function authenticateCase(req: Request, res: Response) {
  try {
    const parsed = caseAccessBody.safeParse({
      ...req.body,
      caseRef: req.params.caseRef || req.body.caseRef,
    });

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request: case reference and password are required.',
      });
      return;
    }

    const { caseRef, password } = parsed.data;
    const db = getDb();
    const casesCol = db.collection<CaseDocument>('cases');
    const auditCol = db.collection<AccessAuditLog>('access_audit');
    const cleanRef = caseRef.trim().toUpperCase();
    const targetCase = await casesCol.findOne({ caseRef: cleanRef });

    if (!targetCase) {
      res.status(401).json({ success: false, error: GENERIC_AUTH_ERROR });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, targetCase.passwordHash);
    if (!passwordMatch) {
      await auditCol.insertOne({
        caseRef: cleanRef,
        action: 'login_failed',
        ipAddress: req.ip,
        timestamp: new Date(),
      });
      res.status(401).json({ success: false, error: GENERIC_AUTH_ERROR });
      return;
    }

    await auditCol.insertOne({
      caseRef: cleanRef,
      action: 'login_success',
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    const token = generateSessionToken({
      caseRef: targetCase.caseRef,
      caseTitle: targetCase.title,
      authenticatedAt: Date.now(),
    });

    res.json({
      success: true,
      token,
      case: {
        caseRef: targetCase.caseRef,
        title: targetCase.title,
        status: targetCase.status,
        description: targetCase.description,
        leadInvestigator: targetCase.leadInvestigator,
      },
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred during case authentication.',
    });
  }
}

caseRouter.post('/', caseCreateLimiter, createCaseRecord);
caseRouter.post('/create', caseCreateLimiter, createCaseRecord);

caseRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const parsed = caseSearchQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid search query.' });
      return;
    }

    const queryValue = parsed.data.q || '';
    if (!queryValue) {
      res.json({ success: true, cases: [] });
      return;
    }

    const db = getDb();
    const casesCol = db.collection<CaseDocument>('cases');
    const escaped = escapeRegex(queryValue.trim());

    const matches = await casesCol
      .find({ caseRef: { $regex: `^${escaped}`, $options: 'i' } })
      .project<Pick<CaseDocument, 'caseRef' | 'title' | 'status' | 'createdAt'>>({
        caseRef: 1,
        title: 1,
        status: 1,
        createdAt: 1,
      })
      .limit(8)
      .toArray();

    res.json({
      success: true,
      cases: matches.map((c) => ({
        caseRef: c.caseRef,
        title: c.title,
        status: c.status,
        createdAt: c.createdAt,
      })),
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Case search is temporarily unavailable.',
    });
  }
});

caseRouter.post('/access', authLimiter, authenticateCase);
caseRouter.post('/:caseRef/access', authLimiter, authenticateCase);

caseRouter.post('/lock', requireCaseSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.caseSession) {
      const db = getDb();
      const auditCol = db.collection<AccessAuditLog>('access_audit');
      await auditCol.insertOne({
        caseRef: req.caseSession.caseRef,
        action: 'logout',
        ipAddress: req.ip,
        timestamp: new Date(),
      });
    }
    res.setHeader('Set-Cookie', 'caseSession=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    res.json({ success: true, message: 'Case session locked.' });
  } catch {
    res.setHeader('Set-Cookie', 'caseSession=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    res.json({ success: true, message: 'Case session locked.' });
  }
});

caseRouter.get('/:caseId', requireCaseSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseRef = req.params.caseId.toUpperCase();
    const db = getDb();
    const casesCol = db.collection<CaseDocument>('cases');
    const targetCase = await casesCol.findOne({ caseRef }, { projection: { passwordHash: 0 } });

    if (!targetCase) {
      res.status(404).json({ success: false, error: 'Case record not found.' });
      return;
    }

    res.json({ success: true, case: targetCase });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to retrieve case details.' });
  }
});
