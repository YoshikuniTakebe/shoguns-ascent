import { useGameStore } from '../store/gameStore';
import { CLANS, KAMI_DATA } from '../types/game';
import type { KamiType } from '../types/game';

import amaterasuImg from '../img/Amaterasu.png';
import fujinImg from '../img/Fujin.png';
import hachimanImg from '../img/Hachiman.png';
import raijinImg from '../img/Raijin.png';
import ryujinImg from '../img/Ryujin.png';
import susanooImg from '../img/Susanoo.png';
import tsukuyomiImg from '../img/Tsukuyomi.png';

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

export const TemplePanel = () => {
  const { gameState } = useGameStore();
  if (!gameState) return null;
  if (gameState.temples.length === 0) return null;

  // Pad to 4 slots (the game uses exactly 4 kami)
  const slots = Array.from({ length: 4 }, (_, i) => gameState.temples[i] || null);

  return (
    <div className="kami-track">
      <div className="kami-track-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L14.5 8.5L21 9.5L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9.5L9.5 8.5L12 2Z" fill="var(--accent-gold)" />
        </svg>
        <span>Kami Track</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L14.5 8.5L21 9.5L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9.5L9.5 8.5L12 2Z" fill="var(--accent-gold)" />
        </svg>
      </div>
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

          return (
            <div
              key={temple.id}
              className="kami-slot filled"
              style={{
                borderColor: palette.primary,
                boxShadow: `0 0 12px ${palette.glow}, inset 0 0 20px ${palette.glow}`,
              }}
            >
              <div className="kami-slot-illustration">
                <img
                  src={KAMI_IMAGES[temple.kamiType]}
                  alt={kami?.name || temple.kamiType}
                  width={64}
                  height={64}
                  style={{ borderRadius: '6px', objectFit: 'cover' }}
                />
              </div>
              <div className="kami-slot-info">
                <div className="kami-slot-name" style={{ color: palette.primary }}>
                  {kami?.name || temple.kamiType}
                </div>
                <div className="kami-slot-effect">
                  {kami?.effect || ''}
                </div>
              </div>
              {temple.figures.length > 0 && (
                <div className="kami-slot-figures">
                  {temple.figures.map((fig, i) => {
                    const player = gameState.players.find(pl => pl.id === fig.playerId);
                    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
                    return (
                      <span
                        key={i}
                        className="kami-figure-dot"
                        style={{ backgroundColor: clan?.color || '#666' }}
                        title={player?.name || ''}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
