// demo: command-line entry point that runs both surfaces and prints them for the user.

import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createCrevaScore, createCacheStore } from '../modules/creva-score/creva-score.factory';
import { buildVerificationBadge } from '../modules/business-verification/business-verification.badge';
import {
  BusinessVerification,
  getVerificationStatus,
} from '../modules/business-verification/business-verification.service';
import { isCromaConfigured, loadEnvWithFallback } from '../config/env';
import { RegulatoryAlert, RegulatoryRadar } from '../modules/regulatory-radar/regulatory-radar.service';
import { SourceResult } from '../common/types/source-result.types';
import { CountingCacheStore } from './counting-cache';
import { readEnvFile } from './env-file';
import { buildReport } from '../modules/creva-score/creva-report.builder';
import { renderReportHtml } from './report-html';

export interface DemoArgs {
  businessName?: string;
  stateCode?: number;
  rfc?: string;
  report?: boolean;
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SOURCE_LABELS: Record<string, string> = {
  'mx.siem': 'Directorio oficial de establecimientos (SIEM)',
  'mx.dof': 'Diario Oficial de la Federación',
  'mx.cnbv': 'Normas vigentes de la Comisión Nacional Bancaria y de Valores',
};

export function parseArgs(argv: string[]): DemoArgs {
  const args: DemoArgs = {};

  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = argv[index + 1];

    // Boolean flags carry no value, so they are read before the value guard.
    if (flag === '--reporte' || flag === '--report') args.report = true;

    if (value === undefined || value.startsWith('--')) continue;

    if (flag === '--negocio') args.businessName = value;
    if (flag === '--rfc') args.rfc = value;
    if (flag === '--estado') {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 32) args.stateCode = parsed;
    }
  }
  return args;
}

export function formatDate(value: string | null): string {
  if (value === null) return 'sin fecha';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sin fecha';

  // A gazette date carries no time of day; shifting it into a zone moves it to the day before.
  const timeZone = CALENDAR_DATE.test(value) ? 'UTC' : 'America/Mexico_City';

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date);
}

