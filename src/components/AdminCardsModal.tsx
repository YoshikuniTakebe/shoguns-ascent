import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { SEASON_CARDS_DATA, type CardType, type Season, type SeasonCard } from '../types/game';
import { useT, type TranslationKey } from '../i18n';
import { getCardEffectKey, getCardNameKey } from '../utils/cardTranslations';
import { getMonsterImage } from '../utils/figureImages';
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

const CARD_SETS = [
  'Core',
  'Archway',
  'Tower',
  'Teapot',
  'Horseman',
  'Ship',
  'Mountain',
  'Dynasty Invasion',
  'Monster Pack',
  'Kickstarter Exclusive',
] as const;

type CardSet = typeof CARD_SETS[number];
type CardSeason = Extract<Season, 'spring' | 'summer' | 'autumn'>;

const SEASONS: CardSeason[] = ['spring', 'summer', 'autumn'];

const SET_KEYS: Record<CardSet, TranslationKey> = {
  Core: 'deck.core',
  Archway: 'deck.archway',
  Tower: 'deck.tower',
  Teapot: 'deck.teapot',
  Horseman: 'deck.horseman',
  Ship: 'deck.ship',
  Mountain: 'deck.mountain',
  'Dynasty Invasion': 'deck.dynastyInvasion',
  'Monster Pack': 'deck.monsterPack',
  'Kickstarter Exclusive': 'deck.kickstarterExclusive',
};

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

const SEASON_KEYS: Record<CardSeason, TranslationKey> = {
  spring: 'season.spring',
  summer: 'season.summer',
  autumn: 'season.autumn',
};

const SEASON_COLORS: Record<CardSeason, string> = {
  spring: '#FFB7C5',
  summer: '#FF6B35',
  autumn: '#D4A574',
};

const SeasonIcon = ({ season }: { season: CardSeason }) => {
  switch (season) {
    case 'spring': return <SpringIcon size={16} color="#1a1a2e" />;
    case 'summer': return <SummerIcon size={16} color="#1a1a2e" />;
    case 'autumn': return <AutumnIcon size={16} color="#1a1a2e" />;
  }
};

const CardStackIcon = ({ size = 16 }: { size?: number }) => (
  <svg className="admin-card-set-stack-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="2" width="13" height="17" rx="1.5" fill="currentColor" opacity=".35" />
    <rect x="5.5" y="4.5" width="13" height="17" rx="1.5" fill="currentColor" opacity=".65" />
    <rect x="8" y="7" width="13" height="15" rx="1.5" fill="currentColor" />
  </svg>
);

const DeckSetIcon = ({ setName, size = 17 }: { setName: CardSet; size?: number }) => {
  const common = {
    className: 'admin-card-set-symbol',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  } as const;

  switch (setName) {
    case 'Core':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3.2" fill="currentColor" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2 19 19M19 5l-2.8 2.8M7.8 16.2 5 19" />
        </svg>
      );
    case 'Archway':
      return (
        <svg {...common} fill="currentColor">
          <path d="M2 4h20l-2 3H4L2 4Zm3 4h14v2H5V8Zm2 2h3v12H7V10Zm7 0h3v12h-3V10Z" />
        </svg>
      );
    case 'Tower':
      return (
        <svg {...common} fill="currentColor">
          <path d="m12 2 8 4-2 2H6L4 6l8-4Zm-5 7h10l2 3H5l2-3Zm1 4h8l2 3H6l2-3Zm1 4h6v5H9v-5Z" />
        </svg>
      );
    case 'Teapot':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M7 8h9v8a4 4 0 0 1-4 4h-1a4 4 0 0 1-4-4V8Zm2-3h5M8 5l-2 3h11l-3-3" />
          <path d="M16 10c4 0 5 2 5 4s-2 3-4 3M7 10 3 8v4l4 1" />
        </svg>
      );
    case 'Horseman':
      return (
        <svg {...common} fill="currentColor">
          <path d="m7 21 1-5 3-3-2-3 1-7 3 3 4-1 2 5-3 4 2 7H7Zm5-11 2 1 2-2-3 1h-1Z" />
        </svg>
      );
    case 'Ship':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 17h16l-3 4H7l-3-4Zm8-14v14M12 4l6 9h-6M11 6 6 14h5M3 22c2-1 3-1 5 0 2-1 3-1 5 0 2-1 3-1 5 0" />
        </svg>
      );
    case 'Mountain':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="m2 21 7-13 3 5 3-9 7 17H2Z" />
          <path d="m7 12 2-4 2.2 3.6M13.5 8l1.5-4 2.2 5.3" />
        </svg>
      );
    case 'Dynasty Invasion':
      return (
        <svg {...common} fill="currentColor">
          <path d="M5 2h2v20H5V2Zm12 0h2v20h-2V2ZM7 4h7l-2 4 2 4H7V4Zm3 8h7v8h-7l2-4-2-4Z" />
        </svg>
      );
    case 'Monster Pack':
      return (
        <svg {...common} fill="currentColor">
          <path d="M4 3c2 1 3 3 3 5 3-2 7-2 10 0 0-2 1-4 3-5 0 4-1 6-3 7l2 4-3 7H8l-3-7 2-4C5 9 4 7 4 3Zm5 9 2 2-3 1 1-3Zm6 0 1 3-3-1 2-2Zm-5 6h4l-2-2-2 2Z" />
        </svg>
      );
    case 'Kickstarter Exclusive':
      return (
        <svg {...common} fill="currentColor">
          <path d="m12 2 2.6 6.2L21 9l-4.8 4.3 1.4 6.4-5.6-3.3-5.6 3.3 1.4-6.4L3 9l6.4-.8L12 2Z" />
        </svg>
      );
  }
};

const belongsToSet = (card: SeasonCard, setName: CardSet) =>
  card.group.split('/').map((group) => group.trim()).includes(setName);

export const AdminCardsModal = ({ onClose }: { onClose: () => void }) => {
  const t = useT();
  const { authUser, cardsLightMode, setCardsLightMode } = useGameStore();
  const [selectedSet, setSelectedSet] = useState<CardSet>('Core');
  const [selectedSeason, setSelectedSeason] = useState<CardSeason>('spring');
  const [zoomedCard, setZoomedCard] = useState<SeasonCard | null>(null);

  const cards = useMemo(
    () => SEASON_CARDS_DATA.filter((card) =>
      card.season === selectedSeason && belongsToSet(card, selectedSet)
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
          {CARD_SETS.map((setName) => (
            <button
              key={setName}
              className={`admin-card-set-badge${selectedSet === setName ? ' active' : ''}`}
              onClick={() => setSelectedSet(setName)}
            >
              <CardStackIcon />
              <DeckSetIcon setName={setName} />
              <span>{t(SET_KEYS[setName])}</span>
            </button>
          ))}
        </div>

        <div className="admin-card-season-tabs" role="tablist">
          {SEASONS.map((season) => {
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
                {t(SEASON_KEYS[season])}
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
                {card.cardType === 'monster' && getMonsterImage(card.id) ? (
                  <div className="season-card-image-placeholder">
                    <img
                      src={getMonsterImage(card.id)!}
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
                    <CoinIcon size={16} color="#c8a951" strokeWidth="2.5" />
                    {card.cost}
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
              {zoomedCard.cardType === 'monster' && getMonsterImage(zoomedCard.id) ? (
                <img src={getMonsterImage(zoomedCard.id)!} alt={t(getCardNameKey(zoomedCard.id))} />
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
