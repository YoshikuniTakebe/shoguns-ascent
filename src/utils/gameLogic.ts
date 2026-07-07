import type {
  GameState, Player, Province, Season, MandateType,
  Battle, Figure, Temple, WarProvinceSlot, SeasonCard,
  AllianceProposal, Hostage, DeckConfig, DeckName, KamiType,
  KamiResolutionTemple, KamiData, BattleResolutionData,
} from '../types/game';
import {
  CLANS, PROVINCES_DATA, HOME_PROVINCES, WAR_TACTICS,
  KAMI_DATA, SPRING_CARDS, SUMMER_CARDS, AUTUMN_CARDS,
  DECK_GROUPS, CLAN_INCOME, SEASON_CARDS_DATA,
} from '../types/game';

// Safe check for Vite's import.meta.env.DEV that works in both
// browser (Vite) and Node.js (tsx) environments.
const IS_DEV = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;

// ============================================================
// Utility Functions
// ============================================================

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function createFigure(type: Figure['type'], owner: string): Figure {
  return { type, owner, id: generateId() };
}

// ============================================================
// Deck Building
// ============================================================

export function buildSeasonDeck(
  seasonCards: SeasonCard[],
  deckConfig: { chosenDeck: DeckName; extraMonsters: 0 | 1 | 2 },
  playerClanIds: string[]
): SeasonCard[] {
  const chosenDeck: DeckName = deckConfig.chosenDeck;

  const result: SeasonCard[] = [];
  const hasDynastyInvasion = playerClanIds.some(id => id === 'sol' || id === 'luna');

  for (const card of seasonCards) {
    const cardGroups = card.group.split('/').map(g => g.trim());

    // Always include Core cards
    if (cardGroups.includes('Core')) {
      result.push(card);
      continue;
    }

    // Include Dynasty Invasion if Sol or Luna is playing
    if (cardGroups.includes('Dynasty Invasion')) {
      if (hasDynastyInvasion) {
        result.push(card);
      }
      continue;
    }

    // Skip Kickstarter/Monster Pack here (handled separately below)
    if (cardGroups.includes('Kickstarter Exclusive') || cardGroups.includes('Monster Pack')) {
      continue;
    }

    // Include if any of the card's groups matches the chosen deck
    if (cardGroups.some(g => g === chosenDeck)) {
      result.push(card);
    }
  }

  // Add random extra monsters from a combined Kickstarter Exclusive + Monster Pack pool
  if (deckConfig.extraMonsters > 0) {
    const addedIds = new Set(result.map(c => c.id));
    const combinedPool = seasonCards.filter(c => {
      const groups = c.group.split('/').map(g => g.trim());
      return (groups.includes('Kickstarter Exclusive') || groups.includes('Monster Pack')) && !addedIds.has(c.id);
    });
    const shuffled = shuffle(combinedPool);
    const count = Math.min(deckConfig.extraMonsters, shuffled.length);
    for (let i = 0; i < count; i++) {
      result.push(shuffled[i]);
    }
  }

  return result;
}

// ============================================================
// Game Initialization
// ============================================================

export function createInitialGameState(
  players: { name: string; clanId: string }[],
  mode: 'online' | 'hotseat',
  hostId?: string,
  deckConfig?: DeckConfig
): GameState {
  // Initialize provinces with empty figures
  const provinces: GameState['provinces'] = {};
  PROVINCES_DATA.forEach((p) => {
    provinces[p.id] = { ...p, figures: [] };
  });

  // Create players with initial state
  const gamePlayers: Player[] = players.map((p, idx) => {
    const clan = CLANS.find((c) => c.id === p.clanId)!;
    return {
      id: hostId && idx === 0 ? hostId : generateId(),
      name: p.name,
      clanId: p.clanId,
      coins: 0,
      ronin: 0,
      honor: clan.initialHonor,
      victoryPoints: 0,
      bushi: 6,
      shinto: 3,
      hasDaimyo: false,
      fortresses: 4,
      monsters: 0,
      seasonCards: [],
      warProvinceTokens: [],
      allies: [],
      hostages: [],
      isReady: false,
      allianceSeasons: 0,
    };
  });

  // Sort players by honor (lowest honor value = highest honor position = goes first)
  // This ensures players[0] is always the first player in seat order
  gamePlayers.sort((a, b) => a.honor - b.honor);

  // Place starting figures: 1 Daimyo + 1 Bushi + 1 Fortress in home province
  gamePlayers.forEach((player) => {
    const homeProvinceId = HOME_PROVINCES[player.clanId];
    if (homeProvinceId && provinces[homeProvinceId]) {
      provinces[homeProvinceId].figures.push(createFigure('daimyo', player.id));
      provinces[homeProvinceId].figures.push(createFigure('bushi', player.id));
      provinces[homeProvinceId].figures.push(createFigure('fortress', player.id));
      player.bushi -= 1;
      player.fortresses -= 1;
      // hasDaimyo = false means daimyo is on the board
    }
  });

  // Set up honor track (sorted by initial honor, lowest first)
  const honorTrack = [...gamePlayers]
    .sort((a, b) => a.honor - b.honor)
    .map((p) => p.id);

  // Create initial temples (4 kami types - manual selection or random)
  let selectedKamiData: KamiData[];
  if (deckConfig?.selectedKami && deckConfig.selectedKami.length === 4) {
    selectedKamiData = deckConfig.selectedKami.map(type => KAMI_DATA.find(k => k.type === type)!);
  } else {
    selectedKamiData = shuffle(KAMI_DATA).slice(0, 4);
  }
  const temples: Temple[] = selectedKamiData.map((kami, idx) => ({
    id: `temple-${idx}`,
    position: idx + 1,
    kamiType: kami.type,
    figures: [],
  }));

  // Prepare mandate deck
  const mandatesDeck = shuffleMandates();

  // Create turn order based on honor (lowest honor goes first = seating order)
  const turnOrder = [...gamePlayers]
    .sort((a, b) => a.honor - b.honor)
    .map((p) => p.id);

  // Build season decks from config
  const config: DeckConfig = deckConfig ?? { chosenDeck: 'random', extraMonsters: 0 };
  const playerClanIds = players.map(p => p.clanId);
  // Resolve 'random' deck choice once for the entire game (Issue 3 fix)
  const resolvedDeck: DeckName = config.chosenDeck === 'random'
    ? DECK_GROUPS[Math.floor(Math.random() * DECK_GROUPS.length)]
    : config.chosenDeck;
  const resolvedConfig = { chosenDeck: resolvedDeck, extraMonsters: config.extraMonsters };
  const springDeck = buildSeasonDeck(SPRING_CARDS, resolvedConfig, playerClanIds);
  const summerDeck = buildSeasonDeck(SUMMER_CARDS, resolvedConfig, playerClanIds);
  const autumnDeck = buildSeasonDeck(AUTUMN_CARDS, resolvedConfig, playerClanIds);

  const state: GameState = {
    id: generateId(),
    gameName: (() => {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      const words = ['origami','matcha','tanuki','kappa','oni','sushi','ramen','ainu','samurai','ninja','shogun','bushi','shinto','daimyo','katana','totoro','mononoke','akira'];
      const word = words[Math.floor(Math.random() * words.length)];
      return `${yy}${mm}${dd}${hh}${mi}${word}`;
    })(),
    mode,
    players: gamePlayers,
    provinces,
    temples,
    currentSeason: 'spring',
    currentPhase: 'seasonSetup',
    currentPlayerIndex: 0,
    mandatesThisTurn: [],
    mandatesDeck,
    drawnMandates: [],
    mandateChoicePhase: false,
    activeBattles: [],
    seasonCardsDeck: [...springDeck],
    springDeck,
    summerDeck,
    autumnDeck,
    activeDeckGroup: resolvedDeck,
    turnOrder,
    allianceProposals: [],
    politicsMandateCount: 0,
    maxMandates: 7,
    round: 1,
    maxRounds: 3,
    teaTurnIndex: 0,
    honorTrack,
    warProvinceSlots: [],
    trainMandateActive: false,
    trainResolutionOrder: [],
    trainResolutionIndex: 0,
    trainMandateIssuerId: null,
    marshalMandateActive: false,
    marshalResolutionOrder: [],
    marshalResolutionIndex: 0,
    marshalMandateIssuerId: null,
    marshalFortressBuiltBy: [],
    marshalMovedFigures: [],
    recruitMandateActive: false,
    recruitResolutionOrder: [],
    recruitResolutionIndex: 0,
    recruitMandateIssuerId: null,
    recruitPlacementsRemaining: 0,
    recruitUsedFortressProvinces: [],
    jinmenjuUsedThisMandate: false,
    betrayMandateActive: false,
    betraySelectionsRemaining: 0,
    betraySelectedOwners: [],
    betrayReplacements: [],
    betrayMandateIssuerId: null,
    harvestMandateActive: false,
    harvestResolutionOrder: [],
    harvestResolutionIndex: 0,
    harvestPlayerRewards: [],
    harvestPopupVisible: false,
    harvestCurrentPlayerId: null,
    harvestAllPlayersOrder: [],
    harvestCoinAcknowledged: false,
    kamiResolutionActive: false,
    kamiResolutionTemples: [],
    kamiResolutionIndex: 0,
    kamiResolutionStep: null,
    kamiResolutionCurrentPlayerId: null,
    kamiResolutionNextPlayerIndex: 0,
    fujinMovesRemaining: 0,
    raijinPlacementActive: false,
    ryujinBuyActive: false,
    zorroPlacementActive: false,
    zorroPlacementPlayerId: null,
    zorroPlacementsRemaining: 0,
    lastMandateIssuerId: null,
    gameOver: false,
    tradeOffers: [],
    teaReadyPlayers: [],
    teaOptedOut: [],
    kamiReadyPlayers: [],
    kamiSummaryVisible: false,
    kamiSummaryReadyPlayers: [],
    kamiSummaryData: [],
    warPhaseReadyPlayers: [],
    battlePopupReadyPlayers: [],
    warSummaryVisible: false,
    warSummaryReadyPlayers: [],
    battleResultReadyPlayers: [],
    coinDistributionReadyPlayers: [],
    hostageReturnActive: false,
    hostageReturnOrder: [],
    hostageReturnIndex: 0,
    hostageReturnReadyPlayers: [],
    cleanupTeaCeremonyReady: false,
    cleanupTeaCeremonyReadyPlayers: [],
    log: ['Juego iniciado! Estación: Primavera'],
    logHistory: {},
    hostId,
  };

  return state;
}

function shuffleMandates(): MandateType[] {
  return shuffle<MandateType>([
    'recruit', 'recruit',
    'marshal', 'marshal',
    'train', 'train',
    'harvest', 'harvest',
    'betray', 'betray',
  ]);
}

// ============================================================
// Season Setup
// ============================================================

export function setupSeason(state: GameState, season: Season): GameState {
  // Archive current season's log before transitioning
  const archivedHistory = { ...state.logHistory, [state.currentSeason]: [...state.log] };

  // Determine first player from turn order (static order set at game creation)
  const firstPlayerId = state.turnOrder[0];
  const firstPlayerIdx = state.players.findIndex(p => p.id === firstPlayerId);

  let newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, seasonCards: [...p.seasonCards], warProvinceTokens: [...p.warProvinceTokens], hostages: [...p.hostages], allies: [...p.allies] })),
    provinces: { ...state.provinces },
    warProvinceSlots: [] as WarProvinceSlot[],
    currentSeason: season,
    currentPhase: 'tea' as const,
    currentPlayerIndex: firstPlayerIdx >= 0 ? firstPlayerIdx : 0,
    teaTurnIndex: 0,
    teaReadyPlayers: [],
    logHistory: archivedHistory,
    log: [`Preparación de Estación: ${({ spring: 'Primavera', summer: 'Verano', autumn: 'Otoño', winter: 'Invierno' } as Record<string, string>)[season] || season}`],
  };

  // Place war province tokens (numPlayers + 2) on random provinces
  const numTokens = newState.players.length + 2;
  const provinceIds = Object.keys(newState.provinces);
  const selectedProvinces = shuffle(provinceIds).slice(0, Math.min(numTokens, provinceIds.length));
  const warSlots: WarProvinceSlot[] = selectedProvinces.map((pid, idx) => ({
    provinceId: pid,
    number: idx + 1,
    season,
  }));
  newState.warProvinceSlots = warSlots;

  // Set season cards for current season from pre-built decks
  switch (season) {
    case 'spring':
      newState.seasonCardsDeck = [...newState.springDeck];
      break;
    case 'summer':
      newState.seasonCardsDeck = [...newState.summerDeck];
      break;
    case 'autumn':
      newState.seasonCardsDeck = [...newState.autumnDeck];
      break;
  }

  // Calculate and distribute seasonal income
  newState = distributeSeasonalIncome(newState);

  // Return hostages (gain 1 coin per hostage returned)
  newState = returnHostages(newState);

  // Break all alliances for tea ceremony
  newState = breakAllAlliances(newState);

  // Reset tea opt-outs for the new season
  newState.teaOptedOut = [];

  newState.log = [...newState.log, `Fichas de guerra colocadas en ${selectedProvinces.length} provincias`, 'Comienza la Fase de Ceremonia del Té'];

  return newState;
}

function distributeSeasonalIncome(state: GameState): GameState {
  const newState = { ...state, players: state.players.map((p) => ({ ...p })) };
  newState.players.forEach((player) => {
    const income = getSeasonalIncome(newState, player.id);
    player.coins += income;
  });
  return newState;
}

export function getSeasonalIncome(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 1;
  return CLAN_INCOME[player.clanId] ?? 1;
}

function returnHostages(state: GameState): GameState {
  const newState = { ...state, players: state.players.map((p) => ({ ...p, hostages: [...p.hostages] })), log: [...state.log] };
  newState.players.forEach((player) => {
    if (player.hostages.length > 0) {
      player.coins += player.hostages.length;
      // Group hostages by their original owner (fromClanId = player ID)
      const hostagesByOwner: Record<string, number> = {};
      player.hostages.forEach((h) => {
        hostagesByOwner[h.fromClanId] = (hostagesByOwner[h.fromClanId] || 0) + 1;
      });
      Object.entries(hostagesByOwner).forEach(([ownerId, count]) => {
        const targetPlayer = newState.players.find((p) => p.id === ownerId);
        const targetName = targetPlayer ? targetPlayer.name : ownerId;
        newState.log = [...newState.log, `${player.name} devuelve ${count} rehén(es) a ${targetName}, gana ${count} moneda(s)`];
      });
      player.hostages = [];
    }
  });
  return newState;
}

// ============================================================
// Tea Ceremony (Alliance Phase)
// ============================================================

export function breakAllAlliances(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, allies: [] })),
    allianceProposals: [],
    log: [...state.log, 'Todas las alianzas rotas para la Ceremonia del Té'],
  };
  return newState;
}

export function proposeAlliance(state: GameState, fromId: string, toId: string, bribeAmount: number = 0, requestAmount: number = 0): GameState {
  const newState = { ...state, allianceProposals: [...state.allianceProposals], log: [...state.log] };
  const from = newState.players.find((p) => p.id === fromId);
  const to = newState.players.find((p) => p.id === toId);
  if (!from || !to) return state;

  // Cannot propose if either already has an ally
  if (from.allies.length > 0 || to.allies.length > 0) return state;

  // Check if fromId already proposed to toId (exact duplicate)
  const duplicateProposal = newState.allianceProposals.find(
    (ap) => ap.from === fromId && ap.to === toId
  );
  if (duplicateProposal) return state;

  // Cap bribe amount to proposer's actual coins
  const effectiveBribe = Math.min(bribeAmount, from.coins);
  // Cap request amount to target's actual coins
  const effectiveRequest = Math.min(requestAmount, to.coins);

  // If the target already proposed to us, auto-accept that proposal instead
  const reverseProposal = newState.allianceProposals.find(
    (ap) => ap.from === toId && ap.to === fromId
  );
  if (reverseProposal) {
    // Treat this as accepting the existing proposal from toId to fromId
    let resultState = acceptAlliance(state, toId, fromId);
    // Also transfer the counter-proposer's bribe (fromId -> toId)
    if (effectiveBribe > 0) {
      const counterProposer = resultState.players.find((p) => p.id === fromId);
      const counterTarget = resultState.players.find((p) => p.id === toId);
      if (counterProposer && counterTarget) {
        const actualBribe = Math.min(effectiveBribe, counterProposer.coins);
        if (actualBribe > 0) {
          const updatedPlayers = resultState.players.map((p) => {
            if (p.id === fromId) return { ...p, coins: p.coins - actualBribe };
            if (p.id === toId) return { ...p, coins: p.coins + actualBribe };
            return p;
          });
          resultState = {
            ...resultState,
            players: updatedPlayers,
            log: [...resultState.log, `${counterTarget.name} recibe ${actualBribe} monedas de soborno de ${counterProposer.name}`],
          };
        }
      }
    }
    // Handle request in reverse-proposal case: target (toId) pays requestAmount to proposer (fromId)
    if (effectiveRequest > 0) {
      const requester = resultState.players.find((p) => p.id === fromId);
      const payer = resultState.players.find((p) => p.id === toId);
      if (requester && payer) {
        const actualRequest = Math.min(effectiveRequest, payer.coins);
        if (actualRequest > 0) {
          const updatedPlayers = resultState.players.map((p) => {
            if (p.id === toId) return { ...p, coins: p.coins - actualRequest };
            if (p.id === fromId) return { ...p, coins: p.coins + actualRequest };
            return p;
          });
          resultState = {
            ...resultState,
            players: updatedPlayers,
            log: [...resultState.log, `${requester.name} recibe ${actualRequest} monedas de peticion de ${payer.name}`],
          };
        }
      }
    }
    return resultState;
  }

  const proposal: AllianceProposal = { from: fromId, to: toId, bribeAmount: effectiveBribe > 0 ? effectiveBribe : undefined, requestAmount: effectiveRequest > 0 ? effectiveRequest : undefined };
  newState.allianceProposals.push(proposal);
  if (effectiveBribe > 0) {
    newState.log = [...newState.log, `${from.name} propone alianza a ${to.name} ofreciendo ${effectiveBribe} monedas`];
  } else if (effectiveRequest > 0) {
    newState.log = [...newState.log, `${from.name} propone alianza a ${to.name} pidiendo ${effectiveRequest} monedas`];
  } else {
    newState.log = [...newState.log, `${from.name} propone alianza a ${to.name}`];
  }
  return newState;
}

export function acceptAlliance(state: GameState, fromId: string, toId: string): GameState {
  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, allies: [...p.allies] })),
    allianceProposals: [...state.allianceProposals],
    log: [...state.log],
  };
  const from = newState.players.find((p) => p.id === fromId)!;
  const to = newState.players.find((p) => p.id === toId)!;
  if (!from || !to) return state;

  // Each player can have exactly 1 ally (pair system)
  if (from.allies.length > 0 || to.allies.length > 0) return state;

  // Find the proposal to get the bribe amount
  const proposal = newState.allianceProposals.find(
    (ap) => ap.from === fromId && ap.to === toId
  );
  const bribeAmount = proposal?.bribeAmount || 0;
  const requestAmount = proposal?.requestAmount || 0;

  // Transfer bribe coins from proposer to accepter
  if (bribeAmount > 0) {
    const actualBribe = Math.min(bribeAmount, from.coins);
    if (actualBribe > 0) {
      from.coins -= actualBribe;
      to.coins += actualBribe;
      newState.log = [...newState.log, `${to.name} recibe ${actualBribe} monedas de soborno de ${from.name}`];
    }
  }

  // Transfer request coins from accepter (to) to proposer (from)
  if (requestAmount > 0) {
    const actualRequest = Math.min(requestAmount, to.coins);
    if (actualRequest > 0) {
      to.coins -= actualRequest;
      from.coins += actualRequest;
      newState.log = [...newState.log, `${from.name} recibe ${actualRequest} monedas de peticion de ${to.name}`];
    }
  }

  from.allies = [toId];
  to.allies = [fromId];
  // Remove the accepted proposal and any other proposals involving either player
  newState.allianceProposals = newState.allianceProposals.filter(
    (ap) => ap.from !== fromId && ap.to !== fromId && ap.from !== toId && ap.to !== toId
  );
  newState.log = [...newState.log, `${from.name} y ${to.name} forman una alianza!`];
  return newState;
}

