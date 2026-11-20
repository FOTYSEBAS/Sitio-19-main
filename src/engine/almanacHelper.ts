import { stringifyToJson, stringifyToToml } from '../data/formatParser';
import {
  AlmanacAnimationConfig,
  AlmanacAnimationPreset,
  AlmanacAnimationState,
  AlmanacCatalog,
  AlmanacCustomField,
  AlmanacEntryConfig,
  AlmanacStatItem,
  CustomShapeLayer,
  DesignCatalog,
  EnemyDefinition,
  EnemyDesignConfig,
  TowerDefinition,
  TowerDesignConfig,
} from '../types/game';

export type AlmanacEntityKind = 'tower' | 'enemy';

export interface AlmanacDesignOption {
  id: string;
  key: string;
  sourceKind: 'enemy' | 'tower' | 'customShape';
  label: string;
  groupLabel: string;
  shapeName: string;
}

export interface ResolvedAlmanacStat {
  id: string;
  label: string;
  value: string | number;
  numericValue?: number;
  maxValue?: number;
  unit?: string;
  color: string;
  icon?: string;
  order?: number;
  bar: boolean;
  percent: number;
  isCustom?: boolean;
}

export interface ResolvedAlmanacAnimation {
  preset?: string;
  defaultState: AlmanacAnimationState;
  availableStates: AlmanacAnimationState[];
  autoPlay: boolean;
  speed: number;
  bobSpeed?: number;
  bobAmount?: number;
  breatheAmp: number;
  breatheSpeed: number;
  pulseSpeed: number;
  recoilIntervalSec: number;
  recoilStrength: number;
  floatAmp: number;
  swayAmp: number;
  swaySpeed: number;
  tiltAmpDeg: number;
  tiltSpeed: number;
  squashAmp: number;
  squashSpeed: number;
  spinDegPerSec: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  pedestalColor: string;
  pedestalStrokeColor?: string;
  pedestalRadiusX: number;
  pedestalRadiusY: number;
  showPedestal: boolean;
  backdropColor: string;
  showGrid: boolean;
  gridColor?: string;
  gridStep: number;
  glowColor?: string;
  orbitCount: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitColor?: string;
  particlePresetId?: string;
  cardTransition: 'none' | 'fade' | 'slide' | 'scan' | 'pulse';
  states: NonNullable<AlmanacAnimationConfig['states']>;
}

export interface ResolvedAlmanacEntry {
  kind: AlmanacEntityKind;
  type: string;
  code: string;
  title: string;
  subtitle: string;
  classification: string;
  badgeText?: string;
  accentColor: string;
  clearanceLevel?: string;
  threatRating?: string;
  description: string;
  lore?: string;
  containmentProcedures?: string;
  tacticalNote: string;
  quote?: string;
  author?: string;
  tags: string[];
  visualMode: 'design' | 'portrait' | 'both';
  selectedDesignId: string;
  portrait?: string;
  portraitFit: 'cover' | 'contain';
  portraitBg?: string;
  cardBg?: string;
  cardBorderColor?: string;
  customFields: AlmanacCustomField[];
  stats: ResolvedAlmanacStat[];
  animation: ResolvedAlmanacAnimation;
  rawEntry: AlmanacEntryConfig;
}

export const ALL_ALMANAC_ANIMATION_STATES: Array<{
  state: AlmanacAnimationState;
  label: string;
}> = [
  { state: 'idle', label: 'Reposo' },
  { state: 'walk', label: 'Avance' },
  { state: 'attack', label: 'Ataque' },
  { state: 'ability', label: 'Habilidad' },
  { state: 'enraged', label: 'Furia' },
  { state: 'damaged', label: 'Dañado' },
  { state: 'slowed', label: 'Ralentizado' },
  { state: 'burning', label: 'Quemadura' },
  { state: 'stunned', label: 'Aturdido' },
  { state: 'disabled', label: 'Suprimido' },
];

export const DEFAULT_TOWER_ANIMATION_STATES: AlmanacAnimationState[] = [
  'idle',
  'attack',
  'ability',
  'damaged',
  'disabled',
];

export const DEFAULT_ENEMY_ANIMATION_STATES: AlmanacAnimationState[] = [
  'idle',
  'walk',
  'attack',
  'enraged',
  'damaged',
  'slowed',
  'burning',
  'stunned',
];

