import { CLANS } from '../types/game';

interface DaimyoPortraitProps {
  clanId: string;
  size?: number;
}

const KoiDaimyo = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" className="daimyo-portrait">
    <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.2)" stroke={color} strokeWidth="2"/>
    {/* Kabuto helmet with wave crest */}
    <path d="M20 35 C20 20 30 10 40 10 C50 10 60 20 60 35 L55 38 L25 38Z" fill={color} opacity="0.8"/>
    <path d="M30 12 Q40 6 50 12" fill="none" stroke={color} strokeWidth="2"/>
    {/* Wave ornament on helmet */}
    <path d="M35 10 Q40 5 45 10 Q40 7 35 10Z" fill={color}/>
    {/* Face */}
    <rect x="28" y="38" width="24" height="20" rx="4" fill="rgba(220,190,150,0.8)"/>
    {/* Eyes */}
    <line x1="33" y1="45" x2="36" y2="45" stroke="rgba(0,0,0,0.7)" strokeWidth="1.5"/>
    <line x1="44" y1="45" x2="47" y2="45" stroke="rgba(0,0,0,0.7)" strokeWidth="1.5"/>
    {/* Mouth */}
    <line x1="36" y1="53" x2="44" y2="53" stroke="rgba(0,0,0,0.3)" strokeWidth="1"/>
    {/* Flowing water motifs on armor */}
    <path d="M25 58 Q32 55 40 58 Q48 61 55 58 L55 70 L25 70Z" fill={color} opacity="0.6"/>
    <path d="M28 63 Q34 60 40 63" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/>
    <path d="M40 63 Q46 60 52 63" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/>
  </svg>
);

const DragonflyDaimyo = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" className="daimyo-portrait">
    <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.2)" stroke={color} strokeWidth="2"/>
    {/* Kabuto with wing-like ornament */}
    <path d="M20 35 C20 20 30 10 40 10 C50 10 60 20 60 35 L55 38 L25 38Z" fill={color} opacity="0.8"/>
    {/* Wing ornaments */}
    <path d="M28 14 L15 5 L25 18Z" fill={color} opacity="0.9"/>
    <path d="M52 14 L65 5 L55 18Z" fill={color} opacity="0.9"/>
    {/* Face */}
    <rect x="28" y="38" width="24" height="20" rx="4" fill="rgba(220,190,150,0.8)"/>
    {/* Stern eyes */}
    <path d="M32 44 L37 44 L35 46Z" fill="rgba(0,0,0,0.6)"/>
    <path d="M43 44 L48 44 L45 46Z" fill="rgba(0,0,0,0.6)"/>
    {/* Mouth */}
    <line x1="36" y1="53" x2="44" y2="53" stroke="rgba(0,0,0,0.3)" strokeWidth="1"/>
    {/* Armor with dragonfly patterns */}
    <path d="M25 58 L55 58 L55 70 L25 70Z" fill={color} opacity="0.6"/>
    <ellipse cx="40" cy="64" rx="4" ry="2" fill="rgba(255,255,255,0.2)"/>
    <line x1="40" y1="60" x2="40" y2="68" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
  </svg>
);

const BonsaiDaimyo = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" className="daimyo-portrait">
    <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.2)" stroke={color} strokeWidth="2"/>
    {/* Nature-adorned helmet with branch crest */}
    <path d="M20 35 C20 20 30 10 40 10 C50 10 60 20 60 35 L55 38 L25 38Z" fill={color} opacity="0.8"/>
    {/* Branch ornament */}
    <line x1="40" y1="12" x2="40" y2="4" stroke={color} strokeWidth="1.5"/>
    <circle cx="36" cy="5" r="2.5" fill={color} opacity="0.7"/>
    <circle cx="44" cy="5" r="2.5" fill={color} opacity="0.7"/>
    <circle cx="40" cy="3" r="2" fill={color} opacity="0.8"/>
    {/* Face */}
    <rect x="28" y="38" width="24" height="20" rx="4" fill="rgba(220,190,150,0.8)"/>
    {/* Wise eyes */}
    <ellipse cx="34" cy="45" rx="2" ry="1" fill="rgba(0,0,0,0.6)"/>
    <ellipse cx="46" cy="45" rx="2" ry="1" fill="rgba(0,0,0,0.6)"/>
    {/* Gentle smile */}
    <path d="M36 53 Q40 55 44 53" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1"/>
    {/* Armor with leaf patterns */}
    <path d="M25 58 L55 58 L55 70 L25 70Z" fill={color} opacity="0.6"/>
    <path d="M32 62 Q35 59 38 62 Q35 65 32 62Z" fill="rgba(255,255,255,0.2)"/>
    <path d="M42 62 Q45 59 48 62 Q45 65 42 62Z" fill="rgba(255,255,255,0.2)"/>
  </svg>
);

