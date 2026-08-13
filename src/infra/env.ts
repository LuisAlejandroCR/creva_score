// env: typed configuration loader.

import { z } from 'zod';

const DAY_MS = 24 * 60 * 60 * 1000;

const envSchema = z.object({
  CROMA_API_KEY: z.string().min(1).optional(),
  CROMA_BASE_URL: z.string().url().default('https://api.croma.run'),
  CROMA_ORGANIZATION_ID: z.string().min(1).optional(),
  CROMA_WAIT_SECONDS: z.coerce.number().int().min(1).max(55).default(55),
  CROMA_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),

  // Dot path into the detail response.
  SIEM_DETAIL_RFC_FIELD: z.string().min(1).default('establishment.rfc'),

  REGULATORY_RADAR_KEYWORDS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((k) => k.trim()).filter((k) => k.length > 0)),
  REGULATORY_RADAR_SCAN_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  REGULATORY_RADAR_CACHE_TTL_MS: z.coerce.number().int().min(0).default(DAY_MS),
  REGULATORY_RADAR_MAX_ALERTS: z.coerce.number().int().min(1).max(100).default(20),
  REGULATORY_RADAR_MAX_RULEBOOK_PAGES: z.coerce.number().int().min(1).max(20).default(3),

  BUSINESS_VERIFICATION_CACHE_TTL_MS: z.coerce.number().int().min(0).default(7 * DAY_MS),
  BUSINESS_VERIFICATION_MAX_DETAIL_LOOKUPS: z.coerce.number().int().min(0).max(5).default(1),
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment configuration: ${issues.join('; ')}`);
    this.name = 'EnvValidationError';
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const normalized: NodeJS.ProcessEnv = {
    ...source,
    CROMA_BASE_URL: source.CROMA_BASE_URL ?? source.Base_URL,
    CROMA_ORGANIZATION_ID: source.CROMA_ORGANIZATION_ID ?? source.Organization_ID,
  };

  const parsed = envSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new EnvValidationError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  return parsed.data;
}

export function isCromaConfigured(env: Env): boolean {
  return typeof env.CROMA_API_KEY === 'string' && env.CROMA_API_KEY.length > 0;
}
