import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { CardType, SeasonCard } from '../types/game';

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
  const { gameState, doBuySeasonCard } = useGameStore();
  const t = useT();
  const [confirmCard, setConfirmCard] = useState<SeasonCard | null>(null);

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

  // Determine if we are in Train mode (interactive)
  const isTrainMode = gameState.trainMandateActive && gameState.currentPhase === 'politics';
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  // Check if current player gets the -1 discount (issuer or ally)
  const isDiscounted = isTrainMode && gameState.trainMandateIssuerId
    ? (() => {
        if (!currentPlayer) return false;
        if (currentPlayer.id === gameState.trainMandateIssuerId) return true;
        const issuer = gameState.players.find(p => p.id === gameState.trainMandateIssuerId);
        return issuer?.allies.includes(currentPlayer.id) ?? false;
      })()
    : false;

  const getEffectiveCost = (card: SeasonCard): number => {
    return Math.max(0, card.cost - (isDiscounted ? 1 : 0));
  };

  const canAfford = (card: SeasonCard): boolean => {
    if (!currentPlayer) return false;
    return currentPlayer.coins >= getEffectiveCost(card);
  };

  const canBuyCard = (card: SeasonCard): boolean => {
    if (!currentPlayer) return false;
    if (!canAfford(card)) return false;
    // Monster purchase restrictions
    if (card.cardType === 'monster') {
      const cardGroups = card.group.split('/').map(g => g.trim());
      const isDynastyInvasion = cardGroups.includes('Dynasty Invasion');
      const isSolOrLuna = currentPlayer.clanId === 'sol' || currentPlayer.clanId === 'luna';
      if (isSolOrLuna && !isDynastyInvasion) return false;
      if (!isSolOrLuna && isDynastyInvasion) return false;
    }
    return true;
  };

  const handleBuyClick = (card: SeasonCard) => {
    setConfirmCard(card);
  };

  const handleConfirmBuy = () => {
    if (confirmCard) {
      doBuySeasonCard(confirmCard.id);
      setConfirmCard(null);
    }
  };

  const handleCancelBuy = () => {
    setConfirmCard(null);
  };

  return (
    <div className="season-cards-modal-backdrop" onClick={onClose}>
      <div className="season-cards-modal" onClick={(e) => e.stopPropagation()}>
        <button className="season-cards-modal-close" onClick={onClose}>
          &times;
        </button>
        <h2 className="season-cards-modal-title">
          {t('seasonCardsModal.title')}
          {isTrainMode && currentPlayer && (
            <span style={{ fontSize: '0.7em', marginLeft: '12px', opacity: 0.8 }}>
              {currentPlayer.name} - {currentPlayer.coins} &#x26C1;
              {isDiscounted && <span style={{ color: '#27ae60', marginLeft: '6px' }}>{t('seasonCardsModal.discount')}</span>}
            </span>
          )}
        </h2>
        <div className="season-card-grid">
          {currentSeasonCards.map((card) => {
            const affordable = isTrainMode ? canBuyCard(card) : true;
            const effectiveCost = getEffectiveCost(card);
            return (
              <div
                key={card.id}
                className={`season-card${isTrainMode && !affordable ? ' season-card-disabled' : ''}`}
                style={{
                  borderLeftColor: CARD_TYPE_COLORS[card.cardType],
                  opacity: isTrainMode && !affordable ? 0.4 : 1,
                  pointerEvents: isTrainMode && !affordable ? 'none' : 'auto',
                }}
              >
                <div className="season-card-image-placeholder">
                  <span className="season-card-image-icon">&#x1F3B4;</span>
                </div>
                <div className="season-card-header">
                  <span className="season-card-name">{card.name}</span>
                  <span className="season-card-cost">
                    <span className="season-card-coin">&#x26C1;</span>
                    {isTrainMode && isDiscounted && card.cost > 0 ? (
                      <>
                        <span style={{ textDecoration: 'line-through', opacity: 0.5, marginRight: '4px' }}>{card.cost}</span>
                        <span style={{ color: '#27ae60', fontWeight: 'bold' }}>{effectiveCost}</span>
                      </>
                    ) : (
                      card.cost
                    )}
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
                {isTrainMode && affordable && (
                  <button
                    className="btn-primary season-card-buy-btn"
                    style={{ marginTop: '6px', width: '100%', padding: '4px 8px', fontSize: '0.85em' }}
                    onClick={() => handleBuyClick(card)}
                  >
                    {t('seasonCardsModal.buyButton')} ({effectiveCost} &#x26C1;)
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirmation popup */}
        {confirmCard && (
          <div
            className="season-cards-confirm-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              borderRadius: 'inherit',
            }}
            onClick={handleCancelBuy}
          >
            <div
              style={{
                background: '#2a2a2a',
                border: '1px solid #555',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '320px',
                textAlign: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 12px', color: '#f5f5f5' }}>{t('seasonCardsModal.confirmTitle')}</h3>
              <p style={{ margin: '0 0 16px', color: '#ccc' }}>
                {t('seasonCardsModal.confirmMessage', {
                  name: confirmCard.name,
                  cost: String(getEffectiveCost(confirmCard)),
                })}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  className="btn-primary"
                  style={{ padding: '8px 20px' }}
                  onClick={handleConfirmBuy}
                >
                  {t('seasonCardsModal.confirm')}
                </button>
                <button
                  className="btn-secondary"
                  style={{ padding: '8px 20px' }}
                  onClick={handleCancelBuy}
                >
                  {t('seasonCardsModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
