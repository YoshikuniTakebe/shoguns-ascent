import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { CardType } from '../types/game';

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

const GROUP_NAME_KEYS: Record<string, TranslationKey> = {
  Archway: 'deck.archway',
  Tower: 'deck.tower',
  Teapot: 'deck.teapot',
  Horseman: 'deck.horseman',
  Ship: 'deck.ship',
  Mountain: 'deck.mountain',
  Core: 'deck.core',
  'Dynasty Invasion': 'deck.dynastyInvasion',
  'Monster Pack': 'deck.monsterPack',
  'Kickstarter Exclusive': 'deck.kickstarterExclusive',
};

interface SeasonCardsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SeasonCardsModal = ({ open, onClose }: SeasonCardsModalProps) => {
  const { gameState } = useGameStore();
  const t = useT();

  if (!open || !gameState) return null;

  const currentSeasonCards = gameState.seasonCardsDeck.filter(
    (card) => card.season === gameState.currentSeason
  );

  const translateGroup = (group: string): string => {
    if (group.includes('/')) {
      return group
        .split('/')
        .map((g) => {
          const key = GROUP_NAME_KEYS[g.trim()];
          return key ? t(key) : g.trim();
        })
        .join(' / ');
    }
    const key = GROUP_NAME_KEYS[group];
    return key ? t(key) : group;
  };

  return (
    <div className="season-cards-modal-backdrop" onClick={onClose}>
      <div className="season-cards-modal" onClick={(e) => e.stopPropagation()}>
        <button className="season-cards-modal-close" onClick={onClose}>
          &times;
        </button>
        <h2 className="season-cards-modal-title">{t('seasonCardsModal.title')}</h2>
        <div className="season-card-grid">
          {currentSeasonCards.map((card) => (
            <div
              key={card.id}
              className="season-card"
              style={{ borderLeftColor: CARD_TYPE_COLORS[card.cardType] }}
            >
              <div className="season-card-image-placeholder">
                <span className="season-card-image-icon">&#x1F3B4;</span>
              </div>
              <div className="season-card-header">
                <span className="season-card-name">{card.name}</span>
                <span className="season-card-cost">
                  <span className="season-card-coin">&#x26C1;</span>
                  {card.cost}
                </span>
              </div>
              <span
                className="season-card-type-badge"
                style={{
                  backgroundColor: CARD_TYPE_COLORS[card.cardType],
                }}
              >
                {t(CARD_TYPE_KEYS[card.cardType])}
              </span>
              <span className="season-card-group-badge">
                {translateGroup(card.group)}
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
      </div>
    </div>
  );
};
