import { z } from 'zod';

export const caseSearchQuery = z
  .object({
    q: z.string().trim().max(64).optional(),
    caseRef: z.string().trim().max(64).optional(),
  })
  .transform(({ q, caseRef }) => ({ q: (q ?? caseRef ?? '').trim() }));

export const caseAccessBody = z.object({
  caseRef: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const caseCreateBody = z
  .object({
    caseRef: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(128),
    description: z.string().trim().max(500).optional().default(''),
    leadInvestigator: z.string().trim().max(128).optional().default(''),
    password: z.string().min(8).max(256),
    confirmPassword: z.string().min(8).max(256),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const caseIdParam = z.object({
  caseId: z.string().trim().min(1).max(64),
});

export const evidenceIdParam = z.object({
  evidenceId: z.string().trim().min(1).max(64),
});

export const associateEvidenceBody = z.object({
  evidenceId: z.string().trim().min(1).max(64),
  fileName: z.string().trim().max(256).optional(),
  fileSize: z.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
  mimeType: z.string().trim().max(128).optional(),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/, 'SHA-256 must be 64 hex characters'),
  ipfsCid: z.string().trim().min(1).max(128),
});

export const ipfsUploadBody = z.object({
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/, 'SHA-256 must be 64 hex characters'),
});

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
