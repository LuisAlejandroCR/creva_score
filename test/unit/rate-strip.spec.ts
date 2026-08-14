import { buildRateStrip } from '../../src/cli/report/rate-strip';
import type { ReportSignal } from '../../src/common/types/creva-report.types';

function rate(label: string, detail: string, checked_at: string | null = '2026-08-14'): ReportSignal {
  return {
    key: `rate:${label}`,
    category: 'reference_rate',
    label,
    tone: 'neutral',
    detail,
    source: 'Banco de México · SIE',
    checked_at,
    evidence_url: null,
  };
}

const REAL_RATES = [
  rate('Tasa objetivo de Banxico', '6.5%'),
  rate('TIIE a 28 días', '6.7358%'),
  rate('Cetes a 28 días', '6.4%', '2026-08-11'),
  rate('Valor de la UDI', '8.807141 MXN', '2026-08-25'),
];

describe('buildRateStrip', () => {
  it('keeps a value that is not a percentage off the axis entirely', () => {
    const strip = buildRateStrip(REAL_RATES);

    expect(strip?.points.map((point) => point.label)).toEqual([
      'Tasa objetivo de Banxico',
      'TIIE a 28 días',
      'Cetes a 28 días',
    ]);
    expect(JSON.stringify(strip)).not.toContain('UDI');
  });

  it('never stretches a small spread across the whole width', () => {
    const strip = buildRateStrip(REAL_RATES);
    const positions = strip?.points.map((point) => point.position) ?? [];

    // A domain drawn tight on the data would put the extremes at 0 and 100.
    expect(Math.min(...positions)).toBeGreaterThan(5);
    expect(Math.max(...positions)).toBeLessThan(95);
  });

  it('states a domain that actually contains every point it draws', () => {
    const strip = buildRateStrip(REAL_RATES);

    for (const point of strip?.points ?? []) {
      expect(point.value).toBeGreaterThan(strip?.domain_low ?? 0);
      expect(point.value).toBeLessThan(strip?.domain_high ?? 0);
    }
  });

  it('places a lone rate in the middle rather than dividing by zero', () => {
    const strip = buildRateStrip([rate('Tasa objetivo de Banxico', '6.5%')]);

    expect(strip?.points).toHaveLength(1);
    expect(strip?.points[0]?.position).toBe(50);
  });

  it('orders the axis so a higher rate never sits to the left of a lower one', () => {
    const strip = buildRateStrip(REAL_RATES);
    const byValue = [...(strip?.points ?? [])].sort((a, b) => a.value - b.value);

    for (let i = 1; i < byValue.length; i++) {
      expect(byValue[i]!.position).toBeGreaterThan(byValue[i - 1]!.position);
    }
  });

  it('returns nothing when no value can be compared', () => {
    expect(buildRateStrip([rate('Valor de la UDI', '8.807141 MXN')])).toBeNull();
    expect(buildRateStrip([])).toBeNull();
  });
});
