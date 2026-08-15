import fc from 'fast-check';
import { parseCertificate, verifyCertificate } from '../../src/common/integrity/certificate';
import { checkSignature, generateSigningKeyPair } from '../../src/common/integrity/signature';
import { normalizePublicKey } from '../../src/common/integrity/signing-key';

const creva = generateSigningKeyPair();

// A seal and a public key both arrive from outside the process and can be anything.
describe('signature checking under arbitrary input', () => {
  it('never throws, whatever the signature block contains', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (algorithm, key_id, value) => {
        expect(() => checkSignature('payload', { algorithm, key_id, value }, creva.publicKeyPem)).not.toThrow();
      }),
      { numRuns: 400 },
    );
  });

  it('never throws on an arbitrary trusted key, and never calls it valid', () => {
    fc.assert(
      fc.property(fc.string(), (key) => {
        const outcome = checkSignature('payload', { algorithm: 'ed25519', key_id: 'a', value: 'b' }, key);

        expect(['invalid', 'no_key']).toContain(outcome.verdict);
      }),
      { numRuns: 400 },
    );
  });

  it('never throws while normalising a key from an env line', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(() => normalizePublicKey(value)).not.toThrow();
      }),
      { numRuns: 300 },
    );
  });

  it('rejects a seal whose signature block is the wrong shape, instead of trusting it', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const raw = JSON.stringify({
          schema: 's',
          algorithm: 'sha256',
          generated_at: 'x',
          seal_hash: 'h',
          files: [],
          signature: value,
          how_to_verify: [],
        });

        expect(parseCertificate(raw)).toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it('parses a seal with no signature field, and judges it by whether a signature was expected', () => {
    const raw = JSON.stringify({
      schema: 's',
      algorithm: 'sha256',
      generated_at: 'x',
      seal_hash: 'h',
      files: [],
      how_to_verify: [],
    });
    const certificate = parseCertificate(raw);

    expect(certificate).not.toBeNull();
    // With a trusted key we know one was expected, so its absence is a failure, not a footnote.
    expect(verifyCertificate(certificate!, new Map(), creva.publicKeyPem).signature).toBe('missing');
    expect(verifyCertificate(certificate!, new Map(), undefined).signature).toBe('unsigned');
  });
});
