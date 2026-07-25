import assert from 'node:assert/strict';
import { buySeasonCard, createInitialGameState, setupSeason } from '../src/utils/gameLogic';
import { SEASON_CARDS_DATA } from '../src/types/game';

const state = createInitialGameState(
  [{ name: 'Sol', clanId: 'sol' }, { name: 'Luna', clanId: 'luna' }],
  'hotseat',
  undefined,
  { chosenDeck: 'Archway', extraMonsters: 0 },
);
const buyer = state.players[0];
const card = SEASON_CARDS_DATA.find(candidate => candidate.id === 'sp-courage');
assert.ok(card, 'The focused Train check requires Courage');

state.currentPhase = 'politics';
state.currentPlayerIndex = 0;
state.trainMandateActive = true;
state.trainResolutionOrder = [buyer.id, state.players[1].id];
state.trainResolutionIndex = 0;
state.seasonCardsDeck = [card];
buyer.coins = 10;
state.pendingBenevolence = {
  ownerId: buyer.id,
  remainingTriggers: 1,
  totalTriggers: 1,
  currentCopy: 1,
  resume: 'advance-train',
};

const blocked = buySeasonCard(state, buyer.id, card.id);
assert.equal(blocked, state, 'Train must reject another purchase while Benevolence is unresolved');
assert.equal(buyer.coins, 10, 'A rejected duplicate purchase must not spend coins');
assert.equal(state.seasonCardsDeck.some(candidate => candidate.id === card.id), true, 'A rejected duplicate purchase must leave the card in the market');

state.pendingBenevolence = null;
const purchased = buySeasonCard(state, buyer.id, card.id);
assert.notEqual(purchased, state, 'Train must accept the purchase after Benevolence resolves');
assert.equal(purchased.seasonCardsDeck.some(candidate => candidate.id === card.id), false, 'A valid purchase must remove the card from the market');
assert.equal(purchased.players[0].seasonCards.some(candidate => candidate.id === card.id), true, 'A valid purchase must add the card to the buyer');

const debugState = createInitialGameState(
  [{ name: 'Admin', clanId: 'zorro' }, { name: 'Rival', clanId: 'bonsai' }],
  'hotseat',
  undefined,
  { chosenDeck: 'Mountain', extraMonsters: 0, debugAllCards: true },
);
assert.equal(debugState.debugAllCards, true, 'The admin card mode must be persisted in the game state');
assert.equal(debugState.activeDeckGroup, null, 'The all-card market must not identify itself as a single deck set');
assert.equal(
  debugState.seasonCardsDeck.length,
  SEASON_CARDS_DATA.length,
  'The all-card market must preserve every physical card copy',
);
assert.deepEqual(
  new Set(debugState.seasonCardsDeck.map(candidate => candidate.id)),
  new Set(SEASON_CARDS_DATA.map(candidate => candidate.id)),
  'Every card from every set and season must be available from Spring',
);

const removedDebugCardId = debugState.seasonCardsDeck[0].id;
debugState.seasonCardsDeck = debugState.seasonCardsDeck.filter(candidate => candidate.id !== removedDebugCardId);
const debugSummer = setupSeason(debugState, 'summer');
assert.equal(
  debugSummer.seasonCardsDeck.some(candidate => candidate.id === removedDebugCardId),
  false,
  'Cards removed from the debug market must not reappear when the season changes',
);
assert.equal(
  debugSummer.seasonCardsDeck.some(candidate => candidate.season === 'spring'),
  true,
  'Spring cards must remain available in the debug market during Summer',
);
assert.equal(
  debugSummer.seasonCardsDeck.some(candidate => candidate.season === 'autumn'),
  true,
  'Autumn cards must already be available in the debug market during Summer',
);

console.log('Train purchase flow checks passed.');