export function listAvailableDesigns(designCatalog: DesignCatalog): AlmanacDesignOption[] {
  const options: AlmanacDesignOption[] = [];

  for (const [key, cfg] of Object.entries(designCatalog.enemies ?? {})) {
    const labelName = cfg.codeLabel ? `${key} (${cfg.codeLabel})` : key;
    options.push({
      id: `enemies:${key}`,
      key,
      sourceKind: 'enemy',
      label: `SCP · ${labelName}`,
      groupLabel: 'Diseños SCP',
      shapeName: cfg.shape ?? key,
    });
  }

  for (const [key, cfg] of Object.entries(designCatalog.towers ?? {})) {
    options.push({
      id: `towers:${key}`,
      key,
      sourceKind: 'tower',
      label: `Torre · ${key}`,
      groupLabel: 'Diseños de Torres',
      shapeName: cfg.shape ?? key,
    });
  }

  for (const [key] of Object.entries(designCatalog.customShapes ?? {})) {
    options.push({
      id: `customShapes:${key}`,
      key,
      sourceKind: 'customShape',
      label: `Forma Custom · ${key}`,
      groupLabel: 'Formas Personalizadas (customShapes)',
      shapeName: key,
    });
  }

  return options;
}

function getCustomLayers(
  designCatalog: DesignCatalog,
  shapeName: string
): CustomShapeLayer[] | undefined {
  const entry = designCatalog.customShapes?.[shapeName];
  if (!entry) return undefined;
  return Array.isArray(entry) ? entry : entry.layers;
}

export function getDefaultDesignIdForEntity(
  kind: AlmanacEntityKind,
  entityType: string,
  designCatalog: DesignCatalog
): string {
  if (kind === 'enemy') {
    if (designCatalog.enemies?.[entityType]) return `enemies:${entityType}`;
    if (designCatalog.customShapes?.[entityType]) return `customShapes:${entityType}`;
    return `enemies:${entityType}`;
  }
  if (designCatalog.towers?.[entityType]) return `towers:${entityType}`;
  if (designCatalog.customShapes?.[entityType]) return `customShapes:${entityType}`;
  return `towers:${entityType}`;
}

