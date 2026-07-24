import assert from 'node:assert/strict';
import {
  createInitialGameState,
  moveForces,
  resolvePendingSerpentCrossings,
} from '../src/utils/gameLogic';
import { SEASON_CARDS_DATA, type Figure, type GameState } from '../src/types/game';

const serpentCard = SEASON_CARDS_DATA.find(card => card.id === 'su-path-of-the-serpent');
assert.ok(serpentCard, 'Path of the Serpent card must exist');

const createMovementState = (moverClanId: string): GameState => {
  const state = createInitialGameState(
    [
      { name: 'Serpent', clanId: 'sol' },
      { name: 'Mover', clanId: moverClanId },
    ],
    'hotseat',
  );
  state.players[0].seasonCards = [serpentCard];
  state.marshalMandateActive = true;
  state.marshalMovedFigures = [];
  state.kamiResolutionActive = false;
  for (const province of Object.values(state.provinces)) province.figures = [];
  return state;
};

const bushi = (id: string, owner: string): Figure => ({ id, owner, type: 'bushi' });
const fortress = (id: string, owner: string): Figure => ({ id, owner, type: 'fortress' });

{
  const state = createMovementState('koi');
  const mover = state.players[1];
  state.provinces.hokkaido.figures = [bushi('b1', mover.id), bushi('b2', mover.id)];

  const firstMove = moveForces(state, mover.id, 'hokkaido', 'oshu', ['b1']);
  const secondMove = moveForces(firstMove, mover.id, 'hokkaido', 'oshu', ['b2']);
  assert.equal(secondMove.pendingSerpentCrossings?.length, 2, 'Each provisional Marshal action may record its crossing');

  const resolved = resolvePendingSerpentCrossings(secondMove, 'advance-marshal');
  assert.ok(resolved.pendingSerpentCharge, 'The route owner must get a charge decision');
  assert.equal(resolved.pendingSerpentChargeQueue?.length, 0, 'The same route must create only one charge decision');
}

{
  const state = createMovementState('koi');
  const mover = state.players[1];
  state.provinces.hokkaido.figures = [bushi('outbound', mover.id)];
  state.provinces.oshu.figures = [bushi('return', mover.id)];

  const outbound = moveForces(state, mover.id, 'hokkaido', 'oshu', ['outbound']);
  const returned = moveForces(outbound, mover.id, 'oshu', 'hokkaido', ['return']);
  const resolved = resolvePendingSerpentCrossings(returned, 'advance-marshal');
  assert.ok(resolved.pendingSerpentCharge, 'A bidirectional use of a Sea Route still creates a charge');
  assert.equal(resolved.pendingSerpentChargeQueue?.length, 0, 'Both directions of the same route must be charged only once');
}

{
  const state = createMovementState('libelula');
  const mover = state.players[1];
  state.provinces.hokkaido.figures = [bushi('flying', mover.id)];

  const moved = moveForces(state, mover.id, 'hokkaido', 'oshu', ['flying']);
  const resolved = resolvePendingSerpentCrossings(moved, 'advance-marshal');
  assert.ok(!resolved.pendingSerpentCharge, 'Libelula figures fly and never use Sea Routes');
}

{
  const state = createMovementState('tortuga');
  const mover = state.players[1];
  state.provinces.hokkaido.figures = [fortress('fortress-only', mover.id)];

  const moved = moveForces(state, mover.id, 'hokkaido', 'oshu', ['fortress-only']);
  const resolved = resolvePendingSerpentCrossings(moved, 'advance-marshal');
  assert.ok(!resolved.pendingSerpentCharge, 'A moving Tortuga fortress never pays for a Sea Route');
}

{
  const state = createMovementState('tortuga');
  const mover = state.players[1];
  state.marshalMovedFigures = ['already-moved-bushi'];
  state.provinces.hokkaido.figures = [
    bushi('already-moved-bushi', mover.id),
    fortress('fortress-current-action', mover.id),
  ];

  const moved = moveForces(state, mover.id, 'hokkaido', 'oshu', ['fortress-current-action']);
  const resolved = resolvePendingSerpentCrossings(moved, 'advance-marshal');
  assert.ok(
    !resolved.pendingSerpentCharge,
    'Only figures moved in the current action determine whether a Tortuga fortress is exempt',
  );
}

{
  const state = createMovementState('tortuga');
  const mover = state.players[1];
  state.provinces.hokkaido.figures = [
    fortress('fortress-mixed', mover.id),
    bushi('bushi-mixed', mover.id),
  ];

  const moved = moveForces(state, mover.id, 'hokkaido', 'oshu', ['fortress-mixed', 'bushi-mixed']);
  const resolved = resolvePendingSerpentCrossings(moved, 'advance-marshal');
  assert.ok(resolved.pendingSerpentCharge, 'A normal figure sharing the route with a fortress still uses the Sea Route');
  assert.equal(resolved.pendingSerpentChargeQueue?.length, 0, 'A mixed group pays once for the route, not once per figure');
}

console.log('Path of the Serpent checks passed');
