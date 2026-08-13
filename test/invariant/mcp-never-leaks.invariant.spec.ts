import fc from 'fast-check';
import { MemoryCacheStore } from '../../src/common/cache/memory-cache';
import { CallOptions, CromaCallable } from '../../src/common/http/croma.client';
import { SourceResult, sourceOk, sourceUnavailable } from '../../src/common/types/source-result.types';
import { SiemClient } from '../../src/modules/business-verification/providers/siem.provider';
import { DofClient } from '../../src/modules/regulatory-radar/providers/dof.provider';
import { CnbvClient } from '../../src/modules/regulatory-radar/providers/cnbv.provider';
import { BusinessVerificationService } from '../../src/modules/business-verification/business-verification.service';
import { RegulatoryRadarService } from '../../src/modules/regulatory-radar/regulatory-radar.service';
import { BusinessVerificationSetup } from '../../src/index';
import { loadEnv } from '../../src/config/env';
import { buildScoreDisclosure } from '../../src/modules/score-disclosure/score-disclosure.service';
import { SieClient } from '../../src/modules/reference-rates/providers/banxico-sie.provider';
import { DEFAULT_RATE_DEFINITIONS, ReferenceRatesService } from '../../src/modules/reference-rates/reference-rates.service';
import { createStderrLogger } from '../../src/common/logger';
import { buildRegulatoryRadarTool, buildVerifyBusinessTool } from '../../src/modules/mcp/mcp.tools';

const API_KEY = 'croma_live_mcp_must_never_emit_this';

class FlakyCroma implements CromaCallable {
  constructor(private readonly outcome: SourceResult<unknown>) {}

  async call<T>(_path: string, _body: unknown, _options: CallOptions): Promise<SourceResult<T>> {
    return this.outcome as SourceResult<T>;
  }
}

function setupWith(outcome: SourceResult<unknown>): BusinessVerificationSetup {
  const croma = new FlakyCroma(outcome);
  const cache = new MemoryCacheStore();
  return {
    service: new BusinessVerificationService(new SiemClient(croma), cache, {
      cacheTtlMs: 0,
      maxDetailLookups: 0,
      rfcField: 'establishment.rfc',
    }),
    radar: new RegulatoryRadarService(new DofClient(croma), new CnbvClient(croma), cache, {
      keywords: ['PyME'],
      scanDays: 1,
      cacheTtlMs: 0,
      maxAlerts: 10,
      maxRulebookPages: 1,
    }),
    rates: new ReferenceRatesService(new SieClient({}), cache, {
      definitions: DEFAULT_RATE_DEFINITIONS,
      cacheTtlMs: 0,
    }),
    disclosure: buildScoreDisclosure({ scoreVersion: '1.0', windowDays: 30 }),
    env: loadEnv({ CROMA_API_KEY: API_KEY }),
  };
}

const arbOutcome = fc.oneof(
  fc.constant(
    sourceOk('mx.siem', {
      query: 'q',
      establishments: [],
      pagination: { total: 0, page_size: 10, total_pages: 0, page: 1 },
    }),
  ),
  fc
    .constantFrom('missing_api_key', 'http_500', 'http_429', 'invalid_response_shape', 'job_failed')
    .map((reason) => sourceUnavailable('mx.siem', reason)),
);

describe('MCP invariants', () => {
  it('never emits the API key in a tool result, whatever the outcome', async () => {
    await fc.assert(
      fc.asyncProperty(arbOutcome, fc.string({ minLength: 2, maxLength: 40 }), async (outcome, name) => {
        const setup = setupWith(outcome);

        const verify = await buildVerifyBusinessTool(setup).handler({ business_name: name });
        const radar = await buildRegulatoryRadarTool(setup).handler({});

        for (const result of [verify, radar]) {
          expect(JSON.stringify(result)).not.toContain(API_KEY);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('never reports a business as verified when the source could not be read', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('missing_api_key', 'http_500', 'http_429', 'invalid_response_shape'),
        fc.string({ minLength: 2, maxLength: 40 }),
        async (reason, name) => {
          const setup = setupWith(sourceUnavailable('mx.siem', reason));

          const result = await buildVerifyBusinessTool(setup).handler({ business_name: name });
          const payload = JSON.parse(result.content[0]!.text) as { status: string; badge?: unknown };

          expect(result.isError).toBe(true);
          expect(payload.status).toBe('unavailable');
          expect(payload.status).not.toBe('not_listed');
          expect(payload.badge).toBeUndefined();
        },
      ),
    );
  });

  it('keeps the protocol stream clean: the MCP logger never writes a byte to stdout', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (message, value) => {
        const err: string[] = [];
        const logger = createStderrLogger({ error: (line: string) => err.push(line) });

        const stdoutSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
        try {
          logger.log('info', message, { note: value });
        } finally {
          stdoutSpy.mockRestore();
        }

        expect(stdoutSpy).not.toHaveBeenCalled();
        expect(err).toHaveLength(1);
      }),
      { numRuns: 50 },
    );
  });
});
