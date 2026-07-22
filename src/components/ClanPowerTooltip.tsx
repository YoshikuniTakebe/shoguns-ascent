import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import { CLANS } from '../types/game';
import type { Player } from '../types/game';
import { ClanShield } from './ClanShields';
import { BushiIcon, CoinIcon, DaimyoIcon, FistIcon, FortressIcon, HonorIcon, MonsterIcon, RoninIcon, ShintoIcon, VPIcon } from './Icons';

export const ClanPowerContent = ({ clanId, color }: { clanId: string; color: string }) => {
  const t = useT();

  switch (clanId) {
    case 'koi':
      return <>{t('clanPower.koi.coinAs')} <CoinIcon size={16} color={color} /> {t('clanPower.koi.as')} <RoninIcon size={16} color={color} />. {t('clanPower.koi.warStart')} <FistIcon size={16} color={color} />.</>;
    case 'sol':
      return (
        <span className="clan-power-tooltip-lines">
          <span className="clan-power-tooltip-line">{t('clanPower.sol.tie')} <HonorIcon size={16} color={color} /></span>
          <span className="clan-power-tooltip-line">{t('clanPower.sol.gains')} <CoinIcon size={16} color={color} /> 1 {t('clanPower.and')} <VPIcon size={16} color={color} /> 1</span>
          <span className="clan-power-tooltip-line">{t('clanPower.sol.loser')} <CoinIcon size={16} color={color} /> 1 {t('clanPower.and')} <VPIcon size={16} color={color} /> 1.</span>
        </span>
      );
    case 'loto':
      return (
        <span className="clan-power-tooltip-lines">
          <span className="clan-power-tooltip-line">
            {t('clanPower.loto.choose')} <strong style={{ color }}>{t('clanPower.loto.mandate')}</strong> {t('clanPower.loto.faceDown')}
          </span>
          <span className="clan-power-tooltip-line">{t('clanPower.loto.hidden')}</span>
        </span>
      );
    case 'tortuga':
      return <>{t('clanPower.tortuga.before')} <FortressIcon size={17} color={color} /> {t('clanPower.tortuga.after')} <FistIcon size={16} color={color} /> 1.</>;
    case 'libelula':
      return <>{t('clanPower.libelula.before')} <BushiIcon size={16} color={color} /> <ShintoIcon size={17} color={color} /> <DaimyoIcon size={16} color={color} /> <MonsterIcon size={17} color={color} /> {t('clanPower.libelula.after')}</>;
    case 'zorro':
      return <>{t('clanPower.zorro.before')} <BushiIcon size={17} color={color} /> {t('clanPower.zorro.after')}</>;
    case 'bonsai':
      return <>{t('clanPower.bonsai.before')} <CoinIcon size={17} color={color} /> 1.</>;
    case 'luna':
      return (
        <span className="clan-power-tooltip-lines">
          <span className="clan-power-tooltip-line">{t('clanPower.luna.force')} <FistIcon size={17} color={color} /> 2</span>
          <span className="clan-power-tooltip-line">{t('clanPower.luna.limit')}</span>
        </span>
      );
    default:
      return null;
  }
};

export const ClanPowerTooltip = ({ player, children, className = '' }: { player: Player; children: ReactNode; className?: string }) => {
  const clan = CLANS.find(candidate => candidate.id === player.clanId)!;
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const t = useT();

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
        <span className={`clan-power-tooltip-portal clan-power-tooltip-portal-${clan.id}`} style={{ top: position.top, left: position.left, borderColor: clan.color }}>
          <span className="clan-power-tooltip-title">
            <ClanShield clanId={player.clanId} size={28} />
            <strong style={{ color: clan.color }}>Clan {clan.name}</strong>
          </span>
          <span className="clan-power-tooltip-label">{t('clanPower.label')}</span>
          <span className="clan-power-tooltip-text">
            <ClanPowerContent clanId={clan.id} color={clan.color} />
          </span>
        </span>,
        document.body,
      )}
    </div>
  );
};
