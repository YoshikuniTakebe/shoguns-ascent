import { useGameStore } from '../store/gameStore';
import { CLANS, SPRING_CARDS, SUMMER_CARDS, AUTUMN_CARDS } from '../types/game';
import type { Figure } from '../types/game';
import { useT } from '../i18n';
import { BushiIcon, ShintoIcon, DaimyoIcon, MonsterIcon, FortressIcon } from './Icons';
import { getMonsterImage, getCastleImage } from '../utils/figureImages';
import { calculateForce } from '../utils/gameLogic';

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

/** Get monster card info (name and effect) by monsterCardId */
function getMonsterInfo(monsterCardId: string): { name: string; effect: string } | null {
  const allCards = [...SPRING_CARDS, ...SUMMER_CARDS, ...AUTUMN_CARDS];
  const card = allCards.find(c => c.id === monsterCardId);
  if (card) {
    return { name: card.name, effect: card.effect };
  }
  return null;
}

/** Get display name for a figure type */
function getFigureTypeName(type: string): string {
  switch (type) {
    case 'bushi': return 'Bushi';
    case 'daimyo': return 'Daimyo';
    case 'shinto': return 'Shinto';
    case 'fortress': return 'Fortress';
    case 'monster': return 'Monster';
    case 'kami': return 'Kami';
    default: return type;
  }
}

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
  ownerName: string;
  iconSize: number;
}

const DioramaFigure = ({ figure, ownerColor, ownerClanId, ownerName, iconSize }: DioramaFigureProps) => {
  // Build tooltip text
  let tooltipText = `${getFigureTypeName(figure.type)} - ${ownerName}`;
  if (figure.type === 'monster' && figure.monsterCardId) {
    const info = getMonsterInfo(figure.monsterCardId);
    if (info) {
      tooltipText = `${info.name} - ${ownerName}\n${info.effect}`;
    }
  }

  // Monster with actual image
  if (figure.type === 'monster' && figure.monsterCardId) {
    const img = getMonsterImage(figure.monsterCardId);
    if (img) {
      return (
        <div className="region-diorama-figure" style={{ borderColor: ownerColor, boxShadow: `0 0 8px ${ownerColor}` }} title={tooltipText}>
          <img src={img} alt="Monster" className="region-diorama-figure-img" style={{ height: iconSize * 2.2 }} />
          <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>{ownerName}</span>
        </div>
      );
    }
    // Fallback to MonsterIcon SVG when no image file exists for this monster
    return (
      <div className="region-diorama-figure" style={{ borderColor: ownerColor, boxShadow: `0 0 8px ${ownerColor}` }} title={tooltipText}>
        <MonsterIcon size={iconSize} color={ownerColor} />
        <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>{ownerName}</span>
      </div>
    );
  }

  // Fortress with castle image, with FortressIcon SVG as fallback
  if (figure.type === 'fortress') {
    const img = getCastleImage(ownerClanId);
    if (img) {
      return (
        <div className="region-diorama-figure" style={{ borderColor: ownerColor, boxShadow: `0 0 8px ${ownerColor}` }} title={tooltipText}>
          <img src={img} alt="Castle" className="region-diorama-figure-img" style={{ height: iconSize * 2.2 }} />
          <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>{ownerName}</span>
        </div>
      );
    }
    // Fallback to FortressIcon SVG if castle image not found
    return (
      <div className="region-diorama-figure" style={{ borderColor: ownerColor, boxShadow: `0 0 8px ${ownerColor}` }} title={tooltipText}>
        <FortressIcon size={iconSize} color={ownerColor} />
        <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>{ownerName}</span>
      </div>
    );
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
    <div className="region-diorama-figure" style={{ borderColor: ownerColor, boxShadow: `0 0 8px ${ownerColor}` }} title={tooltipText}>
      {renderIcon()}
      <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>{ownerName}</span>
    </div>
  );
};

