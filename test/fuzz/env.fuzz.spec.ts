import fc from 'fast-check';
import { EnvValidationError, loadEnv } from '../../src/infra/env';

const knownKeys = [
  'CROMA_API_KEY',
  'CROMA_BASE_URL',
  'CROMA_ORGANIZATION_ID',
  'CROMA_WAIT_SECONDS',
  'CROMA_TIMEOUT_MS',
  'SIEM_DETAIL_RFC_FIELD',
  'BUSINESS_VERIFICATION_CACHE_TTL_MS',
  'BUSINESS_VERIFICATION_MAX_DETAIL_LOOKUPS',
  'Base_URL',
  'Organization_ID',
];

describe('env fuzz', () => {
  it('either returns a valid configuration or a typed validation error, never anything else', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.constantFrom(...knownKeys), fc.string()), (raw) => {
        try {
          const env = loadEnv(raw);

          expect(typeof env.CROMA_BASE_URL).toBe('string');
          expect(Number.isFinite(env.CROMA_WAIT_SECONDS)).toBe(true);
          expect(env.CROMA_WAIT_SECONDS).toBeGreaterThanOrEqual(1);
          expect(env.CROMA_WAIT_SECONDS).toBeLessThanOrEqual(55);
          expect(env.BUSINESS_VERIFICATION_MAX_DETAIL_LOOKUPS).toBeLessThanOrEqual(5);
        } catch (error) {
          expect(error).toBeInstanceOf(EnvValidationError);
          expect((error as EnvValidationError).issues.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('never leaks a credential value into the validation error message', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 8 }), (secret) => {
        try {
          loadEnv({ CROMA_API_KEY: secret, CROMA_BASE_URL: 'definitely not a url' });
          return;
        } catch (error) {
          expect((error as Error).message).not.toContain(secret);
        }
      }),
    );
  });
});
