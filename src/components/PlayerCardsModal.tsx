import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { CardType, Player, SeasonCard } from '../types/game';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import { SunIcon, MoonIcon, CoinIcon, FistIcon, BushiIcon, ShintoIcon, FortressIcon, DaimyoIcon, MonsterIcon, VPIcon, HonorIcon, RoninIcon, SpringIcon, SummerIcon, AutumnIcon, WinterIcon } from './Icons';
import { getMonsterImage } from '../utils/figureImages';
import { getCardEffectKey, getCardNameKey } from '../utils/cardTranslations';
import { renderCardEffect } from '../utils/renderCardEffect';

const CARD_TYPE_COLORS: Record<CardType, string> = {
  monster: '#cd7f32',
  virtue: '#9b59b6',
  upgrade: '#27ae60',
  warUpgrade: '#e74c3c',
  winterUpgrade: '#5bc0eb',
};

const CARD_TYPE_KEYS: Record<CardType, TranslationKey> = {
  monster: 'market.monster',
  virtue: 'market.virtue',
  upgrade: 'market.upgrade',
  warUpgrade: 'market.warUpgrade',
  winterUpgrade: 'market.winterUpgrade',
};

interface PlayerCardsModalProps {
  player: Player;
  onClose: () => void;
}

export const PlayerCardsModal = ({ player, onClose }: PlayerCardsModalProps) => {
  const t = useT();
  const { cardsLightMode, setCardsLightMode } = useGameStore();
  const clan = CLANS.find(c => c.id === player.clanId);
  const [zoomedCard, setZoomedCard] = useState<SeasonCard | null>(null);

  return (
    <div className="season-cards-modal-backdrop" onClick={onClose}>
      <div className={`season-cards-modal${cardsLightMode ? ' light-theme' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button className="season-cards-modal-close" onClick={onClose}>
          &times;
        </button>
        {/* Legend button */}
        <div className="legend-button-wrapper" style={{ position: 'absolute', top: '0.6rem', left: '4.9rem', zIndex: 1 }}>
          <button className="legend-btn">?</button>
          <div className="legend-tooltip">
            <div className="legend-tooltip-row"><BushiIcon size={20} color="#fff" /><span>{t('legend.bushi')}</span></div>
            <div className="legend-tooltip-row"><ShintoIcon size={20} color="#fff" /><span>{t('legend.shinto')}</span></div>
            <div className="legend-tooltip-row"><FortressIcon size={20} color="#fff" /><span>{t('legend.fortress')}</span></div>
            <div className="legend-tooltip-row"><DaimyoIcon size={20} color="#fff" /><span>{t('legend.daimyo')}</span></div>
            <div className="legend-tooltip-row"><MonsterIcon size={20} color="#fff" /><span>{t('legend.monster')}</span></div>
            <div className="legend-tooltip-row"><CoinIcon size={20} color="#c8a951" /><span>{t('legend.coin')}</span></div>
            <div className="legend-tooltip-row"><VPIcon size={20} color="#e94560" /><span>{t('legend.vp')}</span></div>
            <div className="legend-tooltip-row"><HonorIcon size={20} color="#9b59b6" /><span>{t('legend.honor')}</span></div>
            <div className="legend-tooltip-row"><RoninIcon size={20} color="#fff" /><span>{t('legend.ronin')}</span></div>
            <div className="legend-tooltip-row"><FistIcon size={20} color="#3498db" /><span>{t('legend.force')}</span></div>
            <div className="legend-tooltip-row"><SpringIcon size={20} color="#FFB7C5" /><span style={{ color: '#FFB7C5' }}>{t('legend.spring')}</span></div>
            <div className="legend-tooltip-row"><SummerIcon size={20} color="#FF6B35" /><span style={{ color: '#FF6B35' }}>{t('legend.summer')}</span></div>
            <div className="legend-tooltip-row"><AutumnIcon size={20} color="#D4A574" /><span style={{ color: '#D4A574' }}>{t('legend.autumn')}</span></div>
            <div className="legend-tooltip-row"><WinterIcon size={20} color="#A8C8E8" /><span style={{ color: '#A8C8E8' }}>{t('legend.winter')}</span></div>
          </div>
        </div>
        <div className="season-cards-theme-toggle" onClick={() => setCardsLightMode(!cardsLightMode)}>
          <div className={`theme-toggle-track${cardsLightMode ? ' light' : ''}`} style={{ position: 'relative', left: '-0.5rem' }}>
            <div className="theme-toggle-thumb">
              {cardsLightMode ? <SunIcon size={16} color="#f5a623" /> : <MoonIcon size={16} color="#c8d6e5" />}
            </div>
          </div>
        </div>
        <h2 className="season-cards-modal-title">
          <ClanShield clanId={player.clanId} size={35} />
          <span style={{ color: clan?.color || '#ccc', fontWeight: 'bold', textShadow: '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff' }}>{t('playerCards.title', { name: player.name })}</span>
        </h2>
        {player.seasonCards.length === 0 ? (
          <p className="player-cards-empty">{t('playerCards.empty')}</p>
        ) : (
          <div className="season-card-grid">
            {player.seasonCards.map((card) => (
              <div
                key={card.id}
                className="season-card"
                style={{ borderLeftColor: CARD_TYPE_COLORS[card.cardType], cursor: 'pointer' }}
                onClick={() => setZoomedCard(card)}
              >
                {card.cardType === 'monster' && getMonsterImage(card.id) ? (
                  <div className="season-card-image-placeholder">
                    <img
                      src={getMonsterImage(card.id)!}
                      alt={card.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }}
                    />
                  </div>
                ) : (
                  <div className="season-card-image-placeholder">
                    <span className="season-card-image-icon">&#x1F3B4;</span>
                  </div>
                )}
                <div className="season-card-header">
                  <span className="season-card-name">{t(getCardNameKey(card.id))}</span>
                  <span className="season-card-cost">
                    <span className="season-card-coin"><CoinIcon size={16} color="#c8a951" strokeWidth="2.5" /></span>
                    {card.cost}
                  </span>
                </div>
                <span
                  className="season-card-type-badge"
                  style={{ backgroundColor: CARD_TYPE_COLORS[card.cardType] }}
                >
                  {t(CARD_TYPE_KEYS[card.cardType])}
                </span>
                <p className="season-card-effect">{renderCardEffect(t(getCardEffectKey(card.id)))}</p>
                {card.force !== undefined && (
                  <div className="season-card-force">
                    <span className="season-card-force-icon"><FistIcon size={18} color="#3498db" /></span>
                    {card.id === 'sp-oni-of-skulls' ? '1/3' : card.id === 'su-oni-of-blood' ? '2/4' : card.force}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Card zoom overlay */}
        {zoomedCard && (
          <div className="card-zoom-overlay" onClick={() => setZoomedCard(null)}>
            <div className="card-zoom-content">
              {zoomedCard.cardType === 'monster' && getMonsterImage(zoomedCard.id) ? (
                <img src={getMonsterImage(zoomedCard.id)!} alt={zoomedCard.name} />
              ) : (
                <div className="card-zoom-fallback">
                  <span className="card-zoom-fallback-icon">&#x1F3B4;</span>
                  <span className="card-zoom-fallback-name">{t(getCardNameKey(zoomedCard.id))}</span>
                  <span className="card-zoom-fallback-effect">{renderCardEffect(t(getCardEffectKey(zoomedCard.id)))}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
