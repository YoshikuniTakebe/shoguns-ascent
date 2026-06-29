import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { CardType, SeasonCard } from '../types/game';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon } from './Icons';

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
  const { gameState, doBuySeasonCard, doSkipTrainPurchase, doRyujinBuyCard, doRyujinSkip } = useGameStore();
  const t = useT();
  const [confirmCard, setConfirmCard] = useState<SeasonCard | null>(null);
  const [playerConfirmed, setPlayerConfirmed] = useState(false);
  const lastTrainIndexRef = useRef<number>(-1);

  // Reset playerConfirmed when the train resolution index changes (new player's turn)
  const trainResIdx = gameState?.trainResolutionIndex ?? -1;
  useEffect(() => {
    if (trainResIdx !== lastTrainIndexRef.current) {
      lastTrainIndexRef.current = trainResIdx;
      setPlayerConfirmed(false);
      setConfirmCard(null);
    }
  }, [trainResIdx]);

  if (!open || !gameState) return null;

  // Determine if we are in Train mode (interactive)
  const isTrainMode = gameState.trainMandateActive && gameState.currentPhase === 'politics';
  const isRyujinMode = gameState.ryujinBuyActive && gameState.kamiResolutionActive;
  const isInteractiveMode = isTrainMode || isRyujinMode;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const currentClan = currentPlayer ? CLANS.find(c => c.id === currentPlayer.clanId) : null;

  // In Ryujin mode, the "current player" is the kami winner
  const ryujinPlayer = isRyujinMode
    ? (() => {
        const temple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
        return temple?.winnerId ? gameState.players.find(p => p.id === temple.winnerId) : null;
      })()
    : null;

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

  // Check if current player gets the -1 discount (issuer or ally) - NOT in Ryujin mode
  const isDiscounted = isTrainMode && !isRyujinMode && gameState.trainMandateIssuerId
    ? (() => {
        if (!currentPlayer) return false;
        if (currentPlayer.id === gameState.trainMandateIssuerId) return true;
        const issuer = gameState.players.find(p => p.id === gameState.trainMandateIssuerId);
        return issuer?.allies.includes(currentPlayer.id) ?? false;
      })()
    : false;

  const getEffectiveCost = (card: SeasonCard): number => {
    const buyer = isRyujinMode ? ryujinPlayer : currentPlayer;
    let baseCost = card.cost;
    if (buyer?.clanId === 'bonsai' && baseCost >= 2) {
      baseCost = 1;
    }
    return Math.max(0, baseCost - (isDiscounted ? 1 : 0));
  };

  const canAfford = (card: SeasonCard): boolean => {
    const buyer = isRyujinMode ? ryujinPlayer : currentPlayer;
    if (!buyer) return false;
    return buyer.coins >= getEffectiveCost(card);
  };

  const canBuyCard = (card: SeasonCard): boolean => {
    const buyer = isRyujinMode ? ryujinPlayer : currentPlayer;
    if (!buyer) return false;
    if (!canAfford(card)) return false;
    // Monster purchase restrictions
    if (card.cardType === 'monster') {
      const cardGroups = card.group.split('/').map(g => g.trim());
      const isDynastyInvasion = cardGroups.includes('Dynasty Invasion');
      const isSolOrLuna = buyer.clanId === 'sol' || buyer.clanId === 'luna';
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
      if (isRyujinMode) {
        doRyujinBuyCard(confirmCard.id);
      } else {
        doBuySeasonCard(confirmCard.id);
      }
      setConfirmCard(null);
      setPlayerConfirmed(false);
    }
  };

  const handleCancelBuy = () => {
    setConfirmCard(null);
  };

  const handleSkipPurchase = () => {
    if (isRyujinMode) {
      doRyujinSkip();
    } else {
      doSkipTrainPurchase();
    }
    setPlayerConfirmed(false);
  };

  const handlePlayerAccept = () => {
    setPlayerConfirmed(true);
  };

  // Show player turn indicator if in train mode and player hasn't confirmed yet (NOT for Ryujin)
  const showPlayerIndicator = isTrainMode && !isRyujinMode && !playerConfirmed;

  return (
    <div className="season-cards-modal-backdrop" onClick={isRyujinMode ? undefined : onClose}>
      <div className="season-cards-modal" onClick={(e) => e.stopPropagation()}>
        {!isRyujinMode && (
          <button className="season-cards-modal-close" onClick={onClose}>
            &times;
          </button>
        )}
        <h2 className="season-cards-modal-title">
          {t('seasonCardsModal.titleSeason', { season: t(`season.${gameState.currentSeason}` as TranslationKey) })}
          {isInteractiveMode && (isRyujinMode ? ryujinPlayer : currentPlayer) && (() => {
            const player = isRyujinMode ? ryujinPlayer! : currentPlayer!;
            const playerClan = CLANS.find(c => c.id === player.clanId);
            return (
              <span style={{ fontSize: '1em', marginLeft: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ClanShield clanId={player.clanId} size={32} />
                <span style={{ color: playerClan?.color || '#ccc', fontWeight: 'bold' }}>{player.name}</span>
                <CoinIcon size={24} />
                <span>{player.coins}</span>
                {isDiscounted && <span style={{ color: '#27ae60', marginLeft: '6px' }}>{t('seasonCardsModal.discount')}</span>}
              </span>
            );
          })()}
        </h2>
        <div className="season-card-grid">
          {currentSeasonCards.map((card) => {
            const affordable = isInteractiveMode ? canBuyCard(card) : true;
            const interactable = isInteractiveMode && (isRyujinMode || playerConfirmed) && affordable;
            const effectiveCost = getEffectiveCost(card);
            return (
              <div
                key={card.id}
                className={`season-card${isInteractiveMode && !affordable ? ' season-card-disabled' : ''}`}
                style={{
                  borderLeftColor: CARD_TYPE_COLORS[card.cardType],
                  opacity: isInteractiveMode && !affordable ? 0.4 : 1,
                  pointerEvents: isInteractiveMode && ((!isRyujinMode && !playerConfirmed) || !affordable) ? 'none' : 'auto',
                }}
              >
                <div className="season-card-image-placeholder">
                  <span className="season-card-image-icon">&#x1F3B4;</span>
                </div>
                <div className="season-card-header">
                  <span className="season-card-name">{card.name}</span>
                  <span className="season-card-cost">
                    <span className="season-card-coin">&#x26C1;</span>
                    {isInteractiveMode && effectiveCost < card.cost ? (
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
                {isInteractiveMode && interactable && (
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

        {/* Skip purchase button - visible in train mode when player has confirmed, or in ryujin mode */}
        {((isTrainMode && playerConfirmed) || isRyujinMode) && (
          <div style={{ textAlign: 'center', marginTop: '16px', paddingBottom: '12px' }}>
            <button
              className="btn-secondary"
              style={{ padding: '10px 24px', fontSize: '1em' }}
              onClick={handleSkipPurchase}
            >
              {t('seasonCardsModal.skipPurchase')}
            </button>
          </div>
        )}

        {/* Player turn indicator overlay - FIXED position so it stays centered on viewport */}
        {showPlayerIndicator && currentPlayer && (
          <div
            className="season-cards-player-indicator"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: '#1a1a2e',
                border: `2px solid ${currentClan?.color || '#888'}`,
                borderRadius: '12px',
                padding: '32px 48px',
                textAlign: 'center',
                maxWidth: '400px',
              }}
            >
              <ClanShield clanId={currentPlayer.clanId} size={48} />
              <h2 style={{ margin: '0 0 8px', color: '#f5f5f5', fontSize: '1.4em' }}>
                {t('seasonCardsModal.chooseCard')}
              </h2>
              <p style={{ margin: '0 0 20px', color: currentClan?.color || '#ccc', fontSize: '1.2em', fontWeight: 'bold' }}>
                {currentPlayer.name}
              </p>
              <p style={{ margin: '0 0 20px', color: '#aaa', fontSize: '0.9em' }}>
                {t('seasonCardsModal.playerCoins', { coins: String(currentPlayer.coins) })}
                {isDiscounted && (
                  <span style={{ color: '#27ae60', marginLeft: '8px' }}>
                    {t('seasonCardsModal.discount')}
                  </span>
                )}
              </p>
              <button
                className="btn-primary"
                style={{ padding: '12px 32px', fontSize: '1.1em' }}
                onClick={handlePlayerAccept}
              >
                {t('seasonCardsModal.accept')}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation popup - FIXED position so it stays centered on viewport */}
        {confirmCard && (
          <div
            className="season-cards-confirm-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
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
