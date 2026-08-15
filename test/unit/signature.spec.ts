import { buildCertificate, signaturePayload, verifyCertificate } from '../../src/common/integrity/certificate';
import { fileDigest } from '../../src/common/integrity/report-digest';
import {
  checkSignature,
  generateSigningKeyPair,
  keyId,
  publicKeyOf,
  signPayload,
  verifyPayload,
} from '../../src/common/integrity/signature';
import { normalizePublicKey } from '../../src/common/integrity/signing-key';

const GENERATED_AT = '2026-08-14T20:12:12.961Z';
const creva = generateSigningKeyPair();
const impostor = generateSigningKeyPair();

function sealed(body: string, keyPem?: string) {
  return buildCertificate({
    files: [fileDigest('creva-reporte.html', Buffer.from(body, 'utf8'))],
    generatedAt: GENERATED_AT,
    folio: 'abc',
    signingKeyPem: keyPem,
  });
}

function filesOf(body: string): Map<string, Buffer> {
  return new Map([['creva-reporte.html', Buffer.from(body, 'utf8')]]);
}

describe('signing', () => {
  it('round-trips a payload', () => {
    const signature = signPayload('hola', creva.privateKeyPem);

    expect(signature).not.toBeNull();
    expect(verifyPayload('hola', signature!, creva.publicKeyPem)).toBe(true);
  });

  it('fails when the payload changed by one character', () => {
    const signature = signPayload('hola', creva.privateKeyPem)!;

    expect(verifyPayload('holá', signature, creva.publicKeyPem)).toBe(false);
  });

  it('fails against a different key', () => {
    const signature = signPayload('hola', creva.privateKeyPem)!;

    expect(verifyPayload('hola', signature, impostor.publicKeyPem)).toBe(false);
  });

  it('derives the same public key and id from the private key', () => {
    expect(publicKeyOf(creva.privateKeyPem)?.trim()).toBe(creva.publicKeyPem.trim());
    expect(keyId(creva.publicKeyPem)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('never throws on an unusable key, it just does not sign', () => {
    expect(signPayload('hola', 'esto no es una llave')).toBeNull();
    expect(keyId('tampoco')).toBe('desconocida');
    expect(publicKeyOf('ni esto')).toBeNull();
  });
});

describe('the five signature verdicts stay distinct', () => {
  it('valid when the trusted key matches', () => {
    const certificate = sealed('<html>real</html>', creva.privateKeyPem);
    const result = verifyCertificate(certificate, filesOf('<html>real</html>'), creva.publicKeyPem);

    expect(result.signature).toBe('valid');
  });

  it('missing — not merely unsigned — when a trusted key says one was expected', () => {
    // The cheapest forgery is to strip the signature and reseal. Reporting that as a footnote
    // let a tampered folder pass with exit 0; it is a failure whenever we know Creva signs.
    const result = verifyCertificate(sealed('<html>a</html>'), filesOf('<html>a</html>'), creva.publicKeyPem);

    expect(result.signature).toBe('missing');
    expect(result.signature_detail).toContain('vuelto a sellar');
  });

  it('unsigned when nothing tells us a signature was expected', () => {
    const result = verifyCertificate(sealed('<html>a</html>'), filesOf('<html>a</html>'), undefined);

    expect(result.signature).toBe('unsigned');
  });

  it('no_key when there is a signature but nothing trusted to check it against', () => {
    const certificate = sealed('<html>a</html>', creva.privateKeyPem);
    const result = verifyCertificate(certificate, filesOf('<html>a</html>'), undefined);

    // Not knowing is its own answer, and must never be reported as valid or as forged.
    expect(result.signature).toBe('no_key');
  });

  it('invalid when someone else signed it', () => {
    const certificate = sealed('<html>a</html>', impostor.privateKeyPem);
    const result = verifyCertificate(certificate, filesOf('<html>a</html>'), creva.publicKeyPem);

    expect(result.signature).toBe('invalid');
    expect(result.signature_detail).toContain('No lo emitió quien esperabas');
  });

  it('invalid when the sealed content was edited under a genuine signature', () => {
    const certificate = sealed('<html>real</html>', creva.privateKeyPem);
    const tampered = { ...certificate, seal_hash: '0'.repeat(64) };
    const result = verifyCertificate(tampered, filesOf('<html>real</html>'), creva.publicKeyPem);

    expect(result.signature).toBe('invalid');
  });

  it('reports an unknown verdict without throwing on nonsense', () => {
    expect(checkSignature('x', { algorithm: 'ed25519', key_id: 'z', value: '!!' }, creva.publicKeyPem).verdict).toBe(
      'invalid',
    );
  });
});

describe('what the signature covers', () => {
  it('excludes itself, so signing does not invalidate what it signs', () => {
    const certificate = sealed('<html>a</html>', creva.privateKeyPem);

    expect(signaturePayload(certificate)).not.toContain(certificate.signature!.value);
  });

  it('covers the folio, the seal hash and every file digest', () => {
    const certificate = sealed('<html>a</html>', creva.privateKeyPem);
    const payload = signaturePayload(certificate);

    expect(payload).toContain(certificate.seal_hash);
    expect(payload).toContain('abc');
    expect(payload).toContain(certificate.files[0]!.digest);
  });

  it('says more once it is signed, and admits what a signature still cannot do', () => {
    const signedCert = sealed('<html>a</html>', creva.privateKeyPem);

    expect(signedCert.proves.join(' ')).toContain('llave privada');
    expect(signedCert.does_not_prove.join(' ')).toContain('NOM-151');
  });
});

describe('a public key survives an .env line', () => {
  it('restores the newlines an env file cannot carry', () => {
    const oneLine = creva.publicKeyPem.trim().replace(/\n/g, '\\n');

    expect(normalizePublicKey(oneLine)).toBe(creva.publicKeyPem.trim());
  });

  it('treats an empty value as no key at all', () => {
    expect(normalizePublicKey('')).toBeUndefined();
    expect(normalizePublicKey('   ')).toBeUndefined();
  });
});
