import assert from 'node:assert/strict';
import {
  applyRighteousnessVP,
  advanceHarvestResolution,
  betrayReplaceWorshippingShinto,
  betraySelectFigure,
  calculateForce,
  confirmWarStartAction,
  confirmDaikaijuPlacement,
  createInitialGameState,
  executeMandate,
  escrowWarTacticBids,
  getEarthDragonDestinations,
  gainCoinsFromSupply,
  initiateWarPhase,
  prepareMonsterEnterDecision,
  preparePreBattleCardDecision,
  resolveBattleCardDecision,
  resolveSerpentChargeDecision,
  resolveNextBattle,
  resolveMonkeyDecision,
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

const spiteState = createInitialGameState(
  [
    { name: 'Spite', clanId: 'sol' },
    { name: 'Victim', clanId: 'koi' },
  ],
  'hotseat',
);
const [spiteOwner, spiteVictim] = spiteState.players;
spiteState.honorTrack = [spiteVictim.id, spiteOwner.id];
spiteVictim.victoryPoints = 5;
spiteState.provinces.kansai.figures = [
  { id: 'spite-oni', type: 'monster', owner: spiteOwner.id, monsterCardId: 'au-oni-of-spite' },
  { id: 'spite-victim', type: 'bushi', owner: spiteVictim.id },
];
const spiteResolved = prepareMonsterEnterDecision(spiteState, 'kansai', 'spite-oni', 'advance-train');
assert.equal(spiteResolved.players[0].victoryPoints, 2, 'Oni of Spite must steal 2 VP from a higher-Honor player in the Province');
assert.equal(spiteResolved.players[1].victoryPoints, 3);
assert.equal(spiteResolved.pendingRuleNotices?.[0]?.type, 'oni-spite', 'Oni of Spite must create a synchronized information popup');
assert.equal(spiteResolved.pendingRuleNotices?.[0]?.resume, 'advance-train', 'The popup must preserve the interrupted flow');
assert.deepEqual(
  spiteResolved.pendingRuleNotices?.[0]?.requiredPlayerIds,
  spiteResolved.players.map(player => player.id),
  'Every player must acknowledge Oni of Spite',
);

const fortressOnlySpiteState = createInitialGameState(
  [
    { name: 'Spite', clanId: 'luna' },
    { name: 'Fortress only', clanId: 'sol' },
  ],
  'hotseat',
);
const fortressSpiteOwner = fortressOnlySpiteState.players.find(player => player.name === 'Spite')!;
const fortressVictim = fortressOnlySpiteState.players.find(player => player.name === 'Fortress only')!;
fortressOnlySpiteState.honorTrack = [fortressVictim.id, fortressSpiteOwner.id];
fortressVictim.victoryPoints = 5;
fortressOnlySpiteState.provinces.kansai.figures = [
  { id: 'spite-oni-fortress', type: 'monster', owner: fortressSpiteOwner.id, monsterCardId: 'au-oni-of-spite' },
  { id: 'zero-force-fortress', type: 'fortress', owner: fortressVictim.id },
];
const fortressOnlySpiteResolved = prepareMonsterEnterDecision(
  fortressOnlySpiteState,
  'kansai',
  'spite-oni-fortress',
);
assert.equal(
  fortressOnlySpiteResolved.players.find(player => player.id === fortressVictim.id)?.victoryPoints,
  5,
  'Oni of Spite must ignore a clan with zero local Force',
);
assert.equal(fortressOnlySpiteResolved.pendingRuleNotices?.some(notice => notice.type === 'oni-spite') ?? false, false);

const merchantState = createInitialGameState(
  [
    { name: 'Merchant', clanId: 'luna' },
    { name: 'Rich player', clanId: 'sol' },
  ],
  'hotseat',
);
const merchant = merchantState.players.find(player => player.name === 'Merchant')!;
const richPlayer = merchantState.players.find(player => player.name === 'Rich player')!;
merchant.seasonCards = [SEASON_CARDS_DATA.find(card => card.id === 'su-way-of-the-merchant')!];
merchant.coins = 1;
richPlayer.coins = 4;
gainCoinsFromSupply(merchantState, richPlayer.id, 2, 'test reward', 'advance-train');
const merchantNotice = merchantState.pendingRuleNotices?.find(notice => notice.type === 'merchant');
assert.equal(merchant.coins, 2, 'Way of the Merchant must still grant its Coin');
assert.equal(merchantNotice?.rewardAmount, 1, 'Way of the Merchant must report the amount gained');
assert.equal(merchantNotice?.actorCoins, 2, 'Way of the Merchant must report the resulting total');
assert.equal(merchantNotice?.resume, 'advance-train', 'Way of the Merchant must preserve the interrupted flow');
assert.deepEqual(merchantNotice?.requiredPlayerIds, merchantState.players.map(player => player.id), 'Way of the Merchant must pause for every player');

{
  const harvestState = createInitialGameState(
    [
      { name: 'Merchant', clanId: 'luna' },
      { name: 'Harvester', clanId: 'sol' },
    ],
    'hotseat',
  );
  const [harvestMerchant, harvester] = harvestState.players;
  harvestMerchant.seasonCards = [SEASON_CARDS_DATA.find(card => card.id === 'su-way-of-the-merchant')!];
  harvestMerchant.coins = 1;
  harvester.coins = 5;
  for (const province of Object.values(harvestState.provinces)) province.figures = [];
  harvestState.provinces.kansai.figures = [{ id: 'harvest-kansai', type: 'bushi', owner: harvester.id }];
  harvestState.provinces.kyushu.figures = [{ id: 'harvest-kyushu', type: 'bushi', owner: harvester.id }];
  let resolvedHarvest = executeMandate(harvestState, 'harvest', harvester.id);
  assert.equal(
    resolvedHarvest.players.find(player => player.id === harvestMerchant.id)?.coins,
    3,
    'Way of the Merchant must add one Coin, besides the base Harvest Coin, when the grouped gain begins',
  );
  while (resolvedHarvest.harvestMandateActive) resolvedHarvest = advanceHarvestResolution(resolvedHarvest);
  assert.equal(
    resolvedHarvest.players.find(player => player.id === harvestMerchant.id)?.coins,
    3,
    'Several Coin rewards in one Harvest must remain a single Way of the Merchant trigger',
  );
}

{
  const state = createInitialGameState(
    [
      { name: 'Traitor', clanId: 'sol' },
      { name: 'Target', clanId: 'koi' },
    ],
    'hotseat',
  );
  const [traitor, target] = state.players;
  const komainu = SEASON_CARDS_DATA.find(card => card.id === 'sp-komainu')!;
  traitor.seasonCards = [komainu];
  traitor.monsters = 1;
  traitor.shinto = 1;
  state.betrayMandateActive = true;
  state.betrayMandateIssuerId = traitor.id;
  state.betraySelectionsRemaining = 2;
  state.betraySelectedOwners = [];
  state.provinces.kansai.figures = [{ id: 'enemy-shinto', type: 'shinto', owner: target.id }];

  const withKomainu = betraySelectFigure(state, traitor.id, 'enemy-shinto', 'kansai', 'sp-komainu');
  assert.equal(withKomainu.provinces.kansai.figures[0]?.monsterCardId, 'sp-komainu', 'Komainu in reserve may replace a Shinto');

  withKomainu.betraySelectedOwners = [];
  withKomainu.provinces.kansai.figures = [{ id: 'enemy-komainu', type: 'monster', owner: target.id, monsterCardId: 'sp-komainu' }];
  const withShinto = betraySelectFigure(withKomainu, traitor.id, 'enemy-komainu', 'kansai', '__shinto__');
  assert.equal(withShinto.provinces.kansai.figures[0]?.type, 'shinto', 'A Komainu on the map may be replaced as a Shinto');
  assert.equal(
    betraySelectFigure(withKomainu, traitor.id, 'enemy-komainu', 'ocean', '__shinto__'),
    withKomainu,
    'Betray may never target a figure in the Ocean',
  );
}

{
  const state = createInitialGameState(
    [
      { name: 'Daikaiju', clanId: 'sol' },
      { name: 'Fukurokuju', clanId: 'koi' },
    ],
    'hotseat',
  );
  const [daikaijuOwner, victim] = state.players;
  state.daikaijuPlacementActive = true;
  state.daikaijuPlacementPlayerId = daikaijuOwner.id;
  state.daikaijuPlacementProvinceId = 'kansai';
  state.provinces.kansai.figures = [
    { id: 'daikaiju', type: 'monster', owner: daikaijuOwner.id, monsterCardId: 'au-daikaiju' },
    { id: 'fukurokuju', type: 'monster', owner: victim.id, monsterCardId: 'sp-fukurokuju' },
  ];
  const monstersBefore = victim.monsters;
  const crushed = confirmDaikaijuPlacement(state, daikaijuOwner.id);
  assert.equal(crushed.provinces.kansai.figures.some(figure => figure.monsterCardId === 'sp-fukurokuju'), false);
  assert.equal(crushed.players.find(player => player.id === victim.id)?.monsters, monstersBefore + 1);
  assert.equal(crushed.daikaijuSummaryData?.crushedFukurokuju?.[0]?.playerId, victim.id);
}

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

const escrowState = createInitialGameState(
  [
    { name: 'Escrow A', clanId: 'sol' },
    { name: 'Escrow B', clanId: 'luna' },
  ],
  'hotseat',
);
const [escrowA, escrowB] = escrowState.players;
escrowA.coins = 5;
escrowB.coins = 4;
escrowState.currentPhase = 'war';
escrowState.activeBattles = [{
  provinceId,
  participants: [escrowA.id, escrowB.id],
  warTacticBids: {
    [escrowA.id]: { seppuku: 1, 'take-hostage': 0, 'hire-ronin': 1, 'imperial-poets': 0 },
    [escrowB.id]: { seppuku: 0, 'take-hostage': 1, 'hire-ronin': 0, 'imperial-poets': 0 },
  },
  resolved: false,
}];
const escrowed = escrowWarTacticBids(escrowState, provinceId);
assert.equal(escrowed.players.find(player => player.id === escrowA.id)?.coins, 3, 'Escrow must reserve every submitted coin for player A');
assert.equal(escrowed.players.find(player => player.id === escrowB.id)?.coins, 3, 'Escrow must reserve every submitted coin for player B');
assert.equal(escrowed.activeBattles[0].bidsEscrowed, true, 'The battle must remember that bids are already reserved');
assert.equal(escrowWarTacticBids(escrowed, provinceId), escrowed, 'Escrow must be idempotent');

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

const remainderDistributionState = createInitialGameState(
  [
    { name: 'Winner', clanId: 'sol' },
    { name: 'Loser A', clanId: 'luna' },
    { name: 'Loser B', clanId: 'loto' },
  ],
  'hotseat',
);
const [remainderWinner, remainderLoserA, remainderLoserB] = remainderDistributionState.players;
remainderDistributionState.currentPhase = 'war';
remainderDistributionState.warProvinceSlots = [
  { number: 1, provinceId: 'kansai', season: 'spring' },
  { number: 2, provinceId: 'shikoku', season: 'spring' },
];
remainderDistributionState.provinces.kansai.figures = [
  { id: 'remainder-winner-1', type: 'bushi', owner: remainderWinner.id },
  { id: 'remainder-winner-2', type: 'bushi', owner: remainderWinner.id },
  { id: 'remainder-loser-a', type: 'bushi', owner: remainderLoserA.id },
  { id: 'remainder-loser-b', type: 'bushi', owner: remainderLoserB.id },
];
remainderDistributionState.activeBattles = [
  {
    provinceId: 'kansai',
    participants: [remainderWinner.id, remainderLoserA.id, remainderLoserB.id],
    warTacticBids: {
      [remainderWinner.id]: { seppuku: 0, 'take-hostage': 0, 'hire-ronin': 5, 'imperial-poets': 0 },
      [remainderLoserA.id]: { seppuku: 0, 'take-hostage': 0, 'hire-ronin': 0, 'imperial-poets': 0 },
      [remainderLoserB.id]: { seppuku: 0, 'take-hostage': 0, 'hire-ronin': 0, 'imperial-poets': 0 },
    },
    resolved: false,
  },
  {
    provinceId: 'shikoku',
    participants: [remainderWinner.id, remainderLoserA.id],
    warTacticBids: {},
    resolved: false,
  },
];
const remainderResolved = resolveNextBattle(remainderDistributionState);
assert.equal(remainderResolved.coinDistributionPending?.remainder, 1, 'The winner must choose which loser receives the remaining Coin');
assert.equal(remainderResolved.coinDistributionPending?.sharePerLoser, 2, 'Only the equal share is distributed automatically');
assert.equal(remainderResolved.players.find(player => player.id === remainderLoserA.id)?.coins, remainderLoserA.coins + 2, 'Loser A must not receive the remainder automatically');
assert.equal(remainderResolved.players.find(player => player.id === remainderLoserB.id)?.coins, remainderLoserB.coins + 2, 'Loser B must not receive the remainder automatically');

const righteousnessState = createInitialGameState(
  [
    { name: 'Virtuous', clanId: 'sol' },
    { name: 'Ally', clanId: 'luna' },
  ],
  'hotseat',
);
const righteousnessPlayer = righteousnessState.players[0];
const righteousnessCard = SEASON_CARDS_DATA.find(card => card.id === 'sp-righteousness');
const loyaltyCard = SEASON_CARDS_DATA.find(card => card.id === 'su-loyalty');
assert.ok(righteousnessCard && loyaltyCard);
righteousnessPlayer.seasonCards = [righteousnessCard, loyaltyCard];
righteousnessPlayer.allies = [righteousnessState.players[1].id];
applyRighteousnessVP(righteousnessState, righteousnessPlayer.id, 2);
assert.equal(righteousnessPlayer.victoryPoints, 3, 'Righteousness must grant 2 VP and trigger one Loyalty VP');
assert.equal(righteousnessState.pendingRuleNotices?.[0]?.type, 'righteousness', 'Righteousness must create a blocking information popup');
assert.deepEqual(
  righteousnessState.pendingRuleNotices?.[0]?.requiredPlayerIds,
  righteousnessState.players.map(player => player.id),
  'Every player must acknowledge the Righteousness popup',
);

const betrayState = createInitialGameState(
  [
    { name: 'Betrayer', clanId: 'sol' },
    { name: 'Righteous victim', clanId: 'luna' },
  ],
  'hotseat',
);
const [betrayer, righteousVictim] = betrayState.players;
righteousVictim.seasonCards = [righteousnessCard];
righteousVictim.victoryPoints = 0;
righteousVictim.bushi = 3;
betrayState.betrayMandateActive = true;
betrayState.betrayMandateIssuerId = betrayer.id;
betrayState.betraySelectionsRemaining = 1;
betrayState.provinces.kansai.figures = [
  { id: 'betray-target', type: 'bushi', owner: righteousVictim.id },
];
const betrayedFigureState = betraySelectFigure(betrayState, betrayer.id, 'betray-target', 'kansai');
assert.equal(
  betrayedFigureState.players.find(player => player.id === righteousVictim.id)?.victoryPoints,
  0,
  'Betray replaces a figure and must not trigger Righteousness',
);
assert.equal(
  betrayedFigureState.players.find(player => player.id === righteousVictim.id)?.bushi,
  4,
  'A figure replaced by Betray must return to its reserve',
);
assert.equal(
  betrayedFigureState.pendingRuleNotices?.some(notice => notice.type === 'righteousness') ?? false,
  false,
  'Betray must not create a Righteousness popup',
);

const unrighteousBetrayState = createInitialGameState(
  [
    { name: 'Unrighteous betrayer', clanId: 'sol' },
    { name: 'Righteous worshipper', clanId: 'luna' },
    { name: 'Second worshipper', clanId: 'koi' },
  ],
  'hotseat',
);
const [unrighteousBetrayer, righteousWorshipper] = unrighteousBetrayState.players;
unrighteousBetrayer.seasonCards = [SEASON_CARDS_DATA.find(card => card.id === 'au-path-of-the-unrighteous')!];
righteousWorshipper.seasonCards = [righteousnessCard];
righteousWorshipper.victoryPoints = 0;
righteousWorshipper.shinto = 2;
unrighteousBetrayState.betrayMandateActive = true;
unrighteousBetrayState.betrayMandateIssuerId = unrighteousBetrayer.id;
unrighteousBetrayState.betraySelectionsRemaining = 2;
unrighteousBetrayState.betraySelectedOwners = [
  righteousWorshipper.id,
  unrighteousBetrayState.players[2].id,
];
unrighteousBetrayState.temples[0].figures = [
  { playerId: righteousWorshipper.id, figureId: 'worshipping-target' },
];
unrighteousBetrayState.temples[1].figures = [
  { playerId: unrighteousBetrayState.players[2].id, figureId: 'second-worshipping-target' },
];
const betrayedWorshipperState = betrayReplaceWorshippingShinto(
  unrighteousBetrayState,
  unrighteousBetrayer.id,
  unrighteousBetrayState.temples[0].id,
  'worshipping-target',
);
assert.equal(
  betrayedWorshipperState.players.find(player => player.id === righteousWorshipper.id)?.victoryPoints,
  0,
  'Path of the Unrighteous replaces a worshipping Shinto and must not trigger Righteousness',
);
assert.equal(
  betrayedWorshipperState.players.find(player => player.id === righteousWorshipper.id)?.shinto,
  3,
  'A worshipping Shinto replaced by Path of the Unrighteous must return to its reserve',
);
assert.equal(
  betrayedWorshipperState.pendingRuleNotices?.some(notice => notice.type === 'righteousness') ?? false,
  false,
  'Path of the Unrighteous must not create a Righteousness popup',
);
assert.equal(
  betrayedWorshipperState.betraySelectionsRemaining,
  1,
  'Path of the Unrighteous must become available early when no standard Betray target remains',
);
assert.equal(
  betrayedWorshipperState.betrayUnrighteousSelectionsUsed,
  1,
  'An early Path of the Unrighteous replacement must consume its additional selection',
);
assert.equal(
  betrayReplaceWorshippingShinto(
    betrayedWorshipperState,
    unrighteousBetrayer.id,
    betrayedWorshipperState.temples[1].id,
    'second-worshipping-target',
  ),
  betrayedWorshipperState,
  'A consumed Path of the Unrighteous selection must not become available again',
);

const raijinState = createInitialGameState(
  [
    { name: 'Turtle', clanId: 'tortuga' },
    { name: 'Rival', clanId: 'sol' },
  ],
  'hotseat',
  undefined,
  { kamiUnbound: true },
);
const turtle = raijinState.players.find(player => player.name === 'Turtle')!;
raijinState.currentPhase = 'war';
raijinState.provinces.kansai.figures = [
  { id: 'turtle-fortress', type: 'fortress', owner: turtle.id },
  { id: 'raijin-kami', type: 'kami', owner: raijinState.players.find(player => player.name === 'Rival')!.id, kamiType: 'raijin' },
];
assert.equal(
  calculateForce(raijinState.provinces.kansai, turtle.id, raijinState),
  1,
  'Raijin must not suppress Turtle Stronghold force because Strongholds are not figures',
);

const skullsState = createInitialGameState(
  [
    { name: 'Skulls', clanId: 'sol' },
    { name: 'Departed rival', clanId: 'luna' },
  ],
  'hotseat',
);
const skullsOwner = skullsState.players.find(player => player.name === 'Skulls')!;
const departedRival = skullsState.players.find(player => player.name === 'Departed rival')!;
skullsState.currentPhase = 'war';
skullsState.honorTrack = [departedRival.id, skullsOwner.id];
skullsState.provinces.kansai.figures = [
  { id: 'oni-skulls', type: 'monster', owner: skullsOwner.id, monsterCardId: 'sp-oni-of-skulls' },
];
skullsState.activeBattles = [{
  provinceId: 'kansai',
  participants: [skullsOwner.id, departedRival.id],
  warTacticBids: {},
  resolved: false,
}];
assert.equal(
  calculateForce(skullsState.provinces.kansai, skullsOwner.id, skullsState),
  3,
  'Oni of Skulls must still compare against a Battle participant whose last figure left',
);

const monkeyState = createInitialGameState(
  [
    { name: 'Monkey', clanId: 'sol' },
    { name: 'Rich A', clanId: 'luna' },
    { name: 'Rich B', clanId: 'koi' },
  ],
  'hotseat',
);
const monkeyOwner = monkeyState.players.find(player => player.name === 'Monkey')!;
const richA = monkeyState.players.find(player => player.name === 'Rich A')!;
const richB = monkeyState.players.find(player => player.name === 'Rich B')!;
monkeyOwner.coins = 1;
richA.coins = 5;
richB.coins = 5;
monkeyState.pendingMonkeyDecision = { ownerId: monkeyOwner.id, remainingCopies: 1, copyNumber: 1 };
const monkeyResolved = resolveMonkeyDecision(monkeyState, monkeyOwner.id, true);
assert.equal(monkeyResolved.players.find(player => player.id === monkeyOwner.id)?.coins, 3, 'Path of the Monkey takes one Coin from every tied richest opponent');
assert.equal(monkeyResolved.players.find(player => player.id === richA.id)?.coins, 4);
assert.equal(monkeyResolved.players.find(player => player.id === richB.id)?.coins, 4);

const foxState = createInitialGameState(
  [
    { name: 'Fox', clanId: 'zorro' },
    { name: 'Rival', clanId: 'luna' },
  ],
  'hotseat',
);
const fox = foxState.players.find(player => player.name === 'Fox')!;
fox.bushi = 20;
foxState.warProvinceSlots = [{ number: 1, provinceId: 'kansai', season: 'spring' }];
foxState.provinces.kansai.figures = [{ id: 'fox-present', type: 'bushi', owner: fox.id }];
const foxWar = initiateWarPhase(foxState);
const expectedFoxPlacements = Object.entries(foxWar.provinces).filter(([id, province]) =>
  id !== 'ocean' && !province.figures.some(figure => figure.owner === fox.id && figure.type !== 'fortress')
).length;
assert.equal(
  foxWar.zorroPlacementsRemaining,
  expectedFoxPlacements,
  'Fox must be able to place in every empty Province, including Provinces without a War token',
);

const sincerityState = createInitialGameState(
  [
    { name: 'Sincere', clanId: 'sol' },
    { name: 'Victim', clanId: 'luna' },
  ],
  'hotseat',
);
const sincere = sincerityState.players.find(player => player.name === 'Sincere')!;
const sincerityVictim = sincerityState.players.find(player => player.name === 'Victim')!;
const sunakake = SEASON_CARDS_DATA.find(card => card.id === 'su-sunakake-baba');
const sincerity = SEASON_CARDS_DATA.find(card => card.id === 'su-sincerity');
assert.ok(sunakake && sincerity);
sincere.seasonCards = [sunakake, sincerity];
sincerityVictim.victoryPoints = 3;
sincerityState.currentPhase = 'war';
sincerityState.provinces.kansai.figures = [
  { id: 'sunakake', type: 'monster', owner: sincere.id, monsterCardId: sunakake.id },
  { id: 'sincerity-target', type: 'bushi', owner: sincerityVictim.id },
];
sincerityState.warStartActions = [{ type: 'sunakake', playerId: sincere.id }];
sincerityState.warStartActionIndex = 0;
sincerityState.warStartActionsComplete = false;
sincerityState.warStartSelection = { targetFigureIds: ['sincerity-target'] };
const sincerityResolved = confirmWarStartAction(sincerityState, sincere.id);
assert.equal(sincerityResolved.players.find(player => player.id === sincere.id)?.victoryPoints, 2, 'Sincerity must add 1 VP to the VP stolen by Sunakake-Baba');

console.log('War flow checks passed.');
