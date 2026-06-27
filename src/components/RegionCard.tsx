import type { CSSProperties } from 'react';
import React from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCES_DATA } from '../types/game';
import type { Figure } from '../types/game';
import { useT } from '../i18n';
import { BushiIcon, ShintoIcon, FortressIcon, DaimyoIcon, MonsterIcon } from './Icons';

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
  if (figure.type === 'monster') {
    return (
      <span className="figure-icon" title={`${figure.type} (${figure.owner})`}>
        <MonsterIcon size={14} color={color} />
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
  const { gameState, selectedRegion, selectRegion, moveMode, moveFrom, doMoveForces, localPlayerId, setMoveFrom, selectedFigures, setSelectedFigures, buildFortressMode, doBuildFortress, recruitMode, doRecruitPlaceFigure, betrayMode, doBetraySelectFigure, monsterPlacementMode, monsterPlacementPlayerId, doPlaceMonster, doRaijinPlace } = useGameStore();
  const t = useT();
  if (!gameState) return null;

  const province = gameState.provinces[regionId];
  if (!province) return null;

  const isSelected = selectedRegion === regionId;

  // Determine active player during marshal
  const cp = gameState.players[gameState.currentPlayerIndex];
  const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
  const activePlayer = apid ? gameState.players.find(p => p.id === apid) : null;
  const isMarshalMove = moveMode && gameState.marshalMandateActive;
  const isFujinMove = moveMode && gameState.kamiResolutionActive && gameState.fujinMovesRemaining > 0;
  const fujinPlayerId = isFujinMove
    ? gameState.kamiResolutionTemples[gameState.kamiResolutionIndex]?.winnerId
    : null;
  const movePlayerId = isFujinMove ? fujinPlayerId : apid;
  const isLibelula = activePlayer?.clanId === 'libelula';

  // Move target logic: for Libelula during marshal, all provinces except moveFrom are valid
  // For Fujin movement, use the fujin player's clan for Libelula check
  const movePlayerClan = isFujinMove
    ? gameState.players.find(p => p.id === fujinPlayerId)?.clanId
    : activePlayer?.clanId;
  const isMovePlayerLibelula = movePlayerClan === 'libelula';
  let isMoveTarget = false;
  if (moveMode && moveFrom && moveFrom !== regionId && selectedFigures.length > 0) {
    if (isMarshalMove && isLibelula) {
      isMoveTarget = true;
    } else if (isFujinMove && isMovePlayerLibelula) {
      isMoveTarget = true;
    } else {
      const moveFromData = PROVINCES_DATA.find(p => p.id === moveFrom);
      const moveFromAdjacents = moveFromData ? [...moveFromData.adjacentProvinces, ...moveFromData.seaRoutes] : [];
      isMoveTarget = moveFromAdjacents.includes(regionId);
    }
  }

  // Monster placement target logic
  let isMonsterTarget = false;
  if (monsterPlacementMode && monsterPlacementPlayerId) {
    const placingPlayer = gameState.players.find(p => p.id === monsterPlacementPlayerId);
    if (placingPlayer) {
      if (placingPlayer.clanId === 'libelula') {
        // Libelula can place anywhere
        isMonsterTarget = true;
      } else {
        // Can only place where the player has a fortress
        isMonsterTarget = province.figures.some(f => f.type === 'fortress' && f.owner === monsterPlacementPlayerId);
      }
    }
  }

  // Recruit province highlighting logic
  let isRecruitTarget = false;
  let isRecruitDimmed = false;
  if (gameState.kamiResolutionActive && gameState.raijinPlacementActive) {
    isRecruitTarget = true;
  } else if (recruitMode && !monsterPlacementMode) {
    if (apid) {
      const isDragonfly = activePlayer?.clanId === 'libelula';
      if (isDragonfly) {
        // Dragonfly clan can place in any province
        isRecruitTarget = true;
      } else {
        const hasFortress = province.figures.some(f => f.type === 'fortress' && f.owner === apid);
        if (hasFortress) {
          isRecruitTarget = true;
        } else {
          isRecruitDimmed = true;
        }
      }
    }
  }

  const handleClick = () => {
    // Raijin placement: click province to summon bushi
    if (gameState.kamiResolutionActive && gameState.raijinPlacementActive) {
      doRaijinPlace(regionId);
      return;
    }
    if (monsterPlacementMode) {
      if (isMonsterTarget) {
        doPlaceMonster(regionId);
      }
      return;
    }
    if (betrayMode) {
      // In betray mode, clicking the province does nothing - figures handle clicks individually
      return;
    }
    if (recruitMode) {
      if (isRecruitDimmed) return;
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
      // During marshal: set moveFrom but do NOT auto-select all figures
      // Player must click individual figures
      if (isMarshalMove) {
        setMoveFrom(regionId);
        setSelectedFigures([]);
      } else {
        setMoveFrom(regionId);
        // Non-marshal: pre-select all figures owned by current player in this province
        const ownerId = movePlayerId || apid;
        if (ownerId) {
          const myFigures = province.figures.filter(f => f.owner === ownerId);
          setSelectedFigures(myFigures.map(f => f.id));
        }
      }
    } else {
      selectRegion(isSelected ? null : regionId);
    }
  };

  const handleFigureClick = (figureId: string, e: React.MouseEvent) => {
    if (betrayMode) {
      e.stopPropagation();
      doBetraySelectFigure(figureId, regionId);
      return;
    }

    // Marshal move mode: clicking a figure in the source province selects it
    if (isMarshalMove && moveFrom === regionId) {
      e.stopPropagation();
      const figure = province.figures.find(f => f.id === figureId);
      if (!figure) return;

      // Cannot select figures that are not owned by current player
      if (figure.owner !== apid) return;

      // Cannot select already-moved figures
      if (gameState.marshalMovedFigures.includes(figureId)) return;

      // Cannot select fortress unless Tortuga
      if (figure.type === 'fortress' && activePlayer?.clanId !== 'tortuga') return;

      // Toggle selection: if already selected, deselect; otherwise select only this one
      if (selectedFigures.includes(figureId)) {
        setSelectedFigures([]);
      } else {
        setSelectedFigures([figureId]);
      }
    }
  };

  // Check if a figure is dimmed (already moved during marshal)
  const isFigureDimmed = (fig: Figure): boolean => {
    if (!isMarshalMove) return false;
    if (gameState.marshalMovedFigures.includes(fig.id)) return true;
    return false;
  };

  // Check if a figure is unselectable during marshal move
  const isFigureUnselectable = (fig: Figure): boolean => {
    if (!isMarshalMove) return false;
    if (fig.owner !== apid) return true;
    if (gameState.marshalMovedFigures.includes(fig.id)) return true;
    if (fig.type === 'fortress' && activePlayer?.clanId !== 'tortuga') return true;
    return false;
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
      className={`region-card ${isSelected ? 'selected' : ''} ${isMoveTarget ? 'move-target' : ''} ${moveMode && moveFrom === regionId ? 'move-source' : ''} ${isMonsterTarget ? 'monster-target' : ''} ${isRecruitTarget ? 'recruit-target' : ''} ${isRecruitDimmed ? 'recruit-dimmed' : ''}`}
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
          const isEnemy = betrayMode && ownerId !== apid;
          return (
            <div key={ownerId} className="force-group" style={{ borderColor: ownerColor }}>
              {figures.map(fig => {
                const dimmed = isFigureDimmed(fig);
                const unselectable = isFigureUnselectable(fig);
                const isSelectedFigure = selectedFigures.includes(fig.id);
                const isMarshalClickable = isMarshalMove && moveFrom === regionId && !unselectable;
                return (
                  <span
                    key={fig.id}
                    onClick={(e) => handleFigureClick(fig.id, e)}
                    style={{
                      ...(isEnemy ? { cursor: 'pointer', opacity: 1 } : undefined),
                      ...(dimmed ? { opacity: 0.3 } : undefined),
                      ...(isMarshalClickable ? { cursor: 'pointer' } : undefined),
                      ...(isSelectedFigure ? { outline: '2px solid #fff', borderRadius: '3px' } : undefined),
                    }}
                    className={`${isEnemy ? 'betray-target' : ''} ${isSelectedFigure ? 'marshal-selected' : ''}`}
                  >
                    <FigureIcon figure={fig} color={ownerColor} />
                  </span>
                );
              })}
            </div>
          );
        })}
        {province.figures.length === 0 && <div className="empty-region">Empty</div>}
      </div>
    </div>
  );
};
