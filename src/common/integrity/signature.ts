// signature: proves a report came from Creva, not merely that its bytes did not change.

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

export const SIGNATURE_ALGORITHM = 'ed25519';

export interface SignatureBlock {
  algorithm: string;
  key_id: string;
  value: string;
}

export type SignatureVerdict = 'valid' | 'invalid' | 'missing' | 'unsigned' | 'no_key';

export interface KeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
}

export function generateSigningKeyPair(): KeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');

  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

/** A short, public fingerprint. It names which key signed, and reveals nothing secret. */
export function keyId(publicKeyPem: string): string {
  try {
    const der = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
    return createHash('sha256').update(der).digest('hex').slice(0, 16);
  } catch {
    return 'desconocida';
  }
}

export function publicKeyOf(privateKeyPem: string): string | null {
  try {
    return createPublicKey(createPrivateKey(privateKeyPem)).export({ type: 'spki', format: 'pem' }).toString();
  } catch {
    return null;
  }
}

export function signPayload(payload: string, privateKeyPem: string): SignatureBlock | null {
  try {
    const key = createPrivateKey(privateKeyPem);
    const publicKeyPem = createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString();

    return {
      algorithm: SIGNATURE_ALGORITHM,
      key_id: keyId(publicKeyPem),
      value: sign(null, Buffer.from(payload, 'utf8'), key).toString('base64'),
    };
  } catch {
    // An unusable key must not take the seal down with it; the report is still sealed, just unsigned.
    return null;
  }
}

/**
 * The trusted key comes from the verifier's own configuration, never from the document being
 * checked. A forger who supplied their own key alongside their own signature would otherwise
 * verify perfectly against themselves.
 */
export function verifyPayload(payload: string, signature: SignatureBlock, trustedPublicKeyPem: string): boolean {
  try {
    return verify(
      null,
      Buffer.from(payload, 'utf8'),
      createPublicKey(trustedPublicKeyPem),
      Buffer.from(signature.value, 'base64'),
    );
  } catch {
    return false;
  }
}

export function checkSignature(
  payload: string,
  signature: SignatureBlock | null,
  trustedPublicKeyPem: string | undefined,
): { verdict: SignatureVerdict; detail: string } {
  if (signature === null) {
    // Knowing that Creva signs its reports makes an unsigned one a failure, not a footnote:
    // stripping the signature and resealing is the cheapest forgery available.
    if (trustedPublicKeyPem !== undefined && trustedPublicKeyPem.trim() !== '') {
      return {
        verdict: 'missing',
        detail:
          'Este reporte NO está firmado, y se esperaba la firma de Creva. Un documento auténtico siempre la lleva, así que este no lo es o fue vuelto a sellar por alguien más.',
      };
    }

    return {
      verdict: 'unsigned',
      detail:
        'Este reporte no lleva firma, y no hay una llave de confianza configurada para saber si debería llevarla. El sello comprueba integridad, no origen.',
    };
  }

  if (trustedPublicKeyPem === undefined || trustedPublicKeyPem.trim() === '') {
    return {
      verdict: 'no_key',
      detail: `El reporte está firmado con la llave ${signature.key_id}, pero no hay una llave pública de confianza configurada contra la cual comprobarlo. Eso no dice nada sobre el documento.`,
    };
  }

  if (keyId(trustedPublicKeyPem) !== signature.key_id) {
    return {
      verdict: 'invalid',
      detail: `El reporte está firmado con la llave ${signature.key_id}, distinta de la llave de confianza ${keyId(trustedPublicKeyPem)}. No lo emitió quien esperabas.`,
    };
  }

  return verifyPayload(payload, signature, trustedPublicKeyPem)
    ? { verdict: 'valid', detail: `Firmado por la llave ${signature.key_id}. El documento proviene de quien posee esa llave.` }
    : {
        verdict: 'invalid',
        detail: 'La firma no corresponde al contenido de este sello. El documento fue alterado o la firma no es auténtica.',
      };
}
