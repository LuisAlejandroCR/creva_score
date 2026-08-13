// creva-report: the stable result the presentation layer consumes. See B14.

import { ScoreDisclosure } from '../../modules/score-disclosure/score-disclosure.service';

export type SignalCategory = 'business_verification' | 'regulatory' | 'reference_rate';

// No 'negative': nothing surfaced here counts against the subject. Absence is not a signal.
export type SignalTone = 'positive' | 'neutral' | 'unavailable';

export interface ReportSubject {
  business_name: string;
  state_code: number | null;
}

export interface ReportSignal {
  key: string;
  category: SignalCategory;
  label: string;
  tone: SignalTone;
  detail: string;
  source: string;
  checked_at: string | null;
  evidence_url: string | null;
}

export interface ReportSource {
  provider: string;
  dataset: string;
  queried_at: string | null;
}

export interface CrevaReport {
  generated_at: string;
  subject: ReportSubject | null;
  signals: ReportSignal[];
  sources: ReportSource[];
  disclosure: ScoreDisclosure;
  notes: string[];
}

export interface ReportInput {
  subject: ReportSubject | null;
  signals: ReportSignal[];
  sources: ReportSource[];
  disclosure: ScoreDisclosure;
  notes?: string[];
  now?: () => Date;
}

export function buildCrevaReport(input: ReportInput): CrevaReport {
  const now = input.now ? input.now() : new Date();

  return {
    generated_at: now.toISOString(),
    subject: input.subject === null ? null : { ...input.subject },
    signals: input.signals.map((signal) => ({ ...signal })),
    sources: dedupeSources(input.sources),
    disclosure: input.disclosure,
    notes: [...(input.notes ?? [])],
  };
}

export function signalsByCategory(report: CrevaReport, category: SignalCategory): ReportSignal[] {
  return report.signals.filter((signal) => signal.category === category);
}

export function countByTone(report: CrevaReport): Record<SignalTone, number> {
  const counts: Record<SignalTone, number> = { positive: 0, neutral: 0, unavailable: 0 };
  for (const signal of report.signals) counts[signal.tone] += 1;
  return counts;
}

function dedupeSources(sources: ReportSource[]): ReportSource[] {
  const seen = new Set<string>();
  const unique: ReportSource[] = [];

  for (const source of sources) {
    const key = `${source.provider}|${source.dataset}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...source });
  }
  return unique;
}
