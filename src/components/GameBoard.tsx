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

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;

const positions: Record<string, { x: number; y: number }> = {
  hokkaido: { x: 882, y: 231 },
  oshu: { x: 858, y: 420 },
  edo: { x: 794, y: 567 },
  kanto: { x: 764, y: 623 },
  kansai: { x: 563, y: 656 },
  nagato: { x: 389, y: 596 },
  shikoku: { x: 518, y: 791 },
  kyushu: { x: 290, y: 786 },
};

const DRAG_DEAD_ZONE = 5;

/** Compute initial centered pan offset for a given container size */
function computeInitialPan(containerWidth: number, containerHeight: number) {
  return {
    x: (containerWidth - MAP_WIDTH) / 2,
    y: (containerHeight - MAP_HEIGHT) / 2,
  };
}

/** Clamp pan values so the map edges stop at the viewport edges */
function clampPan(rawX: number, rawY: number, containerWidth: number, containerHeight: number) {
  let x: number;
  let y: number;

  if (containerWidth >= MAP_WIDTH) {
    // Container wider than map - center it, no horizontal pan needed
    x = (containerWidth - MAP_WIDTH) / 2;
  } else {
    // Map overflows container horizontally - allow panning
    const minX = containerWidth - MAP_WIDTH;
    const maxX = 0;
    x = Math.max(minX, Math.min(maxX, rawX));
  }

  if (containerHeight >= MAP_HEIGHT) {
    // Container taller than map - center it, no vertical pan needed
    y = (containerHeight - MAP_HEIGHT) / 2;
  } else {
    // Map overflows container vertically - allow panning
    const minY = containerHeight - MAP_HEIGHT;
    const maxY = 0;
    y = Math.max(minY, Math.min(maxY, rawY));
  }

  return { x, y };
}

export const GameBoard = () => {
  const { gameState, localPlayerId } = useGameStore();

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
    seasonSetup: 'SEASON SETUP',
    tea: 'TEA CEREMONY',
    politics: `POLITICS (${gameState.politicsMandateCount}/${gameState.maxMandates})`,
    war: 'WAR',
    cleanup: 'CLEANUP',
    winter: 'WINTER',
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
            {cp?.name}&apos;s Turn
          </span>
          {gameState.mode === 'hotseat' && <span className="hotseat-label">[HOTSEAT]</span>}
          {!isMyTurn && gameState.mode === 'online' && <span className="waiting-label">[WAITING]</span>}
        </div>
        <div className="mandate-counter">
          Round: {gameState.round}/{gameState.maxRounds}
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
                      to: 'shikoku',
                      path: `M ${positions.hokkaido.x} ${positions.hokkaido.y} C ${positions.hokkaido.x + 120} ${positions.hokkaido.y + 180}, ${positions.shikoku.x + 150} ${positions.shikoku.y - 270}, ${positions.shikoku.x} ${positions.shikoku.y}`,
                    },
                    {
                      from: 'nagato',
                      to: 'shikoku',
                      path: `M ${positions.nagato.x} ${positions.nagato.y} Q ${positions.nagato.x + 45} ${positions.nagato.y + 60}, ${positions.shikoku.x} ${positions.shikoku.y}`,
                    },
                    {
                      from: 'shikoku',
                      to: 'kyushu',
                      path: `M ${positions.shikoku.x} ${positions.shikoku.y} Q ${positions.shikoku.x - 90} ${positions.shikoku.y + 45}, ${positions.kyushu.x} ${positions.kyushu.y}`,
                    },
                  ];
                  return seaRoutePaths.map(route => (
                    <path
                      key={`sea-${route.from}-${route.to}`}
                      d={route.path}
                      fill="none"
                      stroke="rgba(80,160,220,0.5)"
                      strokeWidth="2.5"
                      strokeDasharray="6,4"
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
