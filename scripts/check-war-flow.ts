import assert from 'node:assert/strict';
import {
  createInitialGameState,
  preparePreBattleCardDecision,
  resolveBattleCardDecision,
  submitWarTacticBids,
} from '../src/utils/gameLogic';
import type { Figure } from '../src/types/game';

const state = createInitialGameState(
  [
    { name: 'Dragon', clanId: 'sol' },
    { name: 'Koneko', clanId: 'luna' },
  ],
  'hotseat',
);
const [dragonOwner, konekoOwner] = state.players;
const provinceId = 'kansai';
const fireDragon: Figure = {
  id: 'fire-dragon-test',
  type: 'monster',
  owner: dragonOwner.id,
  monsterCardId: 'su-fire-dragon',
};
const ownerBushi: Figure = { id: 'dragon-owner-bushi', type: 'bushi', owner: dragonOwner.id };
const koneko: Figure = {
  id: 'koneko-test',
  type: 'monster',
  owner: konekoOwner.id,
  monsterCardId: 'su-koneko',
};

state.currentPhase = 'war';
state.provinces[provinceId].figures = [fireDragon, ownerBushi, koneko];
state.activeBattles = [{
  provinceId,
  participants: [dragonOwner.id, konekoOwner.id],
  warTacticBids: {},
  resolved: false,
}];
dragonOwner.coins = 4;
konekoOwner.coins = 0;

const prepared = preparePreBattleCardDecision(state, provinceId);
assert.equal(prepared.pendingBattleCardDecision?.type, 'fire-dragon', 'Fire Dragon must resolve before bidding');
assert.equal(prepared.pendingBattleCardDecision?.stage, 'pre-battle', 'Fire Dragon must be a pre-battle decision');

const afterFireDragon = resolveBattleCardDecision(
  prepared,
  dragonOwner.id,
  true,
  {
    [dragonOwner.id]: ownerBushi.id,
    [konekoOwner.id]: koneko.id,
  },
);
assert.equal(afterFireDragon.pendingBattleCardDecision, null, 'Bidding may start only after all pre-battle decisions finish');
assert.equal(afterFireDragon.players.find(player => player.id === dragonOwner.id)?.coins, 2, 'Koneko must resolve before bids are placed');
assert.equal(afterFireDragon.players.find(player => player.id === konekoOwner.id)?.coins, 2, 'Koneko owner must receive its reward before bidding');

const damagedState = {
  ...afterFireDragon,
  players: afterFireDragon.players.map(player =>
    player.id === dragonOwner.id ? { ...player, coins: -2 } : player
  ),
};
const repaired = submitWarTacticBids(damagedState, provinceId, dragonOwner.id, {
  seppuku: 0,
  'take-hostage': 0,
  'hire-ronin': 0,
  'imperial-poets': 0,
});
assert.equal(repaired.players.find(player => player.id === dragonOwner.id)?.coins, 0, 'A damaged negative balance must recover to zero');

const invalidNegativeBid = submitWarTacticBids(afterFireDragon, provinceId, dragonOwner.id, {
  seppuku: -1,
  'take-hostage': 0,
  'hire-ronin': 0,
  'imperial-poets': 0,
});
assert.equal(invalidNegativeBid, afterFireDragon, 'Negative bids must be rejected');

const duplicateBid = submitWarTacticBids(repaired, provinceId, dragonOwner.id, {
  seppuku: 0,
  'take-hostage': 0,
  'hire-ronin': 0,
  'imperial-poets': 0,
});
assert.equal(duplicateBid, repaired, 'A submitted War bid must not be replaceable');

console.log('War flow checks passed.');
