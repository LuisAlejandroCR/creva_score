// lanes: the source groups a report is presented through, and the formatting they share.

import { CrevaReport, ReportSignal } from '../../common/types/creva-report.types';

export interface SourceLane {
  id: string;
  short: string;
  name: string;
  mark: string;
  blurb: string;
  signals: ReportSignal[];
}

export interface Insight {
  lane: string;
  mark: string;
  text: string;
}

const STATUS_WORD: Record<string, string> = {
  positive: 'Verificado',
  neutral: 'Sin sello',
  unavailable: 'No disponible',
};

// Banxico arrives as a compact group of four, so folding it to three would hide a quarter of it.
const INITIAL_VISIBLE: Record<string, number> = { banxico: 4 };
const DEFAULT_VISIBLE = 3;

export function buildLanes(report: CrevaReport): SourceLane[] {
  const of = (predicate: (signal: ReportSignal) => boolean): ReportSignal[] => report.signals.filter(predicate);

  return [
    {
      id: 'siem',
      short: 'SIEM',
      name: 'Directorio de establecimientos',
      mark: '●',
      blurb: 'Si el negocio está inscrito, y desde cuándo.',
      signals: of((s) => s.category === 'business_verification'),
    },
    {
      id: 'dof',
      short: 'DOF',
      name: 'Diario Oficial de la Federación',
      mark: '↗',
      blurb: 'Lo que se publicó en los últimos días.',
      signals: of((s) => s.category === 'regulatory' && s.label.startsWith('Novedad')),
    },
    {
      id: 'cnbv',
      short: 'CNBV',
      name: 'Normas bancarias vigentes',
      mark: '◎',
      blurb: 'Reglas que ya estaban y siguen aplicando.',
      signals: of((s) => s.category === 'regulatory' && !s.label.startsWith('Novedad')),
    },
    {
      id: 'banxico',
      short: 'BANXICO',
      name: 'Banco de México',
      mark: '≈',
      blurb: 'Cuánto cuesta el dinero hoy.',
      signals: of((s) => s.category === 'reference_rate'),
    },
  ];
}

export function buildInsights(lanes: SourceLane[]): Insight[] {
  const list: Insight[] = [];

  for (const lane of lanes) {
    if (lane.id === 'banxico') continue;
    const count = lane.signals.length;

    if (lane.id === 'siem') {
      const tone = lane.signals[0]?.tone;
      if (tone === 'positive') list.push({ lane: lane.id, mark: '✓', text: 'Negocio encontrado en SIEM' });
      else if (tone === 'unavailable') list.push({ lane: lane.id, mark: '·', text: 'Directorio SIEM no disponible' });
      else if (tone === undefined) list.push({ lane: lane.id, mark: '·', text: 'Sin consulta al directorio SIEM' });
      else list.push({ lane: lane.id, mark: '·', text: 'Sin sello en SIEM' });
      continue;
    }

    if (lane.id === 'dof') {
      list.push({
        lane: lane.id,
        mark: count > 0 ? '✓' : '·',
        text:
          count > 0
            ? `${count} ${plural(count, 'novedad reciente', 'novedades recientes')} en DOF`
            : 'Sin novedades en DOF',
      });
      continue;
    }

    list.push({
      lane: lane.id,
      mark: count > 0 ? '✓' : '·',
      text:
        count > 0
          ? `${count} ${plural(count, 'referencia vigente', 'referencias vigentes')} en CNBV`
          : 'Sin referencias de CNBV',
    });
  }

  return list;
}

export function statusWord(report: CrevaReport): string {
  const verification = report.signals.find((s) => s.category === 'business_verification');
  if (verification === undefined) return 'Revisión general';
  return STATUS_WORD[verification.tone] ?? 'Sin sello';
}

export function visibleFor(laneId: string): number {
  return INITIAL_VISIBLE[laneId] ?? DEFAULT_VISIBLE;
}

export function nextVisible(visible: number, total: number): number {
  if (visible < 6) return Math.min(6, total);
  if (visible < 10) return Math.min(10, total);
  return total;
}

// The label promises only what one press reveals, and states the remainder separately.
export function moreLabel(visible: number, total: number): string {
  const next = nextVisible(visible, total);
  const step = next - visible;
  const left = total - next;

  return left === 0 ? `Mostrar ${step} más →` : `Mostrar ${step} más → quedan ${left}`;
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function isPercent(signal: ReportSignal): boolean {
  return signal.detail.trim().endsWith('%');
}

export function formatDate(value: string): string {
  const iso = value.length === 10 ? `${value}T12:00:00.000Z` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    date,
  );
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
