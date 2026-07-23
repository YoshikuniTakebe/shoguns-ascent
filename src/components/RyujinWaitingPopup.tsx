import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { useT } from '../i18n';
import { ClanShield } from './ClanShields';

export const RyujinWaitingPopup = () => {
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const t = useT();
  if (
    !gameState ||
    gameState.mode !== 'online' ||
    !gameState.kamiResolutionActive ||
    gameState.kamiResolutionStep !== 'interactive' ||
    !gameState.ryujinBuyActive
  ) return null;

  const temple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
  if (!temple || temple.kamiType !== 'ryujin' || !temple.winnerId || temple.winnerId === localPlayerId) return null;
  const winner = gameState.players.find(player => player.id === temple.winnerId);
  const clan = winner ? CLANS.find(candidate => candidate.id === winner.clanId) : null;

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card" style={{ borderColor: clan?.color || '#1E90FF' }}>
        <h3 className="battle-popup-title" style={{ color: '#1E90FF' }}>Ryujin</h3>
        <p className="battle-popup-message" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {winner && <ClanShield clanId={winner.clanId} size={60} />}
          <span style={{ color: clan?.color || '#fff' }}>
            {t('kami.resolution.ryujinWaiting', { name: winner?.name || '' })}
          </span>
        </p>
      </div>
    </div>,
    document.body,
  );
};
