import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { Figure } from '../types/game';
import { useT } from '../i18n';
import { BushiIcon, ShintoIcon, FortressIcon, DaimyoIcon } from './Icons';

interface RegionDetailModalProps {
  regionId: string;
  onClose: () => void;
}

/** Skull icon for monsters */
const MonsterIcon = ({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
  >
    <path d="M12 2C7.5 2 4 5.5 4 9.5C4 12.5 5.5 15 8 16.5V18H10V16.8C10.6 17 11.3 17 12 17C12.7 17 13.4 17 14 16.8V18H16V16.5C18.5 15 20 12.5 20 9.5C20 5.5 16.5 2 12 2Z" />
    <circle cx="9" cy="9" r="2" fill="rgba(0,0,0,0.6)" />
    <circle cx="15" cy="9" r="2" fill="rgba(0,0,0,0.6)" />
    <path d="M9 14L10.5 12.5L12 14L13.5 12.5L15 14" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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

const FigureDisplay = ({ figure, ownerColor, tooltipText }: { figure: Figure; ownerColor: string; tooltipText: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const renderIcon = () => {
    const iconSize = 28;
    switch (figure.type) {
      case 'bushi':
        return <BushiIcon size={iconSize} color={ownerColor} />;
      case 'shinto':
        return <ShintoIcon size={iconSize} color={ownerColor} />;
      case 'fortress':
        return <FortressIcon size={iconSize} color={ownerColor} />;
      case 'daimyo':
        return <DaimyoIcon size={iconSize} color={ownerColor} />;
      case 'monster':
        return <MonsterIcon size={iconSize} color={ownerColor} />;
      case 'kami':
        return <KamiIcon size={iconSize} color={ownerColor} />;
      default:
        return <span style={{ color: ownerColor, fontSize: '1.5rem' }}>{'\u25CF'}</span>;
    }
  };

  return (
    <div
      className="region-detail-figure"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="region-detail-figure-icon" style={{ borderColor: ownerColor }}>
        {renderIcon()}
      </div>
      {showTooltip && (
        <div className="region-detail-tooltip">
          {tooltipText}
        </div>
      )}
    </div>
  );
};

export const RegionDetailModal = ({ regionId, onClose }: RegionDetailModalProps) => {
  const { gameState } = useGameStore();
  const t = useT();

  if (!gameState) return null;

  const province = gameState.provinces[regionId];
  if (!province) return null;

  // Group figures by owner
  const figuresByOwner: Record<string, Figure[]> = {};
  for (const fig of province.figures) {
    if (!figuresByOwner[fig.owner]) figuresByOwner[fig.owner] = [];
    figuresByOwner[fig.owner].push(fig);
  }

  const getFigureTypeName = (figure: Figure): string => {
    const names: Record<string, string> = {
      bushi: 'Bushi',
      shinto: 'Shinto',
      daimyo: t('regionDetail.daimyo'),
      fortress: t('regionDetail.fortress'),
      monster: t('regionDetail.monster'),
      kami: 'Kami',
    };
    return names[figure.type] || figure.type;
  };

  const getMonsterInfo = (figure: Figure): string | null => {
    if (figure.type !== 'monster') return null;

    const ownerPlayer = gameState.players.find(p => p.id === figure.owner);
    if (!ownerPlayer) return null;

    const monsterCards = ownerPlayer.seasonCards.filter(c => c.cardType === 'monster');
    if (monsterCards.length === 1) {
      return `${monsterCards[0].name}: ${monsterCards[0].effect}`;
    }
    if (monsterCards.length > 1) {
      // Can't determine which monster this is, list all names
      return monsterCards.map(c => c.name).join(' / ');
    }
    return null;
  };

  const getTooltipText = (figure: Figure): string => {
    const typeName = getFigureTypeName(figure);
    const monsterInfo = getMonsterInfo(figure);
    if (monsterInfo) {
      return `${typeName} - ${monsterInfo}`;
    }
    return typeName;
  };

  return (
    <div className="region-detail-backdrop" onClick={onClose}>
      <div className="region-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="region-detail-close" onClick={onClose}>&times;</button>
        <h2 className="region-detail-title">{province.name}</h2>

        {province.figures.length === 0 ? (
          <p className="region-detail-empty">{t('regionDetail.empty')}</p>
        ) : (
          <div className="region-detail-groups">
            {Object.entries(figuresByOwner).map(([ownerId, figures]) => {
              const player = gameState.players.find(p => p.id === ownerId);
              const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
              const ownerColor = clan?.color || '#666';
              const clanName = clan?.name || '?';

              return (
                <div key={ownerId} className="region-detail-group">
                  <div className="region-detail-group-header">
                    <span className="region-detail-clan-dot" style={{ backgroundColor: ownerColor }} />
                    <span className="region-detail-clan-name" style={{ color: ownerColor }}>
                      {player?.name || clanName}
                    </span>
                  </div>
                  <div className="region-detail-figures">
                    {figures.map(fig => (
                      <FigureDisplay
                        key={fig.id}
                        figure={fig}
                        ownerColor={ownerColor}
                        tooltipText={getTooltipText(fig)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
