// cnbv.schemas: response contract for the banking regulator's rulebook.

import { z } from 'zod';

export const CNBV_REGULATIONS_PATH = '/mx/cnbv/regulations/v1';
export const CNBV_SOURCE = 'mx.cnbv';

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

export const cnbvRegulationSchema = z
  .object({
    regulation_id: nullableString,
    name: z.string(),
    type: nullableString,
    dof_date: nullableString,
    sectors: z.array(z.string()).nullish().transform((value) => value ?? []),
    pdf_url: nullableString,
  })
  .passthrough();

export const cnbvRegulationsSchema = z.object({
  regulations: z.array(cnbvRegulationSchema),
  pagination: z.object({
    total: z.number(),
    page_size: z.number(),
    total_pages: z.number(),
    page: z.number(),
  }),
});

export type CnbvRegulation = z.infer<typeof cnbvRegulationSchema>;
export type CnbvRegulations = z.infer<typeof cnbvRegulationsSchema>;