export function resolveSelectedDesignConfig(
  targetKind: AlmanacEntityKind,
  entityType: string,
  designCatalog: DesignCatalog,
  opts?: {
    designId?: string;
    entityInlineDesign?: Partial<TowerDesignConfig> | Partial<EnemyDesignConfig>;
    designOverride?: Partial<TowerDesignConfig> | Partial<EnemyDesignConfig>;
    defaultCodeLabel?: string;
  }
): {
  renderAs: AlmanacEntityKind;
  towerDesign: TowerDesignConfig;
  enemyDesign: EnemyDesignConfig;
  resolvedDesignId: string;
} {
  const fallbackTower: TowerDesignConfig = {
    shape: 'guard',
    body: '#334155',
    stroke: '#0F172A',
    strokeWidth: 2,
    headOrTop: '#1E293B',
    accent: '#38BDF8',
    weaponOrDetail: '#94A3B8',
    ...(designCatalog.defaultTower ?? {}),
  };

  const autoLabel =
    opts?.defaultCodeLabel ||
    entityType.replace(/^scp_/i, '').toUpperCase().slice(0, 6) ||
    'SCP';

  const fallbackEnemy: EnemyDesignConfig = {
    shape: 'zombie',
    body: '#4D7C0F',
    stroke: '#1A2E05',
    strokeWidth: 2,
    head: '#65A30D',
    accent: '#EF4444',
    hpBar: '#EF4444',
    barWidth: 38,
    codeLabel: autoLabel,
    ...(designCatalog.defaultEnemy ?? {}),
  };

  const rawDesignId = opts?.designId?.trim();
  let sourceKind: 'enemy' | 'tower' | 'customShape' = targetKind;
  let lookupKey = entityType;

  if (rawDesignId) {
    if (rawDesignId.startsWith('enemies:') || rawDesignId.startsWith('enemies.')) {
      sourceKind = 'enemy';
      lookupKey = rawDesignId.slice(8);
    } else if (rawDesignId.startsWith('towers:') || rawDesignId.startsWith('towers.')) {
      sourceKind = 'tower';
      lookupKey = rawDesignId.slice(7);
    } else if (
      rawDesignId.startsWith('customShapes:') ||
      rawDesignId.startsWith('customShapes.')
    ) {
      sourceKind = 'customShape';
      lookupKey = rawDesignId.slice(13);
    } else if (targetKind === 'enemy' && designCatalog.enemies?.[rawDesignId]) {
      sourceKind = 'enemy';
      lookupKey = rawDesignId;
    } else if (targetKind === 'tower' && designCatalog.towers?.[rawDesignId]) {
      sourceKind = 'tower';
      lookupKey = rawDesignId;
    } else if (designCatalog.enemies?.[rawDesignId]) {
      sourceKind = 'enemy';
      lookupKey = rawDesignId;
    } else if (designCatalog.towers?.[rawDesignId]) {
      sourceKind = 'tower';
      lookupKey = rawDesignId;
    } else if (designCatalog.customShapes?.[rawDesignId]) {
      sourceKind = 'customShape';
      lookupKey = rawDesignId;
    } else {
      lookupKey = rawDesignId;
    }
  } else {
    if (targetKind === 'enemy' && !designCatalog.enemies?.[entityType] && designCatalog.customShapes?.[entityType]) {
      sourceKind = 'customShape';
    } else if (targetKind === 'tower' && !designCatalog.towers?.[entityType] && designCatalog.customShapes?.[entityType]) {
      sourceKind = 'customShape';
    }
  }

  let renderAs: AlmanacEntityKind = targetKind;
  let baseTower = { ...fallbackTower, ...(designCatalog.towers?.[entityType] ?? {}) };
  let baseEnemy = { ...fallbackEnemy, ...(designCatalog.enemies?.[entityType] ?? {}) };

  if (sourceKind === 'enemy') {
    renderAs = 'enemy';
    const picked = designCatalog.enemies?.[lookupKey];
    baseEnemy = {
      ...fallbackEnemy,
      ...(picked ?? { shape: lookupKey }),
    };
  } else if (sourceKind === 'tower') {
    renderAs = 'tower';
    const picked = designCatalog.towers?.[lookupKey];
    baseTower = {
      ...fallbackTower,
      ...(picked ?? { shape: lookupKey }),
    };
  } else {
    renderAs = targetKind;
    const layers = getCustomLayers(designCatalog, lookupKey);
    if (targetKind === 'enemy') {
      baseEnemy = {
        ...baseEnemy,
        shape: lookupKey,
        layers: layers ?? baseEnemy.layers,
      };
    } else {
      baseTower = {
        ...baseTower,
        shape: lookupKey,
        layers: layers ?? baseTower.layers,
      };
    }
  }

  const shouldMergeEntityInline =
    !rawDesignId || rawDesignId === getDefaultDesignIdForEntity(targetKind, entityType, designCatalog);

  const mergedTower: TowerDesignConfig = {
    ...baseTower,
    ...(shouldMergeEntityInline ? (opts?.entityInlineDesign as Partial<TowerDesignConfig>) : {}),
    ...(opts?.designOverride as Partial<TowerDesignConfig>),
  };

  const mergedEnemy: EnemyDesignConfig = {
    ...baseEnemy,
    ...(shouldMergeEntityInline ? (opts?.entityInlineDesign as Partial<EnemyDesignConfig>) : {}),
    ...(opts?.designOverride as Partial<EnemyDesignConfig>),
  };

  const resolvedDesignId = `${sourceKind === 'enemy' ? 'enemies' : sourceKind === 'tower' ? 'towers' : 'customShapes'}:${lookupKey}`;

  return {
    renderAs,
    towerDesign: mergedTower,
    enemyDesign: mergedEnemy,
    resolvedDesignId,
  };
}

function clampPercent(val: number | undefined, max: number | undefined): number {
  if (val === undefined || max === undefined || max <= 0) return 0;
  return Math.max(4, Math.min(100, Math.round((val / max) * 100)));
}

