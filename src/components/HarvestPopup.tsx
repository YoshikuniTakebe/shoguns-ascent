import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCES_DATA, PROVINCE_COLORS } from '../types/game';
import { VPIcon, CoinIcon, RoninIcon, HonorIcon } from './Icons';
import { ClanShield } from './ClanShields';
import { useT } from '../i18n';

export const HarvestPopup = () => {
  const { gameState, doAcknowledgeHarvest, turnPopupPlayer } = useGameStore();
  const localPlayerId = useGameStore(s => s.localPlayerId);
  const t = useT();

  // Track whether the initial "all players received" popup has been dismissed for each player
  // Key: playerId whose coin popup has been confirmed
  const [coinConfirmedForPlayer, setCoinConfirmedForPlayer] = useState<string | null>(null);

  // Reset when harvestMandateActive changes (new harvest cycle)
  useEffect(() => {
    if (!gameState?.harvestMandateActive) {
      setCoinConfirmedForPlayer(null);
    }
  }, [gameState?.harvestMandateActive]);

  if (!gameState || !gameState.harvestPopupVisible || !gameState.harvestMandateActive) return null;

  // Don't show harvest popup while turn popup is still displayed - let turn popup show first
  if (turnPopupPlayer) return null;

  const isOnline = gameState.mode === 'online';
  const currentAcknowledgingPlayerId = gameState.harvestCurrentPlayerId;

  // Determine if the current coin popup has been shown for the current player
  const coinPopupShownForCurrentPlayer = coinConfirmedForPlayer === currentAcknowledgingPlayerId;

  // In online mode: if the local player is NOT the current acknowledging player, show waiting message
  if (isOnline && currentAcknowledgingPlayerId && currentAcknowledgingPlayerId !== localPlayerId) {
    const waitingPlayer = gameState.players.find(p => p.id === currentAcknowledgingPlayerId);
    const waitingClan = waitingPlayer ? CLANS.find(c => c.id === waitingPlayer.clanId) : null;
    return (
      <div className="harvest-popup-backdrop">
        <div className="harvest-popup" style={{ borderColor: waitingClan?.color || '#c8a951' }}>
          <h3 className="harvest-popup-title" style={{ color: waitingClan?.color || '#c8a951', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <ClanShield clanId={waitingPlayer?.clanId || ''} size={24} />
            {t('harvest.waitingFor', { name: waitingPlayer?.name || '' })}
          </h3>
        </div>
      </div>
    );
  }

  // Show the initial confirmation popup before province rewards for the current player
  // In online mode: show per-player (keyed by harvestCurrentPlayerId)
  // In hotseat mode: show once at the beginning (index 0)
  const shouldShowCoinPopup = isOnline
    ? !coinPopupShownForCurrentPlayer
    : gameState.harvestResolutionIndex === 0 && coinConfirmedForPlayer === null;

  if (shouldShowCoinPopup) {
    const acknowledgingPlayer = isOnline
      ? gameState.players.find(p => p.id === currentAcknowledgingPlayerId)
      : null;
    const acknowledgingClan = acknowledgingPlayer ? CLANS.find(c => c.id === acknowledgingPlayer.clanId) : null;

    return (
      <div className="harvest-popup-backdrop">
        <div className="harvest-popup" style={{ borderColor: acknowledgingClan?.color || '#c8a951' }}>
          <h3 className="harvest-popup-title" style={{ color: acknowledgingClan?.color || '#c8a951' }}>
            {t('harvest.allPlayersReceived')}
          </h3>
          <div className="harvest-popup-rewards">
            <div className="harvest-popup-reward-item">
              <CoinIcon size={40} color="#DAA520" />
            </div>
          </div>
          <button className="btn-primary harvest-popup-btn" onClick={() => {
            setCoinConfirmedForPlayer(currentAcknowledgingPlayerId || '__hotseat__');
          }}>
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
  const province = PROVINCES_DATA.find(p => p.id === currentEntry.provinceId);
  const provinceColor = PROVINCE_COLORS[currentEntry.provinceId] || '#fff';

  return (
    <div className="harvest-popup-backdrop">
      <div className="harvest-popup" style={{ borderColor: clan?.color || '#c8a951' }}>
        <h3 className="harvest-popup-title" style={{ color: clan?.color || '#c8a951', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <ClanShield clanId={player.clanId} size={24} />
          {t('harvest.received', { name: player.name })}
        </h3>
        {province && (
          <p style={{ margin: '4px 0 8px', textAlign: 'center', fontWeight: 'bold', fontStyle: 'italic', color: provinceColor }}>
            {province.name}
          </p>
        )}
        <div className="harvest-popup-rewards">
          {rewards.vp && rewards.vp > 0 && (
            <div className="harvest-popup-reward-item">
              <VPIcon size={40} color="#E63946" />
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
              <HonorIcon size={40} color="#E63946" />
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
