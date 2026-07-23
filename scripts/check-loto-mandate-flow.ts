import assert from 'node:assert/strict';
import {
  chooseMandateTile,
  createInitialGameState,
  drawMandateTiles,
  lotoChooseActualMandate,
} from '../src/utils/gameLogic';
import type { MandateType } from '../src/types/game';

const state = createInitialGameState(
  [{ name: 'Loto', clanId: 'loto' }, { name: 'Koi', clanId: 'koi' }],
  'online',
);
const lotoPlayer = state.players.find(player => player.clanId === 'loto');
assert.ok(lotoPlayer, 'The focused Loto check requires a Loto player');

state.currentPhase = 'politics';
state.currentPlayerIndex = state.players.findIndex(player => player.id === lotoPlayer.id);
state.politicsMandateCount = 6;

const drawn = drawMandateTiles(state);
assert.equal(drawn.drawnMandates.length, 4, 'Loto must draw the normal four mandate tiles');
const discarded = drawn.drawnMandates[0];
const choosingReplacement = chooseMandateTile(drawn, discarded, lotoPlayer.id);
assert.equal(choosingReplacement.lotoChoicePhase, true, 'Discarding a tile must enter the Loto replacement choice');
assert.equal(choosingReplacement.mandateChoicePhase, false, 'The original mandate choice must close for Loto');
assert.deepEqual(choosingReplacement.drawnMandates, [], 'The remaining drawn tiles must return to the deck');

const duplicateDraw = drawMandateTiles(choosingReplacement);
assert.equal(duplicateDraw, choosingReplacement, 'Loto replacement choice must reject a second mandate draw');
const staleOriginalState = { ...choosingReplacement, drawnMandates: ['train'] as MandateType[], mandateChoicePhase: true };
const staleOriginalChoice = chooseMandateTile(staleOriginalState, 'train', lotoPlayer.id);
assert.equal(staleOriginalChoice, staleOriginalState, 'Loto replacement choice must reject a stale original-tile action');

const corruptedLegacyState = {
  ...choosingReplacement,
  mandateChoicePhase: true,
  drawnMandates: ['train', 'train', 'betray', 'harvest'] as MandateType[],
};
const recruiting = lotoChooseActualMandate(corruptedLegacyState, 'recruit', lotoPlayer.id);
assert.equal(recruiting.lotoChoicePhase, false, 'Choosing the replacement must close the Loto phase');
assert.equal(recruiting.mandateChoicePhase, false, 'Choosing the replacement must clear any stale draw phase');
assert.deepEqual(recruiting.drawnMandates, [], 'Choosing the replacement must clear stale mandate tiles');
assert.equal(recruiting.recruitMandateActive, true, 'The replacement mandate must execute normally');

console.log('Loto mandate flow checks passed.');
