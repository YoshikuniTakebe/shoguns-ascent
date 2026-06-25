import { useGameStore } from '../store/gameStore';
import { CLANS, KAMI_DATA } from '../types/game';
import type { KamiType } from '../types/game';

const KAMI_PALETTES: Record<KamiType, { primary: string; secondary: string; glow: string }> = {
  amaterasu: { primary: '#FFD700', secondary: '#FFA500', glow: 'rgba(255,215,0,0.3)' },
  fujin: { primary: '#4ECDC4', secondary: '#2C7873', glow: 'rgba(78,205,196,0.3)' },
  hachiman: { primary: '#DC143C', secondary: '#8B0000', glow: 'rgba(220,20,60,0.3)' },
  raijin: { primary: '#9B59B6', secondary: '#6C3483', glow: 'rgba(155,89,182,0.3)' },
  ryujin: { primary: '#1E90FF', secondary: '#003366', glow: 'rgba(30,144,255,0.3)' },
  susanoo: { primary: '#2ECC71', secondary: '#145A32', glow: 'rgba(46,204,113,0.3)' },
  tsukuyomi: { primary: '#C0C0C0', secondary: '#4A4A8A', glow: 'rgba(192,192,192,0.3)' },
};

function KamiIllustration({ type, size = 80 }: { type: KamiType; size?: number }) {
  const palette = KAMI_PALETTES[type];
  const p = palette.primary;
  const s = palette.secondary;

  switch (type) {
    case 'amaterasu':
      return (
        <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
          <defs>
            <radialGradient id="sun-glow-am" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={p} stopOpacity="0.8" />
              <stop offset="60%" stopColor={s} stopOpacity="0.4" />
              <stop offset="100%" stopColor={s} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="50" fill="url(#sun-glow-am)" />
          <circle cx="60" cy="60" r="24" fill={p} opacity="0.9" />
          <circle cx="60" cy="60" r="18" fill={s} opacity="0.5" />
          {[0,45,90,135,180,225,270,315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 60 + 28 * Math.cos(rad);
            const y1 = 60 + 28 * Math.sin(rad);
            const x2 = 60 + 44 * Math.cos(rad);
            const y2 = 60 + 44 * Math.sin(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={p} strokeWidth="3" strokeLinecap="round" opacity="0.8" />;
          })}
          <path d="M52 54 Q56 48 60 54 Q64 48 68 54 L68 62 Q64 68 60 62 Q56 68 52 62 Z" fill={s} opacity="0.8" />
          <circle cx="55" cy="56" r="2" fill="white" opacity="0.9" />
          <circle cx="65" cy="56" r="2" fill="white" opacity="0.9" />
          <path d="M56 64 Q60 68 64 64" stroke="white" strokeWidth="1.5" fill="none" opacity="0.7" />
          <path d="M40 36 Q50 28 60 30 Q70 28 80 36" stroke={p} strokeWidth="2" fill="none" opacity="0.6" />
          <path d="M44 32 L48 24 L52 32 M58 28 L60 20 L62 28 M68 32 L72 24 L76 32" stroke={p} strokeWidth="1.5" fill="none" opacity="0.5" />
          <path d="M36 80 Q48 76 60 78 Q72 76 84 80 L84 95 Q72 92 60 94 Q48 92 36 95 Z" fill={p} opacity="0.3" />
          <path d="M42 84 L48 82 L54 84 L60 82 L66 84 L72 82 L78 84" stroke={p} strokeWidth="1" opacity="0.5" />
        </svg>
      );
    case 'fujin':
      return (
        <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="wind-grad-fj" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={p} stopOpacity="0.6" />
              <stop offset="100%" stopColor={s} stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="60" rx="50" ry="50" fill="url(#wind-grad-fj)" opacity="0.3" />
          <circle cx="60" cy="50" r="14" fill={p} opacity="0.8" />
          <circle cx="55" cy="47" r="2.5" fill="white" opacity="0.9" />
          <circle cx="65" cy="47" r="2.5" fill="white" opacity="0.9" />
          <path d="M54 56 Q60 62 66 56" stroke="white" strokeWidth="2" fill="none" opacity="0.7" />
          <path d="M60 64 L60 90 M50 72 L70 72" stroke={p} strokeWidth="3" strokeLinecap="round" />
          <path d="M60 90 L50 105 M60 90 L70 105" stroke={p} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M26 40 Q40 34 54 38" stroke={p} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
          <path d="M20 50 Q38 42 56 48" stroke={p} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M66 38 Q80 34 94 40" stroke={p} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
          <path d="M64 48 Q82 42 100 50" stroke={p} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M30 60 Q45 55 60 58 Q75 55 90 60" stroke={s} strokeWidth="1.5" fill="none" opacity="0.4" />
          <path d="M25 68 Q45 62 65 66 Q85 62 95 68" stroke={s} strokeWidth="1" fill="none" opacity="0.3" />
          <ellipse cx="30" cy="44" rx="8" ry="5" fill={p} opacity="0.2" />
          <ellipse cx="90" cy="44" rx="8" ry="5" fill={p} opacity="0.2" />
          <path d="M40 28 Q50 22 60 26 Q70 22 80 28" stroke={p} strokeWidth="2" fill="none" opacity="0.5" />
        </svg>
      );
    case 'hachiman':
      return (
        <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
          <defs>
            <radialGradient id="war-glow-hc" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={p} stopOpacity="0.4" />
              <stop offset="100%" stopColor={s} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="50" fill="url(#war-glow-hc)" />
          <path d="M40 30 L60 20 L80 30 L80 45 L60 50 L40 45 Z" fill={s} opacity="0.8" />
          <path d="M45 32 L60 24 L75 32 L75 42 L60 46 L45 42 Z" fill={p} opacity="0.6" />
          <path d="M36 35 L40 30 M80 30 L84 35" stroke={p} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M34 33 L32 28 M86 33 L88 28" stroke={p} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <circle cx="60" cy="60" r="10" fill={p} opacity="0.7" />
          <circle cx="56" cy="58" r="2" fill="white" opacity="0.9" />
          <circle cx="64" cy="58" r="2" fill="white" opacity="0.9" />
          <path d="M56 64 L60 66 L64 64" stroke="white" strokeWidth="1.5" fill="none" />
          <path d="M60 70 L60 90" stroke={p} strokeWidth="3" strokeLinecap="round" />
          <path d="M48 76 L72 76" stroke={p} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 90 L50 106 M60 90 L70 106" stroke={p} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M72 76 L90 60 L94 56" stroke={p} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M90 60 L96 58 L92 64" fill={p} />
          <path d="M48 76 L30 60 L26 56" stroke={p} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M30 60 L24 58 L28 64" fill={p} />
          <path d="M42 95 L42 110 L44 108 L44 112 L46 110" stroke={s} strokeWidth="1.5" opacity="0.5" />
          <path d="M78 95 L78 110 L76 108 L76 112 L74 110" stroke={s} strokeWidth="1.5" opacity="0.5" />
        </svg>
      );
    case 'raijin':
      return (
        <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
          <defs>
            <radialGradient id="thunder-glow-rj" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor={p} stopOpacity="0.5" />
              <stop offset="100%" stopColor={s} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="55" r="50" fill="url(#thunder-glow-rj)" />
          <circle cx="60" cy="48" r="12" fill={p} opacity="0.8" />
          <circle cx="56" cy="46" r="2" fill="white" opacity="0.9" />
          <circle cx="64" cy="46" r="2" fill="white" opacity="0.9" />
          <path d="M55 53 L60 56 L65 53" stroke="white" strokeWidth="2" fill="none" />
          <path d="M60 60 L60 85 M48 70 L72 70" stroke={p} strokeWidth="3" strokeLinecap="round" />
          <path d="M60 85 L50 102 M60 85 L70 102" stroke={p} strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="36" cy="68" rx="10" ry="8" stroke={p} strokeWidth="2" fill={s} opacity="0.5" />
          <ellipse cx="84" cy="68" rx="10" ry="8" stroke={p} strokeWidth="2" fill={s} opacity="0.5" />
          <ellipse cx="30" cy="64" rx="8" ry="6" stroke={p} strokeWidth="1.5" fill={s} opacity="0.3" />
          <ellipse cx="90" cy="64" rx="8" ry="6" stroke={p} strokeWidth="1.5" fill={s} opacity="0.3" />
          <path d="M28 18 L34 32 L28 32 L36 48" stroke={p} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M82 15 L88 30 L82 30 L90 46" stroke={p} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M55 10 L58 20 L54 20 L60 34" stroke={p} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          <path d="M38 30 L60 34 L82 30" stroke={p} strokeWidth="2" fill="none" opacity="0.4" />
        </svg>
      );
    case 'ryujin':
      return (
        <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="sea-grad-ry" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={p} stopOpacity="0.4" />
              <stop offset="100%" stopColor={s} stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="70" rx="50" ry="40" fill="url(#sea-grad-ry)" opacity="0.3" />
          <path d="M10 80 Q25 72 40 80 Q55 88 70 80 Q85 72 100 80 Q115 88 120 80" stroke={p} strokeWidth="2" fill="none" opacity="0.5" />
          <path d="M0 90 Q15 82 30 90 Q45 98 60 90 Q75 82 90 90 Q105 98 120 90" stroke={p} strokeWidth="1.5" fill="none" opacity="0.3" />
          <path d="M50 20 Q55 15 60 20 Q65 15 70 20 L72 28 Q66 32 60 28 Q54 32 48 28 Z" fill={p} opacity="0.8" />
          <circle cx="54" cy="22" r="2" fill="white" opacity="0.9" />
          <circle cx="66" cy="22" r="2" fill="white" opacity="0.9" />
          <path d="M56 26 Q60 30 64 26" stroke="white" strokeWidth="1.5" fill="none" />
          <path d="M60 32 Q70 40 75 50 Q80 60 72 70 Q64 80 55 72 Q46 64 50 54 Q54 44 60 32" stroke={p} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M55 72 Q48 80 42 75 Q36 70 40 62 Q44 54 50 48" stroke={p} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M42 75 Q36 82 32 78 Q28 74 32 68" stroke={p} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
          <path d="M75 50 L82 46 L78 44 M72 70 L78 74 L76 70" stroke={p} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <path d="M48 28 L42 24 L44 20 M72 28 L78 24 L76 20" stroke={p} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <circle cx="80" cy="36" r="3" fill={p} opacity="0.3" />
          <circle cx="86" cy="42" r="2" fill={p} opacity="0.2" />
          <circle cx="34" cy="56" r="2.5" fill={p} opacity="0.3" />
        </svg>
      );
    case 'susanoo':
      return (
        <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
          <defs>
            <radialGradient id="storm-glow-ss" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={p} stopOpacity="0.4" />
              <stop offset="70%" stopColor={s} stopOpacity="0.2" />
              <stop offset="100%" stopColor={s} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="50" fill="url(#storm-glow-ss)" />
          <path d="M20 20 Q40 14 60 20 Q80 26 100 20" stroke={p} strokeWidth="2" fill="none" opacity="0.4" />
          <path d="M15 28 Q35 22 55 28 Q75 34 95 28" stroke={p} strokeWidth="1.5" fill="none" opacity="0.3" />
          <circle cx="60" cy="50" r="12" fill={p} opacity="0.8" />
          <circle cx="56" cy="48" r="2" fill="white" opacity="0.9" />
          <circle cx="64" cy="48" r="2" fill="white" opacity="0.9" />
          <path d="M56 55 L60 57 L64 55" stroke="white" strokeWidth="1.5" fill="none" />
          <path d="M44 38 L48 34 L52 38 M68 38 L72 34 L76 38" stroke={p} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M60 62 L60 88 M48 72 L72 72" stroke={p} strokeWidth="3" strokeLinecap="round" />
          <path d="M60 88 L48 105 M60 88 L72 105" stroke={p} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M72 72 L92 58 L96 54" stroke={p} strokeWidth="3" strokeLinecap="round" />
          <path d="M92 58 L98 56 L94 62 Z" fill={p} opacity="0.8" />
          <path d="M96 54 L100 48 L94 50" stroke={p} strokeWidth="1.5" fill="none" opacity="0.5" />
          <path d="M30 70 Q40 66 50 70 Q40 74 30 70" fill={p} opacity="0.2" />
          <path d="M70 90 Q80 86 90 90 Q80 94 70 90" fill={p} opacity="0.2" />
          <path d="M18 50 L24 60 L20 60 L26 72" stroke={p} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </svg>
      );
    case 'tsukuyomi':
      return (
        <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
          <defs>
            <radialGradient id="moon-glow-tk" cx="45%" cy="45%" r="50%">
              <stop offset="0%" stopColor={p} stopOpacity="0.6" />
              <stop offset="60%" stopColor={s} stopOpacity="0.3" />
              <stop offset="100%" stopColor={s} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="55" r="50" fill="url(#moon-glow-tk)" />
          <circle cx="55" cy="30" r="20" fill={p} opacity="0.6" />
          <circle cx="62" cy="26" r="14" fill="#1a1a2e" opacity="0.7" />
          <circle cx="48" cy="28" r="2" fill={p} opacity="0.3" />
          <circle cx="52" cy="36" r="1.5" fill={p} opacity="0.2" />
          <circle cx="60" cy="50" r="11" fill={p} opacity="0.7" />
          <circle cx="56" cy="48" r="2" fill="white" opacity="0.9" />
          <circle cx="64" cy="48" r="2" fill="white" opacity="0.9" />
          <path d="M57 54 Q60 57 63 54" stroke="white" strokeWidth="1.5" fill="none" opacity="0.7" />
          <path d="M60 61 L60 86" stroke={p} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M50 70 L70 70" stroke={p} strokeWidth="2" strokeLinecap="round" />
          <path d="M60 86 L52 100 M60 86 L68 100" stroke={p} strokeWidth="2" strokeLinecap="round" />
          <path d="M42 60 Q50 56 58 60 Q50 64 42 60" fill={p} opacity="0.2" />
          <path d="M62 60 Q70 56 78 60 Q70 64 62 60" fill={p} opacity="0.2" />
          <circle cx="28" cy="20" r="1.5" fill={p} opacity="0.5" />
          <circle cx="88" cy="16" r="1" fill={p} opacity="0.4" />
          <circle cx="95" cy="35" r="1.5" fill={p} opacity="0.3" />
          <circle cx="20" cy="45" r="1" fill={p} opacity="0.4" />
          <circle cx="100" cy="55" r="1.5" fill={p} opacity="0.3" />
          <circle cx="15" cy="70" r="1" fill={p} opacity="0.2" />
          <path d="M80 80 Q85 76 90 80 Q95 84 90 88 Q85 84 80 88 Q75 84 80 80" fill={p} opacity="0.15" />
          <path d="M25 85 Q30 81 35 85 Q40 89 35 93 Q30 89 25 93 Q20 89 25 85" fill={p} opacity="0.12" />
        </svg>
      );
  }
}

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
                <KamiIllustration type={temple.kamiType} size={64} />
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
