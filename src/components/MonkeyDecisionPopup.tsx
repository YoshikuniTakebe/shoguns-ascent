import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon, HonorIcon } from './Icons';

export const MonkeyDecisionPopup = () => {
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveMonkeyDecision);
  const pending = gameState?.pendingMonkeyDecision;
  const [targetId, setTargetId] = useState('');

  const targets = useMemo(() => {
    if (!gameState || !pending) return [];
    const opponents = gameState.players.filter(player => player.id !== pending.ownerId && player.coins > 0);
    const richestCoins = Math.max(0, ...opponents.map(player => player.coins));
    return opponents.filter(player => player.coins === richestCoins);
  }, [gameState, pending]);

  useEffect(() => {
    setTargetId(targets.length === 1 ? targets[0].id : '');
  }, [pending?.ownerId, pending?.copyNumber, targets]);

  if (!gameState || !pending || gameState.pendingRuleNotices?.length || gameState.pendingMonsterEnterDecision) return null;
  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const ownerClan = owner ? CLANS.find(clan => clan.id === owner.clanId) : null;
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: ownerClan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: ownerClan?.color || '#c8a951' }}>
          Camino del Mono{pending.copyNumber > 1 ? ` (${pending.copyNumber}ª copia)` : ''}
        </h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={28} />}
          <strong style={{ color: ownerClan?.color }}>{owner?.name}</strong>
        </div>
        {isOwner ? (
          <>
            <p>¿Quieres tomar <CoinIcon size={19} color="#f1c40f" /> <strong>1</strong> de uno de los rivales más ricos y perder <HonorIcon size={19} color={ownerClan?.color} /> Honor?</p>
            <div className="battle-card-target-list">
              {targets.map(target => {
                const clan = CLANS.find(candidate => candidate.id === target.clanId);
                return (
                  <button key={target.id} className={targetId === target.id ? 'btn-primary' : 'btn-secondary'} onClick={() => setTargetId(target.id)}>
                    <ClanShield clanId={target.clanId} size={22} />
                    <strong style={{ color: clan?.color }}>{target.name}</strong>
                    <CoinIcon size={17} color="#f1c40f" /> {target.coins}
                  </button>
                );
              })}
            </div>
            <div className="battle-card-decision-actions">
              <button className="btn-secondary" onClick={() => resolveDecision(false)}>No tomar moneda</button>
              <button className="btn-primary" disabled={!targetId} onClick={() => resolveDecision(true, targetId)}>Tomar moneda</button>
            </div>
          </>
        ) : (
          <p className="waiting-label">Esperando a que {owner?.name || 'el jugador'} resuelva Camino del Mono...</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
