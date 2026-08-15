// signing-key: loads Creva's signing key from disk, without ever putting it in a log or a message.

import { existsSync, readFileSync } from 'node:fs';

export function readSigningKey(path: string): string | undefined {
  const trimmed = path.trim();
  if (trimmed === '' || !existsSync(trimmed)) return undefined;

  try {
    const contents = readFileSync(trimmed, 'utf8').trim();
    return contents === '' ? undefined : contents;
  } catch {
    // An unreadable key leaves the report unsigned; it never becomes an error the user sees.
    return undefined;
  }
}

/** A PEM public key survives an .env line as one string with literal \n escapes. */
export function normalizePublicKey(value: string): string | undefined {
  const restored = value.split(String.raw`\n`).join('\n').trim();
  return restored === '' ? undefined : restored;
}

/** Prefers a key file, because a PEM written into a dotenv line loses its line breaks. */
export function readPublicKey(filePath: string, inlineValue: string): string | undefined {
  return readSigningKey(filePath) ?? normalizePublicKey(inlineValue);
}