// ============================================================
// Politics Phase
// ============================================================

// Pattern: 3 mandates, kami turn, 2 mandates, kami turn, 2 mandates, kami turn
function isKamiTurn(mandateCount: number): boolean {
  // After mandates 3, 5, 7 => kami turns
  return mandateCount === 3 || mandateCount === 5 || mandateCount === 7;
}

export function drawMandateTiles(state: GameState): GameState {
  const newState: GameState = { ...state, mandatesDeck: [...state.mandatesDeck], drawnMandates: [] as MandateType[], log: [...state.log] };

  // If deck is too small, reshuffle
  if (newState.mandatesDeck.length < 4) {
    newState.mandatesDeck = shuffleMandates();
    newState.log = [...newState.log, 'Mazo de mandatos barajado'];
  }

  // Draw 4 political order tiles
  const drawn: MandateType[] = [];
  for (let i = 0; i < 4 && newState.mandatesDeck.length > 0; i++) {
    drawn.push(newState.mandatesDeck.shift()!);
  }
  newState.drawnMandates = drawn;
  newState.mandateChoicePhase = true;
  return newState;
}

export function chooseMandateTile(state: GameState, mandate: MandateType, playerId: string): GameState {
  let newState: GameState = { ...state, mandatesDeck: [...state.mandatesDeck], drawnMandates: [...state.drawnMandates] };

  const player = state.players.find((p) => p.id === playerId);
  const isLoto = player?.clanId === 'loto';

  const chosenIdx = newState.drawnMandates.indexOf(mandate);
  if (chosenIdx === -1) return state;

  // Loto clan two-step flow: first click discards the tile, then player picks actual mandate
  if (isLoto && !state.lotoChoicePhase) {
    // Step 1: Discard the clicked tile from the deck (secretly removed)
    newState.drawnMandates.splice(chosenIdx, 1);
    // Return remaining 3 tiles back to the deck
    newState.mandatesDeck = [...newState.drawnMandates, ...newState.mandatesDeck];
    newState.drawnMandates = [];
    newState.mandateChoicePhase = false;
    newState.lotoChoicePhase = true;
    newState.lotoDiscardedMandate = mandate;
    return newState;
  }

  // Remove chosen mandate from drawn tiles
  newState.drawnMandates.splice(chosenIdx, 1);
  // Return remaining mandates to deck (face down)
  newState.mandatesDeck = [...newState.drawnMandates, ...newState.mandatesDeck];
  newState.drawnMandates = [];
  newState.mandateChoicePhase = false;

  // Track who played the last mandate turn (for next season politics turn order)
  newState.lastMandateIssuerId = playerId;

  // Execute the mandate
  newState = executeMandate(newState, mandate, playerId);
  return newState;
}

export function lotoChooseActualMandate(state: GameState, mandate: MandateType, playerId: string): GameState {
  let newState: GameState = {
    ...state,
    lotoChoicePhase: false,
    lotoDiscardedMandate: null,
    lastMandateIssuerId: playerId,
  };
  newState = executeMandate(newState, mandate, playerId);
  return newState;
}

export function executeMandate(state: GameState, mandate: MandateType, playerId: string): GameState {
  const issuingPlayer = state.players.find((p) => p.id === playerId);
  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, allies: [...p.allies], seasonCards: [...p.seasonCards] })),
    provinces: { ...state.provinces },
    mandatesThisTurn: [...state.mandatesThisTurn, { type: mandate, issuer: playerId, executed: false, hidden: issuingPlayer?.clanId === 'loto' }],
    log: [...state.log],
  };
  const player = newState.players.find((p) => p.id === playerId);
  if (!player) return state;

  newState.log = [...newState.log, `${player.name} emite mandato ${mandate.toUpperCase()}`];

  switch (mandate) {
    case 'recruit':
      return executeRecruit(newState, playerId);
    case 'marshal':
      return executeMarshal(newState, playerId);
    case 'train':
      return executeTrain(newState, playerId);
    case 'harvest':
      return executeHarvest(newState, playerId);
    case 'betray':
      return executeBetray(newState, playerId);
    default:
      return newState;
  }
}

// Get resolution order: starting from left of the issuer (in turn order)
function getResolutionOrder(state: GameState, issuerId: string): string[] {
  const issuerIdx = state.turnOrder.indexOf(issuerId);
  if (issuerIdx === -1) return state.turnOrder;
  const order: string[] = [];
  for (let i = 1; i <= state.turnOrder.length; i++) {
    order.push(state.turnOrder[(issuerIdx + i) % state.turnOrder.length]);
  }
  return order;
}

function isIssuerOrAlly(state: GameState, playerId: string, issuerId: string): boolean {
  if (playerId === issuerId) return true;
  const issuer = state.players.find((p) => p.id === issuerId);
  return issuer?.allies.includes(playerId) ?? false;
}

// ============================================================
// Mandate Implementations
// ============================================================

function executeRecruit(state: GameState, issuerId: string): GameState {
  // Recruit: each player may summon figures from reserve to provinces with their fortresses.
  // Resolution order: next player after issuer clockwise, issuer goes last.
  const resolutionOrder = getResolutionOrder(state, issuerId);
  const issuer = state.players.find((p) => p.id === issuerId);

  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    recruitMandateActive: true,
    recruitResolutionOrder: resolutionOrder,
    recruitResolutionIndex: 0,
    recruitMandateIssuerId: issuerId,
    recruitPlacementsRemaining: 0,
    recruitUsedFortressProvinces: [],
    jinmenjuUsedThisMandate: false,
    log: [...state.log, `Mandato de Reclutar emitido por ${issuer?.name ?? 'Jugador'} - todos los jugadores pueden invocar figuras en sus fortalezas. Emisor y aliado obtienen +1 colocación extra.`],
  };

  // Use advanceRecruitResolution to set up the first player (auto-skips if 0 placements)
  return advanceRecruitResolution(newState);
}

/**
 * Calculate how many figures a player can place during their recruit turn.
 * Counts fortress figures on the map (per province) + 1 bonus if issuer/ally.
 */
function calculateRecruitPlacements(state: GameState, playerId: string, issuerId: string): number {
  let totalFortresses = 0;
  for (const prov of Object.values(state.provinces)) {
    totalFortresses += prov.figures.filter(f => f.owner === playerId && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju'))).length;
  }
  const bonus = isIssuerOrAlly(state, playerId, issuerId) ? 1 : 0;
  return totalFortresses + bonus;
}

/**
 * Place a figure during the recruit mandate.
 * Player chooses bushi or shinto, and a province (must have their fortress, or ANY if Dragonfly).
 */
export function recruitPlaceFigure(state: GameState, playerId: string, provinceId: string, figureType: 'bushi' | 'shinto' | 'monster'): GameState {
  if (!state.recruitMandateActive) return state;
  if (state.recruitPlacementsRemaining <= 0) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  // Check reserve
  if (figureType === 'bushi' && player.bushi <= 0) return state;
  if (figureType === 'shinto' && player.shinto <= 0) return state;
  // Monsters don't come from reserve - they come from purchased cards

  const province = state.provinces[provinceId];
  if (!province) return state;

  // Validate province: must have player's fortress, UNLESS player is Dragonfly (libelula)
  const isDragonfly = player.clanId === 'libelula';
  if (!isDragonfly) {
    const hasFortress = province.figures.some(f => f.owner === playerId && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju')));
    if (!hasFortress) return state;
  }

  // Luna clan power: max 2 figures per province (excluding fortresses)
  if (player.clanId === 'luna' && (figureType === 'bushi' || figureType === 'shinto' || figureType === 'monster')) {
    const lunaFiguresInProvince = province.figures.filter(
      (f) => f.owner === playerId && f.type !== 'fortress'
    ).length;
    if (lunaFiguresInProvince >= 2) return state;
  }

  // For bushi (and monster) placements, enforce one-per-fortress-province rule.
  // Shinto placements do NOT consume a fortress slot (they go to temples or provinces freely).
  // Rule: each fortress province can be used once for a "base" bushi/monster placement.
  // If the player is issuer/ally, they get +1 bonus that can go to ANY fortress province (even one already used).
  if (figureType === 'bushi' || figureType === 'monster') {
    const usedProvinces = state.recruitUsedFortressProvinces;
    const timesProvinceUsed = usedProvinces.filter(p => p === provinceId).length;

    if (timesProvinceUsed === 0) {
      // First bushi/monster in this province - always allowed (base placement)
    } else {
      // Province already used for a base placement - only allow if bonus is available.
      // Bonus is available when: player is issuer/ally AND only one bonus placement is allowed.
      const isBonus = state.recruitMandateIssuerId ? isIssuerOrAlly(state, playerId, state.recruitMandateIssuerId) : false;

      if (!isBonus) {
        // Not issuer/ally - cannot reuse a province
        return state;
      }

      // Count how many provinces have been used more than once (bonus uses)
      const bonusUsesConsumed = usedProvinces.length - new Set(usedProvinces).size;
      if (bonusUsesConsumed >= 1) {
        // Bonus already consumed on another duplicate - block
        return state;
      }
    }
  }

  const newState: GameState = {
    ...state,
    provinces: { ...state.provinces },
    players: state.players.map((p) => ({ ...p })),
    recruitPlacementsRemaining: state.recruitPlacementsRemaining - 1,
    recruitUsedFortressProvinces: (figureType === 'bushi' || figureType === 'monster')
      ? [...state.recruitUsedFortressProvinces, provinceId]
      : [...state.recruitUsedFortressProvinces],
    log: [...state.log, `${player.name} invoca un ${figureType} en ${province.name}`],
  };

  // Place figure
  const prov = newState.provinces[provinceId];
  newState.provinces[provinceId] = { ...prov, figures: [...prov.figures, createFigure(figureType, playerId)] };

  // Decrement reserve
  const updatedPlayer = newState.players.find((p) => p.id === playerId)!;
  if (figureType === 'bushi') {
    updatedPlayer.bushi -= 1;
  } else if (figureType === 'shinto') {
    updatedPlayer.shinto -= 1;
  }
  // Monsters don't decrement a reserve

  return newState;
}

/**
 * Skip the current Recruit mandate turn (end the current player's recruit turn).
 * Advances to the next player in the recruit resolution order,
 * or clears the recruit state if all players have had their turn.
 */
export function skipRecruitTurn(state: GameState): GameState {
  if (!state.recruitMandateActive) return state;
  const newState: GameState = {
    ...state,
    recruitResolutionIndex: state.recruitResolutionIndex + 1,
  };
  return advanceRecruitResolution(newState);
}

/**
 * Advance to the next player in the recruit resolution order.
 * If all players have had their turn, clear the recruit state.
 */
function advanceRecruitResolution(state: GameState): GameState {
  if (state.recruitResolutionIndex >= state.recruitResolutionOrder.length) {
    // All players have had their turn - clear recruit mandate
    return {
      ...state,
      recruitMandateActive: false,
      recruitResolutionOrder: [],
      recruitResolutionIndex: 0,
      recruitMandateIssuerId: null,
      recruitPlacementsRemaining: 0,
      recruitUsedFortressProvinces: [],
      log: [...state.log, 'Mandato de Reclutar resuelto'],
    };
  }
  // Set currentPlayerIndex to the next player in resolution order and calculate their placements
  const nextPlayerId = state.recruitResolutionOrder[state.recruitResolutionIndex];
  const nextPlayerIdx = state.players.findIndex(p => p.id === nextPlayerId);
  const placements = calculateRecruitPlacements(state, nextPlayerId, state.recruitMandateIssuerId!);

  // Auto-skip players with 0 placements
  if (placements <= 0) {
    const skippedState: GameState = {
      ...state,
      recruitResolutionIndex: state.recruitResolutionIndex + 1,
      log: [...state.log, `${state.players[nextPlayerIdx]?.name ?? 'Jugador'} no tiene colocaciones disponibles - saltado`],
    };
    return advanceRecruitResolution(skippedState);
  }

  if (nextPlayerIdx >= 0) {
    return { ...state, currentPlayerIndex: nextPlayerIdx, recruitPlacementsRemaining: placements, recruitUsedFortressProvinces: [] };
  }
  return state;
}

function executeMarshal(state: GameState, issuerId: string): GameState {
  // Marshal: Each player may move figures. Issuer+ally may also build a fortress (3 coins) in any province.
  // Resolution order: starting from NEXT player after issuer (clockwise by seating/turnOrder).
  const resolutionOrder = getResolutionOrder(state, issuerId);
  const issuer = state.players.find((p) => p.id === issuerId);
  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    marshalMandateActive: true,
    marshalResolutionOrder: resolutionOrder,
    marshalResolutionIndex: 0,
    marshalMandateIssuerId: issuerId,
    marshalFortressBuiltBy: [],
    marshalMovedFigures: [],
    log: [...state.log, `Mandato de Movilizar emitido por ${issuer?.name ?? 'Jugador'} - todos los jugadores pueden mover figuras. Emisor y aliado pueden construir una fortaleza (3 monedas).`],
  };
  // Set currentPlayerIndex to the first player in resolution order
  const firstPlayerId = resolutionOrder[0];
  const firstPlayerIdx = newState.players.findIndex(p => p.id === firstPlayerId);
  if (firstPlayerIdx >= 0) {
    newState.currentPlayerIndex = firstPlayerIdx;
  }
  return newState;
}

function executeTrain(state: GameState, issuerId: string): GameState {
  // Train: All players may buy 1 season card from the market by paying its cost
  // Bonus: issuer and ally get -1 cost discount when buying
  // Resolution order: issuer goes FIRST, then clockwise by seating (players array order)
  const issuerIdx = state.players.findIndex(p => p.id === issuerId);
  const resolutionOrder: string[] = [issuerId];
  for (let i = 1; i < state.players.length; i++) {
    resolutionOrder.push(state.players[(issuerIdx + i) % state.players.length].id);
  }
  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    trainMandateActive: true,
    trainResolutionOrder: resolutionOrder,
    trainResolutionIndex: 0,
    trainMandateIssuerId: issuerId,
    log: [...state.log, 'Mandato de Entrenar emitido - todos los jugadores pueden comprar 1 carta de estación del mercado. Emisor y aliado obtienen descuento de -1.'],
  };
  // Set currentPlayerIndex to the issuer (first in resolution order)
  const firstPlayerId = resolutionOrder[0];
  const firstPlayerIdx = newState.players.findIndex(p => p.id === firstPlayerId);
  if (firstPlayerIdx >= 0) {
    newState.currentPlayerIndex = firstPlayerIdx;
  }
  return newState;
}

export function buySeasonCard(state: GameState, playerId: string, cardId: string): GameState {
  // Can only buy during politics phase when Train mandate is active
  if (!state.trainMandateActive || state.currentPhase !== 'politics') return state;

  const card = state.seasonCardsDeck.find((c) => c.id === cardId);
  if (!card) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  // Enforce purchase restrictions for monsters
  if (card.cardType === 'monster') {
    const cardGroups = card.group.split('/').map(g => g.trim());
    const isDynastyInvasion = cardGroups.includes('Dynasty Invasion');
    const isSolOrLuna = player.clanId === 'sol' || player.clanId === 'luna';

    if (isSolOrLuna && !isDynastyInvasion) {
      // Sol/Luna can only buy Dynasty Invasion monsters
      return state;
    }
    if (!isSolOrLuna && isDynastyInvasion) {
      // Non-Sol/Luna cannot buy Dynasty Invasion monsters
      return state;
    }
  }

  // Apply -1 discount for issuer and ally
  const isDiscounted = state.trainMandateIssuerId
    ? isIssuerOrAlly(state, playerId, state.trainMandateIssuerId)
    : false;

  // Bonsai clan power: max cost is 1 coin (applied BEFORE issuer discount)
  let baseCost = card.cost;
  if (player.clanId === 'bonsai' && baseCost >= 2) {
    baseCost = 1;
  }
  const effectiveCost = Math.max(0, baseCost - (isDiscounted ? 1 : 0));

  // Check if player can afford the card (with discount applied)
  if (player.coins < effectiveCost) return state;

  const newState: GameState = {
    ...state,
    players: state.players.map((p) => {
      if (p.id === playerId) {
        return {
          ...p,
          coins: p.coins - effectiveCost,
          seasonCards: [...p.seasonCards, card],
        };
      }
      return { ...p };
    }),
    seasonCardsDeck: state.seasonCardsDeck.filter((c) => c.id !== cardId),
    log: [...state.log, `${player.name} compra ${card.name} por ${effectiveCost} monedas${isDiscounted ? ' (con descuento)' : ''}`],
  };

  if (IS_DEV) {
    console.log('[buySeasonCard]', { playerId, cardId, cardName: card.name, newSeasonCards: newState.players.find(p => p.id === playerId)?.seasonCards.map(c => c.id) });
  }

  return newState;
}

/**
 * Buy a season card for the Ryujin kami reward. Full cost, no issuer discount.
 * Bonsai clan power still applies.
 */
export function ryujinBuyCard(state: GameState, playerId: string, cardId: string): GameState {
  const card = state.seasonCardsDeck.find((c) => c.id === cardId);
  if (!card) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  // Enforce purchase restrictions for monsters
  if (card.cardType === 'monster') {
    const cardGroups = card.group.split('/').map(g => g.trim());
    const isDynastyInvasion = cardGroups.includes('Dynasty Invasion');
    const isSolOrLuna = player.clanId === 'sol' || player.clanId === 'luna';
    if (isSolOrLuna && !isDynastyInvasion) return state;
    if (!isSolOrLuna && isDynastyInvasion) return state;
  }

  // Bonsai clan power: max cost is 1 coin
  let baseCost = card.cost;
  if (player.clanId === 'bonsai' && baseCost >= 2) {
    baseCost = 1;
  }
  const effectiveCost = baseCost;

  if (player.coins < effectiveCost) return state;

  const newState: GameState = {
    ...state,
    players: state.players.map((p) => {
      if (p.id === playerId) {
        return {
          ...p,
          coins: p.coins - effectiveCost,
          seasonCards: [...p.seasonCards, card],
        };
      }
      return { ...p };
    }),
    seasonCardsDeck: state.seasonCardsDeck.filter((c) => c.id !== cardId),
    log: [...state.log, `${player.name} compra ${card.name} por ${effectiveCost} monedas (Ryujin)`],
  };

  return newState;
}

