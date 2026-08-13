import { CromaClient } from './croma-client';

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

const noSleep = async (): Promise<void> => undefined;

describe('CromaClient', () => {
  it('degrades instead of calling when no API key is configured', async () => {
    const fetchImpl = jest.fn();
    const client = new CromaClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.call('/mx/siem/establishments/v1', { name: 'X' }, { source: 'mx.siem' });

    expect(result).toEqual({ available: false, source: 'mx.siem', checked_at: null, data: null, error: 'missing_api_key' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('unwraps the inline data envelope on 200', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ data: { query: 'ACME' } }));
    const client = new CromaClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.call<{ query: string }>('/p', {}, { source: 's' });

    expect(result.available).toBe(true);
    expect(result.data).toEqual({ query: 'ACME' });
    expect(result.checked_at).not.toBeNull();
  });

  it('sends the auth, content-type and inline-wait headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ data: {} }));
    const client = new CromaClient({ apiKey: 'secret', waitSeconds: 30, fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.call('/p', { a: 1 }, { source: 's' });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json',
      Prefer: 'wait=30',
    });
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('polls an async job until it completes', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ job: { id: 'job_1', status: 'queued', status_url: '/jobs/job_1' } }, { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({ job: { id: 'job_1', status: 'running' }, data: null }))
      .mockResolvedValueOnce(jsonResponse({ job: { id: 'job_1', status: 'completed' }, data: { found: true } }));

    const client = new CromaClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });
    const result = await client.call<{ found: boolean }>('/p', {}, { source: 's' });

    expect(result.available).toBe(true);
    expect(result.data).toEqual({ found: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('degrades when an async job ends in a non-completed terminal state', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ job: { id: 'j', status: 'queued', status_url: '/jobs/j' } }, { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({ job: { id: 'j', status: 'failed' }, error: { code: 'internal_error' } }));

    const client = new CromaClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });
    const result = await client.call('/p', {}, { source: 's' });

    expect(result.available).toBe(false);
    expect(result.error).toBe('job_failed');
  });

  it('branches on the HTTP status, not on body flags', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ error: { code: 'rate_limited' } }, { status: 429 }));
    const client = new CromaClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.call('/p', {}, { source: 's' });

    expect(result.available).toBe(false);
    expect(result.error).toBe('http_429');
  });

  it('retries upstream failures and succeeds on a later attempt', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { status: 502 }))
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));

    const client = new CromaClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });
    const result = await client.call<{ ok: boolean }>('/p', {}, { source: 's', retry: { attempts: 1 } });

    expect(result.available).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry statuses outside the retry policy', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, { status: 400 }));
    const client = new CromaClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });

    await client.call('/p', {}, { source: 's', retry: { attempts: 2 } });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('never throws when the network fails', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const client = new CromaClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.call('/p', {}, { source: 's' });

    expect(result.available).toBe(false);
    expect(result.error).toBe('request_failed:ECONNRESET');
  });

  it('captures rate-limit headers and leaves the snapshot empty when they are absent', async () => {
    const withHeaders = new CromaClient({
      apiKey: 'k',
      fetchImpl: jest.fn().mockResolvedValue(
        jsonResponse({ data: {} }, { headers: { 'X-RateLimit-Limit': '100', 'X-RateLimit-Remaining': '98' } }),
      ) as unknown as typeof fetch,
    });
    await withHeaders.call('/p', {}, { source: 's' });
    expect(withHeaders.getRateLimit()).toEqual({ limit: '100', remaining: '98' });

    const withoutHeaders = new CromaClient({
      apiKey: 'k',
      fetchImpl: jest.fn().mockResolvedValue(jsonResponse({ data: {} })) as unknown as typeof fetch,
    });
    await withoutHeaders.call('/p', {}, { source: 's' });
    expect(withoutHeaders.getRateLimit()).toEqual({});
  });
});
