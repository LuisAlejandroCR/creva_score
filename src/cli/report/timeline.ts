// timeline: the dated signals laid out on a shared axis, for the screen and for paper.

import { SourceLane, escapeHtml, formatDate, plural } from './lanes';

// Two dots closer than this on the same lane are drawn stacked instead of on top of each other.
const MIN_GAP = 2.2;
const MAX_LEVEL = 3;
const STEP_PX = 11;
const STEP_MM = 2.9;
const BASE_PX = 24;
const BASE_MM = 6.4;
const MAX_TICKS = 5;

export interface TimelinePoint {
  index: number;
  laneIndex: number;
  laneId: string;
  laneShort: string;
  at: string;
  left: number;
  level: number;
  label: string;
  detail: string;
  source: string;
  url: string | null;
}

export interface TimelineRow {
  laneIndex: number;
  laneId: string;
  laneShort: string;
  depth: number;
  points: TimelinePoint[];
}

export interface TimelineTick {
  year: number;
  left: number;
  align: 's' | 'e' | '';
}

export interface TimelineData {
  rows: TimelineRow[];
  points: TimelinePoint[];
  ticks: TimelineTick[];
  first: string;
  last: string;
  newest: number;
}

export function buildTimeline(lanes: SourceLane[]): TimelineData | null {
  const dated = lanes.flatMap((lane, laneIndex) =>
    lane.signals
      .filter((signal) => signal.checked_at !== null)
      .map((signal) => ({
        laneIndex,
        laneId: lane.id,
        laneShort: lane.short,
        at: (signal.checked_at as string).slice(0, 10),
        label: signal.label,
        detail: signal.detail,
        source: signal.source,
        url: signal.evidence_url,
      })),
  );
  if (dated.length < 2) return null;

  const stamps = dated.map((point) => Date.parse(point.at)).filter((value) => Number.isFinite(value));
  if (stamps.length < 2) return null;
  const first = Math.min(...stamps);
  const last = Math.max(...stamps);
  const span = last - first;
  if (span <= 0) return null;

  const points: TimelinePoint[] = dated.map((point, index) => ({
    ...point,
    index,
    left: ((Date.parse(point.at) - first) / span) * 100,
    level: 0,
  }));

  const rows: TimelineRow[] = [];
  for (const point of points) {
    const row = rows.find((candidate) => candidate.laneId === point.laneId);
    if (row === undefined) {
      rows.push({
        laneIndex: point.laneIndex,
        laneId: point.laneId,
        laneShort: point.laneShort,
        depth: 0,
        points: [point],
      });
      continue;
    }
    row.points.push(point);
  }

  for (const row of rows) row.depth = stack(row.points);

  return {
    rows,
    points,
    ticks: buildTicks(first, last, span),
    first: new Date(first).toISOString().slice(0, 10),
    last: new Date(last).toISOString().slice(0, 10),
    newest: points.reduce((top, point) => (point.at > (points[top]?.at ?? '') ? point.index : top), 0),
  };
}

// The horizontal position always stays true to the date; a collision only moves the dot
// down to the lowest level that is still clear at that date.
function stack(points: TimelinePoint[]): number {
  const taken: number[] = [];
  let depth = 0;

  for (const point of [...points].sort((a, b) => a.left - b.left)) {
    let level = 0;
    while (level <= MAX_LEVEL && point.left - (taken[level] ?? -Infinity) < MIN_GAP) level += 1;
    if (level > MAX_LEVEL) level = 0;

    taken[level] = point.left;
    point.level = level;
    depth = Math.max(depth, level);
  }
  return depth;
}

function buildTicks(first: number, last: number, span: number): TimelineTick[] {
  const firstYear = new Date(first).getUTCFullYear();
  const lastYear = new Date(last).getUTCFullYear();
  if (lastYear <= firstYear) return [];

  const step = Math.max(1, Math.ceil((lastYear - firstYear) / (MAX_TICKS - 1)));
  const years: number[] = [];
  for (let year = firstYear; year < lastYear; year += step) years.push(year);
  years.push(lastYear);

  return years.map((year) => {
    const left = Math.min(100, Math.max(0, ((Date.UTC(year, 0, 1) - first) / span) * 100));
    return { year, left, align: left < 6 ? 's' : left > 94 ? 'e' : '' };
  });
}

