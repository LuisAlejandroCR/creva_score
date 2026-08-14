import fc from 'fast-check';
import { SourceLane } from '../../src/cli/report/lanes';
import { buildTimeline } from '../../src/cli/report/timeline';
import { ReportSignal } from '../../src/common/types/creva-report.types';

const MAX_LEVEL = 3;
const LANES = ['siem', 'dof', 'cnbv', 'banxico'];

function signal(at: string, key: string): ReportSignal {
  return {
    key,
    category: 'regulatory',
    label: 'Regla vigente que aplica',
    tone: 'neutral',
    detail: key,
    source: 'Normas vigentes de la CNBV',
    checked_at: at,
    evidence_url: null,
  };
}

function lanesOf(dates: string[][]): SourceLane[] {
  return LANES.map((id, index) => ({
    id,
    short: id.toUpperCase(),
    name: id,
    mark: '●',
    blurb: '',
    signals: (dates[index] ?? []).map((at, i) => signal(at, `${id}-${i}`)),
  }));
}

const date = fc
  .date({ min: new Date('2000-01-01T00:00:00.000Z'), max: new Date('2030-12-31T00:00:00.000Z') })
  .map((value) => value.toISOString().slice(0, 10));

const spread = fc.array(fc.array(date, { maxLength: 12 }), { minLength: 4, maxLength: 4 });

describe('the timeline never moves a date to make room', () => {
  it('places every dot at the true linear position of its own date', () => {
    fc.assert(
      fc.property(spread, (dates) => {
        const data = buildTimeline(lanesOf(dates));
        if (data === null) return;

        const first = Date.parse(data.first);
        const span = Date.parse(data.last) - first;

        for (const point of data.points) {
          expect(point.left).toBeCloseTo(((Date.parse(point.at) - first) / span) * 100, 6);
        }
      }),
    );
  });

  it('keeps every dot inside the span it prints', () => {
    fc.assert(
      fc.property(spread, (dates) => {
        const data = buildTimeline(lanesOf(dates));
        if (data === null) return;

        for (const point of data.points) {
          expect(point.left).toBeGreaterThanOrEqual(0);
          expect(point.left).toBeLessThanOrEqual(100);
          expect(point.at >= data.first && point.at <= data.last).toBe(true);
        }
      }),
    );
  });

  it('carries every dated signal it was given, and invents none', () => {
    fc.assert(
      fc.property(spread, (dates) => {
        const lanes = lanesOf(dates);
        const data = buildTimeline(lanes);
        const given = lanes.flatMap((lane) => lane.signals.filter((s) => s.checked_at !== null));
        if (data === null) return;

        expect(data.points).toHaveLength(given.length);
        expect([...data.points].map((point) => point.detail).sort()).toEqual(given.map((s) => s.detail).sort());
      }),
    );
  });

  // Row height is BASE + depth × STEP, so an unbounded level is an unbounded page.
  it('never stacks a lane deeper than the printable page allows', () => {
    fc.assert(
      fc.property(spread, (dates) => {
        const data = buildTimeline(lanesOf(dates));
        if (data === null) return;

        for (const row of data.rows) {
          expect(row.depth).toBeLessThanOrEqual(MAX_LEVEL);
          expect(row.depth).toBe(Math.max(...row.points.map((point) => point.level)));
          for (const point of row.points) expect(point.level).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  // The control case: four dates a few hours apart must land on four different levels,
  // or the dots are drawn on top of each other and the guard has no teeth.
  it('separates a cluster that a single track would draw as one dot', () => {
    const data = buildTimeline(
      lanesOf([['2020-01-01'], [], [], ['2026-08-11', '2026-08-14', '2026-08-14', '2026-08-25']]),
    );

    const banxico = data?.rows.find((row) => row.laneId === 'banxico');

    expect(banxico?.depth).toBe(3);
    expect([...(banxico?.points ?? [])].map((point) => point.level).sort()).toEqual([0, 1, 2, 3]);
  });
});
