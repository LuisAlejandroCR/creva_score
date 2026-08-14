import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sealReport } from '../../src/modules/attestation/attestation.service';
import { sealFolderOnDisk, verifyFolderOnDisk } from '../../src/modules/attestation/seal-folder';

const GENERATED_AT = '2026-08-14T20:12:12.961Z';

function folderWith(files: Record<string, string>): string {
  const folder = mkdtempSync(join(tmpdir(), 'creva-seal-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(folder, name), body, 'utf8');
  return folder;
}

describe('sealing a report', () => {
  it('records a digest for every delivered file', () => {
    const certificate = sealReport(
      [
        { name: 'creva-reporte.html', contents: Buffer.from('<html></html>') },
        { name: 'creva-reporte.pdf', contents: Buffer.from('%PDF') },
      ],
      GENERATED_AT,
    );

    expect(certificate.files).toHaveLength(2);
    expect(certificate.seal_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('states its own limit, so nobody reads it as proof of authorship', () => {
    const certificate = sealReport([{ name: 'a', contents: Buffer.from('x') }], GENERATED_AT);

    expect(certificate.does_not_prove.join(' ')).toContain('quién emitió el reporte');
    expect(certificate.proves.length).toBeGreaterThan(0);
  });

  it('carries the folio that is printed inside the report', () => {
    const certificate = sealReport([{ name: 'a', contents: Buffer.from('x') }], GENERATED_AT, 'abc123');

    expect(certificate.report_folio).toBe('abc123');
  });

  it('needs no network, so it cannot fail because something external is down', () => {
    // Deterministic and synchronous by construction: the same input always seals the same way.
    const once = sealReport([{ name: 'a', contents: Buffer.from('x') }], GENERATED_AT);
    const twice = sealReport([{ name: 'a', contents: Buffer.from('x') }], GENERATED_AT);

    expect(once).toEqual(twice);
  });
});

describe('sealing and verifying a real folder', () => {
  it('writes the seal beside the files and confirms them', () => {
    const folder = folderWith({ 'creva-reporte.html': '<html>real</html>', 'creva-reporte.json': '{"a":1}' });
    sealFolderOnDisk(folder, ['creva-reporte.html', 'creva-reporte.json'], GENERATED_AT);

    expect(readdirSync(folder)).toContain('creva-sello.json');

    const outcome = verifyFolderOnDisk(folder);
    if ('error' in outcome) throw new Error(outcome.error);

    expect(outcome.result.files_intact).toBe(true);
    expect(outcome.result.seal_is_self_consistent).toBe(true);
  });

  it('catches a file edited after it was sealed', () => {
    const folder = folderWith({ 'creva-reporte.html': '<p>Sin sello</p>' });
    sealFolderOnDisk(folder, ['creva-reporte.html'], GENERATED_AT);

    writeFileSync(join(folder, 'creva-reporte.html'), '<p>Verificado</p>', 'utf8');
    const outcome = verifyFolderOnDisk(folder);

    if ('error' in outcome) throw new Error(outcome.error);
    expect(outcome.result.files_intact).toBe(false);
    expect(outcome.result.files[0]?.verdict).toBe('altered');
  });

  it('does not modify the files it sealed', () => {
    const folder = folderWith({ 'creva-reporte.html': '<html>real</html>' });
    const before = readFileSync(join(folder, 'creva-reporte.html'));
    sealFolderOnDisk(folder, ['creva-reporte.html'], GENERATED_AT);

    expect(readFileSync(join(folder, 'creva-reporte.html')).equals(before)).toBe(true);
  });

  it('says so when there is no seal to compare against', () => {
    const outcome = verifyFolderOnDisk(folderWith({ 'creva-reporte.html': 'a' }));

    expect('error' in outcome && outcome.error).toContain('creva-sello.json');
  });
});
