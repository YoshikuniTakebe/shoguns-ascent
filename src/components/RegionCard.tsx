import type { CSSProperties } from 'react';
import React from 'react';
import { useGameStore } from '../store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { CLANS, PROVINCES_DATA, PROVINCE_COLORS, SPRING_CARDS, SUMMER_CARDS, AUTUMN_CARDS } from '../types/game';
import type { Figure, GameState } from '../types/game';
import { useT } from '../i18n';
import { BushiIcon, ShintoIcon, FortressIcon, DaimyoIcon, MonsterIcon } from './Icons';
import { countVirtueCards, getFujinMovementCost, getPlayerSeasonCardEffects } from '../utils/gameLogic';
import { renderCardEffect } from '../utils/renderCardEffect';
import { getCardEffectKey } from '../utils/cardTranslations';

/** Helper to check if a player has a card by base ID (accounts for '-2' suffix duplicates) */
function hasDisplayCard(cardIds: Set<string>, baseId: string): boolean {
  return cardIds.has(baseId) || cardIds.has(baseId + '-2');
}

/** Get force value for a figure (simplified from RegionDetailModal) */
function getFigureForce(figure: Figure, ownerClanId: string, gameState: GameState, regionId: string): number {
  switch (figure.type) {
    case 'bushi': {
      const player = gameState.players.find(p => p.id === figure.owner);
      const isLuna = ownerClanId === 'luna';
      let figForce = isLuna ? 2 : 1;
      if (player) {
        const playerCards = getPlayerSeasonCardEffects(gameState, player.id);
        const cardIds = new Set(playerCards.map(c => c.id));
        if (hasDisplayCard(cardIds, 'au-way-of-the-katana') && gameState.currentPhase === 'war') {
          figForce = isLuna ? Math.max(2, figForce) : 2;
        }
        const province = gameState.provinces[regionId];
        if (province) {
          const provinceHasOni = province.figures.some(
            (f) => f.type === 'monster' && f.monsterCardId && f.monsterCardId.includes('oni-of-')
          );
          if (hasDisplayCard(cardIds, 'su-path-of-might') && provinceHasOni) {
            figForce += 1;
          }
        }
      }
      return figForce;
    }
    case 'daimyo': {
      const player = gameState.players.find(p => p.id === figure.owner);
      const isLuna = ownerClanId === 'luna';
      let figForce = isLuna ? 2 : 1;
      if (player) {
        const playerCards = getPlayerSeasonCardEffects(gameState, player.id);
        const cardIds = new Set(playerCards.map(c => c.id));
        if (hasDisplayCard(cardIds, 'sp-path-of-the-lion')) {
          figForce += 1;
        }
        if (hasDisplayCard(cardIds, 'au-path-of-the-dragon')) {
          figForce += 3;
        }
      }
      return figForce;
    }
    case 'shinto': {
      const player = gameState.players.find(p => p.id === figure.owner);
      const isLuna = ownerClanId === 'luna';
      let figForce = isLuna ? 2 : 1;
      if (player) {
        const playerCards = getPlayerSeasonCardEffects(gameState, player.id);
        const cardIds = new Set(playerCards.map(c => c.id));
        if (hasDisplayCard(cardIds, 'su-path-of-the-favored')) {
          const highestHonorPlayerId = gameState.honorTrack[0];
          if (highestHonorPlayerId === player.id) {
            figForce = isLuna ? Math.max(3, figForce) : 3;
          }
        }
      }
      return figForce;
    }
    case 'fortress':
      return ownerClanId === 'tortuga' ? 1 : 0;
    case 'monster':
      if (figure.monsterCardId) {
        const isLuna = ownerClanId === 'luna';
        const province = gameState.provinces[regionId];
        if (figure.monsterCardId === 'sp-oni-of-skulls' || figure.monsterCardId === 'su-oni-of-blood') {
          const ownerIds = [...new Set(province?.figures.map(f => f.owner) || [])];
          const ownerHonorIndex = gameState.honorTrack.indexOf(figure.owner);
          const otherOwnerIds = ownerIds.filter(id => id !== figure.owner);
          const hasLowestHonor = otherOwnerIds.length > 0 && otherOwnerIds.every(id => gameState.honorTrack.indexOf(id) <= ownerHonorIndex);
          const force = figure.monsterCardId === 'sp-oni-of-skulls'
            ? (hasLowestHonor ? 3 : 1)
            : (hasLowestHonor ? 4 : 2);
          return isLuna ? Math.max(force, 2) : force;
        }
        if (figure.monsterCardId === 'sp-daikokuten') {
          const base = (gameState.currentPhase === 'politics' && gameState.harvestMandateActive) ? 8 : 1;
          return isLuna ? Math.max(base, 2) : base;
        }
        if (figure.monsterCardId === 'su-bishamon') {
          const hasOpponentMonster = province?.figures.some(f => f.type === 'monster' && f.owner !== figure.owner) || false;
          const force = hasOpponentMonster ? 4 : 1;
          return isLuna ? Math.max(force, 2) : force;
        }
        if (figure.monsterCardId === 'au-sacred-warrior') {
          const virtueOwner = gameState.players.find(p => p.id === figure.owner);
          const virtueCount = virtueOwner ? countVirtueCards(virtueOwner) : 0;
          const force = 1 + virtueCount;
          return isLuna ? Math.max(force, 2) : force;
        }
        const allCards = [...SPRING_CARDS, ...SUMMER_CARDS, ...AUTUMN_CARDS];
        const card = allCards.find(c => c.id === figure.monsterCardId);
        if (card && card.force !== undefined) {
          return isLuna ? Math.max(card.force, 2) : card.force;
        }
      }
      return ownerClanId === 'luna' ? 2 : 1;
    default:
      return 0;
  }
}

