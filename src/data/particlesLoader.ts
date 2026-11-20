import type { ParticlePresetDefinition } from '../types/game';
import { CATALOGUE_MANIFEST } from './catalogueManifest';
import type { CatalogLoadIssue } from './formatParser';
import { deepMergePlain, isPlainObject, parseRawGlobMap } from './globHelper';

function getRawModules(): Record<string, unknown> {
  try {
    return import.meta.glob(
      [
        './json/particles.{json,jsonc,toml}',
        './json/particles/*.{json,jsonc,toml}',
        './toml/particles.{json,jsonc,toml}',
        './toml/particles/*.{json,jsonc,toml}',
      ],
      { query: '?raw', import: 'default', eager: true }
    );
  } catch {
    return {};
  }
}

function mergePreset(
  out: Record<string, ParticlePresetDefinition>,
  id: string,
  def: Partial<ParticlePresetDefinition>
) {
  const prev = out[id];
  const merged = prev
    ? (deepMergePlain(
        prev as unknown as Record<string, unknown>,
        def as unknown as Record<string, unknown>
      ) as unknown as Partial<ParticlePresetDefinition>)
    : def;
  out[id] = {
    ...merged,
    id,
    emitters: Array.isArray(merged.emitters) ? merged.emitters : [],
  };
}

export function ingestParticlesCatalog(
  raw: unknown,
  out: Record<string, ParticlePresetDefinition>,
  fallbackId?: string
) {
  if (!raw || typeof raw !== 'object') return;

  const sourceObj =
    'presets' in raw &&
    typeof (raw as { presets?: unknown }).presets === 'object' &&
    (raw as { presets?: unknown }).presets !== null
      ? (raw as { presets: unknown }).presets
      : raw;

  if (Array.isArray(sourceObj)) {
    for (const item of sourceObj) {
      if (isPlainObject(item) && typeof item.id === 'string') {
        mergePreset(out, item.id, item as Partial<ParticlePresetDefinition>);
      }
    }
    return;
  }

  const obj = sourceObj as Record<string, unknown>;
  if (fallbackId && Array.isArray(obj.emitters)) {
    const def = obj as Partial<ParticlePresetDefinition>;
    mergePreset(out, def.id ?? fallbackId, def);
    return;
  }

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    if (isPlainObject(val)) {
      const def = val as Partial<ParticlePresetDefinition>;
      mergePreset(out, def.id ?? key, def);
    }
  }
}

export const PARTICLE_LOAD_ISSUES: CatalogLoadIssue[] = [];

function parseParticlesCatalog(): Record<string, ParticlePresetDefinition> {
  const out: Record<string, ParticlePresetDefinition> = {};
  const entries = parseRawGlobMap(getRawModules(), PARTICLE_LOAD_ISSUES);
  for (const entry of entries) {
    const isFolder = entry.path.includes('/particles/');
    ingestParticlesCatalog(entry.data, out, isFolder ? entry.slug : undefined);
  }
  if (CATALOGUE_MANIFEST.particles) {
    ingestParticlesCatalog(CATALOGUE_MANIFEST.particles, out);
  }
  return out;
}

export const PARTICLES_CATALOG: Record<string, ParticlePresetDefinition> = parseParticlesCatalog();
