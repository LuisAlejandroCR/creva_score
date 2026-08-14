import { join } from 'node:path';
import { DocumentTools, buildReportDocument, fileUrl } from '../../src/modules/mcp/report-document';

const FOLDER = join('C:', 'Users', 'x', 'Downloads', 'Creva_Score_acme_2026-08-14T21-30-05Z');
const GENERATED_AT = '2026-08-14T21:30:05.000Z';

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
      resolveFolder: () => FOLDER,
      ...overrides,
    },
  };
}

describe('buildReportDocument', () => {
  it('produces the PDF when a browser is available', async () => {
    const { tools: t } = tools();
    const document = await buildReportDocument('<html></html>', 'ABARROTES ERENDIRA', GENERATED_AT, t);

    expect(document.kind).toBe('pdf');
    expect(document.bytes).toBe(4096);
    expect(document.path).toBe(join(FOLDER, 'creva-reporte.pdf'));
  });

  it('hands over the interactive page alongside the PDF, not instead of it', async () => {
    const { tools: t } = tools();
    const document = await buildReportDocument('<html></html>', 'ACME', GENERATED_AT, t);

    expect(document.htmlPath).toBe(join(FOLDER, 'creva-reporte.html'));
    expect(document.htmlBytes).toBeGreaterThan(0);
  });

  it('falls back to the interactive report when no browser is installed', async () => {
    // The demo must not die because a machine has no Chromium.
    const { tools: t } = tools({ findBrowser: () => null });
    const document = await buildReportDocument('<html>x</html>', 'ACME', GENERATED_AT, t);

    expect(document.kind).toBe('html');
    expect(document.path).toBe(document.htmlPath);
    expect(document.note).toContain('Descargar PDF');
  });

  it('falls back when printing produces nothing, rather than handing over an empty file', async () => {
    const { tools: t } = tools({ print: async () => 0 });
    const document = await buildReportDocument('<html>x</html>', 'ACME', GENERATED_AT, t);

    expect(document.kind).toBe('html');
  });

  it('always writes the html first, so the fallback is already on disk', async () => {
    const { tools: t, written } = tools();
    await buildReportDocument('<html></html>', 'ACME', GENERATED_AT, t);

    expect(written).toHaveLength(1);
    expect(written[0]).toContain('creva-reporte.html');
  });

  it('puts both files in the one folder it reports', async () => {
    const { tools: t } = tools();
    const document = await buildReportDocument('<html></html>', 'ACME', GENERATED_AT, t);

    expect(document.folder).toBe(FOLDER);
    expect(document.path.startsWith(FOLDER)).toBe(true);
    expect(document.htmlPath.startsWith(FOLDER)).toBe(true);
  });

  it('asks for the folder with the report clock, never a second one', async () => {
    const seen: Array<[string, string]> = [];
    const { tools: t } = tools({
      resolveFolder: (businessName, generatedAt) => {
        seen.push([businessName, generatedAt]);
        return FOLDER;
      },
    });
    await buildReportDocument('<html></html>', 'ACME', GENERATED_AT, t);

    expect(seen).toEqual([['ACME', GENERATED_AT]]);
  });

  it('builds a file URL a client can open', () => {
    expect(fileUrl(String.raw`C:\tmp\a.pdf`)).toBe('file:///C:/tmp/a.pdf');
    expect(fileUrl('/tmp/a.pdf')).toBe('file:///tmp/a.pdf');
  });
});
