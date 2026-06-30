import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, KAMI_DATA } from '../types/game';
import type { KamiType } from '../types/game';
import type { TranslationKey } from '../i18n';
import { useT } from '../i18n';

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
  const { gameState, komainuPrayMode, doKomainuPlaceAtTemple, recruitMode, recruitFigureType, doRecruitPlaceTempleShinto, jinmenjuSummonActive, doJinmenjuPlaceTemple } = useGameStore();
  const [selectedKami, setSelectedKami] = useState<KamiType | null>(null);
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

  // Group figures by clan for the modal
  const figuresByClan: { clanId: string; clanName: string; color: string; count: number }[] = [];
  if (selectedTemple) {
    const clanCounts: Record<string, number> = {};
    for (const fig of selectedTemple.figures) {
      const player = gameState.players.find(pl => pl.id === fig.playerId);
      if (player) {
        clanCounts[player.clanId] = (clanCounts[player.clanId] || 0) + 1;
      }
    }
    for (const [clanId, count] of Object.entries(clanCounts)) {
      const clan = CLANS.find(c => c.id === clanId);
      if (clan) {
        figuresByClan.push({ clanId, clanName: clan.name, color: clan.color, count });
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

          return (
            <div
              key={temple.id}
              className={`kami-slot filled${komainuPrayMode ? ' komainu-target' : ''}${isRecruitShintoTarget ? ' recruit-target' : ''}`}
              style={{
                borderColor: palette.primary,
                backgroundImage: `url(${KAMI_TILE_IMAGES[temple.kamiType]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                boxShadow: komainuPrayMode || isRecruitShintoTarget
                  ? `0 0 8px rgba(255,215,0,0.3), 0 0 16px rgba(255,215,0,0.15)`
                  : `0 0 12px ${palette.glow}, inset 0 0 20px ${palette.glow}`,
                cursor: komainuPrayMode || isRecruitShintoTarget ? 'pointer' : undefined,
              }}
              onClick={() => {
                if (komainuPrayMode) {
                  doKomainuPlaceAtTemple(temple.id);
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
              {temple.figures.length > 0 && (
                <div className="kami-slot-figures">
                  {temple.figures.map((fig, i) => {
                    const player = gameState.players.find(pl => pl.id === fig.playerId);
                    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
                    const figColor = clan?.color || '#666';
                    return (
                      <span
                        key={i}
                        className="kami-figure-dot"
                        title={player?.name || ''}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill={figColor} stroke="black" strokeWidth="1">
                          <rect x="4" y="6" width="16" height="2" rx="1" />
                          <rect x="6" y="4" width="12" height="2" rx="0.5" opacity="0.7" />
                          <rect x="7" y="8" width="2" height="14" />
                          <rect x="15" y="8" width="2" height="14" />
                          <rect x="9" y="12" width="6" height="1.5" opacity="0.5" />
                        </svg>
                      </span>
                    );
                  })}
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
            {figuresByClan.length > 0 && (
              <div className="kami-modal-figures">
                <h4 className="kami-modal-figures-title">{t('kamiModal.shintoFigures')}</h4>
                {figuresByClan.map(({ clanId, clanName, color, count }) => {
                  const force = clanId === 'luna' ? count * 2 : count * 1;
                  return (
                    <div key={clanId} className="kami-modal-figure-row">
                      <span
                        className="kami-modal-clan-dot"
                        style={{ backgroundColor: color }}
                      />
                      <span className="kami-modal-clan-name">{clanName}</span>
                      <span className="kami-modal-figure-count">{count}</span>
                      <span className="kami-modal-figure-force" style={{ color: '#DAA520', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                        (Fuerza: {force})
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
