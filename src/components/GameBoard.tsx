import { useState, useCallback, useRef, useEffect, type ReactNode, type CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCES_DATA, type DeckName } from '../types/game';
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
import { TradeModal } from './TradeModal';
import { TradeOfferPopup } from './TradeOfferPopup';
import { VPIcon, CoinIcon, RoninIcon, HonorIcon, SpringIcon, SummerIcon, AutumnIcon, WinterIcon, BushiIcon, UndoIcon, ShintoIcon, FortressIcon, DaimyoIcon, MonsterIcon, FistIcon } from './Icons';
import { ClanShield } from './ClanShields';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import popupBgImg from '../img/popup_bg.png';

const DECK_NAME_KEYS: Record<DeckName, TranslationKey> = {
  Archway: 'deck.archway',
  Tower: 'deck.tower',
  Teapot: 'deck.teapot',
  Horseman: 'deck.horseman',
  Ship: 'deck.ship',
  Mountain: 'deck.mountain',
};

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
  oshu: { color: '#B0BEC5' /* previous: #9B8EC4 */, position: { x: 1315, y: 380 } },
  kanto: { color: '#E63946', position: { x: 1345, y: 600 } },
  edo: { color: '#2D8B4E', position: { x: 940, y: 540 } },
  kansai: { color: '#F57C20', position: { x: 885, y: 630 } },
  nagato: { color: '#8B5CF6', position: { x: 340, y: 550 } },
  shikoku: { color: '#8B6914', position: { x: 755, y: 850 } },
  kyushu: { color: '#F5D020', position: { x: 160, y: 750 } },
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

