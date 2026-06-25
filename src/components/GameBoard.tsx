import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCES_DATA } from '../types/game';
import { RegionCard } from './RegionCard';
import { PlayerPanel } from './PlayerPanel';
import { ActionPanel } from './ActionPanel';
import { BattlePanel } from './BattlePanel';
import { GameLog } from './GameLog';
import { GameOverScreen } from './GameOverScreen';
import { JapanMapBackground } from './JapanMapBackground';
import { TemplePanel } from './TemplePanel';
import { HonorTrack } from './HonorTrack';
import { AllianceDisplay } from './AllianceDisplay';
import { PoliticsTrack } from './PoliticsTrack';
import { useT } from '../i18n';

const MAP_WIDTH = 1672;
const MAP_HEIGHT = 941;

const positions: Record<string, { x: number; y: number }> = {
  hokkaido: { x: 1229, y: 218 },
  oshu: { x: 1195, y: 419 },
  edo: { x: 1058, y: 573 },
  kanto: { x: 1229, y: 637 },
  kansai: { x: 774, y: 674 },
  nagato: { x: 448, y: 605 },
  shikoku: { x: 630, y: 807 },
  kyushu: { x: 276, y: 808 },
};

const DRAG_DEAD_ZONE = 5;

/** Compute initial centered pan offset for a given container size */
function computeInitialPan(containerWidth: number, containerHeight: number) {
  return {
    x: (containerWidth - MAP_WIDTH) / 2,
    y: (containerHeight - MAP_HEIGHT) / 2,
  };
}

/** Clamp pan values so at least MARGIN px of the map remains visible */
function clampPan(rawX: number, rawY: number, containerWidth: number, containerHeight: number) {
  // Allow free panning in all directions
  // Constraint: at least 100px of the map must remain visible in the viewport
  const MARGIN = 100;
  const minX = -(MAP_WIDTH - MARGIN);
  const maxX = containerWidth - MARGIN;
  const minY = -(MAP_HEIGHT - MARGIN);
  const maxY = containerHeight - MARGIN;

  return {
    x: Math.max(minX, Math.min(maxX, rawX)),
    y: Math.max(minY, Math.min(maxY, rawY)),
  };
}

