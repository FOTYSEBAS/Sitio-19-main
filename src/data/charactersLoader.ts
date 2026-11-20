import type { CharacterDefinition } from '../types/game';
import { CATALOGUE_MANIFEST } from './catalogueManifest';
import type { CatalogLoadIssue } from './formatParser';
import { deepMergePlain, isPlainObject, parseRawGlobMap } from './globHelper';

function getRawModules(): Record<string, unknown> {
  try {
    return import.meta.glob(
      [
        './json/characters.{json,jsonc,toml}',
        './json/characters/*.{json,jsonc,toml}',
        './toml/characters.{json,jsonc,toml}',
        './toml/characters/*.{json,jsonc,toml}',
      ],
      { query: '?raw', import: 'default', eager: true }
    );
  } catch {
    return {};
  }
}

function mergeCharacter(
  out: Record<string, CharacterDefinition>,
  id: string,
  charDef: Partial<CharacterDefinition>
) {
  const prev = out[id];
  const merged = prev
    ? (deepMergePlain(
        prev as unknown as Record<string, unknown>,
        charDef as unknown as Record<string, unknown>
      ) as unknown as Partial<CharacterDefinition>)
    : charDef;
  out[id] = { ...(merged as CharacterDefinition), id };
}

export function ingestCharactersCatalog(
  raw: unknown,
  out: Record<string, CharacterDefinition>,
  fallbackId?: string
) {
  if (!raw || typeof raw !== 'object') return;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isPlainObject(item) && typeof item.id === 'string' && item.id) {
        mergeCharacter(out, item.id, item as Partial<CharacterDefinition>);
      }
    }
    return;
  }

  const obj = raw as Record<string, unknown>;
  if (
    fallbackId &&
    ('name' in obj || 'expressions' in obj || 'defaultPortrait' in obj || 'title' in obj)
  ) {
    const charDef = obj as Partial<CharacterDefinition>;
    mergeCharacter(out, charDef.id || fallbackId, charDef);
    return;
  }

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    if (isPlainObject(val)) {
      const charDef = val as Partial<CharacterDefinition>;
      mergeCharacter(out, charDef.id || key, charDef);
    }
  }
}

export const CHARACTER_LOAD_ISSUES: CatalogLoadIssue[] = [];

function parseCharactersCatalog(): Record<string, CharacterDefinition> {
  const out: Record<string, CharacterDefinition> = {};
  const entries = parseRawGlobMap(getRawModules(), CHARACTER_LOAD_ISSUES);
  for (const entry of entries) {
    const isFolder =
      entry.path.includes('/characters/') && !entry.path.endsWith('/characters.json');
    ingestCharactersCatalog(entry.data, out, isFolder ? entry.slug : undefined);
  }
  if (CATALOGUE_MANIFEST.characters) {
    ingestCharactersCatalog(CATALOGUE_MANIFEST.characters, out);
  }
  return out;
}

export const CHARACTERS_CATALOG: Record<string, CharacterDefinition> = parseCharactersCatalog();
