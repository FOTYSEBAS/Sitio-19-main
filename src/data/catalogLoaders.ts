import type {
  AlmanacAnimationPreset,
  AlmanacCatalog,
  AlmanacEntryConfig,
  DesignCatalog,
  EffectDefinition,
  EnemyDefinition,
  GameConfig,
  RawLevelConfig,
  TowerDefinition,
} from '../types/game';
import configJson from './json/config.json';
import baseDesignsJson from './json/designs.json';
import {
  CATALOGUE_LOAD_ISSUES,
  CATALOGUE_MANIFEST,
  CATALOGUE_SOURCE_FILES,
} from './catalogueManifest';
import { CHARACTER_LOAD_ISSUES, CHARACTERS_CATALOG } from './charactersLoader';
import { DIALOGUE_LOAD_ISSUES, DIALOGUES_CATALOG } from './dialoguesLoader';
import { EVENT_LOAD_ISSUES, EVENTS_CATALOG } from './eventsLoader';
import { CatalogLoadIssue } from './formatParser';
import { deepMergePlain, isPlainObject, parseRawGlobMap } from './globHelper';
import { OBJECTIVE_LOAD_ISSUES, OBJECTIVES_CATALOG } from './objectivesLoader';
import { PARTICLE_LOAD_ISSUES, PARTICLES_CATALOG } from './particlesLoader';

export {
  CATALOGUE_SOURCE_FILES,
  CHARACTERS_CATALOG,
  DIALOGUES_CATALOG,
  EVENTS_CATALOG,
  OBJECTIVES_CATALOG,
  PARTICLES_CATALOG,
};

const CORE_LOAD_ISSUES: CatalogLoadIssue[] = [];

function tryGlob(fn: () => Record<string, unknown>): Record<string, unknown> {
  try {
    return fn();
  } catch {
    return {};
  }
}

// --- Config (config.json + optional config.jsonc / config.toml / toml/config.* + catalogue.*) ---
const configOverrideModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/config.{json,jsonc,toml}',
      './toml/config.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

function loadGameConfig(): GameConfig {
  let merged: Record<string, unknown> = { ...(configJson as Record<string, unknown>) };
  for (const entry of parseRawGlobMap(configOverrideModules, CORE_LOAD_ISSUES)) {
    if (isPlainObject(entry.data)) {
      merged = deepMergePlain(merged, entry.data);
    }
  }
  if (isPlainObject(CATALOGUE_MANIFEST.config)) {
    merged = deepMergePlain(merged, CATALOGUE_MANIFEST.config);
  }
  if (isPlainObject(CATALOGUE_MANIFEST.ui)) {
    merged = deepMergePlain(merged, { ui: CATALOGUE_MANIFEST.ui });
  }
  return merged as unknown as GameConfig;
}

export const GAME_CONFIG: GameConfig = loadGameConfig();
export const GRID_ROWS = GAME_CONFIG.grid.rows;
export const GRID_COLS = GAME_CONFIG.grid.cols;
export const SECTOR_BACKDROP_IMAGE = GAME_CONFIG.app.sectorBackdropImage;

// --- Designs (designs.json + designs.toml + designs/*.{json,jsonc,toml} + toml/designs/* + catalogue.*) ---
const rootDesignModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/designs.{json,jsonc,toml}',
      './toml/designs.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

const designFolderModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/designs/*.{json,jsonc,toml}',
      './toml/designs/*.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

const KNOWN_DESIGN_SECTIONS = new Set([
  'board',
  'zones',
  'gates',
  'doors079',
  'statuses',
  'badges',
  'customShapes',
  'defaultTower',
  'defaultEnemy',
  'defaultProjectile',
  'towers',
  'enemies',
  'projectiles',
  'obstacles',
  'tileModifiers',
  'effects',
  'fonts',
  'ui',
  'hudTheme',
  'almanac',
  'animations',
]);

function loadDesignCatalog(): DesignCatalog {
  let merged: Record<string, unknown> = { ...(baseDesignsJson as Record<string, unknown>) };

  for (const entry of parseRawGlobMap(rootDesignModules, CORE_LOAD_ISSUES)) {
    if (isPlainObject(entry.data)) {
      merged = deepMergePlain(merged, entry.data);
    }
  }

  for (const entry of parseRawGlobMap(designFolderModules, CORE_LOAD_ISSUES)) {
    if (!isPlainObject(entry.data)) continue;
    const hasTopLevelKey = Object.keys(entry.data).some((k) => KNOWN_DESIGN_SECTIONS.has(k));
    if (!hasTopLevelKey && KNOWN_DESIGN_SECTIONS.has(entry.slug)) {
      merged = deepMergePlain(merged, { [entry.slug]: entry.data });
    } else {
      merged = deepMergePlain(merged, entry.data);
    }
  }

  if (isPlainObject(CATALOGUE_MANIFEST.designs)) {
    merged = deepMergePlain(merged, CATALOGUE_MANIFEST.designs);
  }

  return merged as unknown as DesignCatalog;
}

export const DESIGN_CATALOG: DesignCatalog = loadDesignCatalog();

// --- Almanac (designs.almanac + almanac.{json,jsonc,toml} + almanac/*.{json,jsonc,toml} + toml/almanac/* + catalogue.*) ---
const rootAlmanacModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/almanac.{json,jsonc,toml}',
      './toml/almanac.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

const folderAlmanacModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/almanac/*.{json,jsonc,toml}',
      './toml/almanac/*.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

export function ingestAlmanacData(
  raw: unknown,
  out: {
    towers: Record<string, AlmanacEntryConfig>;
    enemies: Record<string, AlmanacEntryConfig>;
    animations?: Record<string, AlmanacAnimationPreset>;
  },
  fallbackId?: string
) {
  if (!isPlainObject(raw)) return;

  const mergeEntry = (
    bucket: Record<string, AlmanacEntryConfig>,
    key: string,
    val: AlmanacEntryConfig
  ) => {
    const existing = bucket[key];
    bucket[key] = existing
      ? (deepMergePlain(
          existing as unknown as Record<string, unknown>,
          val as unknown as Record<string, unknown>
        ) as unknown as AlmanacEntryConfig)
      : val;
  };

  if (isPlainObject(raw.animations)) {
    if (!out.animations) out.animations = {};
    for (const [k, v] of Object.entries(raw.animations)) {
      if (!k.startsWith('_') && isPlainObject(v)) {
        const prev = out.animations[k];
        out.animations[k] = prev
          ? (deepMergePlain(
              prev as unknown as Record<string, unknown>,
              v
            ) as unknown as AlmanacAnimationPreset)
          : (v as unknown as AlmanacAnimationPreset);
      }
    }
  }

  if (isPlainObject(raw.towers)) {
    for (const [k, v] of Object.entries(raw.towers)) {
      if (!k.startsWith('_') && isPlainObject(v)) {
        mergeEntry(out.towers, k, v as unknown as AlmanacEntryConfig);
      }
    }
  }
  if (isPlainObject(raw.enemies)) {
    for (const [k, v] of Object.entries(raw.enemies)) {
      if (!k.startsWith('_') && isPlainObject(v)) {
        mergeEntry(out.enemies, k, v as unknown as AlmanacEntryConfig);
      }
    }
  }
  if (isPlainObject(raw.scps)) {
    for (const [k, v] of Object.entries(raw.scps)) {
      if (!k.startsWith('_') && isPlainObject(v)) {
        mergeEntry(out.enemies, k, v as unknown as AlmanacEntryConfig);
      }
    }
  }

  if (
    fallbackId &&
    !('towers' in raw) &&
    !('enemies' in raw) &&
    !('scps' in raw) &&
    !('animations' in raw) &&
    ('description' in raw ||
      'stats' in raw ||
      'animation' in raw ||
      'designId' in raw ||
      'lore' in raw ||
      'tacticalNote' in raw ||
      'title' in raw ||
      'customFields' in raw)
  ) {
    const entry = raw as unknown as AlmanacEntryConfig;
    const id = entry.targetType || entry.id || fallbackId;
    const kind =
      entry.targetKind ??
      (id.startsWith('scp_') || id.startsWith('enemy_') ? 'enemy' : 'tower');
    mergeEntry(kind === 'enemy' ? out.enemies : out.towers, id, entry);
  }
}

function loadAlmanacCatalog(): {
  towers: Record<string, AlmanacEntryConfig>;
  enemies: Record<string, AlmanacEntryConfig>;
  animations: Record<string, AlmanacAnimationPreset>;
} {
  const out: {
    towers: Record<string, AlmanacEntryConfig>;
    enemies: Record<string, AlmanacEntryConfig>;
    animations: Record<string, AlmanacAnimationPreset>;
  } = {
    towers: {},
    enemies: {},
    animations: {},
  };

  if (DESIGN_CATALOG.almanac) {
    ingestAlmanacData(DESIGN_CATALOG.almanac as AlmanacCatalog, out);
  }
  for (const entry of parseRawGlobMap(rootAlmanacModules, CORE_LOAD_ISSUES)) {
    ingestAlmanacData(entry.data, out);
  }
  for (const entry of parseRawGlobMap(folderAlmanacModules, CORE_LOAD_ISSUES)) {
    ingestAlmanacData(entry.data, out, entry.slug);
  }
  if (isPlainObject(CATALOGUE_MANIFEST.almanac)) {
    ingestAlmanacData(CATALOGUE_MANIFEST.almanac, out);
  }

  return out;
}

export const ALMANAC_CATALOG = loadAlmanacCatalog();

// --- Effects (effects.{json,jsonc,toml} + effects/*.{json,jsonc,toml} + catalogue.*) ---
const legacyEffectsModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/effects.{json,jsonc,toml}',
      './toml/effects.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);
const folderEffectsModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/effects/*.{json,jsonc,toml}',
      './toml/effects/*.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

function loadEffectsCatalog(): Record<string, EffectDefinition> {
  const out: Record<string, EffectDefinition> = {};
  const setMerged = (id: string, incoming: EffectDefinition) => {
    const prev = out[id];
    const merged = prev
      ? (deepMergePlain(
          prev as unknown as Record<string, unknown>,
          incoming as unknown as Record<string, unknown>
        ) as unknown as EffectDefinition)
      : incoming;
    out[id] = { ...merged, id };
  };

  const ingest = (raw: unknown, fallbackId?: string) => {
    if (!raw || typeof raw !== 'object') return;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (isPlainObject(item) && typeof item.id === 'string') {
          setMerged(item.id, item as unknown as EffectDefinition);
        }
      }
      return;
    }
    const obj = raw as Record<string, unknown>;
    if (fallbackId && ('kind' in obj || 'trigger' in obj || 'modifiers' in obj || 'name' in obj)) {
      const fx = obj as unknown as EffectDefinition;
      const id = fx.id || fallbackId;
      setMerged(id, fx);
      return;
    }
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('_') || !isPlainObject(val)) continue;
      const fx = val as unknown as EffectDefinition;
      const id = fx.id || key;
      setMerged(id, fx);
    }
  };
  for (const entry of parseRawGlobMap(legacyEffectsModules, CORE_LOAD_ISSUES)) {
    ingest(entry.data);
  }
  for (const entry of parseRawGlobMap(folderEffectsModules, CORE_LOAD_ISSUES)) {
    ingest(entry.data, entry.slug);
  }
  if (CATALOGUE_MANIFEST.effects) {
    ingest(CATALOGUE_MANIFEST.effects);
  }
  return out;
}

export const EFFECTS_CATALOG: Record<string, EffectDefinition> = loadEffectsCatalog();

// --- Towers (towers.{json,jsonc,toml} + towers/*.{json,jsonc,toml} + catalogue.*) ---
const legacyTowerModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/towers.{json,jsonc,toml}',
      './toml/towers.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);
const folderTowerModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/towers/*.{json,jsonc,toml}',
      './toml/towers/*.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

function loadTowerCatalog(): TowerDefinition[] {
  const map = new Map<string, TowerDefinition>();
  const setMerged = (type: string, incoming: TowerDefinition) => {
    const prev = map.get(type);
    const merged = prev
      ? (deepMergePlain(
          prev as unknown as Record<string, unknown>,
          incoming as unknown as Record<string, unknown>
        ) as unknown as TowerDefinition)
      : incoming;
    map.set(type, { ...merged, type, unlockLevel: merged.unlockLevel ?? 0 });
  };

  const ingest = (raw: unknown, fallbackType?: string) => {
    if (!raw || typeof raw !== 'object') return;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (isPlainObject(item) && typeof item.type === 'string') {
          setMerged(item.type, item as unknown as TowerDefinition);
        }
      }
      return;
    }
    const obj = raw as Record<string, unknown>;
    if (
      fallbackType &&
      ('name' in obj || 'category' in obj || 'cost' in obj || 'almanac' in obj)
    ) {
      const def = obj as unknown as TowerDefinition;
      const type = def.type || fallbackType;
      setMerged(type, def);
      return;
    }
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('_') || !isPlainObject(val)) continue;
      const def = val as unknown as TowerDefinition;
      const type = def.type || key;
      setMerged(type, def);
    }
  };

  for (const entry of parseRawGlobMap(legacyTowerModules, CORE_LOAD_ISSUES)) {
    ingest(entry.data);
  }
  for (const entry of parseRawGlobMap(folderTowerModules, CORE_LOAD_ISSUES)) {
    ingest(entry.data, entry.slug);
  }
  if (CATALOGUE_MANIFEST.towers) {
    ingest(CATALOGUE_MANIFEST.towers);
  }

  const list = Array.from(map.values());
  const order = GAME_CONFIG.towerOrder;
  if (order && order.length > 0) {
    const orderIdx = new Map(order.map((t, i) => [t, i]));
    list.sort((a, b) => {
      const ia = orderIdx.get(a.type) ?? Number.MAX_SAFE_INTEGER;
      const ib = orderIdx.get(b.type) ?? Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      return (a.unlockLevel ?? 0) - (b.unlockLevel ?? 0) || a.cost - b.cost;
    });
  } else {
    list.sort((a, b) => (a.unlockLevel ?? 0) - (b.unlockLevel ?? 0) || a.cost - b.cost);
  }
  return list;
}

export const TOWER_CATALOG: TowerDefinition[] = loadTowerCatalog();

// --- SCPs (scps.{json,jsonc,toml} + scps/*.{json,jsonc,toml} + catalogue.*) ---
const legacyScpModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/scps.{json,jsonc,toml}',
      './toml/scps.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);
const folderScpModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/scps/*.{json,jsonc,toml}',
      './toml/scps/*.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

function loadEnemyCatalog(): EnemyDefinition[] {
  const map = new Map<string, EnemyDefinition>();
  const setMerged = (type: string, incoming: EnemyDefinition) => {
    const prev = map.get(type);
    const merged = prev
      ? (deepMergePlain(
          prev as unknown as Record<string, unknown>,
          incoming as unknown as Record<string, unknown>
        ) as unknown as EnemyDefinition)
      : incoming;
    map.set(type, { ...merged, type });
  };

  const ingest = (raw: unknown, fallbackType?: string) => {
    if (!raw || typeof raw !== 'object') return;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (isPlainObject(item) && typeof item.type === 'string') {
          setMerged(item.type, item as unknown as EnemyDefinition);
        }
      }
      return;
    }
    const obj = raw as Record<string, unknown>;
    if (
      fallbackType &&
      ('name' in obj || 'code' in obj || 'hp' in obj || 'almanac' in obj)
    ) {
      const def = obj as unknown as EnemyDefinition;
      const type = def.type || fallbackType;
      setMerged(type, def);
      return;
    }
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('_') || !isPlainObject(val)) continue;
      const def = val as unknown as EnemyDefinition;
      const type = def.type || key;
      setMerged(type, def);
    }
  };

  for (const entry of parseRawGlobMap(legacyScpModules, CORE_LOAD_ISSUES)) {
    ingest(entry.data);
  }
  for (const entry of parseRawGlobMap(folderScpModules, CORE_LOAD_ISSUES)) {
    ingest(entry.data, entry.slug);
  }
  if (CATALOGUE_MANIFEST.enemies) {
    ingest(CATALOGUE_MANIFEST.enemies);
  }
  if (CATALOGUE_MANIFEST.scps) {
    ingest(CATALOGUE_MANIFEST.scps);
  }

  const list = Array.from(map.values());
  const order = GAME_CONFIG.scpOrder;
  if (order && order.length > 0) {
    const orderIdx = new Map(order.map((t, i) => [t, i]));
    list.sort((a, b) => {
      const ia = orderIdx.get(a.type) ?? Number.MAX_SAFE_INTEGER;
      const ib = orderIdx.get(b.type) ?? Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      return (a.code ?? a.type).localeCompare(b.code ?? b.type);
    });
  }
  return list;
}

export const ENEMY_CATALOG: EnemyDefinition[] = loadEnemyCatalog();

// --- Levels (levels.{json,jsonc,toml} + levels/<N>.{json,jsonc,toml} + catalogue.*) ---
const legacyLevelModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/levels.{json,jsonc,toml}',
      './toml/levels.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);
const folderLevelModules = tryGlob(() =>
  import.meta.glob(
    [
      './json/levels/*.{json,jsonc,toml}',
      './toml/levels/*.{json,jsonc,toml}',
    ],
    { query: '?raw', import: 'default', eager: true }
  )
);

export function ingestLevelsData(
  raw: unknown,
  byNumber: Map<number, RawLevelConfig>,
  fallbackNum?: number
) {
  const setMerged = (lvlNum: number, incoming: RawLevelConfig) => {
    const prev = byNumber.get(lvlNum);
    const merged = prev
      ? (deepMergePlain(
          prev as unknown as Record<string, unknown>,
          incoming as unknown as Record<string, unknown>
        ) as unknown as RawLevelConfig)
      : incoming;
    byNumber.set(lvlNum, { ...merged, level: lvlNum });
  };

  if (!raw || typeof raw !== 'object') return;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isPlainObject(item) && typeof item.level === 'number') {
        setMerged(item.level, item as unknown as RawLevelConfig);
      }
    }
    return;
  }

  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.levels)) {
    ingestLevelsData(obj.levels, byNumber);
    return;
  }

  const lvlObj = raw as RawLevelConfig;
  const lvlNum = typeof lvlObj.level === 'number' ? lvlObj.level : fallbackNum;
  if (lvlNum !== undefined && Number.isFinite(lvlNum)) {
    setMerged(lvlNum, lvlObj);
    return;
  }

  // Dictionary map of levels: { "1": { ... }, "2": { ... } } (e.g. [levels.1] in catalogue.toml)
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('_') || !isPlainObject(val)) continue;
    const rawNum = Number(key.replace(/^level_?/i, ''));
    const entryLevel = typeof val.level === 'number' ? val.level : rawNum;
    if (Number.isFinite(entryLevel) && entryLevel > 0) {
      setMerged(entryLevel, val as unknown as RawLevelConfig);
    }
  }
}

function loadRawLevels(): RawLevelConfig[] {
  const byNumber = new Map<number, RawLevelConfig>();

  for (const entry of parseRawGlobMap(legacyLevelModules, CORE_LOAD_ISSUES)) {
    ingestLevelsData(entry.data, byNumber);
  }
  for (const entry of parseRawGlobMap(folderLevelModules, CORE_LOAD_ISSUES)) {
    const parsed = Number(entry.slug);
    const fallbackNum = Number.isFinite(parsed) && entry.slug !== '' ? parsed : undefined;
    ingestLevelsData(entry.data, byNumber, fallbackNum);
  }
  if (CATALOGUE_MANIFEST.levels) {
    ingestLevelsData(CATALOGUE_MANIFEST.levels, byNumber);
  }

  const configuredOrder = GAME_CONFIG.levelOrder;
  if (configuredOrder && configuredOrder.length > 0) {
    const ordered: RawLevelConfig[] = [];
    const used = new Set<number>();
    for (const num of configuredOrder) {
      const found = byNumber.get(num);
      if (found && !used.has(num)) {
        ordered.push(found);
        used.add(num);
      }
    }
    const rest = Array.from(byNumber.entries())
      .filter(([num]) => !used.has(num))
      .sort(([a], [b]) => a - b)
      .map(([, cfg]) => cfg);
    return [...ordered, ...rest];
  }

  return Array.from(byNumber.entries())
    .sort(([a], [b]) => a - b)
    .map(([, cfg]) => cfg);
}

export const RAW_LEVEL_CATALOG: RawLevelConfig[] = loadRawLevels();

export const CATALOG_DIAGNOSTICS: CatalogLoadIssue[] = [
  ...CATALOGUE_LOAD_ISSUES,
  ...CORE_LOAD_ISSUES,
  ...CHARACTER_LOAD_ISSUES,
  ...DIALOGUE_LOAD_ISSUES,
  ...EVENT_LOAD_ISSUES,
  ...OBJECTIVE_LOAD_ISSUES,
  ...PARTICLE_LOAD_ISSUES,
];

