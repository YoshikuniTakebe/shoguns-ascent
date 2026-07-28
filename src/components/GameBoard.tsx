import { useState, useCallback, useRef, useEffect, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCES_DATA, PROVINCE_COLORS, KAMI_DATA, SEASON_CARDS_DATA, type DeckName } from '../types/game';
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
import { RyujinWaitingPopup } from './RyujinWaitingPopup';
import { KamiSummaryPopup } from './KamiSummaryPopup';
import { TradeModal } from './TradeModal';
import { TradeOfferPopup } from './TradeOfferPopup';
import { GenerosityPopup } from './GenerosityPopup';
import { DaikaijuOceanMarker } from './DaikaijuOceanMarker';
import { NureOnnaPopup } from './NureOnnaPopup';
import { RuleEventNoticePopup } from './RuleEventNoticePopup';
import { BattleCardDecisionPopup } from './BattleCardDecisionPopup';
import { BattleMercyDecisionPopup } from './BattleMercyDecisionPopup';
import { NinjaDecisionPopup } from './NinjaDecisionPopup';
import { MonkeyDecisionPopup } from './MonkeyDecisionPopup';
import { SnakeDecisionPopup } from './SnakeDecisionPopup';
import { BenevolencePopup } from './BenevolencePopup';
import { SpringPlacementPopup } from './SpringPlacementPopup';
import { VassalDecisionPopup } from './VassalDecisionPopup';
import { SerpentChargePopup } from './SerpentChargePopup';
import { MonsterEnterDecisionPopup } from './MonsterEnterDecisionPopup';
import { MarshalSerpentWarningPopup } from './MarshalSerpentWarningPopup';
import { VPIcon, CoinIcon, RoninIcon, HonorIcon, SpringIcon, SummerIcon, AutumnIcon, WinterIcon, BushiIcon, UndoIcon, ShintoIcon, FortressIcon, DaimyoIcon, MonsterIcon, FistIcon, ToriiGateIcon } from './Icons';
import { ClanShield, WarSeal } from './ClanShields';
import { CardStackIcon, DeckSetIcon } from './DeckSetIcons';
import { getMonsterFigureImage, TEMPLATE_FIGURE_IMG } from '../utils/figureImages';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import popupBgImg from '../img/popup_bg.png';
import { API_BASE } from '../config';
import { renderCardEffect } from '../utils/renderCardEffect';
import { getCardEffectKey } from '../utils/cardTranslations';

const DECK_NAME_KEYS: Record<DeckName, TranslationKey> = {
  Archway: 'deck.archway',
  Tower: 'deck.tower',
  Teapot: 'deck.teapot',
  Horseman: 'deck.horseman',
  Ship: 'deck.ship',
  Mountain: 'deck.mountain',
};

