import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, KAMI_DATA, PROVINCE_COLORS } from '../types/game';
import { ClanShield } from './ClanShields';
import { ShintoIcon, UndoIcon } from './Icons';
import { useT } from '../i18n';

export const SpringPlacementPopup = () => {
  const t = useT();
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveSpringPlacement);
  const springLightSelectionMode = useGameStore(state => state.springLightSelectionMode);
  const springLightSelectedTempleId = useGameStore(state => state.springLightSelectedTempleId);
  const beginSpringLightSelection = useGameStore(state => state.beginSpringLightSelection);
  const undoSpringLightSelection = useGameStore(state => state.undoSpringLightSelection);
  const biddingMapPeek = useGameStore(state => state.biddingMapPeek);
  const setBiddingMapPeek = useGameStore(state => state.setBiddingMapPeek);
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

  if (!gameState || !pending || biddingMapPeek || gameState.pendingMonsterEnterDecision || gameState.pendingMonkeyDecision || gameState.pendingNinjaDecision || gameState.pendingBenevolence) return null;
  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const clan = owner ? CLANS.find(candidate => candidate.id === owner.clanId) : null;
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;
  const title = pending.type === 'kannushi'
    ? t('decision.spring.kannushiTitle')
    : pending.type === 'kenin'
      ? t('decision.spring.keninTitle')
      : pending.type === 'samurai'
        ? t('decision.spring.samuraiTitle')
        : t('decision.spring.lightTitle');
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
          <span>{selectedKamiName ? t('decision.spring.shrineOf', { name: selectedKamiName }) : t('decision.spring.chooseShrine')}</span>
        </div>
        <div className="spring-light-toolbar-actions">
          <button
            className="spring-light-undo"
            onClick={undoSpringLightSelection}
            disabled={!springLightSelectedTempleId}
            title={t('common.undo')}
            aria-label={t('common.undo')}
          >
            <UndoIcon size={20} color="currentColor" />
          </button>
          <button
            className="btn-primary"
            disabled={!springLightSelectedTempleId}
            onClick={() => resolveDecision(true, undefined, springLightSelectedTempleId || undefined)}
          >
            {t('common.confirm')}
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
          {owner && <ClanShield clanId={owner.clanId} size={isOwner ? 24 : 72} />}
          <strong style={{ color: clan?.color }}>{owner?.name}</strong>
        </div>
        {isOwner ? (
          <>
            {pending.type === 'kenin' && (
              <div className="battle-card-choice-block spring-placement-choice-block">
                <span className="battle-card-choice-label">{t('decision.spring.keninProvince')}</span>
                <div className="battle-card-choice-options spring-placement-choice-options">
                  {fortressProvinces.map(province => {
                    const provinceColor = PROVINCE_COLORS[province.id] || '#c8a951';
                    return (
                      <button
                        key={province.id}
                        type="button"
                        className={`battle-card-choice province${provinceId === province.id ? ' selected' : ''}`}
                        style={{ '--choice-color': provinceColor, color: provinceColor } as CSSProperties}
                        onClick={() => setProvinceId(province.id)}
                      >
                        {province.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {pending.type === 'samurai' && (
              <div className="battle-card-choice-block spring-placement-choice-block">
                <span className="battle-card-choice-label">{t('decision.spring.samuraiProvince')}</span>
                <div className="battle-card-choice-options spring-placement-choice-options">
                  {samuraiProvinces.map(province => {
                    const provinceColor = PROVINCE_COLORS[province.id] || '#c8a951';
                    return (
                      <button
                        key={province.id}
                        type="button"
                        className={`battle-card-choice province${provinceId === province.id ? ' selected' : ''}`}
                        style={{ '--choice-color': provinceColor, color: provinceColor } as CSSProperties}
                        onClick={() => setProvinceId(province.id)}
                      >
                        {province.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {pending.type === 'kannushi' && (
              <>
                <div className="battle-card-choice-block spring-placement-choice-block">
                  <span className="battle-card-choice-label">{t('decision.spring.shintoToMove')}</span>
                  <div className="battle-card-choice-options spring-placement-choice-options">
                    {gameState.temples.flatMap(temple => temple.figures
                      .filter(figure => figure.playerId === pending.ownerId)
                      .map(figure => (
                        <button
                          key={figure.figureId}
                          type="button"
                          className={`battle-card-choice${figureId === figure.figureId ? ' selected' : ''}`}
                          style={{ '--choice-color': clan?.color || '#c8a951' } as CSSProperties}
                          onClick={() => {
                            setFigureId(figure.figureId);
                            setTempleId('');
                          }}
                        >
                          {KAMI_DATA.find(kami => kami.type === temple.kamiType)?.name || temple.kamiType}
                        </button>
                      )))}
                  </div>
                </div>
                <div className="battle-card-choice-block spring-placement-choice-block">
                  <span className="battle-card-choice-label">{t('decision.spring.destinationShrine')}</span>
                  <div className="battle-card-choice-options spring-placement-choice-options">
                    {gameState.temples
                      .filter(temple => temple.id !== sourceTemple?.id && temple.figures.length < gameState.players.length)
                      .map(temple => (
                        <button
                          key={temple.id}
                          type="button"
                          className={`battle-card-choice${templeId === temple.id ? ' selected' : ''}`}
                          style={{ '--choice-color': '#c8a951' } as CSSProperties}
                          disabled={!figureId}
                          onClick={() => setTempleId(temple.id)}
                        >
                          {KAMI_DATA.find(kami => kami.type === temple.kamiType)?.name || temple.kamiType}
                        </button>
                      ))}
                  </div>
                </div>
              </>
            )}
            {pending.type === 'light' && (
              <p className="spring-placement-description">
                {t('decision.spring.light')}
              </p>
            )}
            {pending.type !== 'light' && (
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
            )}
            <div className="battle-card-decision-actions spring-placement-actions">
              <button className="btn-secondary" onClick={() => resolveDecision(false)}>{t('common.skip')}</button>
              {pending.type === 'light' ? (
                <button className="btn-primary" onClick={beginSpringLightSelection}>{t('common.chooseShrine')}</button>
              ) : (
                <button className="btn-primary" disabled={!valid} onClick={() => resolveDecision(true, provinceId || undefined, templeId || undefined, figureId || undefined)}>{t('common.confirm')}</button>
              )}
            </div>
          </>
        ) : (
          <p className="waiting-label">{t('common.waitingForResolution', { name: owner?.name || '', effect: title })}</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
