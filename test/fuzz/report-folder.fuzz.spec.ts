import fc from 'fast-check';
import { folderStamp, reportFolderName } from '../../src/common/output/report-folder';

// A business name is typed by the user, so anything can arrive here.
const ILLEGAL_IN_A_WINDOWS_PATH = /[<>:"/\\|?*]/;

describe('reportFolderName under arbitrary input', () => {
  it('never produces a name a filesystem would refuse', () => {
    fc.assert(
      fc.property(fc.string(), fc.date(), (name, generatedAt) => {
        const folder = reportFolderName(name, generatedAt.toISOString());

        expect(folder).not.toMatch(ILLEGAL_IN_A_WINDOWS_PATH);
        expect(folder.trim()).toBe(folder);
      }),
      { numRuns: 500 },
    );
  });

  it('always announces itself as a Creva report, however odd the name', () => {
    fc.assert(
      fc.property(fc.string(), fc.date(), (name, generatedAt) => {
        expect(reportFolderName(name, generatedAt.toISOString()).startsWith('Creva_Score_')).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('never leaves the business slug empty, so no two reports collapse into one folder name', () => {
    fc.assert(
      fc.property(fc.string(), fc.date(), (name, generatedAt) => {
        const stamp = folderStamp(generatedAt.toISOString());
        const slug = reportFolderName(name, generatedAt.toISOString()).slice(
          'Creva_Score_'.length,
          -(stamp.length + 1),
        );

        expect(slug.length).toBeGreaterThan(0);
      }),
      { numRuns: 500 },
    );
  });

  it('reports an unreadable timestamp instead of guessing one', () => {
    fc.assert(
      fc.property(
        fc.string().filter((value) => Number.isNaN(new Date(value).getTime())),
        (value) => {
          expect(folderStamp(value)).toBe('sin-fecha');
        },
      ),
      { numRuns: 200 },
    );
  });
});
