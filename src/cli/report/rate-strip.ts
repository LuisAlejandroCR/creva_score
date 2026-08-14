// rate-strip: places comparable rates on one axis, with the domain it used stated out loud.

import { ReportSignal } from '../../common/types/creva-report.types';
import { isPercent } from './lanes';

export interface StripPoint {
  label: string;
  text: string;
  value: number;
  position: number;
  checked_at: string | null;
}

export interface RateStrip {
  points: StripPoint[];
  domain_low: number;
  domain_high: number;
}

// A domain drawn tight around the values would stretch a tenth of a point across
// the whole width. The padding keeps the spread readable as the small spread it is.
const PADDING_RATIO = 0.6;
const MIN_PADDING = 0.15;

export function buildRateStrip(signals: ReportSignal[]): RateStrip | null {
  const comparable = signals.filter(isPercent).map((signal) => ({
    label: signal.label,
    text: signal.detail,
    value: Number.parseFloat(signal.detail),
    checked_at: signal.checked_at,
  }));

  const usable = comparable.filter((rate) => Number.isFinite(rate.value));
  if (usable.length === 0) return null;

  const values = usable.map((rate) => rate.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max((high - low) * PADDING_RATIO, MIN_PADDING);
  const domainLow = low - padding;
  const domainHigh = high + padding;
  const span = domainHigh - domainLow;

  return {
    points: usable.map((rate) => ({ ...rate, position: round((rate.value - domainLow) / span) })),
    domain_low: domainLow,
    domain_high: domainHigh,
  };
}

function round(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}
