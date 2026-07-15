import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCE_COLORS } from '../types/game';
import { getMonsterFigureImage } from '../utils/figureImages';
import { ClanShield } from './ClanShields';

export const NureOnnaPopup = () => {
  const { gameState, localPlayerId, doNureOnnaDecision, biddingMapPeek, setBiddingMapPeek } = useGameStore();
  const pending = gameState?.pendingNureOnnaDecision;
  if (!gameState || !pending) return null;
  if (biddingMapPeek) return null;

  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const clan = owner ? CLANS.find(item => item.id === owner.clanId) : null;
  const source = gameState.provinces[pending.fromProvinceId];
  const destination = gameState.provinces[pending.battleProvinceId];
  const sourceColor = PROVINCE_COLORS[pending.fromProvinceId] || 'var(--text-primary)';
  const destinationColor = PROVINCE_COLORS[pending.battleProvinceId] || 'var(--text-primary)';
  const canDecide = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;

  return (
    <div className="harvest-popup-backdrop">
      <div className="harvest-popup rule-event-popup" style={{ borderColor: clan?.color || 'var(--accent-gold)' }}>
        <img className="rule-event-monster" src={getMonsterFigureImage('su-nure-onna') || ''} alt="Nure-Onna" />
        <h3 style={{ color: clan?.color || 'var(--accent-gold)' }}>Nure-Onna</h3>
        <div className="rule-event-players">
          <ClanShield clanId={owner?.clanId || ''} size={28} />
          <strong style={{ color: clan?.color }}>{owner?.name}</strong>
        </div>
        {canDecide ? (
          <>
            <p>¿Quieres mover Nure-Onna de <strong style={{ color: sourceColor }}>{source?.name}</strong> a <strong style={{ color: destinationColor }}>{destination?.name}</strong> para participar en esta batalla?</p>
            <button
              className="bidding-peek-map-btn"
              onClick={() => setBiddingMapPeek(true)}
              title="Ver Mapa"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Ver Mapa</span>
            </button>
            <div className="popup-actions">
              <button className="btn-primary" onClick={() => doNureOnnaDecision(true)}>Aceptar</button>
              <button className="btn-secondary" onClick={() => doNureOnnaDecision(false)}>Rechazar</button>
            </div>
          </>
        ) : (
          <p>Esperando a que {owner?.name} decida si Nure-Onna se une a la batalla de <strong style={{ color: destinationColor }}>{destination?.name}</strong>.</p>
        )}
      </div>
    </div>
  );
};
