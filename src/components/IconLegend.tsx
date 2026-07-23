import { useT } from '../i18n';
import {
  AutumnIcon,
  BushiIcon,
  CoinIcon,
  DaimyoIcon,
  FistIcon,
  FortressIcon,
  HonorIcon,
  MonsterIcon,
  RoninIcon,
  ShintoIcon,
  SpringIcon,
  SummerIcon,
  VPIcon,
  WinterIcon,
} from './Icons';

export const IconLegend = () => {
  const t = useT();

  return (
    <div className="legend-button-wrapper">
      <button className="legend-btn" aria-label={t('legend.title')}>?</button>
      <div className="legend-tooltip">
        <div className="legend-tooltip-row"><BushiIcon size={20} color="#fff" /><span>{t('legend.bushi')}</span></div>
        <div className="legend-tooltip-row"><ShintoIcon size={20} color="#fff" /><span>{t('legend.shinto')}</span></div>
        <div className="legend-tooltip-row"><FortressIcon size={20} color="#fff" /><span>{t('legend.fortress')}</span></div>
        <div className="legend-tooltip-row"><DaimyoIcon size={20} color="#fff" /><span>{t('legend.daimyo')}</span></div>
        <div className="legend-tooltip-row"><MonsterIcon size={20} color="#fff" /><span>{t('legend.monster')}</span></div>
        <div className="legend-tooltip-row"><span className="legend-kami-icon">神</span><span>{t('legend.kami')}</span></div>
        <div className="legend-tooltip-row"><CoinIcon size={20} color="#c8a951" /><span style={{ color: '#c8a951' }}>{t('legend.coin')}</span></div>
        <div className="legend-tooltip-row"><VPIcon size={20} color="#e94560" /><span style={{ color: '#e94560' }}>{t('legend.vp')}</span></div>
        <div className="legend-tooltip-row"><HonorIcon size={20} color="#9b59b6" /><span style={{ color: '#9b59b6' }}>{t('legend.honor')}</span></div>
        <div className="legend-tooltip-row"><RoninIcon size={20} color="#fff" /><span>{t('legend.ronin')}</span></div>
        <div className="legend-tooltip-row"><FistIcon size={20} color="#3498db" /><span style={{ color: '#3498db' }}>{t('legend.force')}</span></div>
        <div className="legend-tooltip-row"><SpringIcon size={20} color="#FFB7C5" /><span style={{ color: '#FFB7C5' }}>{t('legend.spring')}</span></div>
        <div className="legend-tooltip-row"><SummerIcon size={20} color="#FF6B35" /><span style={{ color: '#FF6B35' }}>{t('legend.summer')}</span></div>
        <div className="legend-tooltip-row"><AutumnIcon size={20} color="#D4A574" /><span style={{ color: '#D4A574' }}>{t('legend.autumn')}</span></div>
        <div className="legend-tooltip-row"><WinterIcon size={20} color="#A8C8E8" /><span style={{ color: '#A8C8E8' }}>{t('legend.winter')}</span></div>
      </div>
    </div>
  );
};