/** Get display name for a figure */
function getFigureDisplayName(figure: Figure): string {
  if (figure.type === 'monster' && figure.monsterCardId) {
    const allCards = [...SPRING_CARDS, ...SUMMER_CARDS, ...AUTUMN_CARDS];
    const card = allCards.find(c => c.id === figure.monsterCardId);
    if (card) return card.name;
    return 'Monster';
  }
  switch (figure.type) {
    case 'bushi': return 'Bushi';
    case 'daimyo': return 'Daimyo';
    case 'shinto': return 'Shinto';
    case 'fortress': return 'Fortress';
    default: return figure.type;
  }
}



const FigureIcon = React.memo(({ figure, color, regionId }: { figure: Figure; color: string; regionId: string }) => {
  const t = useT();
  const gameState = useGameStore.getState().gameState!;
  const ownerPlayer = gameState.players.find(p => p.id === figure.owner);
  const ownerClanId = ownerPlayer ? ownerPlayer.clanId : '';
  const force = getFigureForce(figure, ownerClanId, gameState, regionId);
  const displayName = getFigureDisplayName(figure);
  const monsterPower = figure.type === 'monster' && figure.monsterCardId
    ? t(getCardEffectKey(figure.monsterCardId))
    : null;

  const tooltipContent = (
    <span className="figure-tooltip" style={{ borderColor: color }}>
      <span className="figure-tooltip-name">{displayName}</span>
      <span className="figure-tooltip-force">Force: {force}</span>
      {monsterPower && <span className="figure-tooltip-power">{renderCardEffect(monsterPower)}</span>}
    </span>
  );

  if (figure.type === 'bushi') {
    return (
      <span className={`figure-icon figure-icon-wrapper${ownerClanId === 'sol' ? ' figure-icon-sol' : ''}`}>
        <BushiIcon size={21} color={color} />
        {tooltipContent}
      </span>
    );
  }
  if (figure.type === 'shinto') {
    return (
      <span className={`figure-icon figure-icon-wrapper${ownerClanId === 'sol' ? ' figure-icon-sol' : ''}`}>
        <ShintoIcon size={21} color={color} />
        {tooltipContent}
      </span>
    );
  }
  if (figure.type === 'fortress') {
    return (
      <span className={`figure-icon figure-icon-wrapper${ownerClanId === 'sol' ? ' figure-icon-sol' : ''}`}>
        <FortressIcon size={21} color={color} />
        {tooltipContent}
      </span>
    );
  }
  if (figure.type === 'daimyo') {
    return (
      <span className={`figure-icon figure-icon-wrapper${ownerClanId === 'sol' ? ' figure-icon-sol' : ''}`}>
        <DaimyoIcon size={21} color={color} />
        {tooltipContent}
      </span>
    );
  }
  if (figure.type === 'monster') {
    return (
      <span className={`figure-icon figure-icon-wrapper${ownerClanId === 'sol' ? ' figure-icon-sol' : ''}`}>
        <MonsterIcon size={21} color={color} />
        {tooltipContent}
      </span>
    );
  }

  const icons: Record<string, string> = {
    monster: '\u2620',
    kami: '\u2728',
  };
  return (
    <span className={`figure-icon figure-icon-wrapper${ownerClanId === 'sol' ? ' figure-icon-sol' : ''}`} style={{ color }}>
      {icons[figure.type] || '\u25CF'}
      {tooltipContent}
    </span>
  );
});

