import { useGameStore } from '../store/gameStore';
import { getCurrentPlayer } from '../utils/gameLogic';
import type { SeasonCard } from '../types/game';

export const SeasonCardsMarket = () => {
  const { gameState, localPlayerId, doBuySeasonCard } = useGameStore();
  if (!gameState) return null;

  const availableCards = gameState.seasonCardsDeck.filter(
    card => card.season === gameState.currentSeason
  );

  if (availableCards.length === 0) return null;

  const cp = getCurrentPlayer(gameState);
  const activePlayerId = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
  const activePlayer = gameState.players.find(p => p.id === activePlayerId);

  const cardTypeLabel: Record<string, string> = {
    virtue: 'Virtue',
    monster: 'Monster',
    upgrade: 'Upgrade',
    warUpgrade: 'War Upgrade',
    winterUpgrade: 'Winter Upgrade',
  };

  const canBuy = gameState.currentPhase === 'politics' && gameState.trainMandateActive;

  const renderCard = (card: SeasonCard) => {
    const canAfford = activePlayer ? activePlayer.coins >= card.cost : false;

    return (
      <div key={card.id} className="season-card-item">
        <div className="card-header">
          <span className="card-name">{card.name}</span>
          <span className="card-cost">{card.cost} coins</span>
        </div>
        <div className="card-type">{cardTypeLabel[card.cardType] || card.cardType}</div>
        <div className="card-effect">{card.effect}</div>
        {card.force !== undefined && card.force > 0 && (
          <div className="card-force">Force: {card.force}</div>
        )}
        {canBuy && (
          <button
            className="btn-small btn-buy-card"
            disabled={!canAfford}
            onClick={() => doBuySeasonCard(card.id)}
          >
            {canAfford ? 'Buy' : 'Cannot afford'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="season-cards-market">
      <h4>Season Cards Market ({gameState.currentSeason})</h4>
      {activePlayer && (
        <p className="player-coins">Your coins: {activePlayer.coins}</p>
      )}
      <div className="cards-grid">
        {availableCards.slice(0, 8).map(renderCard)}
      </div>
      {availableCards.length > 8 && (
        <p className="cards-more">+{availableCards.length - 8} more available</p>
      )}
    </div>
  );
};