const KAMI_EXPANSION_EFFECT_KEYS: Record<string, TranslationKey> = {
  amaterasu: 'kami.amaterasu.expansionEffect',
  fujin: 'kami.fujin.expansionEffect',
  hachiman: 'kami.hachiman.expansionEffect',
  raijin: 'kami.raijin.expansionEffect',
  ryujin: 'kami.ryujin.expansionEffect',
  susanoo: 'kami.susanoo.expansionEffect',
  tsukuyomi: 'kami.tsukuyomi.expansionEffect',
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
  PROVINCES_DATA.filter(p => p.id !== 'ocean').map((province) => {
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
  const { gameState, localPlayerId, authUser, authToken, selectedRegion, selectRegion, moveMode, recruitMode, betrayMode, monsterPlacementMode, buildFortressMode, buildFukurokujuMode, monsterPlacementPopupVisible, monsterPlacementCard, komainuChoiceVisible, komainuPrayMode, confirmMonsterPlacement, doKomainuChooseMap, doKomainuChoosePray, monsterNoPlacementPopupVisible, dismissMonsterNoPlacement, turnPopupPlayer, dismissTurnPopup, ruleViolationMessage, setRuleViolationMessage, doZorroSkipPlacement, doWarStartReset, doWarStartToggleMercy, doWarStartConfirm, doWarStartSkip, kamiPhasePopupVisible, dismissKamiPhasePopup, warPhasePopupVisible, warPhaseUpgradeSummary, dismissWarPhasePopup, warSummaryVisible, dismissWarSummaryPopup, setMoveFrom, setSelectedFigures, doRaijinConfirm, doRaijinUndo, biddingMapPeek, setBiddingMapPeek, doTeaReady, doHostageReturnAccepted, rejoinWaitingVisible, rejoinPlayerStatuses, daikaijuPlacementMode, startDaikaijuPlacement, doDaikaijuUndoPlacement, doDaikaijuConfirmPlacement, doDaikaijuSummaryReady, doKamiUndoProvince, doKamiConfirmProvince } = useGameStore();
  const t = useT();

  const [isDragging, setIsDragging] = useState(false);
  const [kamiPlacementMapMode, setKamiPlacementMapMode] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [mapViewReady, setMapViewReady] = useState(false);
  const panRef = useRef({ x: 0, y: 0 });
  const restoredPanRef = useRef<{ x: number; y: number } | null>(null);
  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startY: 0, startTranslateX: 0, startTranslateY: 0, didDrag: false, containerWidth: 0, containerHeight: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const mapViewGameId = gameState?.id || null;
  const mapViewUserId = authUser?.id || localPlayerId || 'local';
  const mapViewStorageKey = mapViewGameId
    ? `shoguns-ascent-map-view:${mapViewUserId}:${mapViewGameId}`
    : null;

  useEffect(() => {
    if (!gameState?.kamiPlacementActive) setKamiPlacementMapMode(false);
  }, [gameState?.kamiPlacementActive]);

  /** Apply the current pan position directly to the DOM */
  const applyPan = useCallback(() => {
    if (mapCanvasRef.current) {
      mapCanvasRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    restoredPanRef.current = null;
    setMapViewReady(false);
    setInitialized(false);

    if (!mapViewStorageKey || !mapViewGameId) {
      setMapViewReady(true);
      return () => { cancelled = true; };
    }

    try {
      const stored = localStorage.getItem(mapViewStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { x?: unknown; y?: unknown };
        if (typeof parsed.x === 'number' && Number.isFinite(parsed.x) && typeof parsed.y === 'number' && Number.isFinite(parsed.y)) {
          restoredPanRef.current = { x: parsed.x, y: parsed.y };
        }
      }
    } catch {
      // A malformed local preference should fall back to the normal initial position.
    }

    if (!authToken || !authUser) {
      setMapViewReady(true);
      return () => { cancelled = true; };
    }

    fetch(`${API_BASE}/api/games/${mapViewGameId}/map-view`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ view?: { x: number; y: number } | null }>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.view && Number.isFinite(data.view.x) && Number.isFinite(data.view.y)) {
          restoredPanRef.current = data.view;
          localStorage.setItem(mapViewStorageKey, JSON.stringify(data.view));
        }
      })
      .catch(() => {
        // The local copy remains a valid fallback while offline.
      })
      .finally(() => {
        if (!cancelled) setMapViewReady(true);
      });

    return () => { cancelled = true; };
  }, [authToken, authUser, mapViewGameId, mapViewStorageKey]);

  // Apply a saved view, or preserve the existing initial positioning for a new game.
  useEffect(() => {
    if (initialized || !mapViewReady) return;
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw === 0 || ch === 0) return;
    const { x, y } = restoredPanRef.current || computeInitialPan(cw, ch);
    const clamped = clampPan(x, y, cw, ch);
    panRef.current = { x: clamped.x, y: clamped.y };
    applyPan();
    setInitialized(true);
  }, [initialized, mapViewReady, applyPan]);

  const persistMapView = useCallback(() => {
    if (!mapViewStorageKey || !mapViewGameId || !initialized) return;
    const view = { x: panRef.current.x, y: panRef.current.y };
    try {
      localStorage.setItem(mapViewStorageKey, JSON.stringify(view));
    } catch {
      // Server persistence can still succeed when local storage is unavailable.
    }
    if (authToken && authUser) {
      fetch(`${API_BASE}/api/games/${mapViewGameId}/map-view`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(view),
      }).catch(() => {
        // The local copy will be retried after the next game action.
      });
    }
  }, [authToken, authUser, initialized, mapViewGameId, mapViewStorageKey]);

  useEffect(() => {
    if (!initialized) return;
    const timer = window.setTimeout(persistMapView, 200);
    return () => window.clearTimeout(timer);
  }, [gameState, initialized, persistMapView]);

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
      startTranslateX: panRef.current.x,
      startTranslateY: panRef.current.y,
      didDrag: false,
      containerWidth: cw,
      containerHeight: ch,
    };
    setIsDragging(true);
    // Capture pointer so moves/up fire on document even if pointer leaves the element
    (e.target as Element).setPointerCapture(e.pointerId);
  }, []);

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

    panRef.current = { x: newX, y: newY };
    applyPan();
  }, [isDragging, applyPan]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    const target = e.target as Element;
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    persistMapView();
  }, [persistMapView]);

  if (!gameState) return <div className="loading">Loading...</div>;
  if (gameState.gameOver) return <GameOverScreen />;

  const cp = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = gameState.mode === 'hotseat' || cp?.id === localPlayerId;
  const activeRuleNotice = gameState.pendingRuleNotices?.[0];
  const shouldShowRuleNotice = Boolean(
    activeRuleNotice
    && (!gameState.pendingBenevolence || activeRuleNotice.type === 'benevolence')
  );
  const hasBlockingRuleFlow = Boolean(
    gameState.pendingRuleNotices?.length
    || gameState.pendingMarshalSerpentWarningPlayerId
    || gameState.generosityPending
    || gameState.pendingSerpentCharge
    || gameState.pendingBattleCardDecision
    || gameState.pendingBattleMercyDecision
    || gameState.pendingNureOnnaDecision
    || gameState.pendingMonsterEnterDecision
    || gameState.pendingSpringPlacement
    || gameState.pendingNinjaDecision
    || gameState.pendingMonkeyDecision
    || gameState.pendingSnakeDecision
    || gameState.pendingBenevolence
    || gameState.pendingVassalDecision
  );

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
              <CardStackIcon size={14} />
              <DeckSetIcon setName={gameState.activeDeckGroup} size={16} />
              <span className="deck-indicator-text">{t(DECK_NAME_KEYS[gameState.activeDeckGroup] || gameState.activeDeckGroup as any)}</span>
            </div>
          )}
          {gameState.mode === 'online' && (() => {
            const localPlayer = gameState.players.find(p => p.id === localPlayerId);
            if (!localPlayer) return null;
            const localClan = CLANS.find(c => c.id === localPlayer.clanId);
            return (
              <div
                className="local-player-indicator"
                style={{
                  color: localClan?.color,
                  boxShadow: `inset 0 0 0 2px ${localClan?.color || 'transparent'}`,
                }}
              >
                <ClanShield clanId={localPlayer.clanId} size={22} />
                <span className="local-player-name">{localPlayer.name}</span>
              </div>
            );
          })()}
        </div>
        <div className="turn-indicator">
          {(() => {
            if (gameState.kamiResolutionActive || gameState.kamiSummaryVisible || gameState.kamiPhasePopupPending) {
              const kamiPhaseNumber = Math.ceil((gameState.politicsMandateCount - 2) / 2);
              return (
                <span className="current-player-name" style={{ color: '#9B59B6' }}>
                  FASE DE KAMI {kamiPhaseNumber}
                </span>
              );
            }
            if (gameState.warStartActionsComplete === false) {
              const action = gameState.warStartActions?.[gameState.warStartActionIndex || 0];
              const actionPlayer = gameState.players.find(p => p.id === action?.playerId);
              const actionClan = actionPlayer ? CLANS.find(c => c.id === actionPlayer.clanId) : null;
              const isActionPlayer = gameState.mode === 'hotseat' || localPlayerId === action?.playerId;
              return (
                <>
                  <ClanShield clanId={actionClan?.id || ''} size={56} />
                  <span className="current-player-name" style={{ color: actionClan?.color }}>
                    {t('game.turn', { name: actionPlayer?.name || '' })}
                  </span>
                  {!isActionPlayer && gameState.mode === 'online' && <span className="waiting-label">[ESPERANDO]</span>}
                </>
              );
            }
            // During simultaneous phases in online mode, don't show individual player turn
            if (gameState.mode === 'online' && (
              gameState.currentPhase === 'seasonSetup' ||
              gameState.currentPhase === 'tea' ||
              (gameState.currentPhase === 'cleanup' && gameState.cleanupTeaCeremonyReady)
            )) {
              return (
                <span className="current-player-name">
                  {t(gameState.currentPhase === 'cleanup' ? 'phase.tea' as TranslationKey : `phase.${gameState.currentPhase}` as TranslationKey)}
                </span>
              );
            }
            // During war phase, non-participating players see battle in progress
            if (gameState.mode === 'online' && gameState.currentPhase === 'war') {
              const currentBattle = gameState.activeBattles?.find(b => !b.resolved);
              if (currentBattle && currentBattle.participants && localPlayerId && !currentBattle.participants.includes(localPlayerId)) {
                const battleIndex = gameState.activeBattles.findIndex(b => !b.resolved);
                return (
                  <span className="current-player-name">
                    {t('battle.inProgress', { number: battleIndex + 1 })} <span className="waiting-label">{t('game.waiting')}</span>
                  </span>
                );
              }
            }
            return (
              <>
                <ClanShield clanId={cp?.clanId || ''} size={56} />
                <span className="current-player-name" style={{ color: CLANS.find(c => c.id === cp?.clanId)?.color }}>
                  {t('game.turn', { name: cp?.name || '' })}
                </span>
                {gameState.mode === 'hotseat' && <span className="hotseat-label">{t('game.hotseat')}</span>}
                {!isMyTurn && gameState.mode === 'online' && <span className="waiting-label">{t('game.waiting')}</span>}
              </>
            );
          })()}
        </div>
        <div className="game-header-right">
          <div className="legend-button-wrapper">
            <span className="game-name-header">{gameState.gameName}</span>
            <button className="legend-btn">?</button>
            <div className="legend-tooltip">
            <div className="legend-tooltip-row"><BushiIcon size={20} color="#fff" /><span>{t('legend.bushi')}</span></div>
            <div className="legend-tooltip-row"><ShintoIcon size={20} color="#fff" /><span>{t('legend.shinto')}</span></div>
            <div className="legend-tooltip-row"><FortressIcon size={20} color="#fff" /><span>{t('legend.fortress')}</span></div>
            <div className="legend-tooltip-row"><DaimyoIcon size={20} color="#fff" /><span>{t('legend.daimyo')}</span></div>
            <div className="legend-tooltip-row"><MonsterIcon size={20} color="#fff" /><span>{t('legend.monster')}</span></div>
            <div className="legend-tooltip-row"><span className="legend-kami-icon">神</span><span>{t('legend.kami')}</span></div>
            <div className="legend-tooltip-row"><CoinIcon size={20} color="#c8a951" /><span style={{ color: '#c8a951' }}>{t('legend.coin')}</span></div>
            <div className="legend-tooltip-row"><VPIcon size={20} color="#e94560" /><span style={{ color: '#e94560' }}>{t('legend.vp')}</span></div>
            <div className="legend-tooltip-row"><HonorIcon size={20} color="#9b59b6" /><span style={{ color: '#9b59b6' }}>{t('legend.honor')}</span></div>
            <div className="legend-tooltip-row"><RoninIcon size={20} color="#fff" /><span>{t('legend.ronin')}</span></div>
            <div className="legend-tooltip-row"><FistIcon size={20} color="#3498db" /><span style={{ color: '#3498db' }}>{t('legend.force')}</span></div>
            <div className="legend-tooltip-row"><SpringIcon size={20} color="#FFB7C5" /><span style={{ color: '#FFB7C5' }}>{t('legend.spring')}</span></div>
            <div className="legend-tooltip-row"><SummerIcon size={20} color="#FF6B35" /><span style={{ color: '#FF6B35' }}>{t('legend.summer')}</span></div>
            <div className="legend-tooltip-row"><AutumnIcon size={20} color="#D4A574" /><span style={{ color: '#D4A574' }}>{t('legend.autumn')}</span></div>
            <div className="legend-tooltip-row"><WinterIcon size={20} color="#A8C8E8" /><span style={{ color: '#A8C8E8' }}>{t('legend.winter')}</span></div>
            </div>
          </div>
          <div className="mandate-counter">
            {t('game.round')} {gameState.round}/{gameState.maxRounds}
          </div>
          <button className="exit-game-btn" onClick={() => useGameStore.getState().exitGame()} title={t('game.exit' as TranslationKey)}>
            {t('game.exit' as TranslationKey)}
          </button>
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
          {!biddingMapPeek && gameState.kamiResolutionActive && gameState.kamiResolutionStep === 'interactive' && (() => {
            const currentTemple = gameState.kamiResolutionTemples?.[gameState.kamiResolutionIndex ?? 0];
            if (!currentTemple || currentTemple.kamiType !== 'fujin') return null;
            if (gameState.fujinMovesRemaining < 0) return null;
            const { doFujinDone, doFujinUndo, fujinPreMoveState } = useGameStore.getState();
            const movesRemaining = gameState.fujinMovesRemaining;
            const winnerPlayer = currentTemple.winnerId ? gameState.players.find(p => p.id === currentTemple.winnerId) : null;
            const winnerClan = winnerPlayer ? CLANS.find(c => c.id === winnerPlayer.clanId) : null;
            const clanColor = winnerClan?.color || '#fff';
            const isOnline = gameState.mode === 'online';
            const isMyFujinTurn = !isOnline || localPlayerId === currentTemple.winnerId;
            return (
              <div className="kami-action-overlay" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {isMyFujinTurn ? (
                  <>
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
                  </>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                    {winnerClan && <ClanShield clanId={winnerClan.id} size={20} />}
                    <span style={{ color: clanColor, fontWeight: 'bold' }}>{winnerPlayer?.name || '?'}</span>
                    {' Movimientos [ESPERANDO]'}
                  </span>
                )}
              </div>
            );
          })()}

          {/* Raijin Interactive Overlay - between kami track and map */}
          {!biddingMapPeek && gameState.kamiResolutionActive && gameState.kamiResolutionStep === 'interactive' && (gameState.raijinPlacementActive || gameState.raijinPlacementDone) && (() => {
            const currentTemple = gameState.kamiResolutionTemples?.[gameState.kamiResolutionIndex ?? 0];
            const winnerPlayer = currentTemple?.winnerId ? gameState.players.find(p => p.id === currentTemple.winnerId) : null;
            const winnerClan = winnerPlayer ? CLANS.find(c => c.id === winnerPlayer.clanId) : null;
            const clanColor = winnerClan?.color || '#fff';
            const isOnline = gameState.mode === 'online';
            const isMyRaijinTurn = !isOnline || localPlayerId === currentTemple?.winnerId;
            return (
              <div className="kami-action-overlay">
                {gameState.raijinPlacementActive && (
                  isMyRaijinTurn ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                      {winnerClan && <ClanShield clanId={winnerClan.id} size={20} />}
                      <span style={{ color: clanColor, fontWeight: 'bold' }}>{winnerPlayer?.name || '?'}</span>
                      {t('game.raijinPlaceBefore')}{' '}
                      <BushiIcon size={22} color={clanColor} />
                      {' '}{t('game.raijinPlaceAfter')}
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                      {winnerClan && <ClanShield clanId={winnerClan.id} size={20} />}
                      <span style={{ color: clanColor, fontWeight: 'bold' }}>{winnerPlayer?.name || '?'}</span>
                      {' '}{t('game.raijinWaiting')}
                    </span>
                  )
                )}
                {gameState.raijinPlacementDone && (
                  isMyRaijinTurn ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                      {winnerClan && <ClanShield clanId={winnerClan.id} size={20} />}
                      <span style={{ color: clanColor, fontWeight: 'bold' }}>{winnerPlayer?.name || '?'}</span>
                      <BushiIcon size={18} color={clanColor} />
                      <span style={{ color: '#c8a951', fontWeight: 'bold' }}>{t('game.raijinPlaced')}</span>
                      <button className="btn-secondary" onClick={doRaijinUndo} style={{ marginLeft: '8px', width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UndoIcon size={18} color="currentColor" />
                      </button>
                      <button className="btn-primary" onClick={doRaijinConfirm} style={{ marginLeft: '4px', fontSize: '0.85rem', padding: '4px 12px' }}>
                        {t('game.finish')}
                      </button>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                      {winnerClan && <ClanShield clanId={winnerClan.id} size={20} />}
                      <span style={{ color: clanColor, fontWeight: 'bold' }}>{winnerPlayer?.name || '?'}</span>
                      {' '}{t('game.raijinPlacedWaiting')}
                    </span>
                  )
                )}
              </div>
            );
          })()}

          {/* Zorro Placement Overlay */}
          {!biddingMapPeek && gameState.zorroPlacementActive && (() => {
            const isZorroPlayer = gameState.mode === 'hotseat' || localPlayerId === gameState.zorroPlacementPlayerId;
            if (isZorroPlayer) {
              return (
                <div className="kami-action-overlay">
                  <span>{t('game.zorroPlacement', { count: gameState.zorroPlacementsRemaining })}</span>
                  <button className="btn-primary" onClick={doZorroSkipPlacement} style={{ marginLeft: '12px', fontSize: '0.85rem', padding: '4px 12px' }}>{t('game.finish')}</button>
                </div>
              );
            } else {
              const zorroPlayer = gameState.players.find(p => p.id === gameState.zorroPlacementPlayerId);
              return (
                <div className="kami-action-overlay">
                  <span>{t('game.zorroWaiting', { player: zorroPlayer ? ` (${zorroPlayer.name})` : '' })}</span>
                </div>
              );
            }
          })()}

          {!gameState.zorroPlacementActive && gameState.warStartActionsComplete === false && (() => {
            const action = gameState.warStartActions?.[gameState.warStartActionIndex || 0];
            if (!action) return null;
            const player = gameState.players.find(candidate => candidate.id === action.playerId);
            const isOwner = gameState.mode === 'hotseat' || localPlayerId === action.playerId;
            const labels = {
              naginata: 'Way of Naginata',
              ashigaru: 'Way of the Ashigaru',
              keiri: 'Way of the Keiri',
              sunakake: 'Sunakake-Baba',
              zorro: 'Zorro',
            } as const;
            const selection = gameState.warStartSelection;
            const hasMercy = !!player?.seasonCards.some(card => card.id === 'su-mercy' || card.id === 'su-mercy-2');
            const keiriSelectedProvinces = action.type === 'keiri'
              ? Object.entries(gameState.provinces).filter(([, province]) => province.figures.some(figure => selection?.targetFigureIds?.includes(figure.id)))
              : [];
            const hasNaginataBushi = gameState.players.some(candidate => candidate.id === action.playerId && Object.values(gameState.provinces).some(province => province.figures.some(figure => figure.owner === candidate.id && figure.type === 'bushi')));
            const hasAshigaruProvince = !!player && player.bushi > 0 && Object.entries(gameState.provinces).some(([provinceId, province]) => {
              if (provinceId === 'ocean') return false;
              return province.figures.filter(figure => figure.owner === player.id && (figure.type !== 'fortress' || player.clanId === 'tortuga')).length === 1;
            });
            const hasSunakakeTarget = Object.values(gameState.provinces).some(province =>
              province.figures.some(figure => figure.owner === action.playerId && figure.monsterCardId === 'su-sunakake-baba')
              && province.figures.some(figure => figure.owner !== action.playerId && (figure.type === 'bushi' || figure.type === 'shinto')));
            const unavailableMessage = action.type === 'naginata' && !hasNaginataBushi
              ? t('warStart.noNaginataBushi')
              : action.type === 'ashigaru' && player?.bushi === 0
                ? t('warStart.noAshigaruReserve')
                : action.type === 'ashigaru' && !hasAshigaruProvince
                  ? t('warStart.noAshigaruProvince')
                  : action.type === 'sunakake' && !hasSunakakeTarget
                    ? t('warStart.noSunakakeTarget')
                  : null;
            const canConfirm = action.type === 'keiri'
              || (action.type === 'naginata' && !!selection?.figureId && !!selection.destinationProvinceId)
              || (action.type === 'ashigaru' && !!selection?.provinceId)
              || (action.type === 'sunakake' && !!selection?.targetFigureIds?.[0]);
            const instruction = action.type === 'naginata'
              ? t('warStart.naginataInstruction')
              : action.type === 'ashigaru'
                ? t('warStart.ashigaruInstruction')
                : action.type === 'sunakake'
                  ? t('warStart.sunakakeInstruction')
                  : t('warStart.keiriInstruction');
            return (
              <div className="kami-action-overlay">
                {isOwner ? (
                  <>
                    <span><strong>{labels[action.type]}</strong>: {unavailableMessage || instruction}</span>
                    {action.type === 'keiri' && hasMercy && keiriSelectedProvinces.map(([provinceId, province]) => {
                      const spared = selection?.mercyProvinceIds?.includes(provinceId);
                      return (
                        <button
                          key={provinceId}
                          className={spared ? 'btn-primary' : 'btn-secondary'}
                          onClick={() => doWarStartToggleMercy(provinceId)}
                          style={{ marginLeft: '6px', fontSize: '0.78rem', padding: '4px 9px' }}
                        >
                          {province.name}: {spared ? t('warStart.mercy') : t('warStart.execute')}
                        </button>
                      );
                    })}
                    {unavailableMessage ? (
                      <button className="btn-primary" onClick={doWarStartSkip} style={{ marginLeft: '12px', fontSize: '0.85rem', padding: '4px 12px' }}>{t('common.accept')}</button>
                    ) : (
                      <>
                        <button className="btn-secondary" onClick={doWarStartReset} disabled={!selection} style={{ marginLeft: '12px', fontSize: '0.85rem', padding: '4px 12px' }}>{t('common.undo')}</button>
                        <button className="btn-secondary" onClick={doWarStartSkip} style={{ marginLeft: '6px', fontSize: '0.85rem', padding: '4px 12px' }}>{t('common.skip')}</button>
                        <button className="btn-primary" onClick={doWarStartConfirm} disabled={!canConfirm} style={{ marginLeft: '6px', fontSize: '0.85rem', padding: '4px 12px' }}>{t('common.confirm')}</button>
                      </>
                    )}
                  </>
                ) : (
                  <span>{t('common.waitingForResolution', { name: player?.name || '', effect: labels[action.type] })}</span>
                )}
              </div>
            );
          })()}

          <div
            className={`map-container${isDragging ? ' dragging' : ''}`}
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <HonorTrack />
            <DaikaijuOceanMarker />
            <AllianceDisplay />
            {ruleViolationMessage && (
              <div className="rule-violation-toast">
                {ruleViolationMessage}
              </div>
            )}
            <div
              className="map-canvas"
              ref={mapCanvasRef}
              style={{ visibility: initialized ? 'visible' : 'hidden' }}
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
                {PROVINCES_DATA.filter(r => r.id !== 'ocean').map(r => {
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
      {biddingMapPeek && (
        gameState.currentPhase === 'war'
        || !!gameState.pendingSpringPlacement
        || !!gameState.pendingMonsterEnterDecision
        || !!gameState.pendingNinjaDecision
      ) && (
        <button
          className="bidding-map-peek-return-btn"
          onClick={() => setBiddingMapPeek(false)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {gameState.pendingNureOnnaDecision
            ? t('nureOnna.returnToDecision')
            : gameState.pendingSpringPlacement?.type === 'kenin'
              ? t('kenin.returnToDecision')
              : gameState.pendingSpringPlacement?.type === 'samurai'
                ? t('samurai.returnToDecision')
                : gameState.pendingSpringPlacement?.type === 'kannushi'
                  ? t('kannushi.returnToDecision')
                  : gameState.pendingMonsterEnterDecision?.type === 'benten'
                    ? t('benten.returnToDecision')
                    : gameState.pendingMonsterEnterDecision?.type === 'oni-hate'
                      ? t('oniHate.returnToDecision')
                      : gameState.pendingNinjaDecision
                        ? t('ninja.returnToDecision')
              : gameState.pendingBattleCardDecision?.type === 'earth-dragon'
                          ? t('earthDragon.returnToDecision')
                          : t('battle.returnToBids')}
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
      {selectedRegion && !moveMode && !recruitMode && !betrayMode && !monsterPlacementMode && !buildFortressMode && !buildFukurokujuMode && (
        <RegionDetailModal regionId={selectedRegion} onClose={() => selectRegion(null)} />
      )}

      {/* Tea Ready Popup (online seasonSetup) */}
      {gameState.mode === 'online' && gameState.currentPhase === 'seasonSetup' && localPlayerId && (() => {
        const localPlayer = gameState.players.find(p => p.id === localPlayerId);
        if (!localPlayer) return null;
        const clanColor = CLANS.find(c => c.id === localPlayer.clanId)?.color;
        const readyCount = (gameState.teaReadyPlayers || []).length;
        const isReady = gameState.teaReadyPlayers.includes(localPlayerId);
        return (
          <div className="monster-placement-popup" style={{ zIndex: 1200 }}>
            <div className="tea-ready-popup-content" style={{
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
              <div style={{ marginTop: '13px', filter: 'drop-shadow(rgb(-3, 1, 20) 1px -1px 2px)' }}>
                <ClanShield clanId={localPlayer.clanId} size={173} />
              </div>
              <p style={{ color: clanColor, fontWeight: 'bold', fontSize: '1.3rem', textShadow: '-1px -1px 0 #333, 1px -1px 0 #333, -1px 1px 0 #333, 1px 1px 0 #333', marginTop: '-20px' }}>
                {localPlayer.name}
              </p>
              <h4 style={{ color: '#fff', margin: '0px 0px', textAlign: 'center', marginBottom: '15px' }}>{t('game.teaReadyTitle')}</h4>
              {isReady ? (
                <div className="tea-ready-waiting">
                  <strong>{t('common.readyWaiting', { count: String(readyCount), total: String(gameState.players.length) })}</strong>
                </div>
              ) : (
                <button className="monster-placement-btn" onClick={doTeaReady} style={{ fontSize: '1.02rem', padding: '0.68rem 2.12rem', marginTop: '-11px' }}>
                  {t('game.turnPopupAccept')}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Turn Popup (hotseat mandate transitions + online politics) */}
      {!hasBlockingRuleFlow && turnPopupPlayer && (gameState.mode === 'hotseat' || (gameState.mode === 'online' && turnPopupPlayer === localPlayerId)) && gameState.currentPhase !== 'war' && !gameState.kamiResolutionActive && (() => {
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
      {!biddingMapPeek && !hasBlockingRuleFlow && <HarvestPopup />}

      {/* Kami Resolution Popup */}
      {!biddingMapPeek && !hasBlockingRuleFlow && !gameState?.kamiPlacementActive && <KamiResolutionPopup />}
      {!biddingMapPeek && !hasBlockingRuleFlow && <RyujinWaitingPopup />}

      {/* Kami Summary Popup */}
      {!biddingMapPeek && !hasBlockingRuleFlow && <KamiSummaryPopup />}

      {/* Kami Phase Start Popup */}
      {!biddingMapPeek && !hasBlockingRuleFlow && kamiPhasePopupVisible && !gameState.kamiPlacementActive && (
        <div className="harvest-popup-backdrop">
          <div className="harvest-popup" style={{ borderColor: '#9B59B6', maxWidth: '420px', minWidth: '320px', background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #1a0a2e 100%)', boxShadow: '0 0 20px rgba(155, 89, 182, 0.4), inset 0 0 30px rgba(155, 89, 182, 0.05)', borderWidth: '2px' }}>
            <h3 className="kami-phase-start-title" style={{ color: '#9B59B6', textAlign: 'center', margin: '0 0 12px 0', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <ToriiGateIcon size={44} className="kami-phase-torii" />
              <span>{t('kami.phaseStart.title')}</span>
              <ToriiGateIcon size={44} className="kami-phase-torii" />
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
              {gameState.mode === 'online' && localPlayerId && gameState.kamiReadyPlayers?.includes(localPlayerId) ? (
                <p style={{ color: '#9B59B6', fontSize: '1rem', fontWeight: 'bold' }}>
                  {t('kami.phaseStart.waiting', { count: String(gameState.kamiReadyPlayers.length), total: String(gameState.players.length) })}
                </p>
              ) : (
                <button className="btn-primary harvest-popup-btn" onClick={dismissKamiPhasePopup} style={{ borderColor: '#9B59B6' }}>
                  {t('kami.phaseStart.accept')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* War Phase Start Popup */}
      {!hasBlockingRuleFlow && warPhasePopupVisible && (
        <div className="harvest-popup-backdrop">
          <div className="harvest-popup" style={{ borderColor: '#DC143C', maxWidth: '450px', minWidth: '320px' }}>
            <h3 style={{ color: '#DC143C', textAlign: 'center', margin: '0 0 12px 0', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span style={{ color: '#DC143C', display: 'inline-flex' }}><WarSeal size={34} /></span>
              <span>{t('war.phaseStart.title')}</span>
              <span style={{ color: '#DC143C', display: 'inline-flex' }}><WarSeal size={34} /></span>
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
                      <div key={idx} className="war-upgrade-player-group" style={{ background: `${clan?.color || '#666'}22`, borderColor: `${clan?.color || '#666'}44` }}>
                        {entry.bonuses.map((b, bi) => (
                          <div key={bi} className="war-upgrade-badge">
                            <ClanShield clanId={entry.clanId} size={18} />
                            <span style={{ color: clan?.color, fontWeight: 'bold', fontSize: '0.85rem' }}>{entry.playerName}</span>
                            <span style={{ fontSize: '0.85rem', opacity: 0.9, fontStyle: 'italic' }}>{b.cardName}</span>
                            <span className="war-upgrade-result">
                              {b.resource === 'naginata' && b.sourceProvinceId && b.destinationProvinceId ? (
                                <>
                                  <strong style={{ color: PROVINCE_COLORS[b.sourceProvinceId] }}>{gameState.provinces[b.sourceProvinceId]?.name}</strong>
                                  <span aria-hidden="true">→</span>
                                  <strong style={{ color: PROVINCE_COLORS[b.destinationProvinceId] }}>{gameState.provinces[b.destinationProvinceId]?.name}</strong>
                                </>
                              ) : b.resource === 'katana' ? (
                                <>
                                  <BushiIcon size={16} color={clan?.color} />
                                  <strong>2</strong>
                                  <FistIcon size={15} color={clan?.color} />
                                </>
                              ) : b.resource === 'effect' || b.resource === 'naginata' ? (
                                <span>—</span>
                              ) : (
                                <span style={{ fontWeight: 'bold' }}>{b.amount}</span>
                              )}
                              {b.resource === 'coins' && <CoinIcon size={14} color="#f1c40f" />}
                              {b.resource === 'ronin' && <RoninIcon size={14} color="#e74c3c" />}
                              {b.resource === 'vp' && <VPIcon size={14} color="#9B59B6" />}
                            </span>
                            <div className="war-upgrade-tooltip">
                              {(() => {
                                const card = SEASON_CARDS_DATA.find(candidate =>
                                  candidate.id === b.cardId || candidate.id.replace(/-2$/, '') === b.cardId
                                );
                                if (!card) return b.cardName;
                                return renderCardEffect(t(getCardEffectKey(card.id) as TranslationKey));
                              })()}
                            </div>
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
                          <strong>{player.coins}</strong> <CoinIcon size={16} color="#f1c40f" />
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.85rem' }}>
                          <strong>{displayRonin}</strong> <RoninIcon size={16} color="#e74c3c" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              {gameState && gameState.mode === 'online' && localPlayerId && (gameState.warPhaseReadyPlayers || []).includes(localPlayerId) ? (
                <p style={{ color: '#DC143C', fontSize: '1rem', fontWeight: 'bold' }}>
                  {t('kami.summary.waiting', { count: String((gameState.warPhaseReadyPlayers || []).length), total: String(gameState.players.length) })}
                </p>
              ) : (
                <button className="btn-primary harvest-popup-btn" onClick={dismissWarPhasePopup} style={{ borderColor: '#DC143C' }}>
                  {t('war.phaseStart.accept')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kami Unbound manifestation */}
      {!hasBlockingRuleFlow && gameState?.kamiPlacementActive && (() => {
        const owner = gameState.players.find(player => player.id === gameState.kamiPlacementPlayerId);
        const clan = owner ? CLANS.find(candidate => candidate.id === owner.clanId) : undefined;
        const color = clan?.color || 'var(--accent-gold)';
        const kami = KAMI_DATA.find(candidate => candidate.type === gameState.kamiPlacementKamiType);
        const selectedProvince = gameState.kamiPlacementProvinceId ? gameState.provinces[gameState.kamiPlacementProvinceId] : undefined;
        const currentKamiProvince = Object.values(gameState.provinces).find(province =>
          province.figures.some(figure => figure.type === 'kami' && figure.kamiType === gameState.kamiPlacementKamiType)
        );
        const isOwner = gameState.mode === 'hotseat' || localPlayerId === gameState.kamiPlacementPlayerId;

        if (isOwner && kamiPlacementMapMode) {
          return (
            <div className="kami-unbound-toolbar" style={{ borderColor: color }}>
              <div className="kami-unbound-toolbar-title">
                <strong style={{ color }}>{kami?.name}</strong>
                <span>
                  {selectedProvince
                    ? selectedProvince.name
                    : currentKamiProvince
                      ? t('kami.unbound.keepProvince', { province: currentKamiProvince.name })
                      : t('kami.unbound.chooseProvince')}
                </span>
              </div>
              <button className="icon-btn" title={t('kami.unbound.undo')} disabled={!selectedProvince} onClick={doKamiUndoProvince}>
                <UndoIcon size={21} />
              </button>
              <button className="btn-primary" disabled={!selectedProvince && !currentKamiProvince} onClick={() => { doKamiConfirmProvince(); setKamiPlacementMapMode(false); }}>
                {t('kami.unbound.confirm')}
              </button>
            </div>
          );
        }

        return (
          <div className="harvest-popup-backdrop">
            <div className="harvest-popup kami-unbound-popup" style={{ borderColor: color }}>
              <div className="kami-unbound-figure-wrap">
                <img src={TEMPLATE_FIGURE_IMG} alt={kami?.name || 'Kami'} />
                <strong style={{ color }}>{kami?.name}</strong>
              </div>
              {owner && clan && (
                <div className="kami-unbound-owner" style={{ color }}>
                  <ClanShield clanId={clan.id} size={28} />
                  <strong>{owner.name}</strong>
                  <span>{clan.name}</span>
                </div>
              )}
              {gameState.kamiPlacementKamiType && (
                <div className="kami-unbound-power" style={{ borderColor: color }}>
                  <span>{t('kami.unbound.mapPower')}</span>
                  <p>{t(KAMI_EXPANSION_EFFECT_KEYS[gameState.kamiPlacementKamiType])}</p>
                </div>
              )}
              {isOwner ? (
                <>
                  <p>
                    {currentKamiProvince
                      ? t('kami.unbound.ownerPromptExisting', { kami: kami?.name || '', province: currentKamiProvince.name })
                      : t('kami.unbound.ownerPrompt', { kami: kami?.name || '' })}
                  </p>
                  <div className="kami-unbound-popup-actions">
                    <button className={currentKamiProvince ? 'btn-secondary' : 'btn-primary'} onClick={() => setKamiPlacementMapMode(true)}>
                      {t('kami.unbound.choose')}
                    </button>
                    {currentKamiProvince && (
                      <button className="btn-primary" onClick={() => { doKamiConfirmProvince(); setKamiPlacementMapMode(false); }}>
                        {t('kami.unbound.confirm')}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p>{t('kami.unbound.waiting', { player: owner?.name || '', kami: kami?.name || '' })}</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Daikaiju Placement Popup */}
      {!hasBlockingRuleFlow && gameState && gameState.daikaijuPlacementActive && !warPhasePopupVisible && !gameState.daikaijuSummaryVisible && (
        (() => {
          const isOwner = gameState.mode === 'hotseat' || localPlayerId === gameState.daikaijuPlacementPlayerId;
          const ownerPlayer = gameState.players.find(player => player.id === gameState.daikaijuPlacementPlayerId);
          const ownerClan = ownerPlayer ? CLANS.find(clan => clan.id === ownerPlayer.clanId) : null;
          const color = ownerClan?.color || 'var(--accent-gold)';
          const selectedProvince = gameState.daikaijuPlacementProvinceId
            ? gameState.provinces[gameState.daikaijuPlacementProvinceId]
            : null;
          if (isOwner && daikaijuPlacementMode && !selectedProvince) return null;

          return (
            <div className="harvest-popup-backdrop">
              <div className="harvest-popup daikaiju-placement-popup" style={{ borderColor: color }}>
                <h3 className="daikaiju-placement-title" style={{ color }}>
                  <MonsterIcon size={36} color={color} />
                  <span>{t('daikaiju.placement.title')}</span>
                </h3>
                {ownerPlayer && ownerClan && (
                  <div className="daikaiju-placement-owner" style={{ color }}>
                    <ClanShield clanId={ownerClan.id} size={30} />
                    <strong>{ownerPlayer.name}</strong>
                    <span>{ownerClan.name}</span>
                  </div>
                )}
                {isOwner ? (
                  selectedProvince ? (
                    <>
                      <p>{t('daikaiju.placement.selected', { province: selectedProvince.name })}</p>
                      <div className="daikaiju-placement-actions">
                        <button className="btn-secondary" style={{ borderColor: color }} onClick={doDaikaijuUndoPlacement}>
                          {t('daikaiju.placement.undo')}
                        </button>
                        <button className="btn-primary" style={{ borderColor: color }} onClick={doDaikaijuConfirmPlacement}>
                          {t('daikaiju.placement.confirm')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>{t('daikaiju.placement.choose')}</p>
                      <button className="btn-primary" style={{ borderColor: color }} onClick={startDaikaijuPlacement}>
                        {t('daikaiju.placement.place')}
                      </button>
                    </>
                  )
                ) : (
                  <p>{selectedProvince
                    ? t('daikaiju.placement.waitingConfirm', { player: ownerPlayer?.name || '' })
                    : t('daikaiju.placement.waiting', { player: ownerPlayer?.name || '' })}</p>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* Daikaiju Summary Popup */}
      {!hasBlockingRuleFlow && gameState && gameState.daikaijuSummaryVisible && gameState.daikaijuSummaryData && (
        (() => {
          const summary = gameState.daikaijuSummaryData;
          const province = gameState.provinces[summary.provinceId];
          const daikaiju = province?.figures.find(
            figure => figure.type === 'monster' && figure.monsterCardId === 'au-daikaiju',
          );
          const owner = gameState.players.find(player => player.id === daikaiju?.owner);
          const ownerClan = owner ? CLANS.find(clan => clan.id === owner.clanId) : undefined;
          const ownerColor = ownerClan?.color || 'var(--accent-gold)';
          const provinceColor = PROVINCE_COLORS[summary.provinceId] || 'var(--text-primary)';
          const daikaijuImage = getMonsterFigureImage('au-daikaiju') || TEMPLATE_FIGURE_IMG;

          return (
            <div className="harvest-popup-backdrop">
              <div className="harvest-popup daikaiju-arrival-popup" style={{ borderColor: ownerColor }}>
                <img className="daikaiju-arrival-figure" src={daikaijuImage} alt="Daikaiju" />
                <h3 className="daikaiju-arrival-title">
                  <span>{t('daikaiju.summary.arrivalPrefix')}</span>
                  {ownerClan && (
                    <span className="daikaiju-arrival-clan" style={{ color: ownerColor }}>
                      <ClanShield clanId={ownerClan.id} size={28} />
                      <strong>{ownerClan.name}</strong>
                    </span>
                  )}
                  <span>{t('daikaiju.summary.arrivalSuffix')}</span>
                </h3>
                <p className="daikaiju-arrival-province">
                  {t('daikaiju.summary.placedIn')}{' '}
                  <strong style={{ color: provinceColor }}>{summary.provinceName}</strong>
                </p>
                {summary.destroyedFortresses.length > 0 || (summary.crushedFukurokuju?.length || 0) > 0 ? (
                  <div className="daikaiju-destruction-list">
                    {summary.destroyedFortresses.map(df => {
                      const victim = gameState.players.find(player => player.id === df.playerId);
                      const victimClan = victim ? CLANS.find(clan => clan.id === victim.clanId) : undefined;
                      const victimColor = victimClan?.color || 'var(--text-primary)';

                      return (
                        <div key={df.playerId} className="daikaiju-destruction-row">
                          <span className="daikaiju-destruction-owner" style={{ color: victimColor }}>
                            {victimClan && <ClanShield clanId={victimClan.id} size={24} />}
                            <strong>{victim?.name || df.playerName}</strong>
                          </span>
                          <span className="daikaiju-destruction-count" style={{ color: victimColor }}>
                            <FortressIcon size={22} color={victimColor} />
                            <strong>{df.count}</strong>
                            <span>
                              {df.count === 1
                                ? t('daikaiju.summary.destroyedSingular')
                                : t('daikaiju.summary.destroyedPlural')}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                    {(summary.crushedFukurokuju || []).map((crushed, index) => {
                      const victim = gameState.players.find(player => player.id === crushed.playerId);
                      const victimClan = victim ? CLANS.find(clan => clan.id === victim.clanId) : undefined;
                      const victimColor = victimClan?.color || 'var(--text-primary)';
                      return (
                        <div key={`fukurokuju-${crushed.playerId}-${index}`} className="daikaiju-destruction-row">
                          <span className="daikaiju-destruction-owner" style={{ color: victimColor }}>
                            {victimClan && <ClanShield clanId={victimClan.id} size={24} />}
                            <strong>{victim?.name || crushed.playerName}</strong>
                          </span>
                          <span className="daikaiju-destruction-count" style={{ color: victimColor }}>
                            <MonsterIcon size={22} color={victimColor} />
                            <strong>Fukurokuju</strong>
                            <span>{t('daikaiju.summary.crushed')}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="daikaiju-no-destruction">
                    {t('daikaiju.summary.fortresses', { count: '0' })}
                  </p>
                )}
                <div style={{ textAlign: 'center' }}>
                  {gameState.mode === 'online' && localPlayerId && gameState.daikaijuSummaryReadyPlayers.includes(localPlayerId) ? (
                    <p style={{ color: ownerColor, fontSize: '1rem', fontWeight: 'bold' }}>
                      {t('daikaiju.summary.waiting', { count: String(gameState.daikaijuSummaryReadyPlayers.length), total: String(gameState.players.length) })}
                    </p>
                  ) : (
                    <button className="btn-primary harvest-popup-btn" onClick={doDaikaijuSummaryReady} style={{ borderColor: ownerColor }}>
                      {t('daikaiju.summary.accept')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Hostage Return Popup (interactive cleanup) */}
      {!hasBlockingRuleFlow && gameState && gameState.hostageReturnActive && !warSummaryVisible && createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card" style={{ maxWidth: '460px', minWidth: '300px' }}>
            <h3 style={{ color: '#D4AF37', textAlign: 'center', margin: '0 0 12px 0', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span>{t('common.returnHostages')}</span>
            </h3>
            {(() => {
              const currentReturnPlayerId = gameState.hostageReturnOrder[gameState.hostageReturnIndex];
              const currentReturnPlayer = gameState.players.find(p => p.id === currentReturnPlayerId);
              if (!currentReturnPlayer) return null;
              const returnClan = CLANS.find(c => c.id === currentReturnPlayer.clanId);
              const hostageCount = currentReturnPlayer.hostages.length;
              const isMyReturn = gameState.mode === 'online' && localPlayerId === currentReturnPlayerId;
              const alreadyReturned = gameState.hostageReturnIndex >= gameState.hostageReturnOrder.length;

              return (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
                    <ClanShield clanId={currentReturnPlayer.clanId} size={40} />
                    <span style={{ color: returnClan?.color, fontWeight: 'bold', fontSize: '1.1rem' }}>{currentReturnPlayer.name}</span>
                  </div>
                  <p style={{ fontSize: '0.9rem', opacity: 0.9, margin: '8px 0' }}>
                    {t('common.returnHostagesSummary', { count: String(hostageCount) })} <CoinIcon size={14} color="#f1c40f" />
                  </p>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
                    {currentReturnPlayer.hostages.map((h, idx) => {
                      const fromPlayer = gameState.players.find(p => p.id === h.fromClanId);
                      const fromClan = fromPlayer ? CLANS.find(c => c.id === fromPlayer.clanId) : null;
                      return (
                        <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: `${fromClan?.color || '#666'}20`, border: `1px solid ${fromClan?.color || '#444'}44`, fontSize: '0.8rem' }}>
                          <ClanShield clanId={fromPlayer?.clanId || ''} size={14} />
                          <span style={{ color: fromClan?.color || '#fff', fontWeight: 'bold' }}>{h.figureName || h.figureType}</span>
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    {!alreadyReturned && (gameState.mode === 'hotseat' || isMyReturn) ? (
                      <button className="btn-primary battle-popup-accept" onClick={doHostageReturnAccepted} style={{ borderColor: '#D4AF37' }}>
                        {t('common.accept')}
                      </button>
                    ) : (
                      <p style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        {t('common.waitingForPlayer', { name: currentReturnPlayer.name })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* War Summary Popup (after all battles resolved) */}
      {!hasBlockingRuleFlow && warSummaryVisible && gameState && createPortal(
        <div className="battle-popup-overlay">
          <div className="battle-popup-card" style={{ maxWidth: '500px', minWidth: '320px' }}>
            <h3 style={{ color: '#DC143C', textAlign: 'center', margin: '0 0 12px 0', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span style={{ color: '#DC143C', display: 'inline-flex', flexShrink: 0 }}><WarSeal size={30} /></span>
              <span>{t('war.summary.title')}</span>
              <span style={{ color: '#DC143C', display: 'inline-flex', flexShrink: 0 }}><WarSeal size={30} /></span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {gameState.activeBattles.map((battle, idx) => {
                const province = gameState.provinces[battle.provinceId];
                const winner = battle.winner ? gameState.players.find(p => p.id === battle.winner) : null;
                const winnerClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '42px minmax(100px, 1fr) minmax(120px, 1fr)', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: winner ? `${winnerClan?.color || '#666'}15` : 'rgba(255,255,255,0.05)', border: `1px solid ${winnerClan?.color || '#444'}33` }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.8rem', opacity: 0.6, textAlign: 'right', marginRight: '4px' }}>#{idx + 1}</span>
                    <span style={{ fontSize: '0.9rem', textAlign: 'left' }}>{province?.name || battle.provinceId}</span>
                    {winner ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifySelf: 'end', gap: '4px' }}>
                        <ClanShield clanId={winner.clanId} size={18} />
                        <span style={{ color: winnerClan?.color, fontWeight: 'bold', fontSize: '0.85rem' }}>{winner.name}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', opacity: 0.5, fontStyle: 'italic', justifySelf: 'end' }}>{t('war.summary.discarded')}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ margin: '16px 0', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '0.95rem', margin: '0 0 8px 0', color: '#DC143C' }}>{t('common.cleanupTitle')}</p>
              <p style={{ fontSize: '0.85rem', margin: 0, lineHeight: 1.5, opacity: 0.9 }}>
                {t('common.cleanupWhenReady')} <ShintoIcon size={14} color="#9B59B6" /> {t('common.cleanupShintoReturn')} <CoinIcon size={14} color="#f1c40f" /> {t('common.cleanupAnd')} <RoninIcon size={14} color="#e74c3c" /> {t('common.cleanupDiscarded')}
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              {gameState.mode === 'online' && localPlayerId && (gameState.warSummaryReadyPlayers || []).includes(localPlayerId) ? (
                <p style={{ color: '#DC143C', fontSize: '1rem', fontWeight: 'bold' }}>
                  {t('kami.summary.waiting', { count: String((gameState.warSummaryReadyPlayers || []).length), total: String(gameState.players.length) })}
                </p>
              ) : (
                <button className="btn-primary battle-popup-accept" onClick={dismissWarSummaryPopup} style={{ borderColor: '#DC143C' }}>
                  {t('war.summary.accept')}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Rejoin Waiting Popup */}
      {rejoinWaitingVisible && createPortal(
        <div className="battle-popup-overlay" style={{ zIndex: 99999 }}>
          <div className="battle-popup-card" style={{ maxWidth: '420px', minWidth: '300px' }}>
            <h3 style={{ color: '#e2b13c', textAlign: 'center', margin: '0 0 16px 0', fontSize: '1.3rem' }}>
              {t('rejoin.title')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {rejoinPlayerStatuses.map(player => {
                const clan = CLANS.find(c => c.id === player.clanId);
                return (
                  <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: player.connected ? 'rgba(39, 174, 96, 0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${player.connected ? '#27ae6033' : '#88888833'}` }}>
                    <ClanShield clanId={player.clanId} size={24} />
                    <span style={{ flex: 1, fontWeight: 'bold', color: clan?.color || '#ccc', fontSize: '0.95rem' }}>
                      {player.name}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: player.connected ? '#27ae60' : '#d4a020' }}>
                      {player.connected ? t('rejoin.ready') : t('rejoin.waiting')}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: 'center' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  const ws = useGameStore.getState().ws;
                  if (ws) ws.close();
                  useGameStore.setState({ rejoinWaitingVisible: false, rejoinPlayerStatuses: [], ws: null, screen: 'games-lobby' });
                }}
                style={{ background: 'rgba(255,255,255,0.1)', borderColor: '#888', color: '#ccc' }}
              >
                {t('rejoin.backToLobby')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Trade Modal */}
      <TradeModal />

      {/* Trade Offer Popup */}
      <TradeOfferPopup />

      {shouldShowRuleNotice ? <RuleEventNoticePopup />
        : gameState.pendingMarshalSerpentWarningPlayerId ? <MarshalSerpentWarningPopup />
          : gameState.generosityPending ? <GenerosityPopup />
          : gameState.pendingSerpentCharge ? <SerpentChargePopup />
            : gameState.pendingBattleCardDecision ? <BattleCardDecisionPopup />
              : gameState.pendingBattleMercyDecision ? <BattleMercyDecisionPopup />
                : gameState.pendingNureOnnaDecision ? <NureOnnaPopup />
                  : gameState.pendingMonsterEnterDecision ? <MonsterEnterDecisionPopup />
                    : gameState.pendingSpringPlacement ? <SpringPlacementPopup />
                      : gameState.pendingNinjaDecision ? <NinjaDecisionPopup />
                        : gameState.pendingMonkeyDecision ? <MonkeyDecisionPopup />
                          : gameState.pendingSnakeDecision ? <SnakeDecisionPopup />
                            : gameState.pendingBenevolence ? <BenevolencePopup />
                              : gameState.pendingVassalDecision ? <VassalDecisionPopup />
                                : null}

    </div>
  );
};
