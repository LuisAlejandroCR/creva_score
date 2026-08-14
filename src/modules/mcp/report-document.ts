// report-document: turns a rendered report into the files an assistant can hand over.

import { spawn } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveReportFolder } from '../../common/output/report-folder';

export type DocumentKind = 'pdf' | 'html';

export interface ReportDocument {
  kind: DocumentKind;
  path: string;
  bytes: number;
  note: string;
  folder: string;
  htmlPath: string;
  htmlBytes: number;
}

export interface DocumentTools {
  findBrowser: () => string | null;
  print: (browser: string, htmlPath: string, pdfPath: string) => Promise<number>;
  writeFile: (path: string, contents: string) => number;
  resolveFolder: (businessName: string, generatedAt: string) => string;
}

const PRINT_TIMEOUT_MS = 25_000;

// Chromium ships a print-to-PDF mode, so no dependency is added for this.
const BROWSER_CANDIDATES = [
  join(process.env['PROGRAMFILES'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  join(process.env['PROGRAMFILES'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export const realTools: DocumentTools = {
  findBrowser: () => BROWSER_CANDIDATES.find((candidate) => candidate !== '' && safeExists(candidate)) ?? null,
  print: (browser, htmlPath, pdfPath) => runPrint(browser, htmlPath, pdfPath),
  writeFile: (path, contents) => {
    writeFileSync(path, contents, 'utf8');
    return Buffer.byteLength(contents, 'utf8');
  },
  resolveFolder: (businessName, generatedAt) => resolveReportFolder(businessName, generatedAt),
};

export function fileUrl(path: string): string {
  return `file:///${path.replace(/\\/g, '/').replace(/^\/+/, '')}`;
}

export async function buildReportDocument(
  html: string,
  businessName: string,
  generatedAt: string,
  tools: DocumentTools = realTools,
): Promise<ReportDocument> {
  const folder = tools.resolveFolder(businessName, generatedAt);

  const htmlPath = join(folder, 'creva-reporte.html');
  const htmlBytes = tools.writeFile(htmlPath, html);
  const asHtml = { folder, htmlPath, htmlBytes, kind: 'html' as const, path: htmlPath, bytes: htmlBytes };

  const browser = tools.findBrowser();
  if (browser === null) {
    return {
      ...asHtml,
      note: 'No se encontró un navegador para imprimir, así que se entrega el reporte interactivo. Ábrelo y usa "Descargar PDF".',
    };
  }

  const pdfPath = join(folder, 'creva-reporte.pdf');
  const pdfBytes = await tools.print(browser, htmlPath, pdfPath);

  if (pdfBytes <= 0) {
    return {
      ...asHtml,
      note: 'La impresión no produjo un archivo, así que se entrega el reporte interactivo en su lugar.',
    };
  }

  return {
    folder,
    htmlPath,
    htmlBytes,
    kind: 'pdf',
    path: pdfPath,
    bytes: pdfBytes,
    note: 'Resumen ejecutivo de dos páginas, impreso desde el mismo reporte interactivo.',
  };
}

function runPrint(browser: string, htmlPath: string, pdfPath: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-pdf-header-footer',
        `--print-to-pdf=${pdfPath}`,
        fileUrl(htmlPath),
      ],
      { stdio: 'ignore' },
    );

    const timer = setTimeout(() => {
      child.kill();
      resolve(0);
    }, PRINT_TIMEOUT_MS);

    const finish = (): void => {
      clearTimeout(timer);
      resolve(safeSize(pdfPath));
    };

    child.on('error', () => {
      clearTimeout(timer);
      resolve(0);
    });
    child.on('exit', finish);
  });
}

function safeExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

function safeSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}
