import { useState, useCallback, useEffect, useRef, type DragEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { WAR_TACTICS } from '../types/game';
import coinImg from '../img/coin.png';
import { useT } from '../i18n';

interface BattleBiddingOverlayProps {
  playerName: string;
  playerClanColor: string;
  maxCoins: number;
  provinceName: string;
  battleNumber: number;
  onConfirm: (bids: Record<string, number>) => void;
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
  maxCoins,
  provinceName,
  battleNumber,
  onConfirm,
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
      setCoinPositions(prev => ({ ...prev, [coinId]: targetId }));
    }
  }, []);

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
          setCoinPositions(prev => ({ ...prev, [coinId]: targetId }));
          setDragOverTarget(null);
          return;
        }
        el = el.parentElement;
      }
    }

    setDragOverTarget(null);
  }, []);

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
            {t('battle.battleNumber', { number: battleNumber })}: {provinceName}
          </h2>
          <p className="bidding-overlay-player" style={{ color: playerClanColor }}>
            {playerName} - {t('battle.warTactics')}
          </p>
        </div>

        {/* Tactic Tiles */}
        <div className="bidding-tactics-row">
          {WAR_TACTICS.map(tactic => {
            const tacticCoins = Object.entries(coinPositions).filter(([, pos]) => pos === tactic.id);
            const isOver = dragOverTarget === tactic.id;
            return (
              <div
                key={tactic.id}
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