export function timeline(lanes: SourceLane[]): string {
  const data = buildTimeline(lanes);
  if (data === null) return '';

  const filters = [{ id: 'all', short: 'Todas' }, ...data.rows.map((row) => ({ id: row.laneId, short: row.laneShort }))]
    .map(
      (filter, index) =>
        `<button class="tl-filter${index === 0 ? ' selected' : ''}" type="button" data-tlfilter="${filter.id}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(filter.short)}</button>`,
    )
    .join('');

  const grid = data.rows
    .map(
      (row) => `<span class="tl-name d${row.laneIndex}">${escapeHtml(row.laneShort)}</span>
      <span class="tl-track" style="--h:${BASE_PX + row.depth * STEP_PX}px">${row.points.map((point) => dot(point, row.depth, data.newest)).join('')}</span>`,
    )
    .join('');

  const axis =
    data.ticks.length === 0
      ? ''
      : `<span></span><span class="tl-axis">${data.ticks
          .map((tick) => `<span class="tl-tick ${tick.align}" style="left:${tick.left.toFixed(1)}%">${tick.year}</span>`)
          .join('')}</span>`;

  return `<div class="card tl-card">
    <p class="card-title">Cuándo se publicó cada señal</p>
    <div class="tl-filters" role="group" aria-label="Filtrar la línea de tiempo por fuente">${filters}</div>
    <p class="tl-count" id="tl-count" aria-live="polite">${data.points.length} ${plural(data.points.length, 'señal fechada', 'señales fechadas')}</p>
    <div class="tl">${grid}${axis}</div>
    <div class="tl-ends"><span>${escapeHtml(formatDate(data.first))}</span><span>${escapeHtml(formatDate(data.last))}</span></div>
    ${detail(data.points[data.newest])}
  </div>`;
}

function dot(point: TimelinePoint, depth: number, newest: number): string {
  const dy = (point.level - depth / 2) * STEP_PX;

  return `<button class="tl-dot d${point.laneIndex}${point.index === newest ? ' picked' : ''}" data-lane="${point.laneId}"
      type="button" data-point="${point.index}" data-at="${point.at}"
      style="left:${point.left.toFixed(1)}%;--dy:${dy.toFixed(1)}px"
      aria-label="${escapeHtml(point.laneShort)}, ${escapeHtml(formatDate(point.at))}: ${escapeHtml(point.detail)}"
      data-short="${escapeHtml(point.laneShort)}" data-date="${escapeHtml(formatDate(point.at))}"
      data-detail="${escapeHtml(point.detail)}" data-url="${point.url === null ? '' : escapeHtml(point.url)}"></button>`;
}

function detail(point: TimelinePoint | undefined): string {
  if (point === undefined) return '';

  return `<div class="tl-detail" id="tl-detail" aria-live="polite">
    <p class="tl-detail-top">
      <span class="tl-chip d${point.laneIndex}" id="tl-detail-chip">${escapeHtml(point.laneShort)}</span>
      <span class="tl-detail-date" id="tl-detail-date">${escapeHtml(formatDate(point.at))}</span>
    </p>
    <p class="tl-detail-text" id="tl-detail-text">${escapeHtml(point.detail)}</p>
    <a class="doc" id="tl-detail-doc" href="${point.url === null ? '' : escapeHtml(point.url)}" target="_blank" rel="noopener"${point.url === null ? ' hidden' : ''}>Ver documento oficial <span class="doc-go" aria-hidden="true">→</span></a>
  </div>`;
}

export function paperTimeline(lanes: SourceLane[]): string {
  const data = buildTimeline(lanes);
  if (data === null) return '';

  const grid = data.rows
    .map(
      (row) => `<span class="p-tl-name">${escapeHtml(row.laneShort)}</span>
      <span class="p-tl-track" style="--hm:${(BASE_MM + row.depth * STEP_MM).toFixed(1)}mm">${row.points
        .map(
          (point) =>
            `<span class="p-tl-dot d${point.laneIndex}" style="left:${point.left.toFixed(1)}%;--dym:${((point.level - row.depth / 2) * STEP_MM).toFixed(2)}mm"></span>`,
        )
        .join('')}</span>`,
    )
    .join('');

  const axis =
    data.ticks.length === 0
      ? ''
      : `<span></span><span class="p-tl-axis">${data.ticks
          .map(
            (tick) => `<span class="p-tl-tick ${tick.align}" style="left:${tick.left.toFixed(1)}%">${tick.year}</span>`,
          )
          .join('')}</span>`;

  return `<div class="p-tl">${grid}${axis}</div>`;
}
