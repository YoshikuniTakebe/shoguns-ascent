import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, SPRING_CARDS, SUMMER_CARDS, AUTUMN_CARDS, PROVINCE_COLORS } from '../types/game';
import type { Figure, GameState } from '../types/game';
import { useT, t as tStandalone } from '../i18n';
import { FistIcon } from './Icons';
import { ClanShield } from './ClanShields';
import { getMonsterFigureImage, getCastleImage, getDaimyoImage, getBushiImage, getShintoImage, getRegionBackground, TEMPLATE_FIGURE_IMG } from '../utils/figureImages';
import { calculateForce, getPlayerSeasonCardEffects } from '../utils/gameLogic';
import { getCardEffectKey, getCardNameKey } from '../utils/cardTranslations';
import { renderCardEffect } from '../utils/renderCardEffect';

/** Per-figure size overrides for diorama display. Keys are monsterCardId for monsters, or 'type-clanId' for clan figures. */
const FIGURE_SIZE_OVERRIDES: Record<string, number> = {
  'sp-jorogumo': 0.85,
  'daimyo-tortuga': 1.22,
  'bushi-tortuga': 1.05,
  'bushi-loto': 0.75,
  'daimyo-loto': 0.80,
  'sp-oni-of-skulls': 1.404,
  'daimyo-koi': 1.00,
  'sp-earth-dragon': 1.30,
  'daimyo-luna': 1.25,
  'bushi-luna': 0.87,
  'daimyo-libelula': 1.10,
  'daimyo-sol': 1.01,
  'sp-daikokuten': 0.824,
  'sp-oni-of-souls': 1.25,
  'sp-phoenix': 1.27,
  'sp-komainu': 0.83,
  'sp-jinmenju': 1.23,
  'daimyo-bonsai': 0.97,
  'bushi-zorro': 0.84,
  'shinto-zorro': 0.81,
  'daimyo-zorro': 0.94,
  'bushi-koi': 0.95,
  'bushi-libelula': 0.87,
  'bushi-sol': 0.91,
  'bushi-bonsai': 0.85,
  'su-hotei': 1.15,
  'su-yurei': 1.20,
  'su-oni-of-souls': 1.25,
  'su-oni-of-blood': 1.20,
  'sp-fukurokuju': 1.04,
  'shinto-tortuga': 0.88,
  'su-sunakake-baba': 0.94,
  'au-oni-of-spite': 1.15,
};

/** Get the size scale override for a figure. Returns 1.0 if no override is defined. */
function getSizeOverride(figure: Figure, ownerClanId: string): number {
  if (figure.type === 'monster' && figure.monsterCardId) {
    return FIGURE_SIZE_OVERRIDES[figure.monsterCardId] ?? 1.0;
  }
  const key = `${figure.type}-${ownerClanId}`;
  return FIGURE_SIZE_OVERRIDES[key] ?? 1.0;
}

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
    return { name: tStandalone(getCardNameKey(card.id)), effect: tStandalone(getCardEffectKey(card.id)), force: card.force };
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
        if (import.meta.env.DEV) {
          console.log('[getFigureForce] daimyo check:', { owner: figure.owner, cardIds: [...cardIds], hasLion: hasDisplayCard(cardIds, 'sp-path-of-the-lion'), figForce });
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
      // Tortuga clan fortress has force 1
      return ownerClanId === 'tortuga' ? 1 : 0;
    case 'monster':
      if (figure.monsterCardId) {
        if (figure.monsterCardId === 'sp-daikokuten') {
          const isLuna = ownerClanId === 'luna';
          const base = (gameState.currentPhase === 'politics' && gameState.harvestMandateActive) ? 8 : 1;
          return isLuna ? Math.max(base, 2) : base;
        }
        const info = getMonsterInfo(figure.monsterCardId);
        if (info && info.force !== undefined) {
          // Oni of Skulls and Oni of Blood have conditional force based on honor
          if (figure.monsterCardId === 'sp-oni-of-skulls' || figure.monsterCardId === 'su-oni-of-blood') {
            const province = gameState.provinces[regionId];
            if (province) {
              const ownerIds = [...new Set(province.figures.map(f => f.owner))];
              const ownerHonorIndex = gameState.honorTrack.indexOf(figure.owner);
              const otherOwnerIds = ownerIds.filter(id => id !== figure.owner);
              const hasLowestHonor = otherOwnerIds.length > 0 && otherOwnerIds.every(id => {
                const idx = gameState.honorTrack.indexOf(id);
                return idx <= ownerHonorIndex;
              });
              if (figure.monsterCardId === 'sp-oni-of-skulls') {
                return hasLowestHonor ? 3 : 1;
              } else {
                return hasLowestHonor ? 4 : 2;
              }
            }
          }
          return info.force;
        }
      }
      return 1;
    default:
      return 0;
  }
}

