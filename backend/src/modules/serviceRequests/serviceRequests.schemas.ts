import { z } from 'zod';

const listQuerySchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(['createdAt', 'client', 'car', 'status', 'version']).optional().default('createdAt'),
  dir: z.enum(['asc', 'desc']).optional().default('desc'),
  mine: z.enum(['true', 'false', '1', '0']).optional(),
  sla: z.enum(['breached']).optional(),
  feedback: z.enum(['none', 'CORRECT', 'PARTIAL', 'INCORRECT', 'correct', 'partial', 'incorrect']).optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  statuses: z.string().optional(),
  source: z.enum(['guest', 'registered', 'contact']).optional(),
  period: z.enum(['today', '7d', 'all']).optional(),
  hasDiagnosis: z.enum(['true', 'false', '1', '0']).optional(),
});

const patchSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']),
  expectedVersion: z.number().int(),
});

const bulkPatchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.enum(['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']),
});

const bulkAssignSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  managerId: z.string().uuid().optional(),
});

const assignManagerSchema = z.object({
  managerId: z.string().uuid(),
});

const bulkExportSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  connectionId: z.string().uuid().optional(),
});

const feedbackSchema = z.object({
  verdict: z.enum(['CORRECT', 'PARTIAL', 'INCORRECT']),
  actualCause: z.string().max(2000).optional(),
  worksDone: z.string().max(2000).optional(),
  repairAmountMinor: z.number().int().min(0).optional().nullable(),
  workOrderNumber: z.string().max(120).optional().nullable(),
  repairCompletedAt: z.string().datetime().optional().nullable(),
  repairMileageKm: z.number().int().min(0).max(2_000_000).optional().nullable(),
  workCategory: z
    .enum(['oil_change', 'maintenance', 'brakes', 'filters', 'tires', 'other'])
    .optional()
    .nullable(),
});

const completionDocumentSchema = z.object({
  kind: z.enum(['WORK_ORDER', 'RECEIPT', 'WARRANTY', 'ACT', 'OTHER']),
  label: z.string().max(120).optional().nullable(),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  contentBase64: z.string().min(1).max(12_000_000),
});

const clientsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  filter: z.enum(['all', 'active', 'guests']).optional().default('all'),
  sort: z.enum(['activity', 'recent', 'name', 'ltv']).optional().default('activity'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const boardQuerySchema = listQuerySchema.omit({ page: true, pageSize: true }).extend({
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export {
  listQuerySchema,
  patchSchema,
  bulkPatchSchema,
  bulkAssignSchema,
  assignManagerSchema,
  bulkExportSchema,
  feedbackSchema,
  completionDocumentSchema,
  clientsQuerySchema,
  boardQuerySchema,
};
