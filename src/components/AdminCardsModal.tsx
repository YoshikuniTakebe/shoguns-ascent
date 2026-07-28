import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { SEASON_CARDS_DATA, type CardType, type SeasonCard } from '../types/game';
import { useT, type TranslationKey } from '../i18n';
import { getCardEffectKey, getCardNameKey } from '../utils/cardTranslations';
import { getSeasonCardImage } from '../utils/cardImages';
import { renderCardEffect } from '../utils/renderCardEffect';
import {
  AutumnIcon,
  CoinIcon,
  FistIcon,
  MoonIcon,
  SpringIcon,
  SummerIcon,
  SunIcon,
} from './Icons';
import { CardStackIcon, DeckSetIcon } from './DeckSetIcons';
import {
  CARD_CATALOG_SEASONS,
  CARD_CATALOG_SEASON_KEYS,
  CARD_CATALOG_SETS,
  CARD_CATALOG_SET_KEYS,
  cardBelongsToSet,
  type CardCatalogSeason,
  type CardCatalogSet,
} from '../utils/cardCatalog';

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

const SEASON_COLORS: Record<CardCatalogSeason, string> = {
  spring: '#FFB7C5',
  summer: '#FF6B35',
  autumn: '#D4A574',
};

const SeasonIcon = ({ season }: { season: CardCatalogSeason }) => {
  switch (season) {
    case 'spring': return <SpringIcon size={16} color="#1a1a2e" />;
    case 'summer': return <SummerIcon size={16} color="#1a1a2e" />;
    case 'autumn': return <AutumnIcon size={16} color="#1a1a2e" />;
  }
};

export const AdminCardsModal = ({ onClose }: { onClose: () => void }) => {
  const t = useT();
  const { authUser, cardsLightMode, setCardsLightMode } = useGameStore();
  const [selectedSet, setSelectedSet] = useState<CardCatalogSet>('Core');
  const [selectedSeason, setSelectedSeason] = useState<CardCatalogSeason>('spring');
  const [zoomedCard, setZoomedCard] = useState<SeasonCard | null>(null);

  const cards = useMemo(
    () => SEASON_CARDS_DATA.filter((card) =>
      card.season === selectedSeason && cardBelongsToSet(card, selectedSet)
    ),
    [selectedSeason, selectedSet],
  );

  if (!authUser?.isAdmin) return null;

  return (
    <div className="admin-cards-backdrop" onClick={onClose}>
      <section
        className={`season-cards-modal admin-cards-modal${cardsLightMode ? ' light-theme' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="season-cards-modal-close" onClick={onClose} aria-label={t('admin.cards.close')}>
          &times;
        </button>
        <div className="season-cards-theme-toggle" onClick={() => setCardsLightMode(!cardsLightMode)}>
          <div className={`theme-toggle-track${cardsLightMode ? ' light' : ''}`}>
            <div className="theme-toggle-thumb">
              {cardsLightMode ? <SunIcon size={16} color="#f5a623" /> : <MoonIcon size={16} color="#c8d6e5" />}
            </div>
          </div>
        </div>

        <h2 className="season-cards-modal-title">{t('admin.cards.title')}</h2>

        <div className="admin-card-set-badges">
          {CARD_CATALOG_SETS.map((setName) => (
            <button
              key={setName}
              className={`admin-card-set-badge${selectedSet === setName ? ' active' : ''}`}
              onClick={() => setSelectedSet(setName)}
            >
              <CardStackIcon />
              <DeckSetIcon setName={setName} />
              <span>{t(CARD_CATALOG_SET_KEYS[setName])}</span>
            </button>
          ))}
        </div>

        <div className="admin-card-season-tabs" role="tablist">
          {CARD_CATALOG_SEASONS.map((season) => {
            const active = selectedSeason === season;
            const color = SEASON_COLORS[season];
            return (
              <button
                key={season}
                className={`log-season-tab${active ? ' active' : ''}`}
                style={{
                  backgroundColor: active ? color : `${color}33`,
                  borderColor: color,
                  color: active ? '#1a1a2e' : undefined,
                }}
                onClick={() => setSelectedSeason(season)}
                role="tab"
                aria-selected={active}
              >
                <SeasonIcon season={season} />
                {t(CARD_CATALOG_SEASON_KEYS[season])}
              </button>
            );
          })}
        </div>

        {cards.length > 0 ? (
          <div className="season-card-grid admin-card-grid">
            {cards.map((card) => (
              <article
                key={card.id}
                className="season-card"
                style={{ borderLeftColor: CARD_TYPE_COLORS[card.cardType], cursor: 'pointer' }}
                onClick={() => setZoomedCard(card)}
              >
                {getSeasonCardImage(card.id, card.cardType) ? (
                  <div className="season-card-image-placeholder">
                    <img
                      src={getSeasonCardImage(card.id, card.cardType)!}
                      alt={t(getCardNameKey(card.id))}
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
                    {card.cost}
                    <CoinIcon size={16} color="#c8a951" strokeWidth="2.5" />
                  </span>
                </div>
                <span className="season-card-type-badge" style={{ backgroundColor: CARD_TYPE_COLORS[card.cardType] }}>
                  {t(CARD_TYPE_KEYS[card.cardType])}
                </span>
                <p className="season-card-effect">{renderCardEffect(t(getCardEffectKey(card.id)))}</p>
                {card.force !== undefined && (
                  <div className="season-card-force">
                    <FistIcon size={18} color="#3498db" />
                    {card.id === 'sp-oni-of-skulls' ? '1/3' : card.id === 'su-oni-of-blood' ? '2/4' : card.force}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-card-empty">{t('admin.cards.empty')}</p>
        )}

        {zoomedCard && (
          <div className="card-zoom-overlay" onClick={() => setZoomedCard(null)}>
            <div className="card-zoom-content">
              {getSeasonCardImage(zoomedCard.id, zoomedCard.cardType) ? (
                <img src={getSeasonCardImage(zoomedCard.id, zoomedCard.cardType)!} alt={t(getCardNameKey(zoomedCard.id))} />
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
      </section>
    </div>
  );
};
