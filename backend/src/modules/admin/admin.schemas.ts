import { z } from 'zod';

const roleSchema = z.object({
  role: z.enum(['CLIENT', 'MANAGER', 'ADMINISTRATOR']),
});

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const scenarioSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

const categoryPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
  })
  .refine((o) => o.name != null || o.description !== undefined, { message: 'At least one field required' });

const scenarioPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    active: z.boolean().optional(),
  })
  .refine((o) => o.title != null || o.description !== undefined || o.active != null, {
    message: 'At least one field required',
  });

const questionBodySchema = z.object({
  text: z.string().min(1),
  order: z.number().int().optional(),
});

const questionPatchSchema = z
  .object({
    text: z.string().min(1).optional(),
    order: z.number().int().optional(),
  })
  .refine((o) => o.text != null || o.order != null, { message: 'At least one field required' });

const hintBodySchema = z.object({
  text: z.string().min(1),
  order: z.number().int().optional(),
});

const hintPatchSchema = z
  .object({
    text: z.string().min(1).optional(),
    order: z.number().int().optional(),
    scenarioId: z.string().uuid().nullable().optional(),
  })
  .refine((o) => o.text != null || o.order != null || o.scenarioId !== undefined, {
    message: 'At least one field required',
  });

const materialBodySchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  categoryId: z.string().uuid().nullable().optional(),
});

const materialPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    categoryId: z.string().uuid().nullable().optional(),
  })
  .refine((o) => o.title != null || o.body != null || o.categoryId !== undefined, {
    message: 'At least one field required',
  });

const contentBlockCreateSchema = z.object({
  key: z.string().min(3).max(100),
  title: z.string().min(1).max(200),
  section: z.string().min(1).max(120).optional(),
  content: z.string().min(1),
});

const contentBlockPatchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    section: z.string().min(1).max(120).optional(),
    content: z.string().min(1).optional(),
    isPublished: z.boolean().optional(),
    note: z.string().max(240).optional(),
  })
  .refine((o) => o.title != null || o.section != null || o.content != null || o.isPublished != null, {
    message: 'At least one field required',
  });

const rollbackSchema = z.object({
  versionId: z.string().uuid(),
});

const cmsItemSchema = z.object({
  kind: z.enum(['service', 'work', 'gallery']),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  price: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  imageUrl: z
    .union([
      z.literal(''),
      z
        .string()
        .url()
        .max(2000)
        .refine((u) => /^https:/i.test(u), { message: 'imageUrl must be https://' }),
    ])
    .optional(),
  problem: z.string().max(2000).optional(),
  result: z.string().max(2000).optional(),
  term: z.string().max(200).optional(),
  published: z.boolean().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
});

const cmsReorderSchema = z.object({
  kind: z.enum(['service', 'work', 'gallery']),
  ids: z.array(z.string().uuid()).min(1),
});

const memorySearchSchema = z.object({
  symptoms: z.string().min(1).max(4000),
  make: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  conditions: z.string().max(4000).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

const memoryBackfillSchema = z.object({
  limit: z.number().int().min(1).max(2000).optional(),
  dryRun: z.boolean().optional(),
});

const siteSettingsPatchSchema = z
  .object({
    productName: z.string().min(1).max(200).optional(),
    shortName: z.string().min(1).max(80).optional(),
    description: z.string().max(500).optional(),
    logoUrl: z.union([z.literal(''), z.string().url().max(2000)]).optional().nullable(),
    supportEmail: z.union([z.literal(''), z.string().email().max(200)]).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    address: z.string().max(300).optional().nullable(),
    workingHours: z.string().max(120).optional(),
    mapUrl: z.union([z.literal(''), z.string().url().max(2000)]).optional().nullable(),
    assistantName: z.string().min(1).max(120).optional(),
    footerCaption: z.string().max(300).optional(),
    theme: z
      .object({
        primary: z.string().max(20).optional(),
        secondary: z.string().max(20).optional(),
        accent: z.string().max(20).optional(),
      })
      .optional(),
    legal: z
      .object({
        legalName: z.string().max(300).optional(),
        ogrn: z.string().max(20).optional(),
        inn: z.string().max(20).optional(),
        legalAddress: z.string().max(300).optional(),
        privacyEmail: z.union([z.literal(''), z.string().email().max(200)]).optional(),
      })
      .optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field required' });


export {
  roleSchema,
  categorySchema,
  scenarioSchema,
  categoryPatchSchema,
  scenarioPatchSchema,
  questionBodySchema,
  questionPatchSchema,
  hintBodySchema,
  hintPatchSchema,
  materialBodySchema,
  materialPatchSchema,
  contentBlockCreateSchema,
  contentBlockPatchSchema,
  rollbackSchema,
  cmsItemSchema,
  cmsReorderSchema,
  memorySearchSchema,
  memoryBackfillSchema,
  siteSettingsPatchSchema,
};
