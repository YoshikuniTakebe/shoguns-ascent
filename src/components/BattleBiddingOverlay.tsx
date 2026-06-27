import { useState, useCallback, type DragEvent } from 'react';
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

  const handleDragStart = useCallback((e: DragEvent<HTMLImageElement>, coinId: string) => {
    e.dataTransfer.setData('text/plain', coinId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    const coinId = e.dataTransfer.getData('text/plain');
    if (coinId) {
      setCoinPositions(prev => ({ ...prev, [coinId]: targetId }));
    }
  }, []);

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
            return (
              <div
                key={tactic.id}
                className="bidding-tactic-tile"
                onDragOver={handleDragOver}
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
          className="bidding-coin-pool"
          onDragOver={handleDragOver}
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