export const RegionDetailModal = ({ regionId, onClose }: RegionDetailModalProps) => {
  const { gameState } = useGameStore();
  const t = useT();

  if (!gameState) return null;

  const province = gameState.provinces[regionId];
  if (!province) return null;

  // Calculate force totals per player for the header
  const ownerIds = [...new Set(province.figures.map(f => f.owner))];
  const forceByOwner = ownerIds.map(ownerId => {
    const player = gameState.players.find(p => p.id === ownerId);
    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
    const force = calculateForce(province, ownerId, gameState);
    return {
      playerId: ownerId,
      playerName: player?.name || 'Unknown',
      clanColor: clan?.color || '#666',
      force,
    };
  });

  // Separate figures into layers
  const backFigures: { figure: Figure; ownerColor: string; ownerClanId: string; ownerName: string }[] = [];
  const midFigures: { figure: Figure; ownerColor: string; ownerClanId: string; ownerName: string }[] = [];
  const frontFigures: { figure: Figure; ownerColor: string; ownerClanId: string; ownerName: string }[] = [];

  for (const fig of province.figures) {
    const player = gameState.players.find(p => p.id === fig.owner);
    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
    const ownerColor = clan?.color || '#666';
    const ownerClanId = clan?.id || '';
    const ownerName = player?.name || 'Unknown';

    const layer = getLayer(fig);
    const entry = { figure: fig, ownerColor, ownerClanId, ownerName };
    if (layer === 3) backFigures.push(entry);
    else if (layer === 2) midFigures.push(entry);
    else frontFigures.push(entry);
  }

  return (
    <div className="region-diorama-backdrop" onClick={onClose}>
      <div className="region-diorama-modal" onClick={(e) => e.stopPropagation()}>
        <button className="region-diorama-close" onClick={onClose}>&times;</button>
        <h2 className="region-diorama-title">{province.name}</h2>

        {/* Force totals per player */}
        {forceByOwner.length > 0 && (
          <div className="region-diorama-force-bar">
            {forceByOwner.map(({ playerId, playerName, clanColor, force }) => (
              <span key={playerId} className="region-diorama-force-item" style={{ borderColor: clanColor }}>
                <span className="region-diorama-force-dot" style={{ backgroundColor: clanColor }} />
                <span className="region-diorama-force-name">{playerName}</span>
                <span className="region-diorama-force-value">{force}</span>
              </span>
            ))}
          </div>
        )}

        {province.figures.length === 0 ? (
          <p className="region-diorama-empty">{t('regionDetail.empty')}</p>
        ) : (
          <div className="region-diorama-stage">
            {/* Layer 3 - Back (top of window): Shinto, Kami */}
            <div className="region-diorama-layer region-diorama-layer-back">
              {backFigures.map(({ figure, ownerColor, ownerClanId, ownerName }) => (
                <DioramaFigure
                  key={figure.id}
                  figure={figure}
                  ownerColor={ownerColor}
                  ownerClanId={ownerClanId}
                  ownerName={ownerName}
                  iconSize={28}
                />
              ))}
            </div>

            {/* Layer 2 - Middle: Fortress, Monster */}
            <div className="region-diorama-layer region-diorama-layer-mid">
              {midFigures.map(({ figure, ownerColor, ownerClanId, ownerName }) => (
                <DioramaFigure
                  key={figure.id}
                  figure={figure}
                  ownerColor={ownerColor}
                  ownerClanId={ownerClanId}
                  ownerName={ownerName}
                  iconSize={36}
                />
              ))}
            </div>

            {/* Layer 1 - Front (bottom of window): Bushi, Daimyo */}
            <div className="region-diorama-layer region-diorama-layer-front">
              {frontFigures.map(({ figure, ownerColor, ownerClanId, ownerName }) => (
                <DioramaFigure
                  key={figure.id}
                  figure={figure}
                  ownerColor={ownerColor}
                  ownerClanId={ownerClanId}
                  ownerName={ownerName}
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
