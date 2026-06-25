import { CLANS } from '../types/game';

interface ClanShieldProps {
  clanId: string;
  size?: number;
}

const HexFrame = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <>
    <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="rgba(0,0,0,0.3)" stroke={color} strokeWidth="2.5"/>
    <polygon points="32,10 50,22 50,42 32,54 14,42 14,22" fill="none" stroke={color} strokeWidth="0.5" opacity="0.5"/>
    {children}
  </>
);

const KoiShield = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className="clan-shield">
    <HexFrame color={color}>
      <path d="M20 38 C24 34 30 30 36 28 C42 26 48 28 50 32 C48 36 42 38 36 36 C30 34 26 38 24 42 C22 44 20 42 20 38Z" fill={color} opacity="0.9"/>
      <circle cx="46" cy="31" r="1.5" fill="rgba(0,0,0,0.6)"/>
      <path d="M20 38 C18 35 16 32 18 30 C17 34 19 36 20 38Z" fill={color} opacity="0.7"/>
      <path d="M26 22 Q32 19 38 22" fill="none" stroke={color} strokeWidth="1" opacity="0.4"/>
      <path d="M24 46 Q32 43 40 46" fill="none" stroke={color} strokeWidth="1" opacity="0.4"/>
    </HexFrame>
  </svg>
);

const SolShield = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className="clan-shield">
    <HexFrame color={color}>
      <circle cx="32" cy="32" r="8" fill={color} opacity="0.9"/>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1={32 + 10 * Math.cos((angle * Math.PI) / 180)}
          y1={32 + 10 * Math.sin((angle * Math.PI) / 180)}
          x2={32 + 15 * Math.cos((angle * Math.PI) / 180)}
          y2={32 + 15 * Math.sin((angle * Math.PI) / 180)}
          stroke={color}
          strokeWidth="2"
          opacity="0.8"
        />
      ))}
      <circle cx="32" cy="32" r="5" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5"/>
    </HexFrame>
  </svg>
);

const LotoShield = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className="clan-shield">
    <HexFrame color={color}>
      <ellipse cx="32" cy="26" rx="3" ry="8" fill={color} opacity="0.7"/>
      <ellipse cx="26" cy="30" rx="3" ry="7" fill={color} opacity="0.6" transform="rotate(-30 26 30)"/>
      <ellipse cx="38" cy="30" rx="3" ry="7" fill={color} opacity="0.6" transform="rotate(30 38 30)"/>
      <ellipse cx="24" cy="36" rx="3" ry="6" fill={color} opacity="0.5" transform="rotate(-55 24 36)"/>
      <ellipse cx="40" cy="36" rx="3" ry="6" fill={color} opacity="0.5" transform="rotate(55 40 36)"/>
      <circle cx="32" cy="34" r="4" fill={color} opacity="0.9"/>
      <circle cx="32" cy="34" r="2" fill="rgba(0,0,0,0.3)"/>
    </HexFrame>
  </svg>
);

const TortugaShield = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className="clan-shield">
    <HexFrame color={color}>
      <ellipse cx="32" cy="32" rx="14" ry="12" fill={color} opacity="0.6"/>
      <polygon points="32,22 38,26 38,34 32,38 26,34 26,26" fill={color} opacity="0.8" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
      <line x1="32" y1="22" x2="32" y2="38" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
      <line x1="26" y1="26" x2="38" y2="34" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
      <line x1="38" y1="26" x2="26" y2="34" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
      <ellipse cx="32" cy="18" rx="3" ry="3" fill={color} opacity="0.7"/>
      <ellipse cx="22" cy="28" rx="3" ry="2" fill={color} opacity="0.5" transform="rotate(-20 22 28)"/>
      <ellipse cx="42" cy="28" rx="3" ry="2" fill={color} opacity="0.5" transform="rotate(20 42 28)"/>
      <ellipse cx="22" cy="38" rx="3" ry="2" fill={color} opacity="0.5" transform="rotate(20 22 38)"/>
      <ellipse cx="42" cy="38" rx="3" ry="2" fill={color} opacity="0.5" transform="rotate(-20 42 38)"/>
      <ellipse cx="32" cy="46" rx="2" ry="2" fill={color} opacity="0.5"/>
    </HexFrame>
  </svg>
);

