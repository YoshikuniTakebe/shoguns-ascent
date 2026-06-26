import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { VPIcon, CoinIcon, RoninIcon, HonorIcon } from './Icons';
import { useT } from '../i18n';

export const HarvestPopup = () => {
  const { gameState, doAcknowledgeHarvest } = useGameStore();
  const t = useT();

  // Track whether the initial "all players received" popup has been dismissed
  const [initialConfirmed, setInitialConfirmed] = useState(false);

  // Reset when harvestMandateActive changes (new harvest cycle)
  useEffect(() => {
    if (!gameState?.harvestMandateActive) {
      setInitialConfirmed(false);
    }
  }, [gameState?.harvestMandateActive]);

  if (!gameState || !gameState.harvestPopupVisible || !gameState.harvestMandateActive) return null;

  // Show the initial confirmation popup before province rewards
  if (gameState.harvestResolutionIndex === 0 && !initialConfirmed) {
    return (
      <div className="harvest-popup-backdrop">
        <div className="harvest-popup" style={{ borderColor: '#c8a951' }}>
          <h3 className="harvest-popup-title" style={{ color: '#c8a951' }}>
            {t('harvest.allPlayersReceived')}
          </h3>
          <div className="harvest-popup-rewards">
            <div className="harvest-popup-reward-item">
              <CoinIcon size={40} color="#DAA520" />
            </div>
          </div>
          <button className="btn-primary harvest-popup-btn" onClick={() => setInitialConfirmed(true)}>
            {t('harvest.accept')}
          </button>
        </div>
      </div>
    );
  }

  const currentEntry = gameState.harvestPlayerRewards[gameState.harvestResolutionIndex];
  if (!currentEntry) return null;

  const player = gameState.players.find(p => p.id === currentEntry.playerId);
  if (!player) return null;

  const clan = CLANS.find(c => c.id === player.clanId);
  const rewards = currentEntry.rewards;

  return (
    <div className="harvest-popup-backdrop">
      <div className="harvest-popup" style={{ borderColor: clan?.color || '#c8a951' }}>
        <h3 className="harvest-popup-title" style={{ color: clan?.color || '#c8a951' }}>
          {t('harvest.received', { name: player.name })}
        </h3>
        <div className="harvest-popup-rewards">
          {rewards.vp && rewards.vp > 0 && (
            <div className="harvest-popup-reward-item">
              <VPIcon size={40} color="#c8a951" />
              <span className="harvest-popup-reward-count">x{rewards.vp}</span>
            </div>
          )}
          {rewards.coins && rewards.coins > 0 && (
            <div className="harvest-popup-reward-item">
              <CoinIcon size={40} color="#DAA520" />
              <span className="harvest-popup-reward-count">x{rewards.coins}</span>
            </div>
          )}
          {rewards.ronin && rewards.ronin > 0 && (
            <div className="harvest-popup-reward-item">
              <RoninIcon size={40} color="#e0e0e0" />
              <span className="harvest-popup-reward-count">x{rewards.ronin}</span>
            </div>
          )}
          {rewards.honor && rewards.honor > 0 && (
            <div className="harvest-popup-reward-item">
              <HonorIcon size={40} color="#9b59b6" />
              <span className="harvest-popup-reward-count">x{rewards.honor}</span>
            </div>
          )}
        </div>
        <button className="btn-primary harvest-popup-btn" onClick={doAcknowledgeHarvest}>
          {t('harvest.accept')}
        </button>
      </div>
    </div>
  );
};
