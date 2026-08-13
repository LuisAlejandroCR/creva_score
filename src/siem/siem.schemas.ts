// siem.schemas: response contracts for the business establishment directory.

import { z } from 'zod';

export const SIEM_SEARCH_PATH = '/mx/siem/establishments/v1';
export const SIEM_DETAIL_PATH = '/mx/siem/establishment/v1';
export const SIEM_SOURCE = 'mx.siem';

const nullableString = z.string().nullish().transform((value) => value ?? null);
const nullableNumber = z.number().nullish().transform((value) => value ?? null);

export const establishmentSummarySchema = z.object({
  establishment_id: z.string(),
  commercial_name: nullableString,
  chamber: nullableString,
  state: nullableString,
  state_code: nullableNumber,
});

export const paginationSchema = z.object({
  total: z.number(),
  page_size: z.number(),
  total_pages: z.number(),
  page: z.number(),
});

export const establishmentSearchSchema = z.object({
  query: z.string(),
  establishments: z.array(establishmentSummarySchema),
  pagination: paginationSchema,
});

export const establishmentDetailSchema = z
  .object({
    found: z.boolean(),
    establishment_id: nullableString,
  })
  .passthrough();

export type EstablishmentSummary = z.infer<typeof establishmentSummarySchema>;
export type EstablishmentSearch = z.infer<typeof establishmentSearchSchema>;
export type EstablishmentDetail = z.infer<typeof establishmentDetailSchema>;

export interface EstablishmentSearchParams {
  name: string;
  stateCode?: number;
  activityCode?: number;
  page?: number;
}
