import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';

export const GenerosityPopup = () => {
  const { gameState, localPlayerId, doChooseGenerosityRecipient, doRespondToGenerosity } = useGameStore();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const pending = gameState?.generosityPending;

  useEffect(() => setSelectedPlayerId(null), [pending?.fromPlayerId, pending?.stage]);

  if (!gameState || !pending) return null;
  const viewerId = gameState.mode === 'online' ? localPlayerId :
    pending.stage === 'choose-recipient' ? pending.fromPlayerId : pending.toPlayerId;
  const shouldShow = pending.stage === 'choose-recipient'
    ? viewerId === pending.fromPlayerId
    : viewerId === pending.toPlayerId;
  if (!shouldShow) return null;

  const sender = gameState.players.find(p => p.id === pending.fromPlayerId);
  const recipients = gameState.players.filter(p => p.id !== pending.fromPlayerId);

  return (
    <div className="trade-offer-popup-backdrop">
      <div className="trade-offer-popup">
        <h3 className="trade-offer-title">Generosidad</h3>
        <p className="trade-modal-subtitle">
          {pending.stage === 'choose-recipient'
            ? '¿Quieres ofrecer una moneda?'
            : `${sender?.name || 'Un jugador'} quiere ofrecerte una moneda. ¿Aceptas?`}
        </p>

        {pending.stage === 'choose-recipient' && (
          <div className="trade-player-list">
            {recipients.map(player => {
              const clan = CLANS.find(c => c.id === player.clanId);
              const selected = selectedPlayerId === player.id;
              return (
                <button
                  key={player.id}
                  className={`trade-player-btn${selected ? ' selected' : ''}`}
                  style={{ borderColor: selected ? (clan?.color || '#c8a951') : 'transparent' }}
                  onClick={() => setSelectedPlayerId(player.id)}
                >
                  <ClanShield clanId={player.clanId} size={28} />
                  <span style={{ color: clan?.color, fontWeight: 'bold' }}>{player.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="trade-offer-actions">
          <button
            className="btn-primary trade-offer-accept"
            disabled={pending.stage === 'choose-recipient' && !selectedPlayerId}
            onClick={() => pending.stage === 'choose-recipient'
              ? doChooseGenerosityRecipient(selectedPlayerId)
              : doRespondToGenerosity(true)}
          >
            Aceptar
          </button>
          <button
            className="btn-secondary trade-offer-reject"
            onClick={() => pending.stage === 'choose-recipient'
              ? doChooseGenerosityRecipient(null)
              : doRespondToGenerosity(false)}
          >
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
};
