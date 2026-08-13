import { createBusinessVerification } from '../../src/index';
import { loadEnv } from '../../src/infra/env';
import { getVerificationStatus } from '../../src/business-verification/business-verification.service';

describe('createBusinessVerification', () => {
  it('wires a usable setup from environment configuration', () => {
    const env = loadEnv({ CROMA_API_KEY: 'k', BUSINESS_VERIFICATION_POINTS: '15', SCORE_MAX: '100' });
    const setup = createBusinessVerification(env);

    expect(setup.factorConfig).toEqual({ points: 15, maxScore: 100 });
    expect(typeof setup.service.verify).toBe('function');
  });

  it('degrades to unavailable without credentials instead of failing to start', async () => {
    const setup = createBusinessVerification(loadEnv({}));

    const result = await setup.service.verify({ businessName: 'ACME' });

    expect(result.available).toBe(false);
    expect(result.error).toBe('missing_api_key');
    expect(getVerificationStatus(result)).toBe('unavailable');
  });

  it('reports every call through the injected logger', async () => {
    const lines: string[] = [];
    const setup = createBusinessVerification(loadEnv({}), {
      log: (level, message, fields) => lines.push(JSON.stringify({ level, message, ...fields })),
    });

    await setup.service.verify({ businessName: 'ACME' });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toMatchObject({ level: 'warn', reason: 'missing_api_key' });
  });
});