export function describeSource(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function describeProvenance(configured: boolean, hits: number, misses: number): string {
  if (!configured) {
    return 'Sin credenciales configuradas: la demostración corre en modo degradado y nada se cae.';
  }
  if (misses === 0 && hits > 0) {
    return 'No se consultó ninguna fuente en esta corrida: todo salió de la copia guardada. Cada dato conserva la fecha de su consulta original.';
  }
  if (hits > 0) {
    return 'Consulta nueva a los registros oficiales, completada con datos ya guardados.';
  }
  return 'Consulta nueva a los registros oficiales.';
}

function heading(text: string): string {
  return `\n${text}\n${'-'.repeat(text.length)}`;
}

export function renderVerification(
  args: DemoArgs,
  result: SourceResult<BusinessVerification> | null,
): string[] {
  const lines = [heading('Sello de tu negocio')];

  if (result === null || args.businessName === undefined) {
    lines.push('  No consultamos ningún negocio en esta corrida.');
    lines.push('  Para verificar el tuyo:');
    lines.push('    npm run build');
    lines.push('    node dist/cli/demo.js --negocio "NOMBRE DE TU NEGOCIO" --estado 29');
    lines.push('  El estado es opcional, pero sin él la búsqueda por nombre rara vez acierta.');
    lines.push('  Usa el nombre completo tal como está registrado: una palabra suelta no identifica un negocio.');
    return lines;
  }

  const status = getVerificationStatus(result);
  const badge = buildVerificationBadge(result);

  if (status === 'verified' && badge !== null) {
    lines.push(`  ✔ Encontramos "${badge.commercial_name ?? args.businessName}" en el directorio oficial.`);
    if (badge.state !== null) lines.push(`  Estado: ${badge.state}`);
    lines.push(
      `  ${badge.confirmed_by_rfc ? 'Confirmado con tu RFC.' : 'Coincidencia por nombre, sin confirmar con RFC.'}`,
    );
    lines.push(`  Fuente: ${describeSource(badge.source)} · consultado el ${formatDate(badge.checked_at)}`);
    return lines;
  }

  if (status === 'ambiguous') {
    const found = new Intl.NumberFormat('es-MX').format(result.data?.candidates_found ?? 0);
    lines.push(`  Encontramos ${found} negocios con un nombre parecido a "${args.businessName}",`);
    lines.push('  pero ninguno se puede identificar como el tuyo.');
    lines.push('  No emitimos un sello que no podamos comprobar.');
    lines.push('  Prueba con el nombre completo tal como está registrado, o agrega tu RFC con --rfc.');
    return lines;
  }

  if (status === 'not_listed') {
    lines.push(`  No encontramos "${args.businessName}" en el directorio oficial.`);
    lines.push('  Eso no dice nada malo de tu negocio: el registro es voluntario.');
    lines.push('  Tu puntaje es exactamente el mismo, con sello o sin él.');
    return lines;
  }

  lines.push('  No pudimos consultar el directorio en este momento.');
  lines.push('  Tu puntaje se calcula igual.');
  return lines;
}

function renderAlert(alert: RegulatoryAlert): string[] {
  const kind = alert.kind === 'publication' ? 'Novedad' : 'Regla vigente';
  const lines = [`  • [${kind}] ${alert.title}`];
  lines.push(`    Fuente: ${describeSource(alert.source)} · ${formatDate(alert.published_at)}`);
  if (alert.url !== null) lines.push(`    Documento: ${alert.url}`);
  return lines;
}

export function renderRadar(result: SourceResult<RegulatoryRadar>): string[] {
  const lines = [heading('Reglas que te afectan')];

  if (!result.available || result.data === null) {
    lines.push('  No pudimos revisar las publicaciones oficiales en este momento.');
    lines.push(`  Tu información no cambia por esto. (motivo técnico: ${result.error ?? 'desconocido'})`);
    return lines;
  }

  const radar = result.data;
  const publications = radar.alerts.filter((alert) => alert.kind === 'publication');
  const standing = radar.alerts.filter((alert) => alert.kind === 'standing_rule');

  lines.push(`  Revisado el ${formatDate(result.checked_at)} · ${radar.scanned_dates.length} días de publicaciones`);

  if (radar.failed_dates.length > 0) {
    lines.push(`  ⚠ No pudimos leer ${radar.failed_dates.length} de esos días: ${radar.failed_dates.join(', ')}`);
    lines.push('    Te lo decimos en vez de dejarte creer que no hubo nada.');
  }

  lines.push('');
  lines.push(`  Novedades publicadas: ${publications.length}`);
  for (const alert of publications) lines.push(...renderAlert(alert));
  if (publications.length === 0) lines.push('    Sin novedades en el periodo revisado.');

  lines.push('');
  lines.push(`  Reglas ya vigentes que aplican: ${standing.length}`);
  for (const alert of standing.slice(0, 5)) lines.push(...renderAlert(alert));
  if (standing.length > 5) lines.push(`    …y ${standing.length - 5} más.`);

  return lines;
}

export function renderReportPaths(htmlPath: string, jsonPath: string): string {
  // Windows resolves `start` against the shell, so the quoted absolute path is what actually opens.
  const opener = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';

  return [
    'Reporte generado.',
    '',
    `  Página   ${htmlPath}`,
    `  Datos    ${jsonPath}`,
    '',
    '  Para abrirlo:',
    `    ${opener} "${htmlPath}"`,
  ].join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnvWithFallback(readEnvFile(join(process.cwd(), '.env')));
  const cache = new CountingCacheStore(createCacheStore(env));
  const { service, radar, rates, disclosure } = createCrevaScore(env, undefined, cache);

  const verification =
    args.businessName === undefined
      ? null
      : await service.verify({
          businessName: args.businessName,
          stateCode: args.stateCode,
          rfc: args.rfc,
        });

  const scan = await radar.scan();

  if (args.report === true) {
    const report = buildReport({
      subject:
        args.businessName === undefined
          ? null
          : { business_name: args.businessName, state_code: args.stateCode ?? null },
      verification,
      radar: scan,
      rates: await rates.getRates(),
      disclosure,
    });

    const htmlPath = resolve('creva-report.html');
    const jsonPath = resolve('creva-report.json');

    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    writeFileSync(htmlPath, renderReportHtml(report), 'utf8');
    process.stdout.write(`${renderReportPaths(htmlPath, jsonPath)}\n`);
    return;
  }

  const body = [...renderVerification(args, verification), ...renderRadar(scan)];

  const lines = [
    'Creva Score — demostración',
    describeProvenance(isCromaConfigured(env), cache.hits, cache.misses),
    ...body,
    '',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

if (require.main === module) {
  void main();
}
