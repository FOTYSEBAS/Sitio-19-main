import assert from 'node:assert/strict';
import test from 'node:test';
import { DESIGN_CATALOG, ENEMY_CATALOG, TOWER_CATALOG } from '../data/scpCatalog.ts';
import { DesignCatalog, EnemyDefinition, TowerDefinition } from '../types/game.ts';
import {
  buildAlmanacConfigSnippet,
  listAvailableDesigns,
  resolveAlmanacEntry,
  resolveSelectedDesignConfig,
} from './almanacHelper.ts';
import { compileLevelMetadata, expandWavesToRawEvents } from './levelParser.ts';
import {
  createInitialSim,
  getEffectiveGameplay,
  getEffectiveTowerCost,
  placeTowerInSim,
  removeTowerInSim,
  stepSimulation,
} from './simulation.ts';

const SAMPLE_DESIGNS: DesignCatalog = {
  ...DESIGN_CATALOG,
  enemies: {
    ...(DESIGN_CATALOG.enemies ?? {}),
    scp_008: {
      shape: 'zombie',
      body: '#365314',
      stroke: '#84CC16',
      strokeWidth: 2,
      head: '#4D7C0F',
      accent: '#BEF264',
      hpBar: '#84CC16',
      barWidth: 36,
      codeLabel: '008',
    },
  },
  towers: {
    ...(DESIGN_CATALOG.towers ?? {}),
    guard: {
      shape: 'soldier',
      body: '#1E293B',
      stroke: '#94A3B8',
      strokeWidth: 2,
      headOrTop: '#334155',
      accent: '#38BDF8',
      weaponOrDetail: '#CBD5E1',
      label: 'GRD',
    },
  },
  customShapes: {
    ...(DESIGN_CATALOG.customShapes ?? {}),
    orb_test: [{ type: 'circle', fill: '#22D3EE', r: 14 }],
  },
};

const SAMPLE_SCP_008: EnemyDefinition = {
  type: 'scp_008',
  code: 'SCP-008',
  name: 'Infectado',
  classification: 'Euclid',
  hp: 160,
  speed: 0.38,
  dps: 24,
  scoreValue: 50,
  portrait: '',
  summary: 'Plaga zombie',
  tacticalNote: 'Contener con guardias.',
  effects: [],
};

const SAMPLE_GUARD: TowerDefinition = {
  type: 'guard',
  name: 'Guardia',
  category: 'personal',
  cost: 100,
  cooldown: 4,
  maxHp: 220,
  roleLabel: 'Ataque',
  description: 'Unidad estándar.',
  unlockLevel: 0,
  damage: 20,
  fireRate: 1.4,
  maxRangeCols: 9,
  projectileKind: 'standard',
  damageType: 'physical',
};

test('listAvailableDesigns and resolveSelectedDesignConfig resolve enemy, tower, and customShape designs', () => {
  const designs = listAvailableDesigns(SAMPLE_DESIGNS);
  assert.ok(designs.some((d) => d.id === 'enemies:scp_008'));
  assert.ok(designs.some((d) => d.id === 'towers:guard'));
  assert.ok(designs.some((d) => d.id === 'customShapes:orb_test'));

  const resolvedCustom = resolveSelectedDesignConfig(
    'enemy',
    'scp_008',
    SAMPLE_DESIGNS,
    { designId: 'customShapes:orb_test' }
  );
  assert.equal(resolvedCustom.enemyDesign.shape, 'orb_test');

  const resolvedCross = resolveSelectedDesignConfig(
    'enemy',
    'scp_008',
    SAMPLE_DESIGNS,
    { designId: 'towers:guard' }
  );
  assert.equal(resolvedCross.renderAs, 'tower');
  assert.equal(resolvedCross.towerDesign.shape, SAMPLE_DESIGNS.towers.guard.shape);
});

