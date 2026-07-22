import assert from 'node:assert/strict';
import {
  advanceKamiResolution,
  calculateForce,
  canBeKilledByPlayer,
  cleanupSeason,
  confirmKamiManifestation,
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
  const owner = state.players[0];
  state.provinces.kanto.figures = [kami('amaterasu', owner.id)];
  state.kamiPlacementActive = true;
  state.kamiPlacementPlayerId = owner.id;
  state.kamiPlacementKamiType = 'amaterasu';
  state.kamiPlacementProvinceId = null;

  const confirmed = confirmKamiManifestation(state, owner.id);
  assert.equal(confirmed.kamiPlacementActive, false, 'An existing Kami may confirm without selecting a new Province');
  assert.equal(confirmed.provinces.kanto.figures.some(item => item.type === 'kami' && item.kamiType === 'amaterasu'), true, 'Confirming without a selection must keep the Kami in place');
}

{
  const state = stateWithKami(['ryujin', 'amaterasu', 'raijin', 'susanoo']);
  const [first, second] = state.players;
  state.temples[0].figures = [{ playerId: first.id, figureId: 'ryujin-worshipper' }];
  state.temples[1].figures = [{ playerId: second.id, figureId: 'new-komainu', monsterCardId: 'su-komainu' }];
  state.kamiResolutionActive = true;
  state.kamiResolutionIndex = 0;
  state.kamiResolutionStep = 'interactive';
  state.kamiResolutionCurrentPlayerId = first.id;
  state.kamiResolutionTemples = [
    { templeIndex: 0, kamiType: 'ryujin', winnerId: first.id, reward: '', forces: [{ playerId: first.id, count: 1 }] },
    { templeIndex: 1, kamiType: 'amaterasu', winnerId: first.id, reward: '', forces: [{ playerId: first.id, count: 1 }] },
  ];
  state.kamiVassalResolvedTempleIndexes = [0];
  state.kamiManifestedTempleIndexes = [0];

  const advanced = advanceKamiResolution(state);
  assert.equal(advanced.kamiResolutionCurrentPlayerId, second.id, 'A later Shrine must use figures placed during an earlier Kami reward');
  assert.deepEqual(advanced.kamiResolutionTemples[1].forces, [{ playerId: second.id, count: 2 }], 'Later Shrine forces must be rebuilt from the live board');
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