function buildDefaultStatsForEnemy(enemy: EnemyDefinition): AlmanacStatItem[] {
  const stats: AlmanacStatItem[] = [
    {
      id: 'hp',
      label: 'Salud Máx.',
      value: enemy.hp,
      numericValue: enemy.hp,
      maxValue: 1800,
      unit: 'HP',
      color: '#EF4444',
      bar: true,
    },
    {
      id: 'speed',
      label: 'Velocidad',
      value: `${enemy.speed} c/s`,
      numericValue: enemy.speed,
      maxValue: 1.5,
      color: '#38BDF8',
      bar: true,
    },
    {
      id: 'dps',
      label: 'Daño / seg',
      value: `${enemy.dps}/s`,
      numericValue: enemy.dps,
      maxValue: 160,
      color: '#F59E0B',
      bar: true,
    },
    {
      id: 'score',
      label: 'Valor Táctico',
      value: enemy.scoreValue,
      numericValue: enemy.scoreValue,
      maxValue: 300,
      unit: 'pts',
      color: '#10B981',
      bar: true,
    },
  ];

  if (enemy.behavior?.initialShieldHp) {
    stats.push({
      id: 'shield',
      label: 'Escudo Inicial',
      value: enemy.behavior.initialShieldHp,
      numericValue: enemy.behavior.initialShieldHp,
      maxValue: 800,
      unit: 'ESC',
      color: '#A855F7',
      bar: true,
    });
  }
  if (enemy.behavior?.damageReduction) {
    const pct = Math.round(enemy.behavior.damageReduction * 100);
    stats.push({
      id: 'armor',
      label: 'Armadura',
      value: `${pct}%`,
      numericValue: pct,
      maxValue: 90,
      color: '#94A3B8',
      bar: true,
    });
  }
  if (enemy.behavior?.regenHpPerSec) {
    stats.push({
      id: 'regen',
      label: 'Regeneración',
      value: `${enemy.behavior.regenHpPerSec}/s`,
      numericValue: enemy.behavior.regenHpPerSec,
      maxValue: 60,
      color: '#22C55E',
      bar: true,
    });
  }

  return stats;
}

function buildDefaultStatsForTower(tower: TowerDefinition): AlmanacStatItem[] {
  const stats: AlmanacStatItem[] = [
    {
      id: 'cost',
      label: 'Costo Energía',
      value: tower.cost,
      numericValue: tower.cost,
      maxValue: 400,
      unit: 'EN',
      color: '#F59E0B',
      bar: true,
    },
    {
      id: 'hp',
      label: 'Integridad (HP)',
      value: tower.maxHp,
      numericValue: tower.maxHp,
      maxValue: 1200,
      unit: 'HP',
      color: '#10B981',
      bar: true,
    },
    {
      id: 'cooldown',
      label: 'Recarga',
      value: `${tower.cooldown}s`,
      numericValue: tower.cooldown,
      maxValue: 30,
      color: '#94A3B8',
      bar: true,
    },
  ];

  if (tower.damage !== undefined && tower.damage > 0) {
    const shots = tower.burstCount ?? 1;
    const rate = tower.fireRate ?? 0;
    const approxDps = rate > 0 ? Math.round(tower.damage * shots * rate) : tower.damage;
    stats.push({
      id: 'damage',
      label: 'Daño Base',
      value: shots > 1 ? `${tower.damage} x${shots}` : tower.damage,
      numericValue: tower.damage * shots,
      maxValue: 220,
      color: '#EF4444',
      bar: true,
    });
    if (rate > 0) {
      stats.push({
        id: 'dps',
        label: 'Cadencia / DPS',
        value: `${approxDps}/s (${rate}/s)`,
        numericValue: approxDps,
        maxValue: 240,
        color: '#FB923C',
        bar: true,
      });
    }
  }

  if (tower.shieldOnDeploy) {
    stats.push({
      id: 'shield',
      label: 'Escudo',
      value: tower.shieldOnDeploy,
      numericValue: tower.shieldOnDeploy,
      maxValue: 500,
      color: '#38BDF8',
      bar: true,
    });
  }

  if (tower.energyAmount) {
    stats.push({
      id: 'energy',
      label: 'Producción',
      value: `+${tower.energyAmount} EN / ${tower.energyInterval ?? 8}s`,
      numericValue: tower.energyAmount,
      maxValue: 100,
      color: '#FBBF24',
      bar: true,
    });
  }

  if (tower.healAmount) {
    stats.push({
      id: 'heal',
      label: 'Curación',
      value: `+${tower.healAmount} HP / ${tower.healInterval ?? 3}s`,
      numericValue: tower.healAmount,
      maxValue: 150,
      color: '#34D399',
      bar: true,
    });
  }

  return stats;
}

