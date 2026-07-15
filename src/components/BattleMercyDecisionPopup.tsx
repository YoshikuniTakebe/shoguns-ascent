import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCE_COLORS } from '../types/game';
import { ClanShield } from './ClanShields';

export const BattleMercyDecisionPopup = () => {
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveBattleMercyDecision);
  const pending = gameState?.pendingBattleMercyDecision;
  if (!gameState || !pending) return null;

  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const clan = owner ? CLANS.find(candidate => candidate.id === owner.clanId) : null;
  const province = gameState.provinces[pending.provinceId];
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: clan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: clan?.color || '#c8a951' }}>Misericordia</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={24} />}
          <strong style={{ color: clan?.color }}>{owner?.name}</strong>
        </div>
        <p>
          Puedes perdonar todas las figuras rivales que moririan en{' '}
          <strong style={{ color: PROVINCE_COLORS[pending.provinceId] || '#fff' }}>{province?.name}</strong>
          {' '}y ganar <strong>2 PV</strong>.
        </p>
        {isOwner ? (
          <div className="battle-card-decision-actions">
            <button className="btn-primary" onClick={() => resolveDecision(true)}>Perdonar</button>
            <button className="btn-secondary" onClick={() => resolveDecision(false)}>Resolver bajas</button>
          </div>
        ) : (
          <p className="waiting-label">Esperando a que {owner?.name || 'el jugador'} decida...</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
