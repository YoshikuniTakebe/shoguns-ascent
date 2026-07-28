import assert from 'node:assert/strict';
import { createInitialGameState } from '../src/utils/gameLogic';
import { stateForPlayer } from '../src/server/stateVisibility';

const state = createInitialGameState(
  [
    { name: 'Viewer', clanId: 'sol' },
    { name: 'Opponent', clanId: 'luna' },
    { name: 'Observer', clanId: 'koi' },
  ],
  'online',
);
const [viewer, opponent, observer] = state.players;
state.activeBattles = [{
  provinceId: 'kansai',
  participants: [viewer.id, opponent.id],
  warTacticBids: {
    [viewer.id]: { seppuku: 1 },
    [opponent.id]: { 'take-hostage': 2 },
  },
  resolved: false,
}];
state.tradeOffers = [
  {
    id: 'visible-trade',
    fromPlayerId: viewer.id,
    toPlayerId: opponent.id,
    offerCoins: 1,
    offerRonin: 0,
    requestCoins: 0,
    requestRonin: 0,
    status: 'pending',
  },
  {
    id: 'hidden-trade',
    fromPlayerId: opponent.id,
    toPlayerId: observer.id,
    offerCoins: 1,
    offerRonin: 0,
    requestCoins: 0,
    requestRonin: 0,
    status: 'pending',
  },
];
state.privateLogEntries = [
  { id: 'visible-log', playerIds: [viewer.id, opponent.id], season: 'spring', logIndex: 0, text: 'visible' },
  { id: 'hidden-log', playerIds: [opponent.id, observer.id], season: 'spring', logIndex: 0, text: 'hidden' },
];

const visible = stateForPlayer(state, viewer.id);
assert.deepEqual(visible.activeBattles[0].warTacticBids[viewer.id], { seppuku: 1 });
assert.deepEqual(visible.activeBattles[0].warTacticBids[opponent.id], {});
assert.deepEqual(visible.tradeOffers.map(offer => offer.id), ['visible-trade']);
assert.deepEqual(visible.privateLogEntries?.map(entry => entry.id), ['visible-log']);

const resolved = stateForPlayer({
  ...state,
  activeBattles: [{ ...state.activeBattles[0], resolved: true }],
}, viewer.id);
assert.deepEqual(resolved.activeBattles[0].warTacticBids[opponent.id], { 'take-hostage': 2 });

console.log('Per-player state visibility checks passed.');