const FoxDaimyo = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" className="daimyo-portrait">
    <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.2)" stroke={color} strokeWidth="2"/>
    {/* Fox mask helmet */}
    <path d="M20 35 C20 20 30 10 40 10 C50 10 60 20 60 35 L55 38 L25 38Z" fill={color} opacity="0.8"/>
    {/* Fox ear ornaments */}
    <polygon points="28,15 24,4 34,12" fill={color}/>
    <polygon points="52,15 56,4 46,12" fill={color}/>
    {/* Fox mask face */}
    <path d="M28 38 C28 38 32 42 40 42 C48 42 52 38 52 38 L52 52 C52 56 48 60 40 60 C32 60 28 56 28 52Z" fill="rgba(240,200,160,0.9)"/>
    {/* Fox eye markings */}
    <path d="M30 44 L36 44 L34 47Z" fill={color} opacity="0.7"/>
    <path d="M44 44 L50 44 L46 47Z" fill={color} opacity="0.7"/>
    {/* Eyes */}
    <ellipse cx="34" cy="46" rx="1.5" ry="1" fill="rgba(0,0,0,0.7)"/>
    <ellipse cx="46" cy="46" rx="1.5" ry="1" fill="rgba(0,0,0,0.7)"/>
    {/* Fox nose */}
    <ellipse cx="40" cy="53" rx="2" ry="1.5" fill="rgba(0,0,0,0.5)"/>
    {/* Armor */}
    <path d="M25 60 L55 60 L55 70 L25 70Z" fill={color} opacity="0.6"/>
  </svg>
);

const LotusDaimyo = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" className="daimyo-portrait">
    <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.2)" stroke={color} strokeWidth="2"/>
    {/* Elegant helmet with lotus crest */}
    <path d="M22 35 C22 22 30 12 40 12 C50 12 58 22 58 35 L54 38 L26 38Z" fill={color} opacity="0.8"/>
    {/* Lotus ornament on top */}
    <ellipse cx="40" cy="10" rx="3" ry="5" fill={color} opacity="0.9"/>
    <ellipse cx="36" cy="11" rx="2" ry="4" fill={color} opacity="0.7" transform="rotate(-20 36 11)"/>
    <ellipse cx="44" cy="11" rx="2" ry="4" fill={color} opacity="0.7" transform="rotate(20 44 11)"/>
    {/* Face */}
    <rect x="28" y="38" width="24" height="20" rx="4" fill="rgba(220,190,150,0.8)"/>
    {/* Elegant eyes */}
    <path d="M31 44 Q34 42 37 44" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2"/>
    <path d="M43 44 Q46 42 49 44" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2"/>
    {/* Refined mouth */}
    <path d="M37 52 Q40 54 43 52" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8"/>
    {/* Elegant robes */}
    <path d="M25 58 L55 58 L58 72 L22 72Z" fill={color} opacity="0.5"/>
    <path d="M35 58 L40 70 L45 58" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
  </svg>
);

const TurtleDaimyo = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" className="daimyo-portrait">
    <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.2)" stroke={color} strokeWidth="2"/>
    {/* Heavy shell-like helmet */}
    <path d="M18 36 C18 18 28 8 40 8 C52 8 62 18 62 36 L56 40 L24 40Z" fill={color} opacity="0.8"/>
    {/* Shell pattern on helmet */}
    <path d="M30 20 L40 14 L50 20 L45 28 L35 28Z" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8"/>
    {/* Heavy brow plate */}
    <rect x="26" y="36" width="28" height="4" rx="2" fill={color} opacity="0.9"/>
    {/* Face */}
    <rect x="28" y="40" width="24" height="18" rx="3" fill="rgba(220,190,150,0.8)"/>
    {/* Stoic eyes */}
    <rect x="32" y="45" width="4" height="2" rx="1" fill="rgba(0,0,0,0.6)"/>
    <rect x="44" y="45" width="4" height="2" rx="1" fill="rgba(0,0,0,0.6)"/>
    {/* Firm mouth */}
    <line x1="36" y1="53" x2="44" y2="53" stroke="rgba(0,0,0,0.4)" strokeWidth="1.2"/>
    {/* Heavy shell-like armor */}
    <path d="M22 58 L58 58 L56 72 L24 72Z" fill={color} opacity="0.6"/>
    <path d="M30 62 L40 60 L50 62 L46 68 L34 68Z" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8"/>
  </svg>
);

export const DaimyoPortrait = ({ clanId, size = 80 }: DaimyoPortraitProps) => {
  const clan = CLANS.find(c => c.id === clanId);
  if (!clan) return null;
  const color = clan.color;

  switch (clanId) {
    case 'koi': return <KoiDaimyo color={color} size={size} />;
    case 'dragonfly': return <DragonflyDaimyo color={color} size={size} />;
    case 'bonsai': return <BonsaiDaimyo color={color} size={size} />;
    case 'fox': return <FoxDaimyo color={color} size={size} />;
    case 'lotus': return <LotusDaimyo color={color} size={size} />;
    case 'turtle': return <TurtleDaimyo color={color} size={size} />;
    default: return null;
  }
};
