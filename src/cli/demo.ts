// demo: command-line entry point that runs both surfaces and prints them for the user.

import { join } from 'node:path';
import { createBusinessVerification } from '../index';
import { buildVerificationBadge } from '../business-verification/business-verification.badge';
import { getVerificationStatus } from '../business-verification/business-verification.service';
import { isCromaConfigured, loadEnvWithFallback } from '../infra/env';
import { RegulatoryAlert, RegulatoryRadar } from '../regulatory-radar/regulatory-radar.service';
import { SourceResult } from '../infra/types';
import { readEnvFile } from './env-file';

interface DemoArgs {
  businessName?: string;
  stateCode?: number;
  rfc?: string;
}

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

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

function heading(text: string): string {
  return `\n${text}\n${'-'.repeat(text.length)}`;
}

function renderAlert(alert: RegulatoryAlert): string[] {
  const kind = alert.kind === 'publication' ? 'Novedad' : 'Regla vigente';
  const lines = [`  • [${kind}] ${alert.title}`];
  lines.push(`    Fuente: ${describeSource(alert.source)} · ${formatDate(alert.published_at)}`);
  if (alert.url !== null) lines.push(`    Documento: ${alert.url}`);
  return lines;
}

function renderRadar(result: SourceResult<RegulatoryRadar>): string[] {
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnvWithFallback(readEnvFile(join(process.cwd(), '.env')));

  const lines: string[] = ['Creva Score — demostración'];
  lines.push(
    isCromaConfigured(env)
      ? 'Consultando registros oficiales…'
      : 'Sin credenciales configuradas: la demostración corre en modo degradado y nada se cae.',
  );

  const { service, radar } = createBusinessVerification(env);

  if (args.businessName !== undefined) {
    const result = await service.verify({
      businessName: args.businessName,
      stateCode: args.stateCode,
      rfc: args.rfc,
    });
    const status = getVerificationStatus(result);
    const badge = buildVerificationBadge(result);

    lines.push(heading('Sello de tu negocio'));
    if (status === 'verified' && badge !== null) {
      lines.push(`  ✔ Encontramos "${badge.commercial_name ?? args.businessName}" en el directorio oficial.`);
      if (badge.state !== null) lines.push(`  Estado: ${badge.state}`);
      lines.push(`  ${badge.confirmed_by_rfc ? 'Confirmado con tu RFC.' : 'Coincidencia por nombre, sin confirmar con RFC.'}`);
      lines.push(`  Fuente: ${describeSource(badge.source)} · consultado el ${formatDate(badge.checked_at)}`);
    } else if (status === 'not_listed') {
      lines.push(`  No encontramos "${args.businessName}" en el directorio oficial.`);
      lines.push('  Eso no dice nada malo de tu negocio: el registro es voluntario.');
      lines.push('  Tu puntaje es exactamente el mismo, con sello o sin él.');
    } else {
      lines.push('  No pudimos consultar el directorio en este momento.');
      lines.push('  Tu puntaje se calcula igual.');
    }
  }

  lines.push(...renderRadar(await radar.scan()));
  lines.push('');
  process.stdout.write(`${lines.join('\n')}\n`);
}

if (require.main === module) {
  void main();
}
