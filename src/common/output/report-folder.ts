// report-folder: where a generated report lands, shared by every surface that hands one over.

import { existsSync, mkdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export interface FolderTools {
  downloadsBase: () => string;
  fallbackBase: () => string;
  makeDir: (path: string) => void;
}

// Windows keeps the folder as "Downloads" and only localizes its label; desktop Linux renames it.
const DOWNLOADS = 'Downloads';
const DOWNLOADS_ES = 'Descargas';

export const realFolderTools: FolderTools = {
  downloadsBase: () => findDownloads(homedir()),
  fallbackBase: () => tmpdir(),
  makeDir: (path) => mkdirSync(path, { recursive: true }),
};

export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug === '' ? 'reporte' : slug;
}

export function folderStamp(generatedAt: string): string {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return 'sin-fecha';

  // Windows forbids ":" in a path, and the trailing Z keeps the hour from reading as local time.
  return `${date.toISOString().slice(0, 19).replace(/:/g, '-')}Z`;
}

export function reportFolderName(businessName: string, generatedAt: string): string {
  return `Creva_Score_${slugify(businessName)}_${folderStamp(generatedAt)}`;
}

export function resolveReportFolder(
  businessName: string,
  generatedAt: string,
  tools: FolderTools = realFolderTools,
): string {
  const name = reportFolderName(businessName, generatedAt);
  const bases: Array<() => string> = [tools.downloadsBase, tools.fallbackBase, () => '.'];

  for (const base of bases) {
    try {
      const folder = join(base(), name);
      tools.makeDir(folder);
      return folder;
    } catch {
      // A missing or read-only destination is not a reason to lose the report.
    }
  }
  return name;
}

function findDownloads(home: string): string {
  for (const candidate of [join(home, DOWNLOADS), join(home, DOWNLOADS_ES)]) {
    if (existsSync(candidate)) return candidate;
  }
  return join(home, DOWNLOADS);
}
