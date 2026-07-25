import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCE_COLORS } from '../types/game';
import { ClanShield } from './ClanShields';
import { canBeKilledByPlayer } from '../utils/gameLogic';
import { useT } from '../i18n';

export const NinjaDecisionPopup = () => {
  const t = useT();
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveNinjaDecision);
  const biddingMapPeek = useGameStore(state => state.biddingMapPeek);
  const setBiddingMapPeek = useGameStore(state => state.setBiddingMapPeek);
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
      .filter(figure => figure.type === 'bushi' && figure.owner !== pending.ownerId && canBeKilledByPlayer(gameState, provinceId, figure, pending.ownerId))
      .map(figure => ({ figure, provinceId, province })));
  }, [gameState, pending]);

  if (!gameState || !pending || biddingMapPeek || gameState.pendingMonsterEnterDecision || gameState.pendingMonkeyDecision) return null;
  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const clan = owner ? CLANS.find(candidate => candidate.id === owner.clanId) : null;
  const hasMercy = !!owner?.seasonCards.some(card => card.id === 'su-mercy' || card.id === 'su-mercy-2');
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: clan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: clan?.color || '#c8a951' }}>Camino del Ninja</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={isOwner ? 24 : 72} />}
          <strong style={{ color: clan?.color }}>{owner?.name}</strong>
        </div>
        {isOwner ? (
          <>
            <p>Puedes eliminar un Bushi rival y perder Honor.</p>
            <div className="battle-card-choice-block popup-choice-block">
              <span className="battle-card-choice-label">Bushi objetivo</span>
              <div className="battle-card-choice-options popup-choice-options">
                {targets.map(({ figure, province, provinceId }) => {
                const victim = gameState.players.find(player => player.id === figure.owner);
                const victimClan = victim ? CLANS.find(candidate => candidate.id === victim.clanId) : null;
                const provinceColor = PROVINCE_COLORS[provinceId] || '#c8a951';
                return (
                  <button
                    key={figure.id}
                    type="button"
                    className={`battle-card-choice popup-figure-choice${targetFigureId === figure.id ? ' selected' : ''}`}
                    style={{ '--choice-color': victimClan?.color || provinceColor } as CSSProperties}
                    onClick={() => setTargetFigureId(figure.id)}
                  >
                    {victim && <ClanShield clanId={victim.clanId} size={20} />}
                    <span style={{ color: victimClan?.color }}>{victim?.name}</span>
                    <span style={{ color: provinceColor }}>{province.name}</span>
                  </button>
                );
                })}
              </div>
            </div>
            {hasMercy && targetFigureId && (
              <div className="battle-card-decision-mercy">
                <button className={!useMercy ? 'btn-primary' : 'btn-secondary'} onClick={() => setUseMercy(false)}>Eliminar</button>
                <button className={useMercy ? 'btn-primary' : 'btn-secondary'} onClick={() => setUseMercy(true)}>Misericordia (+2 PV)</button>
              </div>
            )}
            <button
              className="bidding-peek-map-btn battle-card-map-button spring-placement-map-button"
              onClick={() => setBiddingMapPeek(true)}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {t('battle.viewMap')}
            </button>
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
