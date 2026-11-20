import {
  Activity,
  Award,
  BatteryCharging,
  Biohazard,
  Check,
  Code2,
  Copy,
  Crosshair,
  FileCode2,
  Flame,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Swords,
  Wind,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ALMANAC_CATALOG,
  DESIGN_CATALOG,
  ENEMY_CATALOG,
  GAME_CONFIG,
  TOWER_CATALOG,
} from '../data/scpCatalog';
import {
  ALL_ALMANAC_ANIMATION_STATES,
  AlmanacEntityKind,
  buildAlmanacConfigSnippet,
  listAvailableDesigns,
  resolveAlmanacEntry,
} from '../engine/almanacHelper';
import { AlmanacAnimationState, AlmanacEntryConfig } from '../types/game';
import { AlmanacPreviewCanvas } from './AlmanacPreviewCanvas';

interface AlmanacEntityRef {
  key: string;
  kind: AlmanacEntityKind;
  type: string;
}

function renderStatIcon(iconName: string | undefined, color: string) {
  const props = { className: 'h-3.5 w-3.5 shrink-0', style: { color } };
  switch (iconName) {
    case 'shield':
      return <Shield {...props} />;
    case 'wind':
    case 'speed':
      return <Wind {...props} />;
    case 'flame':
    case 'fire':
      return <Flame {...props} />;
    case 'award':
    case 'star':
      return <Award {...props} />;
    case 'biohazard':
    case 'virus':
      return <Biohazard {...props} />;
    case 'zap':
    case 'energy':
      return <Zap {...props} />;
    case 'battery':
      return <BatteryCharging {...props} />;
    case 'heart':
    case 'hp':
      return <Heart {...props} />;
    case 'sword':
    case 'swords':
    case 'damage':
      return <Swords {...props} />;
    case 'crosshair':
    case 'target':
      return <Crosshair {...props} />;
    case 'sparkles':
      return <Sparkles {...props} />;
    case 'activity':
      return <Activity {...props} />;
    default:
      return null;
  }
}