/** Helper to check if a player has a card by base ID (accounts for '-2' suffix duplicates) */
function hasDisplayCard(cardIds: Set<string>, baseId: string): boolean {
  return cardIds.has(baseId) || cardIds.has(baseId + '-2');
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
  const sizeOverride = getSizeOverride(figure, ownerClanId);
  const figureHeight = iconSize * 2.2 * sizeOverride;
  const imgRef = useRef<HTMLImageElement>(null);
  const [debugSize, setDebugSize] = useState<string>('');

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const img = imgRef.current;
    if (!img) return;
    const updateSize = () => {
      const w = Math.round(img.clientWidth);
      const h = Math.round(img.clientHeight);
      if (w > 0 && h > 0) setDebugSize(`${w}x${h}`);
    };
    if (img.complete) updateSize();
    img.addEventListener('load', updateSize);
    // Also try after a short delay for cached images
    const timer = setTimeout(updateSize, 100);
    return () => {
      img.removeEventListener('load', updateSize);
      clearTimeout(timer);
    };
  }, [figureHeight]);

  const debugOverlay = import.meta.env.DEV && debugSize ? (
    <span style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', color: 'white', fontSize: '10px', whiteSpace: 'nowrap', pointerEvents: 'none', textShadow: '0 0 3px black, 0 0 3px black' }}>
      {debugSize}
    </span>
  ) : null;

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
        <div className="region-diorama-figure" title={tooltipText} onClick={onClick} style={{ cursor: 'pointer', position: 'relative' }}>
          {debugOverlay}
          <img ref={imgRef} src={img} alt="Monster" className="region-diorama-figure-img" style={{ height: figureHeight }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.9)) drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>
            <ClanShield clanId={ownerClanId} size={36} />
            <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>
              {ownerName}
            </span>
          </div>
        </div>
      );
    }
    // Fallback to template figure image when no specific image file exists for this monster
    return (
      <div className="region-diorama-figure" title={tooltipText} onClick={onClick} style={{ cursor: 'pointer', position: 'relative' }}>
        {debugOverlay}
        <img ref={imgRef} src={TEMPLATE_FIGURE_IMG} alt="Monster" className="region-diorama-figure-img" style={{ height: figureHeight }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.9)) drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>
          <ClanShield clanId={ownerClanId} size={36} />
          <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>
            {ownerName}
          </span>
        </div>
      </div>
    );
  }

  // Fortress with castle image, with template figure as fallback
  if (figure.type === 'fortress') {
    const img = getCastleImage(ownerClanId);
    if (img) {
      return (
        <div className="region-diorama-figure" title={tooltipText} onClick={onClick} style={{ cursor: 'pointer', position: 'relative' }}>
          {debugOverlay}
          <img ref={imgRef} src={img} alt="Castle" className="region-diorama-figure-img" style={{ height: figureHeight }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.9)) drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>
            <ClanShield clanId={ownerClanId} size={36} />
            <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>
              {ownerName}
            </span>
          </div>
        </div>
      );
    }
    // Fallback to template figure image if castle image not found
    return (
      <div className="region-diorama-figure" title={tooltipText} onClick={onClick} style={{ cursor: 'pointer', position: 'relative' }}>
        {debugOverlay}
        <img ref={imgRef} src={TEMPLATE_FIGURE_IMG} alt="Fortress" className="region-diorama-figure-img" style={{ height: figureHeight }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.9)) drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>
          <ClanShield clanId={ownerClanId} size={36} />
          <span className="region-diorama-owner-badge" style={{ backgroundColor: ownerColor }}>
            {ownerName}
          </span>
        </div>
      </div>
    );
  }

  // SVG icons for kami, template figure for bushi, daimyo, shinto
  const renderIcon = () => {
    switch (figure.type) {
      case 'bushi':
        return <img ref={imgRef} src={getBushiImage(ownerClanId) || TEMPLATE_FIGURE_IMG} alt="Bushi" className="region-diorama-figure-img" style={{ height: figureHeight }} />;
      case 'daimyo': {
        const daimyoImg = getDaimyoImage(ownerClanId);
        return <img ref={imgRef} src={daimyoImg || TEMPLATE_FIGURE_IMG} alt="Daimyo" className="region-diorama-figure-img" style={{ height: figureHeight }} />;
      }
      case 'shinto':
        return <img ref={imgRef} src={getShintoImage(ownerClanId) || TEMPLATE_FIGURE_IMG} alt="Shinto" className="region-diorama-figure-img" style={{ height: figureHeight }} />;
      case 'kami':
        return <KamiIcon size={iconSize} color={ownerColor} />;
      default:
        return <img ref={imgRef} src={TEMPLATE_FIGURE_IMG} alt="Figure" className="region-diorama-figure-img" style={{ height: figureHeight }} />;
    }
  };

  return (
    <div className="region-diorama-figure" title={tooltipText} onClick={onClick} style={{ cursor: 'pointer', position: 'relative' }}>
      {debugOverlay}
      {renderIcon()}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.9)) drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>
        <ClanShield clanId={ownerClanId} size={36} />
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
  const [showFront, setShowFront] = useState(true);
  const [showMid, setShowMid] = useState(true);
  const [showBack, setShowBack] = useState(true);

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
  // Sort by priority: monsters first, then daimyo, bushi, shinto, fortress last
  const FIGURE_PRIORITY: Record<string, number> = {
    monster: 0,
    daimyo: 1,
    bushi: 2,
    shinto: 3,
    fortress: 4,
    kami: 5,
  };

  const allFigures: FigureEntry[] = province.figures.map(fig => {
    const player = gameState.players.find(p => p.id === fig.owner);
    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
    return {
      figure: fig,
      ownerColor: clan?.color || '#666',
      ownerClanId: clan?.id || '',
      ownerName: player?.name || 'Unknown',
    };
  }).sort((a, b) => {
    const priorityA = FIGURE_PRIORITY[a.figure.type] ?? 99;
    const priorityB = FIGURE_PRIORITY[b.figure.type] ?? 99;
    return priorityA - priorityB;
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
    const figureForce = getFigureForce(figure, ownerClanId, gameState, regionId);

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
      const zoomScale = getSizeOverride(figure, ownerClanId);
      const zoomStyle = { height: '60vh' as const, objectFit: 'contain' as const, transform: `scale(${zoomScale})` };

      if (figure.type === 'monster' && figure.monsterCardId) {
        const img = getMonsterFigureImage(figure.monsterCardId);
        if (img) {
          return <img src={img} alt="Monster" style={zoomStyle} />;
        }
        return <img src={TEMPLATE_FIGURE_IMG} alt="Monster" style={zoomStyle} />;
      }
      if (figure.type === 'fortress') {
        const img = getCastleImage(ownerClanId);
        if (img) {
          return <img src={img} alt="Castle" style={zoomStyle} />;
        }
        return <img src={TEMPLATE_FIGURE_IMG} alt="Fortress" style={zoomStyle} />;
      }
      switch (figure.type) {
        case 'bushi':
          return <img src={getBushiImage(ownerClanId) || TEMPLATE_FIGURE_IMG} alt="Bushi" style={zoomStyle} />;
        case 'daimyo': {
          const daimyoZoomImg = getDaimyoImage(ownerClanId);
          return <img src={daimyoZoomImg || TEMPLATE_FIGURE_IMG} alt="Daimyo" style={zoomStyle} />;
        }
        case 'shinto':
          return <img src={getShintoImage(ownerClanId) || TEMPLATE_FIGURE_IMG} alt="Shinto" style={zoomStyle} />;
        case 'kami':
          return <KamiIcon size={200} color={ownerColor} />;
        default:
          return <img src={TEMPLATE_FIGURE_IMG} alt="Figure" style={zoomStyle} />;
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
          <div className="figure-zoom-name" style={{
            color: ownerColor,
            fontWeight: 'bold',
            fontSize: '1.2rem',
            textAlign: 'center',
            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
          }}>
            {figure.type === 'monster' && figure.monsterCardId
              ? getMonsterInfo(figure.monsterCardId)?.name ?? 'Monster'
              : figure.type === 'bushi' ? 'Bushi'
              : figure.type === 'shinto' ? 'Shinto'
              : figure.type === 'daimyo' ? 'Daimyo'
              : figure.type === 'fortress' ? 'Fortaleza'
              : ''}
          </div>
          {monsterPowerText && (
            <div className="figure-zoom-power">{renderCardEffect(monsterPowerText)}</div>
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
            textShadow: '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 8px rgba(255,255,255,0.6)',
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

        {/* Layer toggle switches */}
        {province.figures.length > 0 && (
          <div className="region-diorama-layer-toggles">
            <button
              className={`layer-toggle-btn${showFront ? ' active' : ''}`}
              onClick={() => setShowFront(!showFront)}
            >
              <span className="layer-toggle-indicator" />
              L&iacute;nea Frontal
            </button>
            <button
              className={`layer-toggle-btn${showMid ? ' active' : ''}`}
              onClick={() => setShowMid(!showMid)}
            >
              <span className="layer-toggle-indicator" />
              L&iacute;nea Media
            </button>
            <button
              className={`layer-toggle-btn${showBack ? ' active' : ''}`}
              onClick={() => setShowBack(!showBack)}
            >
              <span className="layer-toggle-indicator" />
              L&iacute;nea Trasera
            </button>
          </div>
        )}

        {province.figures.length === 0 ? (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '18px', zIndex: 0 }} />
            <p className="region-diorama-empty" style={{ position: 'relative', zIndex: 1 }}>{t('regionDetail.empty')}</p>
          </>
        ) : (
          <div className="region-diorama-stage">
            {/* Layer 3 - Back (top): smallest, fixed 345px from bottom */}
            {showBack && backFigures.length > 0 && (
              <div className="region-diorama-layer region-diorama-layer-back" style={{ transform: 'scale(0.6)', zIndex: 1, bottom: '345px' }}>
                {backFigures.map(({ figure, ownerColor, ownerClanId, ownerName }, index) => {
                  const BACK_OFFSETS = [30, 20, 0, 0, 20, 30];
                  const offset = BACK_OFFSETS[index] || 0;
                  return (
                    <div key={figure.id} style={{ position: 'relative', top: `${offset}px` }}>
                      <DioramaFigure
                        figure={figure}
                        ownerColor={ownerColor}
                        ownerClanId={ownerClanId}
                        ownerName={ownerName}
                        iconSize={100}
                        onClick={() => setZoomedFigure({ figure, ownerColor, ownerClanId, ownerName })}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Layer 2 - Middle: normal scale, fixed 255px from bottom */}
            {showMid && midFigures.length > 0 && (
              <div className="region-diorama-layer region-diorama-layer-mid" style={{ transform: 'scale(0.8)', zIndex: 2, bottom: '255px', gap: '27px' }}>
                {midFigures.map(({ figure, ownerColor, ownerClanId, ownerName }, index) => {
                  const MID_OFFSETS = [0, 10, 15, 10, 0];
                  const offset = MID_OFFSETS[index] || 0;
                  return (
                    <div key={figure.id} style={{ position: 'relative', top: `${offset}px` }}>
                      <DioramaFigure
                        figure={figure}
                        ownerColor={ownerColor}
                        ownerClanId={ownerClanId}
                        ownerName={ownerName}
                        iconSize={100}
                        onClick={() => setZoomedFigure({ figure, ownerColor, ownerClanId, ownerName })}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Layer 1 - Front (bottom): largest, fixed 160px from bottom */}
            {showFront && frontFigures.length > 0 && (
              <div className="region-diorama-layer region-diorama-layer-front" style={{ transform: 'scale(1.0)', zIndex: 3, bottom: '160px', ...(frontFigures.length === 3 ? { justifyContent: 'space-between', paddingLeft: '10px', paddingRight: '10px' } : {}) }}>
                {frontFigures.map(({ figure, ownerColor, ownerClanId, ownerName }, index) => {
                  const FRONT_OFFSETS = frontFigures.length === 3 ? [-10, 40, -10] : [-10, 40, 40, -10];
                  const offset = FRONT_OFFSETS[index] || 0;
                  return (
                    <div key={figure.id} style={{ position: 'relative', top: `${offset}px`, ...(frontFigures.length === 3 && index === 0 ? { marginLeft: '135px' } : {}), ...(frontFigures.length === 3 && index === frontFigures.length - 1 ? { marginRight: '135px' } : {}) }}>
                      <DioramaFigure
                        figure={figure}
                        ownerColor={ownerColor}
                        ownerClanId={ownerClanId}
                        ownerName={ownerName}
                        iconSize={100}
                        onClick={() => setZoomedFigure({ figure, ownerColor, ownerClanId, ownerName })}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Figure zoom overlay */}
        {renderZoomOverlay()}
      </div>
    </div>
  );
};
