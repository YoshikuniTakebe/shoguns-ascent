import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon } from './Icons';

export const BenevolencePopup = () => {
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveBenevolence);
  const pending = gameState?.pendingBenevolence;
  const noticeInProgress = gameState?.pendingRuleNotices?.[0]?.type === 'benevolence';
  const [recipientId, setRecipientId] = useState<string | null>(null);

  useEffect(() => setRecipientId(null), [pending?.currentCopy, pending?.ownerId]);
  if (!gameState || !pending || noticeInProgress) return null;

  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const ownerClan = owner ? CLANS.find(clan => clan.id === owner.clanId) : null;
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;
  const copyLabel = pending.currentCopy > 1 ? ` (${pending.currentCopy}ª copia)` : '';

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: ownerClan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: ownerClan?.color || '#c8a951' }}>Benevolence{copyLabel}</h3>
        <p className="benevolence-prompt">Entregar <CoinIcon size={22} color="#e2b93b" /> de lo gastado a:</p>
        {isOwner ? (
          <>
            <div className="battle-card-decision-groups">
              {gameState.players.filter(player => player.id !== pending.ownerId).map(player => {
                const clan = CLANS.find(candidate => candidate.id === player.clanId);
                const selected = recipientId === player.id;
                return (
                  <button
                    key={player.id}
                    className={`benevolence-player-badge${selected ? ' selected' : ''}`}
                    onClick={() => setRecipientId(player.id)}
                    style={{ borderColor: selected ? clan?.color : undefined }}
                  >
                    <ClanShield clanId={player.clanId} size={24} />
                    <strong style={{ color: clan?.color }}>{player.name}</strong>
                  </button>
                );
              })}
            </div>
            <div className="battle-card-decision-actions">
              <button className="btn-primary" disabled={!recipientId} onClick={() => resolveDecision(recipientId || undefined)}>Dar moneda</button>
              <button className="btn-secondary" onClick={() => resolveDecision()}>No dar monedas</button>
            </div>
          </>
        ) : (
          <p className="waiting-label">Esperando a que {owner?.name || 'el jugador'} termine...</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
