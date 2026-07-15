import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCE_COLORS } from '../types/game';
import { ClanShield } from './ClanShields';

export const NinjaDecisionPopup = () => {
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveNinjaDecision);
  const pending = gameState?.pendingNinjaDecision;
  const [targetFigureId, setTargetFigureId] = useState('');
  const [useMercy, setUseMercy] = useState(false);

  useEffect(() => {
    setTargetFigureId('');
    setUseMercy(false);
  }, [pending?.ownerId]);

  const targets = useMemo(() => {
    if (!gameState || !pending) return [];
    return Object.entries(gameState.provinces).flatMap(([provinceId, province]) => province.figures
      .filter(figure => figure.type === 'bushi' && figure.owner !== pending.ownerId)
      .map(figure => ({ figure, provinceId, province })));
  }, [gameState, pending]);

  if (!gameState || !pending || gameState.pendingMonsterEnterDecision || gameState.pendingMonkeyDecision) return null;
  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const clan = owner ? CLANS.find(candidate => candidate.id === owner.clanId) : null;
  const hasMercy = !!owner?.seasonCards.some(card => card.id === 'su-mercy' || card.id === 'su-mercy-2');
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: clan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: clan?.color || '#c8a951' }}>Camino del Ninja</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={24} />}
          <strong style={{ color: clan?.color }}>{owner?.name}</strong>
        </div>
        {isOwner ? (
          <>
            <p>Puedes eliminar un Bushi rival y perder Honor.</p>
            <select value={targetFigureId} onChange={event => setTargetFigureId(event.target.value)}>
              <option value="">Elige un Bushi</option>
              {targets.map(({ figure, province }) => {
                const victim = gameState.players.find(player => player.id === figure.owner);
                return <option key={figure.id} value={figure.id}>{victim?.name} - {province.name}</option>;
              })}
            </select>
            {targetFigureId && (() => {
              const selected = targets.find(target => target.figure.id === targetFigureId);
              return selected ? <p><strong style={{ color: PROVINCE_COLORS[selected.provinceId] || '#fff' }}>{selected.province.name}</strong></p> : null;
            })()}
            {hasMercy && targetFigureId && (
              <div className="battle-card-decision-mercy">
                <button className={!useMercy ? 'btn-primary' : 'btn-secondary'} onClick={() => setUseMercy(false)}>Eliminar</button>
                <button className={useMercy ? 'btn-primary' : 'btn-secondary'} onClick={() => setUseMercy(true)}>Misericordia (+2 PV)</button>
              </div>
            )}
            <div className="battle-card-decision-actions">
              <button className="btn-secondary" onClick={() => resolveDecision(false)}>Omitir</button>
              <button className="btn-primary" disabled={!targetFigureId} onClick={() => resolveDecision(true, targetFigureId, useMercy)}>Confirmar</button>
            </div>
          </>
        ) : (
          <p className="waiting-label">Esperando a que {owner?.name || 'el jugador'} resuelva Camino del Ninja...</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
