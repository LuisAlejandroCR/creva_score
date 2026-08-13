// env-file: reads a KEY=VALUE file into a plain record, for the demo entry point.

import { readFileSync } from 'node:fs';

export function readEnvFile(filePath: string): NodeJS.ProcessEnv {
  let contents: string;
  try {
    contents = readFileSync(filePath, 'utf8');
  } catch {
    return {};
  }

  const values: NodeJS.ProcessEnv = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (key === '') continue;

    values[key] = unquote(trimmed.slice(separator + 1).trim());
  }
  return values;
}

function unquote(value: string): string {
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
  return quoted && value.length >= 2 ? value.slice(1, -1) : value;
}
