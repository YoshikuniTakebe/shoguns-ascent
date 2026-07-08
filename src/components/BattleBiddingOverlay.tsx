import { useState, useCallback, useEffect, useRef, type DragEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { WAR_TACTICS, CLANS } from '../types/game';
import coinImg from '../img/coin.png';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import { ClanShield } from './ClanShields';
import { RoninIcon, VPIcon, FistIcon } from './Icons';

export interface BattleCombatant {
  playerId: string;
  playerName: string;
  clanId: string;
  force: number;
}

interface BattleBiddingOverlayProps {
  playerName: string;
  playerClanColor: string;
  playerClanId?: string;
  maxCoins: number;
  playerRonin?: number;
  playerVP?: number;
  provinceName: string;
  provinceColor?: string;
  battleNumber: number;
  onConfirm: (bids: Record<string, number>) => void;
  combatants?: BattleCombatant[];
  playerBattleIndex?: number;
  playerTotalBattles?: number;
  onPeekMap?: () => void;
}

const TACTIC_KANJI: Record<string, string> = {
  seppuku: '切腹',
  'take-hostage': '人質',
  'hire-ronin': '浪人',
  'imperial-poets': '詩人',
};

const TACTIC_SYMBOLS: Record<string, string> = {
  seppuku: '⚔',
  'take-hostage': '🔗',
  'hire-ronin': '🏹',
  'imperial-poets': '📜',
};

/** All valid drop target ids: tactic ids + 'pool' */
const ALL_DROP_TARGETS = [...WAR_TACTICS.map(t => t.id), 'pool'];

export const BattleBiddingOverlay = ({
  playerName,
  playerClanColor,
  playerClanId,
  maxCoins,
  playerRonin,
  playerVP,
  provinceName,
  provinceColor,
  battleNumber,
  onConfirm,
  combatants,
  playerBattleIndex,
  playerTotalBattles,
  onPeekMap,
}: BattleBiddingOverlayProps) => {
  const t = useT();

  // Each coin has a unique id and is assigned to either a tactic or 'pool'
  const [coinPositions, setCoinPositions] = useState<Record<string, string>>(() => {
    const positions: Record<string, string> = {};
    for (let i = 0; i < maxCoins; i++) {
      positions[`coin-${i}`] = 'pool';
    }
    return positions;
  });

  // Safety wrapper: validates that total coin count always equals maxCoins.
  // If any discrepancy is detected, resets all coins to the pool.
  const safeSetCoinPositions = useCallback((updater: (prev: Record<string, string>) => Record<string, string>) => {
    setCoinPositions(prev => {
      const next = updater(prev);
      // Validate: must have exactly maxCoins keys and all values must be valid targets
      if (Object.keys(next).length !== maxCoins) {
        // Reset to all-pool
        const reset: Record<string, string> = {};
        for (let i = 0; i < maxCoins; i++) reset[`coin-${i}`] = 'pool';
        return reset;
      }
      return next;
    });
  }, [maxCoins]);

  // Reinitialize coinPositions if maxCoins changes while mounted
  useEffect(() => {
    setCoinPositions(() => {
      const positions: Record<string, string> = {};
      for (let i = 0; i < maxCoins; i++) {
        positions[`coin-${i}`] = 'pool';
      }
      return positions;
    });
  }, [maxCoins]);

  // Track which drop target is currently being dragged over
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // Touch drag state
  const touchDragCoinRef = useRef<string | null>(null);
  const touchGhostRef = useRef<HTMLImageElement | null>(null);

  // ---- HTML5 Drag and Drop ----

  const handleDragStart = useCallback((e: DragEvent<HTMLImageElement>, coinId: string) => {
    e.dataTransfer.setData('text/plain', coinId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    setDragOverTarget(targetId);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>, targetId: string) => {
    // Only clear if we are leaving the target itself (not a child)
    const relatedTarget = e.relatedTarget as Node | null;
    const currentTarget = e.currentTarget as Node;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDragOverTarget(prev => (prev === targetId ? null : prev));
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    setDragOverTarget(null);
    const coinId = e.dataTransfer.getData('text/plain');
    if (coinId) {
      safeSetCoinPositions(prev => {
        // Only process if coinId exists in current positions (not a phantom coin)
        if (prev[coinId] === undefined) return prev;
        return { ...prev, [coinId]: targetId };
      });
    }
  }, [safeSetCoinPositions]);

  // ---- Touch event handlers for mobile ----

  const handleTouchStart = useCallback((e: ReactTouchEvent<HTMLImageElement>, coinId: string) => {
    e.preventDefault();
    touchDragCoinRef.current = coinId;

    // Create a ghost image that follows the finger
    const touch = e.touches[0];
    const ghost = document.createElement('img');
    ghost.src = coinImg;
    ghost.className = 'bidding-coin-touch-ghost';
    ghost.style.position = 'fixed';
    ghost.style.left = `${touch.clientX - 18}px`;
    ghost.style.top = `${touch.clientY - 18}px`;
    ghost.style.width = '36px';
    ghost.style.height = '36px';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '2000';
    ghost.style.opacity = '0.85';
    document.body.appendChild(ghost);
    touchGhostRef.current = ghost;
  }, []);

  const handleTouchMove = useCallback((e: ReactTouchEvent<HTMLImageElement>) => {
    e.preventDefault();
    const touch = e.touches[0];

    // Move ghost
    if (touchGhostRef.current) {
      touchGhostRef.current.style.left = `${touch.clientX - 18}px`;
      touchGhostRef.current.style.top = `${touch.clientY - 18}px`;
    }

    // Determine which drop target is under the touch point
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    if (elementBelow) {
      // Walk up the DOM to find a drop target
      let found: string | null = null;
      let el: Element | null = elementBelow;
      while (el) {
        const targetId = el.getAttribute('data-drop-target');
        if (targetId && ALL_DROP_TARGETS.includes(targetId)) {
          found = targetId;
          break;
        }
        el = el.parentElement;
      }
      setDragOverTarget(found);
    } else {
      setDragOverTarget(null);
    }
  }, []);

  const handleTouchEnd = useCallback((e: ReactTouchEvent<HTMLImageElement>) => {
    e.preventDefault();

    // Remove ghost
    if (touchGhostRef.current) {
      document.body.removeChild(touchGhostRef.current);
      touchGhostRef.current = null;
    }

    const coinId = touchDragCoinRef.current;
    touchDragCoinRef.current = null;

    if (!coinId) {
      setDragOverTarget(null);
      return;
    }

    // Determine which target the touch ended on
    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    if (elementBelow) {
      let el: Element | null = elementBelow;
      while (el) {
        const targetId = el.getAttribute('data-drop-target');
        if (targetId && ALL_DROP_TARGETS.includes(targetId)) {
          safeSetCoinPositions(prev => {
            // Only process if coinId exists in current positions (not a phantom coin)
            if (prev[coinId] === undefined) return prev;
            return { ...prev, [coinId]: targetId };
          });
          setDragOverTarget(null);
          return;
        }
        el = el.parentElement;
      }
    }

    setDragOverTarget(null);
  }, [safeSetCoinPositions]);

  // ---- Confirm ----

  const handleConfirm = useCallback(() => {
    const bids: Record<string, number> = {};
    WAR_TACTICS.forEach(tactic => {
      bids[tactic.id] = Object.values(coinPositions).filter(pos => pos === tactic.id).length;
    });
    onConfirm(bids);
  }, [coinPositions, onConfirm]);

  const poolCoins = Object.entries(coinPositions).filter(([, pos]) => pos === 'pool');
  const totalAssigned = maxCoins - poolCoins.length;

  return (
    <div className="bidding-overlay">
      <div className="bidding-overlay-content">
        {/* Header */}
        <div className="bidding-overlay-header">
          <h2 className="bidding-overlay-title">
            {t('battle.battleNumber', { number: battleNumber })}: <span style={{ color: provinceColor }}>{provinceName}</span>
          </h2>
          <p className="bidding-overlay-player">
            {playerClanId && <ClanShield clanId={playerClanId} size={22} />}
            <span style={{ color: playerClanColor }}>{playerName}</span>
            <span style={{ color: '#ffffff' }}> - {t('battle.warTactics')}</span>
          </p>
          {playerBattleIndex !== undefined && playerTotalBattles !== undefined && playerTotalBattles > 0 && (
            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', opacity: 0.8, color: '#ccc' }}>
              {t('battle.battleCount', { current: playerBattleIndex, total: playerTotalBattles })}
            </p>
          )}
          {(playerRonin !== undefined || playerVP !== undefined) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '4px', fontSize: '0.9rem' }}>
              {playerRonin !== undefined && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#e74c3c' }}>
                  <RoninIcon size={18} color="#e74c3c" /> {playerClanId === 'koi' ? Math.max(0, maxCoins - totalAssigned) : playerRonin}
                </span>
              )}
              {playerVP !== undefined && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#f1c40f' }}>
                  <VPIcon size={18} color="#f1c40f" /> {playerVP}
                </span>
              )}
            </div>
          )}
          {onPeekMap && (
            <button
              className="bidding-peek-map-btn"
              onClick={onPeekMap}
              title={t('battle.peekMap')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>{t('battle.peekMap')}</span>
            </button>
          )}
        </div>

        {/* Combatants Panel */}
        {combatants && combatants.length > 0 && (
          <div className="bidding-combatants-panel">
            {combatants.map(c => {
              const clan = CLANS.find(cl => cl.id === c.clanId);
              return (
                <div key={c.playerId} className="bidding-combatant-item">
                  <ClanShield clanId={c.clanId} size={20} />
                  <span className="bidding-combatant-name" style={{ color: clan?.color || '#fff' }}>{c.playerName}</span>
                  <span className="bidding-combatant-force" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <FistIcon size={16} color={clan?.color || '#fff'} />
                    <span style={{ fontWeight: 'bold', color: clan?.color || '#fff' }}>{c.force}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Tactic Tiles */}
        <div className="bidding-tactics-row">
          {WAR_TACTICS.map((tactic, idx) => {
            const tacticCoins = Object.entries(coinPositions).filter(([, pos]) => pos === tactic.id);
            const isOver = dragOverTarget === tactic.id;
            const tooltipKey = `battle.tacticDesc.${tactic.id}` as TranslationKey;
            return (
              <div key={tactic.id} style={{ display: 'contents' }}>
                {/* Vertical separator between Hire Ronin (order 3) and Imperial Poets (order 4) */}
                {idx === 3 && (
                  <div className="bidding-battle-resolution-separator">
                    <div className="bidding-separator-line" />
                    <span className="bidding-separator-text">{t('battle.battleResolution')}</span>
                    <div className="bidding-separator-line" />
                  </div>
                )}
                <div
                  className={`bidding-tactic-tile${isOver ? ' bidding-drop-highlight' : ''}`}
                  data-drop-target={tactic.id}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, tactic.id)}
                  onDragLeave={(e) => handleDragLeave(e, tactic.id)}
                  onDrop={(e) => handleDrop(e, tactic.id)}
                >
                  <div className="bidding-tactic-symbol">{TACTIC_SYMBOLS[tactic.id]}</div>
                  <div className="bidding-tactic-kanji">{TACTIC_KANJI[tactic.id]}</div>
                  <div className="bidding-tactic-name">{tactic.name}</div>
                  <div className="bidding-tactic-tooltip">
                    {t(tooltipKey)}
                  </div>
                  <div className="bidding-tactic-coins-area">
                    {tacticCoins.map(([coinId]) => (
                      <img
                        key={coinId}
                        src={coinImg}
                        alt="coin"
                        className="bidding-coin"
                        draggable
                        onDragStart={(e) => handleDragStart(e, coinId)}
                        onTouchStart={(e) => handleTouchStart(e, coinId)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                      />
                    ))}
                  </div>
                  <div className="bidding-tactic-count">
                    {tacticCoins.length > 0 && <span>{tacticCoins.length}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coin Pool */}
        <div
          className={`bidding-coin-pool${dragOverTarget === 'pool' ? ' bidding-drop-highlight' : ''}`}
          data-drop-target="pool"
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, 'pool')}
          onDragLeave={(e) => handleDragLeave(e, 'pool')}
          onDrop={(e) => handleDrop(e, 'pool')}
        >
          <p className="bidding-pool-label">
            {t('battle.coinPool')} ({totalAssigned}/{maxCoins})
          </p>
          <div className="bidding-pool-coins">
            {poolCoins.map(([coinId]) => (
              <img
                key={coinId}
                src={coinImg}
                alt="coin"
                className="bidding-coin"
                draggable
                onDragStart={(e) => handleDragStart(e, coinId)}
                onTouchStart={(e) => handleTouchStart(e, coinId)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            ))}
          </div>
        </div>

        {/* Confirm Button */}
        <button className="btn-primary bidding-confirm-btn" onClick={handleConfirm}>
          {t('battle.confirmBidsOverlay', { total: totalAssigned })}
        </button>
      </div>
    </div>
  );
};
