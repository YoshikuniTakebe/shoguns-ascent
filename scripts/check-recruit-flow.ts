import assert from 'node:assert/strict';
import {
  createInitialGameState,
  grantWarlordSummonCoin,
  recruitPlaceFigure,
  skipRecruitTurn,
} from '../src/utils/gameLogic';
import { SEASON_CARDS_DATA } from '../src/types/game';

const state = createInitialGameState(
  [
    { name: 'Kenin', clanId: 'sol' },
    { name: 'Rival', clanId: 'koi' },
  ],
  'hotseat',
);
const owner = state.players[0];
const kenin = SEASON_CARDS_DATA.find(card => card.id === 'sp-path-of-the-kenin');
assert.ok(kenin, 'Path of the Kenin must exist');
owner.seasonCards = [kenin];
state.provinces.kansai.figures = [
  { id: 'kenin-fortress', type: 'fortress', owner: owner.id },
];
state.recruitMandateActive = true;
state.recruitResolutionOrder = [owner.id];
state.recruitResolutionIndex = 0;
state.recruitMandateIssuerId = owner.id;
state.recruitPlacementsRemaining = 2;
state.recruitPlacementsTotal = 2;
state.recruitUsedFortressProvinces = [];
state.recruitWarlordCoinAwarded = false;

const afterFirstPlacement = recruitPlaceFigure(state, owner.id, 'kansai', 'bushi');
assert.equal(afterFirstPlacement.pendingSpringPlacement, null, 'Kenin must not interrupt Recruit after the first placement');
assert.equal(afterFirstPlacement.recruitWarlordCoinAwarded, true, 'Recruit must remember that its Summon event occurred');

const afterSecondPlacement = recruitPlaceFigure(afterFirstPlacement, owner.id, 'kansai', 'bushi');
assert.equal(afterSecondPlacement.pendingSpringPlacement, null, 'Kenin must wait until the complete Recruit action finishes');

const afterRecruitFinished = skipRecruitTurn(afterSecondPlacement);
assert.equal(afterRecruitFinished.pendingSpringPlacement?.type, 'kenin', 'Kenin must open after the player finishes Recruit');
assert.equal(afterRecruitFinished.pendingSpringPlacement?.ownerId, owner.id, 'The finished Recruit player must resolve Kenin');

const independentSummon = {
  ...state,
  recruitMandateActive: false,
  recruitWarlordCoinAwarded: false,
  pendingSpringPlacement: null,
  pendingSpringPlacementQueue: [],
};
const afterIndependentSummon = grantWarlordSummonCoin(independentSummon, owner.id);
assert.equal(afterIndependentSummon.pendingSpringPlacement?.type, 'kenin', 'An independent Summon must prepare Kenin immediately after that action');

console.log('Recruit summon timing checks passed.');