/** Precomputed position styles for RegionCard (avoids creating new objects on every render) */
const REGION_CARD_STYLES: Record<string, CSSProperties> = Object.fromEntries(
  Object.entries(positions).map(([id, p]) => [id, { left: `${p.x}px`, top: `${p.y}px` }])
);
const DEFAULT_REGION_STYLE: CSSProperties = { left: '600px', top: '450px' };

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
  const { gameState, localPlayerId, selectedRegion, selectRegion, moveMode, recruitMode, betrayMode, monsterPlacementMode, buildFortressMode, monsterPlacementPopupVisible, monsterPlacementCard, komainuChoiceVisible, komainuPrayMode, confirmMonsterPlacement, doKomainuChooseMap, doKomainuChoosePray, monsterNoPlacementPopupVisible, dismissMonsterNoPlacement, turnPopupPlayer, dismissTurnPopup, ruleViolationMessage, setRuleViolationMessage, doZorroSkipPlacement, kamiPhasePopupVisible, dismissKamiPhasePopup, warPhasePopupVisible, warPhaseUpgradeSummary, dismissWarPhasePopup, setMoveFrom, setSelectedFigures, doRaijinConfirm, doRaijinUndo, biddingMapPeek, setBiddingMapPeek } = useGameStore();
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
            {gameState.currentSeason === 'spring' && <SpringIcon size={24} color="#1a1a2e" />}
            {gameState.currentSeason === 'summer' && <SummerIcon size={24} color="#1a1a2e" />}
            {gameState.currentSeason === 'autumn' && <AutumnIcon size={24} color="#1a1a2e" />}
            {gameState.currentSeason === 'winter' && <WinterIcon size={24} color="#1a1a2e" />}
            <span className="season-name">{t(`season.${gameState.currentSeason}` as TranslationKey)}</span>
            <span className="phase-name">{phaseLabels[gameState.currentPhase] || gameState.currentPhase.toUpperCase()}</span>
          </div>
          {gameState.activeDeckGroup && (
            <div className="deck-indicator">
              <svg className="deck-indicator-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="2" width="14" height="18" rx="2" opacity="0.4"/>
                <rect x="6" y="4" width="14" height="18" rx="2" opacity="0.7"/>
                <rect x="8" y="6" width="14" height="18" rx="2"/>
              </svg>
              <span className="deck-indicator-text">{t(DECK_NAME_KEYS[gameState.activeDeckGroup] || gameState.activeDeckGroup as any)}</span>
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
        <div className="legend-button-wrapper" style={{ left: '21rem' }}>
          <button className="legend-btn">?</button>
          <div className="legend-tooltip">
            <div className="legend-tooltip-row"><BushiIcon size={20} color="#fff" /><span>{t('legend.bushi')}</span></div>
            <div className="legend-tooltip-row"><ShintoIcon size={20} color="#fff" /><span>{t('legend.shinto')}</span></div>
            <div className="legend-tooltip-row"><FortressIcon size={20} color="#fff" /><span>{t('legend.fortress')}</span></div>
            <div className="legend-tooltip-row"><DaimyoIcon size={20} color="#fff" /><span>{t('legend.daimyo')}</span></div>
            <div className="legend-tooltip-row"><MonsterIcon size={20} color="#fff" /><span>{t('legend.monster')}</span></div>
            <div className="legend-tooltip-row"><CoinIcon size={20} color="#fff" /><span>{t('legend.coin')}</span></div>
            <div className="legend-tooltip-row"><VPIcon size={20} color="#fff" /><span>{t('legend.vp')}</span></div>
            <div className="legend-tooltip-row"><HonorIcon size={20} color="#fff" /><span>{t('legend.honor')}</span></div>
            <div className="legend-tooltip-row"><RoninIcon size={20} color="#fff" /><span>{t('legend.ronin')}</span></div>
            <div className="legend-tooltip-row"><FistIcon size={20} color="#fff" /><span>{t('legend.force')}</span></div>
            <div className="legend-tooltip-row"><SpringIcon size={20} color="#FFB7C5" /><span style={{ color: '#FFB7C5' }}>{t('legend.spring')}</span></div>
            <div className="legend-tooltip-row"><SummerIcon size={20} color="#FF6B35" /><span style={{ color: '#FF6B35' }}>{t('legend.summer')}</span></div>
            <div className="legend-tooltip-row"><AutumnIcon size={20} color="#D4A574" /><span style={{ color: '#D4A574' }}>{t('legend.autumn')}</span></div>
            <div className="legend-tooltip-row"><WinterIcon size={20} color="#A8C8E8" /><span style={{ color: '#A8C8E8' }}>{t('legend.winter')}</span></div>
          </div>
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
          {gameState.kamiResolutionActive && gameState.kamiResolutionStep === 'interactive' && (() => {
            const currentTemple = gameState.kamiResolutionTemples?.[gameState.kamiResolutionIndex ?? 0];
            if (!currentTemple || currentTemple.kamiType !== 'fujin') return null;
            if (gameState.fujinMovesRemaining < 0) return null;
            const { doFujinDone, doFujinUndo, fujinPreMoveState } = useGameStore.getState();
            const movesRemaining = gameState.fujinMovesRemaining;
            const winnerPlayer = currentTemple.winnerId ? gameState.players.find(p => p.id === currentTemple.winnerId) : null;
            const winnerClan = winnerPlayer ? CLANS.find(c => c.id === winnerPlayer.clanId) : null;
            const clanColor = winnerClan?.color || '#fff';
            return (
              <div className="kami-action-overlay" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {movesRemaining > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                    {winnerClan && <ClanShield clanId={winnerClan.id} size={20} />}
                    <span style={{ color: clanColor, fontWeight: 'bold' }}>{winnerPlayer?.name || '?'}</span>
                    {' tienes ' + movesRemaining + ' movimientos'}
                  </span>
                )}
                {fujinPreMoveState && (
                  <button className="btn-secondary" onClick={doFujinUndo} style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UndoIcon size={18} color="currentColor" />
                  </button>
                )}
                {movesRemaining > 0 && (
                  <button className="btn-primary" onClick={() => { setMoveFrom(null); setSelectedFigures([]); }} style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                    {t('kami.resolution.fujinCancel')}
                  </button>
                )}
                <button className="btn-primary" onClick={doFujinDone} style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                  {movesRemaining > 0 ? t('kami.resolution.fujinDone') : t('kami.resolution.fujinConfirm')}
                </button>
              </div>
            );
          })()}

          {/* Raijin Interactive Overlay - between kami track and map */}
          {gameState.kamiResolutionActive && gameState.kamiResolutionStep === 'interactive' && (gameState.raijinPlacementActive || gameState.raijinPlacementDone) && (() => {
            const currentTemple = gameState.kamiResolutionTemples?.[gameState.kamiResolutionIndex ?? 0];
            const winnerPlayer = currentTemple?.winnerId ? gameState.players.find(p => p.id === currentTemple.winnerId) : null;
            const winnerClan = winnerPlayer ? CLANS.find(c => c.id === winnerPlayer.clanId) : null;
            const clanColor = winnerClan?.color || '#fff';
            return (
              <div className="kami-action-overlay">
                {gameState.raijinPlacementActive && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                    {winnerClan && <ClanShield clanId={winnerClan.id} size={20} />}
                    <span style={{ color: clanColor, fontWeight: 'bold' }}>{winnerPlayer?.name || '?'}</span>
                    {' coloca un '}
                    <BushiIcon size={22} color={clanColor} />
                    {' Bushi en cualquier provincia'}
                  </span>
                )}
                {gameState.raijinPlacementDone && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                    {winnerClan && <ClanShield clanId={winnerClan.id} size={20} />}
                    <span style={{ color: clanColor, fontWeight: 'bold' }}>{winnerPlayer?.name || '?'}</span>
                    <BushiIcon size={18} color={clanColor} />
                    <span style={{ color: '#c8a951', fontWeight: 'bold' }}>{' Bushi colocado'}</span>
                    <button className="btn-secondary" onClick={doRaijinUndo} style={{ marginLeft: '8px', width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UndoIcon size={18} color="currentColor" />
                    </button>
                    <button className="btn-primary" onClick={doRaijinConfirm} style={{ marginLeft: '4px', fontSize: '0.85rem', padding: '4px 12px' }}>
                      Terminar
                    </button>
                  </span>
                )}
              </div>
            );
          })()}

          {/* Zorro Placement Overlay */}
          {gameState.zorroPlacementActive && (
            <div className="kami-action-overlay">
              <span>Zorro: Coloca Bushi en provincias de batalla ({gameState.zorroPlacementsRemaining} restantes)</span>
              <button className="btn-primary" onClick={doZorroSkipPlacement} style={{ marginLeft: '12px', fontSize: '0.85rem', padding: '4px 12px' }}>Terminar</button>
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
            {ruleViolationMessage && (
              <div className="rule-violation-toast">
                {ruleViolationMessage}
              </div>
            )}
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
                    <g key={`sea-${route.from}-${route.to}`}>
                      <path
                        d={route.path}
                        fill="none"
                        stroke="rgba(255,255,255,0.93)"
                        strokeWidth="8"
                        strokeDasharray="10,12"
                        strokeLinecap="round"
                      />
                      <path
                        d={route.path}
                        fill="none"
                        stroke="rgba(80,180,240,0.93)"
                        strokeWidth="5"
                        strokeDasharray="10,12"
                        strokeLinecap="round"
                      />
                    </g>
                  ));
                })()}
                {/* Harvest reward connecting lines */}
                {Object.entries(HARVEST_REWARDS).map(([regionId, harvest]) => {
                  const regionPos = positions[regionId];
                  if (!regionPos) return null;
                  const midX = (harvest.position.x + regionPos.x) / 2;
                  const midY = (harvest.position.y + regionPos.y) / 2;
                  return (
                    <line
                      key={`harvest-line-${regionId}`}
                      x1={harvest.position.x}
                      y1={harvest.position.y}
                      x2={midX}
                      y2={midY}
                      stroke="#ffffff"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>
              <div className="regions-overlay">
                {PROVINCES_DATA.map(r => {
                  return (
                    <RegionCard
                      key={r.id}
                      regionId={r.id}
                      style={REGION_CARD_STYLES[r.id] || DEFAULT_REGION_STYLE}
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
                          {reward.type === 'vp' && <VPIcon size={27} color="#fff" />}
                          {reward.type === 'coin' && <CoinIcon size={27} color="#fff" />}
                          {reward.type === 'ronin' && <RoninIcon size={27} color="#fff" />}
                          {reward.type === 'honor' && <HonorIcon size={27} color="#fff" />}
                        </span>
                      );
                    });
                  });
                  const totalIcons = allIcons.length;
                  const layoutClass = totalIcons === 3 ? 'layout-3' : totalIcons === 4 ? 'layout-4' : '';
                  return (
                    <div
                      key={`harvest-${regionId}`}
                      className="harvest-hex-wrapper"
                      style={{
                        left: `${harvest.position.x}px`,
                        top: `${harvest.position.y}px`,
                      }}
                    >
                      <div
                        className="harvest-hex"
                        style={{
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

      {/* Map Peek Return Button - shown when player hides bidding overlay to view map */}
      {biddingMapPeek && gameState.currentPhase === 'war' && (
        <button
          className="bidding-map-peek-return-btn"
          onClick={() => setBiddingMapPeek(false)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {t('battle.returnToBids')}
        </button>
      )}

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

      {/* Monster No Placement Popup (Luna - no valid province) */}
      {monsterNoPlacementPopupVisible && monsterPlacementCard && (
        <div className="monster-placement-popup">
          <div className="monster-placement-popup-content">
            <p>{t('monster.noPlacementLine1', { name: monsterPlacementCard.name })}</p>
            <p>{t('monster.noPlacementLine2')}</p>
            <button className="monster-placement-btn" onClick={dismissMonsterNoPlacement}>
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

      {/* Turn Popup (hotseat mandate transitions) */}
      {turnPopupPlayer && gameState.mode === 'hotseat' && !gameState.trainMandateActive && !gameState.kamiResolutionActive && gameState.currentPhase !== 'war' && (() => {
        const popupPlayer = gameState.players.find(p => p.id === turnPopupPlayer);
        if (!popupPlayer) return null;
        const clanColor = CLANS.find(c => c.id === popupPlayer.clanId)?.color;
        return (
          <div className="monster-placement-popup" style={{ zIndex: 1200 }}>
            <div className="monster-placement-popup-content" style={{
              borderColor: clanColor,
              backgroundImage: `url(${popupBgImg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              aspectRatio: '3/2',
              width: '500px',
              maxWidth: '90vw',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ marginTop: '5px', filter: 'drop-shadow(rgb(-3, 1, 20) 1px -1px 2px)' }}>
                <ClanShield clanId={popupPlayer.clanId} size={173} />
              </div>
              <p style={{ color: clanColor, fontWeight: 'bold', fontSize: '1.3rem', textShadow: '-1px -1px 0 #333, 1px -1px 0 #333, -1px 1px 0 #333, 1px 1px 0 #333', marginTop: '-20px' }}>
                {t('game.turn', { name: popupPlayer.name })}
              </p>
              <button className="monster-placement-btn" onClick={dismissTurnPopup} style={{ fontSize: '1.02rem', padding: '0.68rem 2.12rem', marginTop: '-11px' }}>
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

      {/* Kami Phase Start Popup */}
      {kamiPhasePopupVisible && (
        <div className="harvest-popup-backdrop">
          <div className="harvest-popup" style={{ borderColor: '#9B59B6', maxWidth: '420px', minWidth: '320px', background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #1a0a2e 100%)', boxShadow: '0 0 20px rgba(155, 89, 182, 0.4), inset 0 0 30px rgba(155, 89, 182, 0.05)', borderWidth: '2px' }}>
            <h3 style={{ color: '#9B59B6', textAlign: 'center', margin: '0 0 12px 0', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M4 6h16M5 6c0-1 2-3 7-3s7 2 7 3" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
                <path d="M6 6v16M18 6v16" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
                <path d="M6 11h12" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
              </svg>
              <span>{t('kami.phaseStart.title')}</span>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M4 6h16M5 6c0-1 2-3 7-3s7 2 7 3" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
                <path d="M6 6v16M18 6v16" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
                <path d="M6 11h12" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
              </svg>
            </h3>
            <p style={{ textAlign: 'center', fontSize: '0.9rem', opacity: 0.85, marginBottom: '16px' }}>
              {(() => {
                const desc = t('kami.phaseStart.description');
                const boldPhrases = ['left to right', 'izquierda a derecha'];
                for (const phrase of boldPhrases) {
                  const idx = desc.indexOf(phrase);
                  if (idx !== -1) {
                    return (
                      <>
                        {desc.slice(0, idx)}
                        <strong style={{ color: '#D4AF37' }}>{phrase}</strong>
                        {desc.slice(idx + phrase.length)}
                      </>
                    );
                  }
                }
                return desc;
              })()}
            </p>
            <div style={{ textAlign: 'center' }}>
              <button className="btn-primary harvest-popup-btn" onClick={dismissKamiPhasePopup} style={{ borderColor: '#9B59B6' }}>
                {t('kami.phaseStart.accept')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* War Phase Start Popup */}
      {warPhasePopupVisible && (
        <div className="harvest-popup-backdrop">
          <div className="harvest-popup" style={{ borderColor: '#DC143C', maxWidth: '450px', minWidth: '320px' }}>
            <h3 style={{ color: '#DC143C', textAlign: 'center', margin: '0 0 12px 0', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M4 4l16 16" stroke="var(--accent-red)" strokeWidth="2" strokeLinecap="round"/>
                <path d="M20 4l-16 16" stroke="var(--accent-red)" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="8" cy="8" r="2" stroke="var(--accent-red)" strokeWidth="1" fill="none" opacity="0.7"/>
                <circle cx="16" cy="8" r="2" stroke="var(--accent-red)" strokeWidth="1" fill="none" opacity="0.7"/>
                <path d="M3 3l1.5 0.5L4 4" fill="var(--accent-red)" opacity="0.9"/>
                <path d="M21 3l-1.5 0.5L20 4" fill="var(--accent-red)" opacity="0.9"/>
                <circle cx="12" cy="12" r="1.5" fill="var(--accent-red)" opacity="0.6"/>
                <path d="M12 9v-1.5M12 15v1.5M9 12h-1.5M15 12h1.5" stroke="var(--accent-red)" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
              </svg>
              <span>{t('war.phaseStart.title')}</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M4 4l16 16" stroke="var(--accent-red)" strokeWidth="2" strokeLinecap="round"/>
                <path d="M20 4l-16 16" stroke="var(--accent-red)" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="8" cy="8" r="2" stroke="var(--accent-red)" strokeWidth="1" fill="none" opacity="0.7"/>
                <circle cx="16" cy="8" r="2" stroke="var(--accent-red)" strokeWidth="1" fill="none" opacity="0.7"/>
                <path d="M3 3l1.5 0.5L4 4" fill="var(--accent-red)" opacity="0.9"/>
                <path d="M21 3l-1.5 0.5L20 4" fill="var(--accent-red)" opacity="0.9"/>
                <circle cx="12" cy="12" r="1.5" fill="var(--accent-red)" opacity="0.6"/>
                <path d="M12 9v-1.5M12 15v1.5M9 12h-1.5M15 12h1.5" stroke="var(--accent-red)" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
              </svg>
            </h3>
            {warPhaseUpgradeSummary.length > 0 ? (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '8px', textAlign: 'center' }}>
                  {t('war.phaseStart.bonuses')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {warPhaseUpgradeSummary.map((entry, idx) => {
                    const clan = CLANS.find(c => c.id === entry.clanId);
                    return (
                      <div key={idx} style={{ padding: '6px 10px', borderRadius: '6px', background: `${clan?.color || '#666'}22`, border: `1px solid ${clan?.color || '#666'}44` }}>
                        {entry.bonuses.map((b, bi) => (
                          <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }}>
                            <ClanShield clanId={entry.clanId} size={18} />
                            <span style={{ color: clan?.color, fontWeight: 'bold', fontSize: '0.85rem' }}>{entry.playerName}</span>
                            <span style={{ fontSize: '0.85rem', opacity: 0.9, fontStyle: 'italic' }}>{b.cardName}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.85rem', marginLeft: 'auto' }}>
                              {b.resource === 'coins' && <CoinIcon size={14} color="#f1c40f" />}
                              {b.resource === 'ronin' && <RoninIcon size={14} color="#e74c3c" />}
                              {b.resource === 'vp' && <VPIcon size={14} color="#9B59B6" />}
                              <span style={{ fontWeight: 'bold' }}>{b.amount}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p style={{ textAlign: 'center', fontSize: '0.9rem', opacity: 0.7, marginBottom: '16px', fontStyle: 'italic' }}>
                {t('war.phaseStart.noBonuses')}
              </p>
            )}
            {/* Clan resources summary: coins and ronin per player */}
            {gameState && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {gameState.players.map((player) => {
                    const clan = CLANS.find(c => c.id === player.clanId);
                    const displayRonin = player.clanId === 'koi' ? 0 : player.ronin;
                    return (
                      <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderRadius: '4px', background: `${clan?.color || '#666'}15` }}>
                        <ClanShield clanId={player.clanId} size={18} />
                        <span style={{ color: clan?.color, fontWeight: 'bold', fontSize: '0.85rem', flex: 1 }}>{player.name}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.85rem' }}>
                          <CoinIcon size={16} color="#f1c40f" /> {player.coins}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.85rem' }}>
                          <RoninIcon size={16} color="#e74c3c" /> {displayRonin}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <button className="btn-primary harvest-popup-btn" onClick={dismissWarPhasePopup} style={{ borderColor: '#DC143C' }}>
                {t('war.phaseStart.accept')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trade Modal */}
      <TradeModal />

      {/* Trade Offer Popup */}
      <TradeOfferPopup />

    </div>
  );
};
