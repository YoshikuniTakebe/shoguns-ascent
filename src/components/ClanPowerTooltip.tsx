import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CLANS } from '../types/game';
import type { Player } from '../types/game';
import { ClanShield } from './ClanShields';
import { BushiIcon, CoinIcon, DaimyoIcon, FistIcon, FortressIcon, HonorIcon, MonsterIcon, RoninIcon, ShintoIcon, VPIcon } from './Icons';

const ClanPowerContent = ({ clanId, color }: { clanId: string; color: string }) => {
  switch (clanId) {
    case 'koi':
      return <>Puede usar <CoinIcon size={16} color={color} /> como <RoninIcon size={16} color={color} />. Al comenzar la Guerra cambia su Ronin por Monedas y, al Contratar Ronin, sus Monedas suman <FistIcon size={16} color={color} />.</>;
    case 'sol':
      return (
        <span className="clan-power-tooltip-lines">
          <span className="clan-power-tooltip-line">Cuando gana un empate por <HonorIcon size={16} color={color} /></span>
          <span className="clan-power-tooltip-line">gana <CoinIcon size={16} color={color} /> 1 y <VPIcon size={16} color={color} /> 1</span>
          <span className="clan-power-tooltip-line">y el perdedor pierde <CoinIcon size={16} color={color} /> 1 y <VPIcon size={16} color={color} /> 1.</span>
        </span>
      );
    case 'loto':
      return <>Puede elegir cualquier <strong>Mandato político</strong>, sin importar las fichas que haya robado.</>;
    case 'tortuga':
      return <>Sus <FortressIcon size={17} color={color} /> se mueven como figuras y cuentan como <FistIcon size={16} color={color} /> 1.</>;
    case 'libelula':
      return <>Puede invocar y mover sus <BushiIcon size={16} color={color} /> <ShintoIcon size={17} color={color} /> <DaimyoIcon size={16} color={color} /> <MonsterIcon size={17} color={color} /> a cualquier Provincia.</>;
    case 'zorro':
      return <>Al inicio de la Guerra coloca <BushiIcon size={17} color={color} /> 1 gratis en cada Provincia donde no tenga figuras.</>;
    case 'bonsai':
      return <>El coste máximo de cualquier compra es <CoinIcon size={17} color={color} /> 1.</>;
    case 'luna':
      return <>Todas sus figuras tienen <FistIcon size={17} color={color} /> 2. Máximo 2 figuras por Provincia y 2 en cada Santuario.</>;
    default:
      return null;
  }
};

export const ClanPowerTooltip = ({ player, children, className = '' }: { player: Player; children: ReactNode; className?: string }) => {
  const clan = CLANS.find(candidate => candidate.id === player.clanId)!;
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const showTooltip = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ top: rect.top + rect.height / 2, left: rect.right + 10 });
    setVisible(true);
  };

  return (
    <div
      className={`clan-power-trigger ${className}`.trim()}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && createPortal(
        <span className="clan-power-tooltip-portal" style={{ top: position.top, left: position.left, borderColor: clan.color }}>
          <span className="clan-power-tooltip-title">
            <ClanShield clanId={player.clanId} size={28} />
            <strong style={{ color: clan.color }}>Clan {clan.name}</strong>
          </span>
          <span className="clan-power-tooltip-label">Poder del clan</span>
          <span className="clan-power-tooltip-text">
            <ClanPowerContent clanId={clan.id} color={clan.color} />
          </span>
        </span>,
        document.body,
      )}
    </div>
  );
};