function executeHarvest(state: GameState, issuerId: string): GameState {
  const newState: GameState = { ...state, players: state.players.map((p) => ({ ...p })), log: [...state.log] };

  // ALL players receive +1 coin when harvest is executed
  newState.players.forEach((p) => {
    p.coins += 1;
  });
  newState.log = [...newState.log, `Cosecha: todos los jugadores reciben +1 moneda`];

  // Only the issuer and their ally harvest from provinces where they have majority force
  const issuer = newState.players.find((p) => p.id === issuerId);
  if (!issuer) return newState;

  const harvesters = [issuerId, ...(issuer.allies || [])];

  // Compute all rewards per player without immediately granting them
  const harvestPlayerRewards: { playerId: string; provinceId: string; rewards: { vp?: number; coins?: number; ronin?: number; honor?: number } }[] = [];

  // For each province, check if a harvester has majority force there
  Object.values(newState.provinces).forEach((province) => {
    // Determine who has the most force in this province (considering all players)
    let maxForce = 0;
    let strongestId: string | null = null;
    let tied = false;

    newState.players.forEach((player) => {
      const force = calculateForce(province, player.id, newState);
      if (force > maxForce) {
        maxForce = force;
        strongestId = player.id;
        tied = false;
      } else if (force === maxForce && force > 0) {
        tied = true;
      }
    });

    // Ties broken by honor (lower index = higher honor = wins tiebreaker)
    if (tied && maxForce > 0) {
      const tiedPlayers = newState.players.filter(
        (p) => calculateForce(province, p.id, newState) === maxForce
      );
      strongestId = tiedPlayers.sort((a, b) => {
        const aIdx = newState.honorTrack.indexOf(a.id);
        const bIdx = newState.honorTrack.indexOf(b.id);
        return aIdx - bIdx; // Lower index = higher honor = wins
      })[0]?.id ?? null;

      // Sol clan power: bonus on honor tiebreak win
      if (strongestId) {
        const losers = tiedPlayers.filter((p) => p.id !== strongestId).map((p) => p.id);
        applySolTiebreakBonus(newState, strongestId, losers);
      }
    }

    // Only grant the reward if the strongest player is one of the harvesters (issuer or ally)
    // and the province has at least one non-zero reward value
    if (strongestId && maxForce > 0 && harvesters.includes(strongestId)) {
      const rewards = province.harvestRewards;
      const hasReward = (rewards.vp && rewards.vp > 0) || (rewards.coins && rewards.coins > 0) || (rewards.ronin && rewards.ronin > 0) || (rewards.honor && rewards.honor > 0);
      if (hasReward) {
        harvestPlayerRewards.push({
          playerId: strongestId,
          provinceId: province.id,
          rewards: { ...rewards },
        });
      }
    }
  });

  // Kotahi special ability: if a player owns a monster with monsterCardId 'sp-kotahi' in a province
  // and has majority there but is NOT a harvester, they also receive the harvest reward
  Object.values(newState.provinces).forEach((province) => {
    // Check if any figure with monsterCardId 'sp-kotahi' exists in this province
    const kotahiFigure = province.figures.find(f => f.type === 'monster' && f.monsterCardId === 'sp-kotahi');
    if (!kotahiFigure) return;

    const kotahiOwnerId = kotahiFigure.owner;

    // Skip if the owner is already a harvester (they already got rewards from the main pass)
    if (harvesters.includes(kotahiOwnerId)) return;

    // Check if the Kotahi owner already has a reward entry for this province (avoid double-add)
    if (harvestPlayerRewards.some(r => r.playerId === kotahiOwnerId && r.provinceId === province.id)) return;

    // Calculate majority using the same logic as the main harvest
    let maxForce = 0;
    let strongestId: string | null = null;
    let tied = false;

    newState.players.forEach((player) => {
      const force = calculateForce(province, player.id, newState);
      if (force > maxForce) {
        maxForce = force;
        strongestId = player.id;
        tied = false;
      } else if (force === maxForce && force > 0) {
        tied = true;
      }
    });

    // Ties broken by honor (lower index = higher honor = wins tiebreaker)
    if (tied && maxForce > 0) {
      const tiedPlayers = newState.players.filter(
        (p) => calculateForce(province, p.id, newState) === maxForce
      );
      strongestId = tiedPlayers.sort((a, b) => {
        const aIdx = newState.honorTrack.indexOf(a.id);
        const bIdx = newState.honorTrack.indexOf(b.id);
        return aIdx - bIdx;
      })[0]?.id ?? null;

      // Sol clan power: bonus on honor tiebreak win
      if (strongestId) {
        const losers = tiedPlayers.filter((p) => p.id !== strongestId).map((p) => p.id);
        applySolTiebreakBonus(newState, strongestId, losers);
      }
    }

    // Only grant if the Kotahi owner has majority
    if (strongestId !== kotahiOwnerId || maxForce <= 0) return;

    const rewards = province.harvestRewards;
    const hasReward = (rewards.vp && rewards.vp > 0) || (rewards.coins && rewards.coins > 0) || (rewards.ronin && rewards.ronin > 0) || (rewards.honor && rewards.honor > 0);
    if (hasReward) {
      harvestPlayerRewards.push({
        playerId: kotahiOwnerId,
        provinceId: province.id,
        rewards: { ...rewards },
      });
    }
  });

  // Reorder province rewards grouped by player in seat/turn order
  const orderedRewards: typeof harvestPlayerRewards = [];
  for (const playerId of newState.turnOrder) {
    const playerRewards = harvestPlayerRewards.filter(r => r.playerId === playerId);
    orderedRewards.push(...playerRewards);
  }
  // Add any rewards for players not in turnOrder (edge case)
  const inTurnOrder = new Set(newState.turnOrder);
  const remaining = harvestPlayerRewards.filter(r => !inTurnOrder.has(r.playerId));
  orderedRewards.push(...remaining);

  // In online mode: ALWAYS set up interactive flow for ALL players so each sees the +1 coin popup.
  // In hotseat mode: only set up the flow if there are province rewards (coin popup is shown locally).
  if (newState.mode === 'online') {
    newState.harvestMandateActive = true;
    newState.harvestResolutionOrder = orderedRewards.map(r => r.playerId);
    newState.harvestResolutionIndex = 0;
    newState.harvestPlayerRewards = orderedRewards;
    newState.harvestPopupVisible = true;
    newState.harvestAllPlayersOrder = [...newState.turnOrder];
    newState.harvestCurrentPlayerId = newState.turnOrder[0];
    newState.harvestCoinAcknowledged = false;
  } else if (orderedRewards.length > 0) {
    // Hotseat: only show popup if there are province rewards
    newState.harvestMandateActive = true;
    newState.harvestResolutionOrder = orderedRewards.map(r => r.playerId);
    newState.harvestResolutionIndex = 0;
    newState.harvestPlayerRewards = orderedRewards;
    newState.harvestPopupVisible = true;
    newState.harvestCurrentPlayerId = orderedRewards[0].playerId;
  } else {
    // Hotseat with no province rewards
    if (harvesters.length > 1) {
      const allyPlayer = newState.players.find((p) => p.id === issuer.allies[0]);
      newState.log = [...newState.log, `Cosecha resuelta para ${issuer.name} y aliado ${allyPlayer?.name ?? ''}`];
    } else {
      newState.log = [...newState.log, `Cosecha resuelta para ${issuer.name}`];
    }
  }

  return newState;
}

/**
 * Advance harvest resolution: grant rewards for the current harvest entry and move to next.
 * When all entries are processed, clear harvest state.
 * 
 * In online mode with harvestAllPlayersOrder set, the flow is:
 * 1. Each player first acknowledges the base +1 coin (harvestCoinAcknowledged = false -> true)
 * 2. Then their province rewards are shown one by one (if any)
 * 3. Then the next player in harvestAllPlayersOrder takes their turn
 */
export function advanceHarvestResolution(state: GameState): GameState {
  const newState: GameState = { ...state, players: state.players.map((p) => ({ ...p })), log: [...state.log] };

  // Online mode with all-players flow
  if (newState.harvestAllPlayersOrder.length > 0) {
    const currentPlayerId = newState.harvestCurrentPlayerId;

    if (!newState.harvestCoinAcknowledged) {
      // Player just acknowledged the base +1 coin popup
      newState.harvestCoinAcknowledged = true;

      // Check if this player has province rewards
      const playerRewards = newState.harvestPlayerRewards.filter(r => r.playerId === currentPlayerId);
      if (playerRewards.length > 0) {
        // Find the first reward index for this player in the ordered list
        const firstIdx = newState.harvestPlayerRewards.findIndex(r => r.playerId === currentPlayerId);
        newState.harvestResolutionIndex = firstIdx;
        // Stay on this player to show province rewards
        return newState;
      } else {
        // No province rewards - advance to next player
        return advanceToNextHarvestPlayer(newState);
      }
    } else {
      // Player is acknowledging a province reward
      const idx = newState.harvestResolutionIndex;
      const entry = newState.harvestPlayerRewards[idx];

      if (entry) {
        const player = newState.players.find((p) => p.id === entry.playerId);
        if (player) {
          const rewards = entry.rewards;
          if (rewards.vp) player.victoryPoints += rewards.vp;
          if (rewards.coins) player.coins += rewards.coins;
          if (rewards.ronin) player.ronin += rewards.ronin;
          if (rewards.honor) {
            const currentIdx = newState.honorTrack.indexOf(player.id);
            if (currentIdx > 0) {
              newState.honorTrack = [...newState.honorTrack];
              newState.honorTrack.splice(currentIdx, 1);
              newState.honorTrack.splice(currentIdx - 1, 0, player.id);
            }
          }
          const provinceName = newState.provinces[entry.provinceId]?.name || entry.provinceId;
          const rewardParts: string[] = [];
          if (rewards.vp) rewardParts.push(`${rewards.vp} PV`);
          if (rewards.coins) rewardParts.push(`${rewards.coins} monedas`);
          if (rewards.ronin) rewardParts.push(`${rewards.ronin} ronin`);
          if (rewards.honor) rewardParts.push(`${rewards.honor} honor`);
          newState.log = [...newState.log, `${player.name} obtiene recompensa de ${provinceName}: ${rewardParts.join(', ')}`];
        }
      }

      // Check if there are more province rewards for the current player
      const nextIdx = idx + 1;
      if (nextIdx < newState.harvestPlayerRewards.length && newState.harvestPlayerRewards[nextIdx].playerId === currentPlayerId) {
        // More rewards for same player
        newState.harvestResolutionIndex = nextIdx;
        return newState;
      } else {
        // No more rewards for this player - advance to next player
        return advanceToNextHarvestPlayer(newState);
      }
    }
  }

  // Hotseat / legacy mode: original logic (iterate through harvestPlayerRewards)
  const idx = newState.harvestResolutionIndex;
  const entry = newState.harvestPlayerRewards[idx];

  if (entry) {
    const player = newState.players.find((p) => p.id === entry.playerId);
    if (player) {
      const rewards = entry.rewards;
      if (rewards.vp) player.victoryPoints += rewards.vp;
      if (rewards.coins) player.coins += rewards.coins;
      if (rewards.ronin) player.ronin += rewards.ronin;
      if (rewards.honor) {
        // Move player up in honor track
        const currentIdx = newState.honorTrack.indexOf(player.id);
        if (currentIdx > 0) {
          newState.honorTrack = [...newState.honorTrack];
          newState.honorTrack.splice(currentIdx, 1);
          newState.honorTrack.splice(currentIdx - 1, 0, player.id);
        }
      }
      const provinceName = newState.provinces[entry.provinceId]?.name || entry.provinceId;
      const rewardParts: string[] = [];
      if (rewards.vp) rewardParts.push(`${rewards.vp} PV`);
      if (rewards.coins) rewardParts.push(`${rewards.coins} monedas`);
      if (rewards.ronin) rewardParts.push(`${rewards.ronin} ronin`);
      if (rewards.honor) rewardParts.push(`${rewards.honor} honor`);
      newState.log = [...newState.log, `${player.name} obtiene recompensa de ${provinceName}: ${rewardParts.join(', ')}`];
    }
  }

  const nextIdx = idx + 1;
  if (nextIdx >= newState.harvestPlayerRewards.length) {
    // All rewards granted - clear harvest state
    newState.harvestMandateActive = false;
    newState.harvestResolutionOrder = [];
    newState.harvestResolutionIndex = 0;
    newState.harvestPlayerRewards = [];
    newState.harvestPopupVisible = false;
    newState.harvestCurrentPlayerId = null;
    newState.harvestAllPlayersOrder = [];
    newState.harvestCoinAcknowledged = false;
  } else {
    newState.harvestResolutionIndex = nextIdx;
    newState.harvestPopupVisible = true;
    // Update harvestCurrentPlayerId if the next reward belongs to a different player
    const nextEntry = newState.harvestPlayerRewards[nextIdx];
    if (nextEntry && nextEntry.playerId !== entry?.playerId) {
      newState.harvestCurrentPlayerId = nextEntry.playerId;
    }
  }

  return newState;
}

/**
 * Helper: advance to the next player in harvestAllPlayersOrder.
 * If no more players, clear harvest state.
 */
function advanceToNextHarvestPlayer(state: GameState): GameState {
  const currentPlayerId = state.harvestCurrentPlayerId;
  const currentIdx = state.harvestAllPlayersOrder.indexOf(currentPlayerId || '');
  const nextPlayerIdx = currentIdx + 1;

  if (nextPlayerIdx >= state.harvestAllPlayersOrder.length) {
    // All players have been processed - clear harvest state
    state.harvestMandateActive = false;
    state.harvestResolutionOrder = [];
    state.harvestResolutionIndex = 0;
    state.harvestPlayerRewards = [];
    state.harvestPopupVisible = false;
    state.harvestCurrentPlayerId = null;
    state.harvestAllPlayersOrder = [];
    state.harvestCoinAcknowledged = false;
  } else {
    // Move to next player
    state.harvestCurrentPlayerId = state.harvestAllPlayersOrder[nextPlayerIdx];
    state.harvestCoinAcknowledged = false;
    state.harvestPopupVisible = true;
  }

  return state;
}

function executeBetray(state: GameState, issuerId: string): GameState {
  const newState: GameState = {
    ...state,
    provinces: { ...state.provinces },
    players: state.players.map((p) => ({ ...p, allies: [...p.allies] })),
    honorTrack: [...state.honorTrack],
    log: [...state.log],
  };

  const issuer = newState.players.find((p) => p.id === issuerId)!;

  // If issuer has an alliance, break ONLY the issuer's alliance and lose honor
  if (issuer.allies.length > 0) {
    const allyId = issuer.allies[0];
    const ally = newState.players.find((p) => p.id === allyId);
    if (ally) {
      ally.allies = ally.allies.filter((id) => id !== issuerId);
    }
    issuer.allies = [];
    loseHonor(newState, issuerId);
    const newHonorPosition = newState.honorTrack.indexOf(issuerId) + 1;
    newState.log = [...newState.log, `${issuer.name} rompe su alianza y pierde honor bajando a la posicion ${newHonorPosition}`];
  }

  // Set up interactive betray state - only the issuer acts
  newState.betrayMandateActive = true;
  newState.betraySelectionsRemaining = 2;
  newState.betraySelectedOwners = [];
  newState.betrayMandateIssuerId = issuerId;

  // Set current player to the issuer so they can interact
  const issuerIdx = newState.players.findIndex((p) => p.id === issuerId);
  if (issuerIdx >= 0) {
    newState.currentPlayerIndex = issuerIdx;
  }

  return newState;
}

export function betraySelectFigure(state: GameState, issuerId: string, figureId: string, provinceId: string, selectedMonsterCardId?: string): GameState {
  if (!state.betrayMandateActive || state.betrayMandateIssuerId !== issuerId) return state;

  const newState: GameState = {
    ...state,
    provinces: { ...state.provinces },
    players: state.players.map((p) => ({ ...p, seasonCards: [...p.seasonCards] })),
    honorTrack: [...state.honorTrack],
    log: [...state.log],
    betraySelectedOwners: [...state.betraySelectedOwners],
  };

  const province = newState.provinces[provinceId];
  if (!province) return state;

  // Find the figure in the province
  const figure = province.figures.find((f) => f.id === figureId);
  if (!figure) return state;

  const issuer = newState.players.find((p) => p.id === issuerId)!;
  const figureOwner = newState.players.find((p) => p.id === figure.owner);
  if (!figureOwner) return state;

  // Validation: cannot target own figure
  if (figure.owner === issuerId) return state;

  // Validation: cannot target daimyo
  if (figure.type === 'daimyo') return state;

  // Validation: cannot target monsters that count as daimyo (Fukurokuju, Yurei)
  if (figure.type === 'monster' && figure.monsterCardId && ['sp-fukurokuju', 'su-yurei'].includes(figure.monsterCardId)) return state;

  // Validation: cannot target fortress (fortresses are structures, not figures)
  if (figure.type === 'fortress') return state;

  // Validation: cannot target shinto if it is in a temple
  if (figure.type === 'shinto') {
    const isInTemple = newState.temples.some((temple) =>
      temple.figures.some((tf) => tf.figureId === figureId)
    );
    if (isInTemple) return state;
  }

  // Validation: cannot target same owner twice
  if (newState.betraySelectedOwners.includes(figure.owner)) return state;

  // Validation: issuer must have a same-type figure in reserve
  if (figure.type === 'bushi') {
    if (issuer.bushi <= 0) return state;
  } else if (figure.type === 'shinto') {
    if (issuer.shinto <= 0) return state;
  } else if (figure.type === 'monster') {
    // Check if issuer has an undeployed monster card
    const deployedMonsterCardIds = new Set<string>();
    Object.values(newState.provinces).forEach((prov) => {
      prov.figures.forEach((f) => {
        if (f.type === 'monster' && f.owner === issuerId && f.monsterCardId) {
          deployedMonsterCardIds.add(f.monsterCardId);
        }
      });
    });
    const hasUndeployedMonster = issuer.seasonCards.some(
      (card) => card.cardType === 'monster' && !deployedMonsterCardIds.has(card.id)
    );
    if (!hasUndeployedMonster || issuer.monsters <= 0) return state;
  }

  // Perform the replacement
  // Remove the target figure from the province
  const newFigures = province.figures.filter((f) => f.id !== figureId);

  // Create a replacement figure of the same type owned by the issuer
  const replacementFigure = createFigure(figure.type, issuerId);
  if (figure.type === 'monster' && selectedMonsterCardId) {
    replacementFigure.monsterCardId = selectedMonsterCardId;
  }
  newFigures.push(replacementFigure);
  newState.provinces[provinceId] = { ...province, figures: newFigures };

  // Return the original figure to its owner's reserve
  if (figure.type === 'bushi') {
    figureOwner.bushi += 1;
  } else if (figure.type === 'shinto') {
    figureOwner.shinto += 1;
  } else if (figure.type === 'monster') {
    figureOwner.monsters += 1;
  }

  // Decrement issuer's reserve
  if (figure.type === 'bushi') {
    issuer.bushi -= 1;
  } else if (figure.type === 'shinto') {
    issuer.shinto -= 1;
  }
  // For monsters, no numeric reserve to decrement - the deployed figure uses the card

  // Track the owner so they can't be targeted again
  newState.betraySelectedOwners.push(figure.owner);
  newState.betraySelectionsRemaining -= 1;

  // Get monster names for display
  const targetMonsterName = figure.type === 'monster' && figure.monsterCardId
    ? (SEASON_CARDS_DATA.find(c => c.id === figure.monsterCardId)?.name || undefined)
    : undefined;
  const replacementMonsterName = figure.type === 'monster' && selectedMonsterCardId
    ? (SEASON_CARDS_DATA.find(c => c.id === selectedMonsterCardId)?.name || undefined)
    : undefined;

  // Track replacement for UI display
  newState.betrayReplacements = [...newState.betrayReplacements, {
    figureType: figure.type,
    targetClanId: figureOwner.clanId,
    targetPlayerName: figureOwner.name,
    provinceId: provinceId,
    provinceName: province.name,
    targetMonsterName,
    targetMonsterCardId: figure.type === 'monster' ? figure.monsterCardId : undefined,
    replacementMonsterName,
    replacementMonsterCardId: figure.type === 'monster' ? selectedMonsterCardId : undefined,
  }];

  newState.log = [...newState.log, `${issuer.name} reemplaza ${figure.type} de ${figureOwner.name} en ${province.name}`];

  // If no selections remaining, keep betrayMandateActive true (wait for 'Terminar' button)
  if (newState.betraySelectionsRemaining <= 0) {
    return newState;
  }

  return newState;
}

