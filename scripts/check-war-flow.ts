import assert from 'node:assert/strict';
import {
  calculateForce,
  createInitialGameState,
  getEarthDragonDestinations,
  preparePreBattleCardDecision,
  resolveBattleCardDecision,
  resolveSerpentChargeDecision,
  resolveNextBattle,
  submitWarTacticBids,
} from '../src/utils/gameLogic';
import { SEASON_CARDS_DATA } from '../src/types/game';
import type { Figure } from '../src/types/game';

const daimyoUpgradeState = createInitialGameState(
  [
    { name: 'Daimyo Upgrades', clanId: 'sol' },
    { name: 'Rival', clanId: 'koi' },
  ],
  'hotseat',
);
const daimyoUpgradeOwner = daimyoUpgradeState.players[0];
const lionCard = SEASON_CARDS_DATA.find(card => card.id === 'sp-path-of-the-lion');
const dragonCard = SEASON_CARDS_DATA.find(card => card.id === 'au-path-of-the-dragon');
assert.ok(lionCard && dragonCard, 'Daimyo force upgrades must exist');
daimyoUpgradeOwner.seasonCards = [lionCard, dragonCard];
daimyoUpgradeState.provinces.kansai.figures = [
  { id: 'upgraded-daimyo', type: 'daimyo', owner: daimyoUpgradeOwner.id },
  { id: 'upgraded-yurei', type: 'monster', owner: daimyoUpgradeOwner.id, monsterCardId: 'su-yurei' },
  { id: 'upgraded-fukurokuju', type: 'monster', owner: daimyoUpgradeOwner.id, monsterCardId: 'sp-fukurokuju' },
];
assert.equal(
  calculateForce(daimyoUpgradeState.provinces.kansai, daimyoUpgradeOwner.id, daimyoUpgradeState),
  16,
  'Daimyo upgrades must apply to the Daimyo, Yurei and Fukurokuju',
);

const earthState = createInitialGameState(
  [
    { name: 'Earth', clanId: 'sol' },
    { name: 'Rival', clanId: 'luna' },
  ],
  'hotseat',
);
const [earthOwner, earthRival] = earthState.players;
const earthDragon: Figure = {
  id: 'earth-dragon-test',
  type: 'monster',
  owner: earthOwner.id,
  monsterCardId: 'sp-earth-dragon',
};
const rivalBushi: Figure = { id: 'earth-rival-bushi', type: 'bushi', owner: earthRival.id };
earthState.currentPhase = 'war';
earthState.provinces.kansai.figures = [earthDragon, rivalBushi];
earthState.activeBattles = [{
  provinceId: 'kansai',
  participants: [earthOwner.id, earthRival.id],
  warTacticBids: {},
  resolved: false,
}];

const blockedEarthBid = submitWarTacticBids(earthState, 'kansai', earthOwner.id, {
  seppuku: 0,
  'take-hostage': 0,
  'hire-ronin': 0,
  'imperial-poets': 0,
});
assert.equal(blockedEarthBid, earthState, 'Bidding must be rejected while Earth Dragon is unresolved');

const preparedEarth = preparePreBattleCardDecision(earthState, 'kansai');
assert.equal(preparedEarth.pendingBattleCardDecision?.type, 'earth-dragon', 'Earth Dragon must resolve before bidding');
assert.equal(preparedEarth.pendingBattleCardDecision?.stage, 'pre-battle', 'Earth Dragon must be a pre-battle decision');
const afterEarthDragon = resolveBattleCardDecision(
  preparedEarth,
  earthOwner.id,
  true,
  { [earthRival.id]: rivalBushi.id },
  { [rivalBushi.id]: 'edo' },
);
assert.equal(afterEarthDragon.pendingBattleCardDecision, null, 'Bidding may start after Earth Dragon finishes');
assert.equal(afterEarthDragon.provinces.edo.figures.some(figure => figure.id === rivalBushi.id), true, 'Earth Dragon must move the selected figure');

const lunaLimitState = createInitialGameState(
  [
    { name: 'Earth', clanId: 'sol' },
    { name: 'Moon', clanId: 'luna' },
  ],
  'hotseat',
);
const [limitEarthOwner, moonPlayer] = lunaLimitState.players;
lunaLimitState.currentPhase = 'war';
lunaLimitState.provinces.kansai.figures = [
  { id: 'limit-earth', type: 'monster', owner: limitEarthOwner.id, monsterCardId: 'sp-earth-dragon' },
  { id: 'limit-target', type: 'bushi', owner: moonPlayer.id },
];
for (const destinationId of ['edo', 'nagato', 'hokkaido', 'kyushu', 'shikoku']) {
  lunaLimitState.provinces[destinationId].figures = [
    { id: `${destinationId}-moon-1`, type: 'bushi', owner: moonPlayer.id },
    { id: `${destinationId}-moon-2`, type: 'shinto', owner: moonPlayer.id },
  ];
}
assert.deepEqual(
  getEarthDragonDestinations(lunaLimitState, 'kansai', moonPlayer.id),
  [],
  'Earth Dragon must not offer a destination that already contains two Luna figures',
);

