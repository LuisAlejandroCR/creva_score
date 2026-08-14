// timeline: the dated signals laid out on a shared axis, for the screen and for paper.

import { SourceLane, escapeHtml, formatDate } from './lanes';

// Two dots closer than this on the same lane are drawn stacked instead of on top of each other.
const MIN_GAP = 2.2;
const MAX_LEVEL = 3;
const STEP_PX = 11;
const BASE_PX = 24;
const MAX_TICKS = 5;

export interface TimelinePoint {
  index: number;
  key: string;
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

export interface TimelineYear {
  year: number;
  count: number;
}

export interface TimelineData {
  rows: TimelineRow[];
  points: TimelinePoint[];
  ticks: TimelineTick[];
  years: TimelineYear[];
  first: string;
  last: string;
  newest: number;
}

export function buildTimeline(lanes: SourceLane[]): TimelineData | null {
  const dated = lanes.flatMap((lane, laneIndex) =>
    lane.signals
      .filter((signal) => signal.checked_at !== null)
      .map((signal) => ({
        key: signal.key,
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
    years: buildYears(points),
    first: new Date(first).toISOString().slice(0, 10),
    last: new Date(last).toISOString().slice(0, 10),
    newest: points.reduce((top, point) => (point.at > (points[top]?.at ?? '') ? point.index : top), 0),
  };
}

// Only the years that actually hold a signal, newest first, each with how many.
function buildYears(points: TimelinePoint[]): TimelineYear[] {
  const counts = new Map<number, number>();
  for (const point of points) {
    const year = Number(point.at.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);
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

  // The ends only appear when there are no year ticks; with them they say the same twice.
  const ends =
    data.ticks.length > 0
      ? ''
      : `<div class="tl-ends"><span>${escapeHtml(formatDate(data.first))}</span><span>${escapeHtml(formatDate(data.last))}</span></div>`;

  return `<div class="card tl-card">
    <p class="card-title">Cuándo se publicó cada señal</p>
    <div class="tl">${grid}${axis}</div>
    ${ends}
    <p class="tl-peek" id="tl-peek" aria-hidden="true"><span class="tl-peek-hint">Pasa el cursor por un punto para verlo; toca para ir a su documento.</span></p>
  </div>`;
}

// It sits with the source selector, not inside the timeline card, because it narrows the
// whole stage: the bars, the dots and the evidence all read from it.
export function yearSlicer(lanes: SourceLane[]): string {
  const data = buildTimeline(lanes);
  return data === null ? '' : slicer(data);
}

// Years are an axis, not a set of tags: a reader asks for "the last five", not for 2014
// and 2019 but not 2016. Two native ranges over the years that exist give that, with
// keyboard support included and without landing on a year that holds nothing.
function slicer(data: TimelineData): string {
  if (data.years.length < 2) return '';

  const years = [...data.years].sort((a, b) => a.year - b.year);
  const last = years.length - 1;
  const from = years[0] as TimelineYear;
  const to = years[last] as TimelineYear;

  return `<div class="tl-slice" id="tl-slice" data-years="${years.map((entry) => entry.year).join(',')}">
    <div class="tl-slice-top">
      <p class="tl-slice-out" id="tl-slice-out">
        <label class="tl-typed"><span class="sr-only">Desde el año</span><input class="tl-year-in" id="tl-year-from" type="number" inputmode="numeric" min="${from.year}" max="${to.year}" step="1" value="${from.year}"></label>
        <span class="tl-typed-dash" aria-hidden="true">–</span>
        <label class="tl-typed"><span class="sr-only">Hasta el año</span><input class="tl-year-in" id="tl-year-to" type="number" inputmode="numeric" min="${from.year}" max="${to.year}" step="1" value="${to.year}"></label>
        <span class="tl-slice-count">· <span id="tl-slice-n">${data.points.length}</span> de ${data.points.length} señales</span>
      </p>
      <button class="tl-slice-all" id="tl-slice-all" type="button" hidden>Todos los años</button>
    </div>
    <div class="tl-slice-rails" style="--a:0%;--b:100%">
      <input class="tl-slice-in" id="tl-from" type="range" min="0" max="${last}" step="1" value="0"
        aria-label="Desde el año" aria-valuetext="${from.year}">
      <input class="tl-slice-in" id="tl-to" type="range" min="0" max="${last}" step="1" value="${last}"
        aria-label="Hasta el año" aria-valuetext="${to.year}">
    </div>
    <p class="tl-slice-ends"><span>${from.year}</span><span>${to.year}</span></p>
  </div>`;
}

// A dot points at the row that holds the whole record; what it carries here is only what
// the preview line needs, so a reader can tell where a click goes before spending it.
function dot(point: TimelinePoint, depth: number, newest: number): string {
  const dy = (point.level - depth / 2) * STEP_PX;

  return `<button class="tl-dot d${point.laneIndex}${point.index === newest ? ' picked' : ''}" data-lane="${point.laneId}"
      type="button" data-point="${point.index}" data-at="${point.at}" data-key="${escapeHtml(point.key)}"
      data-year="${point.at.slice(0, 4)}" data-short="${escapeHtml(point.laneShort)}"
      data-when="${escapeHtml(formatDate(point.at))}" data-detail="${escapeHtml(point.detail)}"
      style="left:${point.left.toFixed(1)}%;--dy:${dy.toFixed(1)}px"
      aria-label="${escapeHtml(point.laneShort)}, ${escapeHtml(formatDate(point.at))}: ${escapeHtml(point.detail)}"></button>`;
}

