import fc from 'fast-check';
import { createConsoleLogger, redact } from '../../src/infra/logger';
import { CromaClient } from '../../src/infra/croma-client';

describe('logging invariants', () => {
  it('never emits a credential value, whatever field it arrives in', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('croma_live_', 'croma_test_'),
        fc.stringMatching(/^[A-Za-z0-9]{10,40}$/),
        fc.constantFrom('api_key', 'CROMA_API_KEY', 'authorization', 'token', 'note', 'path'),
        (prefix, tail, field) => {
          const secret = `${prefix}${tail}`;
          const lines: string[] = [];
          const logger = createConsoleLogger({ log: (line: string) => lines.push(line) });

          logger.log('info', 'croma.call', { [field]: secret });

          expect(lines.join('\n')).not.toContain(secret);
        },
      ),
    );
  });

  it('never emits a value held under a personal-data field name', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('rfc', 'RFC', 'curp', 'email', 'phone', 'address', 'legal_name', 'commercial_name'),
        fc.string({ minLength: 4 }),
        (field, value) => {
          expect(JSON.stringify(redact({ [field]: value }))).not.toContain(value);
        },
      ),
    );
  });

  it('never lets the API key reach the log while calling the provider', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(200, 401, 429, 500, 502), async (status) => {
        const secret = 'croma_live_do_not_log_this_value';
        const lines: string[] = [];
        const client = new CromaClient({
          apiKey: secret,
          fetchImpl: jest.fn().mockResolvedValue(new Response('{}', { status })) as unknown as typeof fetch,
          sleep: async () => undefined,
          logger: createConsoleLogger({ log: (line: string) => lines.push(line) }),
        });

        await client.call('/mx/siem/establishments/v1', { name: 'ACME' }, { source: 'mx.siem' });

        expect(lines.join('\n')).not.toContain(secret);
        expect(lines.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });
});
