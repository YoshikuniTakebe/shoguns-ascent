import assert from 'node:assert/strict';
import {
  calculateForce,
  canBeKilledByPlayer,
  cleanupSeason,
  createInitialGameState,
  isFigureTrappedBySusanoo,
  moveForces,
  resolveUncontestedBattles,
  syncKamiControllers,
} from '../src/utils/gameLogic';
import type { Figure, GameState, KamiType } from '../src/types/game';

const kami = (type: KamiType, owner: string): Figure => ({ id: `kami-${type}`, type: 'kami', owner, kamiType: type });
const figure = (id: string, type: Figure['type'], owner: string): Figure => ({ id, type, owner });

function stateWithKami(selectedKami: KamiType[] = ['amaterasu', 'raijin', 'ryujin', 'susanoo']): GameState {
  return createInitialGameState(
    [{ name: 'Sol', clanId: 'sol' }, { name: 'Luna', clanId: 'luna' }],
    'hotseat',
    undefined,
    { chosenDeck: 'Archway', extraMonsters: 0, selectedKami, kamiUnbound: true },
  );
}

{
  const state = stateWithKami();
  const [first, second] = state.players;
  const province = state.provinces.kanto;
  province.figures = [figure('first-bushi', 'bushi', first.id), figure('first-shinto', 'shinto', first.id), kami('raijin', first.id)];
  assert.equal(calculateForce(province, first.id, state), first.clanId === 'luna' ? 4 : 2, 'Raijin must suppress non-Bushi figures');

  province.figures = [figure('protected', 'bushi', first.id), figure('enemy', 'bushi', second.id), kami('amaterasu', first.id)];
  state.honorTrack = [first.id, second.id];
  assert.equal(canBeKilledByPlayer(state, province.id, province.figures[0], second.id), false, 'Amaterasu must protect the highest-Honor clan');
  assert.equal(canBeKilledByPlayer(state, province.id, province.figures[0], first.id), true, 'Amaterasu must allow self-kills');

  province.figures = [figure('trapped', 'bushi', first.id), kami('susanoo', first.id)];
  state.marshalMandateActive = true;
  state.marshalMovedFigures = [];
  assert.equal(isFigureTrappedBySusanoo(state, province.id, province.figures[0]), true);
  const blocked = moveForces(state, first.id, province.id, 'edo', ['trapped']);
  assert.equal(blocked.provinces[province.id].figures.some(item => item.id === 'trapped'), true, 'Susanoo must block normal figures from leaving');

  province.figures = [kami('susanoo', first.id)];
  const movedKami = moveForces(state, first.id, province.id, 'edo', ['kami-susanoo']);
  assert.equal(movedKami.provinces.edo.figures.some(item => item.id === 'kami-susanoo'), true, 'Susanoo must not trap Kami');
}

{
  const state = stateWithKami();
  const [first, second] = state.players;
  state.provinces.kanto.figures = [kami('amaterasu', first.id)];
  state.temples[0].figures = [
    { playerId: first.id, figureId: 'worship-1' },
    { playerId: second.id, figureId: 'worship-2' },
    { playerId: second.id, figureId: 'worship-3' },
  ];
  syncKamiControllers(state);
  assert.equal(state.provinces.kanto.figures[0].owner, second.id, 'Kami control must follow the top worshipper immediately');
  assert.equal(cleanupSeason(state).provinces.kanto.figures.some(item => item.type === 'kami'), false, 'Kami must leave the board during cleanup');
}

{
  const state = stateWithKami(['tsukuyomi', 'fujin', 'hachiman', 'raijin']);
  const [first, second] = state.players;
  state.provinces.kanto.figures = [figure('a', 'bushi', first.id), figure('b', 'bushi', second.id), kami('tsukuyomi', first.id)];
  state.activeBattles = [{ provinceId: 'kanto', participants: [first.id, second.id], warTacticBids: {}, resolved: false }];
  state.warProvinceSlots = [{ number: 1, provinceId: 'kanto', season: 'spring' }];
  const rewarded = resolveUncontestedBattles(state);
  assert.deepEqual(rewarded.players.map(player => player.coins), [4, 4], 'Tsukuyomi must give 4 Coins to every clan with Force');
  const repeated = resolveUncontestedBattles(rewarded);
  assert.deepEqual(repeated.players.map(player => player.coins), [4, 4], 'Tsukuyomi must trigger only once per battle');
}

console.log('Kami Unbound logic checks passed.');
