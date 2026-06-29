import { useState } from 'react';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { CardType, Player, SeasonCard } from '../types/game';
import { CLANS } from '../types/game';
import { getMonsterImage } from '../utils/figureImages';

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

  return (
    <div className="season-cards-modal-backdrop" onClick={onClose}>
      <div className="season-cards-modal" onClick={(e) => e.stopPropagation()}>
        <button className="season-cards-modal-close" onClick={onClose}>
          &times;
        </button>
        <h2 className="season-cards-modal-title">
          {t('playerCards.title', { name: player.name, clan: clan?.name || '' })}
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
                  <span className="season-card-name">{card.name}</span>
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
                <p className="season-card-effect">{card.effect}</p>
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
                  <span className="card-zoom-fallback-name">{zoomedCard.name}</span>
                  <span className="card-zoom-fallback-effect">{zoomedCard.effect}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