test('resolveAlmanacEntry merges base definition, almanac overrides, custom stats, animation states, and exports JSON/TOML', () => {
  const entry = resolveAlmanacEntry(
    'enemy',
    SAMPLE_SCP_008,
    SAMPLE_DESIGNS,
    {
      enemies: {
        scp_008: {
          subtitle: 'Catalog Override',
          statOverrides: {
            hp: { label: 'HP Base', color: '#84CC16' },
          },
        },
      },
    },
    {
      description: 'Descripción personalizada en vivo',
      designId: 'towers:guard',
      animation: {
        defaultState: 'enraged',
        speed: 1.5,
        cardTransition: 'slide',
      },
      stats: [
        {
          id: 'custom_threat',
          label: 'Peligro Urbano',
          value: 'Alto',
          numericValue: 8,
          maxValue: 10,
          bar: true,
        },
      ],
    }
  );

  assert.equal(entry.description, 'Descripción personalizada en vivo');
  assert.equal(entry.subtitle, 'Catalog Override');
  assert.equal(entry.selectedDesignId, 'towers:guard');
  assert.equal(entry.animation.defaultState, 'enraged');
  assert.equal(entry.animation.speed, 1.5);
  assert.equal(entry.animation.cardTransition, 'slide');
  assert.ok(entry.stats.some((s) => s.id === 'hp' && s.label === 'HP Base'));
  assert.ok(entry.stats.some((s) => s.id === 'custom_threat' && s.value === 'Alto'));

  const tomlSnippet = buildAlmanacConfigSnippet(
    'toml',
    'enemy',
    'scp_008',
    entry.rawEntry,
    'standaloneAlmanac'
  );
  assert.match(tomlSnippet, /\[enemies\.scp_008\]/);
  assert.match(tomlSnippet, /designId = "towers:guard"/);

  const jsonSnippet = buildAlmanacConfigSnippet(
    'json',
    'enemy',
    'scp_008',
    entry.rawEntry,
    'standaloneAlmanac'
  );
  const parsedJson = JSON.parse(jsonSnippet);
  assert.equal(parsedJson.enemies.scp_008.designId, 'towers:guard');
});

