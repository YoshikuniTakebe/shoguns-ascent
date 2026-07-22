import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, KAMI_DATA, SEASON_CARDS_DATA } from '../types/game';
import type { KamiType } from '../types/game';
import type { TranslationKey } from '../i18n';
import { useT } from '../i18n';
import { MonsterIcon, ShintoIcon, FistIcon } from './Icons';
import { getCardEffectKey } from '../utils/cardTranslations';
import { renderCardEffect } from '../utils/renderCardEffect';
import { TEMPLATE_FIGURE_IMG } from '../utils/figureImages';

/**
 * Rich hover tooltip for a monster figure in a shrine, matching the map tooltip
 * (see RegionCard's FigureIcon): shows name, Force and the monster's effect.
 */
function ShrineMonsterTooltip({ cardId, color, isLuna, effectText }: { cardId: string; color: string; isLuna: boolean; effectText: string }) {
  const cardData = SEASON_CARDS_DATA.find(c => c.id === cardId);
  const monsterName = cardData?.name || 'Monstruo';
  // Komainu/Hotei count as Shinto (no card force) -> 1 force, doubled to 2 for Luna.
  const baseForce = cardData?.force ?? 1;
  const force = isLuna ? Math.max(baseForce, 2) : baseForce;
  return (
    <span className="figure-tooltip" style={{ borderColor: color }}>
      <span className="figure-tooltip-name">{monsterName}</span>
      <span className="figure-tooltip-force">Force: {force}</span>
      {effectText && <span className="figure-tooltip-power">{renderCardEffect(effectText)}</span>}
    </span>
  );
}

interface HoteiReplacementTarget {
  templeId: string;
  figures: { figureId: string; playerId: string; playerName: string; clanColor: string }[];
}

const KAMI_BASE_EFFECT_KEYS: Record<KamiType, TranslationKey> = {
  amaterasu: 'kami.amaterasu.baseEffect',
  fujin: 'kami.fujin.baseEffect',
  hachiman: 'kami.hachiman.baseEffect',
  raijin: 'kami.raijin.baseEffect',
  ryujin: 'kami.ryujin.baseEffect',
  susanoo: 'kami.susanoo.baseEffect',
  tsukuyomi: 'kami.tsukuyomi.baseEffect',
};

const KAMI_SUMMARY_KEYS: Record<KamiType, TranslationKey> = {
  amaterasu: 'kami.amaterasu.summary',
  fujin: 'kami.fujin.summary',
  hachiman: 'kami.hachiman.summary',
  raijin: 'kami.raijin.summary',
  ryujin: 'kami.ryujin.summary',
  susanoo: 'kami.susanoo.summary',
  tsukuyomi: 'kami.tsukuyomi.summary',
};

const KAMI_EXPANSION_EFFECT_KEYS: Record<KamiType, TranslationKey> = {
  amaterasu: 'kami.amaterasu.expansionEffect',
  fujin: 'kami.fujin.expansionEffect',
  hachiman: 'kami.hachiman.expansionEffect',
  raijin: 'kami.raijin.expansionEffect',
  ryujin: 'kami.ryujin.expansionEffect',
  susanoo: 'kami.susanoo.expansionEffect',
  tsukuyomi: 'kami.tsukuyomi.expansionEffect',
};

import amaterasuImg from '../img/Amaterasu.png';
import fujinImg from '../img/Fujin.png';
import hachimanImg from '../img/Hachiman.png';
import raijinImg from '../img/Raijin.png';
import ryujinImg from '../img/Ryujin.png';
import susanooImg from '../img/Susanoo.png';
import tsukuyomiImg from '../img/Tsukuyomi.png';

import amaterasuTile from '../img/Amaterasu_tile.png';
import fujinTile from '../img/Fujin_tile.png';
import hachimanTile from '../img/Hachiman_tile.png';
import raijinTile from '../img/Raijin_tile.png';
import ryujinTile from '../img/Ryujin_tile.png';
import susanooTile from '../img/Susanoo_tile.png';
import tsukuyomiTile from '../img/Tsukuyomi_tile.png';

const KAMI_PALETTES: Record<KamiType, { primary: string; secondary: string; glow: string }> = {
  amaterasu: { primary: '#FFD700', secondary: '#FFA500', glow: 'rgba(255,215,0,0.3)' },
  fujin: { primary: '#4ECDC4', secondary: '#2C7873', glow: 'rgba(78,205,196,0.3)' },
  hachiman: { primary: '#DC143C', secondary: '#8B0000', glow: 'rgba(220,20,60,0.3)' },
  raijin: { primary: '#9B59B6', secondary: '#6C3483', glow: 'rgba(155,89,182,0.3)' },
  ryujin: { primary: '#1E90FF', secondary: '#003366', glow: 'rgba(30,144,255,0.3)' },
  susanoo: { primary: '#2ECC71', secondary: '#145A32', glow: 'rgba(46,204,113,0.3)' },
  tsukuyomi: { primary: '#C0C0C0', secondary: '#4A4A8A', glow: 'rgba(192,192,192,0.3)' },
};

