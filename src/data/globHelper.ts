import {
  CatalogLoadIssue,
  detectDataFormat,
  formatPriority,
  parseDataFile,
  stripDataExtension,
} from './formatParser';

export interface ParsedDataEntry {
  path: string;
  slug: string;
  data: unknown;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function deepMergePlain(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (k.startsWith('_') || v === undefined) continue;
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMergePlain(out[k] as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function unwrapRawOrModule(mod: unknown): unknown {
  if (typeof mod === 'string') return mod;
  if (typeof mod === 'object' && mod !== null && 'default' in mod) {
    return (mod as { default?: unknown }).default;
  }
  return mod;
}

export function sortDataEntriesByPriority(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const folderDiff =
      (a.includes('/toml/') ? 1 : 0) - (b.includes('/toml/') ? 1 : 0);
    if (folderDiff !== 0) return folderDiff;
    const fmtDiff = formatPriority(a) - formatPriority(b);
    if (fmtDiff !== 0) return fmtDiff;
    return a.localeCompare(b);
  });
}

export function parseRawGlobMap(
  modules: Record<string, unknown>,
  issues?: CatalogLoadIssue[]
): ParsedDataEntry[] {
  const sortedPaths = sortDataEntriesByPriority(Object.keys(modules));
  const entries: ParsedDataEntry[] = [];

  for (const path of sortedPaths) {
    const rawVal = unwrapRawOrModule(modules[path]);
    const slug = stripDataExtension(path);

    if (typeof rawVal === 'string') {
      const parsed = parseDataFile(rawVal, path);
      if (parsed.error) {
        issues?.push({
          file: path,
          format: parsed.format,
          message: parsed.error,
        });
        continue;
      }
      if (parsed.data !== null) {
        entries.push({ path, slug, data: parsed.data });
      }
    } else if (rawVal !== undefined && rawVal !== null) {
      entries.push({ path, slug, data: rawVal });
    } else {
      issues?.push({
        file: path,
        format: detectDataFormat(path),
        message: 'Archivo vacío o ilegible.',
      });
    }
  }

  return entries;
}