test('expandWavesToRawEvents, compileLevelMetadata, prepTimer, and tower/enemy overrides work in simulation', () => {
  // Ensure catalogs have entries during pure Node execution without Vite glob transform
  if (!TOWER_CATALOG.some((t) => t.type === 'guard')) {
    TOWER_CATALOG.push(SAMPLE_GUARD);
  }
  if (!ENEMY_CATALOG.some((e) => e.type === 'scp_008')) {
    ENEMY_CATALOG.push(SAMPLE_SCP_008);
  }

  const expanded = expandWavesToRawEvents([
    {
      delaySec: 3,
      announcement: 'Oleada Alfa',
      spawns: [
        { type: 'scp_008', count: 2, row: 1 },
        { type: 'scp_966', count: 1, row: 2 },
      ],
    },
  ]);
  assert.equal(expanded.length, 2);
  assert.equal(expanded[0].time, 3);
  assert.equal(expanded[1].time, 0);

  const level = compileLevelMetadata({
    level: 99,
    title: 'Nivel Personalizado TOML',
    subtitle: 'Subtítulo Test',
    difficulty: 'pesadilla',
    themeColor: '#EF4444',
    badgeText: 'TEST',
    description: 'Prueba unitaria',
    startingEnergy: 300,
    maxDeckSlots: 6,
    prepTimeSec: 5,
    laneLabels: ['A', 'B', 'C', 'D', 'E', 'F'],
    hudOverride: { headerBg: '#111827' },
    towerOverrides: {
      guard: { cost: 65, maxHp: 450 },
    },
    enemyOverrides: {
      scp_008: { hp: 320, speed: 0.5 },
    },
    waves: [
      {
        delaySec: 1,
        spawns: [{ type: 'scp_008', count: 1, row: 0 }],
      },
    ],
  });

  assert.equal(level.prepTimeSec, 5);
  assert.equal(level.difficulty, 'pesadilla');
  assert.deepEqual(level.laneLabels, ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(level.hudOverride?.headerBg, '#111827');
  assert.equal(level.rawEvents.length, 1);

  const sim = createInitialSim(level);
  assert.equal(sim.prepTimer, 5);

  // During prepTimer, wave spawns are held even after advancing 2 seconds
  stepSimulation(sim, 2.0);
  assert.equal(sim.enemies.length, 0);
  assert.ok(sim.prepTimer > 2.5 && sim.prepTimer <= 3.01);

  // Guard tower override applies cost (65) and maxHp (450)
  const guardCost = getEffectiveTowerCost('guard', level.rules, sim, level);
  assert.equal(guardCost, 65);
  const placed = placeTowerInSim(sim, 'guard', 0, 2);
  assert.equal(placed, true);
  assert.equal(sim.towers[0].maxHp, 450);

  // Advance past prepTimer + wave delay (remaining 3s + 1.2s)
  for (let i = 0; i < 45; i++) {
    stepSimulation(sim, 0.1);
  }
  assert.equal(sim.prepTimer, 0);
  assert.equal(sim.enemies.length, 1);
  assert.equal(sim.enemies[0].maxHp, 320);
});

test('resolveAlmanacEntry resolves animation presets, ordered stats with icons, customFields, and catalogueToml snippet', () => {
  const designsWithPresets: DesignCatalog = {
    ...SAMPLE_DESIGNS,
    animations: {
      feral_preset: {
        swayAmp: 3.5,
        tiltAmpDeg: 6,
        squashAmp: 0.08,
        orbitCount: 2,
        orbitColor: '#84CC16',
        showGrid: false,
      },
      attack_burst: {
        tiltAmpDeg: 11,
        spinDegPerSec: 45,
      },
    },
  };

  const entry = resolveAlmanacEntry(
    'enemy',
    SAMPLE_SCP_008,
    designsWithPresets,
    {
      enemies: {
        scp_008: {
          cardBg: '#0D1610',
          portraitFit: 'contain',
          customFields: [{ label: 'Vector', value: 'Fluido / Mordida', badge: 'EUCLID' }],
          statOverrides: {
            dps: { order: 1, icon: 'sword', color: '#F97316' },
            hp: { order: 2, icon: 'shield' },
          },
          animation: {
            preset: 'feral_preset',
            states: {
              attack: { preset: 'attack_burst' },
            },
          },
        },
      },
    }
  );

  assert.equal(entry.cardBg, '#0D1610');
  assert.equal(entry.portraitFit, 'contain');
  assert.equal(entry.customFields.length, 1);
  assert.equal(entry.customFields[0].badge, 'EUCLID');
  assert.equal(entry.stats[0].id, 'dps');
  assert.equal(entry.stats[0].icon, 'sword');
  assert.equal(entry.stats[1].id, 'hp');
  assert.equal(entry.stats[1].icon, 'shield');
  assert.equal(entry.animation.swayAmp, 3.5);
  assert.equal(entry.animation.orbitCount, 2);
  assert.equal(entry.animation.showGrid, false);
  assert.equal(entry.animation.states.attack?.spinDegPerSec, 45);

  const catToml = buildAlmanacConfigSnippet('toml', 'enemy', 'scp_008', entry.rawEntry);
  assert.match(catToml, /\[almanac\.enemies\.scp_008\]/);
});

test('getEffectiveGameplay and removeTowerInSim apply per-level gameplayOverride', () => {
  if (!TOWER_CATALOG.some((t) => t.type === 'guard')) {
    TOWER_CATALOG.push(SAMPLE_GUARD);
  }
  const level = compileLevelMetadata({
    level: 98,
    title: 'Nivel Gameplay Override',
    description: 'Test gameplayOverride',
    startingEnergy: 200,
    maxDeckSlots: 6,
    gameplayOverride: {
      energyDropAmount: 90,
      removeRefundRatio: 0.5,
    },
    events: [{ time: 10, type: 'scp_008', count: 1, row: 0 }],
  });

  const effective = getEffectiveGameplay(level);
  assert.equal(effective.energyDropAmount, 90);
  assert.equal(effective.removeRefundRatio, 0.5);

  const sim = createInitialSim(level);
  const placed = placeTowerInSim(sim, 'guard', 0, 1);
  assert.equal(placed, true);
  // 200 - 100 = 100 remaining; removing with 0.5 refund adds 50 -> 150
  const removed = removeTowerInSim(sim, 0, 1);
  assert.equal(removed, true);
  assert.equal(sim.energy, 150);
});
