// index: public surface of the package.

import { CacheStore, MemoryCacheStore } from './infra/cache';
import { FileCacheStore } from './infra/file-cache';
import { CromaClient } from './infra/croma-client';
import { Env, loadEnv } from './infra/env';
import { Logger, noopLogger } from './infra/logger';
import { SiemClient } from './siem/siem.client';
import { DofClient } from './dof/dof.client';
import { CnbvClient } from './cnbv/cnbv.client';
import { RegulatoryRadarService } from './regulatory-radar/regulatory-radar.service';
import { BusinessVerificationService } from './business-verification/business-verification.service';
import { ScoreDisclosure, buildScoreDisclosure } from './score-disclosure/score-disclosure';

export * from './infra/cache';
export * from './infra/file-cache';
export * from './infra/croma-client';
export * from './infra/env';
export * from './infra/logger';
export * from './infra/types';
export * from './infra/validated-call';
export * from './siem/siem.client';
export * from './dof/dof.client';
export * from './dof/dof.schemas';
export * from './cnbv/cnbv.client';
export * from './cnbv/cnbv.schemas';
export * from './regulatory-radar/regulatory-radar.service';
export * from './siem/siem.schemas';
export * from './business-verification/business-verification.service';
export * from './business-verification/business-verification.badge';
export * from './score-disclosure/score-disclosure';

export interface BusinessVerificationSetup {
  service: BusinessVerificationService;
  radar: RegulatoryRadarService;
  disclosure: ScoreDisclosure;
  env: Env;
}

export function createBusinessVerification(
  env: Env = loadEnv(),
  logger: Logger = noopLogger,
  cacheStore?: CacheStore,
): BusinessVerificationSetup {
  const croma = new CromaClient({
    apiKey: env.CROMA_API_KEY,
    baseUrl: env.CROMA_BASE_URL,
    waitSeconds: env.CROMA_WAIT_SECONDS,
    timeoutMs: env.CROMA_TIMEOUT_MS,
    logger,
  });

  const cache = cacheStore ?? createCacheStore(env, logger);

  const service = new BusinessVerificationService(new SiemClient(croma), cache, {
    cacheTtlMs: env.BUSINESS_VERIFICATION_CACHE_TTL_MS,
    maxDetailLookups: env.BUSINESS_VERIFICATION_MAX_DETAIL_LOOKUPS,
    rfcField: env.SIEM_DETAIL_RFC_FIELD,
  });

  const radar = new RegulatoryRadarService(new DofClient(croma), new CnbvClient(croma), cache, {
    keywords: env.REGULATORY_RADAR_KEYWORDS,
    scanDays: env.REGULATORY_RADAR_SCAN_DAYS,
    cacheTtlMs: env.REGULATORY_RADAR_CACHE_TTL_MS,
    maxAlerts: env.REGULATORY_RADAR_MAX_ALERTS,
    maxRulebookPages: env.REGULATORY_RADAR_MAX_RULEBOOK_PAGES,
  });

  const disclosure = buildScoreDisclosure({
    scoreVersion: env.SCORE_VERSION,
    windowDays: env.SCORE_WINDOW_DAYS,
  });

  return { service, radar, disclosure, env };
}

export function createCacheStore(env: Env, logger: Logger = noopLogger): CacheStore {
  const filePath = env.CACHE_FILE_PATH.trim();
  return filePath === '' ? new MemoryCacheStore() : new FileCacheStore({ filePath, logger });
}