const LibelulaShield = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className="clan-shield">
    <HexFrame color={color}>
      <ellipse cx="32" cy="34" rx="2.5" ry="8" fill={color} opacity="0.9"/>
      <ellipse cx="22" cy="30" rx="8" ry="4" fill={color} opacity="0.5" transform="rotate(-15 22 30)"/>
      <ellipse cx="42" cy="30" rx="8" ry="4" fill={color} opacity="0.5" transform="rotate(15 42 30)"/>
      <ellipse cx="23" cy="36" rx="6" ry="3" fill={color} opacity="0.4" transform="rotate(-10 23 36)"/>
      <ellipse cx="41" cy="36" rx="6" ry="3" fill={color} opacity="0.4" transform="rotate(10 41 36)"/>
      <circle cx="32" cy="24" r="3" fill={color} opacity="0.9"/>
      <circle cx="30" cy="23" r="1" fill="rgba(0,0,0,0.5)"/>
      <circle cx="34" cy="23" r="1" fill="rgba(0,0,0,0.5)"/>
    </HexFrame>
  </svg>
);

const ZorroShield = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className="clan-shield">
    <HexFrame color={color}>
      <path d="M32 48 C24 46 18 40 18 34 C18 28 22 22 26 18 L32 24 L38 18 C42 22 46 28 46 34 C46 40 40 46 32 48Z" fill={color} opacity="0.8"/>
      <polygon points="22,22 26,18 24,28" fill={color} opacity="0.9"/>
      <polygon points="42,22 38,18 40,28" fill={color} opacity="0.9"/>
      <ellipse cx="27" cy="34" rx="2.5" ry="2" fill="rgba(0,0,0,0.6)"/>
      <ellipse cx="37" cy="34" rx="2.5" ry="2" fill="rgba(0,0,0,0.6)"/>
      <ellipse cx="32" cy="40" rx="2" ry="1.5" fill="rgba(0,0,0,0.5)"/>
      <line x1="20" y1="36" x2="26" y2="37" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8"/>
      <line x1="38" y1="37" x2="44" y2="36" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8"/>
    </HexFrame>
  </svg>
);

const BonsaiShield = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className="clan-shield">
    <HexFrame color={color}>
      <path d="M30 48 L30 38 Q30 35 32 34 Q34 35 34 38 L34 48Z" fill={color} opacity="0.8"/>
      <ellipse cx="32" cy="28" rx="10" ry="6" fill={color} opacity="0.7"/>
      <ellipse cx="28" cy="24" rx="6" ry="5" fill={color} opacity="0.6"/>
      <ellipse cx="36" cy="24" rx="6" ry="5" fill={color} opacity="0.6"/>
      <ellipse cx="32" cy="20" rx="5" ry="4" fill={color} opacity="0.8"/>
      <rect x="26" y="48" width="12" height="4" rx="1" fill={color} opacity="0.6"/>
    </HexFrame>
  </svg>
);

const LunaShield = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className="clan-shield">
    <HexFrame color={color}>
      <path d="M38 16 C28 20 24 28 24 34 C24 42 30 50 38 52 C30 50 22 42 22 32 C22 22 28 16 38 16Z" fill={color} opacity="0.9"/>
      <circle cx="46" cy="20" r="1.5" fill={color} opacity="0.7"/>
      <circle cx="50" cy="30" r="1" fill={color} opacity="0.5"/>
      <circle cx="48" cy="42" r="1.2" fill={color} opacity="0.6"/>
    </HexFrame>
  </svg>
);

export const ClanShield = ({ clanId, size = 48 }: ClanShieldProps) => {
  const clan = CLANS.find(c => c.id === clanId);
  if (!clan) return null;
  const color = clan.color;

  switch (clanId) {
    case 'koi': return <KoiShield color={color} size={size} />;
    case 'sol': return <SolShield color={color} size={size} />;
    case 'loto': return <LotoShield color={color} size={size} />;
    case 'tortuga': return <TortugaShield color={color} size={size} />;
    case 'libelula': return <LibelulaShield color={color} size={size} />;
    case 'zorro': return <ZorroShield color={color} size={size} />;
    case 'bonsai': return <BonsaiShield color={color} size={size} />;
    case 'luna': return <LunaShield color={color} size={size} />;
    default: return null;
  }
};
