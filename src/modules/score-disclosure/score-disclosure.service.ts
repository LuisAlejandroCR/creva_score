// score-disclosure: what the score declares about itself. See D-07.

export type SignalProvenance = 'observed' | 'documentary' | 'self_declared';

export type ScoreKind = 'descriptive';

export interface ProvenanceLevel {
  level: SignalProvenance;
  label: string;
  meaning: string;
}

export interface ScoreDisclosure {
  score_version: string;
  kind: ScoreKind;
  window_days: number;
  describes: string;
  does_not_estimate: string[];
  provenance_levels: ProvenanceLevel[];
  checked_at: string;
}

export interface ScoreDisclosureConfig {
  scoreVersion: string;
  windowDays: number;
  now?: () => Date;
}

const PROVENANCE_LEVELS: ProvenanceLevel[] = [
  {
    level: 'observed',
    label: 'Observado',
    meaning: 'Lo registramos nosotros directamente. No depende de que nadie nos lo cuente.',
  },
  {
    level: 'documentary',
    label: 'Documental',
    meaning: 'Viene de un documento que subiste, con fechas y totales que se pueden contrastar entre sí.',
  },
  {
    level: 'self_declared',
    label: 'Autodeclarado',
    meaning: 'Lo escribiste tú. No lo hemos verificado, y se muestra siempre como tal.',
  },
];

const DOES_NOT_ESTIMATE = [
  'La probabilidad de que dejes de pagar un crédito.',
  'Tu historial crediticio, ni lo sustituye.',
  'Una decisión de una institución financiera: ninguna está obligada a considerarlo.',
];

export function buildScoreDisclosure(config: ScoreDisclosureConfig): ScoreDisclosure {
  const now = config.now ? config.now() : new Date();

  return {
    score_version: config.scoreVersion,
    kind: 'descriptive',
    window_days: config.windowDays,
    describes: `Cómo ha operado tu negocio en los últimos ${config.windowDays} días.`,
    does_not_estimate: [...DOES_NOT_ESTIMATE],
    provenance_levels: PROVENANCE_LEVELS.map((level) => ({ ...level })),
    checked_at: now.toISOString(),
  };
}

export function renderScoreDisclosure(disclosure: ScoreDisclosure): string {
  const lines = [
    'Qué es este puntaje',
    '-------------------',
    `  Describe: ${disclosure.describes}`,
    `  Ventana:  ${disclosure.window_days} días · versión ${disclosure.score_version}`,
    '',
    '  Lo que NO hace:',
  ];

  for (const claim of disclosure.does_not_estimate) lines.push(`    · ${claim}`);

  lines.push('', '  De dónde sale cada dato:');
  for (const level of disclosure.provenance_levels) lines.push(`    · ${level.label}: ${level.meaning}`);

  return lines.join('\n');
}
