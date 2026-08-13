// types: shared result shape for every external source.

export interface SourceResult<T> {
  available: boolean;
  source: string;
  checked_at: string | null;
  data: T | null;
  error?: string;
}

export function sourceOk<T>(source: string, data: T, checkedAt: string = new Date().toISOString()): SourceResult<T> {
  return { available: true, source, checked_at: checkedAt, data };
}

export function sourceUnavailable<T>(
  source: string,
  error: string,
  checkedAt: string | null = null,
): SourceResult<T> {
  return { available: false, source, checked_at: checkedAt, data: null, error };
}
