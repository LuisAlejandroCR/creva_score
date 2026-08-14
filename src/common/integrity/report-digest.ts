// report-digest: fingerprints of what was delivered, so an alteration cannot pass unnoticed.

import { createHash } from 'node:crypto';

export const DIGEST_ALGORITHM = 'sha256';
export const SEAL_SCHEMA = 'creva-report-seal/v1';

export interface FileDigest {
  name: string;
  bytes: number;
  digest: string;
}

export function digestOf(contents: Buffer | string): string {
  return createHash(DIGEST_ALGORITHM).update(contents).digest('hex');
}

export function fileDigest(name: string, contents: Buffer): FileDigest {
  return { name, bytes: contents.length, digest: digestOf(contents) };
}

// Key order decides the bytes, so the canonical form sorts it; otherwise the same report hashes twice.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);

  return `{${entries.join(',')}}`;
}

/**
 * The number printed inside the report itself. It covers the report's content, not the file
 * bytes, so it can be shown on the page without changing the very digest it states.
 */
export function reportFolio(report: unknown): string {
  return digestOf(canonicalJson(report));
}

/** Grouped for reading aloud or copying off a printed page. */
export function formatFolio(folio: string): string {
  return (folio.slice(0, 32).match(/.{1,8}/g) ?? []).join('-').toUpperCase();
}

/**
 * One value that commits to every delivered file at once, so a single number covers the
 * whole folder rather than one file of it.
 */
export function sealHash(files: FileDigest[], generatedAt: string): string {
  const commitment = [
    SEAL_SCHEMA,
    generatedAt,
    ...[...files].sort((left, right) => (left.name < right.name ? -1 : 1)).map((file) => `${file.name}:${file.digest}`),
  ].join('\n');

  return digestOf(commitment);
}
