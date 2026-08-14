import { MemoryCacheStore } from '../../src/common/cache/memory-cache';
import { CallOptions, CromaCallable } from '../../src/common/http/croma.client';
import { SourceResult, sourceOk, sourceUnavailable } from '../../src/common/types/source-result.types';
import { SiemClient } from '../../src/modules/business-verification/providers/siem.provider';
import { SIEM_SEARCH_PATH } from '../../src/modules/business-verification/providers/siem.types';
import { DofClient } from '../../src/modules/regulatory-radar/providers/dof.provider';
import { CnbvClient } from '../../src/modules/regulatory-radar/providers/cnbv.provider';
import { BusinessVerificationService } from '../../src/modules/business-verification/business-verification.service';
import { RegulatoryRadarService } from '../../src/modules/regulatory-radar/regulatory-radar.service';
import { CrevaScoreSetup } from '../../src/modules/creva-score/creva-score.factory';
import { loadEnv } from '../../src/config/env';
import { buildScoreDisclosure } from '../../src/modules/score-disclosure/score-disclosure.service';
import { SieClient } from '../../src/modules/reference-rates/providers/banxico-sie.provider';
import { DEFAULT_RATE_DEFINITIONS, ReferenceRatesService } from '../../src/modules/reference-rates/reference-rates.service';
import { buildRegulatoryRadarTool, buildReportTool, buildVerifyBusinessTool, textOf, type McpToolResult } from '../../src/modules/mcp/mcp.tools';
import { join } from 'node:path';
import { folderStamp, reportFolderName } from '../../src/common/output/report-folder';
import type { DocumentTools } from '../../src/modules/mcp/report-document';

class Croma implements CromaCallable {
  readonly calls: Array<{ path: string; body: unknown }> = [];

  constructor(private readonly responses: Map<string, SourceResult<unknown>>) {}

  async call<T>(path: string, body: unknown, _options: CallOptions): Promise<SourceResult<T>> {
    this.calls.push({ path, body });
    const response = this.responses.get(path);
    if (!response) return sourceUnavailable('unknown', 'http_500') as SourceResult<T>;
    return response as SourceResult<T>;
  }
}

function setupWith(responses: Map<string, SourceResult<unknown>>): {
  setup: CrevaScoreSetup;
  croma: Croma;
} {
  const croma = new Croma(responses);
  const cache = new MemoryCacheStore();
  const env = loadEnv({ CROMA_API_KEY: 'k', REGULATORY_RADAR_SCAN_DAYS: '1' });

  const setup: CrevaScoreSetup = {
    service: new BusinessVerificationService(new SiemClient(croma), cache, {
      cacheTtlMs: 1000,
      maxDetailLookups: 0,
      rfcField: 'establishment.rfc',
    }),
    radar: new RegulatoryRadarService(new DofClient(croma), new CnbvClient(croma), cache, {
      keywords: ['PyME'],
      scanDays: 1,
      cacheTtlMs: 1000,
      maxAlerts: 10,
      maxRulebookPages: 1,
    }),
    rates: new ReferenceRatesService(new SieClient({}), cache, {
      definitions: DEFAULT_RATE_DEFINITIONS,
      cacheTtlMs: 0,
    }),
    disclosure: buildScoreDisclosure({ scoreVersion: '1.0', windowDays: 30 }),
    env,
  };
  return { setup, croma };
}

function searchResponse(establishments: Array<Record<string, unknown>>): SourceResult<unknown> {
  return sourceOk('mx.siem', {
    query: 'q',
    establishments,
    pagination: { total: establishments.length, page_size: 10, total_pages: 1, page: 1 },
  });
}

const exactMatch = {
  establishment_id: '1',
  commercial_name: 'CAÑONERI',
  chamber: 'CANACO',
  state: 'Tlaxcala',
  state_code: 29,
};

function parse(result: McpToolResult): Record<string, unknown> {
  return JSON.parse(textOf(result)) as Record<string, unknown>;
}

