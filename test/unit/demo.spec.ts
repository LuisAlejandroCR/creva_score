import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describeSource, formatDate, parseArgs } from '../../src/cli/demo';
import { readEnvFile } from '../../src/cli/env-file';

describe('demo argument parsing', () => {
  it('reads the three supported flags', () => {
    expect(parseArgs(['--negocio', 'Cañoneri', '--estado', '29', '--rfc', 'ABC010101AB1'])).toEqual({
      businessName: 'Cañoneri',
      stateCode: 29,
      rfc: 'ABC010101AB1',
    });
  });

  it('ignores a flag left without a value', () => {
    expect(parseArgs(['--negocio', '--estado', '29'])).toEqual({ stateCode: 29 });
  });

  it('rejects a state code outside the official range', () => {
    expect(parseArgs(['--estado', '33'])).toEqual({});
    expect(parseArgs(['--estado', 'nueve'])).toEqual({});
    expect(parseArgs(['--estado', '0'])).toEqual({ stateCode: 0 });
  });

  it('returns nothing when no flags are given', () => {
    expect(parseArgs([])).toEqual({});
  });
});

describe('demo formatting', () => {
  it('formats a date for a Mexican reader', () => {
    expect(formatDate('2026-08-07T12:00:00.000Z')).toBe('07 de agosto de 2026');
  });

  it('keeps a gazette date on its own day instead of shifting it back one', () => {
    expect(formatDate('2026-08-07')).toBe('07 de agosto de 2026');
    expect(formatDate('2025-12-29')).toBe('29 de diciembre de 2025');
    expect(formatDate('2026-01-01')).toBe('01 de enero de 2026');
  });

  it('says so plainly when there is no usable date', () => {
    expect(formatDate(null)).toBe('sin fecha');
    expect(formatDate('not a date')).toBe('sin fecha');
  });

  it('names each source in words the user can read', () => {
    expect(describeSource('mx.siem')).toContain('Directorio oficial');
    expect(describeSource('mx.dof')).toContain('Diario Oficial');
    expect(describeSource('mx.cnbv')).toContain('Comisión Nacional Bancaria');
  });

  it('falls back to the raw identifier for an unknown source', () => {
    expect(describeSource('mx.unknown')).toBe('mx.unknown');
  });
});

describe('demo env file', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'creva-envfile-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads pairs, skipping comments and blank lines', async () => {
    const path = join(directory, '.env');
    await writeFile(path, ['# comment', '', 'A=1', 'B = two ', 'C="quoted"', "D='single'"].join('\n'), 'utf8');

    expect(readEnvFile(path)).toEqual({ A: '1', B: 'two', C: 'quoted', D: 'single' });
  });

  it('keeps a value that itself contains an equals sign', async () => {
    const path = join(directory, '.env');
    await writeFile(path, 'URL=https://x.test/?a=1', 'utf8');

    expect(readEnvFile(path)).toEqual({ URL: 'https://x.test/?a=1' });
  });

  it('returns nothing when the file is absent', () => {
    expect(readEnvFile(join(directory, 'missing.env'))).toEqual({});
  });
});