export function AlmanacPanel() {
  const almanacUi = GAME_CONFIG.ui?.almanac;
  const themeUi = GAME_CONFIG.ui?.theme;

  const allEntities = useMemo<AlmanacEntityRef[]>(() => {
    const scps: AlmanacEntityRef[] = ENEMY_CATALOG.map((e) => ({
      key: `enemy:${e.type}`,
      kind: 'enemy',
      type: e.type,
    }));
    const towers: AlmanacEntityRef[] = TOWER_CATALOG.map((t) => ({
      key: `tower:${t.type}`,
      kind: 'tower',
      type: t.type,
    }));
    return [...scps, ...towers];
  }, []);

  const designOptions = useMemo(() => listAvailableDesigns(DESIGN_CATALOG), []);

  const groupedDesigns = useMemo(() => {
    return {
      enemies: designOptions.filter((o) => o.sourceKind === 'enemy'),
      towers: designOptions.filter((o) => o.sourceKind === 'tower'),
      customShapes: designOptions.filter((o) => o.sourceKind === 'customShape'),
    };
  }, [designOptions]);

  const [filterKind, setFilterKind] = useState<'all' | AlmanacEntityKind>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>(
    () => allEntities[0]?.key ?? 'enemy:scp_008'
  );
  // Session-only preview designId switcher so users can inspect any design on any unit
  const [previewDesigns, setPreviewDesigns] = useState<Record<string, string>>({});

  // Preview animation controls
  const [animState, setAnimState] = useState<AlmanacAnimationState>('walk');
  const [isPlaying, setIsPlaying] = useState(true);
  const [animSpeed, setAnimSpeed] = useState<number>(1);
  const [visualMode, setVisualMode] = useState<'design' | 'portrait'>('design');
  const [emitSignal, setEmitSignal] = useState(0);

  // Read-only TOML / JSON code inspector drawer
  const [codeDrawerOpen, setCodeDrawerOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'toml' | 'json'>('toml');
  const [wrapMode, setWrapMode] = useState<'catalogueToml' | 'standaloneAlmanac' | 'almanacBlock'>(
    'catalogueToml'
  );
  const [copied, setCopied] = useState(false);

  const filteredEntities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEntities.filter((ref) => {
      if (filterKind !== 'all' && ref.kind !== filterKind) return false;
      const def =
        ref.kind === 'enemy'
          ? ENEMY_CATALOG.find((e) => e.type === ref.type)
          : TOWER_CATALOG.find((t) => t.type === ref.type);
      if (!def) return false;
      if (!q) return true;
      const resolved = resolveAlmanacEntry(
        ref.kind,
        def,
        DESIGN_CATALOG,
        ALMANAC_CATALOG,
        previewDesigns[ref.key] ? { designId: previewDesigns[ref.key] } : undefined
      );
      return (
        resolved.code.toLowerCase().includes(q) ||
        resolved.title.toLowerCase().includes(q) ||
        resolved.description.toLowerCase().includes(q) ||
        resolved.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [allEntities, filterKind, searchQuery, previewDesigns]);

  const activeRef = useMemo(() => {
    return (
      allEntities.find((e) => e.key === selectedKey) ??
      filteredEntities[0] ??
      allEntities[0] ??
      null
    );
  }, [allEntities, filteredEntities, selectedKey]);

  const activePreviewOverride: AlmanacEntryConfig | undefined = useMemo(() => {
    if (!activeRef) return undefined;
    const picked = previewDesigns[activeRef.key];
    return picked ? { designId: picked } : undefined;
  }, [activeRef, previewDesigns]);

  const activeResolved = useMemo(() => {
    if (!activeRef) return null;
    const def =
      activeRef.kind === 'enemy'
        ? ENEMY_CATALOG.find((e) => e.type === activeRef.type)
        : TOWER_CATALOG.find((t) => t.type === activeRef.type);
    if (!def) return null;
    return resolveAlmanacEntry(
      activeRef.kind,
      def,
      DESIGN_CATALOG,
      ALMANAC_CATALOG,
      activePreviewOverride
    );
  }, [activeRef, activePreviewOverride]);

  // Sync preview animation & visual mode defaults whenever entity selection changes
  useEffect(() => {
    if (!activeResolved) return;
    setAnimState(activeResolved.animation.defaultState);
    setIsPlaying(activeResolved.animation.autoPlay);
    setAnimSpeed(activeResolved.animation.speed);
    setVisualMode(
      activeResolved.visualMode === 'portrait' && activeResolved.portrait ? 'portrait' : 'design'
    );
  }, [activeRef?.key]);

  const snippetText = useMemo(() => {
    if (!activeRef || !activeResolved) return '';
    return buildAlmanacConfigSnippet(
      exportFormat,
      activeRef.kind,
      activeRef.type,
      activeResolved.rawEntry,
      wrapMode
    );
  }, [activeRef, activeResolved, exportFormat, wrapMode]);

  const handleCopySnippet = () => {
    if (!snippetText) return;
    navigator.clipboard?.writeText(snippetText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const transitionAnimClass =
    activeResolved?.animation.cardTransition === 'none'
      ? ''
      : activeResolved?.animation.cardTransition === 'slide'
      ? 'animate-[almanacSlide_0.24s_ease-out]'
      : activeResolved?.animation.cardTransition === 'pulse'
      ? 'animate-[almanacPulse_0.3s_ease-out]'
      : 'animate-[almanacFade_0.2s_ease-out]';

  return (
    <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
      {/* Left Sidebar Roster */}
      <aside className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#10151C] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar SCP o torre..."
            aria-label="Buscar en almanaque"
            className="w-full rounded-lg border border-slate-700 bg-[#0B0F14] py-1.5 pr-2.5 pl-8 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-[#0B0F14] p-1">
          <button
            type="button"
            onClick={() => setFilterKind('all')}
            className={`rounded-md py-1 text-[11px] font-semibold transition-colors ${
              filterKind === 'all'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Todos ({allEntities.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterKind('enemy')}
            className={`truncate rounded-md px-1 py-1 text-[11px] font-semibold transition-colors ${
              filterKind === 'enemy'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
            title={almanacUi?.scpsTabLabel ?? 'Anomalías SCP'}
          >
            SCP ({ENEMY_CATALOG.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterKind('tower')}
            className={`truncate rounded-md px-1 py-1 text-[11px] font-semibold transition-colors ${
              filterKind === 'tower'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
            title={almanacUi?.towersTabLabel ?? 'Personal y Estructuras'}
          >
            Torres ({TOWER_CATALOG.length})
          </button>
        </div>

        <div className="max-h-[470px] space-y-1.5 overflow-y-auto pr-1">
          {filteredEntities.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              No hay coincidencias en el almanaque.
            </p>
          ) : (
            filteredEntities.map((ref) => {
              const def =
                ref.kind === 'enemy'
                  ? ENEMY_CATALOG.find((e) => e.type === ref.type)!
                  : TOWER_CATALOG.find((t) => t.type === ref.type)!;
              const resolved = resolveAlmanacEntry(
                ref.kind,
                def,
                DESIGN_CATALOG,
                ALMANAC_CATALOG,
                previewDesigns[ref.key] ? { designId: previewDesigns[ref.key] } : undefined
              );
              const isSelected = activeRef?.key === ref.key;
              const hasCustomPreview = Boolean(previewDesigns[ref.key]);

              return (
                <button
                  type="button"
                  key={ref.key}
                  onClick={() => setSelectedKey(ref.key)}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/12 text-white'
                      : 'border-slate-800 bg-[#161D27] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-xs border border-black/40"
                    style={{ backgroundColor: resolved.accentColor }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate text-xs font-bold text-slate-100">
                        {resolved.kind === 'enemy'
                          ? `${resolved.code} · ${resolved.title}`
                          : resolved.title}
                      </span>
                      {hasCustomPreview && (
                        <span className="font-mono-num shrink-0 text-[9px] font-bold text-sky-300">
                          PREVIEW
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[10px] text-slate-400">
                      {resolved.kind === 'enemy' ? 'SCP' : 'Torre'} · {resolved.subtitle}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Detail Stage */}
      {activeRef && activeResolved ? (
        <section
          key={`${activeRef.key}-${activeResolved.animation.cardTransition}`}
          className={`flex flex-col gap-4 rounded-xl border border-slate-800 bg-[#10151C] p-4 ${transitionAnimClass}`}
          style={{
            ...(activeResolved.cardBg ? { backgroundColor: activeResolved.cardBg } : {}),
            ...(activeResolved.cardBorderColor
              ? { borderColor: activeResolved.cardBorderColor }
              : {}),
          }}
        >
          {/* Card Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-9 w-1.5 shrink-0 rounded-xs"
                style={{ backgroundColor: activeResolved.accentColor }}
                aria-hidden="true"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-num rounded border border-slate-700 bg-[#0B0F14] px-2 py-0.5 text-[11px] font-bold text-amber-300">
                    {activeResolved.code}
                  </span>
                  {activeResolved.badgeText && (
                    <span
                      className="font-mono-num rounded border px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        borderColor: activeResolved.accentColor,
                        color: activeResolved.accentColor,
                        backgroundColor: '#0B0F14',
                      }}
                    >
                      {activeResolved.badgeText}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-400">
                    {activeResolved.classification}
                  </span>
                  {activeResolved.clearanceLevel && (
                    <span className="font-mono-num text-[11px] text-sky-300">
                      · {activeResolved.clearanceLevel}
                    </span>
                  )}
                  {activeResolved.threatRating && (
                    <span className="font-mono-num text-[11px] text-rose-300">
                      · Riesgo: {activeResolved.threatRating}
                    </span>
                  )}
                </div>
                <h3 className="font-display mt-1 text-2xl font-bold tracking-wide text-white">
                  {activeResolved.title}
                </h3>
                <p className="text-xs text-slate-400">{activeResolved.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {previewDesigns[activeRef.key] && (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewDesigns((prev) => {
                      const next = { ...prev };
                      delete next[activeRef.key];
                      return next;
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Diseño Base
                </button>
              )}

              <button
                type="button"
                onClick={() => setCodeDrawerOpen((p) => !p)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                  codeDrawerOpen
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : 'border-amber-500/50 bg-amber-500/12 text-amber-300 hover:bg-amber-500/22'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                {codeDrawerOpen ? 'Ocultar Código TOML / JSON' : 'Ver código catalogue.toml / JSON'}
              </button>
            </div>
          </div>

          {/* Interactive Stage + Stats Split */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[350px_minmax(0,1fr)]">
            {/* Animated Preview & Controls */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-slate-800 bg-[#151C25] p-3">
              {visualMode === 'portrait' && activeResolved.portrait ? (
                <div
                  className="flex h-[210px] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-800"
                  style={{ backgroundColor: activeResolved.portraitBg ?? '#0A0E14' }}
                >
                  <img
                    src={activeResolved.portrait}
                    alt={`${activeResolved.code} ${activeResolved.title}`}
                    referrerPolicy="no-referrer"
                    className={`h-full w-full ${
                      activeResolved.portraitFit === 'cover' ? 'object-cover' : 'object-contain'
                    }`}
                  />
                </div>
              ) : (
                <AlmanacPreviewCanvas
                  kind={activeRef.kind}
                  entityType={activeRef.type}
                  designId={activeResolved.selectedDesignId}
                  designOverride={activeResolved.rawEntry.designOverride}
                  animationState={animState}
                  animConfig={activeResolved.animation}
                  playing={isPlaying}
                  speedMultiplier={animSpeed}
                  accentColor={activeResolved.accentColor}
                  particlePresetId={activeResolved.animation.particlePresetId}
                  emitSignal={emitSignal}
                  width={340}
                  height={210}
                />
              )}

              {/* Design Preview Selector (from designs / customShapes) */}
              <label className="text-[11px] font-semibold text-slate-300">
                Previsualizar diseño en <code className="text-amber-300">designs</code>
                <select
                  value={activeResolved.selectedDesignId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setPreviewDesigns((prev) => ({ ...prev, [activeRef.key]: nextId }));
                  }}
                  aria-label="Seleccionar diseño del almanaque desde designs"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F14] px-2.5 py-1.5 text-xs font-medium text-white focus:border-amber-400 focus:outline-none"
                >
                  {groupedDesigns.enemies.length > 0 && (
                    <optgroup label="Diseños SCP (designs.enemies)">
                      {groupedDesigns.enemies.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupedDesigns.towers.length > 0 && (
                    <optgroup label="Diseños de Torres (designs.towers)">
                      {groupedDesigns.towers.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupedDesigns.customShapes.length > 0 && (
                    <optgroup label="Formas Custom (designs.customShapes)">
                      {groupedDesigns.customShapes.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>

              {/* Visual Mode + Playback Speed */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-[#0B0F14] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {isPlaying ? 'Pausar' : 'Reproducir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnimSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))}
                    className="font-mono-num rounded-md border border-slate-700 bg-[#0B0F14] px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-slate-800"
                  >
                    {animSpeed}x
                  </button>
                  {activeResolved.animation.particlePresetId && (
                    <button
                      type="button"
                      onClick={() => setEmitSignal((n) => n + 1)}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20"
                    >
                      <Sparkles className="h-3 w-3" />
                      Efecto
                    </button>
                  )}
                </div>

                {activeResolved.portrait && (
                  <button
                    type="button"
                    onClick={() => setVisualMode((m) => (m === 'design' ? 'portrait' : 'design'))}
                    className="rounded-md border border-slate-700 bg-[#0B0F14] px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-slate-800"
                  >
                    {visualMode === 'design' ? 'Ver Retrato' : 'Ver Diseño Animado'}
                  </button>
                )}
              </div>

              {/* Animation State Switcher */}
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  <span>Estado de Animación</span>
                  {activeResolved.animation.preset && (
                    <span className="font-mono-num text-sky-300">
                      preset: {activeResolved.animation.preset}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {ALL_ALMANAC_ANIMATION_STATES.filter((item) =>
                    activeResolved.animation.availableStates.includes(item.state)
                  ).map((item) => (
                    <button
                      type="button"
                      key={item.state}
                      onClick={() => {
                        setVisualMode('design');
                        setAnimState(item.state);
                      }}
                      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                        animState === item.state && visualMode === 'design'
                          ? 'border-amber-400 bg-amber-500 text-slate-950'
                          : 'border-slate-700 bg-[#0B0F14] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Stats, Custom Fields & Lore */}
            <div className="flex flex-col gap-3">
              {/* Almanac Stats */}
              <div className="rounded-xl border border-slate-800 bg-[#151C25] p-3.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <h4 className="text-xs font-bold tracking-wider text-amber-400 uppercase">
                    {almanacUi?.statsSectionTitle ?? 'Estadísticas del Almanaque'}
                  </h4>
                  <span className="font-mono-num text-[10px] text-slate-400">
                    {activeResolved.stats.length} métricas
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {activeResolved.stats.map((st) => (
                    <div
                      key={st.id}
                      className="rounded-lg border border-slate-800 bg-[#0E131A] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                          {renderStatIcon(st.icon, st.color)}
                          <span>{st.label}</span>
                        </div>
                      </div>
                      <div className="font-mono-num mt-0.5 text-sm font-bold text-white">
                        {st.value}
                      </div>
                      {st.bar && (
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-xs bg-slate-800">
                          <div
                            className="h-full transition-[width] duration-300"
                            style={{
                              width: `${st.percent}%`,
                              backgroundColor: st.color,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Classified Custom Dossier Fields */}
              {activeResolved.customFields.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-[#151C25] p-3.5">
                  <h4 className="mb-2 text-xs font-bold tracking-wider text-sky-300 uppercase">
                    {almanacUi?.customFieldsSectionTitle ?? 'Ficha Técnica Clasificada'}
                  </h4>
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {activeResolved.customFields.map((field, idx) => (
                      <div
                        key={`${field.label}-${idx}`}
                        className="rounded-lg border border-slate-800 bg-[#0E131A] px-3 py-2"
                      >
                        <dt className="flex items-center justify-between gap-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                          <span>{field.label}</span>
                          {field.badge && (
                            <span
                              className="rounded border border-slate-700 bg-slate-900/80 px-1 py-0.5 text-[9px] font-bold"
                              style={field.color ? { color: field.color, borderColor: field.color } : undefined}
                            >
                              {field.badge}
                            </span>
                          )}
                        </dt>
                        <dd
                          className="mt-0.5 text-xs font-bold text-slate-100"
                          style={field.color ? { color: field.color } : undefined}
                        >
                          {field.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Description, Lore & Tactical Notes */}
              <div className="space-y-2.5 rounded-xl border border-slate-800 bg-[#151C25] p-3.5">
                <div>
                  <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    {almanacUi?.loreSectionTitle ?? 'Descripción'}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-200">
                    {activeResolved.description}
                  </p>
                </div>

                {activeResolved.lore && (
                  <div className="border-t border-slate-800 pt-2">
                    <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      Registro e Historial
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {activeResolved.lore}
                    </p>
                  </div>
                )}

                {activeResolved.containmentProcedures && (
                  <div className="border-t border-slate-800 pt-2">
                    <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      {almanacUi?.containmentSectionTitle ?? 'Procedimientos de Contención'}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {activeResolved.containmentProcedures}
                    </p>
                  </div>
                )}

                <div className="border-t border-slate-800 pt-2">
                  <h4
                    className="text-[11px] font-bold tracking-wider text-amber-400 uppercase"
                    style={themeUi?.accentColor ? { color: themeUi.accentColor } : undefined}
                  >
                    {almanacUi?.tacticalNoteTitle ?? 'Nota Táctica'}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    {activeResolved.tacticalNote}
                  </p>
                </div>

                {activeResolved.quote && (
                  <blockquote className="rounded-lg border-l-2 border-amber-400 bg-[#0E131A] px-3 py-2 text-xs italic text-slate-300">
                    “{activeResolved.quote}”
                    {activeResolved.author && (
                      <footer className="mt-1 text-[10px] font-semibold not-italic text-slate-400">
                        — {activeResolved.author}
                      </footer>
                    )}
                  </blockquote>
                )}

                {activeResolved.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] text-slate-300">
                    {activeResolved.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-slate-700 bg-[#0B0F14] px-2 py-0.5 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Read-Only TOML / JSON Inspector for catalogue.toml */}
          {codeDrawerOpen && (
            <div className="space-y-3 rounded-xl border border-amber-500/35 bg-[#090D12] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-start gap-2">
                  <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <h4 className="text-xs font-bold tracking-wider text-amber-400 uppercase">
                      Configuración lista para catalogue.toml / JSON
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Edita{' '}
                      <code className="text-amber-300">src/data/catalogue.toml</code>,{' '}
                      <code className="text-amber-300">src/data/toml/almanac.toml</code> o{' '}
                      <code className="text-amber-300">src/data/json/</code> para personalizar este bloque de forma permanente.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#10151C] p-0.5">
                    <button
                      type="button"
                      onClick={() => setExportFormat('toml')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                        exportFormat === 'toml'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      TOML
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('json')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                        exportFormat === 'json'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      JSON
                    </button>
                  </div>

                  <select
                    value={wrapMode}
                    onChange={(e) =>
                      setWrapMode(
                        e.target.value as 'catalogueToml' | 'standaloneAlmanac' | 'almanacBlock'
                      )
                    }
                    aria-label="Formato de archivo destino"
                    className="rounded-md border border-slate-700 bg-[#10151C] px-2 py-1 text-[11px] text-slate-200"
                  >
                    <option value="catalogueToml">Para src/data/catalogue.toml</option>
                    <option value="standaloneAlmanac">Para src/data/toml|json/almanac</option>
                    <option value="almanacBlock">Bloque inline en torre/SCP</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleCopySnippet}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copiado' : `Copiar ${exportFormat.toUpperCase()}`}
                  </button>
                </div>
              </div>

              <pre className="font-mono-num max-h-[320px] overflow-auto rounded-lg border border-slate-800 bg-[#06090D] p-3 text-[11px] leading-relaxed text-emerald-300">
                {snippetText}
              </pre>
            </div>
          )}
        </section>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-slate-800 bg-[#10151C] p-8 text-sm text-slate-400">
          Selecciona un SCP o Torre para abrir su ficha del almanaque.
        </div>
      )}
    </div>
  );
}
