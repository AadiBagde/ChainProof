import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { config, describeIpfsMode } from './config.js';
import { checkMongoHealth } from './db.js';
import { checkBlockchainHealth } from './blockchain.js';
import { caseRouter } from './routes/cases.js';
import { evidenceRouter } from './routes/evidence.js';
import { requireCaseSession, AuthenticatedRequest, verifySessionToken, getRequestSessionToken } from './auth.js';
import { uploadToIpfs, IpfsNotConfiguredError } from './ipfs.js';
import { ipfsUploadBody } from './validation.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
});

function parseIpfsUpload(req: Request, res: Response, next: (err?: unknown) => void): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      res.status(status).json({
        success: false,
        error: err.code === 'LIMIT_FILE_SIZE'
          ? `File exceeds the ${config.maxUploadBytes}-byte upload limit.`
          : 'Upload must contain exactly one file.',
      });
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req: Request, res: Response) => {
    const mongoHealth = await checkMongoHealth();
    const chainHealth = await checkBlockchainHealth();
    const ipfsMode = describeIpfsMode();

    const isHealthy = mongoHealth.status === 'connected';

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? (chainHealth.status === 'connected' ? 'healthy' : 'degraded') : 'unavailable',
      timestamp: new Date().toISOString(),
      services: {
        api: { status: 'running' },
        mongodb: mongoHealth,
        blockchain: chainHealth,
        ipfs: {
          mode: ipfsMode,
          configured: ipfsMode !== 'unconfigured',
        },
      },
      contracts: {
        evidenceRegistry: config.evidenceRegistryAddress,
        custodyManager: config.custodyManagerAddress,
        chainId: config.chainId,
      },
    });
  });

  app.get('/api/auth/session', (req: Request, res: Response) => {
    const token = getRequestSessionToken(req);
    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const session = verifySessionToken(token);
    if (!session) {
      res.status(401).json({ success: false, error: 'Invalid or expired case session.' });
      return;
    }

    res.json({ success: true, session });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = getRequestSessionToken(req);
    if (token) {
      verifySessionToken(token);
    }

    res.setHeader('Set-Cookie', 'caseSession=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    res.json({ success: true, message: 'Case session cleared.' });
  });

  app.use('/api/cases', caseRouter);
  app.use('/api/evidence', evidenceRouter);

  app.post(
    '/api/ipfs/upload',
    requireCaseSession,
    parseIpfsUpload,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = ipfsUploadBody.safeParse(req.body);
        if (!parsed.success || !req.file) {
          res.status(400).json({
            success: false,
            error: 'A non-empty file and its 64-character SHA-256 digest are required.',
          });
          return;
        }
        if (req.file.size === 0) {
          res.status(400).json({ success: false, error: 'Empty files cannot be uploaded as evidence.' });
          return;
        }
        if (
          !req.file.originalname ||
          Buffer.byteLength(req.file.originalname, 'utf8') > 256 ||
          /[\u0000-\u001f\u007f]/.test(req.file.originalname) ||
          Buffer.byteLength(req.file.mimetype || '', 'utf8') > 128
        ) {
          res.status(400).json({ success: false, error: 'File name or media type is invalid.' });
          return;
        }
        const digest = createHash('sha256').update(req.file.buffer).digest('hex');
        if (digest !== parsed.data.sha256.toLowerCase()) {
          res.status(400).json({
            success: false,
            error: 'The uploaded file bytes do not match the supplied SHA-256 digest.',
          });
          return;
        }
        const cid = await uploadToIpfs(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        res.json({
          success: true,
          cid,
          size: req.file.size,
          note: 'A CID identifies content. Public IPFS content is not confidential.',
        });
      } catch (err) {
        if (err instanceof IpfsNotConfiguredError) {
          res.status(503).json({
            success: false,
            code: 'IPFS_NOT_CONFIGURED',
            error: err.message,
          });
          return;
        }
        const message = err instanceof Error ? err.message : 'IPFS upload failed.';
        res.status(502).json({ success: false, error: message });
      }
    }
  );

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'Endpoint not found.' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: (err?: unknown) => void) => {
    console.error('[Request Error]', err instanceof Error ? err.message : 'Unknown request error.');
    res.status(500).json({ success: false, error: 'Request could not be processed.' });
  });

  return app;
}
