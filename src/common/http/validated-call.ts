// validated-call: schema-validated call over the HTTP client.

import { z } from 'zod';
import { CallOptions, CromaCallable } from './croma.client';
import { SourceResult, sourceUnavailable } from '../types/source-result.types';

export async function callAndValidate<T>(
  client: CromaCallable,
  path: string,
  body: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  options: CallOptions,
): Promise<SourceResult<T>> {
  const result = await client.call<unknown>(path, body, options);

  if (!result.available || result.data === null) {
    return { ...result, data: null };
  }

  const parsed = schema.safeParse(result.data);
  if (!parsed.success) {
    return sourceUnavailable<T>(result.source, 'invalid_response_shape', result.checked_at);
  }

  return { ...result, data: parsed.data };
}
