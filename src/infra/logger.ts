// logger: logging port with redaction of credentials and personal data.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

export interface Logger {
  log(level: LogLevel, message: string, fields?: LogFields): void;
}

export const noopLogger: Logger = {
  log: () => undefined,
};

const SECRET_KEY_PATTERN = /(key|token|secret|authorization|password)/i;
const PERSONAL_KEY_PATTERN = /(rfc|curp|email|phone|address|name)/i;
const CREDENTIAL_VALUE_PATTERN = /\b(croma_(?:live|test)_[A-Za-z0-9_-]+|Bearer\s+\S+)/gi;

export function redact(fields: LogFields): LogFields {
  const safe: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      safe[key] = '[redacted]';
    } else if (PERSONAL_KEY_PATTERN.test(key)) {
      safe[key] = value === null || value === undefined ? value : '[personal]';
    } else if (typeof value === 'string') {
      safe[key] = value.replace(CREDENTIAL_VALUE_PATTERN, '[redacted]');
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

export function createConsoleLogger(sink: Pick<Console, 'log'> = console): Logger {
  return {
    log(level, message, fields = {}) {
      sink.log(JSON.stringify({ level, message, ...redact(fields) }));
    },
  };
}
