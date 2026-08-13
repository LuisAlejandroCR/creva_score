import { createConsoleLogger, noopLogger, redact } from '../../src/infra/logger';

describe('redact', () => {
  it('masks credential-bearing keys', () => {
    expect(redact({ api_key: 'abc', authorization: 'Bearer x', token: 't' })).toEqual({
      api_key: '[redacted]',
      authorization: '[redacted]',
      token: '[redacted]',
    });
  });

  it('masks personal-data keys without losing their absence', () => {
    expect(redact({ rfc: 'ACM010101AAA', email: null, commercial_name: undefined })).toEqual({
      rfc: '[personal]',
      email: null,
      commercial_name: undefined,
    });
  });

  it('strips a credential value even from a harmless field', () => {
    expect(redact({ note: 'failed with croma_live_abc123 while calling' })).toEqual({
      note: 'failed with [redacted] while calling',
    });
  });

  it('leaves operational fields intact', () => {
    expect(redact({ elapsed_ms: 120, available: false, error: 'http_502', path: '/mx/siem/establishments/v1' })).toEqual({
      elapsed_ms: 120,
      available: false,
      error: 'http_502',
      path: '/mx/siem/establishments/v1',
    });
  });
});

describe('loggers', () => {
  it('emits one JSON line per call', () => {
    const lines: string[] = [];
    createConsoleLogger({ log: (line: string) => lines.push(line) }).log('warn', 'croma.call', { elapsed_ms: 5 });

    expect(JSON.parse(lines[0] as string)).toEqual({ level: 'warn', message: 'croma.call', elapsed_ms: 5 });
  });

  it('does nothing by default', () => {
    expect(() => noopLogger.log('info', 'anything', { a: 1 })).not.toThrow();
  });
});
