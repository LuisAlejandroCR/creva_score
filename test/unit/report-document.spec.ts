import { DocumentTools, buildReportDocument, fileUrl, slugify } from '../../src/modules/mcp/report-document';

function tools(overrides: Partial<DocumentTools> = {}): { tools: DocumentTools; written: string[] } {
  const written: string[] = [];
  return {
    written,
    tools: {
      findBrowser: () => '/fake/chrome',
      print: async () => 4096,
      writeFile: (path, contents) => {
        written.push(path);
        return contents.length;
      },
      makeDir: () => undefined,
      now: () => 1,
      ...overrides,
    },
  };
}

describe('buildReportDocument', () => {
  it('produces the PDF when a browser is available', async () => {
    const { tools: t } = tools();
    const document = await buildReportDocument('<html></html>', 'ABARROTES ERENDIRA', t);

    expect(document.kind).toBe('pdf');
    expect(document.bytes).toBe(4096);
    expect(document.path).toContain('creva-reporte.pdf');
  });

  it('falls back to the interactive report when no browser is installed', async () => {
    // The demo must not die because a machine has no Chromium.
    const { tools: t } = tools({ findBrowser: () => null });
    const document = await buildReportDocument('<html>x</html>', 'ACME', t);

    expect(document.kind).toBe('html');
    expect(document.path).toContain('creva-reporte.html');
    expect(document.note).toContain('Descargar PDF');
  });

  it('falls back when printing produces nothing, rather than handing over an empty file', async () => {
    const { tools: t } = tools({ print: async () => 0 });
    const document = await buildReportDocument('<html>x</html>', 'ACME', t);

    expect(document.kind).toBe('html');
  });

  it('always writes the html first, so the fallback is already on disk', async () => {
    const { tools: t, written } = tools();
    await buildReportDocument('<html></html>', 'ACME', t);

    expect(written).toHaveLength(1);
    expect(written[0]).toContain('creva-reporte.html');
  });

  it('names the folder after the business, without accents or spaces', () => {
    expect(slugify('Estética Magnifique Studio')).toBe('estetica-magnifique-studio');
    expect(slugify('   ')).toBe('reporte');
  });

  it('builds a file URL a client can open', () => {
    expect(fileUrl(String.raw`C:\tmp\a.pdf`)).toBe('file:///C:/tmp/a.pdf');
    expect(fileUrl('/tmp/a.pdf')).toBe('file:///tmp/a.pdf');
  });
});
