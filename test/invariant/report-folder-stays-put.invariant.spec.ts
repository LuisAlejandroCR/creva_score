import fc from 'fast-check';
import { dirname, join } from 'node:path';
import { FolderTools, resolveReportFolder } from '../../src/common/output/report-folder';

const DOWNLOADS = join('C:', 'Users', 'x', 'Downloads');

function tools(): FolderTools {
  return {
    downloadsBase: () => DOWNLOADS,
    fallbackBase: () => join('C:', 'Temp'),
    makeDir: () => undefined,
  };
}

describe('a report folder is always a direct child of the chosen base', () => {
  it('cannot be walked out of by naming a business', () => {
    fc.assert(
      fc.property(fc.string(), fc.date(), (businessName, generatedAt) => {
        const folder = resolveReportFolder(businessName, generatedAt.toISOString(), tools());

        expect(dirname(folder)).toBe(DOWNLOADS);
      }),
      { numRuns: 500 },
    );
  });

  it('keeps that promise against names built to escape', () => {
    // A deterministic control, so the property above cannot pass toothless.
    const attacks = [
      '../../etc',
      '..\\..\\Windows\\System32',
      'C:\\Windows',
      '/etc/passwd',
      '....//....//',
      'a/../../b',
    ];

    for (const attack of attacks) {
      expect(dirname(resolveReportFolder(attack, '2026-08-14T21:30:05Z', tools()))).toBe(DOWNLOADS);
    }
  });
});
