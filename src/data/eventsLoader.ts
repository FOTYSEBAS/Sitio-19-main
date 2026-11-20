import type { LevelEventDefinition } from '../types/game';
import { CATALOGUE_MANIFEST } from './catalogueManifest';
import type { CatalogLoadIssue } from './formatParser';
import { deepMergePlain, isPlainObject, parseRawGlobMap } from './globHelper';

function getRawModules(): Record<string, unknown> {
  try {
    return import.meta.glob(
      [
        './json/events.{json,jsonc,toml}',
        './json/events/*.{json,jsonc,toml}',
        './toml/events.{json,jsonc,toml}',
        './toml/events/*.{json,jsonc,toml}',
      ],
      { query: '?raw', import: 'default', eager: true }
    );
  } catch {
    return {};
  }
}

function mergeEvent(
  out: Record<string, LevelEventDefinition>,
  id: string,
  def: Partial<LevelEventDefinition>
) {
  const prev = out[id];
  const merged = prev
    ? (deepMergePlain(
        prev as unknown as Record<string, unknown>,
        def as unknown as Record<string, unknown>
      ) as unknown as Partial<LevelEventDefinition>)
    : def;
  out[id] = { ...merged, id };
}

export function ingestEventsCatalog(
  raw: unknown,
  out: Record<string, LevelEventDefinition>,
  fallbackId?: string
) {
  if (!raw || typeof raw !== 'object') return;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isPlainObject(item) && typeof item.id === 'string') {
        mergeEvent(out, item.id, item as Partial<LevelEventDefinition>);
      }
    }
    return;
  }

  const obj = raw as Record<string, unknown>;
  if (fallbackId && ('trigger' in obj || 'logic' in obj || 'visual' in obj || 'name' in obj)) {
    const def = obj as Partial<LevelEventDefinition>;
    mergeEvent(out, def.id ?? fallbackId, def);
    return;
  }

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    if (isPlainObject(val)) {
      const def = val as Partial<LevelEventDefinition>;
      mergeEvent(out, def.id ?? key, def);
    }
  }
}

export const EVENT_LOAD_ISSUES: CatalogLoadIssue[] = [];

function parseEventsCatalog(): Record<string, LevelEventDefinition> {
  const out: Record<string, LevelEventDefinition> = {};
  const entries = parseRawGlobMap(getRawModules(), EVENT_LOAD_ISSUES);
  for (const entry of entries) {
    const isFolder = entry.path.includes('/events/');
    ingestEventsCatalog(entry.data, out, isFolder ? entry.slug : undefined);
  }
  if (CATALOGUE_MANIFEST.events) {
    ingestEventsCatalog(CATALOGUE_MANIFEST.events, out);
  }
  return out;
}

export const EVENTS_CATALOG: Record<string, LevelEventDefinition> = parseEventsCatalog();
