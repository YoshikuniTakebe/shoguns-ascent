import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, KAMI_DATA, PROVINCE_COLORS } from '../types/game';
import { ClanShield } from './ClanShields';

export const SpringPlacementPopup = () => {
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveSpringPlacement);
  const pending = gameState?.pendingSpringPlacement;
  const [provinceId, setProvinceId] = useState('');
  const [templeId, setTempleId] = useState('');
  const [figureId, setFigureId] = useState('');

  useEffect(() => {
    setProvinceId('');
    setTempleId('');
    setFigureId('');
  }, [pending?.type, pending?.ownerId, pending?.copyNumber]);

  const fortressProvinces = useMemo(() => {
    if (!gameState || !pending) return [];
    return Object.values(gameState.provinces).filter(province => province.id !== 'ocean' && province.figures.some(figure => figure.owner === pending.ownerId && (figure.type === 'fortress' || figure.monsterCardId === 'sp-fukurokuju')));
  }, [gameState, pending]);

  const samuraiProvinces = useMemo(() => {
    if (!gameState || !pending) return [];
    const owner = gameState.players.find(player => player.id === pending.ownerId);
    return Object.values(gameState.provinces).filter(province => {
      if (province.id === 'ocean') return false;
      if (owner?.clanId !== 'luna') return true;
      return province.figures.filter(figure => figure.owner === pending.ownerId && figure.type !== 'fortress').length < 2;
    });
  }, [gameState, pending]);

  if (!gameState || !pending || gameState.pendingMonsterEnterDecision || gameState.pendingMonkeyDecision || gameState.pendingNinjaDecision || gameState.pendingBenevolence) return null;
  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const clan = owner ? CLANS.find(candidate => candidate.id === owner.clanId) : null;
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;
  const title = pending.type === 'kannushi' ? 'Path of the Kannushi' : pending.type === 'kenin' ? 'Path of the Kenin' : pending.type === 'samurai' ? 'Path of the Samurai' : 'Path of the Light';
  const copyLabel = pending.copyNumber > 1 ? ` (${pending.copyNumber}ª copia)` : '';
  const sourceTemple = gameState.temples.find(temple => temple.figures.some(figure => figure.figureId === figureId));
  const valid = pending.type === 'kenin' || pending.type === 'samurai' ? !!provinceId : pending.type === 'light' ? !!templeId : !!figureId && !!templeId && sourceTemple?.id !== templeId;

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: clan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: clan?.color || '#c8a951' }}>{title}{copyLabel}</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={24} />}
          <strong style={{ color: clan?.color }}>{owner?.name}</strong>
        </div>
        {isOwner ? (
          <>
            {pending.type === 'kenin' && (
              <select value={provinceId} onChange={event => setProvinceId(event.target.value)}>
                <option value="">Elige una Fortaleza</option>
                {fortressProvinces.map(province => <option key={province.id} value={province.id}>{province.name}</option>)}
              </select>
            )}
            {pending.type === 'samurai' && (
              <select value={provinceId} onChange={event => setProvinceId(event.target.value)}>
                <option value="">Elige una provincia</option>
                {samuraiProvinces.map(province => <option key={province.id} value={province.id}>{province.name}</option>)}
              </select>
            )}
            {pending.type === 'kannushi' && (
              <>
                <select value={figureId} onChange={event => { setFigureId(event.target.value); setTempleId(''); }}>
                  <option value="">Elige un Shinto</option>
                  {gameState.temples.flatMap(temple => temple.figures.filter(figure => figure.playerId === pending.ownerId).map(figure => (
                    <option key={figure.figureId} value={figure.figureId}>{KAMI_DATA.find(kami => kami.type === temple.kamiType)?.name || temple.kamiType}</option>
                  ))) }
                </select>
                <select value={templeId} disabled={!figureId} onChange={event => setTempleId(event.target.value)}>
                  <option value="">Elige santuario de destino</option>
                  {gameState.temples.filter(temple => temple.id !== sourceTemple?.id && temple.figures.length < gameState.players.length).map(temple => (
                    <option key={temple.id} value={temple.id}>{KAMI_DATA.find(kami => kami.type === temple.kamiType)?.name || temple.kamiType}</option>
                  ))}
                </select>
              </>
            )}
            {pending.type === 'light' && (
              <select value={templeId} onChange={event => setTempleId(event.target.value)}>
                <option value="">Elige un santuario</option>
                {gameState.temples.filter(temple => temple.figures.length < gameState.players.length).map(temple => (
                  <option key={temple.id} value={temple.id}>{KAMI_DATA.find(kami => kami.type === temple.kamiType)?.name || temple.kamiType}</option>
                ))}
              </select>
            )}
            {provinceId && <p><strong style={{ color: PROVINCE_COLORS[provinceId] }}>{gameState.provinces[provinceId]?.name}</strong></p>}
            <div className="battle-card-decision-actions">
              <button className="btn-secondary" onClick={() => resolveDecision(false)}>Omitir</button>
              <button className="btn-primary" disabled={!valid} onClick={() => resolveDecision(true, provinceId || undefined, templeId || undefined, figureId || undefined)}>Confirmar</button>
            </div>
          </>
        ) : (
          <p className="waiting-label">Esperando a que {owner?.name || 'el jugador'} resuelva {title}...</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