describe('creva_verify_business', () => {
  it('emits a badge with provenance when the business is identified', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, searchResponse([exactMatch])]]));
    const tool = buildVerifyBusinessTool(setup);

    const result = await tool.handler({ business_name: 'Cañoneri' });
    const payload = parse(result);

    expect(result.isError).toBeUndefined();
    expect(payload.status).toBe('verified');
    expect(payload.badge).toMatchObject({ source: 'mx.siem', commercial_name: 'CAÑONERI' });
  });

  it('reports not_listed as a real answer, not an error', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, searchResponse([])]]));
    const tool = buildVerifyBusinessTool(setup);

    const result = await tool.handler({ business_name: 'Negocio Nuevo' });
    const payload = parse(result);

    expect(result.isError).toBeUndefined();
    expect(payload.status).toBe('not_listed');
    expect(payload.badge).toBeNull();
  });

  it('flags an unreadable source as an error so it is never read as "not listed"', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, sourceUnavailable('mx.siem', 'http_502')]]));
    const tool = buildVerifyBusinessTool(setup);

    const result = await tool.handler({ business_name: 'Cañoneri' });
    const payload = parse(result);

    expect(result.isError).toBe(true);
    expect(payload.status).toBe('unavailable');
    expect(payload.reason).toBe('http_502');
  });

  it('passes the state filter through to the directory query', async () => {
    const { setup, croma } = setupWith(new Map([[SIEM_SEARCH_PATH, searchResponse([exactMatch])]]));
    const tool = buildVerifyBusinessTool(setup);

    await tool.handler({ business_name: 'Cañoneri', state_code: 29 });

    expect(croma.calls[0]?.body).toEqual({ name: 'Cañoneri', state_code: 29 });
  });

  it('never blames absence when the problem was ambiguity', async () => {
    const many = Array.from({ length: 3 }, (_, i) => ({ ...exactMatch, establishment_id: String(i), commercial_name: `ABARROTES ${i}` }));
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, searchResponse(many)]]));
    const tool = buildVerifyBusinessTool(setup);

    const result = await tool.handler({ business_name: 'ABARROTES' });
    const payload = parse(result);

    expect(payload.status).toBe('ambiguous');
    expect(payload.badge).toBeNull();
    expect(payload.note as string).not.toContain('ausencia');
    expect(payload.note as string).toContain('varios negocios');
  });

  it('explains absence only when the business was genuinely absent', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, searchResponse([])]]));

    const payload = parse(await buildVerifyBusinessTool(setup).handler({ business_name: 'Negocio Nuevo' }));

    expect(payload.status).toBe('not_listed');
    expect(payload.note as string).toContain('ausencia');
  });

  it('declares an input contract that rejects a too-short name', () => {
    const { setup } = setupWith(new Map());
    const { inputSchema } = buildVerifyBusinessTool(setup).config;

    expect(inputSchema.business_name.safeParse('A').success).toBe(false);
    expect(inputSchema.business_name.safeParse('Cañoneri').success).toBe(true);
    expect(inputSchema.state_code.safeParse(33).success).toBe(false);
  });
});

describe('creva_regulatory_radar', () => {
  it('returns alerts with the dates it managed to read and the ones it did not', async () => {
    const { setup } = setupWith(
      new Map<string, SourceResult<unknown>>([
        [
          '/mx/dof/publications-by-date/v1',
          sourceOk('mx.dof', {
            date: '2026-08-13',
            published: true,
            total: 1,
            publications: [{ id: 'p1', title: 'ACUERDO sobre PyME', agency: 'SE', branch: 'EJECUTIVO' }],
          }),
        ],
        [
          '/mx/cnbv/regulations/v1',
          sourceOk('mx.cnbv', {
            regulations: [],
            pagination: { total: 0, page_size: 50, total_pages: 0, page: 1 },
          }),
        ],
      ]),
    );
    const tool = buildRegulatoryRadarTool(setup);

    const result = await tool.handler({});
    const payload = parse(result);

    expect(result.isError).toBeUndefined();
    expect(payload.status).toBe('ok');
    expect(payload.failed_dates).toEqual([]);
    expect((payload.alerts as unknown[]).length).toBe(1);
  });

  it('flags an error when no source could be read', async () => {
    const { setup } = setupWith(new Map());
    const tool = buildRegulatoryRadarTool(setup);

    const result = await tool.handler({});

    expect(result.isError).toBe(true);
    expect(parse(result).status).toBe('unavailable');
  });

  it('takes no input describing a person or a business', () => {
    const { setup } = setupWith(new Map());

    expect(Object.keys(buildRegulatoryRadarTool(setup).config.inputSchema)).toEqual([]);
  });
});


