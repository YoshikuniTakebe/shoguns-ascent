import { useState } from 'react';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { CardType, Player, SeasonCard } from '../types/game';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import { SunIcon, MoonIcon } from './Icons';
import { getMonsterImage } from '../utils/figureImages';
import { getCardEffectKey, getCardNameKey } from '../utils/cardTranslations';

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
  const clan = CLANS.find(c => c.id === player.clanId);
  const [zoomedCard, setZoomedCard] = useState<SeasonCard | null>(null);
  const [lightMode, setLightMode] = useState(false);

  return (
    <div className="season-cards-modal-backdrop" onClick={onClose}>
      <div className={`season-cards-modal${lightMode ? ' light-theme' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button className="season-cards-modal-close" onClick={onClose}>
          &times;
        </button>
        <div className="season-cards-theme-toggle" onClick={() => setLightMode(!lightMode)}>
          <div className={`theme-toggle-track${lightMode ? ' light' : ''}`}>
            <div className="theme-toggle-thumb">
              {lightMode ? <SunIcon size={16} color="#f5a623" /> : <MoonIcon size={16} color="#c8d6e5" />}
            </div>
          </div>
        </div>
        <h2 className="season-cards-modal-title">
          <ClanShield clanId={player.clanId} size={35} />
          <span style={{ color: clan?.color || '#ccc', fontWeight: 'bold' }}>{t('playerCards.title', { name: player.name })}</span>
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
                    <span className="season-card-coin">&#x26C1;</span>
                    {card.cost}
                  </span>
                </div>
                <span
                  className="season-card-type-badge"
                  style={{ backgroundColor: CARD_TYPE_COLORS[card.cardType] }}
                >
                  {t(CARD_TYPE_KEYS[card.cardType])}
                </span>
                <p className="season-card-effect">{t(getCardEffectKey(card.id))}</p>
                {card.force !== undefined && (
                  <div className="season-card-force">
                    <span className="season-card-force-icon">&#x2694;</span>
                    {t('seasonCardsModal.force', { value: String(card.force) })}
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
                  <span className="card-zoom-fallback-effect">{t(getCardEffectKey(zoomedCard.id))}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
