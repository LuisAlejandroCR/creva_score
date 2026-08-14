import fc from 'fast-check';
import { buildCertificate, checkFiles, parseCertificate } from '../../src/common/integrity/certificate';
import { sealHash, canonicalJson, digestOf, fileDigest } from '../../src/common/integrity/report-digest';

// A certificate is read back from a file anyone could have edited, so it is outside input.
describe('integrity under arbitrary input', () => {
  it('any change to the bytes is detected', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 400 }), fc.nat(), (bytes, seed) => {
        const original = Buffer.from(bytes);
        const index = seed % original.length;
        const tampered = Buffer.from(original);
        tampered[index] = (tampered[index] ?? 0) ^ 0xff;

        const sealed = buildCertificate({
          files: [fileDigest('f', original)],
          generatedAt: '2026-08-14T00:00:00.000Z',
        });

        expect(checkFiles(sealed, new Map([['f', tampered]]))[0]?.verdict).toBe('altered');
        expect(checkFiles(sealed, new Map([['f', original]]))[0]?.verdict).toBe('intact');
      }),
      { numRuns: 400 },
    );
  });

  it('never throws on a seal that is not a seal', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(() => parseCertificate(raw)).not.toThrow();
      }),
      { numRuns: 500 },
    );
  });

  it('produces a fixed-width hex digest for any input', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 2000 }), (bytes) => {
        expect(digestOf(Buffer.from(bytes))).toMatch(/^[0-9a-f]{64}$/);
      }),
      { numRuns: 400 },
    );
  });

  it('canonicalises the same object to the same string however its keys arrive', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.integer()), (record) => {
        const shuffled = Object.fromEntries(Object.entries(record).reverse());

        expect(canonicalJson(record)).toBe(canonicalJson(shuffled));
      }),
      { numRuns: 300 },
    );
  });

  it('gives two different folders two different anchors', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 200 }),
        fc.uint8Array({ minLength: 1, maxLength: 200 }),
        (left, right) => {
          fc.pre(Buffer.from(left).toString('hex') !== Buffer.from(right).toString('hex'));
          const at = '2026-08-14T00:00:00.000Z';

          expect(sealHash([fileDigest('f', Buffer.from(left))], at)).not.toBe(
            sealHash([fileDigest('f', Buffer.from(right))], at),
          );
        },
      ),
      { numRuns: 300 },
    );
  });
});
