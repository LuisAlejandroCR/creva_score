import { join } from 'node:path';
import {
  FolderTools,
  folderStamp,
  reportFolderName,
  resolveReportFolder,
  slugify,
} from '../../src/common/output/report-folder';

const DOWNLOADS = String.raw`C:\Users\x\Downloads`;
const TEMP = String.raw`C:\Temp`;

function tools(overrides: Partial<FolderTools> = {}): { tools: FolderTools; made: string[] } {
  const made: string[] = [];
  return {
    made,
    tools: {
      downloadsBase: () => DOWNLOADS,
      fallbackBase: () => TEMP,
      makeDir: (path) => {
        made.push(path);
      },
      ...overrides,
    },
  };
}

describe('reportFolderName', () => {
  it('follows Creva_Score + business + generated_at', () => {
    expect(reportFolderName('Cañonerí Panadería', '2026-08-14T21:30:05.123Z')).toBe(
      'Creva_Score_canoneri-panaderia_2026-08-14T21-30-05Z',
    );
  });

  it('drops the colons an ISO hour carries, because Windows forbids them in a path', () => {
    expect(folderStamp('2026-08-14T21:30:05.123Z')).toBe('2026-08-14T21-30-05Z');
    expect(folderStamp('2026-08-14T21:30:05.123Z')).not.toContain(':');
  });

  it('says so instead of inventing a clock when the timestamp is unreadable', () => {
    expect(folderStamp('no es una fecha')).toBe('sin-fecha');
  });

  it('names the folder after the business, without accents or spaces', () => {
    expect(slugify('Estética Magnifique Studio')).toBe('estetica-magnifique-studio');
    expect(slugify('   ')).toBe('reporte');
  });
});

describe('resolveReportFolder', () => {
  const stamp = '2026-08-14T21:30:05.000Z';

  it('lands in Downloads, which is where a person looks for a file', () => {
    const { tools: t } = tools();

    expect(resolveReportFolder('ACME', stamp, t)).toBe(
      join(DOWNLOADS, 'Creva_Score_acme_2026-08-14T21-30-05Z'),
    );
  });

  it('creates the folder rather than assuming it is there', () => {
    const { tools: t, made } = tools();
    const folder = resolveReportFolder('ACME', stamp, t);

    expect(made).toEqual([folder]);
  });

  it('falls back to the temporary folder instead of losing the report', () => {
    // A read-only or missing Downloads is a reason to write elsewhere, never to fail.
    const { tools: t } = tools({
      makeDir: (path) => {
        if (path.startsWith(DOWNLOADS)) throw new Error('EACCES');
      },
    });

    expect(resolveReportFolder('ACME', stamp, t)).toBe(join(TEMP, 'Creva_Score_acme_2026-08-14T21-30-05Z'));
  });

  it('falls back once more to the current directory when neither base takes it', () => {
    const { tools: t } = tools({
      makeDir: (path) => {
        if (path.startsWith(DOWNLOADS) || path.startsWith(TEMP)) throw new Error('EACCES');
      },
    });

    expect(resolveReportFolder('ACME', stamp, t)).toBe('Creva_Score_acme_2026-08-14T21-30-05Z');
  });

  it('gives both surfaces the same folder for the same report', () => {
    const { tools: t } = tools();

    expect(resolveReportFolder('ACME', stamp, t)).toBe(resolveReportFolder('ACME', stamp, t));
  });
});
