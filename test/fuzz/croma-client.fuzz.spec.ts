import fc from 'fast-check';
import { CromaClient } from '../../src/common/http/croma.client';

const arbStatus = fc.constantFrom(200, 201, 202, 204, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504);

const arbBody = fc.oneof(
  fc.constant(''),
  fc.constant('not json at all'),
  fc.constant('{'),
  fc.json(),
  fc.constant(JSON.stringify({ data: null })),
  fc.constant(JSON.stringify({ error: { type: 'api_error', code: 'internal_error' } })),
  fc.constant(JSON.stringify({ job: {} })),
  fc.constant(JSON.stringify({ job: { id: 'j', status: 'weird_status' }, data: null })),
);

const arbHeaders = fc.dictionary(
  fc.constantFrom('X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'),
  fc.oneof(fc.constant(''), fc.constant('abc'), fc.constant('-5'), fc.integer({ min: 0, max: 999 }).map(String)),
);

describe('CromaClient fuzz', () => {
  it('always returns a well-formed result and never throws, whatever comes back', async () => {
    await fc.assert(
      fc.asyncProperty(arbStatus, arbBody, arbHeaders, async (status, body, headers) => {
        const fetchImpl = jest.fn().mockResolvedValue(
          new Response(status === 204 ? null : body, { status, headers: headers as Record<string, string> }),
        );

        const client = new CromaClient({
          apiKey: 'k',
          fetchImpl: fetchImpl as unknown as typeof fetch,
          sleep: async () => undefined,
          maxPolls: 2,
        });

        const result = await client.call('/mx/siem/establishments/v1', { name: 'X' }, { source: 'mx.siem' });

        expect(typeof result.available).toBe('boolean');
        expect(result.source).toBe('mx.siem');
        if (result.available) {
          expect(result.data).not.toBeNull();
          expect(typeof result.checked_at).toBe('string');
        } else {
          expect(result.data).toBeNull();
          expect(typeof result.error).toBe('string');
        }
      }),
      { numRuns: 300 },
    );
  });

  it('never throws when the transport itself fails', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (message) => {
        const fetchImpl = jest.fn().mockRejectedValue(new Error(message));
        const client = new CromaClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });

        const result = await client.call('/p', {}, { source: 's' });

        expect(result.available).toBe(false);
        expect(result.data).toBeNull();
      }),
    );
  });

  it('never exposes the API key in the returned result', async () => {
    await fc.assert(
      fc.asyncProperty(arbStatus, arbBody, async (status, body) => {
        const apiKey = 'croma_live_supersecret_value';
        const fetchImpl = jest.fn().mockResolvedValue(new Response(status === 204 ? null : body, { status }));
        const client = new CromaClient({
          apiKey,
          fetchImpl: fetchImpl as unknown as typeof fetch,
          sleep: async () => undefined,
          maxPolls: 1,
        });

        const result = await client.call('/p', {}, { source: 's' });

        expect(JSON.stringify(result)).not.toContain(apiKey);
      }),
      { numRuns: 100 },
    );
  });
});