const serpentEarthState = createInitialGameState(
  [
    { name: 'Earth', clanId: 'sol' },
    { name: 'Moon', clanId: 'luna' },
    { name: 'Serpent', clanId: 'koi' },
  ],
  'hotseat',
);
const [serpentEarthOwner, serpentMover, serpentOwner] = serpentEarthState.players;
const serpentCard = SEASON_CARDS_DATA.find(card => card.id === 'su-path-of-the-serpent');
assert.ok(serpentCard, 'Path of the Serpent card must exist');
serpentOwner.seasonCards = [serpentCard];
serpentMover.coins = 0;
const serpentTarget: Figure = { id: 'serpent-earth-target', type: 'bushi', owner: serpentMover.id };
serpentEarthState.currentPhase = 'war';
serpentEarthState.provinces.kansai.figures = [
  { id: 'serpent-earth-dragon', type: 'monster', owner: serpentEarthOwner.id, monsterCardId: 'sp-earth-dragon' },
  serpentTarget,
];
serpentEarthState.activeBattles = [{
  provinceId: 'kansai',
  participants: [serpentEarthOwner.id, serpentMover.id],
  warTacticBids: {},
  resolved: false,
}];
const preparedSerpentEarth = preparePreBattleCardDecision(serpentEarthState, 'kansai');
const awaitingSerpent = resolveBattleCardDecision(
  preparedSerpentEarth,
  serpentEarthOwner.id,
  true,
  { [serpentMover.id]: serpentTarget.id },
  { [serpentTarget.id]: 'hokkaido' },
);
assert.equal(awaitingSerpent.pendingBattleCardDecision, null, 'Earth Dragon must pause while Path of the Serpent resolves');
assert.equal(awaitingSerpent.pendingSerpentCharge?.ownerId, serpentOwner.id, 'Path of the Serpent owner must decide before bidding');
const blockedBySerpent = resolveSerpentChargeDecision(awaitingSerpent, serpentOwner.id, true);
assert.equal(blockedBySerpent.provinces.kansai.figures.some(figure => figure.id === serpentTarget.id), true, 'An unpaid forced crossing must return to its origin');
assert.equal(blockedBySerpent.provinces.hokkaido.figures.some(figure => figure.id === serpentTarget.id), false, 'An unpaid forced crossing must not remain at its destination');

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

const distributionState = createInitialGameState(
  [
    { name: 'Winner', clanId: 'sol' },
    { name: 'Loser', clanId: 'luna' },
  ],
  'hotseat',
);
const [distributionWinner, distributionLoser] = distributionState.players;
distributionWinner.coins = 3;
distributionLoser.coins = 2;
distributionState.currentPhase = 'war';
distributionState.warProvinceSlots = [{ number: 1, provinceId: 'kansai', season: 'spring' }];
distributionState.provinces.kansai.figures = [
  { id: 'winner-bushi-1', type: 'bushi', owner: distributionWinner.id },
  { id: 'winner-bushi-2', type: 'bushi', owner: distributionWinner.id },
  { id: 'loser-bushi', type: 'bushi', owner: distributionLoser.id },
];
const paidBids = {
  [distributionWinner.id]: { seppuku: 0, 'take-hostage': 0, 'hire-ronin': 2, 'imperial-poets': 0 },
  [distributionLoser.id]: { seppuku: 0, 'take-hostage': 0, 'hire-ronin': 0, 'imperial-poets': 1 },
};
distributionState.activeBattles = [{
  provinceId: 'kansai',
  participants: [distributionWinner.id, distributionLoser.id],
  warTacticBids: paidBids,
  resolved: false,
}];

const finalBattleResolved = resolveNextBattle(distributionState);
assert.equal(finalBattleResolved.coinDistributionPending == null, true, 'The final battle must skip the coin-distribution popup');
assert.ok(
  finalBattleResolved.log.some(entry =>
    entry.includes(distributionLoser.name)
    && entry.includes('{coin} 1')
    && entry.includes('en apuestas')),
  'The battle log must record the losing player bid spend without revealing their balance',
);

const earlierBattleState = {
  ...distributionState,
  activeBattles: [
    ...distributionState.activeBattles,
    {
      provinceId: 'shikoku',
      participants: [distributionWinner.id, distributionLoser.id],
      warTacticBids: {},
      resolved: false,
    },
  ],
};
const earlierBattleResolved = resolveNextBattle(earlierBattleState);
assert.ok(earlierBattleResolved.coinDistributionPending, 'A non-final battle must still report the coin distribution');

console.log('War flow checks passed.');
