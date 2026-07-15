import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon, VPIcon } from './Icons';

export const VassalDecisionPopup = () => {
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveVassal);
  const pending = gameState?.pendingVassalDecision;
  if (!gameState || !pending) return null;
  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const clan = owner ? CLANS.find(candidate => candidate.id === owner.clanId) : null;
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;
  const copyLabel = pending.copyNumber > 1 ? ` (${pending.copyNumber}ª copia)` : '';

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: clan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: clan?.color || '#c8a951' }}>Path of the Vassal{copyLabel}</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={24} />}
          <strong style={{ color: clan?.color }}>{owner?.name}</strong>
        </div>
        <p className="benevolence-prompt">
          ¿Quieres donar <CoinIcon size={22} color="#e2b93b" /> <strong>2</strong> por <VPIcon size={22} color={clan?.color} /> <strong>2</strong>?
        </p>
        {isOwner ? (
          <div className="battle-card-decision-actions">
            <button className="btn-primary" onClick={() => resolveDecision(true)}>Aceptar</button>
            <button className="btn-secondary" onClick={() => resolveDecision(false)}>Rechazar</button>
          </div>
        ) : (
          <p className="waiting-label">Esperando a que {owner?.name || 'el jugador'} decida...</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
