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
