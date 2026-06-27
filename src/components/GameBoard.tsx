import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
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
import { RegionDetailModal } from './RegionDetailModal';
import { HarvestPopup } from './HarvestPopup';
import { KamiResolutionPopup } from './KamiResolutionPopup';
import { VPIcon, CoinIcon, RoninIcon, HonorIcon } from './Icons';
import { ClanShield } from './ClanShields';
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

// Position and color metadata for harvest badge rendering on the map
const HARVEST_BADGE_META: Record<string, { color: string; position: { x: number; y: number } }> = {
  hokkaido: { color: '#5BC0EB', position: { x: 1350, y: 180 } },
  oshu: { color: '#9B8EC4', position: { x: 1290, y: 380 } },
  kanto: { color: '#E63946', position: { x: 1320, y: 600 } },
  edo: { color: '#2D8B4E', position: { x: 970, y: 540 } },
  kansai: { color: '#F57C20', position: { x: 870, y: 630 } },
  nagato: { color: '#8B5CF6', position: { x: 360, y: 550 } },
  shikoku: { color: '#8B6914', position: { x: 755, y: 850 } },
  kyushu: { color: '#F5D020', position: { x: 190, y: 750 } },
};

// Derive reward display data from PROVINCES_DATA (single source of truth)
const HARVEST_REWARDS: Record<string, { rewards: { type: 'vp' | 'coin' | 'ronin' | 'honor'; count: number }[]; color: string; position: { x: number; y: number } }> = Object.fromEntries(
  PROVINCES_DATA.map((province) => {
    const meta = HARVEST_BADGE_META[province.id] || { color: '#888', position: { x: 0, y: 0 } };
    const rewards: { type: 'vp' | 'coin' | 'ronin' | 'honor'; count: number }[] = [];
    const hr = province.harvestRewards;
    if (hr.vp && hr.vp > 0) rewards.push({ type: 'vp', count: hr.vp });
    if (hr.coins && hr.coins > 0) rewards.push({ type: 'coin', count: hr.coins });
    if (hr.ronin && hr.ronin > 0) rewards.push({ type: 'ronin', count: hr.ronin });
    if (hr.honor && hr.honor > 0) rewards.push({ type: 'honor', count: hr.honor });
    return [province.id, { rewards, color: meta.color, position: meta.position }];
  })
);

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
  const { gameState, localPlayerId, selectedRegion, selectRegion, moveMode, recruitMode, betrayMode, monsterPlacementMode, buildFortressMode, monsterPlacementPopupVisible, monsterPlacementCard, komainuChoiceVisible, komainuPrayMode, confirmMonsterPlacement, doKomainuChooseMap, doKomainuChoosePray, turnPopupPlayer, dismissTurnPopup, ruleViolationMessage, setRuleViolationMessage, doZorroSkipPlacement } = useGameStore();
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

  // Auto-dismiss rule violation message after 3 seconds
  useEffect(() => {
    if (!ruleViolationMessage) return;
    const timer = setTimeout(() => {
      setRuleViolationMessage(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [ruleViolationMessage, setRuleViolationMessage]);

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
        <div className="header-left">
          <div className="season-indicator" style={{ backgroundColor: seasonColors[gameState.currentSeason] }}>
            <span className="season-name">{t(`season.${gameState.currentSeason}` as any)}</span>
            <span className="phase-name">{phaseLabels[gameState.currentPhase] || gameState.currentPhase.toUpperCase()}</span>
          </div>
          {gameState.activeDeckGroup && (
            <div className="deck-indicator">
              <svg className="deck-indicator-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="2" width="14" height="18" rx="2" opacity="0.4"/>
                <rect x="6" y="4" width="14" height="18" rx="2" opacity="0.7"/>
                <rect x="8" y="6" width="14" height="18" rx="2"/>
              </svg>
              <span className="deck-indicator-text">{gameState.activeDeckGroup}</span>
            </div>
          )}
        </div>
        <div className="turn-indicator">
          <ClanShield clanId={cp?.clanId || ''} size={28} />
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

          {/* Fujin Interactive Overlay - between kami track and map */}
          {gameState.kamiResolutionActive && gameState.kamiResolutionStep === 'interactive' && gameState.fujinMovesRemaining > 0 && (() => {
            const { doFujinDone } = useGameStore.getState();
            return (
              <div className="kami-action-overlay" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span>{t('kami.resolution.fujinMoves', { count: String(gameState.fujinMovesRemaining) })}</span>
                <button className="btn-primary" onClick={doFujinDone} style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                  {t('kami.resolution.fujinDone')}
                </button>
              </div>
            );
          })()}

          {/* Raijin Interactive Overlay - between kami track and map */}
          {gameState.kamiResolutionActive && gameState.kamiResolutionStep === 'interactive' && gameState.raijinPlacementActive && (
            <div className="kami-action-overlay">
              <span>{t('kami.resolution.raijinPlace')}</span>
            </div>
          )}

          {/* Zorro Placement Overlay */}
          {gameState.zorroPlacementActive && (
            <div className="kami-action-overlay">
              <span>Zorro: Coloca Bushi en provincias de batalla ({gameState.zorroPlacementsRemaining} restantes)</span>
              <button className="popup-btn" onClick={doZorroSkipPlacement} style={{ marginLeft: '12px' }}>Terminar</button>
            </div>
          )}

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
                {/* Harvest reward connecting lines */}
                {Object.entries(HARVEST_REWARDS).map(([regionId, harvest]) => {
                  const regionPos = positions[regionId];
                  if (!regionPos) return null;
                  return (
                    <line
                      key={`harvest-line-${regionId}`}
                      x1={harvest.position.x}
                      y1={harvest.position.y}
                      x2={regionPos.x}
                      y2={regionPos.y}
                      stroke={harvest.color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  );
                })}
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
                {Object.entries(HARVEST_REWARDS).map(([regionId, harvest]) => {
                  const allIcons: ReactNode[] = [];
                  harvest.rewards.forEach((reward, i) => {
                    Array.from({ length: reward.count }).forEach((_, j) => {
                      const key = `${i}-${j}`;
                      allIcons.push(
                        <span key={key} className="harvest-reward-item">
                          {reward.type === 'vp' && <VPIcon size={20} color="#fff" />}
                          {reward.type === 'coin' && <CoinIcon size={20} color="#fff" />}
                          {reward.type === 'ronin' && <RoninIcon size={20} color="#fff" />}
                          {reward.type === 'honor' && <HonorIcon size={20} color="#fff" />}
                        </span>
                      );
                    });
                  });
                  const totalIcons = allIcons.length;
                  const layoutClass = totalIcons === 3 ? 'layout-3' : totalIcons === 4 ? 'layout-4' : '';
                  return (
                    <div
                      key={`harvest-${regionId}`}
                      className="harvest-hex"
                      style={{
                        left: `${harvest.position.x}px`,
                        top: `${harvest.position.y}px`,
                        backgroundColor: harvest.color,
                        borderColor: harvest.color,
                      }}
                    >
                      <div className={`harvest-hex-content ${layoutClass}`}>
                        {totalIcons === 3 ? (
                          <>
                            <div className="harvest-row-top">{allIcons[0]}</div>
                            <div className="harvest-row-bottom">{allIcons[1]}{allIcons[2]}</div>
                          </>
                        ) : (
                          allIcons
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="right-panel">
          {(gameState.currentPhase === 'war' && gameState.activeBattles.length > 0) ? <BattlePanel /> : <ActionPanel />}
          <GameLog />
        </div>
      </div>

      {/* Monster Placement Popup */}
      {monsterPlacementPopupVisible && monsterPlacementCard && (
        <div className="monster-placement-popup">
          <div className="monster-placement-popup-content">
            <p>{t('monster.selectPlacement', { name: monsterPlacementCard.name })}</p>
            <button className="monster-placement-btn" onClick={confirmMonsterPlacement}>
              {t('monster.accept')}
            </button>
          </div>
        </div>
      )}

      {/* Komainu Choice Popup */}
      {komainuChoiceVisible && monsterPlacementCard && (
        <div className="monster-placement-popup">
          <div className="monster-placement-popup-content">
            <p>{t('monster.komainuChoice')}</p>
            <div className="monster-placement-popup-buttons">
              <button className="monster-placement-btn" onClick={doKomainuChooseMap}>
                {t('monster.komainuMap')}
              </button>
              <button className="monster-placement-btn secondary" onClick={doKomainuChoosePray}>
                {t('monster.komainuPray')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Komainu Pray Mode Overlay */}
      {komainuPrayMode && (
        <div className="komainu-pray-overlay">
          <span>{t('monster.selectTemple')}</span>
        </div>
      )}

      {/* Region Detail Modal */}
      {selectedRegion && !moveMode && !recruitMode && !betrayMode && !monsterPlacementMode && !buildFortressMode && (
        <RegionDetailModal regionId={selectedRegion} onClose={() => selectRegion(null)} />
      )}

      {/* Rule Violation Toast */}
      {ruleViolationMessage && (
        <div className="rule-violation-toast">
          {ruleViolationMessage}
        </div>
      )}

      {/* Turn Popup (hotseat mandate transitions) */}
      {turnPopupPlayer && gameState.mode === 'hotseat' && !gameState.trainMandateActive && !gameState.kamiResolutionActive && (() => {
        const popupPlayer = gameState.players.find(p => p.id === turnPopupPlayer);
        if (!popupPlayer) return null;
        const clanColor = CLANS.find(c => c.id === popupPlayer.clanId)?.color;
        return (
          <div className="monster-placement-popup">
            <div className="monster-placement-popup-content" style={{ borderColor: clanColor }}>
              <ClanShield clanId={popupPlayer.clanId} size={48} />
              <p style={{ color: clanColor, fontWeight: 'bold', fontSize: '1.3rem' }}>
                {t('game.turn', { name: popupPlayer.name })}
              </p>
              <button className="monster-placement-btn" onClick={dismissTurnPopup}>
                {t('game.turnPopupAccept')}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Harvest Popup */}
      <HarvestPopup />

      {/* Kami Resolution Popup */}
      <KamiResolutionPopup />

    </div>
  );
};