function finalizeBetray(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    betrayMandateActive: false,
    betraySelectionsRemaining: 0,
    betraySelectedOwners: [],
    betrayReplacements: [],
    betrayMandateIssuerId: null,
    log: [...state.log, 'Mandato de Traicionar resuelto'],
  };
  return newState;
}

export function skipBetrayTurn(state: GameState): GameState {
  if (!state.betrayMandateActive) return state;
  return finalizeBetray(state);
}

// ============================================================
// Kami Turns
// ============================================================

export function resolveKamiAbility(state: GameState, kamiType: KamiType, playerId: string): GameState {
  let newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    honorTrack: [...state.honorTrack],
    provinces: { ...state.provinces },
    log: [...state.log],
  };

  const player = newState.players.find((p) => p.id === playerId);
  if (!player) return state;

  switch (kamiType) {
    case 'amaterasu': {
      // Move player to the top of the honor track (index 0 = best honor)
      const currentIdx = newState.honorTrack.indexOf(playerId);
      if (currentIdx > 0) {
        newState.honorTrack = newState.honorTrack.filter((id) => id !== playerId);
        newState.honorTrack.unshift(playerId);
        // Update player.honor values to match new positions
        newState.honorTrack.forEach((pid, idx) => {
          const p = newState.players.find(pl => pl.id === pid);
          if (p) p.honor = idx + 1;
        });
        newState.log = [...newState.log, `${player.name} sube a la cima del Track de Honor (Amaterasu)`];
      }
      break;
    }
    case 'hachiman': {
      // Grant +2 ronin tokens
      player.ronin += 2;
      newState.log = [...newState.log, `${player.name} obtiene 2 fichas de Ronin (Hachiman)`];
      break;
    }
    case 'susanoo': {
      // Grant VP equal to number of fortresses on the map (Fukurokuju counts as fortress)
      let fortressCount = 0;
      Object.values(newState.provinces).forEach((province) => {
        fortressCount += province.figures.filter(
          (f) => f.owner === playerId && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju'))
        ).length;
      });
      player.victoryPoints += fortressCount;
      newState.log = [...newState.log, `${player.name} obtiene ${fortressCount} PV por Fortalezas (Susanoo)`];
      break;
    }
    case 'tsukuyomi': {
      // Grant +2 coins
      player.coins += 2;
      newState.log = [...newState.log, `${player.name} obtiene 2 Monedas (Tsukuyomi)`];
      break;
    }
    case 'fujin': {
      // Interactive: handled by step-by-step flow (resolveCurrentKamiReward sets interactive mode)
      break;
    }
    case 'raijin': {
      // Interactive: handled by step-by-step flow (resolveCurrentKamiReward sets interactive mode)
      break;
    }
    case 'ryujin': {
      // Interactive: handled by step-by-step flow (resolveCurrentKamiReward sets interactive mode)
      break;
    }
  }

  return newState;
}

/**
 * Compute the winner of a temple based on shinto force and honor track tiebreaking.
 * Returns the winnerId (or null if no figures) and a forces array.
 */
function computeTempleWinner(
  templeFigures: { playerId: string }[],
  honorTrack: string[],
  players: { id: string; clanId: string }[]
): { winnerId: string | null; forces: { playerId: string; count: number }[] } {
  const forcesMap: { [playerId: string]: number } = {};
  templeFigures.forEach((fig) => {
    const player = players.find(p => p.id === fig.playerId);
    const force = player?.clanId === 'luna' ? 2 : 1;
    forcesMap[fig.playerId] = (forcesMap[fig.playerId] || 0) + force;
  });

  const forces = Object.entries(forcesMap).map(([playerId, count]) => ({ playerId, count }));

  if (forces.length === 0) {
    return { winnerId: null, forces: [] };
  }

  let maxForce = 0;
  let winnerId: string | null = null;

  Object.entries(forcesMap).forEach(([pid, force]) => {
    if (force > maxForce) {
      maxForce = force;
      winnerId = pid;
    } else if (force === maxForce && winnerId) {
      const currentWinnerHonor = honorTrack.indexOf(winnerId);
      const challengerHonor = honorTrack.indexOf(pid);
      if (challengerHonor < currentWinnerHonor) {
        winnerId = pid;
      }
    }
  });

  return { winnerId, forces };
}

export function resolveKamiTurn(state: GameState): GameState {
  let newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    temples: state.temples.map((t) => ({ ...t, figures: [...t.figures] })),
    honorTrack: [...state.honorTrack],
    log: [...state.log, '--- Turno Kami ---'],
  };

  // For each temple (left to right by position)
  const sortedTemples = [...newState.temples].sort((a, b) => a.position - b.position);

  for (const temple of sortedTemples) {
    const { winnerId, forces } = computeTempleWinner(temple.figures, newState.honorTrack, newState.players);
    const kamiInfo = KAMI_DATA.find((k) => k.type === temple.kamiType);

    if (forces.length === 0) {
      newState.log = [...newState.log, `Santuario ${temple.position} (${kamiInfo?.name || temple.kamiType}) - sin figuras, saltado`];
      continue;
    }

    // Sol clan power: bonus on temple honor tiebreak
    if (winnerId && forces.length > 1) {
      const maxForce = Math.max(...forces.map(f => f.count));
      const tiedInTemple = forces.filter(f => f.count === maxForce);
      if (tiedInTemple.length > 1) {
        const losers = tiedInTemple.filter(f => f.playerId !== winnerId).map(f => f.playerId);
        applySolTiebreakBonus(newState, winnerId, losers);
      }
    }

    if (winnerId) {
      const winner = newState.players.find((p) => p.id === winnerId);
      if (winner && kamiInfo) {
        newState.log = [...newState.log, `Santuario ${temple.position}: ${winner.name} gana ${kamiInfo.name} (fuerza: ${forces.find(f => f.playerId === winnerId)?.count || 0})`];
        // Apply the kami ability
        newState = resolveKamiAbility(newState, temple.kamiType, winnerId);
      }
    }
  }

  return newState;
}

/**
 * Apply the kami ability for the current kamiResolutionIndex temple's winner.
 * For auto rewards (amaterasu, hachiman, susanoo, tsukuyomi), apply the effect.
 * For interactive rewards (fujin, raijin, ryujin), set interactive flags.
 */
export function resolveCurrentKamiReward(state: GameState): GameState {
  if (!state.kamiResolutionActive) return state;
  const currentTemple = state.kamiResolutionTemples[state.kamiResolutionIndex];
  if (!currentTemple) return state;

  // If winnerId was not pre-computed (deferred), compute it now using the current honorTrack
  let winnerId = currentTemple.winnerId;
  let newState = { ...state };
  if (!winnerId && currentTemple.forces.length > 0) {
    const temple = newState.temples[currentTemple.templeIndex];
    const { winnerId: computedWinnerId } = computeTempleWinner(temple.figures, newState.honorTrack, newState.players);
    winnerId = computedWinnerId;
    // Store the computed winnerId back into the temple data for display
    const updatedTemples = [...newState.kamiResolutionTemples];
    const updatedTemple = { ...updatedTemples[newState.kamiResolutionIndex], winnerId };

    // Compute susanoo VP if applicable
    if (currentTemple.kamiType === 'susanoo' && winnerId) {
      let fortressCount = 0;
      Object.values(newState.provinces).forEach((province) => {
        fortressCount += province.figures.filter(
          (f) => f.owner === winnerId && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju'))
        ).length;
      });
      updatedTemple.susanooVPGained = fortressCount;
    }

    updatedTemples[newState.kamiResolutionIndex] = updatedTemple;
    newState = { ...newState, kamiResolutionTemples: updatedTemples, kamiResolutionCurrentPlayerId: winnerId };
  }

  // No winner - nothing to apply
  if (!winnerId) {
    return newState;
  }

  const { kamiType } = currentTemple;

  // For interactive kami types, set the interactive flags
  if (kamiType === 'fujin') {
    return {
      ...newState,
      kamiResolutionStep: 'interactive',
      fujinMovesRemaining: 2,
      log: [...newState.log, `${newState.players.find(p => p.id === winnerId)?.name || ''} puede realizar hasta 2 Movimientos (Fujin)`],
    };
  }
  if (kamiType === 'raijin') {
    const player = newState.players.find(p => p.id === winnerId);
    if (player && player.bushi > 0) {
      return {
        ...newState,
        kamiResolutionStep: 'interactive',
        raijinPlacementActive: true,
        log: [...newState.log, `${player.name} puede Invocar 1 Bushi en cualquier Provincia (Raijin)`],
      };
    }
    // No bushi in reserve - treat as auto (skip)
    return {
      ...newState,
      log: [...newState.log, `${player?.name || ''} no tiene Bushi en reserva (Raijin - sin efecto)`],
    };
  }
  if (kamiType === 'ryujin') {
    return {
      ...newState,
      kamiResolutionStep: 'interactive',
      ryujinBuyActive: true,
      log: [...newState.log, `${newState.players.find(p => p.id === winnerId)?.name || ''} puede adquirir una Carta de Estación (Ryujin)`],
    };
  }

  // Auto rewards - apply via resolveKamiAbility
  newState = resolveKamiAbility(newState, kamiType, winnerId);

  // Sol clan tiebreak bonus (same logic as resolveKamiTurn)
  const temple = newState.temples[currentTemple.templeIndex];
  if (temple && currentTemple.forces.length > 1) {
    const maxForce = Math.max(...currentTemple.forces.map(f => f.count));
    const tiedInTemple = currentTemple.forces.filter(f => f.count === maxForce);
    if (tiedInTemple.length > 1) {
      const losers = tiedInTemple.filter(f => f.playerId !== winnerId).map(f => f.playerId);
      applySolTiebreakBonus(newState, winnerId, losers);
    }
  }

  return newState;
}

/**
 * Advance to the next temple in kami resolution, or finish the resolution.
 */
export function advanceKamiResolution(state: GameState): GameState {
  if (!state.kamiResolutionActive) return state;

  const nextIndex = state.kamiResolutionIndex + 1;

  // All temples resolved
  if (nextIndex >= state.kamiResolutionTemples.length) {
    // Save temple data for summary before clearing
    const summaryData = [...state.kamiResolutionTemples];
    let newState: GameState = {
      ...state,
      kamiResolutionActive: false,
      kamiResolutionTemples: [],
      kamiResolutionIndex: 0,
      kamiResolutionStep: null,
      kamiResolutionCurrentPlayerId: null,
      fujinMovesRemaining: 0,
      raijinPlacementActive: false,
      ryujinBuyActive: false,
      kamiSummaryVisible: true,
      kamiSummaryData: summaryData,
      kamiSummaryReadyPlayers: [],
    };
    newState.log = [...newState.log, '--- Fin Turno Kami ---'];

    // Check if politics phase is done
    if (newState.politicsMandateCount >= newState.maxMandates) {
      return advancePhase(newState);
    }

    // Continue with next player's mandate turn
    newState.currentPlayerIndex = state.kamiResolutionNextPlayerIndex;
    return newState;
  }

  // Move to the next temple
  const nextTemple = state.kamiResolutionTemples[nextIndex];
  let nextWinnerId = nextTemple?.winnerId || null;

  // Compute winner dynamically for the next temple using current honorTrack
  let updatedTemples = state.kamiResolutionTemples;
  if (nextTemple && !nextWinnerId && nextTemple.forces.length > 0) {
    const temple = state.temples[nextTemple.templeIndex];
    const { winnerId: computedWinnerId } = computeTempleWinner(temple.figures, state.honorTrack, state.players);
    nextWinnerId = computedWinnerId;
    // Store back into temple data for display
    updatedTemples = [...state.kamiResolutionTemples];
    const updatedNextTemple: typeof nextTemple = { ...nextTemple, winnerId: nextWinnerId };

    // Compute susanoo VP if applicable
    if (nextTemple.kamiType === 'susanoo' && nextWinnerId) {
      let fortressCount = 0;
      Object.values(state.provinces).forEach((province) => {
        fortressCount += province.figures.filter(
          (f) => f.owner === nextWinnerId && f.type === 'fortress'
        ).length;
      });
      updatedNextTemple.susanooVPGained = fortressCount;
    }

    updatedTemples[nextIndex] = updatedNextTemple;
  }

  return {
    ...state,
    kamiResolutionTemples: updatedTemples,
    kamiResolutionIndex: nextIndex,
    kamiResolutionStep: 'showing',
    kamiResolutionCurrentPlayerId: nextWinnerId,
    fujinMovesRemaining: 0,
    raijinPlacementActive: false,
    ryujinBuyActive: false,
  };
}

// ============================================================
// War Phase
// ============================================================

function applyWarUpgrades(state: GameState): void {
  for (const player of state.players) {
    const warUpgradeCards = player.seasonCards.filter((c) => c.cardType === 'warUpgrade');
    for (const card of warUpgradeCards) {
      // Normalize card ID by stripping '-2' suffix for duplicate cards
      const baseCardId = card.id.endsWith('-2') ? card.id.slice(0, -2) : card.id;
      switch (baseCardId) {
        case 'sp-way-of-the-shogun': {
          // +3 coins
          player.coins += 3;
          state.log = [...state.log, `${player.name} obtiene 3 Monedas (Way of the Shogun)`];
          break;
        }
        case 'sp-way-of-the-righteous': {
          // Take 1 coin from each player with less honor
          const playerHonorIdx = state.honorTrack.indexOf(player.id);
          for (const other of state.players) {
            if (other.id === player.id) continue;
            const otherHonorIdx = state.honorTrack.indexOf(other.id);
            if (otherHonorIdx > playerHonorIdx && other.coins > 0) {
              other.coins -= 1;
              player.coins += 1;
            }
          }
          state.log = [...state.log, `${player.name} toma monedas de jugadores con menor honor (Way of the Righteous)`];
          break;
        }
        case 'su-way-of-bushido': {
          // +2 coins and +2 VP per different virtue owned
          const virtueCount = player.seasonCards.filter((c) => c.cardType === 'virtue').length;
          player.coins += 2;
          player.victoryPoints += 2 * virtueCount;
          state.log = [...state.log, `${player.name} obtiene 2 Monedas y ${2 * virtueCount} PV (Way of Bushido, ${virtueCount} virtudes)`];
          break;
        }
        case 'su-way-of-the-ronin': {
          // +2 ronin
          player.ronin += 2;
          state.log = [...state.log, `${player.name} obtiene 2 Ronin (Way of the Ronin)`];
          break;
        }
        case 'au-way-of-the-moneylender': {
          // +5 coins
          player.coins += 5;
          state.log = [...state.log, `${player.name} obtiene 5 Monedas (Way of the Moneylender)`];
          break;
        }
        case 'su-way-of-naginata':
        case 'au-way-of-naginata': {
          // Movement is UI-driven, log only
          state.log = [...state.log, `${player.name} puede realizar movimiento Naginata (Way of Naginata)`];
          break;
        }
        case 'su-way-of-the-ashigaru': {
          // Province selection is UI-driven, log only
          state.log = [...state.log, `${player.name} puede colocar Ashigaru (Way of the Ashigaru)`];
          break;
        }
        case 'au-way-of-the-katana': {
          // Bushi force 2 during war is handled in calculateForce
          state.log = [...state.log, `${player.name} los Bushi tienen Fuerza 2 durante la Guerra (Way of the Katana)`];
          break;
        }
        case 'au-way-of-the-keiri': {
          // Kill up to 2 figures is UI-driven, log only
          state.log = [...state.log, `${player.name} puede eliminar hasta 2 figuras enemigas (Way of the Keiri)`];
          break;
        }
      }
    }
  }
}

export function initiateWarPhase(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    currentPhase: 'war' as const,
    activeBattles: [],
    warPhaseReadyPlayers: [],
    battlePopupReadyPlayers: [],
    warSummaryVisible: false,
    warSummaryReadyPlayers: [],
    battleResultReadyPlayers: [],
    coinDistributionReadyPlayers: [],
    hostageReturnActive: false,
    hostageReturnOrder: [],
    hostageReturnIndex: 0,
    hostageReturnReadyPlayers: [],
    cleanupTeaCeremonyReady: false,
    cleanupTeaCeremonyReadyPlayers: [],
    players: state.players.map((p) => ({ ...p, warProvinceTokens: [...p.warProvinceTokens], seasonCards: [...p.seasonCards] })),
    log: [...state.log, '=== Comienza la Fase de Guerra ==='],
  };

  // Koi clan power: swap all ronin for coins at the start of war
  const koiPlayer = newState.players.find((p) => p.clanId === 'koi');
  if (koiPlayer && koiPlayer.ronin > 0) {
    const swapped = koiPlayer.ronin;
    koiPlayer.coins += swapped;
    koiPlayer.ronin = 0;
    newState.log = [...newState.log, `${koiPlayer.name} (Koi) cambia ${swapped} Ronin por ${swapped} Monedas`];
  }

  // Zorro clan power: set up manual placement in battle provinces where Zorro has no figures
  const zorroPlayer = newState.players.find((p) => p.clanId === 'zorro');
  if (zorroPlayer && zorroPlayer.bushi > 0) {
    // Determine battle provinces from warProvinceSlots
    const battleProvinceIds = newState.warProvinceSlots.map(s => s.provinceId);
    // Eligible provinces: battle provinces where Zorro has no figures
    const eligibleProvinces = battleProvinceIds.filter(provId => {
      const prov = newState.provinces[provId];
      if (!prov) return false;
      return !prov.figures.some((f) => f.owner === zorroPlayer.id && f.type !== 'fortress');
    });
    if (eligibleProvinces.length > 0) {
      const remaining = Math.min(zorroPlayer.bushi, eligibleProvinces.length);
      newState.zorroPlacementActive = true;
      newState.zorroPlacementPlayerId = zorroPlayer.id;
      newState.zorroPlacementsRemaining = remaining;
      newState.log = [...newState.log, `${zorroPlayer.name} (Zorro) puede colocar hasta ${remaining} Bushi en provincias de batalla vacias`];
    }
  }

  // Apply war upgrade card effects at start of war phase
  applyWarUpgrades(newState);

  // Sort war province slots by number (ascending order)
  const sortedSlots = [...newState.warProvinceSlots].sort((a, b) => a.number - b.number);

  // Create battles for provinces with war tokens
  for (const slot of sortedSlots) {
    const province = newState.provinces[slot.provinceId];
    if (!province) continue;

    // Get unique players with figures in this province
    // Exclude players who ONLY have fortress figures, unless their clan is 'tortuga'
    const allOwners = [...new Set(province.figures.map((f) => f.owner))];
    const playerIds = allOwners.filter((ownerId) => {
      const ownerPlayer = newState.players.find((p) => p.id === ownerId);
      if (ownerPlayer?.clanId === 'tortuga') return true;
      const hasNonFortress = province.figures.some((f) => f.owner === ownerId && f.type !== 'fortress');
      return hasNonFortress;
    });

    if (playerIds.length === 0) {
      // Empty province - discard token (show as uncontested with no winner)
      const battle: Battle = {
        provinceId: slot.provinceId,
        participants: [],
        warTacticBids: {},
        resolved: false,
        uncontested: true,
      };
      newState.activeBattles.push(battle);
      newState.log = [...newState.log, `${province.name}: vacia - ficha de guerra descartada`];
      continue;
    }

    if (!newState.zorroPlacementActive && playerIds.length === 1) {
      // Solo player wins token without battle (only resolve if Zorro is not placing)
      const winnerId = playerIds[0];
      const winner = newState.players.find((p) => p.id === winnerId);
      if (winner) {
        winner.warProvinceTokens = [...winner.warProvinceTokens, { season: slot.season, provinceId: slot.provinceId }];
        const battle: Battle = {
          provinceId: slot.provinceId,
          participants: [winnerId],
          warTacticBids: {},
          resolved: false,
          winner: winnerId,
          uncontested: true,
        };
        newState.activeBattles.push(battle);
        newState.log = [...newState.log, `${winner.name} gana ficha de guerra en ${province.name} (sin oposición)`];
      }
      continue;
    }

    if (!newState.zorroPlacementActive && playerIds.length === 2) {
      // Check if all players are allied to each other (2 allied players)
      const p1 = newState.players.find((p) => p.id === playerIds[0]);
      const p2 = newState.players.find((p) => p.id === playerIds[1]);
      if (p1 && p2 && p1.allies.includes(p2.id)) {
        // Two allies - strongest wins without battle
        const force1 = calculateForce(province, p1.id, newState);
        const force2 = calculateForce(province, p2.id, newState);
        const winner = force1 >= force2 ? p1 : p2;
        winner.warProvinceTokens = [...winner.warProvinceTokens, { season: slot.season, provinceId: slot.provinceId }];
        const battle: Battle = {
          provinceId: slot.provinceId,
          participants: playerIds,
          warTacticBids: {},
          resolved: false,
          winner: winner.id,
          uncontested: true,
        };
        newState.activeBattles.push(battle);
        newState.log = [...newState.log, `${winner.name} gana ficha de guerra en ${province.name} (aliados - sin batalla)`];
        continue;
      }
    }

    // When Zorro is placing, create all non-empty battles without resolving
    if (newState.zorroPlacementActive && playerIds.length === 1) {
      const battle: Battle = {
        provinceId: slot.provinceId,
        participants: [playerIds[0]],
        warTacticBids: {},
        resolved: false,
      };
      newState.activeBattles.push(battle);
      continue;
    }

    // 2+ non-allied players - full battle (or deferred allied check when Zorro is placing)
    const battle: Battle = {
      provinceId: slot.provinceId,
      participants: playerIds.sort((a, b) => {
        const aIdx = newState.turnOrder.indexOf(a);
        const bIdx = newState.turnOrder.indexOf(b);
        return aIdx - bIdx;
      }),
      warTacticBids: {},
      resolved: false,
    };
    newState.activeBattles.push(battle);
  }

  // Log summary of battles to resolve
  const activeBattles = newState.activeBattles;
  if (activeBattles.length > 0) {
    const contestedCount = activeBattles.filter(b => !b.uncontested).length;
    const uncontestedCount = activeBattles.length - contestedCount;
    let summary = `${activeBattles.length} batallas por resolver`;
    if (contestedCount > 0 && uncontestedCount > 0) {
      summary += ` (${contestedCount} disputadas, ${uncontestedCount} sin oposición)`;
    }
    newState.log = [...newState.log, summary];
  }

  return newState;
}

