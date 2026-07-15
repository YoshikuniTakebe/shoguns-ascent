import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { useT } from '../i18n';
import { calculateForce } from '../utils/gameLogic';
import { getCardEffectKey, getCardNameKey } from '../utils/cardTranslations';
import { getMonsterFigureImage, TEMPLATE_FIGURE_IMG } from '../utils/figureImages';
import { renderCardEffect } from '../utils/renderCardEffect';
import { ClanShield } from './ClanShields';
import { FistIcon, MonsterIcon } from './Icons';

export const DaikaijuOceanMarker = () => {
  const gameState = useGameStore(state => state.gameState);
  const [open, setOpen] = useState(false);
  const t = useT();
  if (!gameState) return null;

  const ocean = gameState.provinces.ocean;
  const figure = ocean?.figures.find(item => item.type === 'monster' && item.monsterCardId === 'au-daikaiju');
  if (!ocean || !figure) return null;

  const owner = gameState.players.find(player => player.id === figure.owner);
  const clan = owner ? CLANS.find(item => item.id === owner.clanId) : null;
  const color = clan?.color || 'var(--accent-gold)';
  const force = calculateForce(ocean, figure.owner, gameState);
  const image = getMonsterFigureImage('au-daikaiju') || TEMPLATE_FIGURE_IMG;

  return (
    <>
      <button className="daikaiju-ocean-marker" style={{ borderColor: color }} onClick={() => setOpen(true)}>
        <MonsterIcon size={18} color={color} />
        <span style={{ color }}>Daikaiju está en el Océano</span>
      </button>
      {open && createPortal(
        <div className="figure-zoom-overlay" onClick={() => setOpen(false)}>
          <div className="figure-zoom-content" onClick={event => event.stopPropagation()}>
            <div className="figure-zoom-image">
              <img src={image} alt="Daikaiju" style={{ height: '60vh', objectFit: 'contain' }} />
            </div>
            <div className="figure-zoom-name" style={{ color }}>{t(getCardNameKey('au-daikaiju'))}</div>
            <div className="figure-zoom-power">{renderCardEffect(t(getCardEffectKey('au-daikaiju')))}</div>
            <div className="figure-zoom-info">
              <ClanShield clanId={owner?.clanId || ''} size={24} />
              <span className="figure-zoom-player-name" style={{ color }}>{owner?.name || ''}</span>
              <FistIcon size={18} color="var(--accent-gold)" />
              <span className="figure-zoom-force">{force}</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
