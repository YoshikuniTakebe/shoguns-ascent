import { CLANS } from '../types/game';

import koiImg from '../img/koi.png';
import solImg from '../img/sol.png';
import lotoImg from '../img/loto.png';
import tortugaImg from '../img/tortuga.png';
import libelulaImg from '../img/libelula.png';
import zorroImg from '../img/zorro.png';
import bonsaiImg from '../img/bonsai.png';
import lunaImg from '../img/luna.png';

interface ClanShieldProps {
  clanId: string;
  size?: number;
}

interface WarSealProps {
  size?: number;
}

const clanImages: Record<string, string> = {
  koi: koiImg,
  sol: solImg,
  loto: lotoImg,
  tortuga: tortugaImg,
  libelula: libelulaImg,
  zorro: zorroImg,
  bonsai: bonsaiImg,
  luna: lunaImg,
};

export const ClanShield = ({ clanId, size = 48 }: ClanShieldProps) => {
  const clan = CLANS.find(c => c.id === clanId);
  if (!clan) return null;

  const img = clanImages[clanId];
  if (!img) return null;

  return (
    <img
      className="clan-shield"
      src={img}
      alt={clan.name}
      width={size}
      height={size}
      style={{
        objectFit: 'contain',
      }}
    />
  );
};

export const WarSeal = ({ size = 48 }: WarSealProps) => (
  <svg
    className="war-seal"
    width={size}
    height={size}
    viewBox="0 0 48 48"
    role="img"
    aria-label="Guerra"
  >
    <g fill="currentColor">
      <path d="M10 5c2.1 9.2 7 13.7 14 13.7S35.9 14.2 38 5c-3.7 5.2-8.4 7.8-14 7.8S13.7 10.2 10 5Z" />
      <path d="m24 11 3.2 5.5-3.2 4-3.2-4Z" />
      <path d="M13.5 27.2c.8-8.3 4.5-12.5 10.5-12.5s9.7 4.2 10.5 12.5Z" />
      <path d="M10.5 25.8h27L34 30.5H14Z" />
      <path d="m15 29-8.5 3.6 2.8 3.3 7.6-2.5 1-4.9Z" />
      <path d="m16.8 33-8.2 3.5 3.3 3.2 6.8-2.7.9-4.8Z" />
      <path d="m18.5 36.7-6.4 3.5 5.2 3.3 4.2-4.1.4-3.9Z" />
      <path d="m33 29 8.5 3.6-2.8 3.3-7.6-2.5-1-4.9Z" />
      <path d="m31.2 33 8.2 3.5-3.3 3.2-6.8-2.7-.9-4.8Z" />
      <path d="m29.5 36.7 6.4 3.5-5.2 3.3-4.2-4.1-.4-3.9Z" />
    </g>
  </svg>
);
