import fc from 'fast-check';
import { buildCertificate, verifyCertificate } from '../../src/common/integrity/certificate';
import { fileDigest } from '../../src/common/integrity/report-digest';
import { generateSigningKeyPair } from '../../src/common/integrity/signature';

const creva = generateSigningKeyPair();
const GENERATED_AT = '2026-08-14T20:12:12.961Z';

function sealFor(body: string, keyPem?: string) {
  return buildCertificate({
    files: [fileDigest('creva-reporte.html', Buffer.from(body, 'utf8'))],
    generatedAt: GENERATED_AT,
    signingKeyPem: keyPem,
  });
}

/**
 * This is the property the whole signature exists for. Without it, a seal is only a hash the
 * document's own holder can regenerate over an edited file — which is the likeliest forgery.
 */
describe('a forger without Creva\'s private key cannot produce a seal that verifies', () => {
  it('cannot reseal an edited report and pass, however it edits it', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (original, forged) => {
        fc.pre(original !== forged);

        // The forger has the tool and the edited file, but not the key.
        const forgedSeal = sealFor(forged);
        const result = verifyCertificate(forgedSeal, new Map([['creva-reporte.html', Buffer.from(forged, 'utf8')]]), creva.publicKeyPem);

        // The files match their own seal — that is exactly why the hash alone is not enough.
        expect(result.files_intact).toBe(true);
        // But the signature is what a bank checks, and the forger cannot make it valid.
        // It reports 'missing' rather than 'unsigned': we know Creva signs, so its absence is a failure.
        expect(result.signature).toBe('missing');
      }),
      { numRuns: 300 },
    );
  });

  it('cannot pass by signing with a key of their own', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (forged) => {
        const impostor = generateSigningKeyPair();
        const forgedSeal = sealFor(forged, impostor.privateKeyPem);
        const result = verifyCertificate(
          forgedSeal,
          new Map([['creva-reporte.html', Buffer.from(forged, 'utf8')]]),
          creva.publicKeyPem,
        );

        expect(result.signature).toBe('invalid');
      }),
      { numRuns: 100 },
    );
  });

  it('cannot pass by lifting a genuine signature onto different content', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (real, forged) => {
        fc.pre(real !== forged);

        const genuine = sealFor(real, creva.privateKeyPem);
        const lifted = { ...sealFor(forged), signature: genuine.signature };
        const result = verifyCertificate(
          lifted,
          new Map([['creva-reporte.html', Buffer.from(forged, 'utf8')]]),
          creva.publicKeyPem,
        );

        expect(result.signature).toBe('invalid');
      }),
      { numRuns: 300 },
    );
  });

  it('still accepts the genuine article, so the guard is not simply refusing everything', () => {
    // The deterministic control. Without it, a rule that rejected every input would pass above.
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (body) => {
        const genuine = sealFor(body, creva.privateKeyPem);
        const result = verifyCertificate(
          genuine,
          new Map([['creva-reporte.html', Buffer.from(body, 'utf8')]]),
          creva.publicKeyPem,
        );

        expect(result.signature).toBe('valid');
      }),
      { numRuns: 300 },
    );
  });
});
