import {
  CERTIFICATE_FILE,
  buildCertificate,
  checkFiles,
  parseCertificate,
  verifyCertificate,
} from '../../src/common/integrity/certificate';
import { canonicalJson, digestOf, fileDigest, formatFolio, reportFolio, sealHash } from '../../src/common/integrity/report-digest';

const GENERATED_AT = '2026-08-14T20:12:12.961Z';

function filesOf(entries: Record<string, string>): Map<string, Buffer> {
  return new Map(Object.entries(entries).map(([name, body]) => [name, Buffer.from(body, 'utf8')]));
}

function certificateFor(entries: Record<string, string>) {
  const digests = Object.entries(entries).map(([name, body]) => fileDigest(name, Buffer.from(body, 'utf8')));
  return buildCertificate({ files: digests, generatedAt: GENERATED_AT });
}

describe('digests', () => {
  it('changes when a single byte changes', () => {
    expect(digestOf('reporte')).not.toBe(digestOf('reportе'));
    expect(digestOf('a')).toBe(digestOf(Buffer.from('a', 'utf8')));
  });

  it('orders object keys, so the same report never hashes two ways', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    expect(canonicalJson({ a: [1, { d: 4, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":4}]}');
  });

  it('commits to every file at once, so one transaction covers the whole folder', () => {
    const html = fileDigest('creva-reporte.html', Buffer.from('<html>a</html>'));
    const pdf = fileDigest('creva-reporte.pdf', Buffer.from('%PDF-a'));

    // File order must not move the anchor, or two identical folders would disagree.
    expect(sealHash([html, pdf], GENERATED_AT)).toBe(sealHash([pdf, html], GENERATED_AT));
    expect(sealHash([html], GENERATED_AT)).not.toBe(sealHash([html, pdf], GENERATED_AT));
  });

  it('moves when the generation time moves, so an old seal cannot be reused', () => {
    const html = fileDigest('creva-reporte.html', Buffer.from('<html>a</html>'));

    expect(sealHash([html], GENERATED_AT)).not.toBe(sealHash([html], '2026-08-15T00:00:00.000Z'));
  });
});

describe('verifying a delivered folder', () => {
  it('passes the files exactly as they were sealed', () => {
    const contents = { 'creva-reporte.html': '<html>real</html>', 'creva-reporte.pdf': '%PDF-real' };
    const result = verifyCertificate(certificateFor(contents), filesOf(contents));

    expect(result.files_intact).toBe(true);
    expect(result.seal_is_self_consistent).toBe(true);
  });

  it('names the altered file, not just that something is wrong', () => {
    const sealed = certificateFor({ 'creva-reporte.html': '<html>real</html>', 'creva-reporte.pdf': '%PDF-real' });
    const tampered = filesOf({ 'creva-reporte.html': '<html>real</html>', 'creva-reporte.pdf': '%PDF-fake' });
    const checks = checkFiles(sealed, tampered);

    expect(checks.find((check) => check.name === 'creva-reporte.html')?.verdict).toBe('intact');
    expect(checks.find((check) => check.name === 'creva-reporte.pdf')?.verdict).toBe('altered');
  });

  it('catches a one-byte edit, which is the whole point', () => {
    const sealed = certificateFor({ 'creva-reporte.html': '<p>Sin sello</p>' });
    const tampered = filesOf({ 'creva-reporte.html': '<p>Sin sellо</p>' });

    expect(checkFiles(sealed, tampered)[0]?.verdict).toBe('altered');
  });

  it('says missing rather than altered when a file was removed', () => {
    const sealed = certificateFor({ 'creva-reporte.html': 'a', 'creva-reporte.pdf': 'b' });
    const checks = checkFiles(sealed, filesOf({ 'creva-reporte.html': 'a' }));

    expect(checks.find((check) => check.name === 'creva-reporte.pdf')?.verdict).toBe('missing');
  });

  it('states what it does not prove, so an intact file is not read as proof of origin', () => {
    const contents = { 'creva-reporte.html': 'a' };
    const sealed = certificateFor(contents);
    const result = verifyCertificate(sealed, filesOf(contents));

    expect(result.files_intact).toBe(true);
    expect(sealed.does_not_prove.join(' ')).toContain('quién emitió el reporte');
  });

  it('notices a seal whose own hash does not match the digests it lists', () => {
    const sealed = { ...certificateFor({ 'creva-reporte.html': 'a' }), seal_hash: '0'.repeat(64) };
    const result = verifyCertificate(sealed, filesOf({ 'creva-reporte.html': 'a' }));

    expect(result.seal_is_self_consistent).toBe(false);
  });
});

describe('the certificate on disk', () => {
  it('is named so a person finds it next to the report', () => {
    expect(CERTIFICATE_FILE).toBe('creva-sello.json');
  });

  it('survives a round trip through JSON', () => {
    const sealed = certificateFor({ 'creva-reporte.html': 'a' });

    expect(parseCertificate(JSON.stringify(sealed))).toEqual(sealed);
  });

  it('refuses a seal that is not the shape it claims, instead of trusting it', () => {
    expect(parseCertificate('no json')).toBeNull();
    expect(parseCertificate('{"schema":"x"}')).toBeNull();
  });

  it('tells the reader how to check it without our help', () => {
    const sealed = certificateFor({ 'creva-reporte.html': 'a' });

    expect(sealed.how_to_verify.join(' ')).toContain('SHA-256');
    expect(sealed.how_to_verify.length).toBeGreaterThan(2);
  });
});

describe('the folio a bank can quote', () => {
  const report = { generated_at: '2026-08-14T20:12:12.961Z', signals: [{ a: 1 }], subject: null };

  it('is stable for the same report content, whatever the key order', () => {
    const shuffled = { subject: null, signals: [{ a: 1 }], generated_at: '2026-08-14T20:12:12.961Z' };

    expect(reportFolio(report)).toBe(reportFolio(shuffled));
  });

  it('changes when any part of the content changes', () => {
    expect(reportFolio(report)).not.toBe(reportFolio({ ...report, signals: [{ a: 2 }] }));
  });

  it('is groupable so it can be read off a printed page', () => {
    expect(formatFolio('abcdef0123456789abcdef0123456789ffff')).toBe('ABCDEF01-23456789-ABCDEF01-23456789');
  });

  it('describes the content, so printing it inside the report is not circular', () => {
    // The folio covers the report data, never the rendered file that displays it.
    const folio = reportFolio(report);
    const rendered = `<p>Folio ${formatFolio(folio)}</p>`;

    expect(reportFolio(report)).toBe(folio);
    expect(rendered).toContain(formatFolio(folio));
  });
});
