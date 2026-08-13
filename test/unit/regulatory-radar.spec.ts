import { MemoryCacheStore } from '../../src/common/cache/memory-cache';
import { CallOptions, CromaCallable } from '../../src/common/http/croma.client';
import { SourceResult, sourceOk, sourceUnavailable } from '../../src/common/types/source-result.types';
import { CnbvClient } from '../../src/modules/regulatory-radar/providers/cnbv.provider';
import { CNBV_REGULATIONS_PATH } from '../../src/modules/regulatory-radar/providers/cnbv.types';
import { DofClient } from '../../src/modules/regulatory-radar/providers/dof.provider';
import { DOF_PUBLICATIONS_BY_DATE_PATH } from '../../src/modules/regulatory-radar/providers/dof.types';
import { RegulatoryRadarService } from '../../src/modules/regulatory-radar/regulatory-radar.service';

class RoutingCroma implements CromaCallable {
  readonly calls: Array<{ path: string; body: unknown }> = [];

  constructor(
    private readonly routes: {
      dof?: (date: string) => SourceResult<unknown>;
      cnbv?: () => SourceResult<unknown>;
    },
  ) {}

  async call<T>(path: string, body: unknown, _options: CallOptions): Promise<SourceResult<T>> {
    this.calls.push({ path, body });

    if (path === DOF_PUBLICATIONS_BY_DATE_PATH) {
      const date = (body as { date: string }).date;
      return (this.routes.dof?.(date) ?? sourceUnavailable('mx.dof', 'http_500')) as SourceResult<T>;
    }
    if (path === CNBV_REGULATIONS_PATH) {
      return (this.routes.cnbv?.() ?? sourceUnavailable('mx.cnbv', 'http_500')) as SourceResult<T>;
    }
    throw new Error(`unexpected path ${path}`);
  }
}

function dofDay(date: string, titles: string[]) {
  return sourceOk('mx.dof', {
    date,
    published: titles.length > 0,
    total: titles.length,
    publications: titles.map((title, index) => ({
      id: `${date}-${index}`,
      title,
      agency: 'SHCP',
      branch: 'EJECUTIVO',
    })),
  });
}

function cnbvList(regulations: Array<Record<string, unknown>>) {
  return sourceOk('mx.cnbv', {
    regulations,
    pagination: { total: regulations.length, page_size: 50, total_pages: 1, page: 1 },
  });
}

const NOW = () => new Date('2026-08-13T12:00:00.000Z');
const options = { keywords: ['comisiones bancarias', 'PyME'], scanDays: 2, cacheTtlMs: 60_000, maxAlerts: 20, maxRulebookPages: 3, now: NOW };

function build(routes: ConstructorParameters<typeof RoutingCroma>[0], overrides: Partial<typeof options> = {}) {
  const croma = new RoutingCroma(routes);
  const cache = new MemoryCacheStore();
  const service = new RegulatoryRadarService(new DofClient(croma), new CnbvClient(croma), cache, {
    ...options,
    ...overrides,
  });
  return { croma, service };
}