function lookupAnimationPreset(
  presetName: string | undefined,
  designCatalog: DesignCatalog,
  almanacCatalog?: AlmanacCatalog
): AlmanacAnimationPreset | undefined {
  if (!presetName) return undefined;
  const fromDesign = designCatalog.animations?.[presetName];
  const fromAlmanac = almanacCatalog?.animations?.[presetName];
  if (!fromDesign && !fromAlmanac) return undefined;
  return {
    ...(fromDesign ?? {}),
    ...(fromAlmanac ?? {}),
  };
}

export function resolveAlmanacEntry(
  kind: AlmanacEntityKind,
  def: TowerDefinition | EnemyDefinition,
  designCatalog: DesignCatalog,
  almanacCatalog?: AlmanacCatalog,
  liveOverride?: AlmanacEntryConfig
): ResolvedAlmanacEntry {
  const isEnemy = kind === 'enemy';
  const enemy = isEnemy ? (def as EnemyDefinition) : null;
  const tower = !isEnemy ? (def as TowerDefinition) : null;
  const type = def.type;

  const catalogBlock = isEnemy
    ? almanacCatalog?.enemies?.[type]
    : almanacCatalog?.towers?.[type];

  const mergedEntry: AlmanacEntryConfig = {
    ...(catalogBlock ?? {}),
    ...(def.almanac ?? {}),
    ...(liveOverride ?? {}),
    animation: {
      ...(catalogBlock?.animation ?? {}),
      ...(def.almanac?.animation ?? {}),
      ...(liveOverride?.animation ?? {}),
      states: {
        ...(catalogBlock?.animation?.states ?? {}),
        ...(def.almanac?.animation?.states ?? {}),
        ...(liveOverride?.animation?.states ?? {}),
      },
    },
    statOverrides: {
      ...(catalogBlock?.statOverrides ?? {}),
      ...(def.almanac?.statOverrides ?? {}),
      ...(liveOverride?.statOverrides ?? {}),
    },
  };

  const defaultStats = mergedEntry.hideDefaultStats
    ? []
    : enemy
    ? buildDefaultStatsForEnemy(enemy)
    : buildDefaultStatsForTower(tower!);

  const resolvedStats: ResolvedAlmanacStat[] = [];
  const overrides = mergedEntry.statOverrides ?? {};

  for (const st of defaultStats) {
    const id = st.id ?? st.label;
    const ov = overrides[id];
    if (ov?.hidden) continue;
    const label = ov?.label ?? st.label;
    const value = ov?.value ?? st.value;
    const numVal =
      ov?.numericValue ??
      (typeof ov?.value === 'number' ? ov.value : st.numericValue);
    const maxVal = ov?.maxValue ?? st.maxValue;
    const color = ov?.color ?? st.color ?? '#F59E0B';
    const bar = ov?.bar ?? st.bar ?? (numVal !== undefined && maxVal !== undefined);
    resolvedStats.push({
      id,
      label,
      value:
        ov?.unit && typeof value === 'number'
          ? `${value} ${ov.unit}`
          : st.unit && typeof value === 'number'
          ? `${value} ${st.unit}`
          : value,
      numericValue: numVal,
      maxValue: maxVal,
      unit: ov?.unit ?? st.unit,
      color,
      icon: ov?.icon ?? st.icon,
      order: ov?.order ?? st.order,
      bar,
      percent: bar ? clampPercent(numVal, maxVal) : 0,
    });
  }

  for (let i = 0; i < (mergedEntry.stats?.length ?? 0); i++) {
    const custom = mergedEntry.stats![i];
    const id = custom.id ?? `custom_${i}`;
    const numVal =
      custom.numericValue ?? (typeof custom.value === 'number' ? custom.value : undefined);
    const maxVal = custom.maxValue ?? 100;
    const bar = custom.bar ?? numVal !== undefined;
    const formattedVal =
      custom.unit && typeof custom.value === 'number'
        ? `${custom.value} ${custom.unit}`
        : custom.value;

    const existingIdx = resolvedStats.findIndex((s) => s.id === id);
    const item: ResolvedAlmanacStat = {
      id,
      label: custom.label,
      value: formattedVal,
      numericValue: numVal,
      maxValue: maxVal,
      unit: custom.unit,
      color: custom.color ?? '#38BDF8',
      icon: custom.icon,
      order: custom.order,
      bar,
      percent: bar ? clampPercent(numVal, maxVal) : 0,
      isCustom: true,
    };
    if (existingIdx >= 0) {
      resolvedStats[existingIdx] = item;
    } else {
      resolvedStats.push(item);
    }
  }

  const orderedStats = resolvedStats
    .map((stat, index) => ({ stat, index }))
    .sort((a, b) => {
      const oa = a.stat.order ?? Number.MAX_SAFE_INTEGER;
      const ob = b.stat.order ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return a.index - b.index;
    })
    .map((item) => item.stat);

  const defaultDesignId = getDefaultDesignIdForEntity(kind, type, designCatalog);
  const selectedDesignId = mergedEntry.designId || defaultDesignId;

  const rawAnim = mergedEntry.animation ?? {};
  const presetName = rawAnim.preset ?? rawAnim.animationPreset;
  const basePreset = lookupAnimationPreset(presetName, designCatalog, almanacCatalog);
  const anim: AlmanacAnimationConfig = {
    ...(basePreset ?? {}),
    ...rawAnim,
    states: {
      ...(rawAnim.states ?? {}),
    },
  };

  // Pre-resolve any state-level `preset` / `animationPreset`
  const resolvedStates: NonNullable<AlmanacAnimationConfig['states']> = {};
  for (const [stKey, stVal] of Object.entries(anim.states ?? {})) {
    if (!stVal) continue;
    const stPresetName = stVal.preset ?? stVal.animationPreset;
    const stPreset = lookupAnimationPreset(stPresetName, designCatalog, almanacCatalog);
    resolvedStates[stKey as AlmanacAnimationState] = stPreset
      ? { ...stPreset, ...stVal }
      : stVal;
  }

  const availableStates =
    anim.availableStates && anim.availableStates.length > 0
      ? anim.availableStates
      : isEnemy
      ? DEFAULT_ENEMY_ANIMATION_STATES
      : DEFAULT_TOWER_ANIMATION_STATES;

  const defaultState =
    anim.defaultState ?? (isEnemy ? 'walk' : 'idle');

  const resolvedAnimation: ResolvedAlmanacAnimation = {
    preset: presetName,
    defaultState,
    availableStates,
    autoPlay: anim.autoPlay ?? true,
    speed: anim.speed ?? 1,
    bobSpeed: anim.bobSpeed,
    bobAmount: anim.bobAmount,
    breatheAmp: anim.breatheAmp ?? 0.025,
    breatheSpeed: anim.breatheSpeed ?? 2.6,
    pulseSpeed: anim.pulseSpeed ?? 4,
    recoilIntervalSec: anim.recoilIntervalSec ?? 1.5,
    recoilStrength: anim.recoilStrength ?? 8,
    floatAmp: anim.floatAmp ?? 0,
    swayAmp: anim.swayAmp ?? 0,
    swaySpeed: anim.swaySpeed ?? 2.0,
    tiltAmpDeg: anim.tiltAmpDeg ?? 0,
    tiltSpeed: anim.tiltSpeed ?? 2.2,
    squashAmp: anim.squashAmp ?? 0,
    squashSpeed: anim.squashSpeed ?? 3.6,
    spinDegPerSec: anim.spinDegPerSec ?? 0,
    scale: anim.scale ?? 1.45,
    scaleX: anim.scaleX ?? 1,
    scaleY: anim.scaleY ?? 1,
    pedestalColor: anim.pedestalColor ?? '#1E293B',
    pedestalStrokeColor: anim.pedestalStrokeColor,
    pedestalRadiusX: anim.pedestalRadiusX ?? 52,
    pedestalRadiusY: anim.pedestalRadiusY ?? 15,
    showPedestal: anim.showPedestal ?? true,
    backdropColor: anim.backdropColor ?? '#0A0E14',
    showGrid: anim.showGrid ?? true,
    gridColor: anim.gridColor,
    gridStep: anim.gridStep ?? 22,
    glowColor: anim.glowColor,
    orbitCount: anim.orbitCount ?? 0,
    orbitRadius: anim.orbitRadius ?? 40,
    orbitSpeed: anim.orbitSpeed ?? 1.6,
    orbitColor: anim.orbitColor,
    particlePresetId:
      anim.particlePresetId ??
      (isEnemy ? enemy?.particles?.onSpawn : tower?.particles?.onAttack),
    cardTransition: anim.cardTransition ?? 'fade',
    states: resolvedStates,
  };

  const defaultAccent = isEnemy
    ? enemy?.classification?.toLowerCase().includes('keter')
      ? '#EF4444'
      : enemy?.classification?.toLowerCase().includes('euclid')
      ? '#F59E0B'
      : '#10B981'
    : tower?.category === 'personal'
    ? '#38BDF8'
    : '#F59E0B';

  const autoTags: string[] = [];
  if (enemy) {
    if (enemy.isSummon) autoTags.push('Invocación');
    if ((enemy.behavior?.laneSpan ?? 1) > 1) autoTags.push(`${enemy.behavior?.laneSpan} Carriles`);
    if (enemy.behavior?.immunities?.length) {
      autoTags.push(...enemy.behavior.immunities.map((im) => `Inmune: ${im}`));
    }
    if (enemy.effects?.length) {
      autoTags.push(...enemy.effects);
    }
  } else if (tower) {
    autoTags.push(tower.category === 'personal' ? 'Personal' : 'Estructura');
    if (tower.damageType) autoTags.push(`Daño ${tower.damageType}`);
    if (tower.immuneToPsych) autoTags.push('Inmune Psíquico');
    if (tower.effects?.length) autoTags.push(...tower.effects);
  }

  return {
    kind,
    type,
    code: mergedEntry.code ?? (enemy ? enemy.code : tower!.type.toUpperCase()),
    title: mergedEntry.title ?? def.name,
    subtitle:
      mergedEntry.subtitle ??
      (enemy ? enemy.classification : tower!.roleLabel),
    classification:
      mergedEntry.classification ??
      (enemy ? enemy.classification : tower!.category === 'personal' ? 'Personal' : 'Estructura'),
    badgeText: mergedEntry.badgeText,
    accentColor: mergedEntry.accentColor ?? defaultAccent,
    clearanceLevel: mergedEntry.clearanceLevel,
    threatRating: mergedEntry.threatRating,
    description:
      mergedEntry.description ??
      (enemy ? enemy.summary : tower!.description),
    lore: mergedEntry.lore,
    containmentProcedures: mergedEntry.containmentProcedures,
    tacticalNote:
      mergedEntry.tacticalNote ??
      (enemy
        ? enemy.tacticalNote
        : `Costo ${tower!.cost} EN · Recarga ${tower!.cooldown}s · Desbloqueo Nivel ${tower!.unlockLevel}`),
    quote: mergedEntry.quote,
    author: mergedEntry.author,
    tags: mergedEntry.tags ?? Array.from(new Set(autoTags)),
    visualMode: mergedEntry.visualMode ?? 'design',
    selectedDesignId,
    portrait: mergedEntry.portrait ?? enemy?.portrait,
    portraitFit: mergedEntry.portraitFit ?? 'cover',
    portraitBg: mergedEntry.portraitBg,
    cardBg: mergedEntry.cardBg,
    cardBorderColor: mergedEntry.cardBorderColor,
    customFields: mergedEntry.customFields ?? [],
    stats: orderedStats,
    animation: resolvedAnimation,
    rawEntry: mergedEntry,
  };
}

export function buildAlmanacConfigSnippet(
  format: 'json' | 'toml',
  kind: AlmanacEntityKind,
  entityType: string,
  almanacEntry: AlmanacEntryConfig,
  wrapMode: 'almanacBlock' | 'standaloneAlmanac' | 'catalogueToml' = 'catalogueToml'
): string {
  const sectionKey = kind === 'enemy' ? 'enemies' : 'towers';
  const payload =
    wrapMode === 'catalogueToml'
      ? {
          almanac: {
            [sectionKey]: {
              [entityType]: almanacEntry,
            },
          },
        }
      : wrapMode === 'standaloneAlmanac'
      ? {
          [sectionKey]: {
            [entityType]: almanacEntry,
          },
        }
      : {
          almanac: almanacEntry,
        };

  return format === 'toml' ? stringifyToToml(payload) : stringifyToJson(payload, 2);
}