/**
 * After Zorro finishes placing bushi, re-evaluate battles:
 * - Award tokens for uncontested provinces (0 or 1 player)
 * - Resolve allied battles (2 allied players, strongest wins)
 * Must be called after Zorro placement is complete.
 */
export function resolveUncontestedBattles(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    players: state.players.map(p => ({ ...p, warProvinceTokens: [...p.warProvinceTokens] })),
    activeBattles: [...state.activeBattles],
    log: [...state.log],
  };

  const sortedSlots = [...newState.warProvinceSlots].sort((a, b) => a.number - b.number);

  newState.activeBattles = newState.activeBattles.map(battle => {
    // Skip already resolved/uncontested battles (e.g., empty provinces already handled)
    if (battle.uncontested) return battle;
    if (battle.winner) return battle;

    const slot = sortedSlots.find(s => s.provinceId === battle.provinceId);
    if (!slot) return battle;

    const province = newState.provinces[battle.provinceId];
    if (!province) return battle;

    // Re-evaluate participants based on current figures in province
    // Exclude players who ONLY have fortress figures, unless their clan is 'tortuga'
    const allCurrentOwners = [...new Set(province.figures.map(f => f.owner))];
    const currentPlayerIds = allCurrentOwners.filter((ownerId) => {
      const ownerPlayer = newState.players.find((p) => p.id === ownerId);
      if (ownerPlayer?.clanId === 'tortuga') return true;
      const hasNonFortress = province.figures.some((f) => f.owner === ownerId && f.type !== 'fortress');
      return hasNonFortress;
    });

    if (currentPlayerIds.length === 0) {
      // Empty - discard token
      newState.log = [...newState.log, `${province.name}: vacia - ficha de guerra descartada`];
      return { ...battle, participants: [], uncontested: true };
    }

    if (currentPlayerIds.length === 1) {
      // Solo player wins token
      const winnerId = currentPlayerIds[0];
      const winner = newState.players.find(p => p.id === winnerId);
      if (winner) {
        winner.warProvinceTokens = [...winner.warProvinceTokens, { season: slot.season, provinceId: slot.provinceId }];
        newState.log = [...newState.log, `${winner.name} gana ficha de guerra en ${province.name} (sin oposición)`];
      }
      return { ...battle, participants: currentPlayerIds, winner: winnerId, uncontested: true };
    }

    if (currentPlayerIds.length === 2) {
      const p1 = newState.players.find(p => p.id === currentPlayerIds[0]);
      const p2 = newState.players.find(p => p.id === currentPlayerIds[1]);
      if (p1 && p2 && p1.allies.includes(p2.id)) {
        // Two allies - strongest wins
        const force1 = calculateForce(province, p1.id, newState);
        const force2 = calculateForce(province, p2.id, newState);
        const winner = force1 >= force2 ? p1 : p2;
        winner.warProvinceTokens = [...winner.warProvinceTokens, { season: slot.season, provinceId: slot.provinceId }];
        newState.log = [...newState.log, `${winner.name} gana ficha de guerra en ${province.name} (aliados - sin batalla)`];
        return { ...battle, participants: currentPlayerIds, winner: winner.id, uncontested: true };
      }
    }

    // Otherwise it's a contested battle - update participants
    return {
      ...battle,
      participants: currentPlayerIds.sort((a, b) => {
        const aIdx = newState.turnOrder.indexOf(a);
        const bIdx = newState.turnOrder.indexOf(b);
        return aIdx - bIdx;
      }),
    };
  });

  return newState;
}

export function submitWarTacticBids(
  state: GameState,
  provinceId: string,
  playerId: string,
  tacticBids: { [tacticId: string]: number }
): GameState {
  const newState: GameState = {
    ...state,
    activeBattles: state.activeBattles.map((b) => ({ ...b, warTacticBids: { ...b.warTacticBids } })),
  };

  const battle = newState.activeBattles.find((b) => b.provinceId === provinceId);
  if (!battle || battle.resolved) return state;

  // Validate bids against player coin balance
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;
  const totalBid = Object.values(tacticBids).reduce((sum, v) => sum + v, 0);
  if (totalBid > player.coins) {
    // Reject bids that exceed coin balance - return unchanged state
    return state;
  }

  // Merge this player's bids into the existing warTacticBids map
  battle.warTacticBids[playerId] = tacticBids;
  return newState;
}

export function allBidsSubmitted(state: GameState, provinceId: string): boolean {
  const battle = state.activeBattles.find((b) => b.provinceId === provinceId);
  if (!battle || battle.resolved) return false;
  return battle.participants.every((pid) => pid in battle.warTacticBids);
}

export function resolveNextBattle(state: GameState): GameState {
  const unresolvedIdx = state.activeBattles.findIndex((b) => !b.resolved && !b.uncontested);
  if (unresolvedIdx === -1) return state;

  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, warProvinceTokens: [...p.warProvinceTokens], hostages: [...p.hostages] })),
    provinces: { ...state.provinces },
    activeBattles: state.activeBattles.map((b) => ({ ...b, warTacticBids: { ...b.warTacticBids } })),
    honorTrack: [...state.honorTrack],
    log: [...state.log],
  };

  const battle = newState.activeBattles[unresolvedIdx];
  const province = newState.provinces[battle.provinceId];
  if (!province) {
    battle.resolved = true;
    return newState;
  }

  // Record the log index where this battle's entries begin
  battle.logStartIndex = newState.log.length;

  const battleNumber = unresolvedIdx + 1;
  const provinceName = province?.name || battle.provinceId;
  newState.log = [...newState.log, `--- Inicio Batalla ${battleNumber} (${provinceName}) ---`];

  // Check if step-by-step resolution was used (resolutionData present = seppuku/hostage already handled)
  const resData = battle.resolutionData;
  const stepByStepMode = !!resData;

  // Determine hire-ronin winner BEFORE computing preResolutionForces so we can include ronin in force display
  let preHireRoninWinner: string | null = null;
  {
    let highestRoninBid = 0;
    battle.participants.forEach((pid) => {
      const playerBids = battle.warTacticBids[pid];
      const bid = playerBids?.['hire-ronin'] || 0;
      if (bid > highestRoninBid) {
        highestRoninBid = bid;
        preHireRoninWinner = pid;
      } else if (bid === highestRoninBid && bid > 0) {
        const currentHonor = newState.honorTrack.indexOf(preHireRoninWinner!);
        const challengerHonor = newState.honorTrack.indexOf(pid);
        if (challengerHonor < currentHonor) {
          preHireRoninWinner = pid;
        }
      }
    });
  }

  // Compute participant forces BEFORE any seppuku/hostage removals, but INCLUDING ronin for hire-ronin winner
  const preResolutionForces = battle.participants.map(pid => {
    let force = calculateForce(province, pid, newState);
    if (pid === preHireRoninWinner) {
      const player = newState.players.find(p => p.id === pid)!;
      force += player.ronin;
      if (player.clanId === 'koi') {
        const totalBidByPlayer = Object.values(battle.warTacticBids[pid] || {}).reduce((s, v) => s + v, 0);
        const remainingCoins = player.coins - totalBidByPlayer;
        force += Math.max(0, remainingCoins);
      }
    }
    return { playerId: pid, force };
  });

  // Resolve War Tactics (left to right: Seppuku, Take Hostage, Hire Ronin, Imperial Poets)
  const sortedTactics = [...WAR_TACTICS].sort((a, b) => a.order - b.order);

  let battleDeathCount = stepByStepMode ? (resData.seppukuAccepted ? resData.seppukuKillCount : 0) : 0;
  let imperialPoetsBidder: string | null = null;
  let seppukuFigures: { type: string; count: number }[] | undefined;

  for (const tactic of sortedTactics) {
    // In step-by-step mode, skip seppuku and take-hostage (already handled by store actions)
    if (stepByStepMode && (tactic.id === 'seppuku' || tactic.id === 'take-hostage')) {
      // Still need to detect imperial-poets winner and apply Sol tiebreaker for skipped tactics
      if (tactic.id === 'seppuku' || tactic.id === 'take-hostage') {
        // Sol tiebreak was handled during determineTacticWinners / not needed again
        continue;
      }
    }

    // Find highest bidder for this tactic
    let highestBid = 0;
    let highestBidder: string | null = null;
    let tacticTied = false;

    battle.participants.forEach((pid) => {
      const playerBids = battle.warTacticBids[pid];
      if (playerBids && playerBids[tactic.id] > highestBid) {
        highestBid = playerBids[tactic.id];
        highestBidder = pid;
        tacticTied = false;
      } else if (playerBids && playerBids[tactic.id] === highestBid && highestBid > 0) {
        tacticTied = true;
        // Tie-breaking by honor (lower index = better honor = wins)
        const currentHonor = newState.honorTrack.indexOf(highestBidder!);
        const challengerHonor = newState.honorTrack.indexOf(pid);
        if (challengerHonor < currentHonor) {
          highestBidder = pid;
        }
      }
    });

    // Sol clan power: bonus on war tactic bid tie resolved by honor
    if (tacticTied && highestBidder) {
      const tiedLosers = battle.participants.filter((pid) => {
        if (pid === highestBidder) return false;
        const playerBids = battle.warTacticBids[pid];
        return playerBids && playerBids[tactic.id] === highestBid;
      });
      applySolTiebreakBonus(newState, highestBidder, tiedLosers);
    }

    if (!highestBidder || highestBid === 0) continue;

    const bidder = newState.players.find((p) => p.id === highestBidder)!;
    const currentProvFigures = newState.provinces[battle.provinceId];

    switch (tactic.id) {
      case 'seppuku': {
        // Kill own figures for VP and Honor
        // Monsters are intentionally included in seppuku - they die and return to reserve
        // just like bushi/daimyo, granting VP and honor per monster killed.
        const ownFigures = currentProvFigures.figures.filter(
          (f) => f.owner === highestBidder && (f.type === 'bushi' || f.type === 'shinto' || f.type === 'daimyo' || f.type === 'monster')
        );
        const killCount = ownFigures.length;
        let phoenixDiedInSeppuku = false;
        for (const fig of ownFigures) {
          bidder.victoryPoints += 1;
          if (fig.type === 'bushi') {
            bidder.bushi += 1;
          } else if (fig.type === 'shinto') {
            bidder.shinto += 1;
          } else if (fig.type === 'daimyo') {
            bidder.hasDaimyo = true;
          } else if (fig.type === 'monster') {
            bidder.monsters += 1;
            if (fig.monsterCardId === 'sp-phoenix') {
              phoenixDiedInSeppuku = true;
            }
          }
        }
        const killedIds = ownFigures.map((f) => f.id);
        newState.provinces[battle.provinceId] = {
          ...currentProvFigures,
          figures: currentProvFigures.figures.filter((f) => !killedIds.includes(f.id)),
        };
        // Phoenix revival
        if (phoenixDiedInSeppuku) {
          const figureId = Math.random().toString(36).substring(2, 10);
          const phoenixFigure = { type: 'monster' as const, owner: highestBidder!, id: figureId, monsterCardId: 'sp-phoenix' };
          newState.provinces[battle.provinceId] = {
            ...newState.provinces[battle.provinceId],
            figures: [...newState.provinces[battle.provinceId].figures, phoenixFigure],
          };
          bidder.monsters -= 1;
        }
        for (let i = 0; i < killCount; i++) {
          gainHonor(newState, highestBidder);
        }
        battleDeathCount += killCount;
        const seppukuHonorPos = getHonorRank(newState, highestBidder);
        newState.log = [...newState.log, `${bidder.name} comete Seppuku: elimina ${killCount} figuras por ${killCount} PV y ${killCount} Honor ahora ${bidder.victoryPoints} PV y posicion ${seppukuHonorPos} en Honor`];
        // Compute figure type breakdown for seppuku
        const figTypeCounts: Record<string, number> = {};
        for (const fig of ownFigures) {
          figTypeCounts[fig.type] = (figTypeCounts[fig.type] || 0) + 1;
        }
        seppukuFigures = Object.entries(figTypeCounts).map(([type, count]) => ({ type, count }));
        break;
      }
      case 'take-hostage': {
        // Capture 1 enemy Bushi/Shinto/Monster as hostage (Daimyo and daimyo-type monsters immune)
        const curProv = newState.provinces[battle.provinceId];
        const enemyFigure = curProv.figures.find(
          (f) => f.owner !== highestBidder && (f.type === 'bushi' || f.type === 'shinto' || (f.type === 'monster' && f.monsterCardId && !['su-yurei', 'sp-fukurokuju'].includes(f.monsterCardId)))
        );
        if (enemyFigure) {
          const hostage: Hostage = { fromClanId: enemyFigure.owner, figureType: enemyFigure.type };
          bidder.hostages.push(hostage);
          bidder.victoryPoints += 1;
          newState.provinces[battle.provinceId] = {
            ...curProv,
            figures: curProv.figures.filter((f) => f.id !== enemyFigure.id),
          };
          const victim = newState.players.find((p) => p.id === enemyFigure.owner);
          if (victim) {
            if (enemyFigure.type === 'bushi') victim.bushi += 1;
            else if (enemyFigure.type === 'shinto') victim.shinto += 1;
            else if (enemyFigure.type === 'monster') victim.monsters += 1;
          }
          newState.log = [...newState.log, `${bidder.name} toma un rehén de ${victim?.name}`];
        }
        break;
      }
      case 'hire-ronin': {
        // Ronin tokens add force (tracked for final calculation)
        let roninForce = bidder.ronin;
        if (bidder.clanId === 'koi') {
          // Koi clan: coins count as ronin, but only coins remaining after all bids
          const totalBidByBidder = Object.values(battle.warTacticBids[highestBidder] || {}).reduce((s, v) => s + v, 0);
          const remainingCoins = bidder.coins - totalBidByBidder;
          roninForce += Math.max(0, remainingCoins);
        }
        newState.log = [...newState.log, `${bidder.name} contrata ronin: +${roninForce} fuerza`];
        break;
      }
      case 'imperial-poets': {
        // Defer VP award until after battle casualties are calculated
        imperialPoetsBidder = highestBidder;
        break;
      }
    }
  }

  // After tactics: determine winner by total force
  const finalProvince = newState.provinces[battle.provinceId];
  let maxForce = 0;
  let winnerId: string | null = null;

  // Determine who won the hire-ronin tactic (using honor tiebreaker for equal bids)
  let hireRoninWinner: string | null = null;
  {
    let highestRoninBid = 0;
    battle.participants.forEach((pid) => {
      const playerBids = battle.warTacticBids[pid];
      const bid = playerBids?.['hire-ronin'] || 0;
      if (bid > highestRoninBid) {
        highestRoninBid = bid;
        hireRoninWinner = pid;
      } else if (bid === highestRoninBid && bid > 0) {
        // Tie-breaking by honor (lower index = better honor = wins)
        const currentHonor = newState.honorTrack.indexOf(hireRoninWinner!);
        const challengerHonor = newState.honorTrack.indexOf(pid);
        if (challengerHonor < currentHonor) {
          hireRoninWinner = pid;
        }
      }
    });
  }

  battle.participants.forEach((pid) => {
    const player = newState.players.find((p) => p.id === pid)!;
    let force = calculateForce(finalProvince, pid, newState);
    // Add ronin force only if this player won the hire-ronin tactic
    if (pid === hireRoninWinner) {
      force += player.ronin;
      // Koi clan power: coins also count as ronin for hire-ronin, but only remaining coins after bids
      if (player.clanId === 'koi') {
        const totalBidByPlayer = Object.values(battle.warTacticBids[pid] || {}).reduce((s, v) => s + v, 0);
        const remainingCoins = player.coins - totalBidByPlayer;
        force += Math.max(0, remainingCoins);
      }
    }
    if (force > maxForce) {
      maxForce = force;
      winnerId = pid;
    } else if (force === maxForce && force > 0) {
      const currentWinnerHonor = newState.honorTrack.indexOf(winnerId!);
      const challengerHonor = newState.honorTrack.indexOf(pid);
      if (challengerHonor < currentWinnerHonor) {
        winnerId = pid;
      }
    }
  });

  // Sol clan power: check if war force was tied and resolved by honor
  if (winnerId && maxForce > 0) {
    const tiedInWar = battle.participants.filter((pid) => {
      const player = newState.players.find((p) => p.id === pid)!;
      let force = calculateForce(finalProvince, pid, newState);
      if (pid === hireRoninWinner) {
        force += player.ronin;
        if (player.clanId === 'koi') {
          const totalBidByPlayer = Object.values(battle.warTacticBids[pid] || {}).reduce((s, v) => s + v, 0);
          const remainingCoins = player.coins - totalBidByPlayer;
          force += Math.max(0, remainingCoins);
        }
      }
      return force === maxForce;
    });
    if (tiedInWar.length > 1) {
      const losers = tiedInWar.filter((pid) => pid !== winnerId);
      applySolTiebreakBonus(newState, winnerId, losers);
    }
  }

  // Zero force edge case: if no player has force, the player with best honor among participants wins
  if (maxForce === 0 && !winnerId) {
    const sortedByHonor = [...battle.participants].sort((a, b) => {
      return newState.honorTrack.indexOf(a) - newState.honorTrack.indexOf(b);
    });
    winnerId = sortedByHonor[0];
  }

  if (winnerId) {
    battle.winner = winnerId;
    const winner = newState.players.find((p) => p.id === winnerId)!;

    // Winner gets the war province token
    const slot = state.warProvinceSlots.find((s) => s.provinceId === battle.provinceId);
    if (slot) {
      winner.warProvinceTokens.push({ season: slot.season, provinceId: slot.provinceId });
    }

    // Losing players' figures are killed (return to reserve).
    // Allied figures of the winner are also protected.
    const killedMap: Record<string, Record<string, number>> = {};
    battle.participants.forEach((pid) => {
      if (pid === winnerId) return;
      // Skip killing figures of players allied with the winner
      if (winner.allies.includes(pid)) return;
      const loserFigures = finalProvince.figures.filter((f) => f.owner === pid);
      loserFigures.forEach((fig) => {
        if (fig.type === 'fortress') return; // Fortresses immune
        const loser = newState.players.find((p) => p.id === pid)!;
        if (fig.type === 'bushi') loser.bushi += 1;
        else if (fig.type === 'shinto') loser.shinto += 1;
        else if (fig.type === 'daimyo') loser.hasDaimyo = true;
        else if (fig.type === 'monster') {
          loser.monsters += 1;
        }
        // Track killed figures for display
        if (!killedMap[pid]) killedMap[pid] = {};
        killedMap[pid][fig.type] = (killedMap[pid][fig.type] || 0) + 1;
      });
    });

    // Build killedFigures array from the map
    const killedFigures: { owner: string; figureType: string; count: number }[] = [];
    for (const ownerId of Object.keys(killedMap)) {
      for (const figType of Object.keys(killedMap[ownerId])) {
        killedFigures.push({ owner: ownerId, figureType: figType, count: killedMap[ownerId][figType] });
      }
    }
    battle.killedFigures = killedFigures;

    // Imperial Poets: award VP for total figures that died during this battle
    const battleCasualtyCount = killedFigures.reduce((sum, kf) => sum + kf.count, 0);
    // Check if Phoenix died in battle (relevant for step-by-step mode double-death tracking)
    let phoenixDiedInBattle = false;
    if (stepByStepMode && resData.phoenixDiedInSeppuku) {
      // Check if Phoenix was among the killed battle figures
      // (it would have been revived after seppuku, so if the owner lost, it dies again)
      const seppukuOwnerId = resData.seppukuWinnerId;
      if (seppukuOwnerId && seppukuOwnerId !== winnerId && !winner.allies.includes(seppukuOwnerId)) {
        // Verify Phoenix is actually still in the province (not captured as hostage)
        const phoenixStillPresent = finalProvince.figures.some(
          (f) => f.monsterCardId === 'sp-phoenix' && f.owner === seppukuOwnerId
        );
        if (phoenixStillPresent) {
          // The seppuku player lost the battle - their revived Phoenix died again
          phoenixDiedInBattle = true;
        }
      }
    }
    if (imperialPoetsBidder) {
      let totalDeaths = battleDeathCount + battleCasualtyCount;
      // In step-by-step mode, Phoenix dying in seppuku + battle = already counted once in battleDeathCount (seppuku)
      // and once in battleCasualtyCount (battle) so it's already 2. No additional adjustment needed.
      const poetsBidder = newState.players.find((p) => p.id === imperialPoetsBidder)!;
      poetsBidder.victoryPoints += totalDeaths;
      newState.log = [...newState.log, `${poetsBidder.name} obtiene ${totalDeaths} PV de Poetas Imperiales`];
      // Store on resolutionData for popup display
      if (stepByStepMode) {
        battle.resolutionData = {
          ...resData,
          phoenixDiedInBattle,
          battleDeathCount: battleCasualtyCount,
          imperialPoetsVP: totalDeaths,
          participantForces: preResolutionForces,
        };
      } else {
        battle.resolutionData = {
          seppukuWinnerId: null,
          hostageWinnerId: null,
          roninWinnerId: null,
          imperialPoetsWinnerId: imperialPoetsBidder,
          seppukuKillCount: 0,
          seppukuAccepted: false,
          phoenixDiedInSeppuku: false,
          phoenixDiedInBattle,
          capturedHostage: null,
          roninForce: 0,
          battleDeathCount: battleCasualtyCount,
          imperialPoetsVP: totalDeaths,
          seppukuFigures,
          participantForces: preResolutionForces,
        };
      }
    } else if (stepByStepMode) {
      battle.resolutionData = {
        ...resData,
        phoenixDiedInBattle,
        battleDeathCount: battleCasualtyCount,
        imperialPoetsVP: 0,
        participantForces: preResolutionForces,
      };
    } else {
      battle.resolutionData = {
        seppukuWinnerId: null,
        hostageWinnerId: null,
        roninWinnerId: null,
        imperialPoetsWinnerId: null,
        seppukuKillCount: 0,
        seppukuAccepted: false,
        phoenixDiedInSeppuku: false,
        phoenixDiedInBattle,
        capturedHostage: null,
        roninForce: 0,
        battleDeathCount: battleCasualtyCount,
        imperialPoetsVP: 0,
        seppukuFigures,
        participantForces: preResolutionForces,
      };
    }

    // Remove killed figures from province (keep winner's figures, allied figures, daimyos, and fortresses)
    newState.provinces[battle.provinceId] = {
      ...finalProvince,
      figures: finalProvince.figures.filter(
        (f) => f.owner === winnerId || winner.allies.includes(f.owner) || f.type === 'fortress'
      ),
    };

    // Distribute winner's bid coins equally to losers
    const winnerBids = battle.warTacticBids[winnerId];
    if (winnerBids) {
      const totalBid = Object.values(winnerBids).reduce((sum, v) => sum + v, 0);
      const losers = battle.participants.filter((pid) => pid !== winnerId);
      if (losers.length > 0 && totalBid > 0) {
        // Deduct coins from winner first
        winner.coins -= totalBid;
        newState.log = [...newState.log, `${winner.name} gastó ${totalBid} monedas en la batalla`];
        const share = Math.floor(totalBid / losers.length);
        const remainder = totalBid % losers.length;
        if (share > 0) {
          losers.forEach((pid) => {
            const loser = newState.players.find((p) => p.id === pid)!;
            loser.coins += share;
            newState.log = [...newState.log, `${loser.name} recibe ${share} monedas del ganador`];
          });
        }
        // Always show coin distribution popup to inform the winner of the distribution
        newState.coinDistributionPending = {
          battleProvinceId: battle.provinceId,
          winnerId,
          losers,
          remainder,
          distributed: share * losers.length,
          sharePerLoser: share,
        };
      }
    }

    // Losers discard their bid coins
    battle.participants.forEach((pid) => {
      if (pid === winnerId) return;
      const playerBids = battle.warTacticBids[pid];
      if (playerBids) {
        const totalBid = Object.values(playerBids).reduce((sum, v) => sum + v, 0);
        const loser = newState.players.find((p) => p.id === pid)!;
        loser.coins = Math.max(0, loser.coins - totalBid);
        if (totalBid > 0) {
          newState.log = [...newState.log, `${loser.name} descarta ${totalBid} monedas`];
        }
      }
    });

    newState.log = [...newState.log, `${winner.name} gana la batalla en ${finalProvince.name}!`];
  }

  newState.log = [...newState.log, `--- Batalla ${unresolvedIdx + 1} resuelta ---`];
  battle.resolved = true;
  return newState;
}

