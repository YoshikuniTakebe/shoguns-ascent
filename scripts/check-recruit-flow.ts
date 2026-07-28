import assert from 'node:assert/strict';
import {
  createInitialGameState,
  chooseMandateTile,
  chooseGenerosityRecipient,
  executeMandate,
  grantWarlordSummonCoin,
  jinmenjuPlaceFigure,
  recruitPlaceFigure,
  recruitPlaceTempleShinto,
  respondToGenerosity,
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
state.recruitSummonOccurred = false;

const afterFirstPlacement = recruitPlaceFigure(state, owner.id, 'kansai', 'bushi');
assert.equal(afterFirstPlacement.pendingSpringPlacement, null, 'Kenin must not interrupt Recruit after the first placement');
assert.equal(afterFirstPlacement.recruitSummonOccurred, true, 'Recruit must remember that its Summon event occurred');

const afterSecondPlacement = recruitPlaceFigure(afterFirstPlacement, owner.id, 'kansai', 'bushi');
assert.equal(afterSecondPlacement.pendingSpringPlacement, null, 'Kenin must wait until the complete Recruit action finishes');

const afterRecruitFinished = skipRecruitTurn(afterSecondPlacement);
assert.equal(afterRecruitFinished.pendingSpringPlacement?.type, 'kenin', 'Kenin must open after the player finishes Recruit');
assert.equal(afterRecruitFinished.pendingSpringPlacement?.ownerId, owner.id, 'The finished Recruit player must resolve Kenin');
assert.equal(
  (afterRecruitFinished.pendingSpringPlacementQueue || []).filter(entry => entry.type === 'kenin' && entry.ownerId === owner.id).length,
  0,
  'Multiple figures in one Recruit action must not queue additional Kenin activations',
);

const deferredWarlordState = createInitialGameState(
  [
    { name: 'Warlord', clanId: 'sol' },
    { name: 'Merchant', clanId: 'koi' },
  ],
  'hotseat',
);
const deferredWarlord = deferredWarlordState.players[0];
const deferredMerchant = deferredWarlordState.players[1];
deferredWarlord.seasonCards = [SEASON_CARDS_DATA.find(card => card.id === 'sp-path-of-the-warlord')!];
deferredMerchant.seasonCards = [SEASON_CARDS_DATA.find(card => card.id === 'su-way-of-the-merchant')!];
deferredWarlord.coins = 3;
deferredMerchant.coins = 0;
deferredWarlordState.provinces.kansai.figures = [
  { id: 'warlord-fortress', type: 'fortress', owner: deferredWarlord.id },
];
deferredWarlordState.recruitMandateActive = true;
deferredWarlordState.recruitResolutionOrder = [deferredWarlord.id];
deferredWarlordState.recruitResolutionIndex = 0;
deferredWarlordState.recruitMandateIssuerId = deferredWarlord.id;
deferredWarlordState.recruitPlacementsRemaining = 1;
deferredWarlordState.recruitPlacementsTotal = 1;
deferredWarlordState.recruitUsedFortressProvinces = [];
deferredWarlordState.recruitSummonOccurred = false;
const deferredWarlordPlacement = recruitPlaceFigure(deferredWarlordState, deferredWarlord.id, 'kansai', 'bushi');
assert.equal(
  deferredWarlordPlacement.players.find(player => player.id === deferredWarlord.id)?.coins,
  3,
  'Path of the Warlord must not pay on the first Recruit placement',
);
assert.equal(
  deferredWarlordPlacement.players.find(player => player.id === deferredMerchant.id)?.coins,
  0,
  'Way of the Merchant must not trigger before the Recruit player presses Finish',
);
const deferredWarlordFinished = skipRecruitTurn(deferredWarlordPlacement);
assert.equal(
  deferredWarlordFinished.players.find(player => player.id === deferredWarlord.id)?.coins,
  4,
  'Path of the Warlord must pay once when a non-empty Recruit turn is finished',
);
assert.equal(
  deferredWarlordFinished.players.find(player => player.id === deferredMerchant.id)?.coins,
  1,
  'Way of the Merchant must trigger from the deferred Warlord reward',
);
const warlordLogIndex = deferredWarlordFinished.log.findIndex(entry => entry.includes('Camino del Senor de la Guerra'));
const merchantLogIndex = deferredWarlordFinished.log.findIndex(entry => entry.includes('Via del Mercader'));
assert.ok(warlordLogIndex >= 0 && merchantLogIndex > warlordLogIndex, 'The Warlord log must precede the resulting Merchant log');

const emptyWarlordTurn = {
  ...deferredWarlordState,
  players: deferredWarlordState.players.map(player => ({ ...player })),
  recruitSummonOccurred: false,
  log: [...deferredWarlordState.log],
};
const emptyWarlordFinished = skipRecruitTurn(emptyWarlordTurn);
assert.equal(
  emptyWarlordFinished.players.find(player => player.id === deferredWarlord.id)?.coins,
  3,
  'Path of the Warlord must not pay when Recruit finishes without a placement',
);
assert.equal(
  emptyWarlordFinished.log.some(entry => entry.includes('Camino del Senor de la Guerra')),
  false,
  'An empty Recruit turn must not log Path of the Warlord',
);

const independentSummon = {
  ...state,
  recruitMandateActive: false,
  recruitWarlordCoinAwarded: false,
  pendingSpringPlacement: null,
  pendingSpringPlacementQueue: [],
};
const afterIndependentSummon = grantWarlordSummonCoin(independentSummon, owner.id);
assert.equal(afterIndependentSummon.pendingSpringPlacement?.type, 'kenin', 'An independent Summon must prepare Kenin immediately after that action');

const jinmenjuState = createInitialGameState(
  [
    { name: 'Jinmenju', clanId: 'sol' },
    { name: 'Issuer', clanId: 'koi' },
  ],
  'hotseat',
);
const jinmenjuOwner = jinmenjuState.players.find(player => player.name === 'Jinmenju')!;
const recruitIssuer = jinmenjuState.players.find(player => player.name === 'Issuer')!;
const jinmenjuCard = SEASON_CARDS_DATA.find(card => card.id === 'sp-jinmenju');
assert.ok(jinmenjuCard, 'Jinmenju must exist');
jinmenjuOwner.seasonCards = [jinmenjuCard];
jinmenjuState.provinces.kansai.figures = [
  { id: 'jinmenju-figure', type: 'monster', owner: jinmenjuOwner.id, monsterCardId: 'sp-jinmenju' },
];

const jinmenjuRecruit = executeMandate(jinmenjuState, 'recruit', recruitIssuer.id);
assert.equal(
  jinmenjuRecruit.recruitResolutionOrder[jinmenjuRecruit.recruitResolutionIndex],
  jinmenjuOwner.id,
  'A player with Jinmenju must receive a Recruit turn even without a Stronghold',
);
assert.deepEqual(
  jinmenjuRecruit.recruitJinmenjuProvinceIds?.[jinmenjuOwner.id],
  ['kansai'],
  'Recruit must remember where Jinmenju was at the start of the mandate',
);
assert.equal(
  jinmenjuPlaceFigure(jinmenjuRecruit, jinmenjuOwner.id, 'edo', 'bushi'),
  jinmenjuRecruit,
  'A non-Dragonfly clan cannot use Jinmenju in another Province',
);
const jinmenjuPlaced = jinmenjuPlaceFigure(jinmenjuRecruit, jinmenjuOwner.id, 'kansai', 'shinto');
assert.equal(
  jinmenjuPlaced.provinces.kansai.figures.filter(figure => figure.owner === jinmenjuOwner.id && figure.type === 'shinto').length,
  1,
  'Jinmenju must summon a Shinto as a normal figure in its Province',
);
assert.ok(jinmenjuPlaced.jinmenjuUsedByPlayerIds?.includes(jinmenjuOwner.id));

const summonedTooLate = {
  ...jinmenjuRecruit,
  jinmenjuUsedByPlayerIds: [],
  recruitJinmenjuProvinceIds: {},
};
assert.equal(
  jinmenjuPlaceFigure(summonedTooLate, jinmenjuOwner.id, 'kansai', 'bushi'),
  summonedTooLate,
  'Jinmenju summoned during the current Recruit must not enable its ability',
);

const dragonflyState = {
  ...jinmenjuRecruit,
  players: jinmenjuRecruit.players.map(player => player.id === jinmenjuOwner.id
    ? { ...player, clanId: 'libelula' as const }
    : player),
  jinmenjuUsedByPlayerIds: [],
};
const dragonflyPlaced = jinmenjuPlaceFigure(dragonflyState, jinmenjuOwner.id, 'edo', 'bushi');
assert.notEqual(dragonflyPlaced, dragonflyState, 'Dragonfly may redirect the Jinmenju Summon to any Province');

const stackedStrongholds = createInitialGameState(
  [
    { name: 'Strongholds', clanId: 'sol' },
    { name: 'Issuer', clanId: 'koi' },
  ],
  'hotseat',
);
const strongholdOwner = stackedStrongholds.players.find(player => player.name === 'Strongholds')!;
const strongholdIssuer = stackedStrongholds.players.find(player => player.name === 'Issuer')!;
stackedStrongholds.provinces.kansai.figures = [
  { id: 'fortress-1', type: 'fortress', owner: strongholdOwner.id },
  { id: 'fortress-2', type: 'fortress', owner: strongholdOwner.id },
];
const stackedRecruit = executeMandate(stackedStrongholds, 'recruit', strongholdIssuer.id);
const firstStackedPlacement = recruitPlaceFigure(stackedRecruit, strongholdOwner.id, 'kansai', 'bushi');
const secondStackedPlacement = recruitPlaceFigure(firstStackedPlacement, strongholdOwner.id, 'kansai', 'bushi');
assert.notEqual(secondStackedPlacement, firstStackedPlacement, 'Each Stronghold in one Province must allow one Recruit placement there');

const moonTempleState = createInitialGameState(
  [
    { name: 'Moon', clanId: 'luna' },
    { name: 'Issuer', clanId: 'koi' },
  ],
  'hotseat',
);
const moon = moonTempleState.players.find(player => player.name === 'Moon')!;
const moonIssuer = moonTempleState.players.find(player => player.name === 'Issuer')!;
moonTempleState.provinces.kansai.figures = [
  { id: 'moon-fortress', type: 'fortress', owner: moon.id },
  { id: 'moon-bushi-1', type: 'bushi', owner: moon.id },
  { id: 'moon-bushi-2', type: 'bushi', owner: moon.id },
];
const blockedMoonRecruit = executeMandate(moonTempleState, 'recruit', moonIssuer.id);
assert.equal(
  recruitPlaceTempleShinto(blockedMoonRecruit, moon.id, blockedMoonRecruit.temples[0].id),
  blockedMoonRecruit,
  'Moon cannot bypass its Province limit by sending a newly summoned Shinto directly to worship',
);
const legalMoonRecruit = {
  ...blockedMoonRecruit,
  provinces: {
    ...blockedMoonRecruit.provinces,
    kansai: {
      ...blockedMoonRecruit.provinces.kansai,
      figures: blockedMoonRecruit.provinces.kansai.figures.filter(figure => figure.id !== 'moon-bushi-2'),
    },
  },
};
assert.notEqual(
  recruitPlaceTempleShinto(legalMoonRecruit, moon.id, legalMoonRecruit.temples[0].id),
  legalMoonRecruit,
  'Moon may worship when a valid Summon Province exists',
);

const deferredShintoState = createInitialGameState(
  [
    { name: 'Deferred Shinto', clanId: 'sol' },
    { name: 'Issuer', clanId: 'koi' },
  ],
  'hotseat',
);
const deferredOwner = deferredShintoState.players[0];
const deferredIssuer = deferredShintoState.players[1];
deferredShintoState.provinces.shikoku.figures = [{ id: 'deferred-shikoku', type: 'fortress', owner: deferredOwner.id }];
deferredShintoState.provinces.kansai.figures = [{ id: 'deferred-kansai', type: 'fortress', owner: deferredOwner.id }];
deferredShintoState.provinces.oshu.figures = [{ id: 'deferred-oshu', type: 'fortress', owner: deferredOwner.id }];
const deferredRecruit = executeMandate(deferredShintoState, 'recruit', deferredIssuer.id);
const deferredFirst = recruitPlaceFigure(deferredRecruit, deferredOwner.id, 'shikoku', 'bushi');
const deferredPrayer = recruitPlaceTempleShinto(deferredFirst, deferredOwner.id, deferredFirst.temples[0].id);
assert.deepEqual(
  deferredPrayer.recruitUsedFortressProvinces,
  ['shikoku'],
  'A praying Shinto must not reserve an arbitrary Stronghold before later placements are chosen',
);
const deferredLast = recruitPlaceFigure(deferredPrayer, deferredOwner.id, 'oshu', 'bushi');
assert.notEqual(
  deferredLast,
  deferredPrayer,
  'A later Recruit placement must remain free to use any unassigned Stronghold',
);

const generosityState = createInitialGameState(
  [
    { name: 'Generous', clanId: 'sol' },
    { name: 'Recipient', clanId: 'koi' },
  ],
  'hotseat',
);
const [generousPlayer, generosityRecipient] = generosityState.players;
const generosityCard = SEASON_CARDS_DATA.find(card => card.id === 'sp-generosity');
assert.ok(generosityCard);
generousPlayer.seasonCards = [generosityCard];
generousPlayer.coins = 3;
generosityState.mandateChoicePhase = true;
generosityState.drawnMandates = ['recruit'];
const generosityRecruit = chooseMandateTile(generosityState, 'recruit', generousPlayer.id);
assert.equal(generosityRecruit.generosityPending?.stage, 'choose-recipient', 'Generosity must pause the new mandate flow');
const generosityOffered = chooseGenerosityRecipient(generosityRecruit, generousPlayer.id, generosityRecipient.id);
assert.equal(generosityOffered.generosityPending?.stage, 'awaiting-response', 'The flow must remain paused until the recipient responds');
const generosityAccepted = respondToGenerosity(generosityOffered, generosityRecipient.id, true);
assert.equal(generosityAccepted.generosityPending, null, 'The mandate may continue only after the recipient responds');
assert.equal(generosityAccepted.players.find(player => player.id === generousPlayer.id)?.coins, 2);
assert.equal(generosityAccepted.players.find(player => player.id === generosityRecipient.id)?.coins, generosityRecipient.coins + 1);

console.log('Recruit summon timing checks passed.');
