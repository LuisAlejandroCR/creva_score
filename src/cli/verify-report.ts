// verify-report: checks a delivered report folder against its seal, for whoever received it.

import { Certificate, VerificationResult } from '../common/integrity/certificate';
import { formatFolio } from '../common/integrity/report-digest';
import { readPublicKey } from '../common/integrity/signing-key';
import { loadEnvWithFallback } from '../config/env';
import { readEnvFile } from './env-file';
import { join } from 'node:path';
import { verifyFolderOnDisk } from '../modules/attestation/seal-folder';

const SIGNATURE_MARK: Record<VerificationResult['signature'], string> = {
  valid: '✔',
  invalid: '✘',
  missing: '✘',
  unsigned: '·',
  no_key: '?',
};

const SIGNATURE_SAY: Record<VerificationResult['signature'], string> = {
  valid: 'auténtica, emitida por Creva',
  invalid: 'NO ES VÁLIDA',
  missing: 'FALTA — se esperaba la firma de Creva',
  unsigned: 'el reporte no está firmado',
  no_key: 'no se pudo comprobar',
};

export function renderVerification(certificate: Certificate, result: VerificationResult): string {
  const lines = ['Verificación de integridad', ''];

  for (const file of result.files) {
    const mark = file.verdict === 'intact' ? '✔' : file.verdict === 'missing' ? '?' : '✘';
    const say =
      file.verdict === 'intact'
        ? 'sin cambios desde que se generó'
        : file.verdict === 'missing'
          ? 'no está en la carpeta'
          : 'ALTERADO después de generarse';

    lines.push(`  ${mark} ${file.name} — ${say}`);
  }

  lines.push('');
  lines.push(
    result.files_intact
      ? '  Los archivos son exactamente los que se generaron.'
      : '  ⚠ Al menos un archivo no coincide con el sello. No es el documento original.',
  );

  if (!result.seal_is_self_consistent) {
    lines.push('  ⚠ El propio sello es inconsistente: su huella no corresponde a los digests que lista.');
  }

  if (certificate.report_folio !== null) {
    lines.push('');
    lines.push(`  Folio de verificación: ${formatFolio(certificate.report_folio)}`);
  }

  lines.push('');
  lines.push(`  ${SIGNATURE_MARK[result.signature]} Firma: ${SIGNATURE_SAY[result.signature]}`);
  lines.push(`    ${result.signature_detail}`);

  lines.push('');
  lines.push('  Lo que este sello NO prueba:');
  for (const limit of certificate.does_not_prove) lines.push(`    · ${limit}`);

  return lines.join('\n');
}

export function parseFolderArg(argv: string[]): string | undefined {
  const positional = argv.find((value) => !value.startsWith('--'));
  const flagIndex = argv.indexOf('--carpeta');
  return flagIndex >= 0 ? argv[flagIndex + 1] : positional;
}

async function main(): Promise<void> {
  const folder = parseFolderArg(process.argv.slice(2));

  if (folder === undefined) {
    process.stdout.write(
      'Indica la carpeta del reporte.\n\n  node dist/cli/verify-report.js "<carpeta del reporte>"\n',
    );
    process.exitCode = 1;
    return;
  }

  const env = loadEnvWithFallback(readEnvFile(join(process.cwd(), '.env')));
  const outcome = verifyFolderOnDisk(folder, readPublicKey(env.CREVA_SIGNING_PUBLIC_KEY_FILE, env.CREVA_SIGNING_PUBLIC_KEY));

  if ('error' in outcome) {
    process.stdout.write(`${outcome.error}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${renderVerification(outcome.certificate, outcome.result)}\n`);

  // A tampered file must fail the command, so a script can gate on it.
  if (!outcome.result.files_intact || outcome.result.signature === 'invalid' || outcome.result.signature === 'missing') {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  void main();
}