// ============================================================
// Cleanup & Winter
// ============================================================

export function cleanupSeason(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    lastMandateIssuerId: state.lastMandateIssuerId,
    players: state.players.map((p) => ({
      ...p,
      ronin: 0,
      coins: 0,
      allies: [],
      seasonCards: [...p.seasonCards],
      warProvinceTokens: [...p.warProvinceTokens],
      hostages: [...p.hostages],
      // Increment allianceSeasons if player has an ally this season
      allianceSeasons: p.allies.length > 0 ? p.allianceSeasons + 1 : p.allianceSeasons,
    })),
    temples: state.temples.map((t) => ({ ...t, figures: [] })),
    provinces: { ...state.provinces },
    mandatesDeck: shuffleMandates(),
    drawnMandates: [],
    mandateChoicePhase: false,
    lotoChoicePhase: false,
    lotoDiscardedMandate: null,
    mandatesThisTurn: [],
    activeBattles: [],
    allianceProposals: [],
    coinDistributionPending: null,
    politicsMandateCount: 0,
    trainMandateActive: false,
    trainResolutionOrder: [],
    trainResolutionIndex: 0,
    trainMandateIssuerId: null,
    teaTurnIndex: 0,
    warPhaseReadyPlayers: [],
    battlePopupReadyPlayers: [],
    warSummaryVisible: false,
    warSummaryReadyPlayers: [],
    battleResultReadyPlayers: [],
    hostageReturnActive: false,
    hostageReturnOrder: [],
    hostageReturnIndex: 0,
    hostageReturnReadyPlayers: [],
    cleanupTeaCeremonyReady: false,
    cleanupTeaCeremonyReadyPlayers: [],
    log: [...state.log, 'Limpieza: Ronin y monedas descartados, Shinto devueltos de los santuarios, alianzas rotas'],
  };

  // Return all Shinto from temples to reserves
  state.temples.forEach((temple) => {
    temple.figures.forEach((fig) => {
      const player = newState.players.find((p) => p.id === fig.playerId);
      if (player) {
        player.shinto += 1;
      }
    });
  });

  // Return hostages (+1 coin per hostage) during cleanup (for hotseat / non-interactive path)
  newState.players.forEach((player) => {
    if (player.hostages.length > 0) {
      player.coins += player.hostages.length;
      newState.log = [...newState.log, `${player.name} devuelve ${player.hostages.length} rehen(es) y gana ${player.hostages.length} moneda(s)`];
      player.hostages = [];
    }
  });

  return newState;
}

/**
 * Start the interactive cleanup phase for online mode.
 * Executes the "auto" parts of cleanup (coins=0, ronin=0, return shinto, break alliances)
 * then checks if any player has hostages to return interactively.
 */
export function startInteractiveCleanup(state: GameState): GameState {
  let newState: GameState = {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      ronin: 0,
      coins: 0,
      allies: [],
      seasonCards: [...p.seasonCards],
      warProvinceTokens: [...p.warProvinceTokens],
      hostages: [...p.hostages],
      // Increment allianceSeasons if player had an ally this season
      allianceSeasons: p.allies.length > 0 ? p.allianceSeasons + 1 : p.allianceSeasons,
    })),
    temples: state.temples.map((t) => ({ ...t, figures: [] })),
    allianceProposals: [],
    hostageReturnActive: false,
    hostageReturnOrder: [],
    hostageReturnIndex: 0,
    hostageReturnReadyPlayers: [],
    cleanupTeaCeremonyReady: false,
    cleanupTeaCeremonyReadyPlayers: [],
    log: [...state.log, 'Limpieza: Ronin y monedas descartados, Shinto devueltos de los santuarios, alianzas rotas'],
  };

  // Return all Shinto from temples to reserves
  state.temples.forEach((temple) => {
    temple.figures.forEach((fig) => {
      const player = newState.players.find((p) => p.id === fig.playerId);
      if (player) {
        player.shinto += 1;
      }
    });
  });

  // Determine which players have hostages (in turnOrder)
  const playersWithHostages = newState.turnOrder.filter(pid => {
    const player = newState.players.find(p => p.id === pid);
    return player && player.hostages.length > 0;
  });

  if (playersWithHostages.length > 0) {
    newState.hostageReturnActive = true;
    newState.hostageReturnOrder = playersWithHostages;
    newState.hostageReturnIndex = 0;
  } else {
    newState.cleanupTeaCeremonyReady = true;
  }

  return newState;
}

/**
 * Process a hostage return acceptance during interactive cleanup.
 * Returns coins to the player and clears their hostages.
 */
export function processHostageReturn(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    players: state.players.map(p => ({ ...p, hostages: [...p.hostages] })),
    log: [...state.log],
  };

  const currentPlayerId = newState.hostageReturnOrder[newState.hostageReturnIndex];
  const player = newState.players.find(p => p.id === currentPlayerId);
  if (!player) return newState;

  const coinsGained = player.hostages.length;
  player.coins += coinsGained;
  newState.log = [...newState.log, `${player.name} devuelve ${coinsGained} rehen(es) y gana ${coinsGained} moneda(s)`];
  player.hostages = [];

  newState.hostageReturnIndex += 1;

  if (newState.hostageReturnIndex >= newState.hostageReturnOrder.length) {
    newState.hostageReturnActive = false;
    newState.cleanupTeaCeremonyReady = true;
  }

  return newState;
}

/**
 * Finalize the cleanup phase after tea ceremony acceptance (online mode).
 * Advances to next season or winter without re-running full cleanupSeason.
 */
export function finalizeCleanupAndAdvance(state: GameState): GameState {
  let newState: GameState = {
    ...state,
    mandatesDeck: shuffleMandates(),
    drawnMandates: [],
    mandateChoicePhase: false,
    lotoChoicePhase: false,
    lotoDiscardedMandate: null,
    mandatesThisTurn: [],
    activeBattles: [],
    coinDistributionPending: null,
    politicsMandateCount: 0,
    trainMandateActive: false,
    trainResolutionOrder: [],
    trainResolutionIndex: 0,
    trainMandateIssuerId: null,
    teaTurnIndex: 0,
    warPhaseReadyPlayers: [],
    battlePopupReadyPlayers: [],
    warSummaryVisible: false,
    warSummaryReadyPlayers: [],
    battleResultReadyPlayers: [],
    coinDistributionReadyPlayers: [],
    hostageReturnActive: false,
    hostageReturnOrder: [],
    hostageReturnIndex: 0,
    hostageReturnReadyPlayers: [],
    cleanupTeaCeremonyReady: false,
    cleanupTeaCeremonyReadyPlayers: [],
    log: [...state.log],
  };

  // Advance to next season or winter
  const seasons: Season[] = ['spring', 'summer', 'autumn'];
  const idx = seasons.indexOf(newState.currentSeason);
  if (idx >= 2) {
    // After autumn, go to winter
    newState = resolveWinter(newState);
  } else {
    const nextSeason = seasons[idx + 1];
    newState.round += 1;
    newState = setupSeason(newState, nextSeason);
  }

  return newState;
}

export function resolveWinter(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    currentPhase: 'winter' as const,
    currentSeason: 'winter' as const,
    players: state.players.map((p) => ({ ...p, warProvinceTokens: [...p.warProvinceTokens], hostages: [...p.hostages], seasonCards: [...p.seasonCards] })),
    log: [...state.log, 'Invierno - Puntuación Final'],
  };

  // Return hostages (+1 coin each)
  newState.players.forEach((player) => {
    if (player.hostages.length > 0) {
      player.coins += player.hostages.length;
      player.hostages = [];
    }
  });

  // Score winter upgrades
  newState.players.forEach((player) => {
    player.seasonCards.forEach((card) => {
      if (card.cardType === 'winterUpgrade') {
        const vp = scoreWinterUpgrade(newState, player, card);
        player.victoryPoints += vp;
        if (vp > 0) {
          newState.log = [...newState.log, `${player.name} anota ${vp} PV de ${card.name}`];
        }
      }
    });
  });

  // Score war province tokens (spring=1VP, summer=2VP, autumn=3VP)
  newState.players.forEach((player) => {
    let tokenVP = 0;
    player.warProvinceTokens.forEach((token) => {
      switch (token.season) {
        case 'spring': tokenVP += 1; break;
        case 'summer': tokenVP += 2; break;
        case 'autumn': tokenVP += 3; break;
      }
    });
    if (tokenVP > 0) {
      player.victoryPoints += tokenVP;
      newState.log = [...newState.log, `${player.name} anota ${tokenVP} PV de fichas de provincia de guerra`];
    }
  });

  // Score province token sets (3-4 different=10VP, 5-6=20VP, 7-8=30VP)
  newState.players.forEach((player) => {
    const uniqueProvinces = new Set(player.warProvinceTokens.map((t) => t.provinceId));
    const count = uniqueProvinces.size;
    let setVP = 0;
    if (count >= 7) setVP = 30;
    else if (count >= 5) setVP = 20;
    else if (count >= 3) setVP = 10;

    if (setVP > 0) {
      player.victoryPoints += setVP;
      newState.log = [...newState.log, `${player.name} anota ${setVP} PV por set de fichas de provincia (${count} unicas)`];
    }
  });

  // Determine winner (most VP, ties broken by honor)
  let maxVP = -1;
  let winnerId: string | null = null;
  newState.players.forEach((player) => {
    if (player.victoryPoints > maxVP) {
      maxVP = player.victoryPoints;
      winnerId = player.id;
    } else if (player.victoryPoints === maxVP) {
      const currentWinnerHonor = newState.honorTrack.indexOf(winnerId!);
      const challengerHonor = newState.honorTrack.indexOf(player.id);
      if (challengerHonor < currentWinnerHonor) {
        winnerId = player.id;
      }
    }
  });

  // Sol clan power: bonus on end-game VP tiebreak
  if (winnerId) {
    const tiedPlayers = newState.players.filter((p) => p.victoryPoints === maxVP);
    if (tiedPlayers.length > 1) {
      const losers = tiedPlayers.filter((p) => p.id !== winnerId).map((p) => p.id);
      applySolTiebreakBonus(newState, winnerId, losers);
    }
  }

  // Check for allied players sharing victory
  if (winnerId) {
    const winner = newState.players.find((p) => p.id === winnerId)!;
    if (winner.allies.length > 0) {
      const ally = newState.players.find((p) => p.id === winner.allies[0]);
      if (ally && ally.victoryPoints === maxVP) {
        newState.log = [...newState.log, `${winner.name} y ${ally.name} comparten la victoria con ${maxVP} PV!`];
      } else {
        newState.log = [...newState.log, `${winner.name} gana con ${maxVP} PV!`];
      }
    } else {
      newState.log = [...newState.log, `${winner.name} gana con ${maxVP} PV!`];
    }
  }

  newState.winner = winnerId ?? undefined;
  newState.gameOver = true;

  return newState;
}