export const GameBoard = () => {
  const { gameState, localPlayerId } = useGameStore();
  const t = useT();

  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startTranslateX: 0, startTranslateY: 0, didDrag: false, containerWidth: 0, containerHeight: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Center the map on first render once the container has a size
  useEffect(() => {
    if (initialized) return;
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw === 0 || ch === 0) return;
    const { x, y } = computeInitialPan(cw, ch);
    const clamped = clampPan(x, y, cw, ch);
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
    setInitialized(true);
  }, [initialized]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only start drag on primary button (left click / touch)
    if (e.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;

    // Cache container dimensions at drag start to avoid layout thrashing during moves
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTranslateX: translateX,
      startTranslateY: translateY,
      didDrag: false,
      containerWidth: cw,
      containerHeight: ch,
    };
    setIsDragging(true);
    // Capture pointer so moves/up fire on document even if pointer leaves the element
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [translateX, translateY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (!dragRef.current.didDrag && Math.abs(dx) < DRAG_DEAD_ZONE && Math.abs(dy) < DRAG_DEAD_ZONE) {
      return;
    }
    dragRef.current.didDrag = true;

    const { containerWidth, containerHeight } = dragRef.current;

    const rawX = dragRef.current.startTranslateX + dx;
    const rawY = dragRef.current.startTranslateY + dy;
    const { x: newX, y: newY } = clampPan(rawX, rawY, containerWidth, containerHeight);

    setTranslateX(newX);
    setTranslateY(newY);
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, []);

  if (!gameState) return <div className="loading">Loading...</div>;
  if (gameState.gameOver) return <GameOverScreen />;

  const cp = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = gameState.mode === 'hotseat' || cp?.id === localPlayerId;

  const seasonColors: Record<string, string> = {
    spring: '#FFB7C5',
    summer: '#FF6B35',
    autumn: '#D4A574',
    winter: '#A8C8E8',
  };

  const phaseLabels: Record<string, string> = {
    seasonSetup: t('phase.seasonSetup'),
    tea: t('phase.tea'),
    politics: `${t('phase.politics')} (${gameState.politicsMandateCount}/${gameState.maxMandates})`,
    war: t('phase.war'),
    cleanup: t('phase.cleanup'),
    winter: t('phase.winter'),
  };

  return (
    <div className="game-board">
      <div className="game-header">
        <div className="season-indicator" style={{ backgroundColor: seasonColors[gameState.currentSeason] }}>
          <span className="season-name">{gameState.currentSeason.toUpperCase()}</span>
          <span className="phase-name">{phaseLabels[gameState.currentPhase] || gameState.currentPhase.toUpperCase()}</span>
        </div>
        <div className="turn-indicator">
          <span className="current-player-name" style={{ color: CLANS.find(c => c.id === cp?.clanId)?.color }}>
            {t('game.turn', { name: cp?.name || '' })}
          </span>
          {gameState.mode === 'hotseat' && <span className="hotseat-label">{t('game.hotseat')}</span>}
          {!isMyTurn && gameState.mode === 'online' && <span className="waiting-label">{t('game.waiting')}</span>}
        </div>
        <div className="mandate-counter">
          {t('game.round')} {gameState.round}/{gameState.maxRounds}
        </div>
      </div>

      <div className="game-content">
        <div className="left-panel">
          <PlayerPanel />
        </div>
        <div className="center-panel">
          <PoliticsTrack />
          <TemplePanel />
          <div
            className={`map-container${isDragging ? ' dragging' : ''}`}
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <HonorTrack />
            <AllianceDisplay />
            <div
              className="map-canvas"
              style={{ transform: `translate(${translateX}px, ${translateY}px)` }}
            >
              <JapanMapBackground />
              <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="japan-map">
                {PROVINCES_DATA.map(r =>
                  r.adjacentProvinces.map(a => {
                    if (r.id > a) return null;
                    const p1 = positions[r.id] || { x: 600, y: 450 };
                    const p2 = positions[a] || { x: 600, y: 450 };
                    return (
                      <line
                        key={`${r.id}-${a}`}
                        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                        stroke="rgba(200,170,100,0.4)" strokeWidth="2" strokeDasharray="5,5"
                      />
                    );
                  })
                )}
                {/* Sea routes as curved paths */}
                {(() => {
                  const seaRoutePaths: { from: string; to: string; path: string }[] = [
                    {
                      from: 'hokkaido',
                      to: 'oshu',
                      path: `M ${positions.hokkaido.x} ${positions.hokkaido.y} C ${positions.hokkaido.x + 60} ${positions.hokkaido.y + 50}, ${positions.oshu.x + 60} ${positions.oshu.y - 50}, ${positions.oshu.x} ${positions.oshu.y}`,
                    },
                    {
                      from: 'hokkaido',
                      to: 'kansai',
                      path: `M ${positions.hokkaido.x} ${positions.hokkaido.y} C ${positions.hokkaido.x - 200} ${positions.hokkaido.y + 200}, ${positions.kansai.x - 250} ${positions.kansai.y - 250}, ${positions.kansai.x} ${positions.kansai.y}`,
                    },
                    {
                      from: 'hokkaido',
                      to: 'kyushu',
                      path: `M ${positions.hokkaido.x} ${positions.hokkaido.y} C ${positions.hokkaido.x - 500} ${positions.hokkaido.y - 100}, ${positions.kyushu.x - 200} ${positions.kyushu.y - 400}, ${positions.kyushu.x} ${positions.kyushu.y}`,
                    },
                    {
                      from: 'kansai',
                      to: 'kyushu',
                      path: `M ${positions.kansai.x} ${positions.kansai.y} C ${positions.kansai.x - 100} ${positions.kansai.y - 120}, ${positions.kyushu.x + 100} ${positions.kyushu.y - 80}, ${positions.kyushu.x} ${positions.kyushu.y}`,
                    },
                    {
                      from: 'kansai',
                      to: 'shikoku',
                      path: `M ${positions.kansai.x} ${positions.kansai.y} C ${positions.kansai.x - 30} ${positions.kansai.y + 60}, ${positions.shikoku.x + 30} ${positions.shikoku.y - 60}, ${positions.shikoku.x} ${positions.shikoku.y}`,
                    },
                    {
                      from: 'shikoku',
                      to: 'kyushu',
                      path: `M ${positions.shikoku.x} ${positions.shikoku.y} C ${positions.shikoku.x - 90} ${positions.shikoku.y + 50}, ${positions.kyushu.x + 90} ${positions.kyushu.y + 50}, ${positions.kyushu.x} ${positions.kyushu.y}`,
                    },
                  ];
                  return seaRoutePaths.map(route => (
                    <path
                      key={`sea-${route.from}-${route.to}`}
                      d={route.path}
                      fill="none"
                      stroke="rgba(80,180,240,0.8)"
                      strokeWidth="3.5"
                      strokeDasharray="8,5"
                      strokeLinecap="round"
                    />
                  ));
                })()}
              </svg>
              <div className="regions-overlay">
                {PROVINCES_DATA.map(r => {
                  const p = positions[r.id] || { x: 600, y: 450 };
                  return (
                    <RegionCard
                      key={r.id}
                      regionId={r.id}
                      style={{ left: `${p.x}px`, top: `${p.y}px` }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="right-panel">
          {isMyTurn && gameState.activeBattles.some(b => !b.resolved) ? <BattlePanel /> : <ActionPanel />}
          <GameLog />
        </div>
      </div>
    </div>
  );
};
