// certificate: the sidecar that records which bytes were delivered, and who issued them.

import { z } from 'zod';
import { DIGEST_ALGORITHM, FileDigest, SEAL_SCHEMA, canonicalJson, digestOf, sealHash } from './report-digest';
import { SignatureBlock, SignatureVerdict, checkSignature, signPayload } from './signature';

export const CERTIFICATE_FILE = 'creva-sello.json';

export interface Certificate {
  schema: string;
  algorithm: string;
  generated_at: string;
  report_folio: string | null;
  seal_hash: string;
  files: FileDigest[];
  signature: SignatureBlock | null;
  proves: string[];
  does_not_prove: string[];
  how_to_verify: string[];
}

export type FileVerdict = 'intact' | 'altered' | 'missing';

export interface FileCheck {
  name: string;
  verdict: FileVerdict;
  expected: string;
  found: string | null;
}

export interface VerificationResult {
  files: FileCheck[];
  files_intact: boolean;
  seal_hash_recomputed: string;
  seal_is_self_consistent: boolean;
  signature: SignatureVerdict;
  signature_detail: string;
}

const fileDigestSchema = z.object({
  name: z.string(),
  bytes: z.number(),
  digest: z.string(),
});

const signatureSchema = z.object({
  algorithm: z.string(),
  key_id: z.string(),
  value: z.string(),
});

export const certificateSchema = z.object({
  schema: z.string(),
  algorithm: z.string(),
  generated_at: z.string(),
  report_folio: z.string().nullable().default(null),
  seal_hash: z.string(),
  files: z.array(fileDigestSchema),
  signature: signatureSchema.nullable().default(null),
  proves: z.array(z.string()).default([]),
  does_not_prove: z.array(z.string()).default([]),
  how_to_verify: z.array(z.string()),
});

const PROVES_UNSIGNED = [
  'Que cada archivo de esta carpeta es idéntico, byte por byte, al que se generó.',
  'Que si algo cambió, se puede señalar exactamente cuál archivo.',
];

const PROVES_SIGNED = [
  ...PROVES_UNSIGNED,
  'Que el reporte fue emitido por quien posee la llave privada de Creva: la firma no se puede reproducir sin ella.',
];

// Stating the limit inside the seal keeps anyone from reading it as more than it is.
const DOES_NOT_PROVE_UNSIGNED = [
  'No acredita por sí solo quién emitió el reporte: este sello es un archivo que lo acompaña, así que quien rehiciera el documento podría volver a sellarlo.',
  'Para acreditar el origen ante una institución hace falta un mecanismo adicional de firma.',
];

const DOES_NOT_PROVE_SIGNED = [
  'No acredita la fecha ante un tercero: la fecha la afirma quien firmó, no una autoridad de tiempo independiente.',
  'No sustituye una firma electrónica avanzada ni una constancia de conservación NOM-151.',
];

function howToVerify(signed: boolean): string[] {
  return [
    'El "report_folio" es el mismo que aparece impreso dentro del reporte, y describe su contenido.',
    'Vuelve a calcular el SHA-256 de cada archivo de esta carpeta.',
    'Compáralo con el campo "digest" que aparece aquí para ese mismo archivo. Si difiere en un solo byte, el archivo fue alterado después de generarse.',
    ...(signed
      ? [
          'Comprueba la firma con la llave pública que Creva publica, NUNCA con una llave que venga dentro de este archivo.',
        ]
      : []),
    'Para hacerlo automáticamente: npm run verificar -- "<ruta de esta carpeta>".',
  ];
}

/** What the signature covers: the whole certificate except the signature itself. */
export function signaturePayload(certificate: Omit<Certificate, 'signature'>): string {
  return canonicalJson({
    schema: certificate.schema,
    algorithm: certificate.algorithm,
    generated_at: certificate.generated_at,
    report_folio: certificate.report_folio,
    seal_hash: certificate.seal_hash,
    files: certificate.files,
  });
}

export function buildCertificate(input: {
  files: FileDigest[];
  generatedAt: string;
  folio?: string | null;
  signingKeyPem?: string;
}): Certificate {
  const unsigned: Omit<Certificate, 'signature'> = {
    schema: SEAL_SCHEMA,
    algorithm: DIGEST_ALGORITHM,
    generated_at: input.generatedAt,
    report_folio: input.folio ?? null,
    seal_hash: sealHash(input.files, input.generatedAt),
    files: [...input.files].sort((left, right) => (left.name < right.name ? -1 : 1)),
    proves: [],
    does_not_prove: [],
    how_to_verify: [],
  };

  const signature =
    input.signingKeyPem === undefined || input.signingKeyPem.trim() === ''
      ? null
      : signPayload(signaturePayload(unsigned), input.signingKeyPem);

  return {
    ...unsigned,
    signature,
    proves: signature === null ? PROVES_UNSIGNED : PROVES_SIGNED,
    does_not_prove: signature === null ? DOES_NOT_PROVE_UNSIGNED : DOES_NOT_PROVE_SIGNED,
    how_to_verify: howToVerify(signature !== null),
  };
}

export function parseCertificate(raw: string): Certificate | null {
  try {
    const parsed = certificateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function checkFiles(certificate: Certificate, found: Map<string, Buffer>): FileCheck[] {
  return certificate.files.map((file) => {
    const contents = found.get(file.name);
    if (contents === undefined) {
      return { name: file.name, verdict: 'missing' as const, expected: file.digest, found: null };
    }

    const digest = digestOf(contents);
    return {
      name: file.name,
      verdict: digest === file.digest ? ('intact' as const) : ('altered' as const),
      expected: file.digest,
      found: digest,
    };
  });
}

export function verifyCertificate(
  certificate: Certificate,
  found: Map<string, Buffer>,
  trustedPublicKeyPem?: string,
): VerificationResult {
  const files = checkFiles(certificate, found);
  const recomputed = sealHash(certificate.files, certificate.generated_at);
  const signature = checkSignature(signaturePayload(certificate), certificate.signature, trustedPublicKeyPem);

  return {
    files,
    files_intact: files.every((file) => file.verdict === 'intact'),
    seal_hash_recomputed: recomputed,
    seal_is_self_consistent: recomputed === certificate.seal_hash,
    signature: signature.verdict,
    signature_detail: signature.detail,
  };
}
