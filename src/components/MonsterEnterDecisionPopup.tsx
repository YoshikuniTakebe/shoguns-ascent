import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCES_DATA, PROVINCE_COLORS, SEASON_CARDS_DATA } from '../types/game';
import type { Figure } from '../types/game';
import { ClanShield } from './ClanShields';
import { MonsterIcon } from './Icons';
import { canBeKilledByPlayer } from '../utils/gameLogic';
import { useT } from '../i18n';

const IMMUNE_MONSTERS = ['su-yurei', 'sp-fukurokuju'];

function monsterName(figure: Figure): string {
  return SEASON_CARDS_DATA.find(card => card.id === figure.monsterCardId)?.name || 'Monstruo';
}

export const MonsterEnterDecisionPopup = () => {
  const t = useT();
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveMonsterEnterDecision);
  const biddingMapPeek = useGameStore(state => state.biddingMapPeek);
  const setBiddingMapPeek = useGameStore(state => state.setBiddingMapPeek);
  const pending = gameState?.pendingMonsterEnterDecision;
  const key = pending ? `${pending.type}:${pending.sourceFigureId}:${pending.provinceId}` : '';
  const [useBenten, setUseBenten] = useState(false);
  const [bentenChoiceMade, setBentenChoiceMade] = useState(false);
  const [selectedByPlayer, setSelectedByPlayer] = useState<Record<string, string>>({});
  const [destinationId, setDestinationId] = useState('');
  const [useMercy, setUseMercy] = useState(false);

  useEffect(() => {
    setUseBenten(false);
    setBentenChoiceMade(false);
    setSelectedByPlayer({});
    setDestinationId('');
    setUseMercy(false);
  }, [key]);

  const candidates = useMemo(() => {
    if (!gameState || !pending) return {} as Record<string, Figure[]>;
    const province = gameState.provinces[pending.provinceId];
    const grouped: Record<string, Figure[]> = {};
    const ownerHonor = gameState.honorTrack.indexOf(pending.ownerId);
    for (const figure of province?.figures || []) {
      if (pending.type === 'benten') {
        if (figure.type !== 'monster' || figure.owner === pending.ownerId || IMMUNE_MONSTERS.includes(figure.monsterCardId || '')) continue;
      } else if (figure.owner === pending.ownerId || gameState.honorTrack.indexOf(figure.owner) >= ownerHonor || (figure.type !== 'bushi' && figure.type !== 'shinto') || !canBeKilledByPlayer(gameState, pending.provinceId, figure, pending.ownerId)) continue;
      grouped[figure.owner] = [...(grouped[figure.owner] || []), figure];
    }
    return grouped;
  }, [gameState, pending]);

  if (!gameState || !pending || biddingMapPeek) return null;
  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const ownerClan = owner ? CLANS.find(clan => clan.id === owner.clanId) : null;
  const hasMercy = !!owner?.seasonCards.some(card => card.id === 'su-mercy' || card.id === 'su-mercy-2');
  const province = gameState.provinces[pending.provinceId];
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;
  const adjacentIds = [...(PROVINCES_DATA.find(item => item.id === pending.provinceId)?.adjacentProvinces || []), ...(PROVINCES_DATA.find(item => item.id === pending.provinceId)?.seaRoutes || [])];
  const selectedIds = Object.values(selectedByPlayer);
  const canConfirm = pending.type === 'benten'
    ? selectedIds.length === 1 && !!destinationId
    : useMercy || Object.keys(candidates).every(playerId => !!selectedByPlayer[playerId]);
  const title = pending.type === 'benten' ? 'Benten' : 'Oni of Hate';

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: ownerClan?.color || '#c8a951' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><MonsterIcon size={38} color={ownerClan?.color || '#c8a951'} /></div>
        <h3 className="battle-popup-title" style={{ color: ownerClan?.color }}>{title}</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={isOwner ? 24 : 72} />}
          <strong style={{ color: ownerClan?.color }}>{owner?.name}</strong>
        </div>
        <p>Entra en <strong style={{ color: PROVINCE_COLORS[pending.provinceId] || '#fff' }}>{province?.name}</strong></p>

        {!isOwner ? (
          <p className="waiting-label">Esperando a que {owner?.name || 'el jugador'} resuelva {title}...</p>
        ) : pending.type === 'benten' && !bentenChoiceMade ? (
          <>
            <p>¿Quieres obligar a mover un monstruo rival?</p>
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
              <button className="btn-primary" onClick={() => { setUseBenten(true); setBentenChoiceMade(true); }}>Usar</button>
              <button className="btn-secondary" onClick={() => resolveDecision(false, {})}>Omitir</button>
            </div>
          </>
        ) : (
          <>
            {pending.type === 'oni-hate' && hasMercy && (
              <div className="battle-card-decision-mercy">
                <button className={!useMercy ? 'btn-primary' : 'btn-secondary'} onClick={() => setUseMercy(false)}>Aplicar bajas</button>
                <button className={useMercy ? 'btn-primary' : 'btn-secondary'} onClick={() => setUseMercy(true)}>Misericordia (+2 PV)</button>
              </div>
            )}
            <div className="battle-card-decision-groups">
              {!useMercy && Object.entries(candidates).map(([playerId, figures]) => {
                const player = gameState.players.find(candidate => candidate.id === playerId);
                const clan = player ? CLANS.find(candidate => candidate.id === player.clanId) : null;
                return (
                  <div className="battle-card-decision-group" key={playerId}>
                    <div className="battle-card-decision-player">
                      {player && <ClanShield clanId={player.clanId} size={21} />}
                      <strong style={{ color: clan?.color }}>{player?.name}</strong>
                    </div>
                    <div className="battle-card-choice-block">
                      <span className="battle-card-choice-label">Figura</span>
                      <div className="battle-card-choice-options">
                        {figures.map(figure => (
                          <button
                            key={figure.id}
                            type="button"
                            className={`battle-card-choice${selectedByPlayer[playerId] === figure.id ? ' selected' : ''}`}
                            style={{ '--choice-color': clan?.color || '#c8a951' } as CSSProperties}
                            onClick={() => {
                              setSelectedByPlayer(current => pending.type === 'benten'
                                ? { [playerId]: figure.id }
                                : { ...current, [playerId]: figure.id });
                              if (pending.type === 'benten') setDestinationId('');
                            }}
                          >
                            {pending.type === 'benten' ? monsterName(figure) : figure.type === 'bushi' ? 'Bushi' : 'Shinto'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {pending.type === 'benten' && selectedByPlayer[playerId] && (
                      <div className="battle-card-choice-block">
                        <span className="battle-card-choice-label">Provincia de destino</span>
                        <div className="battle-card-choice-options">
                          {adjacentIds.map(id => {
                            const provinceColor = PROVINCE_COLORS[id] || '#c8a951';
                            return (
                              <button
                                key={id}
                                type="button"
                                className={`battle-card-choice province${destinationId === id ? ' selected' : ''}`}
                                style={{ '--choice-color': provinceColor, color: provinceColor } as CSSProperties}
                                onClick={() => setDestinationId(id)}
                              >
                                {gameState.provinces[id]?.name || id}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
              {pending.type === 'benten' && useBenten && <button className="btn-secondary" onClick={() => { setBentenChoiceMade(false); setUseBenten(false); }}>Cancelar</button>}
              <button className="btn-primary" disabled={!canConfirm} onClick={() => resolveDecision(true, selectedByPlayer, destinationId, useMercy)}>Confirmar</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