describe('creva_report', () => {
  const found = sourceOk('mx.siem', {
    query: 'ACME',
    establishments: [
      { establishment_id: '1', commercial_name: 'ACME', chamber: 'x', state: 'Chihuahua', state_code: 8 },
    ],
    pagination: { total: 1, page_size: 10, total_pages: 1, page: 1 },
  });

  it('returns the whole composition, with every signal naming its source', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, found]]));
    const result = await buildReportTool(setup).handler({ business_name: 'ACME', state_code: 8, document: false });
    const report = JSON.parse(textOf(result)) as {
      subject: { business_name: string } | null;
      signals: Array<{ source: string; tone: string }>;
      disclosure: { kind: string; does_not_estimate: string[] };
    };

    expect(report.subject?.business_name).toBe('ACME');
    expect(report.signals.length).toBeGreaterThan(0);
    for (const signal of report.signals) expect(signal.source.length).toBeGreaterThan(0);
  });

  it('carries the disclosure, so an assistant cannot summarise the caveats away', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, found]]));
    const result = await buildReportTool(setup).handler({ business_name: 'ACME', document: false });
    const report = JSON.parse(textOf(result)) as {
      disclosure: { kind: string; does_not_estimate: string[] };
    };

    expect(report.disclosure.kind).toBe('descriptive');
    expect(report.disclosure.does_not_estimate.length).toBeGreaterThan(0);
  });

  it('still answers without a business, and says the badge is missing', async () => {
    const { setup } = setupWith(new Map());
    const result = await buildReportTool(setup).handler({ document: false });
    const report = JSON.parse(textOf(result)) as { subject: unknown; notes: string[] };

    expect(report.subject).toBeNull();
    expect(report.notes.join(' ')).toContain('no consultó ningún negocio');
  });

  function fakeDocumentTools(overrides: Partial<DocumentTools> = {}): DocumentTools {
    return {
      findBrowser: () => '/fake/chrome',
      print: async () => 4096,
      writeFile: (_path, contents) => contents.length,
      resolveFolder: (businessName, generatedAt) =>
        join(String.raw`C:\Users\x\Downloads`, reportFolderName(businessName, generatedAt)),
      ...overrides,
    };
  }

  function links(result: McpToolResult): Array<{ name: string; uri: string }> {
    return result.content.filter(
      (block): block is { type: 'resource_link'; uri: string; name: string; mimeType: string; description: string } =>
        block.type === 'resource_link',
    );
  }

  it('hands over both files without being asked, because "dame el reporte" means the report', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, found]]));
    const result = await buildReportTool(setup, fakeDocumentTools()).handler({ business_name: 'ACME' });

    expect(links(result).map((link) => link.name)).toEqual(['creva-reporte.pdf', 'creva-reporte.html']);
  });

  it('still returns the interactive page when there is no browser to print with', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, found]]));
    const tools = fakeDocumentTools({ findBrowser: () => null });
    const result = await buildReportTool(setup, tools).handler({ business_name: 'ACME' });

    expect(links(result).map((link) => link.name)).toEqual(['creva-reporte.html']);
  });

  it('writes into a Downloads folder named after the business and the report clock', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, found]]));
    const result = await buildReportTool(setup, fakeDocumentTools()).handler({ business_name: 'ACME' });

    const blocks = result.content.filter((block): block is { type: 'text'; text: string } => block.type === 'text');
    const report = JSON.parse(blocks[blocks.length - 1]?.text ?? '{}') as { generated_at: string };
    const folderLine = blocks[0]?.text.split('\n')[0] ?? '';

    // The folder must carry the report's own clock, not a second one read a moment later.
    expect(folderLine).toContain(join('Downloads', `Creva_Score_acme_${folderStamp(report.generated_at)}`));
  });

  it('leaves the files alone when the caller opts out', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, found]]));
    const result = await buildReportTool(setup, fakeDocumentTools()).handler({
      business_name: 'ACME',
      document: false,
    });

    expect(links(result)).toHaveLength(0);
  });

  it('never grades the business', async () => {
    const { setup } = setupWith(new Map([[SIEM_SEARCH_PATH, found]]));
    const result = await buildReportTool(setup).handler({ business_name: 'ACME', document: false });
    const raw = textOf(result).toLowerCase();

    for (const verdict of ['favorable', 'aprob', 'rechaz', 'confianza', 'riesgo']) {
      expect(raw).not.toContain(verdict);
    }
  });
});
