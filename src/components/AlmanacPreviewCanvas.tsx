import { useEffect, useRef } from 'react';
import { GAME_CONFIG } from '../data/scpCatalog';
import { ParticleSystem } from '../engine/particleSystem';
import { renderAlmanacPreview } from '../engine/renderer';
import {
  AlmanacAnimationConfig,
  AlmanacAnimationState,
  EnemyDesignConfig,
  TowerDesignConfig,
} from '../types/game';

interface AlmanacPreviewCanvasProps {
  kind: 'tower' | 'enemy';
  entityType: string;
  designId?: string;
  designOverride?: Partial<TowerDesignConfig> | Partial<EnemyDesignConfig>;
  animationState: AlmanacAnimationState;
  animConfig?: AlmanacAnimationConfig;
  playing?: boolean;
  speedMultiplier?: number;
  accentColor?: string;
  particlePresetId?: string;
  emitSignal?: number;
  width?: number;
  height?: number;
  className?: string;
}

export function AlmanacPreviewCanvas({
  kind,
  entityType,
  designId,
  designOverride,
  animationState,
  animConfig,
  playing = true,
  speedMultiplier = 1,
  accentColor = '#F59E0B',
  particlePresetId,
  emitSignal = 0,
  width = 340,
  height = 220,
  className = '',
}: AlmanacPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleSysRef = useRef<ParticleSystem>(new ParticleSystem(260));

  const latestPropsRef = useRef({
    kind,
    entityType,
    designId,
    designOverride,
    animationState,
    animConfig,
    playing,
    speedMultiplier,
    accentColor,
    particlePresetId,
    width,
    height,
  });

  latestPropsRef.current = {
    kind,
    entityType,
    designId,
    designOverride,
    animationState,
    animConfig,
    playing,
    speedMultiplier,
    accentColor,
    particlePresetId,
    width,
    height,
  };

  useEffect(() => {
    if (emitSignal > 0 && particlePresetId) {
      particleSysRef.current.emitPreset(particlePresetId, 0.5, 0.5, {
        cellSize: GAME_CONFIG.boardLayout.cellSize,
      });
    }
  }, [emitSignal, particlePresetId]);

  useEffect(() => {
    let rafId = 0;
    let lastNow = performance.now();
    let animTime = 0;
    let autoEmitAccum = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;
      const p = latestPropsRef.current;

      if (p.playing) {
        animTime += dt * Math.max(0.1, p.speedMultiplier);
        if (
          p.particlePresetId &&
          (p.animationState === 'attack' ||
            p.animationState === 'ability' ||
            p.animationState === 'enraged' ||
            p.animationState === 'burning')
        ) {
          const interval =
            p.animConfig?.states?.[p.animationState]?.recoilIntervalSec ??
            p.animConfig?.recoilIntervalSec ??
            1.35;
          autoEmitAccum += dt * Math.max(0.25, p.speedMultiplier);
          if (autoEmitAccum >= Math.max(0.45, interval)) {
            autoEmitAccum = 0;
            particleSysRef.current.emitPreset(p.particlePresetId, 0.5, 0.5, {
              cellSize: GAME_CONFIG.boardLayout.cellSize,
            });
          }
        } else {
          autoEmitAccum = 0;
        }
      }

      particleSysRef.current.step(dt, GAME_CONFIG.boardLayout.cellSize);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderAlmanacPreview(ctx, {
            kind: p.kind,
            entityType: p.entityType,
            designId: p.designId,
            designOverride: p.designOverride,
            animationState: p.animationState,
            time: animTime,
            animConfig: p.animConfig,
            width: p.width,
            height: p.height,
            accentColor: p.accentColor,
            particleSystem: particleSysRef.current,
          });
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      data-testid="almanac-preview-canvas"
      className={`block w-full rounded-lg border border-slate-800 bg-[#0A0E14] ${className}`}
      aria-label={`Vista previa animada de ${entityType} (${animationState})`}
    />
  );
}
