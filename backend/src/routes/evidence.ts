import express, { Response } from 'express';
import { getDb } from '../db.js';
import { CaseEvidenceAssociation } from '../models.js';
import { requireCaseSession, AuthenticatedRequest } from '../auth.js';
import { queryOnChainEvidence, queryCustodyHistoryFromEvents } from '../blockchain.js';
import { associateEvidenceBody } from '../validation.js';

export const evidenceRouter = express.Router();

function sessionCase(req: AuthenticatedRequest): string {
  return req.caseSession!.caseRef.toUpperCase();
}

evidenceRouter.get('/:caseId/history/:evidenceId', requireCaseSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evidenceId = req.params.evidenceId;
    const history = await queryCustodyHistoryFromEvents(evidenceId);
    const onChain = await queryOnChainEvidence(evidenceId);
    res.json({
      success: true,
      evidenceId,
      currentCustodian: onChain ? onChain.currentCustodian : null,
      registeredSha256: onChain ? onChain.fileHash : null,
      cid: onChain ? onChain.cid : null,
      history,
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Failed to query custody history from blockchain event logs.',
    });
  }
});

evidenceRouter.get('/:caseId/:evidenceId', requireCaseSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseRef = sessionCase(req);
    const evidenceId = req.params.evidenceId;
    const db = getDb();
    const item = await db.collection<CaseEvidenceAssociation>('case_evidence').findOne({
      caseId: caseRef,
      evidenceId,
    });
    if (!item) {
      res.status(404).json({ success: false, error: 'Evidence is not associated with this case.' });
      return;
    }
    const onChain = await queryOnChainEvidence(evidenceId);
    res.json({
      success: true,
      evidence: {
        evidenceId: item.evidenceId,
        caseId: item.caseId,
        fileName: item.fileName,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        sha256: item.sha256,
        ipfsCid: item.ipfsCid,
        associatedAt: item.associatedAt,
        onChainStatus: onChain
          ? {
              registered: true,
              fileHash: onChain.fileHash,
              cid: onChain.cid,
              registrant: onChain.registrant,
              currentCustodian: onChain.currentCustodian,
              registeredAt: onChain.registeredAt,
              description: onChain.description,
            }
          : { registered: false, note: 'Not found in on-chain registry' },
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to retrieve evidence record.' });
  }
});

evidenceRouter.get('/:caseId', requireCaseSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseRef = sessionCase(req);
    const db = getDb();
    const associations = await db
      .collection<CaseEvidenceAssociation>('case_evidence')
      .find({ caseId: caseRef })
      .sort({ associatedAt: -1 })
      .toArray();

    const evidenceList = await Promise.all(
      associations.map(async (item) => {
        const onChain = await queryOnChainEvidence(item.evidenceId);
        return {
          evidenceId: item.evidenceId,
          caseId: item.caseId,
          fileName: item.fileName,
          fileSize: item.fileSize,
          mimeType: item.mimeType,
          sha256: item.sha256,
          ipfsCid: item.ipfsCid,
          associatedAt: item.associatedAt,
          onChainStatus: onChain
            ? {
                registered: true,
                fileHash: onChain.fileHash,
                cid: onChain.cid,
                registrant: onChain.registrant,
                currentCustodian: onChain.currentCustodian,
                registeredAt: onChain.registeredAt,
                description: onChain.description,
              }
            : {
                registered: false,
                note: 'Pending or not found in on-chain registry',
              },
        };
      })
    );

    res.json({
      success: true,
      caseRef,
      count: evidenceList.length,
      evidence: evidenceList,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to retrieve evidence records.' });
  }
});

evidenceRouter.post('/associate', requireCaseSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = associateEvidenceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid evidence association payload.',
        details: parsed.error.flatten(),
      });
      return;
    }

    const sessionCaseRef = sessionCase(req);
    const { evidenceId, fileName, fileSize, mimeType, sha256, ipfsCid } = parsed.data;

    const onChain = await queryOnChainEvidence(evidenceId);
    if (!onChain) {
      res.status(409).json({
        success: false,
        code: 'NOT_ON_CHAIN',
        error: 'This evidence ID is not present on the deployed registry yet.',
      });
      return;
    }
    if (onChain.fileHash !== sha256.toLowerCase() || onChain.cid !== ipfsCid) {
      res.status(409).json({
        success: false,
        code: 'ON_CHAIN_DATA_MISMATCH',
        error: 'The supplied digest and CID do not match the authoritative on-chain evidence record.',
      });
      return;
    }

    const db = getDb();
    await db.collection<CaseEvidenceAssociation>('case_evidence').updateOne(
      { caseId: sessionCaseRef, evidenceId },
      {
        $set: {
          caseId: sessionCaseRef,
          evidenceId,
          fileName: fileName || 'artifact.bin',
          fileSize: fileSize || 0,
          mimeType: mimeType || 'application/octet-stream',
          sha256: sha256.toLowerCase(),
          ipfsCid,
          associatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Evidence linked to the authenticated case.',
      evidenceId,
      caseId: sessionCaseRef,
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Failed to link evidence with case.',
    });
  }
});
