import type { GameState } from '../types/game';

export function stateForPlayer(state: GameState, viewerId: string): GameState {
  return {
    ...state,
    activeBattles: state.activeBattles.map(battle => ({
      ...battle,
      warTacticBids: battle.resolved
        ? battle.warTacticBids
        : Object.fromEntries(
            Object.entries(battle.warTacticBids).map(([bidderId, bids]) => [
              bidderId,
              bidderId === viewerId ? bids : {},
            ]),
          ),
    })),
    tradeOffers: state.tradeOffers.filter(offer =>
      offer.fromPlayerId === viewerId || offer.toPlayerId === viewerId
    ),
    privateLogEntries: (state.privateLogEntries || []).filter(entry =>
      entry.playerIds.includes(viewerId)
    ),
  };
}
