// croma-client: HTTP client for the government-data provider.

import { Logger, noopLogger } from './logger';
import { SourceResult, sourceOk, sourceUnavailable } from './types';

const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed', 'canceled', 'expired']);
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_MAX_POLLS = 60;
const DEFAULT_TIMEOUT_MS = 60000;

export interface RateLimitSnapshot {
  limit?: string;
  remaining?: string;
  reset?: string;
}

interface InlineEnvelope<T> {
  data?: T | null;
}

interface JobEnvelope {
  job?: {
    id?: string;
    status?: string;
    status_url?: string;
  };
  data?: unknown;
  error?: unknown;
}

export interface RetryPolicy {
  attempts: number;
  statuses?: number[];
  baseDelayMs?: number;
}

export interface CallOptions {
  source: string;
  retry?: RetryPolicy;
}

export interface CromaClientOptions {
  apiKey?: string;
  baseUrl?: string;
  waitSeconds?: number;
  fetchImpl?: typeof globalThis.fetch;
  pollIntervalMs?: number;
  maxPolls?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  logger?: Logger;
}

export interface CromaCallable {
  call<T>(path: string, body: unknown, options: CallOptions): Promise<SourceResult<T>>;
}

export class CromaClient implements CromaCallable {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly waitSeconds: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly pollIntervalMs: number;
  private readonly maxPolls: number;
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly logger: Logger;
  private rateLimit: RateLimitSnapshot = {};

  constructor(options: CromaClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.croma.run').replace(/\/+$/, '');
    this.waitSeconds = options.waitSeconds ?? 55;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.maxPolls = options.maxPolls ?? DEFAULT_MAX_POLLS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.logger = options.logger ?? noopLogger;
  }

  // Provider limiter fails open: an empty snapshot means unknown, not available quota.
  getRateLimit(): RateLimitSnapshot {
    return this.rateLimit;
  }

  async call<T>(path: string, body: unknown, options: CallOptions): Promise<SourceResult<T>> {
    if (!this.apiKey) {
      this.logger.log('warn', 'croma.skipped', { source: options.source, path, reason: 'missing_api_key' });
      return sourceUnavailable<T>(options.source, 'missing_api_key');
    }

    const startedAt = Date.now();
    let result: SourceResult<T>;
    try {
      result = await this.request<T>(path, body, options);
    } catch (error) {
      const reason = error instanceof Error ? error.name === 'TimeoutError' ? 'timeout' : error.message : 'unknown_error';
      result = sourceUnavailable<T>(options.source, `request_failed:${reason}`, new Date().toISOString());
    }

    this.logger.log(result.available ? 'info' : 'warn', 'croma.call', {
      source: options.source,
      path,
      available: result.available,
      error: result.error,
      elapsed_ms: Date.now() - startedAt,
      rate_limit_remaining: this.rateLimit.remaining,
    });
    return result;
  }

  private async request<T>(path: string, body: unknown, options: CallOptions): Promise<SourceResult<T>> {
    const retry = options.retry;
    const maxAttempts = (retry?.attempts ?? 0) + 1;
    const retryStatuses = new Set(retry?.statuses ?? [502, 503, 504]);
    const baseDelayMs = retry?.baseDelayMs ?? 500;

    let lastDegraded = sourceUnavailable<T>(options.source, 'no_attempt_made');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          Prefer: `wait=${this.waitSeconds}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      this.captureRateLimit(response);

      if (response.status === 202) {
        const envelope = (await response.json()) as JobEnvelope;
        return this.pollJob<T>(envelope, options.source, this.readRetryAfterMs(response));
      }

      if (!response.ok) {
        lastDegraded = sourceUnavailable<T>(options.source, `http_${response.status}`, new Date().toISOString());
        const canRetry = retryStatuses.has(response.status) && attempt < maxAttempts - 1;
        if (!canRetry) return lastDegraded;

        await this.sleep(baseDelayMs * 2 ** attempt);
        continue;
      }

      const envelope = (await response.json()) as InlineEnvelope<T>;
      const data = envelope.data ?? null;
      if (data === null) {
        return sourceUnavailable<T>(options.source, 'empty_payload', new Date().toISOString());
      }
      return sourceOk<T>(options.source, data);
    }

    return lastDegraded;
  }

  private async pollJob<T>(
    envelope: JobEnvelope,
    source: string,
    initialWaitMs: number,
  ): Promise<SourceResult<T>> {
    if (envelope.job?.status === 'completed' && envelope.data != null) {
      return sourceOk<T>(source, envelope.data as T);
    }

    const statusPath = envelope.job?.status_url ?? (envelope.job?.id ? `/jobs/${envelope.job.id}` : undefined);
    if (!statusPath) {
      return sourceUnavailable<T>(source, 'missing_job_status_url', new Date().toISOString());
    }

    const url = statusPath.startsWith('http') ? statusPath : `${this.baseUrl}${statusPath}`;
    let waitMs = initialWaitMs;
    const startedAt = Date.now();

    for (let poll = 0; poll < this.maxPolls; poll++) {
      await this.sleep(waitMs);

      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      this.captureRateLimit(response);

      if (!response.ok) {
        return sourceUnavailable<T>(source, `http_${response.status}`, new Date().toISOString());
      }

      const payload = (await response.json()) as JobEnvelope;
      const status = payload.job?.status;

      if (status && !TERMINAL_JOB_STATUSES.has(status)) {
        waitMs = this.readRetryAfterMs(response);
        continue;
      }

      this.logger.log('info', 'croma.job', {
        source,
        status: status ?? 'unknown',
        polls: poll + 1,
        elapsed_ms: Date.now() - startedAt,
      });

      if (status === 'completed') {
        const data = payload.data ?? null;
        if (data === null) {
          return sourceUnavailable<T>(source, 'empty_payload', new Date().toISOString());
        }
        return sourceOk<T>(source, data as T);
      }

      return sourceUnavailable<T>(source, `job_${status ?? 'unknown'}`, new Date().toISOString());
    }

    this.logger.log('warn', 'croma.job', {
      source,
      status: 'poll_exhausted',
      polls: this.maxPolls,
      elapsed_ms: Date.now() - startedAt,
    });
    return sourceUnavailable<T>(source, 'job_poll_exhausted', new Date().toISOString());
  }

  private readRetryAfterMs(response: Response): number {
    const header = response.headers.get('Retry-After');
    if (header === null) return this.pollIntervalMs;

    const seconds = Number(header);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : this.pollIntervalMs;
  }

  private captureRateLimit(response: Response): void {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    if (limit === null && remaining === null && reset === null) return;

    this.rateLimit = {
      ...(limit !== null && { limit }),
      ...(remaining !== null && { remaining }),
      ...(reset !== null && { reset }),
    };
  }
}
