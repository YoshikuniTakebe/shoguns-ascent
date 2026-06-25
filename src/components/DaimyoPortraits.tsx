import { CLANS } from '../types/game';

interface DaimyoPortraitProps {
  clanId: string;
  size?: number;
}

const KabutoPortrait = ({ color, size }: { color: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" className="daimyo-portrait">
    <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.2)" stroke={color} strokeWidth="2"/>
    {/* Maedate (crescent crest on top) */}
    <path d="M20 28 Q22 16 32 12 Q36 10 40 8 Q44 10 48 12 Q58 16 60 28" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M26 24 Q30 14 40 10 Q50 14 54 24" fill={color} opacity="0.3"/>
    {/* Hachi (helmet bowl) */}
    <path d="M22 34 Q22 24 32 22 Q36 20 40 20 Q44 20 48 22 Q58 24 58 34 L56 38 L24 38Z" fill={color} opacity="0.85"/>
    {/* Tehen (top rivet) */}
    <circle cx="40" cy="22" r="2" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5"/>
    {/* Suji (ridges on bowl) */}
    <line x1="32" y1="22" x2="28" y2="36" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8"/>
    <line x1="40" y1="20" x2="40" y2="36" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8"/>
    <line x1="48" y1="22" x2="52" y2="36" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8"/>
    {/* Mabizashi (visor/brim) */}
    <path d="M24 38 L56 38 L54 42 L26 42Z" fill={color} opacity="0.95" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5"/>
    {/* Menpo (face guard) */}
    <path d="M28 44 Q28 42 30 42 L50 42 Q52 42 52 44 L52 52 Q52 56 48 58 Q44 60 40 60 Q36 60 32 58 Q28 56 28 52Z" fill="rgba(180,150,120,0.85)" stroke={color} strokeWidth="1"/>
    {/* Face details on menpo */}
    <path d="M32 48 L36 48" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M44 48 L48 48" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M36 54 Q40 56 44 54" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1" strokeLinecap="round"/>
    {/* Yodare-kake (throat guard ridges) */}
    <path d="M30 58 L50 58" stroke={color} strokeWidth="1" opacity="0.6"/>
    <path d="M31 60 L49 60" stroke={color} strokeWidth="1" opacity="0.5"/>
    <path d="M32 62 L48 62" stroke={color} strokeWidth="1" opacity="0.4"/>
    {/* Shikoro (neck protector flaps) */}
    <path d="M22 38 L18 42 L16 48 L20 50 L24 44" fill={color} opacity="0.6" stroke={color} strokeWidth="0.5"/>
    <path d="M58 38 L62 42 L64 48 L60 50 L56 44" fill={color} opacity="0.6" stroke={color} strokeWidth="0.5"/>
    {/* Shikoro horizontal lames */}
    <line x1="17" y1="44" x2="23" y2="40" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
    <line x1="17" y1="46" x2="22" y2="43" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
    <line x1="57" y1="40" x2="63" y2="44" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
    <line x1="58" y1="43" x2="63" y2="46" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
  </svg>
);

export const DaimyoPortrait = ({ clanId, size = 80 }: DaimyoPortraitProps) => {
  const clan = CLANS.find(c => c.id === clanId);
  if (!clan) return null;
  const color = clan.color;

  return <KabutoPortrait color={color} size={size} />;
};