function scoreWinterUpgrade(gameState: GameState, player: Player, card: SeasonCard): number {
  // Normalize card ID by stripping '-2' suffix for duplicate cards
  const baseCardId = card.id.endsWith('-2') ? card.id.slice(0, -2) : card.id;
  switch (baseCardId) {
    case 'au-form-of-the-beast': {
      const monsters = player.seasonCards.filter((c) => c.cardType === 'monster');
      return monsters.length * 3;
    }
    case 'au-form-of-the-demon': {
      const onis = player.seasonCards.filter((c) => c.name.toLowerCase().includes('oni'));
      return onis.length * 3;
    }
    case 'au-form-of-the-dragon': {
      return player.warProvinceTokens.length;
    }
    case 'au-form-of-the-fox': {
      let count = 0;
      Object.values(gameState.provinces).forEach((province) => {
        const figs = province.figures.filter((f) => f.owner === player.id);
        if (figs.length === 1) count++;
      });
      return count * 3;
    }
    case 'au-form-of-the-kindred': {
      // 3 VP per season the player had an ally (max 9 over 3 seasons)
      return Math.min(player.allianceSeasons, 3) * 3;
    }
    case 'au-form-of-the-kitsune': {
      let fortCount = 0;
      Object.values(gameState.provinces).forEach((province) => {
        fortCount += province.figures.filter((f) => f.owner === player.id && f.type === 'fortress').length;
      });
      return fortCount * 3;
    }
    case 'au-form-of-the-phoenix': {
      const virtues = player.seasonCards.filter((c) => c.cardType === 'virtue');
      return virtues.length * 3;
    }
    case 'au-form-of-the-tanuki': {
      const types = new Set(player.seasonCards.map((c) => c.cardType));
      return types.size * 2;
    }
    default:
      return 0;
  }
}

// ============================================================
// Movement & Utility
// ============================================================

export function moveForces(
  state: GameState,
  playerId: string,
  fromProvinceId: string,
  toProvinceId: string,
  figureIds: string[]
): GameState {
  const newState: GameState = {
    ...state,
    provinces: { ...state.provinces },
    log: [...state.log],
  };

  const fromProvince = newState.provinces[fromProvinceId];
  const toProvince = newState.provinces[toProvinceId];
  if (!fromProvince || !toProvince) return state;

  // During marshal mandate, enforce movement rules - process figures one by one
  if (state.marshalMandateActive) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return state;

    // Process each figure individually
    let currentFromFigures = [...fromProvince.figures];
    let currentToFigures = [...toProvince.figures];
    let movedFigureIds: string[] = [...state.marshalMovedFigures];
    let logEntries: string[] = [...newState.log];
    let anyMoved = false;

    for (const figureId of figureIds) {
      // Reject if figure already moved this turn
      if (movedFigureIds.includes(figureId)) continue;

      // Find the figure in current from-province figures
      const figure = currentFromFigures.find(f => f.id === figureId && f.owner === playerId);
      if (!figure) continue;

      // Reject fortress movement unless player is Tortuga clan
      if (figure.type === 'fortress' && player.clanId !== 'tortuga') continue;

      // Adjacency check: skip for Libelula clan (can move anywhere)
      if (player.clanId !== 'libelula') {
        if (!isValidMove(fromProvinceId, toProvinceId)) continue;
      } else {
        // Libelula can move to any province except the same one
        if (fromProvinceId === toProvinceId) continue;
      }

      // Luna clan power: max 2 figures per province (excluding fortresses)
      if (player.clanId === 'luna' && figure.type !== 'fortress') {
        const lunaFiguresInDest = currentToFigures.filter(
          (f) => f.owner === playerId && f.type !== 'fortress'
        ).length;
        if (lunaFiguresInDest >= 2) continue;
      }

      // Move the figure
      currentFromFigures = currentFromFigures.filter(f => f.id !== figureId);
      currentToFigures = [...currentToFigures, figure];
      movedFigureIds = [...movedFigureIds, figureId];
      anyMoved = true;

      const figureDisplayName = figure.type === 'monster'
        ? `monster(${player.seasonCards.find(c => c.cardType === 'monster')?.name || 'monster'})`
        : figure.type;
      logEntries = [...logEntries, `${player.name} mueve ${figureDisplayName} de ${fromProvince.name} a ${toProvince.name}`];
    }

    if (!anyMoved) return state;

    newState.provinces[fromProvinceId] = { ...fromProvince, figures: currentFromFigures };
    newState.provinces[toProvinceId] = { ...toProvince, figures: currentToFigures };
    newState.marshalMovedFigures = movedFigureIds;
    newState.log = logEntries;

    return newState;
  }

  // During Fujin kami resolution, enforce single-figure movement (like marshal) but without move tracking
  if (state.kamiResolutionActive && state.fujinMovesRemaining > 0) {
    // Only accept a single figureId at a time
    if (figureIds.length !== 1) return state;

    const figureId = figureIds[0];

    // Find the figure
    const figure = fromProvince.figures.find(f => f.id === figureId && f.owner === playerId);
    if (!figure) return state;

    // Reject fortress movement unless player is Tortuga clan
    const player = state.players.find(p => p.id === playerId);
    if (!player) return state;

    if (figure.type === 'fortress' && player.clanId !== 'tortuga') return state;

    // Adjacency check: skip for Libelula clan (can move anywhere)
    if (player.clanId !== 'libelula') {
      if (!isValidMove(fromProvinceId, toProvinceId)) return state;
    } else {
      // Libelula can move to any province except the same one
      if (fromProvinceId === toProvinceId) return state;
    }

    // Luna clan power: max 2 figures per province (excluding fortresses)
    if (player.clanId === 'luna' && figure.type !== 'fortress') {
      const lunaFiguresInDest = toProvince.figures.filter(
        (f) => f.owner === playerId && f.type !== 'fortress'
      ).length;
      if (lunaFiguresInDest >= 2) return state;
    }

    // Move the figure - no tracking (same figure can move twice)
    const movedFigures = [figure];
    const remainingFigures = fromProvince.figures.filter(f => f.id !== figureId);

    newState.provinces[fromProvinceId] = { ...fromProvince, figures: remainingFigures };
    newState.provinces[toProvinceId] = { ...toProvince, figures: [...toProvince.figures, ...movedFigures] };

    const figureDisplayName = figure.type === 'monster'
      ? `monster(${player.seasonCards.find(c => c.cardType === 'monster')?.name || 'monster'})`
      : figure.type;
    newState.log = [...newState.log, `${player.name} mueve ${figureDisplayName} de ${fromProvince.name} a ${toProvince.name} (Fujin)`];

    return newState;
  }

  // Non-marshal movement (standard)
  // Check valid move (adjacent or sea route)
  if (!isValidMove(fromProvinceId, toProvinceId)) return state;

  // Verify all figures belong to the player and are in the source province
  const figuresValid = figureIds.every((fid) =>
    fromProvince.figures.some((f) => f.id === fid && f.owner === playerId)
  );
  if (!figuresValid) return state;

  // Move figures
  const movedFigures = fromProvince.figures.filter((f) => figureIds.includes(f.id));
  const remainingFigures = fromProvince.figures.filter((f) => !figureIds.includes(f.id));

  newState.provinces[fromProvinceId] = { ...fromProvince, figures: remainingFigures };
  newState.provinces[toProvinceId] = { ...toProvince, figures: [...toProvince.figures, ...movedFigures] };

  const player = newState.players.find((p) => p.id === playerId);
  if (player) {
    newState.log = [...newState.log, `${player.name} mueve ${figureIds.length} figuras de ${fromProvince.name} a ${toProvince.name}`];
  }

  return newState;
}

export function isValidMove(fromProvinceId: string, toProvinceId: string): boolean {
  const fromProvince = PROVINCES_DATA.find((p) => p.id === fromProvinceId);
  if (!fromProvince) return false;

  // Check direct adjacency
  if (fromProvince.adjacentProvinces.includes(toProvinceId)) return true;

  // Check sea routes
  if (fromProvince.seaRoutes.includes(toProvinceId)) return true;

  return false;
}

// ============================================================
// Season Card Helpers
// ============================================================

export function getPlayerSeasonCardEffects(state: GameState, playerId: string): SeasonCard[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  return player.seasonCards;
}

/**
 * Sol clan power: when Sol wins a tiebreak by honor, Sol gains 1 coin + 1 VP,
 * and the tied losers lose 1 coin + 1 VP (if they have them).
 */
function applySolTiebreakBonus(state: GameState, winnerId: string, losers: string[]): void {
  const winner = state.players.find((p) => p.id === winnerId);
  if (!winner || winner.clanId !== 'sol') return;

  winner.coins += 1;
  winner.victoryPoints += 1;
  for (const loserId of losers) {
    const loser = state.players.find((p) => p.id === loserId);
    if (loser) {
      if (loser.coins > 0) loser.coins -= 1;
      if (loser.victoryPoints > 0) loser.victoryPoints -= 1;
    }
  }
  state.log = [...state.log, `${winner.name} (Sol) gana 1 Moneda y 1 PV por empate y ganar en Honor a ${losers.map((id) => state.players.find((p) => p.id === id)?.name ?? id).join(', ')} que pierde 1 Moneda y 1 PV`];
}

/**
 * Helper to check if a player has a card by base ID, accounting for duplicate
 * cards that have a '-2' suffix (e.g. 'su-path-of-might-2').
 */
function hasCard(cardIds: Set<string>, baseId: string): boolean {
  return cardIds.has(baseId) || cardIds.has(baseId + '-2');
}

export function calculateForce(province: Province & { figures: Figure[] }, playerId: string, state: GameState): number {
  const playerFigures = province.figures.filter((f) => f.owner === playerId);

  const playerCards = getPlayerSeasonCardEffects(state, playerId);
  const cardIds = new Set(playerCards.map((c) => c.id));

  const player = state.players.find((p) => p.id === playerId);
  const isLuna = player?.clanId === 'luna';
  const isTortuga = player?.clanId === 'tortuga';

  // Check if any Oni monster is present in this province (any owner)
  const provinceHasOni = province.figures.some(
    (f) => f.type === 'monster' && f.monsterCardId && f.monsterCardId.includes('oni-of-')
  );

  let totalForce = 0;

  for (const fig of playerFigures) {
    // Fortresses do NOT count as force for anyone except Tortuga (handled post-loop)
    if (fig.type === 'fortress') {
      continue;
    }

    let figForce = isLuna ? 2 : 1; // Luna base force is 2, others 1

    if (fig.type === 'daimyo') {
      if (hasCard(cardIds, 'sp-path-of-the-lion')) {
        figForce += 1; // Daimyo +1 force
      }
      if (hasCard(cardIds, 'au-path-of-the-dragon')) {
        figForce += 3; // Daimyo +3 force
      }
      if (IS_DEV) {
        console.log('[calculateForce] daimyo check:', { playerId, cardIds: [...cardIds], hasLion: hasCard(cardIds, 'sp-path-of-the-lion'), figForce });
      }
    }

    if (fig.type === 'shinto' && hasCard(cardIds, 'su-path-of-the-favored')) {
      // Shinto counts as Force 3 in provinces where owner has highest honor
      // honorTrack[0] = best honor (index 0 = honor position 1)
      const highestHonorPlayerId = state.honorTrack[0];
      if (highestHonorPlayerId === playerId) {
        figForce = isLuna ? Math.max(3, figForce) : 3; // Replace base force with 3 (Luna keeps max)
      }
    }

    if (fig.type === 'bushi') {
      if (hasCard(cardIds, 'au-way-of-the-katana') && state.currentPhase === 'war') {
        // All bushi have Force 2 during war phase
        figForce = isLuna ? Math.max(2, figForce) : 2; // Replace base force with 2 (Luna already has 2)
      }
      if (hasCard(cardIds, 'su-path-of-might') && provinceHasOni) {
        // Bushi in Province with any Oni have Force +1
        figForce += 1;
      }
    }

    if (fig.type === 'monster' && fig.monsterCardId) {
      if (fig.monsterCardId === 'sp-oni-of-skulls') {
        const ownerIds = [...new Set(province.figures.map(f => f.owner))];
        const ownerHonorIndex = state.honorTrack.indexOf(playerId);
        const hasLowestHonor = ownerIds.every(id => {
          const idx = state.honorTrack.indexOf(id);
          return idx <= ownerHonorIndex;
        });
        figForce = hasLowestHonor ? 3 : 1;
        if (isLuna) figForce = Math.max(figForce, 2);
      } else if (fig.monsterCardId === 'su-oni-of-blood') {
        const ownerIds = [...new Set(province.figures.map(f => f.owner))];
        const ownerHonorIndex = state.honorTrack.indexOf(playerId);
        const hasLowestHonor = ownerIds.every(id => {
          const idx = state.honorTrack.indexOf(id);
          return idx <= ownerHonorIndex;
        });
        figForce = hasLowestHonor ? 4 : 2;
        if (isLuna) figForce = Math.max(figForce, 2);
      } else if (fig.monsterCardId === 'sp-daikokuten') {
        figForce = (state.currentPhase === 'politics' && state.harvestMandateActive) ? 8 : 1;
        if (isLuna) figForce = Math.max(figForce, 2);
      } else {
        // Other monsters with defined force always use their card force
        const allCards = [...SPRING_CARDS, ...SUMMER_CARDS, ...AUTUMN_CARDS];
        const monsterCard = allCards.find(c => c.id === fig.monsterCardId);
        if (monsterCard && monsterCard.force !== undefined) {
          figForce = isLuna ? Math.max(monsterCard.force, 2) : monsterCard.force;
        }
      }
    }

    totalForce += figForce;
  }

  // Tortuga clan power: each fortress in the province counts as 1 force
  if (isTortuga) {
    const fortressCount = province.figures.filter((f) => f.owner === playerId && f.type === 'fortress').length;
    totalForce += fortressCount;
  }

  return totalForce;
}

export function getHonorRank(state: GameState, playerId: string): number {
  return state.honorTrack.indexOf(playerId) + 1;
}

function syncHonorValues(state: GameState): void {
  state.honorTrack.forEach((pid, i) => {
    const p = state.players.find(pl => pl.id === pid);
    if (p) p.honor = i + 1;
  });
}

export function gainHonor(state: GameState, playerId: string): void {
  const idx = state.honorTrack.indexOf(playerId);
  if (idx > 0) {
    // Move toward index 0 = better honor (lower index = higher honor)
    [state.honorTrack[idx], state.honorTrack[idx - 1]] = [state.honorTrack[idx - 1], state.honorTrack[idx]];
  }
  syncHonorValues(state);
}

export function loseHonor(state: GameState, playerId: string): void {
  const idx = state.honorTrack.indexOf(playerId);
  if (idx < state.honorTrack.length - 1) {
    // Move toward higher index = worse honor (lower index = higher honor)
    [state.honorTrack[idx], state.honorTrack[idx + 1]] = [state.honorTrack[idx + 1], state.honorTrack[idx]];
  }
  syncHonorValues(state);
}

// ============================================================
// Phase Advancement
// ============================================================

export function advancePhase(state: GameState): GameState {
  let newState: GameState = { ...state, log: [...state.log] };

  switch (newState.currentPhase) {
    case 'tea': {
      newState.currentPhase = 'politics';
      newState.politicsMandateCount = 0;
      newState.trainMandateActive = false;
      newState.marshalMandateActive = false;
      newState.marshalResolutionOrder = [];
      newState.marshalResolutionIndex = 0;
      newState.marshalMandateIssuerId = null;
      newState.marshalFortressBuiltBy = [];
      newState.marshalMovedFigures = [];
      newState.betrayMandateActive = false;
      newState.betraySelectionsRemaining = 0;
      newState.betraySelectedOwners = [];
      newState.betrayMandateIssuerId = null;
      newState.drawnMandates = [];
      newState.mandateChoicePhase = false;
      newState.lotoChoicePhase = false;
      newState.lotoDiscardedMandate = null;

      // Determine the first player for mandate turns
      let firstPlayerId: string;
      if (newState.currentSeason === 'spring') {
        // In Spring: the player with honor position 1 (honorTrack[0] = best honor) starts
        firstPlayerId = newState.honorTrack[0];
      } else {
        // In Summer/Autumn: the player to the LEFT (clockwise in seating/turnOrder) of lastMandateIssuerId
        if (newState.lastMandateIssuerId) {
          const lastIssuerIdx = newState.turnOrder.indexOf(newState.lastMandateIssuerId);
          firstPlayerId = newState.turnOrder[(lastIssuerIdx + 1) % newState.turnOrder.length];
        } else {
          // Fallback: use honor position 1 if no last issuer tracked
          firstPlayerId = newState.honorTrack[0];
        }
      }
      const firstPlayerIdx = newState.players.findIndex(p => p.id === firstPlayerId);
      newState.currentPlayerIndex = firstPlayerIdx >= 0 ? firstPlayerIdx : 0;

      const firstPlayer = newState.players[newState.currentPlayerIndex];
      newState.log = [...newState.log, `Comienza la Fase de Política - ${firstPlayer?.name ?? 'Jugador'} toma el primer turno de mandato`];
      break;
    }
    case 'politics':
      newState = initiateWarPhase(newState);
      // If no battles were created, auto-advance to cleanup
      if (newState.activeBattles.filter(b => !b.resolved).length === 0) {
        newState.currentPhase = 'cleanup';
        newState.log = [...newState.log, 'No hay batallas por resolver - pasando a Limpieza'];
      }
      break;
    case 'war': {
      newState.currentPhase = 'cleanup';
      newState.log = [...newState.log, 'Comienza la Fase de Limpieza'];
      break;
    }
    case 'cleanup': {
      // Run cleanup
      newState = cleanupSeason(newState);
      // Advance to next season or winter
      const seasons: Season[] = ['spring', 'summer', 'autumn'];
      const idx = seasons.indexOf(newState.currentSeason);
      if (idx >= 2) {
        // After autumn, go to winter
        newState = resolveWinter(newState);
      } else {
        // Advance to next season via setupSeason (which transitions to tea internally)
        const nextSeason = seasons[idx + 1];
        newState.round += 1;
        newState = setupSeason(newState, nextSeason);
      }
      break;
    }
    case 'winter':
      // Game is over
      break;
  }

  return newState;
}

