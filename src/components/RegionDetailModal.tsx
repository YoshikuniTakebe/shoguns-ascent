import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, SPRING_CARDS, SUMMER_CARDS, AUTUMN_CARDS, PROVINCE_COLORS } from '../types/game';
import type { Figure } from '../types/game';
import { useT } from '../i18n';
import { BushiIcon, ShintoIcon, DaimyoIcon, MonsterIcon, FortressIcon, FistIcon } from './Icons';
import { ClanShield } from './ClanShields';
import { getMonsterFigureImage, getCastleImage, getRegionBackground } from '../utils/figureImages';
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
function getMonsterInfo(monsterCardId: string): { name: string; effect: string; force?: number } | null {
  const allCards = [...SPRING_CARDS, ...SUMMER_CARDS, ...AUTUMN_CARDS];
  const card = allCards.find(c => c.id === monsterCardId);
  if (card) {
    return { name: card.name, effect: card.effect, force: card.force };
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

/** Get individual force value for a figure */
function getFigureForce(figure: Figure, ownerClanId: string): number {
  switch (figure.type) {
    case 'bushi':
      return 1;
    case 'daimyo':
      return 1;
    case 'fortress':
      // Tortuga clan fortress has force 1
      return ownerClanId === 'tortuga' ? 1 : 0;
    case 'monster':
      if (figure.monsterCardId) {
        const info = getMonsterInfo(figure.monsterCardId);
        if (info && info.force !== undefined) {
          return info.force;
        }
      }
      return 1;
    default:
      return 0;
  }
}

interface FigureEntry {
  figure: Figure;
  ownerColor: string;
  ownerClanId: string;
  ownerName: string;
}

interface DioramaFigureProps {
  figure: Figure;
  ownerColor: string;
  ownerClanId: string;
  ownerName: string;
  iconSize: number;
  onClick: () => void;
}

const DioramaFigure = ({ figure, ownerColor, ownerClanId, ownerName, iconSize, onClick }: DioramaFigureProps) => {
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
    const img = getMonsterFigureImage(figure.monsterCardId);
    if (img) {
      return (
        <div className="region-diorama-figure" title={tooltipText} onClick={onClick} style={{ cursor: 'pointer' }}>
          <img src={img} alt="Monster" className="region-diorama-figure-img" style={{ height: iconSize * 2.2 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px' }}>
            <ClanShield clanId={ownerClanId} size={18} />
            <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>
              {ownerName}
            </span>
          </div>
        </div>
      );
    }
    // Fallback to MonsterIcon SVG when no image file exists for this monster
    return (
      <div className="region-diorama-figure" title={tooltipText} onClick={onClick} style={{ cursor: 'pointer' }}>
        <MonsterIcon size={iconSize} color={ownerColor} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px' }}>
          <ClanShield clanId={ownerClanId} size={18} />
          <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>
            {ownerName}
          </span>
        </div>
      </div>
    );
  }

  // Fortress with castle image, with FortressIcon SVG as fallback
  if (figure.type === 'fortress') {
    const img = getCastleImage(ownerClanId);
    if (img) {
      return (
        <div className="region-diorama-figure" title={tooltipText} onClick={onClick} style={{ cursor: 'pointer' }}>
          <img src={img} alt="Castle" className="region-diorama-figure-img" style={{ height: iconSize * 2.2 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px' }}>
            <ClanShield clanId={ownerClanId} size={18} />
            <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>
              {ownerName}
            </span>
          </div>
        </div>
      );
    }
    // Fallback to FortressIcon SVG if castle image not found
    return (
      <div className="region-diorama-figure" title={tooltipText} onClick={onClick} style={{ cursor: 'pointer' }}>
        <FortressIcon size={iconSize} color={ownerColor} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px' }}>
          <ClanShield clanId={ownerClanId} size={18} />
          <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>
            {ownerName}
          </span>
        </div>
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
    <div className="region-diorama-figure" title={tooltipText} onClick={onClick} style={{ cursor: 'pointer' }}>
      {renderIcon()}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px' }}>
        <ClanShield clanId={ownerClanId} size={18} />
        <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>
          {ownerName}
        </span>
      </div>
    </div>
  );
};

interface ZoomedFigureInfo {
  figure: Figure;
  ownerColor: string;
  ownerClanId: string;
  ownerName: string;
}

export const RegionDetailModal = ({ regionId, onClose }: RegionDetailModalProps) => {
  const { gameState } = useGameStore();
  const t = useT();
  const [zoomedFigure, setZoomedFigure] = useState<ZoomedFigureInfo | null>(null);

  if (!gameState) return null;

  const province = gameState.provinces[regionId];
  if (!province) return null;

  // Get region background image
  const regionBg = getRegionBackground(regionId);

  // Calculate force totals per player for the header
  const ownerIds = [...new Set(province.figures.map(f => f.owner))];
  const forceByOwner = ownerIds.map(ownerId => {
    const player = gameState.players.find(p => p.id === ownerId);
    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
    const force = calculateForce(province, ownerId, gameState);
    return {
      playerId: ownerId,
      playerName: player?.name || 'Unknown',
      clanId: clan?.id || '',
      clanColor: clan?.color || '#666',
      force,
    };
  });

  // Distribute ALL figures equitably across 3 rows, starting from front, max 5 per row
  const allFigures: FigureEntry[] = province.figures.map(fig => {
    const player = gameState.players.find(p => p.id === fig.owner);
    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
    return {
      figure: fig,
      ownerColor: clan?.color || '#666',
      ownerClanId: clan?.id || '',
      ownerName: player?.name || 'Unknown',
    };
  });

  const frontFigures: FigureEntry[] = [];
  const midFigures: FigureEntry[] = [];
  const backFigures: FigureEntry[] = [];

  const maxFront = 4;
  const maxMid = 5;
  for (let i = 0; i < allFigures.length; i++) {
    if (frontFigures.length < maxFront) {
      frontFigures.push(allFigures[i]);
    } else if (midFigures.length < maxMid) {
      midFigures.push(allFigures[i]);
    } else {
      backFigures.push(allFigures[i]);
    }
  }

  // Render the zoomed figure overlay
  const renderZoomOverlay = () => {
    if (!zoomedFigure) return null;

    const { figure, ownerColor, ownerClanId, ownerName } = zoomedFigure;
    const figureForce = getFigureForce(figure, ownerClanId);

    // Get monster power text if applicable
    let monsterPowerText: string | null = null;
    if (figure.type === 'monster' && figure.monsterCardId) {
      const info = getMonsterInfo(figure.monsterCardId);
      if (info) {
        monsterPowerText = info.effect;
      }
    }

    // Render the figure image/icon large
    const renderLargeFigure = () => {
      if (figure.type === 'monster' && figure.monsterCardId) {
        const img = getMonsterFigureImage(figure.monsterCardId);
        if (img) {
          return <img src={img} alt="Monster" style={{ height: '60vh', objectFit: 'contain' }} />;
        }
        return <MonsterIcon size={200} color={ownerColor} />;
      }
      if (figure.type === 'fortress') {
        const img = getCastleImage(ownerClanId);
        if (img) {
          return <img src={img} alt="Castle" style={{ height: '60vh', objectFit: 'contain' }} />;
        }
        return <FortressIcon size={200} color={ownerColor} />;
      }
      switch (figure.type) {
        case 'bushi':
          return <BushiIcon size={200} color={ownerColor} />;
        case 'daimyo':
          return <DaimyoIcon size={200} color={ownerColor} />;
        case 'shinto':
          return <ShintoIcon size={200} color={ownerColor} />;
        case 'kami':
          return <KamiIcon size={200} color={ownerColor} />;
        default:
          return <BushiIcon size={200} color={ownerColor} />;
      }
    };

    return (
      <div
        className="figure-zoom-overlay"
        onClick={() => setZoomedFigure(null)}
      >
        <div className="figure-zoom-content" onClick={(e) => e.stopPropagation()}>
          <div className="figure-zoom-image">
            {renderLargeFigure()}
          </div>
          {monsterPowerText && (
            <div className="figure-zoom-power">{monsterPowerText}</div>
          )}
          <div className="figure-zoom-info">
            <ClanShield clanId={ownerClanId} size={24} />
            <span className="figure-zoom-player-name" style={{ color: ownerColor }}>{ownerName}</span>
            <FistIcon size={18} color="var(--accent-gold)" />
            <span className="figure-zoom-force">{figureForce}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="region-diorama-backdrop" onClick={onClose}>
      <div
        className="region-diorama-modal"
        onClick={(e) => e.stopPropagation()}
        style={regionBg ? {
          backgroundImage: `url(${regionBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        <button className="region-diorama-close" onClick={onClose}>&times;</button>
        <h2
          className="region-diorama-title"
          style={{
            color: PROVINCE_COLORS[regionId] || 'var(--accent-gold)',
            textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 8px rgba(0,0,0,0.8)',
          }}
        >{province.name}</h2>

        {/* Force totals per player */}
        {forceByOwner.length > 0 && (
          <div className="region-diorama-force-bar">
            {forceByOwner.map(({ playerId, playerName, clanId: ownerClanId, clanColor, force }) => (
              <span key={playerId} className="region-diorama-force-item" style={{ borderColor: clanColor }}>
                <ClanShield clanId={ownerClanId} size={18} />
                <span className="region-diorama-force-name" style={{ color: clanColor }}>{playerName}</span>
                <FistIcon size={14} color="var(--accent-gold)" />
                <span className="region-diorama-force-value">{force}</span>
              </span>
            ))}
          </div>
        )}

        {province.figures.length === 0 ? (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '18px', zIndex: 0 }} />
            <p className="region-diorama-empty" style={{ position: 'relative', zIndex: 1 }}>{t('regionDetail.empty')}</p>
          </>
        ) : (
          <div className="region-diorama-stage">
            {/* Layer 3 - Back (top): smallest, z-index 1 */}
            <div className="region-diorama-layer region-diorama-layer-back" style={{ transform: 'scale(0.6)', zIndex: 1 }}>
              {backFigures.map(({ figure, ownerColor, ownerClanId, ownerName }) => (
                <DioramaFigure
                  key={figure.id}
                  figure={figure}
                  ownerColor={ownerColor}
                  ownerClanId={ownerClanId}
                  ownerName={ownerName}
                  iconSize={100}
                  onClick={() => setZoomedFigure({ figure, ownerColor, ownerClanId, ownerName })}
                />
              ))}
            </div>

            {/* Layer 2 - Middle: normal scale, z-index 2 */}
            <div className="region-diorama-layer region-diorama-layer-mid" style={{ transform: 'scale(0.8)', zIndex: 2 }}>
              {midFigures.map(({ figure, ownerColor, ownerClanId, ownerName }) => (
                <DioramaFigure
                  key={figure.id}
                  figure={figure}
                  ownerColor={ownerColor}
                  ownerClanId={ownerClanId}
                  ownerName={ownerName}
                  iconSize={100}
                  onClick={() => setZoomedFigure({ figure, ownerColor, ownerClanId, ownerName })}
                />
              ))}
            </div>

            {/* Layer 1 - Front (bottom): largest, z-index 3 */}
            <div className="region-diorama-layer region-diorama-layer-front" style={{ transform: 'scale(1.0)', zIndex: 3 }}>
              {frontFigures.map(({ figure, ownerColor, ownerClanId, ownerName }) => (
                <DioramaFigure
                  key={figure.id}
                  figure={figure}
                  ownerColor={ownerColor}
                  ownerClanId={ownerClanId}
                  ownerName={ownerName}
                  iconSize={100}
                  onClick={() => setZoomedFigure({ figure, ownerColor, ownerClanId, ownerName })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Figure zoom overlay */}
        {renderZoomOverlay()}
      </div>
    </div>
  );
};
