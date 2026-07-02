import { useGameStore } from '../store/gameStore';
import { getCurrentPlayer } from '../utils/gameLogic';
import type { SeasonCard } from '../types/game';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import { getCardEffectKey, getCardNameKey } from '../utils/cardTranslations';

export const SeasonCardsMarket = () => {
  const { gameState, localPlayerId, doBuySeasonCard } = useGameStore();
  const t = useT();
  if (!gameState) return null;

  const availableCards = gameState.seasonCardsDeck.filter(
    card => card.season === gameState.currentSeason
  );

  if (availableCards.length === 0) return null;

  const cp = getCurrentPlayer(gameState);
  const activePlayerId = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
  const activePlayer = gameState.players.find(p => p.id === activePlayerId);

  const isSolOrLuna = activePlayer
    ? (activePlayer.clanId === 'sol' || activePlayer.clanId === 'luna')
    : false;

  const cardTypeLabelKeys: Record<string, TranslationKey> = {
    virtue: 'market.virtue',
    monster: 'market.monster',
    upgrade: 'market.upgrade',
    warUpgrade: 'market.warUpgrade',
    winterUpgrade: 'market.winterUpgrade',
  };

  const canBuy = gameState.currentPhase === 'politics' && gameState.trainMandateActive;

  const isDynastyInvasionMonster = (card: SeasonCard): boolean => {
    const groups = card.group.split('/').map(g => g.trim());
    return card.cardType === 'monster' && groups.includes('Dynasty Invasion');
  };

  const getPurchaseRestriction = (card: SeasonCard): string | null => {
    if (card.cardType !== 'monster') return null;

    const dynastyInvasion = isDynastyInvasionMonster(card);

    if (isSolOrLuna) {
      if (!dynastyInvasion) {
        return t('market.solLunaOnly');
      }
    } else {
      if (dynastyInvasion) {
        return t('market.dynastyOnly');
      }
    }

    return null;
  };

  const renderCard = (card: SeasonCard) => {
    const canAfford = activePlayer ? activePlayer.coins >= card.cost : false;
    const restriction = getPurchaseRestriction(card);
    const isRestricted = restriction !== null;

    return (
      <div key={card.id} className={`season-card-item${isRestricted ? ' card-restricted' : ''}`}>
        <div className="card-header">
          <span className="card-name">{t(getCardNameKey(card.id))}</span>
          <span className="card-cost">{card.cost} coins</span>
        </div>
        <div className="card-type">{t(cardTypeLabelKeys[card.cardType] || ('market.upgrade' as TranslationKey))}</div>
        <div className="card-effect">{t(getCardEffectKey(card.id))}</div>
        {card.force !== undefined && card.force > 0 && (
          <div className="card-force">Force: {card.force}</div>
        )}
        {canBuy && (
          isRestricted ? (
            <div className="card-restriction-text">{restriction}</div>
          ) : (
            <button
              className="btn-small btn-buy-card"
              disabled={!canAfford}
              onClick={() => doBuySeasonCard(card.id)}
            >
              {canAfford ? t('market.buy') : t('market.cannotAfford')}
            </button>
          )
        )}
      </div>
    );
  };

  return (
    <div className="season-cards-market">
      <h4>{t('market.title')} ({gameState.currentSeason})</h4>
      {activePlayer && (
        <p className="player-coins">{t('market.yourCoins')} {activePlayer.coins}</p>
      )}
      <div className="cards-grid">
        {availableCards.slice(0, 8).map(renderCard)}
      </div>
      {availableCards.length > 8 && (
        <p className="cards-more">{t('market.moreAvailable', { count: availableCards.length - 8 })}</p>
      )}
    </div>
  );
};
