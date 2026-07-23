import assert from 'node:assert/strict';
import { buySeasonCard, createInitialGameState } from '../src/utils/gameLogic';
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

console.log('Train purchase flow checks passed.');