const KAMI_IMAGES: Record<KamiType, string> = {
  amaterasu: amaterasuImg,
  fujin: fujinImg,
  hachiman: hachimanImg,
  raijin: raijinImg,
  ryujin: ryujinImg,
  susanoo: susanooImg,
  tsukuyomi: tsukuyomiImg,
};

const KAMI_TILE_IMAGES: Record<KamiType, string> = {
  amaterasu: amaterasuTile,
  fujin: fujinTile,
  hachiman: hachimanTile,
  raijin: raijinTile,
  ryujin: ryujinTile,
  susanoo: susanooTile,
  tsukuyomi: tsukuyomiTile,
};

export const TemplePanel = () => {
  const { gameState, localPlayerId, komainuPrayMode, komainuPrayCardId, komainuPrayPlayerId, doKomainuPlaceAtTemple, recruitMode, recruitFigureType, doRecruitPlaceTempleShinto, jinmenjuSummonActive, doJinmenjuPlaceTemple, springLightSelectionMode, springLightSelectedTempleId, selectSpringLightTemple } = useGameStore();
  const [selectedKami, setSelectedKami] = useState<KamiType | null>(null);
  const [hoteiReplacementTarget, setHoteiReplacementTarget] = useState<HoteiReplacementTarget | null>(null);
  const t = useT();

  if (!gameState) return null;
  if (gameState.temples.length === 0) return null;

  // Pad to 4 slots (the game uses exactly 4 kami)
  const slots = Array.from({ length: 4 }, (_, i) => gameState.temples[i] || null);

  const selectedTemple = selectedKami
    ? gameState.temples.find(t => t.kamiType === selectedKami)
    : null;
  const selectedKamiData = selectedKami
    ? KAMI_DATA.find(k => k.type === selectedKami)
    : null;

  // Group figures by clan for the modal, breaking down normal shinto vs shinto-monsters
  // (Komainu/Hotei) so the popup can show the shinto icon + count and each monster's name.
  const figuresByClan: {
    clanId: string;
    clanName: string;
    color: string;
    count: number;
    normalShinto: number;
    monsterNames: string[];
    force: number;
  }[] = [];
  if (selectedTemple) {
    const clanAgg: Record<string, { count: number; normalShinto: number; monsterNames: string[] }> = {};
    for (const fig of selectedTemple.figures) {
      const player = gameState.players.find(pl => pl.id === fig.playerId);
      if (!player) continue;
      if (!clanAgg[player.clanId]) {
        clanAgg[player.clanId] = { count: 0, normalShinto: 0, monsterNames: [] };
      }
      clanAgg[player.clanId].count += 1;
      if (fig.monsterCardId) {
        const cardData = SEASON_CARDS_DATA.find(c => c.id === fig.monsterCardId);
        clanAgg[player.clanId].monsterNames.push(cardData?.name || 'Monstruo');
      } else {
        clanAgg[player.clanId].normalShinto += 1;
      }
    }
    for (const [clanId, agg] of Object.entries(clanAgg)) {
      const clan = CLANS.find(c => c.id === clanId);
      if (clan) {
        const force = clanId === 'luna' ? agg.count * 2 : agg.count * 1;
        figuresByClan.push({
          clanId,
          clanName: clan.name,
          color: clan.color,
          count: agg.count,
          normalShinto: agg.normalShinto,
          monsterNames: agg.monsterNames,
          force,
        });
      }
    }
  }

  return (
    <div className="kami-track">
      <div className="kami-track-slots">
        {slots.map((temple, index) => {
          if (!temple) {
            return (
              <div key={`empty-${index}`} className="kami-slot empty">
                <div className="kami-slot-number">{index + 1}</div>
              </div>
            );
          }

          const kami = KAMI_DATA.find(k => k.type === temple.kamiType);
          const palette = KAMI_PALETTES[temple.kamiType];
          const isRecruitShintoTarget = recruitMode && recruitFigureType === 'shinto';
          const pendingSpringLight = gameState.pendingSpringPlacement?.type === 'light'
            ? gameState.pendingSpringPlacement
            : null;
          const isSpringLightOwner = !!pendingSpringLight
            && springLightSelectionMode
            && (gameState.mode === 'hotseat' || pendingSpringLight.ownerId === localPlayerId);
          const isSpringLightTarget = isSpringLightOwner && temple.figures.length < gameState.players.length;
          const isSpringLightSelected = isSpringLightOwner && springLightSelectedTempleId === temple.id;
          const springLightOwner = pendingSpringLight
            ? gameState.players.find(player => player.id === pendingSpringLight.ownerId)
            : null;
          const springLightClan = springLightOwner
            ? CLANS.find(clan => clan.id === springLightOwner.clanId)
            : null;

          return (
            <div
              key={temple.id}
              className={`kami-slot filled${komainuPrayMode ? ' komainu-target' : ''}${isRecruitShintoTarget ? ' recruit-target' : ''}${isSpringLightTarget ? ' spring-light-target' : ''}${isSpringLightSelected ? ' spring-light-selected' : ''}`}
              style={{
                borderColor: palette.primary,
                backgroundImage: `url(${KAMI_TILE_IMAGES[temple.kamiType]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                boxShadow: isSpringLightSelected
                  ? `0 0 10px ${springLightClan?.color || '#f6cd00'}, 0 0 24px ${springLightClan?.color || '#f6cd00'}, inset 0 0 18px rgba(255,255,255,0.2)`
                  : komainuPrayMode || isRecruitShintoTarget || isSpringLightTarget
                  ? `rgba(246, 205, 0, 1.3) 0px 0px 8px, rgba(247, 214, 18, 1.15) 0px 0px 8px`
                  : `0 0 12px ${palette.glow}, inset 0 0 20px ${palette.glow}`,
                cursor: komainuPrayMode || isRecruitShintoTarget || isSpringLightTarget ? 'pointer' : undefined,
              }}
              onClick={() => {
                if (isSpringLightTarget) {
                  selectSpringLightTemple(temple.id);
                } else if (isSpringLightOwner) {
                  return;
                } else if (komainuPrayMode) {
                  const isHotei = komainuPrayCardId === 'su-hotei';
                  if (isHotei) {
                    // Check if there are other players' shinto in this temple
                    const otherFigures = temple.figures.filter(f => f.playerId !== komainuPrayPlayerId);
                    if (otherFigures.length === 0) {
                      // No other players' shinto - just place normally
                      doKomainuPlaceAtTemple(temple.id);
                    } else if (otherFigures.length === 1) {
                      // Exactly one other player's shinto - replace it directly
                      doKomainuPlaceAtTemple(temple.id, otherFigures[0].figureId);
                    } else {
                      // Multiple other players' shinto - show selection popup
                      const figures = otherFigures.map(f => {
                        const player = gameState.players.find(pl => pl.id === f.playerId);
                        const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
                        return {
                          figureId: f.figureId,
                          playerId: f.playerId,
                          playerName: player?.name || '',
                          clanColor: clan?.color || '#666',
                        };
                      });
                      setHoteiReplacementTarget({ templeId: temple.id, figures });
                    }
                  } else {
                    doKomainuPlaceAtTemple(temple.id);
                  }
                } else if (jinmenjuSummonActive && isRecruitShintoTarget) {
                  doJinmenjuPlaceTemple(temple.id);
                } else if (isRecruitShintoTarget) {
                  doRecruitPlaceTempleShinto(temple.id);
                } else {
                  setSelectedKami(temple.kamiType);
                }
              }}
            >
              <div className="kami-slot-effect">
                {kami ? t(KAMI_SUMMARY_KEYS[kami.type]) : ''}
              </div>
              {(temple.figures.length > 0 || isSpringLightSelected) && (
                <div style={{
                  position: 'absolute',
                  bottom: '54px',
                  right: '6px',
                  display: 'flex',
                  gap: '4px',
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: '6px',
                  padding: '3px 5px',
                }}>
                  {temple.figures.map((fig, i) => {
                    const player = gameState.players.find(pl => pl.id === fig.playerId);
                    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
                    const figColor = clan?.color || '#666';
                    // If figure has a monsterCardId, show MonsterIcon with tooltip
                    if (fig.monsterCardId) {
                      const cardData = SEASON_CARDS_DATA.find(c => c.id === fig.monsterCardId);
                      const monsterEffect = cardData ? t(getCardEffectKey(cardData.id)) : '';
                      const isLuna = player?.clanId === 'luna';
                      return (
                        <span
                          key={i}
                          className="kami-figure-dot figure-icon-wrapper"
                        >
                          <MonsterIcon size={24} color={figColor} />
                          <ShrineMonsterTooltip cardId={fig.monsterCardId} color={figColor} isLuna={isLuna} effectText={monsterEffect} />
                        </span>
                      );
                    }
                    return (
                      <span
                        key={i}
                        className="kami-figure-dot"
                        title={player?.name || ''}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill={figColor} stroke="none" style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.6))' }}>
                          <rect x="4" y="6" width="16" height="2" rx="1" />
                          <rect x="6" y="4" width="12" height="2" rx="0.5" opacity="0.7" />
                          <rect x="7" y="8" width="2" height="14" />
                          <rect x="15" y="8" width="2" height="14" />
                          <rect x="9" y="12" width="6" height="1.5" opacity="0.5" />
                        </svg>
                      </span>
                    );
                  })}
                  {isSpringLightSelected && (
                    <span className="kami-figure-dot spring-light-provisional" title="Colocacion pendiente">
                      <ShintoIcon size={24} color={springLightClan?.color || '#f6cd00'} />
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedKami && selectedKamiData && (
        <div className="kami-modal-backdrop" onClick={() => setSelectedKami(null)}>
          <div className="kami-modal" onClick={(e) => e.stopPropagation()}>
            <button className="kami-modal-close" onClick={() => setSelectedKami(null)}>
              &times;
            </button>
            <div className="kami-modal-image">
              <img
                src={KAMI_IMAGES[selectedKami]}
                alt={selectedKamiData.name}
                width={200}
                height={200}
                style={{
                  borderRadius: '10px',
                  objectFit: 'cover',
                  border: `2px solid ${KAMI_PALETTES[selectedKami].primary}`,
                  boxShadow: `0 0 20px ${KAMI_PALETTES[selectedKami].glow}`,
                }}
              />
            </div>
            <h3
              className="kami-modal-name"
              style={{ color: KAMI_PALETTES[selectedKami].primary }}
            >
              {selectedKamiData.name}
            </h3>
            <p className="kami-modal-effect">{t(KAMI_BASE_EFFECT_KEYS[selectedKami])}</p>
            {gameState.kamiUnboundEnabled && (
              <div className="kami-modal-unbound" style={{ borderColor: KAMI_PALETTES[selectedKami].primary }}>
                <div className="kami-modal-unbound-figure">
                  <img src={TEMPLATE_FIGURE_IMG} alt={selectedKamiData.name} />
                  <strong style={{ color: KAMI_PALETTES[selectedKami].primary }}>{selectedKamiData.name}</strong>
                </div>
                <div className="kami-modal-unbound-power">
                  <span>{t('kami.unbound.mapPower')}</span>
                  <p>{t(KAMI_EXPANSION_EFFECT_KEYS[selectedKami])}</p>
                </div>
              </div>
            )}
            {figuresByClan.length > 0 && (
              <div className="kami-modal-figures">
                <h4 className="kami-modal-figures-title">{t('kamiModal.shintoFigures')}</h4>
                {figuresByClan.map(({ clanId, clanName, color, normalShinto, monsterNames, force }) => {
                  return (
                    <div key={clanId} className="kami-modal-figure-row" style={{ flexWrap: 'wrap' }}>
                      <span
                        className="kami-modal-clan-dot"
                        style={{ backgroundColor: color }}
                      />
                      <span className="kami-modal-clan-name">{clanName}</span>
                      {/* Normal shinto: shinto icon + count */}
                      {normalShinto > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }} title="Shinto">
                          <ShintoIcon size={16} color={color} />
                          <span className="kami-modal-figure-count">{normalShinto}</span>
                        </span>
                      )}
                      {/* Shinto monsters (Komainu/Hotei): show icon + name */}
                      {monsterNames.map((name, mi) => (
                        <span key={mi} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          <MonsterIcon size={16} color={color} />
                          <span style={{ fontSize: '0.78rem', color: '#e0d5b0' }}>{name}</span>
                        </span>
                      ))}
                      {/* Force: force icon + number (replaces the old "(Fuerza: X)" text) */}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#DAA520', marginLeft: '0.4rem' }} title="Fuerza">
                        <FistIcon size={15} color="#DAA520" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{force}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {hoteiReplacementTarget && (
        <div className="kami-modal-backdrop" onClick={() => setHoteiReplacementTarget(null)}>
          <div className="kami-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '320px' }}>
            <button className="kami-modal-close" onClick={() => setHoteiReplacementTarget(null)}>
              &times;
            </button>
            <h3 className="kami-modal-name" style={{ color: '#FFD700' }}>
              Hotei - Reemplazar Shinto
            </h3>
            <p style={{ color: '#ccc', fontSize: '0.85rem', marginBottom: '12px' }}>
              Elige el shinto a reemplazar:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {hoteiReplacementTarget.figures.map((fig) => (
                <button
                  key={fig.figureId}
                  onClick={() => {
                    doKomainuPlaceAtTemple(hoteiReplacementTarget.templeId, fig.figureId);
                    setHoteiReplacementTarget(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: `1px solid ${fig.clanColor}`,
                    borderRadius: '6px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: fig.clanColor, flexShrink: 0 }} />
                  {fig.playerName}
                </button>
              ))}
              <button
                onClick={() => {
                  doKomainuPlaceAtTemple(hoteiReplacementTarget.templeId);
                  setHoteiReplacementTarget(null);
                }}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #555',
                  borderRadius: '6px',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Colocar sin reemplazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
