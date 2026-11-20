import { CatalogLoadIssue } from './formatParser';
import { deepMergePlain, isPlainObject, parseRawGlobMap, ParsedDataEntry } from './globHelper';

export interface CatalogueManifestData {
  config?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  designs?: Record<string, unknown>;
  almanac?: Record<string, unknown>;
  towers?: Record<string, unknown> | unknown[];
  scps?: Record<string, unknown> | unknown[];
  enemies?: Record<string, unknown> | unknown[];
  levels?: Record<string, unknown> | unknown[];
  effects?: Record<string, unknown> | unknown[];
  particles?: Record<string, unknown> | unknown[];
  objectives?: Record<string, unknown> | unknown[];
  events?: Record<string, unknown> | unknown[];
  characters?: Record<string, unknown> | unknown[];
  dialogues?: Record<string, unknown> | unknown[];
}

function tryGlob(fn: () => Record<string, unknown>): Record<string, unknown> {
  try {
    return fn();
  } catch {
    return {};
  }
}

const manifestFolderModules = tryGlob(() =>
  import.meta.glob(
    [
      './catalogue/*.{json,jsonc,toml}',
      './json/catalogue/*.{json,jsonc,toml}',
      './toml/catalogue/*.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

const manifestRootModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/catalogue.{json,jsonc,toml}',
      './toml/catalogue.{json,jsonc,toml}',
      './catalogue.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

const MANIFEST_SECTION_ALIASES: Record<string, keyof CatalogueManifestData> = {
  config: 'config',
  game: 'config',
  ui: 'ui',
  designs: 'designs',
  almanac: 'almanac',
  towers: 'towers',
  scps: 'scps',
  enemies: 'enemies',
  levels: 'levels',
  effects: 'effects',
  particles: 'particles',
  objectives: 'objectives',
  objetives: 'objectives',
  events: 'events',
  characters: 'characters',
  dialogues: 'dialogues',
};

function normalizeSectionKey(rawKey: string): keyof CatalogueManifestData | null {
  return MANIFEST_SECTION_ALIASES[rawKey] ?? null;
}

export function ingestCatalogueEntry(
  raw: unknown,
  out: CatalogueManifestData,
  fallbackSlug?: string
) {
  if (!isPlainObject(raw)) return;

  const hasKnownSection = Object.keys(raw).some((k) => normalizeSectionKey(k) !== null);
  const slugSection = fallbackSlug ? normalizeSectionKey(fallbackSlug) : null;

  if (!hasKnownSection && slugSection) {
    const existing = out[slugSection];
    if (isPlainObject(existing)) {
      out[slugSection] = deepMergePlain(existing, raw) as never;
    } else {
      out[slugSection] = raw as never;
    }
    return;
  }

  for (const [rawKey, val] of Object.entries(raw)) {
    if (rawKey.startsWith('_') || val === undefined) continue;
    const section = normalizeSectionKey(rawKey);
    if (!section) continue;

    if (isPlainObject(val)) {
      const existing = out[section];
      if (isPlainObject(existing)) {
        out[section] = deepMergePlain(existing, val) as never;
      } else {
        out[section] = val as never;
      }
    } else if (Array.isArray(val)) {
      const existing = out[section];
      if (Array.isArray(existing)) {
        out[section] = [...existing, ...val] as never;
      } else {
        out[section] = [...val] as never;
      }
    }
  }
}

export function sortManifestEntries(entries: ParsedDataEntry[]): ParsedDataEntry[] {
  const rankPath = (p: string): number => {
    // Subfolder fragments first, then ./json/catalogue.*, ./toml/catalogue.*, and ./catalogue.* highest
    if (p.includes('/catalogue/')) return 0;
    if (p.startsWith('./json/')) return 1;
    if (p.startsWith('./toml/')) return 2;
    return 3;
  };
  return [...entries].sort((a, b) => {
    const rDiff = rankPath(a.path) - rankPath(b.path);
    if (rDiff !== 0) return rDiff;
    return a.path.localeCompare(b.path);
  });
}

export const CATALOGUE_LOAD_ISSUES: CatalogLoadIssue[] = [];
export const CATALOGUE_SOURCE_FILES: string[] = [];

function loadCatalogueManifest(): CatalogueManifestData {
  const out: CatalogueManifestData = {};
  const folderEntries = parseRawGlobMap(manifestFolderModules, CATALOGUE_LOAD_ISSUES);
  const rootEntries = parseRawGlobMap(manifestRootModules, CATALOGUE_LOAD_ISSUES);
  const combined = sortManifestEntries([...folderEntries, ...rootEntries]);

  for (const entry of combined) {
    CATALOGUE_SOURCE_FILES.push(entry.path.replace(/^\.\//, 'src/data/'));
    const isFolder = entry.path.includes('/catalogue/');
    ingestCatalogueEntry(entry.data, out, isFolder ? entry.slug : undefined);
  }
  return out;
}

export const CATALOGUE_MANIFEST: CatalogueManifestData = loadCatalogueManifest();
