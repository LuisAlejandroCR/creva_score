// seal-folder: reads a delivered folder from disk, seals it, and checks it later.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CERTIFICATE_FILE, Certificate, VerificationResult } from '../../common/integrity/certificate';
import { sealReport, verifySealedFolder } from './attestation.service';

export interface SealOutcome {
  certificate: Certificate | null;
  certificatePath: string;
  note: string;
}

const SEALED_NOTE =
  'El sello guarda la huella SHA-256 de cada archivo entregado, así que cualquier cambio posterior se detecta.';
const SIGNED_NOTE =
  'Sellado y firmado por Creva: además de detectar alteraciones, la firma acredita quién lo emitió.';

export function sealFolderOnDisk(
  folder: string,
  fileNames: string[],
  generatedAt: string,
  folio: string | null = null,
  signingKeyPem?: string,
): SealOutcome {
  const certificatePath = join(folder, CERTIFICATE_FILE);

  try {
    const files = fileNames
      .map((name) => ({ name, path: join(folder, name) }))
      .filter((file) => existsSync(file.path))
      .map((file) => ({ name: file.name, contents: readFileSync(file.path) }));

    if (files.length === 0) {
      return { certificate: null, certificatePath, note: 'No había archivos que sellar.' };
    }

    const certificate = sealReport(files, generatedAt, folio, signingKeyPem);
    writeFileSync(certificatePath, `${JSON.stringify(certificate, null, 2)}\n`, 'utf8');

    return { certificate, certificatePath, note: certificate.signature === null ? SEALED_NOTE : SIGNED_NOTE };
  } catch (error) {
    // A report that could not be sealed is still a report; it just cannot claim to be sealed.
    return {
      certificate: null,
      certificatePath,
      note: `No se pudo escribir el sello: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function verifyFolderOnDisk(
  folder: string,
  trustedPublicKeyPem?: string,
): { certificate: Certificate; result: VerificationResult } | { error: string } {
  const certificatePath = join(folder, CERTIFICATE_FILE);

  if (!existsSync(certificatePath)) {
    return { error: `No se encontró ${CERTIFICATE_FILE} en ${folder}. Sin sello no hay nada contra qué comparar.` };
  }

  const raw = readFileSync(certificatePath, 'utf8');
  const parsed = JSON.parse(raw) as { files?: Array<{ name?: string }> };
  const found = new Map<string, Buffer>();

  for (const file of parsed.files ?? []) {
    const name = file?.name;
    if (typeof name !== 'string') continue;

    const path = join(folder, name);
    if (existsSync(path)) found.set(name, readFileSync(path));
  }

  return verifySealedFolder(raw, found, trustedPublicKeyPem);
}
