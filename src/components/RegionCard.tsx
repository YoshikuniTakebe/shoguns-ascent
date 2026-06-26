import type { CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCES_DATA } from '../types/game';
import type { Figure } from '../types/game';
import { useT } from '../i18n';
import { BushiIcon, ShintoIcon, FortressIcon, DaimyoIcon } from './Icons';

const FigureIcon = ({ figure, color }: { figure: Figure; color: string }) => {
  // SVG-based icons for bushi, shinto, fortress; Unicode for others
  if (figure.type === 'bushi') {
    return (
      <span className="figure-icon" title={`${figure.type} (${figure.owner})`}>
        <BushiIcon size={14} color={color} />
      </span>
    );
  }
  if (figure.type === 'shinto') {
    return (
      <span className="figure-icon" title={`${figure.type} (${figure.owner})`}>
        <ShintoIcon size={14} color={color} />
      </span>
    );
  }
  if (figure.type === 'fortress') {
    return (
      <span className="figure-icon" title={`${figure.type} (${figure.owner})`}>
        <FortressIcon size={14} color={color} />
      </span>
    );
  }
  if (figure.type === 'daimyo') {
    return (
      <span className="figure-icon" title={`${figure.type} (${figure.owner})`}>
        <DaimyoIcon size={14} color={color} />
      </span>
    );
  }

  const icons: Record<string, string> = {
    monster: '\u2620',
    kami: '\u2728',
  };
  return (
    <span className="figure-icon" style={{ color }} title={`${figure.type} (${figure.owner})`}>
      {icons[figure.type] || '\u25CF'}
    </span>
  );
};

export const RegionCard = ({ regionId, style }: { regionId: string; style: CSSProperties }) => {
  const { gameState, selectedRegion, selectRegion, moveMode, moveFrom, doMoveForces, localPlayerId, setMoveFrom, selectedFigures, setSelectedFigures, buildFortressMode, doBuildFortress, recruitMode, doRecruitPlaceFigure } = useGameStore();
  const t = useT();
  if (!gameState) return null;

  const province = gameState.provinces[regionId];
  if (!province) return null;

  const provinceData = PROVINCES_DATA.find(p => p.id === regionId);
  const isSelected = selectedRegion === regionId;
  const adjacents = provinceData ? [...provinceData.adjacentProvinces, ...provinceData.seaRoutes] : [];
  const isMoveTarget = moveMode && moveFrom && moveFrom !== regionId && adjacents.includes(moveFrom);

  const handleClick = () => {
    if (recruitMode) {
      doRecruitPlaceFigure(regionId);
      return;
    }
    if (buildFortressMode) {
      doBuildFortress(regionId);
      return;
    }
    if (moveMode && moveFrom && isMoveTarget) {
      if (selectedFigures.length > 0) {
        doMoveForces(moveFrom, regionId, selectedFigures);
      }
    } else if (moveMode && !moveFrom) {
      setMoveFrom(regionId);
      // Pre-select all figures owned by current player in this province
      const cp = gameState.players[gameState.currentPlayerIndex];
      const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
      if (apid) {
        const myFigures = province.figures.filter(f => f.owner === apid);
        setSelectedFigures(myFigures.map(f => f.id));
      }
    } else {
      selectRegion(isSelected ? null : regionId);
    }
  };

  // Group figures by owner
  const figuresByOwner: Record<string, Figure[]> = {};
  for (const fig of province.figures) {
    if (!figuresByOwner[fig.owner]) figuresByOwner[fig.owner] = [];
    figuresByOwner[fig.owner].push(fig);
  }

  // Check for war province token
  const warSlot = gameState.warProvinceSlots.find(s => s.provinceId === regionId);

  return (
    <div
      className={`region-card ${isSelected ? 'selected' : ''} ${isMoveTarget ? 'move-target' : ''} ${moveMode && moveFrom === regionId ? 'move-source' : ''}`}
      style={style}
      onClick={handleClick}
    >
      <div className="region-name">{province.name}</div>
      {warSlot && <div className="war-token">{t('region.battle', { number: String(warSlot.number) })}</div>}
      <div className="region-forces">
        {Object.entries(figuresByOwner).map(([ownerId, figures]) => {
          const player = gameState.players.find(p => p.id === ownerId);
          const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
          const ownerColor = clan?.color || '#666';
          return (
            <div key={ownerId} className="force-group" style={{ borderColor: ownerColor }}>
              {figures.map(fig => (
                <FigureIcon key={fig.id} figure={fig} color={ownerColor} />
              ))}
            </div>
          );
        })}
        {province.figures.length === 0 && <div className="empty-region">Empty</div>}
      </div>
    </div>
  );
};
