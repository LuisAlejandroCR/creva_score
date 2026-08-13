// creva-score.factory: composition root. Wires every domain service from configuration.

import { CacheStore, MemoryCacheStore } from '../../common/cache/memory-cache';
import { FileCacheStore } from '../../common/cache/file-cache';
import { CromaClient } from '../../common/http/croma.client';
import { Logger, noopLogger } from '../../common/logger';
import { Env, loadEnv } from '../../config/env';
import { BusinessVerificationService } from '../business-verification/business-verification.service';
import { SiemClient } from '../business-verification/providers/siem.provider';
import { RegulatoryRadarService } from '../regulatory-radar/regulatory-radar.service';
import { CnbvClient } from '../regulatory-radar/providers/cnbv.provider';
import { DofClient } from '../regulatory-radar/providers/dof.provider';
import { DEFAULT_RATE_DEFINITIONS, ReferenceRatesService } from '../reference-rates/reference-rates.service';
import { SieClient } from '../reference-rates/providers/banxico-sie.provider';
import { ScoreDisclosure, buildScoreDisclosure } from '../score-disclosure/score-disclosure.service';

export interface CrevaScoreSetup {
  service: BusinessVerificationService;
  radar: RegulatoryRadarService;
  rates: ReferenceRatesService;
  disclosure: ScoreDisclosure;
  env: Env;
}

export function createCacheStore(env: Env, logger: Logger = noopLogger): CacheStore {
  const filePath = env.CACHE_FILE_PATH.trim();
  return filePath === '' ? new MemoryCacheStore() : new FileCacheStore({ filePath, logger });
}

export function createCrevaScore(
  env: Env = loadEnv(),
  logger: Logger = noopLogger,
  cacheStore?: CacheStore,
): CrevaScoreSetup {
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

  const rates = new ReferenceRatesService(
    new SieClient({
      token: env.BANXICO_SIE_TOKEN,
      baseUrl: env.BANXICO_SIE_BASE_URL,
      timeoutMs: env.CROMA_TIMEOUT_MS,
      logger,
    }),
    cache,
    { definitions: DEFAULT_RATE_DEFINITIONS, cacheTtlMs: env.REFERENCE_RATES_CACHE_TTL_MS },
  );

  const disclosure = buildScoreDisclosure({
    scoreVersion: env.SCORE_VERSION,
    windowDays: env.SCORE_WINDOW_DAYS,
  });

  return { service, radar, rates, disclosure, env };
}