export function advancePlayer(state: GameState): GameState {
  // Handle tea phase advancement separately
  if (state.currentPhase === 'tea') {
    return advanceTeaPlayer(state);
  }

  // Politics phase advancement
  const newState: GameState = { ...state, drawnMandates: [], mandateChoicePhase: false, trainMandateActive: false, trainResolutionOrder: [], trainResolutionIndex: 0, trainMandateIssuerId: null, marshalMandateActive: false, marshalResolutionOrder: [], marshalResolutionIndex: 0, marshalMandateIssuerId: null, marshalFortressBuiltBy: [], marshalMovedFigures: [], recruitMandateActive: false, recruitResolutionOrder: [], recruitResolutionIndex: 0, recruitMandateIssuerId: null, recruitPlacementsRemaining: 0, recruitUsedFortressProvinces: [], betrayMandateActive: false, betraySelectionsRemaining: 0, betraySelectedOwners: [], betrayReplacements: [], betrayMandateIssuerId: null, log: [...state.log] };
  newState.politicsMandateCount += 1;

  // Helper: advance to the next player in seating order (turnOrder)
  const advanceToNextInSeating = (currentIndex: number): number => {
    const currentPlayerId = newState.players[currentIndex]?.id;
    const seatIdx = newState.turnOrder.indexOf(currentPlayerId);
    const nextSeatIdx = (seatIdx + 1) % newState.turnOrder.length;
    const nextPlayerId = newState.turnOrder[nextSeatIdx];
    const nextPlayerIdx = newState.players.findIndex(p => p.id === nextPlayerId);
    return nextPlayerIdx >= 0 ? nextPlayerIdx : (currentIndex + 1) % newState.players.length;
  };

  // Determine the issuer of the last mandate to compute the next chooser
  const lastIssuer = newState.mandatesThisTurn[newState.mandatesThisTurn.length - 1]?.issuer;
  const issuerPlayerIdx = lastIssuer ? newState.players.findIndex(p => p.id === lastIssuer) : -1;
  const referenceIdx = issuerPlayerIdx >= 0 ? issuerPlayerIdx : newState.currentPlayerIndex;

  // Check if we need a kami turn
  if (isKamiTurn(newState.politicsMandateCount)) {
    // Instead of resolving all temples at once, compute temple results and enter step-by-step resolution
    const sortedTemples = [...newState.temples].sort((a, b) => a.position - b.position);
    const kamiResolutionTemples: KamiResolutionTemple[] = [];

    for (const temple of sortedTemples) {
      const { forces } = computeTempleWinner(temple.figures, newState.honorTrack, newState.players);
      const kamiData = KAMI_DATA.find(k => k.type === temple.kamiType);

      // Skip empty temples (no figures = no winner, no need to show popup)
      if (forces.length === 0) {
        newState.log = [...newState.log, `Santuario ${temple.position} (${kamiData?.name || temple.kamiType}) - sin figuras, saltado`];
        continue;
      }

      // Do NOT pre-compute winnerId here. It will be computed dynamically when the temple
      // is resolved, using the CURRENT honorTrack at that moment (important for tiebreaking
      // after Amaterasu moves the winner to position 0).
      const templeIndex = newState.temples.findIndex(t => t.id === temple.id);
      kamiResolutionTemples.push({
        templeIndex,
        kamiType: temple.kamiType,
        winnerId: null,
        reward: kamiData?.effect || '',
        forces,
      });
    }

    // If no temples have any figures, skip kami resolution entirely
    if (kamiResolutionTemples.length === 0) {
      newState.log = [...newState.log, 'Turno Kami - ningún santuario con figuras, saltando'];
      // Continue with normal flow: check if politics done or advance to next player
      if (newState.politicsMandateCount >= newState.maxMandates) {
        return advancePhase(newState);
      }
      newState.currentPlayerIndex = advanceToNextInSeating(referenceIdx);
      return newState;
    }

    // Set pending flag - store will show popup first, then activate resolution
    newState.kamiPhasePopupPending = true;
    newState.kamiResolutionTemples = kamiResolutionTemples;
    newState.kamiResolutionIndex = 0;
    newState.kamiResolutionStep = 'showing';
    // Compute the winner for the first temple dynamically using the current honorTrack
    const firstTemple = kamiResolutionTemples[0];
    let firstWinnerId: string | null = null;
    if (firstTemple && firstTemple.forces.length > 0) {
      const { winnerId: computedWinnerId } = computeTempleWinner(
        newState.temples[firstTemple.templeIndex].figures,
        newState.honorTrack,
        newState.players
      );
      firstWinnerId = computedWinnerId;
      // Store computed winnerId back into the temple data
      kamiResolutionTemples[0] = { ...firstTemple, winnerId: firstWinnerId };

      // Compute susanoo VP if applicable
      if (firstTemple.kamiType === 'susanoo' && firstWinnerId) {
        let fortressCount = 0;
        Object.values(newState.provinces).forEach((province) => {
          fortressCount += province.figures.filter(
            (f) => f.owner === firstWinnerId && f.type === 'fortress'
          ).length;
        });
        kamiResolutionTemples[0] = { ...kamiResolutionTemples[0], susanooVPGained: fortressCount };
      }
    }
    newState.kamiResolutionCurrentPlayerId = firstWinnerId;
    newState.kamiResolutionNextPlayerIndex = advanceToNextInSeating(referenceIdx);
    newState.log = [...newState.log, '--- Turno Kami ---'];
    return newState;
  }

  // Check if politics phase is done
  if (newState.politicsMandateCount >= newState.maxMandates) {
    return advancePhase(newState);
  }

  // Move to next player in seating order after the MANDATE ISSUER (not after currentPlayerIndex)
  newState.currentPlayerIndex = advanceToNextInSeating(referenceIdx);
  return newState;
}

/**
 * Check if a player can still meaningfully act during the tea ceremony.
 * A player can act if they have no ally AND have not opted out AND at least one other player
 * also has no ally and has not opted out (i.e., there is a potential alliance partner available).
 */
function canPlayerActInTea(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  // If the player already has an ally, they cannot propose/accept
  if (player.allies.length > 0) return false;
  // If the player has opted out of alliances, they cannot act
  if (state.teaOptedOut.includes(playerId)) return false;
  // If there is a pending proposal TO this player, they can accept/reject
  const hasIncomingProposal = state.allianceProposals.some(ap => ap.to === playerId);
  if (hasIncomingProposal) return true;
  // Check if there is at least one other unallied, non-opted-out player to propose to
  const hasUnalliedPartner = state.players.some(
    p => p.id !== playerId && p.allies.length === 0 && !state.teaOptedOut.includes(p.id)
  );
  return hasUnalliedPartner;
}

/**
 * Determines if the tea phase should end in online (simultaneous) mode.
 * Returns true if every player either:
 *   (a) has an ally, OR
 *   (b) has opted out (is in teaOptedOut), OR
 *   (c) is the only unallied/non-opted-out player remaining (no possible partner)
 */
export function shouldEndTeaPhase(state: GameState): boolean {
  const unalliedAndActive = state.players.filter(
    p => p.allies.length === 0 && !state.teaOptedOut.includes(p.id)
  );
  // If 0 or 1 unallied/non-opted-out players remain, tea should end
  return unalliedAndActive.length <= 1;
}

/**
 * Advance the tea phase: increment teaTurnIndex, and when all players
 * have had their turn, auto-advance to politics phase.
 * If there are pending alliance proposals whose targets have not yet had
 * their tea turn, give those targets a chance to respond before ending.
 */
export function advanceTeaPlayer(state: GameState): GameState {
  const newState: GameState = { ...state, log: [...state.log] };

  // If teaTurnIndex is already >= players.length, we are in the "pending proposals" resolution phase.
  // Do NOT increment teaTurnIndex further.
  if (newState.teaTurnIndex >= newState.players.length) {
    // Check if there are pending proposals whose targets need a turn to respond
    if (newState.allianceProposals.length > 0) {
      // Find targets of pending proposals who are still unallied and are not the current player
      const currentPlayer = newState.players[newState.currentPlayerIndex];
      // Remove any proposals TO the current player (they chose to pass/end their turn)
      newState.allianceProposals = newState.allianceProposals.filter(
        ap => ap.to !== currentPlayer?.id
      );

      // Find remaining pending targets
      const pendingTargets = newState.allianceProposals
        .map(ap => ap.to)
        .filter(toId => {
          const targetPlayer = newState.players.find(p => p.id === toId);
          return targetPlayer && targetPlayer.allies.length === 0;
        });

      if (pendingTargets.length > 0) {
        // Give the first pending target their turn to accept/reject
        const targetId = pendingTargets[0];
        const targetIdx = newState.players.findIndex(p => p.id === targetId);
        if (targetIdx >= 0) {
          newState.currentPlayerIndex = targetIdx;
          return newState;
        }
      }
    }

    // No pending proposals remaining - advance to politics
    newState.teaTurnIndex = 0;
    return advancePhase(newState);
  }

  // Normal turn advancement: increment teaTurnIndex
  newState.teaTurnIndex += 1;

  // When all players have had a tea turn, check for pending proposals
  if (newState.teaTurnIndex >= newState.players.length) {
    // Check if there are pending proposals whose targets need a turn to respond
    if (newState.allianceProposals.length > 0) {
      // Find targets of pending proposals who are still unallied
      const pendingTargets = newState.allianceProposals
        .map(ap => ap.to)
        .filter(toId => {
          const targetPlayer = newState.players.find(p => p.id === toId);
          return targetPlayer && targetPlayer.allies.length === 0;
        });

      if (pendingTargets.length > 0) {
        // Give the first pending target their turn to accept/reject
        const targetId = pendingTargets[0];
        const targetIdx = newState.players.findIndex(p => p.id === targetId);
        if (targetIdx >= 0) {
          newState.currentPlayerIndex = targetIdx;
          return newState;
        }
      }
    }

    // No pending proposals (or all targets already allied) - advance to politics
    newState.teaTurnIndex = 0;
    return advancePhase(newState);
  }

  // Move to next player following turnOrder, skipping players who cannot act.
  // Scan for the next valid player WITHOUT mutating teaTurnIndex inside the loop.
  const currentPlayer = newState.players[newState.currentPlayerIndex];
  const currentTurnOrderIdx = newState.turnOrder.indexOf(currentPlayer?.id ?? '');
  let nextTurnOrderIdx = (currentTurnOrderIdx + 1) % newState.turnOrder.length;
  let nextPlayerId = '';
  let nextPlayerIdx = -1;
  let scanned = 0;
  let skippedCount = 0;

  while (scanned < newState.players.length) {
    nextPlayerId = newState.turnOrder[nextTurnOrderIdx];
    nextPlayerIdx = newState.players.findIndex(p => p.id === nextPlayerId);
    if (nextPlayerIdx >= 0 && canPlayerActInTea(newState, nextPlayerId)) {
      // Found a valid player
      break;
    }
    // This player is skipped
    skippedCount++;
    nextTurnOrderIdx = (nextTurnOrderIdx + 1) % newState.turnOrder.length;
    scanned++;
  }

  // If we scanned all players without finding anyone who can act, advance the phase
  if (scanned >= newState.players.length) {
    // Before advancing, check for pending proposals
    if (newState.allianceProposals.length > 0) {
      const pendingTargets = newState.allianceProposals
        .map(ap => ap.to)
        .filter(toId => {
          const targetPlayer = newState.players.find(p => p.id === toId);
          return targetPlayer && targetPlayer.allies.length === 0;
        });

      if (pendingTargets.length > 0) {
        const targetId = pendingTargets[0];
        const targetIdx = newState.players.findIndex(p => p.id === targetId);
        if (targetIdx >= 0) {
          newState.currentPlayerIndex = targetIdx;
          return newState;
        }
      }
    }
    newState.teaTurnIndex = 0;
    return advancePhase(newState);
  }

  // Now apply the skipped count to teaTurnIndex after the scan completes
  newState.teaTurnIndex += skippedCount;

  // Check if after accounting for skipped players we have exhausted the round
  if (newState.teaTurnIndex >= newState.players.length) {
    // Check for pending proposals before advancing
    if (newState.allianceProposals.length > 0) {
      const pendingTargets = newState.allianceProposals
        .map(ap => ap.to)
        .filter(toId => {
          const targetPlayer = newState.players.find(p => p.id === toId);
          return targetPlayer && targetPlayer.allies.length === 0;
        });

      if (pendingTargets.length > 0) {
        const targetId = pendingTargets[0];
        const targetIdx = newState.players.findIndex(p => p.id === targetId);
        if (targetIdx >= 0) {
          newState.currentPlayerIndex = targetIdx;
          return newState;
        }
      }
    }
    newState.teaTurnIndex = 0;
    return advancePhase(newState);
  }

  newState.currentPlayerIndex = nextPlayerIdx >= 0 ? nextPlayerIdx : (newState.currentPlayerIndex + 1) % newState.players.length;
  return newState;
}

/**
 * Skip the current Train mandate purchase opportunity.
 * Advances to the next player in the train resolution order,
 * or clears the train state if all players have had their turn.
 */
export function skipTrainPurchase(state: GameState): GameState {
  if (!state.trainMandateActive) return state;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const newState: GameState = {
    ...state,
    trainResolutionIndex: state.trainResolutionIndex + 1,
    log: [...state.log, `${currentPlayer?.name ?? 'Jugador'} no compra carta`],
  };
  return advanceTrainResolution(newState);
}

/**
 * After a player buys or skips during a Train mandate, advance to the
 * next player in resolution order. If all players have had their turn,
 * clear the train state.
 */
export function advanceTrainResolution(state: GameState): GameState {
  if (state.trainResolutionIndex >= state.trainResolutionOrder.length) {
    // All players have had their turn - clear train mandate
    return {
      ...state,
      trainMandateActive: false,
      trainResolutionOrder: [],
      trainResolutionIndex: 0,
      trainMandateIssuerId: null,
    };
  }
  // Set currentPlayerIndex to the next player in resolution order
  const nextPlayerId = state.trainResolutionOrder[state.trainResolutionIndex];
  const nextPlayerIdx = state.players.findIndex(p => p.id === nextPlayerId);
  if (nextPlayerIdx >= 0) {
    return { ...state, currentPlayerIndex: nextPlayerIdx };
  }
  return state;
}

/**
 * Skip the current Marshal mandate turn (end the current player's marshal turn).
 * Advances to the next player in the marshal resolution order,
 * or clears the marshal state if all players have had their turn.
 */
export function skipMarshalTurn(state: GameState): GameState {
  if (!state.marshalMandateActive) return state;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const newState: GameState = {
    ...state,
    marshalResolutionIndex: state.marshalResolutionIndex + 1,
    marshalMovedFigures: [],
    log: [...state.log, `${currentPlayer?.name ?? 'Jugador'} termina su turno de movilizar`],
  };
  return advanceMarshalResolution(newState);
}

/**
 * Advance to the next player in the marshal resolution order.
 * If all players have had their turn, clear the marshal state.
 */
export function advanceMarshalResolution(state: GameState): GameState {
  if (state.marshalResolutionIndex >= state.marshalResolutionOrder.length) {
    // All players have had their turn - clear marshal mandate
    return {
      ...state,
      marshalMandateActive: false,
      marshalResolutionOrder: [],
      marshalResolutionIndex: 0,
      marshalMandateIssuerId: null,
      marshalFortressBuiltBy: [],
      marshalMovedFigures: [],
    };
  }
  // Set currentPlayerIndex to the next player in resolution order
  const nextPlayerId = state.marshalResolutionOrder[state.marshalResolutionIndex];
  const nextPlayerIdx = state.players.findIndex(p => p.id === nextPlayerId);
  if (nextPlayerIdx >= 0) {
    return { ...state, currentPlayerIndex: nextPlayerIdx };
  }
  return state;
}

/**
 * Build a fortress in any province during a Marshal mandate.
 * Only issuer or ally can build, costs 3 coins, requires fortress in reserve.
 */
export function buildFortress(state: GameState, playerId: string, provinceId: string): GameState {
  if (!state.marshalMandateActive) return state;
  if (!state.marshalMandateIssuerId) return state;
  if (!isIssuerOrAlly(state, playerId, state.marshalMandateIssuerId)) return state;
  if (state.marshalFortressBuiltBy.includes(playerId)) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  // Bonsai clan power: fortress costs max 1 coin instead of 3
  const fortressCost = player.clanId === 'bonsai' ? 1 : 3;
  if (player.coins < fortressCost) return state;
  if (player.fortresses <= 0) return state;

  const province = state.provinces[provinceId];
  if (!province) return state;

  const newState: GameState = {
    ...state,
    players: state.players.map((p) => {
      if (p.id === playerId) {
        return { ...p, coins: p.coins - fortressCost, fortresses: p.fortresses - 1 };
      }
      return { ...p };
    }),
    provinces: {
      ...state.provinces,
      [provinceId]: {
        ...province,
        figures: [...province.figures, createFigure('fortress', playerId)],
      },
    },
    marshalFortressBuiltBy: [...state.marshalFortressBuiltBy, playerId],
    log: [...state.log, `${player.name} construye una fortaleza en ${province.name} (${fortressCost} monedas)`],
  };
  return newState;
}

/**
 * Place Fukurokuju as a fortress during Marshal mandate.
 * Costs 3 coins (1 for Bonsai), can be placed in ANY province.
 * Consumes the marshal fortress build slot. Does NOT use fortress reserve.
 */
export function buildFukurokuju(state: GameState, playerId: string, provinceId: string): GameState {
  if (!state.marshalMandateActive) return state;
  if (!state.marshalMandateIssuerId) return state;
  if (!isIssuerOrAlly(state, playerId, state.marshalMandateIssuerId)) return state;
  if (state.marshalFortressBuiltBy.includes(playerId)) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  // Check player has Fukurokuju in seasonCards
  const hasFukurokujuCard = player.seasonCards.some(c => c.id === 'sp-fukurokuju');
  if (!hasFukurokujuCard) return state;

  // Check Fukurokuju is not already deployed on the map
  const alreadyDeployed = Object.values(state.provinces).some(prov =>
    prov.figures.some(f => f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju' && f.owner === playerId)
  );
  if (alreadyDeployed) return state;

  // Bonsai clan power: fortress costs max 1 coin instead of 3
  const fortressCost = player.clanId === 'bonsai' ? 1 : 3;
  if (player.coins < fortressCost) return state;

  const province = state.provinces[provinceId];
  if (!province) return state;

  const figureId = Math.random().toString(36).substring(2, 10);
  const fukurokujuFigure = { type: 'monster' as const, owner: playerId, id: figureId, monsterCardId: 'sp-fukurokuju' };

  const newState: GameState = {
    ...state,
    players: state.players.map((p) => {
      if (p.id === playerId) {
        return { ...p, coins: p.coins - fortressCost };
      }
      return { ...p };
    }),
    provinces: {
      ...state.provinces,
      [provinceId]: {
        ...province,
        figures: [...province.figures, fukurokujuFigure],
      },
    },
    marshalFortressBuiltBy: [...state.marshalFortressBuiltBy, playerId],
    log: [...state.log, `${player.name} despliega a Fukurokuju en ${province.name} (${fortressCost} monedas)`],
  };
  return newState;
}

export function getCurrentPlayer(state: GameState): Player | undefined {
  return state.players[state.currentPlayerIndex];
}

/**
 * Determines tactic winners from bids without resolving - used to drive step-by-step popups.
 * Shared between client (gameStore) and server for online battle resolution.
 */
export function determineTacticWinners(state: GameState, battle: { provinceId: string; participants: string[]; warTacticBids: { [playerId: string]: { [tacticId: string]: number } } }): BattleResolutionData {
  const result: BattleResolutionData = {
    seppukuWinnerId: null,
    hostageWinnerId: null,
    roninWinnerId: null,
    imperialPoetsWinnerId: null,
    seppukuKillCount: 0,
    seppukuAccepted: false,
    phoenixDiedInSeppuku: false,
    phoenixDiedInBattle: false,
    capturedHostage: null,
    roninForce: 0,
    battleDeathCount: 0,
    imperialPoetsVP: 0,
    participantForces: battle.participants.map(pid => ({
      playerId: pid,
      force: calculateForce(state.provinces[battle.provinceId], pid, state),
    })),
  };

  for (const tactic of WAR_TACTICS) {
    let highestBid = 0;
    let highestBidder: string | null = null;

    battle.participants.forEach((pid) => {
      const playerBids = battle.warTacticBids[pid];
      const bid = playerBids?.[tactic.id] || 0;
      if (bid > highestBid) {
        highestBid = bid;
        highestBidder = pid;
      } else if (bid === highestBid && bid > 0 && highestBidder) {
        // Tie-breaking by honor
        const currentHonor = state.honorTrack.indexOf(highestBidder);
        const challengerHonor = state.honorTrack.indexOf(pid);
        if (challengerHonor < currentHonor) {
          highestBidder = pid;
        }
      }
    });

    if (!highestBidder || highestBid === 0) continue;

    switch (tactic.id) {
      case 'seppuku':
        result.seppukuWinnerId = highestBidder;
        break;
      case 'take-hostage':
        result.hostageWinnerId = highestBidder;
        break;
      case 'hire-ronin':
        result.roninWinnerId = highestBidder;
        break;
      case 'imperial-poets':
        result.imperialPoetsWinnerId = highestBidder;
        break;
    }
  }

  return result;
}
