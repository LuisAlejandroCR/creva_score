import { EnvValidationError, isCromaConfigured, loadEnv } from './env';

describe('loadEnv', () => {
  it('starts without Croma credentials', () => {
    const env = loadEnv({});

    expect(env.CROMA_API_KEY).toBeUndefined();
    expect(isCromaConfigured(env)).toBe(false);
    expect(env.CROMA_BASE_URL).toBe('https://api.croma.run');
  });

  it('accepts the legacy variable names already present in existing .env files', () => {
    const env = loadEnv({ Base_URL: 'https://example.test', Organization_ID: 'org_1' });

    expect(env.CROMA_BASE_URL).toBe('https://example.test');
    expect(env.CROMA_ORGANIZATION_ID).toBe('org_1');
  });

  it('prefers the canonical name over the legacy one', () => {
    const env = loadEnv({ CROMA_BASE_URL: 'https://canonical.test', Base_URL: 'https://legacy.test' });

    expect(env.CROMA_BASE_URL).toBe('https://canonical.test');
  });

  it('coerces numeric settings from strings', () => {
    const env = loadEnv({ CROMA_WAIT_SECONDS: '20', BUSINESS_VERIFICATION_MAX_DETAIL_LOOKUPS: '2' });

    expect(env.CROMA_WAIT_SECONDS).toBe(20);
    expect(env.BUSINESS_VERIFICATION_MAX_DETAIL_LOOKUPS).toBe(2);
  });

  it('rejects an invalid base URL', () => {
    expect(() => loadEnv({ CROMA_BASE_URL: 'not-a-url' })).toThrow(EnvValidationError);
  });

  it('rejects an inline wait above the documented maximum', () => {
    expect(() => loadEnv({ CROMA_WAIT_SECONDS: '90' })).toThrow(EnvValidationError);
  });
});
