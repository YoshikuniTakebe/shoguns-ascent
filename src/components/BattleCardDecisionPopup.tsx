import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCES_DATA, PROVINCE_COLORS, SEASON_CARDS_DATA } from '../types/game';
import type { Figure } from '../types/game';
import { ClanShield } from './ClanShields';
import { MonsterIcon } from './Icons';

const IMMUNE_MONSTERS = ['su-yurei', 'sp-fukurokuju'];

function figureName(figure: Figure): string {
  if (figure.type === 'monster') return SEASON_CARDS_DATA.find(card => card.id === figure.monsterCardId)?.name || 'Monstruo';
  return figure.type === 'bushi' ? 'Bushi' : figure.type === 'shinto' ? 'Shinto' : figure.type;
}

export const BattleCardDecisionPopup = () => {
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveBattleCardDecision);
  const biddingMapPeek = useGameStore(state => state.biddingMapPeek);
  const setBiddingMapPeek = useGameStore(state => state.setBiddingMapPeek);
  const pending = gameState?.pendingBattleCardDecision;
  const decisionKey = pending ? `${pending.type}:${pending.sourceFigureId}:${pending.provinceId}` : '';
  const [earthAccepted, setEarthAccepted] = useState(false);
  const [earthChoiceMade, setEarthChoiceMade] = useState(false);
  const [selectedByPlayer, setSelectedByPlayer] = useState<Record<string, string>>({});
  const [destinationsByFigure, setDestinationsByFigure] = useState<Record<string, string>>({});
  const [useMercy, setUseMercy] = useState(false);

  useEffect(() => {
    setEarthAccepted(false);
    setEarthChoiceMade(false);
    setSelectedByPlayer({});
    setDestinationsByFigure({});
    setUseMercy(false);
  }, [decisionKey]);

  const candidates = useMemo(() => {
    if (!gameState || !pending) return {} as Record<string, Figure[]>;
    const province = gameState.provinces[pending.provinceId];
    const grouped: Record<string, Figure[]> = {};
    for (const figure of province?.figures || []) {
      if (figure.type === 'daimyo' || (figure.type === 'monster' && IMMUNE_MONSTERS.includes(figure.monsterCardId || ''))) continue;
      if (pending.type === 'earth-dragon') {
        if (figure.owner === pending.ownerId || figure.type === 'fortress') continue;
      } else if (pending.type === 'fire-dragon') {
        if (figure.type === 'fortress' || (figure.type === 'monster' && figure.monsterCardId === 'su-fire-dragon')) continue;
      } else if (figure.owner === pending.ownerId || (figure.type !== 'bushi' && figure.type !== 'shinto')) continue;
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
  const names = {
    'earth-dragon': 'Earth Dragon',
    'fire-dragon': 'Fire Dragon',
    jorogumo: 'Jorogumo',
  } as const;
  const adjacentIds = pending.type === 'earth-dragon'
    ? [...(PROVINCES_DATA.find(item => item.id === pending.provinceId)?.adjacentProvinces || []), ...(PROVINCES_DATA.find(item => item.id === pending.provinceId)?.seaRoutes || [])]
    : [];
  const requiredOwners = Object.keys(candidates).filter(playerId => pending.type !== 'fire-dragon' || !useMercy || playerId === pending.ownerId);
  const jorogumoSelection = Object.values(selectedByPlayer)[0];
  const allFiguresSelected = pending.type === 'jorogumo'
    ? !!jorogumoSelection
    : requiredOwners.every(playerId => !!selectedByPlayer[playerId]);
  const allDestinationsSelected = pending.type !== 'earth-dragon' || requiredOwners.every(playerId => {
    const figureId = selectedByPlayer[playerId];
    return !!figureId && !!destinationsByFigure[figureId];
  });
  const canConfirm = allFiguresSelected && allDestinationsSelected;

  const chooseFigure = (playerId: string, figureId: string) => {
    const previousFigureId = selectedByPlayer[playerId];
    setSelectedByPlayer(current => pending.type === 'jorogumo' ? { [playerId]: figureId } : { ...current, [playerId]: figureId });
    if (previousFigureId && previousFigureId !== figureId) {
      setDestinationsByFigure(current => {
        const next = { ...current };
        delete next[previousFigureId];
        return next;
      });
    }
  };

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: ownerClan?.color || '#c8a951' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <MonsterIcon size={38} color={ownerClan?.color || '#c8a951'} />
        </div>
        <h3 className="battle-popup-title" style={{ color: ownerClan?.color || '#c8a951' }}>{names[pending.type]}</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={24} />}
          <strong style={{ color: ownerClan?.color }}>{owner?.name}</strong>
        </div>
        <p>
          Batalla en <strong style={{ color: PROVINCE_COLORS[pending.provinceId] || '#fff' }}>{province?.name}</strong>
        </p>

        {!isOwner ? (
          <p className="waiting-label">Esperando a que {owner?.name || 'el jugador'} resuelva {names[pending.type]}...</p>
        ) : pending.type === 'earth-dragon' && !earthChoiceMade ? (
          <>
            <p className="battle-card-decision-question">¿Quieres mover una figura de cada rival fuera de esta provincia?</p>
            <div className="battle-card-decision-actions">
              <button className="btn-primary" onClick={() => { setEarthAccepted(true); setEarthChoiceMade(true); }}>Usar</button>
              <button className="btn-secondary" onClick={() => resolveDecision(false, {})}>Omitir</button>
            </div>
          </>
        ) : (
          <>
            <div className="battle-card-decision-groups">
              {pending.type === 'fire-dragon' && hasMercy && Object.keys(candidates).some(playerId => playerId !== pending.ownerId) && (
                <div className="battle-card-decision-mercy">
                  <button className={!useMercy ? 'btn-primary' : 'btn-secondary'} onClick={() => setUseMercy(false)}>Aplicar bajas</button>
                  <button className={useMercy ? 'btn-primary' : 'btn-secondary'} onClick={() => setUseMercy(true)}>Misericordia (+2 PV)</button>
                </div>
              )}
              {Object.entries(candidates).filter(([playerId]) => pending.type !== 'fire-dragon' || !useMercy || playerId === pending.ownerId).map(([playerId, figures]) => {
                const player = gameState.players.find(candidate => candidate.id === playerId);
                const clan = player ? CLANS.find(candidate => candidate.id === player.clanId) : null;
                const selectedFigureId = selectedByPlayer[playerId];
                const selectedDestinationId = selectedFigureId ? destinationsByFigure[selectedFigureId] : '';
                return (
                  <div className="battle-card-decision-group" key={playerId} style={{ borderColor: clan?.color }}>
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
                            className={`battle-card-choice${selectedFigureId === figure.id ? ' selected' : ''}`}
                            style={{ '--choice-color': clan?.color || '#c8a951' } as React.CSSProperties}
                            onClick={() => chooseFigure(playerId, figure.id)}
                          >
                            {figureName(figure)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {pending.type === 'earth-dragon' && (
                      <div className="battle-card-choice-block">
                        <span className="battle-card-choice-label">Provincia de destino</span>
                        <div className="battle-card-choice-options">
                          {adjacentIds.map(provinceId => {
                            const provinceColor = PROVINCE_COLORS[provinceId] || '#c8a951';
                            return (
                              <button
                                key={provinceId}
                                type="button"
                                className={`battle-card-choice province${selectedDestinationId === provinceId ? ' selected' : ''}`}
                                style={{ '--choice-color': provinceColor, color: provinceColor } as React.CSSProperties}
                                disabled={!selectedFigureId}
                                onClick={() => selectedFigureId && setDestinationsByFigure(current => ({ ...current, [selectedFigureId]: provinceId }))}
                              >
                                {gameState.provinces[provinceId]?.name || provinceId}
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
            {pending.type === 'earth-dragon' && (
              <button className="bidding-peek-map-btn battle-card-map-button" onClick={() => setBiddingMapPeek(true)}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Ver mapa
              </button>
            )}
            <div className="battle-card-decision-actions">
              {pending.type === 'earth-dragon' && earthAccepted && <button className="btn-secondary" onClick={() => { setEarthChoiceMade(false); setEarthAccepted(false); }}>Cancelar</button>}
              <button className="btn-primary" disabled={!canConfirm} onClick={() => resolveDecision(true, selectedByPlayer, destinationsByFigure, useMercy)}>Confirmar</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
