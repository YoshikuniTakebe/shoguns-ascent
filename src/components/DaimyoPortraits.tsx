import { CLANS } from '../types/game';

interface DaimyoPortraitProps {
  clanId: string;
  size?: number;
}

const GenericDaimyo = ({ color, size, emblem }: { color: string; size: number; emblem: string }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" className="daimyo-portrait">
    <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.2)" stroke={color} strokeWidth="2"/>
    <path d="M20 35 C20 20 30 10 40 10 C50 10 60 20 60 35 L55 38 L25 38Z" fill={color} opacity="0.8"/>
    <rect x="28" y="38" width="24" height="20" rx="4" fill="rgba(220,190,150,0.8)"/>
    <line x1="33" y1="45" x2="36" y2="45" stroke="rgba(0,0,0,0.7)" strokeWidth="1.5"/>
    <line x1="44" y1="45" x2="47" y2="45" stroke="rgba(0,0,0,0.7)" strokeWidth="1.5"/>
    <line x1="36" y1="53" x2="44" y2="53" stroke="rgba(0,0,0,0.3)" strokeWidth="1"/>
    <path d="M25 58 L55 58 L55 70 L25 70Z" fill={color} opacity="0.6"/>
    <text x="40" y="68" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">{emblem}</text>
  </svg>
);

export const DaimyoPortrait = ({ clanId, size = 80 }: DaimyoPortraitProps) => {
  const clan = CLANS.find(c => c.id === clanId);
  if (!clan) return null;
  const color = clan.color;

  const emblems: Record<string, string> = {
    koi: '\u9B5A',
    sol: '\u2600',
    loto: '\u84EE',
    tortuga: '\u4E80',
    libelula: '\u7FBD',
    zorro: '\u72D0',
    bonsai: '\u6728',
    luna: '\u6708',
  };

  return <GenericDaimyo color={color} size={size} emblem={emblems[clanId] || ''} />;
};
