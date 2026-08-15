// keygen: creates Creva's signing key pair. The private key goes to disk and never to stdout.

import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSigningKeyPair, keyId } from '../common/integrity/signature';

const DEFAULT_KEY_FILE = 'creva-signing.key';

export function parseKeygenArgs(argv: string[]): { file: string; force: boolean } {
  const flagIndex = argv.indexOf('--archivo');
  const positional = argv.find((value) => !value.startsWith('--'));

  return {
    file: flagIndex >= 0 ? (argv[flagIndex + 1] ?? DEFAULT_KEY_FILE) : (positional ?? DEFAULT_KEY_FILE),
    force: argv.includes('--forzar'),
  };
}

export function renderKeygenResult(keyPath: string, publicKeyPem: string): string {
  const oneLine = publicKeyPem.trim().replace(/\n/g, '\\n');

  return [
    'Par de llaves creado.',
    '',
    `  Llave privada  ${keyPath}`,
    `  Llave pública  ${keyPath}.pub`,
    `  Identificador  ${keyId(publicKeyPem)}`,
    '',
    '  ⚠️  La llave privada NO se imprime aquí y no debe salir de esta máquina.',
    '      Cualquiera que la tenga puede firmar reportes como si fuera Creva.',
    '      Está en el .gitignore: no la subas a ningún repositorio.',
    '',
    '  1. Apunta el firmado a esa llave, en tu .env:',
    `     CREVA_SIGNING_KEY_FILE=${keyPath}`,
    '',
    '  2. Publica esta llave pública para que cualquiera pueda verificar:',
    '',
    publicKeyPem.trim(),
    '',
    '  3. Quien verifique apunta a ese archivo, que es la forma robusta:',
    `     CREVA_SIGNING_PUBLIC_KEY_FILE=${keyPath}.pub`,
    '',
    '     O bien en una sola línea, si prefiere no mover archivos:',
    `     CREVA_SIGNING_PUBLIC_KEY=${oneLine}`,
  ].join('\n');
}

function main(): void {
  const args = parseKeygenArgs(process.argv.slice(2));
  const keyPath = resolve(args.file);

  if (existsSync(keyPath) && !args.force) {
    process.stdout.write(
      `Ya existe una llave en ${keyPath}.\n\nSobrescribirla invalida todas las firmas hechas con ella.\nSi de verdad quieres reemplazarla: node dist/cli/keygen.js "${args.file}" --forzar\n`,
    );
    process.exitCode = 1;
    return;
  }

  const pair = generateSigningKeyPair();
  writeFileSync(keyPath, pair.privateKeyPem, { encoding: 'utf8', mode: 0o600 });
  writeFileSync(`${keyPath}.pub`, pair.publicKeyPem, 'utf8');

  process.stdout.write(`${renderKeygenResult(keyPath, pair.publicKeyPem)}\n`);
}

if (require.main === module) {
  main();
}