describe('RegulatoryRadarService', () => {
  it('scans one gazette date per day and keeps only matching titles', async () => {
    const { croma, service } = build({
      dof: (date) =>
        date === '2026-08-13'
          ? dofDay(date, ['ACUERDO sobre comisiones bancarias', 'Aviso de licitación de carreteras'])
          : dofDay(date, []),
      cnbv: () => cnbvList([]),
    });

    const result = await service.scan();

    expect(result.available).toBe(true);
    expect(result.data?.scanned_dates).toEqual(['2026-08-13', '2026-08-12']);
    expect(result.data?.alerts).toHaveLength(1);
    expect(result.data?.alerts[0]).toMatchObject({
      source: 'mx.dof',
      title: 'ACUERDO sobre comisiones bancarias',
      published_at: '2026-08-13',
      agency: 'SHCP',
    });
    expect(croma.calls.filter((c) => c.path === DOF_PUBLICATIONS_BY_DATE_PATH)).toHaveLength(2);
  });

  it('does not let a short keyword fire inside a longer word', async () => {
    const { service } = build(
      {
        dof: (date) =>
          date === '2026-08-13'
            ? dofDay(date, ['ACUERDO sobre imagenes SATELITE y satisfaccion del usuario', 'Reglas del SAT para facturacion'])
            : dofDay(date, []),
        cnbv: () => cnbvList([]),
      },
      { keywords: ['SAT'] },
    );

    const result = await service.scan();

    expect(result.data?.alerts).toHaveLength(1);
    expect(result.data?.alerts[0]?.title).toBe('Reglas del SAT para facturacion');
  });

  it('matches ignoring case and accents', async () => {
    const { service } = build({
      dof: (date) => dofDay(date, ['RESOLUCIÓN sobre COMISIONES BANCÁRIAS y otros temas']),
      cnbv: () => cnbvList([]),
    });

    const result = await service.scan();

    expect(result.data?.alerts.length).toBeGreaterThanOrEqual(1);
  });

  it('spends exactly one request on the rulebook regardless of the scan window', async () => {
    const { croma, service } = build({ dof: (date) => dofDay(date, []), cnbv: () => cnbvList([]) }, { scanDays: 5 });

    await service.scan();

    expect(croma.calls.filter((c) => c.path === CNBV_REGULATIONS_PATH)).toHaveLength(1);
  });

  it('keeps standing rules whatever their age, and labels them apart from gazette news', async () => {
    const { service } = build({
      dof: (date) => (date === '2026-08-13' ? dofDay(date, ['ACUERDO sobre PyME']) : dofDay(date, [])),
      cnbv: () =>
        cnbvList([
          { regulation_id: 'r1', name: 'Circular PyME reciente', type: 'Circular', dof_date: '2026-08-13', sectors: [], pdf_url: null },
          { regulation_id: 'r2', name: 'Circular PyME de 2019', type: 'Circular', dof_date: '2019-01-01', sectors: [], pdf_url: null },
          { regulation_id: 'r3', name: 'Circular PyME sin fecha', type: 'Circular', dof_date: null, sectors: [], pdf_url: null },
        ]),
    });

    const result = await service.scan();
    const alerts = result.data?.alerts ?? [];
    const ids = alerts.map((a) => a.external_id);

    expect(ids).toEqual(expect.arrayContaining(['r1', 'r2', 'r3']));
    expect(alerts.filter((a) => a.source === 'mx.cnbv').every((a) => a.kind === 'standing_rule')).toBe(true);
    expect(alerts[0]?.kind).toBe('publication');
  });

  it('reports a partial scan instead of failing when one source is down', async () => {
    const { service } = build({
      dof: (date) => dofDay(date, ['ACUERDO de comisiones bancarias']),
      cnbv: () => sourceUnavailable('mx.cnbv', 'http_502'),
    });

    const result = await service.scan();

    expect(result.available).toBe(true);
    expect(result.data?.sources_available).toEqual(['mx.dof']);
    expect(result.data?.sources_unavailable).toEqual(['mx.cnbv']);
    expect(result.data?.alerts.map((a) => a.published_at)).toEqual(['2026-08-13', '2026-08-12']);
  });

  it('degrades only when every source is down', async () => {
    const { service } = build({
      dof: () => sourceUnavailable('mx.dof', 'http_500'),
      cnbv: () => sourceUnavailable('mx.cnbv', 'http_500'),
    });

    const result = await service.scan();

    expect(result.available).toBe(false);
    expect(result.error).toBe('all_sources_unavailable');
  });

  it('reuses the cached scan instead of spending the window again', async () => {
    const { croma, service } = build({ dof: (date) => dofDay(date, []), cnbv: () => cnbvList([]) });

    await service.scan();
    const callsAfterFirst = croma.calls.length;
    await service.scan();

    expect(croma.calls).toHaveLength(callsAfterFirst);
  });

  it('finds nothing when no keyword is configured, rather than returning everything', async () => {
    const { service } = build(
      { dof: (date) => dofDay(date, ['ACUERDO sobre comisiones bancarias']), cnbv: () => cnbvList([]) },
      { keywords: [] },
    );

    const result = await service.scan();

    expect(result.available).toBe(true);
    expect(result.data?.alerts).toHaveLength(0);
  });

  it('reports a date it could not read, so silence is not mistaken for no news', async () => {
    const { service } = build({
      dof: (date) =>
        date === '2026-08-13'
          ? dofDay(date, ['ACUERDO sobre PyME'])
          : sourceUnavailable('mx.dof', 'invalid_response_shape'),
      cnbv: () => cnbvList([]),
    });

    const result = await service.scan();

    expect(result.available).toBe(true);
    expect(result.data?.failed_dates).toEqual(['2026-08-12']);
    expect(result.data?.sources_available).toContain('mx.dof');
  });

  it('skips gazette entries that carry no title instead of dropping the whole day', async () => {
    const { service } = build({
      dof: (date) =>
        sourceOk('mx.dof', {
          date,
          published: true,
          total: 2,
          publications: [
            { id: `${date}-a`, title: null, agency: 'PRESIDENCIA', branch: 'EJECUTIVO' },
            { id: `${date}-b`, title: 'ACUERDO sobre PyME', agency: 'SE', branch: 'EJECUTIVO' },
          ],
        }),
      cnbv: () => cnbvList([]),
    });

    const result = await service.scan();

    expect(result.data?.failed_dates).toEqual([]);
    expect(result.data?.alerts.every((a) => a.external_id.endsWith('-b'))).toBe(true);
    expect(result.data?.alerts.length).toBe(2);
  });

  it('walks the rulebook pages instead of stopping at the first', async () => {
    let page = 0;
    const { croma, service } = build({
      dof: (date) => dofDay(date, []),
      cnbv: () => {
        page++;
        return sourceOk('mx.cnbv', {
          regulations: [
            { regulation_id: `p${page}`, name: `Circular PyME ${page}`, type: 'Circular', dof_date: null, sectors: [], pdf_url: null },
          ],
          pagination: { total: 113, page_size: 50, total_pages: 3, page },
        });
      },
    });

    const result = await service.scan();

    expect(croma.calls.filter((c) => c.path === CNBV_REGULATIONS_PATH)).toHaveLength(3);
    expect(result.data?.alerts.filter((a) => a.source === 'mx.cnbv')).toHaveLength(3);
  });

  it('returns newest first and caps the list', async () => {
    const { service } = build(
      {
        dof: (date) => dofDay(date, ['PyME uno', 'PyME dos']),
        cnbv: () => cnbvList([]),
      },
      { maxAlerts: 3 },
    );

    const result = await service.scan();
    const dates = result.data?.alerts.map((a) => a.published_at) ?? [];

    expect(result.data?.alerts).toHaveLength(3);
    expect([...dates]).toEqual([...dates].sort().reverse());
  });
});
