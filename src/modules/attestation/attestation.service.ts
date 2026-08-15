// attestation.service: seals a delivered report, and checks a delivered report against its seal.

import {
  CERTIFICATE_FILE,
  Certificate,
  VerificationResult,
  buildCertificate,
  parseCertificate,
  verifyCertificate,
} from '../../common/integrity/certificate';
import { FileDigest, fileDigest } from '../../common/integrity/report-digest';

export function digestsOf(files: Array<{ name: string; contents: Buffer }>): FileDigest[] {
  return files.map((file) => fileDigest(file.name, file.contents));
}

export function sealReport(
  files: Array<{ name: string; contents: Buffer }>,
  generatedAt: string,
  folio: string | null = null,
  signingKeyPem?: string,
): Certificate {
  return buildCertificate({ files: digestsOf(files), generatedAt, folio, signingKeyPem });
}

export function verifySealedFolder(
  certificateRaw: string,
  found: Map<string, Buffer>,
  trustedPublicKeyPem?: string,
): { certificate: Certificate; result: VerificationResult } | { error: string } {
  const certificate = parseCertificate(certificateRaw);
  if (certificate === null) {
    return { error: `El archivo ${CERTIFICATE_FILE} no se pudo leer o no tiene la forma esperada.` };
  }

  return { certificate, result: verifyCertificate(certificate, found, trustedPublicKeyPem) };
}
