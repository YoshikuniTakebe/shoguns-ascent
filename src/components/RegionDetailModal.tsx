import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { Figure } from '../types/game';
import { useT } from '../i18n';
import { BushiIcon, ShintoIcon, DaimyoIcon, MonsterIcon } from './Icons';
import { getMonsterImage, getCastleImage } from '../utils/figureImages';

interface RegionDetailModalProps {
  regionId: string;
  onClose: () => void;
}

/** Kami sparkle icon */
const KamiIcon = ({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    <path d="M12 2L13.5 8.5L20 7L15 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L9 12L4 7L10.5 8.5Z" />
  </svg>
);

/**
 * Assigns a figure to a diorama layer based on its type.
 * Layer 3 (back): Shinto, Kami
 * Layer 2 (middle): Fortress, Monster
 * Layer 1 (front): Bushi, Daimyo
 */
function getLayer(figure: Figure): 1 | 2 | 3 {
  switch (figure.type) {
    case 'shinto':
    case 'kami':
      return 3;
    case 'fortress':
    case 'monster':
      return 2;
    case 'bushi':
    case 'daimyo':
    default:
      return 1;
  }
}

interface DioramaFigureProps {
  figure: Figure;
  ownerColor: string;
  ownerClanId: string;
  iconSize: number;
}

const DioramaFigure = ({ figure, ownerColor, ownerClanId, iconSize }: DioramaFigureProps) => {
  // Monster with actual image
  if (figure.type === 'monster' && figure.monsterCardId) {
    const img = getMonsterImage(figure.monsterCardId);
    if (img) {
      return (
        <div className="region-diorama-figure" style={{ borderColor: ownerColor, boxShadow: `0 0 8px ${ownerColor}` }}>
          <img src={img} alt="Monster" className="region-diorama-figure-img" style={{ height: iconSize * 2.2 }} />
        </div>
      );
    }
    // Fallback to SVG icon if image not found
    return (
      <div className="region-diorama-figure" style={{ borderColor: ownerColor, boxShadow: `0 0 8px ${ownerColor}` }}>
        <MonsterIcon size={iconSize} color={ownerColor} />
      </div>
    );
  }

  // Fortress with castle image
  if (figure.type === 'fortress') {
    const img = getCastleImage(ownerClanId);
    if (img) {
      return (
        <div className="region-diorama-figure" style={{ borderColor: ownerColor, boxShadow: `0 0 8px ${ownerColor}` }}>
          <img src={img} alt="Castle" className="region-diorama-figure-img" style={{ height: iconSize * 2.2 }} />
        </div>
      );
    }
  }

  // SVG icons for bushi, daimyo, shinto, kami
  const renderIcon = () => {
    switch (figure.type) {
      case 'bushi':
        return <BushiIcon size={iconSize} color={ownerColor} />;
      case 'daimyo':
        return <DaimyoIcon size={iconSize} color={ownerColor} />;
      case 'shinto':
        return <ShintoIcon size={iconSize} color={ownerColor} />;
      case 'kami':
        return <KamiIcon size={iconSize} color={ownerColor} />;
      default:
        return <BushiIcon size={iconSize} color={ownerColor} />;
    }
  };

  return (
    <div className="region-diorama-figure" style={{ borderColor: ownerColor, boxShadow: `0 0 8px ${ownerColor}` }}>
      {renderIcon()}
    </div>
  );
};

export const RegionDetailModal = ({ regionId, onClose }: RegionDetailModalProps) => {
  const { gameState } = useGameStore();
  const t = useT();

  if (!gameState) return null;

  const province = gameState.provinces[regionId];
  if (!province) return null;

  // Separate figures into layers
  const backFigures: { figure: Figure; ownerColor: string; ownerClanId: string }[] = [];
  const midFigures: { figure: Figure; ownerColor: string; ownerClanId: string }[] = [];
  const frontFigures: { figure: Figure; ownerColor: string; ownerClanId: string }[] = [];

  for (const fig of province.figures) {
    const player = gameState.players.find(p => p.id === fig.owner);
    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
    const ownerColor = clan?.color || '#666';
    const ownerClanId = clan?.id || '';

    const layer = getLayer(fig);
    const entry = { figure: fig, ownerColor, ownerClanId };
    if (layer === 3) backFigures.push(entry);
    else if (layer === 2) midFigures.push(entry);
    else frontFigures.push(entry);
  }

  return (
    <div className="region-diorama-backdrop" onClick={onClose}>
      <div className="region-diorama-modal" onClick={(e) => e.stopPropagation()}>
        <button className="region-diorama-close" onClick={onClose}>&times;</button>
        <h2 className="region-diorama-title">{province.name}</h2>

        {province.figures.length === 0 ? (
          <p className="region-diorama-empty">{t('regionDetail.empty')}</p>
        ) : (
          <div className="region-diorama-stage">
            {/* Layer 3 - Back (top of window): Shinto, Kami */}
            <div className="region-diorama-layer region-diorama-layer-back">
              {backFigures.map(({ figure, ownerColor, ownerClanId }) => (
                <DioramaFigure
                  key={figure.id}
                  figure={figure}
                  ownerColor={ownerColor}
                  ownerClanId={ownerClanId}
                  iconSize={28}
                />
              ))}
            </div>

            {/* Layer 2 - Middle: Fortress, Monster */}
            <div className="region-diorama-layer region-diorama-layer-mid">
              {midFigures.map(({ figure, ownerColor, ownerClanId }) => (
                <DioramaFigure
                  key={figure.id}
                  figure={figure}
                  ownerColor={ownerColor}
                  ownerClanId={ownerClanId}
                  iconSize={36}
                />
              ))}
            </div>

            {/* Layer 1 - Front (bottom of window): Bushi, Daimyo */}
            <div className="region-diorama-layer region-diorama-layer-front">
              {frontFigures.map(({ figure, ownerColor, ownerClanId }) => (
                <DioramaFigure
                  key={figure.id}
                  figure={figure}
                  ownerColor={ownerColor}
                  ownerClanId={ownerClanId}
                  iconSize={44}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
