import type { ObjectiveDefinition } from '../types/game';
import { CATALOGUE_MANIFEST } from './catalogueManifest';
import type { CatalogLoadIssue } from './formatParser';
import { deepMergePlain, isPlainObject, parseRawGlobMap } from './globHelper';

function getRawModules(): Record<string, unknown> {
  try {
    return import.meta.glob(
      [
        './json/{objectives,objetives}.{json,jsonc,toml}',
        './json/{objectives,objetives}/*.{json,jsonc,toml}',
        './toml/{objectives,objetives}.{json,jsonc,toml}',
        './toml/{objectives,objetives}/*.{json,jsonc,toml}',
      ],
      { query: '?raw', import: 'default', eager: true }
    );
  } catch {
    return {};
  }
}

function mergeObjective(
  out: Record<string, ObjectiveDefinition>,
  id: string,
  def: Partial<ObjectiveDefinition>
) {
  const prev = out[id];
  const merged = prev
    ? (deepMergePlain(
        prev as unknown as Record<string, unknown>,
        def as unknown as Record<string, unknown>
      ) as unknown as Partial<ObjectiveDefinition>)
    : def;
  if (!merged.kind) return;
  out[id] = {
    ...merged,
    id,
    kind: merged.kind,
    description: merged.description ?? merged.title ?? id,
  };
}

export function ingestObjectivesCatalog(
  raw: unknown,
  out: Record<string, ObjectiveDefinition>,
  fallbackId?: string
) {
  if (!raw || typeof raw !== 'object') return;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isPlainObject(item) && typeof item.id === 'string') {
        mergeObjective(out, item.id, item as Partial<ObjectiveDefinition>);
      }
    }
    return;
  }

  const obj = raw as Record<string, unknown>;
  if (fallbackId && 'kind' in obj && typeof obj.kind === 'string') {
    const def = obj as Partial<ObjectiveDefinition>;
    mergeObjective(out, def.id || fallbackId, def);
    return;
  }

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    if (isPlainObject(val)) {
      const def = val as Partial<ObjectiveDefinition>;
      mergeObjective(out, def.id ?? key, def);
    }
  }
}

export const OBJECTIVE_LOAD_ISSUES: CatalogLoadIssue[] = [];

function parseObjectivesCatalog(): Record<string, ObjectiveDefinition> {
  const out: Record<string, ObjectiveDefinition> = {};
  const entries = parseRawGlobMap(getRawModules(), OBJECTIVE_LOAD_ISSUES);
  for (const entry of entries) {
    const isFolder = entry.path.includes('/objectives/') || entry.path.includes('/objetives/');
    ingestObjectivesCatalog(entry.data, out, isFolder ? entry.slug : undefined);
  }
  if (CATALOGUE_MANIFEST.objectives) {
    ingestObjectivesCatalog(CATALOGUE_MANIFEST.objectives, out);
  }
  return out;
}

export const OBJECTIVES_CATALOG: Record<string, ObjectiveDefinition> = parseObjectivesCatalog();
