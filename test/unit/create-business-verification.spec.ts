import { createBusinessVerification } from '../../src/index';
import { loadEnv } from '../../src/config/env';
import { getVerificationStatus } from '../../src/modules/business-verification/business-verification.service';

describe('createBusinessVerification', () => {
  it('wires a usable setup from environment configuration', () => {
    const env = loadEnv({ CROMA_API_KEY: 'k' });
    const setup = createBusinessVerification(env);

    expect(typeof setup.service.verify).toBe('function');
    expect(setup.env.CROMA_BASE_URL).toBe('https://api.croma.run');
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
