// index: public surface of the package.

import { MemoryCacheStore } from './infra/cache';
import { CromaClient } from './infra/croma-client';
import { Env, loadEnv } from './infra/env';
import { Logger, noopLogger } from './infra/logger';
import { SiemClient } from './siem/siem.client';
import { BusinessVerificationService } from './business-verification/business-verification.service';

export * from './infra/cache';
export * from './infra/croma-client';
export * from './infra/env';
export * from './infra/logger';
export * from './infra/types';
export * from './infra/validated-call';
export * from './siem/siem.client';
export * from './siem/siem.schemas';
export * from './business-verification/business-verification.service';
export * from './business-verification/business-verification.badge';

export interface BusinessVerificationSetup {
  service: BusinessVerificationService;
  env: Env;
}

export function createBusinessVerification(
  env: Env = loadEnv(),
  logger: Logger = noopLogger,
): BusinessVerificationSetup {
  const croma = new CromaClient({
    apiKey: env.CROMA_API_KEY,
    baseUrl: env.CROMA_BASE_URL,
    waitSeconds: env.CROMA_WAIT_SECONDS,
    timeoutMs: env.CROMA_TIMEOUT_MS,
    logger,
  });

  const service = new BusinessVerificationService(new SiemClient(croma), new MemoryCacheStore(), {
    cacheTtlMs: env.BUSINESS_VERIFICATION_CACHE_TTL_MS,
    maxDetailLookups: env.BUSINESS_VERIFICATION_MAX_DETAIL_LOOKUPS,
    rfcField: env.SIEM_DETAIL_RFC_FIELD,
  });

  return { service, env };
}
