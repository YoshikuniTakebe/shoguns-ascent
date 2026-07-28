import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import { useT } from '../i18n';

export const SnakeDecisionPopup = () => {
  const t = useT();
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveSnakeDecision);
  const pending = gameState?.pendingSnakeDecision;
  if (!gameState || !pending || gameState.pendingRuleNotices?.length) return null;
  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const clan = owner ? CLANS.find(candidate => candidate.id === owner.clanId) : null;
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: clan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: clan?.color || '#c8a951' }}>{t('decision.snake.title')}</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={isOwner ? 28 : 84} />}
          <strong style={{ color: clan?.color }}>{owner?.name}</strong>
        </div>
        {isOwner ? (
          <>
            <p>{t('decision.snake.question')}</p>
            <div className="battle-card-decision-actions">
              <button className="btn-secondary" onClick={() => resolveDecision(false)}>No traicionar</button>
              <button className="btn-primary" onClick={() => resolveDecision(true)}>Traicionar</button>
            </div>
          </>
        ) : (
          <p className="waiting-label">{t('common.waitingForResolution', { name: owner?.name || '', effect: 'Way of the Snake' })}</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
