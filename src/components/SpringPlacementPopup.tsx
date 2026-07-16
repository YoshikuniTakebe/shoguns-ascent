import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, KAMI_DATA, PROVINCE_COLORS } from '../types/game';
import { ClanShield } from './ClanShields';
import { ShintoIcon, UndoIcon } from './Icons';

export const SpringPlacementPopup = () => {
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveSpringPlacement);
  const springLightSelectionMode = useGameStore(state => state.springLightSelectionMode);
  const springLightSelectedTempleId = useGameStore(state => state.springLightSelectedTempleId);
  const beginSpringLightSelection = useGameStore(state => state.beginSpringLightSelection);
  const undoSpringLightSelection = useGameStore(state => state.undoSpringLightSelection);
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
  const title = pending.type === 'kannushi' ? 'Camino del Kannushi' : pending.type === 'kenin' ? 'Camino del Kenin' : pending.type === 'samurai' ? 'Camino del Samurai' : 'Camino de la Luz';
  const copyLabel = pending.copyNumber > 1 ? ` (${pending.copyNumber}a copia)` : '';
  const sourceTemple = gameState.temples.find(temple => temple.figures.some(figure => figure.figureId === figureId));
  const valid = pending.type === 'kenin' || pending.type === 'samurai' ? !!provinceId : pending.type === 'light' ? !!templeId : !!figureId && !!templeId && sourceTemple?.id !== templeId;

  if (pending.type === 'light' && isOwner && springLightSelectionMode) {
    const selectedTemple = gameState.temples.find(temple => temple.id === springLightSelectedTempleId);
    const selectedKamiName = selectedTemple
      ? KAMI_DATA.find(kami => kami.type === selectedTemple.kamiType)?.name || selectedTemple.kamiType
      : null;
    return createPortal(
      <div className="spring-light-toolbar" style={{ borderColor: clan?.color || '#c8a951' }}>
        <div className="spring-light-toolbar-status">
          <ShintoIcon size={24} color={clan?.color || '#c8a951'} />
          <span>{selectedKamiName ? `Santuario de ${selectedKamiName}` : 'Elige un santuario'}</span>
        </div>
        <div className="spring-light-toolbar-actions">
          <button
            className="spring-light-undo"
            onClick={undoSpringLightSelection}
            disabled={!springLightSelectedTempleId}
            title="Deshacer"
            aria-label="Deshacer"
          >
            <UndoIcon size={20} color="currentColor" />
          </button>
          <button
            className="btn-primary"
            disabled={!springLightSelectedTempleId}
            onClick={() => resolveDecision(true, undefined, springLightSelectedTempleId || undefined)}
          >
            Confirmar
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: clan?.color || '#c8a951' }}>
        {pending.type === 'light' && (
          <div className="spring-light-popup-icon" style={{ color: clan?.color || '#c8a951' }}>
            <ShintoIcon size={42} color="currentColor" />
          </div>
        )}
        <h3 className="battle-popup-title spring-placement-title" style={{ color: clan?.color || '#c8a951' }}>{title}{copyLabel}</h3>
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
              <p className="spring-placement-description">
                Puedes colocar un Shinto adicional en uno de los santuarios.
              </p>
            )}
            {provinceId && <p><strong style={{ color: PROVINCE_COLORS[provinceId] }}>{gameState.provinces[provinceId]?.name}</strong></p>}
            <div className="battle-card-decision-actions spring-placement-actions">
              <button className="btn-secondary" onClick={() => resolveDecision(false)}>Omitir</button>
              {pending.type === 'light' ? (
                <button className="btn-primary" onClick={beginSpringLightSelection}>Elegir santuario</button>
              ) : (
                <button className="btn-primary" disabled={!valid} onClick={() => resolveDecision(true, provinceId || undefined, templeId || undefined, figureId || undefined)}>Confirmar</button>
              )}
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