export const RegionCard = React.memo(({ regionId, style }: { regionId: string; style: CSSProperties }) => {
  // Use granular selectors to avoid re-renders from unrelated state changes
  const province = useGameStore(s => s.gameState?.provinces[regionId]);
  const {
    players,
    currentPlayerIndex,
    currentPhase: _currentPhase,
    mode,
    marshalMandateActive,
    marshalMovedFigures,
    kamiResolutionActive,
    fujinMovesRemaining,
    kamiResolutionTemples,
    kamiResolutionIndex,
    zorroPlacementActive,
    zorroPlacementPlayerId,
    warProvinceSlots,
    honorTrack: _honorTrack,
    harvestMandateActive: _harvestMandateActive,
    raijinPlacementActive,
    daikaijuPlacementActive,
    daikaijuPlacementPlayerId,
    currentSeason: _currentSeason,
    warStartActions,
    warStartActionIndex,
    warStartSelection,
  } = useGameStore(useShallow(s => ({
    players: s.gameState?.players,
    currentPlayerIndex: s.gameState?.currentPlayerIndex ?? 0,
    currentPhase: s.gameState?.currentPhase,
    mode: s.gameState?.mode,
    marshalMandateActive: s.gameState?.marshalMandateActive ?? false,
    marshalMovedFigures: s.gameState?.marshalMovedFigures ?? [],
    kamiResolutionActive: s.gameState?.kamiResolutionActive ?? false,
    fujinMovesRemaining: s.gameState?.fujinMovesRemaining ?? 0,
    kamiResolutionTemples: s.gameState?.kamiResolutionTemples ?? [],
    kamiResolutionIndex: s.gameState?.kamiResolutionIndex ?? 0,
    zorroPlacementActive: s.gameState?.zorroPlacementActive ?? false,
    zorroPlacementPlayerId: s.gameState?.zorroPlacementPlayerId,
    warProvinceSlots: s.gameState?.warProvinceSlots ?? [],
    honorTrack: s.gameState?.honorTrack ?? [],
    harvestMandateActive: s.gameState?.harvestMandateActive ?? false,
    raijinPlacementActive: s.gameState?.raijinPlacementActive ?? false,
    daikaijuPlacementActive: s.gameState?.daikaijuPlacementActive ?? false,
    daikaijuPlacementPlayerId: s.gameState?.daikaijuPlacementPlayerId ?? null,
    currentSeason: s.gameState?.currentSeason,
    warStartActions: s.gameState?.warStartActions ?? [],
    warStartActionIndex: s.gameState?.warStartActionIndex ?? 0,
    warStartSelection: s.gameState?.warStartSelection ?? null,
  })));
  const selectedRegion = useGameStore(s => s.selectedRegion);
  const moveMode = useGameStore(s => s.moveMode);
  const moveFrom = useGameStore(s => s.moveFrom);
  const localPlayerId = useGameStore(s => s.localPlayerId);
  const selectedFigures = useGameStore(s => s.selectedFigures);
  const buildFortressMode = useGameStore(s => s.buildFortressMode);
  const buildFukurokujuMode = useGameStore(s => s.buildFukurokujuMode);
  const recruitMode = useGameStore(s => s.recruitMode);
  const betrayMode = useGameStore(s => s.betrayMode);
  const monsterPlacementMode = useGameStore(s => s.monsterPlacementMode);
  const monsterPlacementPlayerId = useGameStore(s => s.monsterPlacementPlayerId);
  const jinmenjuSummonActive = useGameStore(s => s.jinmenjuSummonActive);
  const daikaijuPlacementMode = useGameStore(s => s.daikaijuPlacementMode);
  const t = useT();
  if (!province || !players) return null;

  const isSelected = selectedRegion === regionId;

  // Determine active player during marshal
  const cp = players[currentPlayerIndex];
  const apid = mode === 'hotseat' ? cp?.id : localPlayerId;
  const activePlayer = apid ? players.find(p => p.id === apid) : null;
  const isMarshalMove = moveMode && marshalMandateActive;
  const isFujinMove = moveMode && kamiResolutionActive && fujinMovesRemaining > 0;
  const fujinPlayerId = isFujinMove
    ? kamiResolutionTemples[kamiResolutionIndex]?.winnerId
    : null;
  const movePlayerId = isFujinMove ? fujinPlayerId : apid;
  const isLibelula = activePlayer?.clanId === 'libelula';
  const warStartAction = warStartActions[warStartActionIndex];
  const isWarStartOwner = !!warStartAction && (mode === 'hotseat' || localPlayerId === warStartAction.playerId);

  let isWarStartTarget = false;
  if (isWarStartOwner && warStartAction?.type === 'naginata' && warStartSelection?.figureId) {
    isWarStartTarget = regionId !== 'ocean' && regionId !== warStartSelection.sourceProvinceId;
  } else if (isWarStartOwner && warStartAction?.type === 'ashigaru') {
    const owner = players.find(player => player.id === warStartAction.playerId);
    const ownFigures = province.figures.filter(figure => figure.owner === warStartAction.playerId && (figure.type !== 'fortress' || owner?.clanId === 'tortuga'));
    isWarStartTarget = regionId !== 'ocean' && ownFigures.length === 1 && (owner?.bushi || 0) > 0;
  } else if (isWarStartOwner && warStartAction?.type === 'sunakake') {
    isWarStartTarget = province.figures.some(figure => figure.owner === warStartAction.playerId && figure.monsterCardId === 'su-sunakake-baba')
      && province.figures.some(figure => figure.owner !== warStartAction.playerId && (figure.type === 'bushi' || figure.type === 'shinto'));
  }

  // Move target logic: Fujin validates both movement-point cost and distance.
  let isMoveTarget = false;
  if (moveMode && moveFrom && moveFrom !== regionId && selectedFigures.length > 0) {
    if (isMarshalMove && isLibelula) {
      isMoveTarget = true;
    } else if (isFujinMove) {
      const currentGameState = useGameStore.getState().gameState;
      const movementCost = currentGameState && fujinPlayerId
        ? getFujinMovementCost(currentGameState, fujinPlayerId, moveFrom, regionId, selectedFigures.length)
        : null;
      isMoveTarget = movementCost !== null && movementCost <= fujinMovesRemaining;
    } else {
      const moveFromData = PROVINCES_DATA.find(p => p.id === moveFrom);
      const moveFromAdjacents = moveFromData ? [...moveFromData.adjacentProvinces, ...moveFromData.seaRoutes] : [];
      isMoveTarget = moveFromAdjacents.includes(regionId);
    }
  }

  // Monster placement target logic
  let isMonsterTarget = false;
  let isMonsterDimmed = false;
  if (monsterPlacementMode && monsterPlacementPlayerId) {
    const placingPlayer = players.find(p => p.id === monsterPlacementPlayerId);
    if (placingPlayer) {
      if (placingPlayer.clanId === 'libelula') {
        // Libelula can place anywhere
        isMonsterTarget = true;
      } else {
        // Can only place where the player has a fortress (Fukurokuju counts as fortress)
        const hasFortress = province.figures.some(f => f.owner === monsterPlacementPlayerId && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju')));
        if (hasFortress) {
          // Luna clan power: max 2 figures per province (excluding fortresses)
          if (placingPlayer.clanId === 'luna') {
            const lunaFigures = province.figures.filter(f => f.owner === monsterPlacementPlayerId && f.type !== 'fortress').length;
            if (lunaFigures >= 2) {
              isMonsterDimmed = true;
            } else {
              isMonsterTarget = true;
            }
          } else {
            isMonsterTarget = true;
          }
        } else {
          isMonsterDimmed = true;
        }
      }
    }
  }

  // Zorro placement target logic
  let isZorroTarget = false;
  if (zorroPlacementActive && zorroPlacementPlayerId) {
    const isBattleProvince = warProvinceSlots.some(s => s.provinceId === regionId);
    const hasZorroFigure = province.figures.some(f => f.owner === zorroPlacementPlayerId && f.type !== 'fortress');
    if (isBattleProvince && !hasZorroFigure) {
      isZorroTarget = true;
    }
  }

  // Recruit province highlighting logic
  let isRecruitTarget = false;
  let isRecruitDimmed = false;
  if (kamiResolutionActive && raijinPlacementActive) {
    isRecruitTarget = true;
  } else if (jinmenjuSummonActive && recruitMode && !monsterPlacementMode) {
    // When Jinmenju summon is active, only highlight the province where Jinmenju is
    if (apid) {
      const hasJinmenju = province.figures.some(f => f.owner === apid && f.monsterCardId === 'sp-jinmenju');
      if (hasJinmenju) {
        isRecruitTarget = true;
      } else {
        isRecruitDimmed = true;
      }
    }
  } else if (recruitMode && !monsterPlacementMode) {
    if (apid) {
      const isDragonfly = activePlayer?.clanId === 'libelula';
      if (isDragonfly) {
        // Dragonfly clan can place in any province
        isRecruitTarget = true;
      } else {
        const hasFortress = province.figures.some(f => f.owner === apid && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju')));
        if (hasFortress) {
          isRecruitTarget = true;
        } else {
          isRecruitDimmed = true;
        }
      }
    }
  }

  const handleClick = () => {
    const { selectRegion, doMoveForces, setMoveFrom, setSelectedFigures, doBuildFortress, doBuildFukurokuju, doRecruitPlaceFigure, doPlaceMonster, doRaijinPlace, doZorroPlaceBushi, doJinmenjuPlace, doDaikaijuPlaceProvince, doWarStartSelectProvince } = useGameStore.getState();
    if (isWarStartOwner && isWarStartTarget && (warStartAction?.type === 'naginata' || warStartAction?.type === 'ashigaru')) {
      doWarStartSelectProvince(regionId);
      return;
    }
    // Daikaiju placement: click province to place Daikaiju
    if (daikaijuPlacementActive && daikaijuPlacementMode && regionId !== 'ocean') {
      const isOwner = mode === 'hotseat' || localPlayerId === daikaijuPlacementPlayerId;
      if (isOwner) {
        doDaikaijuPlaceProvince(regionId);
        return;
      }
    }
    // Zorro placement: click province to place bushi
    if (zorroPlacementActive && isZorroTarget) {
      doZorroPlaceBushi(regionId);
      return;
    }
    // Raijin placement: click province to summon bushi
    if (kamiResolutionActive && raijinPlacementActive) {
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
      if (jinmenjuSummonActive) {
        doJinmenjuPlace(regionId);
        return;
      }
      doRecruitPlaceFigure(regionId);
      return;
    }
    if (buildFortressMode) {
      doBuildFortress(regionId);
      return;
    }
    if (buildFukurokujuMode) {
      doBuildFukurokuju(regionId);
      return;
    }
    if (moveMode && moveFrom && isMoveTarget) {
      if (selectedFigures.length > 0) {
        doMoveForces(moveFrom, regionId, selectedFigures);
      }
    } else if (moveMode && !moveFrom) {
      // During marshal or fujin: set moveFrom but do NOT auto-select all figures
      // Player must click individual figures
      if (isMarshalMove || isFujinMove) {
        setMoveFrom(regionId);
        setSelectedFigures([]);
      } else {
        setMoveFrom(regionId);
        // Non-marshal, non-fujin: pre-select all figures owned by current player in this province
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
    const { doBetraySelectFigure, setSelectedFigures, doWarStartSelectFigure } = useGameStore.getState();
    if (isWarStartOwner && (warStartAction?.type === 'naginata' || warStartAction?.type === 'keiri' || warStartAction?.type === 'sunakake')) {
      e.stopPropagation();
      doWarStartSelectFigure(regionId, figureId);
      return;
    }
    if (betrayMode) {
      e.stopPropagation();
      doBetraySelectFigure(figureId, regionId);
      return;
    }

    // Marshal or Fujin move mode: clicking a figure in the source province selects it
    if ((isMarshalMove || isFujinMove) && moveFrom === regionId) {
      e.stopPropagation();
      const figure = province.figures.find(f => f.id === figureId);
      if (!figure) return;

      // Cannot select figures that are not owned by the moving player
      const ownerId = isFujinMove ? fujinPlayerId : apid;
      if (figure.owner !== ownerId) return;

      // Cannot select already-moved figures (marshal only)
      if (isMarshalMove && marshalMovedFigures.includes(figureId)) return;

      // Cannot select fortress unless player is Tortuga
      const movingPlayerClan = isFujinMove
        ? players.find(p => p.id === fujinPlayerId)?.clanId
        : activePlayer?.clanId;
      if (figure.type === 'fortress' && movingPlayerClan !== 'tortuga') return;

      // Toggle selection: if already selected, deselect; otherwise add to selection
      if (selectedFigures.includes(figureId)) {
        setSelectedFigures(selectedFigures.filter(id => id !== figureId));
      } else {
        if (isFujinMove && selectedFigures.length >= fujinMovesRemaining) return;
        setSelectedFigures([...selectedFigures, figureId]);
      }
    }
  };

  // Check if a figure is dimmed (already moved during marshal)
  const isFigureDimmed = (fig: Figure): boolean => {
    if (isFujinMove) return false; // Fujin doesn't track moved figures
    if (!isMarshalMove) return false;
    if (marshalMovedFigures.includes(fig.id)) return true;
    return false;
  };

  // Check if a figure is unselectable during marshal or fujin move
  const isFigureUnselectable = (fig: Figure): boolean => {
    if (isFujinMove) {
      if (fig.owner !== fujinPlayerId) return true;
      const fujinPlayerClan = players.find(p => p.id === fujinPlayerId)?.clanId;
      if (fig.type === 'fortress' && fujinPlayerClan !== 'tortuga') return true;
      return false;
    }
    if (!isMarshalMove) return false;
    if (fig.owner !== apid) return true;
    if (marshalMovedFigures.includes(fig.id)) return true;
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
  const warSlot = warProvinceSlots.find(s => s.provinceId === regionId);

  // Marshal/Fujin glow: when moveMode is true but source not yet selected, glow regions with active player's troops
  const isMarshalGlowCandidate = (isMarshalMove || isFujinMove) && moveMode && !moveFrom;
  const marshalGlowPlayerId = isFujinMove ? fujinPlayerId : apid;
  const glowPlayerClanId = marshalGlowPlayerId ? players.find(p => p.id === marshalGlowPlayerId)?.clanId : undefined;
  const hasTroopsForGlow = isMarshalGlowCandidate && marshalGlowPlayerId
    ? province.figures.some(f => f.owner === marshalGlowPlayerId && (f.type !== 'fortress' || glowPlayerClanId === 'tortuga') && !marshalMovedFigures.includes(f.id))
    : false;
  const marshalGlowColor = hasTroopsForGlow
    ? (() => {
        const glowPlayer = players.find(p => p.id === marshalGlowPlayerId);
        const glowClan = glowPlayer ? CLANS.find(c => c.id === glowPlayer.clanId) : null;
        return glowClan?.color || '#DAA520';
      })()
    : undefined;

  // Marshal dimming: dim provinces that are not valid sources or targets
  let isMarshalDimmed = false;
  if ((isMarshalMove || isFujinMove) && moveMode) {
    if (!moveFrom) {
      // Phase 1: selecting source - dim provinces without movable troops
      if (!hasTroopsForGlow) {
        isMarshalDimmed = true;
      }
    } else if (selectedFigures.length > 0) {
      // Phase 2: after selecting source - dim provinces that are not valid targets and not the source
      if (moveFrom === regionId) {
        isMarshalDimmed = false;
      } else if (!isMoveTarget) {
        isMarshalDimmed = true;
      }
    }
  }

  // Daikaiju placement target (any province except ocean)
  const isDaikaijuTarget = daikaijuPlacementActive && daikaijuPlacementMode && regionId !== 'ocean' && (mode === 'hotseat' || localPlayerId === daikaijuPlacementPlayerId);

  return (
    <div
      className={`region-card ${isSelected ? 'selected' : ''} ${isMoveTarget ? 'move-target' : ''} ${moveMode && moveFrom === regionId ? 'move-source' : ''} ${isMonsterTarget ? 'monster-target' : ''} ${isRecruitTarget ? 'recruit-target' : ''} ${isRecruitDimmed ? 'recruit-dimmed' : ''} ${isMonsterDimmed ? 'recruit-dimmed' : ''} ${isZorroTarget ? 'recruit-target' : ''} ${isWarStartTarget ? 'recruit-target' : ''} ${hasTroopsForGlow ? 'marshal-has-troops' : ''} ${isMarshalDimmed ? 'recruit-dimmed' : ''} ${isDaikaijuTarget ? 'monster-target' : ''}`}
      style={{ ...style, ...(hasTroopsForGlow ? { '--marshal-glow-color': marshalGlowColor } as React.CSSProperties : {}) }}
      onClick={handleClick}
    >
      <div className="region-name" style={{ color: PROVINCE_COLORS[regionId] || 'var(--accent-cream)', textShadow: '-1px -1px 0 #333, 1px -1px 0 #333, -1px 1px 0 #333, 1px 1px 0 #333' }}>{province.name}</div>
      {warSlot && <div className="war-token">{t('region.battle', { number: String(warSlot.number) })}</div>}
      <div className="region-forces">
        {Object.entries(figuresByOwner).map(([ownerId, figures]) => {
          const player = players.find(p => p.id === ownerId);
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
                const isWarStartSelected = warStartSelection?.figureId === fig.id || warStartSelection?.targetFigureIds?.includes(fig.id);
                return (
                  <span
                    key={fig.id}
                    onClick={(e) => handleFigureClick(fig.id, e)}
                    style={{
                      ...(isEnemy ? { cursor: 'pointer', opacity: 1 } : undefined),
                      ...(dimmed ? { opacity: 0.3 } : undefined),
                      ...(isMarshalClickable ? { cursor: 'pointer' } : undefined),
                      ...((isSelectedFigure || isWarStartSelected) ? { outline: '2px solid #fff', borderRadius: '3px' } : undefined),
                    }}
                    className={`${isEnemy ? 'betray-target' : ''} ${isSelectedFigure ? 'marshal-selected' : ''}`}
                  >
                    <FigureIcon figure={fig} color={ownerColor} regionId={regionId} />
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
});
