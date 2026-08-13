import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  describeProvenance,
  describeSource,
  formatDate,
  parseArgs,
  renderVerification,
} from '../../src/cli/demo';
import { CountingCacheStore } from '../../src/cli/counting-cache';
import { MemoryCacheStore } from '../../src/infra/cache';
import { sourceOk, sourceUnavailable } from '../../src/infra/types';
import { readEnvFile } from '../../src/cli/env-file';

const verification = (matched: boolean) =>
  sourceOk('mx.siem', {
    matched,
    confirmed_by_rfc: false,
    establishment_id: matched ? 'e1' : null,
    commercial_name: matched ? 'ABARROTES LUPITA' : null,
    state: matched ? 'Tlaxcala' : null,
    candidates_found: matched ? 1 : 0,
  });

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

describe('demo verification section', () => {
  it('still shows the section, and how to use it, when no business was asked for', () => {
    const lines = renderVerification({}, null).join('\n');

    expect(lines).toContain('Sello de tu negocio');
    expect(lines).toContain('No consultamos ningún negocio');
    expect(lines).toContain('--negocio');
  });

  it('never claims a result when no business was asked for', () => {
    const lines = renderVerification({}, verification(true)).join('\n');

    expect(lines).toContain('No consultamos ningún negocio');
    expect(lines).not.toContain('Encontramos');
  });

  it('says the score is unchanged when the business is absent from the directory', () => {
    const lines = renderVerification({ businessName: 'Cañoneri' }, verification(false)).join('\n');

    expect(lines).toContain('No encontramos "Cañoneri"');
    expect(lines).toContain('el registro es voluntario');
    expect(lines).toContain('Tu puntaje es exactamente el mismo');
  });

  it('separates a provider outage from an absence', () => {
    const lines = renderVerification(
      { businessName: 'Cañoneri' },
      sourceUnavailable('mx.siem', 'http_503'),
    ).join('\n');

    expect(lines).toContain('No pudimos consultar el directorio');
    expect(lines).not.toContain('el registro es voluntario');
  });
});

describe('demo provenance line', () => {
  it('says nothing was queried when every read came from storage', () => {
    expect(describeProvenance(true, 2, 0)).toContain('No se consultó ninguna fuente');
  });

  it('says it queried when nothing was stored yet', () => {
    expect(describeProvenance(true, 0, 2)).toBe('Consulta nueva a los registros oficiales.');
  });

  it('says both when the run mixed stored and fresh data', () => {
    expect(describeProvenance(true, 1, 1)).toContain('completada con datos ya guardados');
  });

  it('leads with the missing credentials when there are none', () => {
    expect(describeProvenance(false, 5, 0)).toContain('modo degradado');
  });
});

describe('CountingCacheStore', () => {
  it('counts a miss then a hit, and still serves the value', async () => {
    const counting = new CountingCacheStore(new MemoryCacheStore());

    await expect(counting.get('k')).resolves.toBeUndefined();
    await counting.set('k', sourceOk('s', { a: 1 }), 60_000);
    await expect(counting.get('k')).resolves.toMatchObject({ data: { a: 1 } });

    expect(counting.misses).toBe(1);
    expect(counting.hits).toBe(1);
  });

  it('passes a deletion through to the wrapped store', async () => {
    const inner = new MemoryCacheStore();
    const counting = new CountingCacheStore(inner);

    await counting.set('k', sourceOk('s', { a: 1 }), 60_000);
    await counting.delete('k');

    await expect(inner.get('k')).resolves.toBeUndefined();
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
