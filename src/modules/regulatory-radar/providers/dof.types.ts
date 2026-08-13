// dof.schemas: response contract for the federal gazette. Retrieval is by date only.

import { z } from 'zod';

export const DOF_PUBLICATIONS_BY_DATE_PATH = '/mx/dof/publications-by-date/v1';
export const DOF_SOURCE = 'mx.dof';

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

export const dofPublicationSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    // Real gazette entries carry a null title when only a scanned PDF exists.
    title: nullableString,
    agency: nullableString,
    branch: nullableString,
  })
  .passthrough();

export const dofPublicationsByDateSchema = z.object({
  date: z.string(),
  published: z.boolean(),
  total: z.number(),
  publications: z.array(dofPublicationSchema),
});

export type DofPublication = z.infer<typeof dofPublicationSchema>;
export type DofPublicationsByDate = z.infer<typeof dofPublicationsByDateSchema>;
