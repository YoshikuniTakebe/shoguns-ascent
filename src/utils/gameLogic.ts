import type {
  GameState, Player, Province, Season, MandateType,
  Battle, Figure, Temple, WarProvinceSlot, SeasonCard,
  AllianceProposal, Hostage,
} from '../types/game';
import {
  CLANS, PROVINCES_DATA, HOME_PROVINCES, WAR_TACTICS,
  KAMI_DATA, SPRING_CARDS, SUMMER_CARDS, AUTUMN_CARDS,
} from '../types/game';

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
// Game Initialization
// ============================================================

export function createInitialGameState(
  players: { name: string; clanId: string }[],
  mode: 'online' | 'hotseat',
  hostId?: string
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
      fortresses: 2,
      seasonCards: [],
      warProvinceTokens: [],
      allies: [],
      hostages: [],
      isReady: false,
      allianceSeasons: 0,
    };
  });

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

  // Create initial temples (4 random kami types)
  const shuffledKami = shuffle(KAMI_DATA);
  const temples: Temple[] = shuffledKami.slice(0, 4).map((kami, idx) => ({
    id: `temple-${idx}`,
    position: idx + 1,
    kamiType: kami.type,
    figures: [],
  }));

  // Prepare mandate deck
  const mandatesDeck = shuffleMandates();

  // Create turn order based on honor (highest honor goes first)
  const turnOrder = [...gamePlayers]
    .sort((a, b) => b.honor - a.honor)
    .map((p) => p.id);

  const state: GameState = {
    id: generateId(),
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
    seasonCardsDeck: [...SPRING_CARDS],
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
    gameOver: false,
    log: ['Game started! Season: Spring'],
    hostId,
  };

  return state;
}

function shuffleMandates(): MandateType[] {
  return shuffle<MandateType>([
    'recruit', 'recruit', 'recruit', 'recruit', 'recruit', 'recruit',
    'marshal', 'marshal', 'marshal', 'marshal', 'marshal', 'marshal',
    'train', 'train', 'train', 'train', 'train',
    'harvest', 'harvest', 'harvest', 'harvest', 'harvest', 'harvest',
    'betray', 'betray', 'betray', 'betray', 'betray',
  ]);
}

// ============================================================
// Season Setup
// ============================================================

export function setupSeason(state: GameState, season: Season): GameState {
  let newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, seasonCards: [...p.seasonCards], warProvinceTokens: [...p.warProvinceTokens], hostages: [...p.hostages], allies: [...p.allies] })),
    provinces: { ...state.provinces },
    warProvinceSlots: [] as WarProvinceSlot[],
    currentSeason: season,
    currentPhase: 'seasonSetup' as const,
    log: [...state.log, `Season Setup: ${season.charAt(0).toUpperCase() + season.slice(1)}`],
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

  // Set season cards for current season
  switch (season) {
    case 'spring':
      newState.seasonCardsDeck = [...SPRING_CARDS];
      break;
    case 'summer':
      newState.seasonCardsDeck = [...SUMMER_CARDS];
      break;
    case 'autumn':
      newState.seasonCardsDeck = [...AUTUMN_CARDS];
      break;
  }

  // Calculate and distribute seasonal income
  newState = distributeSeasonalIncome(newState);

  // Return hostages (gain 1 coin per hostage returned)
  newState = returnHostages(newState);

  newState.log = [...newState.log, `War province tokens placed on ${selectedProvinces.length} provinces`];

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
  // Income based on provinces controlled (where player has most force)
  let income = 0;
  Object.values(state.provinces).forEach((province) => {
    const playerForce = calculateForce(province, playerId);
    if (playerForce > 0) {
      const isStrongest = state.players.every((other) => {
        if (other.id === playerId) return true;
        return calculateForce(province, other.id) <= playerForce;
      });
      if (isStrongest) {
        income += province.harvestReward;
      }
    }
  });
  // Minimum income of 1 coin per season
  return Math.max(income, 1);
}

function returnHostages(state: GameState): GameState {
  const newState = { ...state, players: state.players.map((p) => ({ ...p, hostages: [...p.hostages] })), log: [...state.log] };
  newState.players.forEach((player) => {
    if (player.hostages.length > 0) {
      player.coins += player.hostages.length;
      newState.log = [...newState.log, `${player.name} returns ${player.hostages.length} hostage(s), gains ${player.hostages.length} coin(s)`];
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
    log: [...state.log, 'All alliances broken for Tea Ceremony'],
  };
  return newState;
}

export function proposeAlliance(state: GameState, fromId: string, toId: string): GameState {
  const newState = { ...state, allianceProposals: [...state.allianceProposals], log: [...state.log] };
  const from = newState.players.find((p) => p.id === fromId);
  const to = newState.players.find((p) => p.id === toId);
  if (!from || !to) return state;

  // Cannot propose if either already has an ally
  if (from.allies.length > 0 || to.allies.length > 0) return state;

  // Check for duplicate proposals
  const existing = newState.allianceProposals.find(
    (ap) => (ap.from === fromId && ap.to === toId) || (ap.from === toId && ap.to === fromId)
  );
  if (existing) return state;

  const proposal: AllianceProposal = { from: fromId, to: toId };
  newState.allianceProposals.push(proposal);
  newState.log = [...newState.log, `${from.name} proposes alliance to ${to.name}`];
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

  from.allies = [toId];
  to.allies = [fromId];
  newState.allianceProposals = newState.allianceProposals.filter(
    (ap) => !(ap.from === fromId && ap.to === toId) && !(ap.from === toId && ap.to === fromId)
  );
  newState.log = [...newState.log, `${from.name} and ${to.name} form an alliance!`];
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
    newState.log = [...newState.log, 'Mandate deck reshuffled'];
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
  let newState: GameState = { ...state, mandatesDeck: [...state.mandatesDeck], drawnMandates: [...state.drawnMandates], trainMandateActive: false };
  const chosenIdx = newState.drawnMandates.indexOf(mandate);
  if (chosenIdx === -1) return state;

  // Remove chosen mandate from drawn tiles
  newState.drawnMandates.splice(chosenIdx, 1);
  // Return remaining mandates to deck (face down)
  newState.mandatesDeck = [...newState.drawnMandates, ...newState.mandatesDeck];
  newState.drawnMandates = [];
  newState.mandateChoicePhase = false;

  // Execute the mandate
  newState = executeMandate(newState, mandate, playerId);
  return newState;
}

export function executeMandate(state: GameState, mandate: MandateType, playerId: string): GameState {
  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, allies: [...p.allies], seasonCards: [...p.seasonCards] })),
    provinces: { ...state.provinces },
    mandatesThisTurn: [...state.mandatesThisTurn, { type: mandate, issuer: playerId, executed: false }],
    log: [...state.log],
  };
  const player = newState.players.find((p) => p.id === playerId);
  if (!player) return state;

  newState.log = [...newState.log, `${player.name} issues ${mandate.toUpperCase()} mandate`];

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
  const newState: GameState = { ...state, provinces: { ...state.provinces }, players: state.players.map((p) => ({ ...p })), log: [...state.log] };

  // Resolution order: starting from left of issuer
  const order = getResolutionOrder(state, issuerId);

  // All players place 1 Bushi from reserve in a province with their Fortress
  for (const pid of order) {
    const player = newState.players.find((p) => p.id === pid)!;
    if (player.bushi <= 0) continue;

    // Find a province with this player's fortress
    const fortressProvince = Object.entries(newState.provinces).find(([_id, prov]) =>
      prov.figures.some((f) => f.owner === pid && f.type === 'fortress')
    );
    if (fortressProvince) {
      const [provId, prov] = fortressProvince;
      newState.provinces[provId] = { ...prov, figures: [...prov.figures, createFigure('bushi', pid)] };
      player.bushi -= 1;
    }

    // Bonus for issuer and ally: +1 extra Bushi
    if (isIssuerOrAlly(newState, pid, issuerId) && player.bushi > 0) {
      const bonusProvince = Object.entries(newState.provinces).find(([_id, prov]) =>
        prov.figures.some((f) => f.owner === pid && f.type === 'fortress')
      );
      if (bonusProvince) {
        const [provId, prov] = bonusProvince;
        newState.provinces[provId] = { ...prov, figures: [...prov.figures, createFigure('bushi', pid)] };
        player.bushi -= 1;
      }
    }
  }

  newState.log = [...newState.log, 'All players recruit Bushi at their Fortresses'];
  return newState;
}

function executeMarshal(state: GameState, issuerId: string): GameState {
  // Marshal: Each player may move 1 figure to an adjacent province
  // Bonus for issuer/ally: +1 extra move
  // Movement is UI-driven: each player uses moveForces() through the UI.
  // In hotseat mode, the current player can move during their turn.
  const issuer = state.players.find((p) => p.id === issuerId);
  const bonusPlayers = state.players
    .filter((p) => isIssuerOrAlly(state, p.id, issuerId))
    .map((p) => p.name);
  const bonusNote = bonusPlayers.length > 0
    ? ` (${bonusPlayers.join(', ')} may move 1 additional figure)`
    : '';
  const newState: GameState = {
    ...state,
    log: [...state.log, `Marshal mandate issued by ${issuer?.name} - all players may move 1 figure to an adjacent province${bonusNote}. Use Move Forces to execute.`],
  };
  return newState;
}

function executeTrain(state: GameState, issuerId: string): GameState {
  // Train: All players may buy 1 season card from the market by paying its cost
  // Bonus: buy at -1 cost or gain 1 coin
  // Give bonus coin to issuer and ally
  const bonusPlayers = state.players.map((p) => {
    if (isIssuerOrAlly(state, p.id, issuerId)) {
      return { ...p, coins: p.coins + 1 };
    }
    return { ...p };
  });
  const newState: GameState = {
    ...state,
    players: bonusPlayers,
    trainMandateActive: true,
    log: [...state.log, 'Train mandate issued - players may buy 1 season card from the market. Use the Season Cards Market to purchase.'],
  };
  return newState;
}

export function buySeasonCard(state: GameState, playerId: string, cardId: string): GameState {
  // Can only buy during politics phase when Train mandate is active
  if (!state.trainMandateActive || state.currentPhase !== 'politics') return state;

  const card = state.seasonCardsDeck.find((c) => c.id === cardId);
  if (!card) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  // Check if player can afford the card
  if (player.coins < card.cost) return state;

  const newState: GameState = {
    ...state,
    players: state.players.map((p) => {
      if (p.id === playerId) {
        return {
          ...p,
          coins: p.coins - card.cost,
          seasonCards: [...p.seasonCards, card],
        };
      }
      return { ...p };
    }),
    seasonCardsDeck: state.seasonCardsDeck.filter((c) => c.id !== cardId),
    log: [...state.log, `${player.name} buys ${card.name} for ${card.cost} coin(s)`],
  };

  return newState;
}

function executeHarvest(state: GameState, issuerId: string): GameState {
  const newState: GameState = { ...state, players: state.players.map((p) => ({ ...p })), log: [...state.log] };

  // For each province, the player with the most force gains the harvest reward
  Object.values(newState.provinces).forEach((province) => {
    let maxForce = 0;
    let strongestId: string | null = null;
    let tied = false;

    newState.players.forEach((player) => {
      const force = calculateForce(province, player.id);
      if (force > maxForce) {
        maxForce = force;
        strongestId = player.id;
        tied = false;
      } else if (force === maxForce && force > 0) {
        tied = true;
      }
    });

    // Ties broken by honor (higher honor wins)
    if (tied && maxForce > 0) {
      const tiedPlayers = newState.players.filter(
        (p) => calculateForce(province, p.id) === maxForce
      );
      strongestId = tiedPlayers.sort((a, b) => {
        const aIdx = newState.honorTrack.indexOf(a.id);
        const bIdx = newState.honorTrack.indexOf(b.id);
        return bIdx - aIdx; // Higher index = higher honor
      })[0]?.id ?? null;
    }

    if (strongestId && maxForce > 0) {
      const winner = newState.players.find((p) => p.id === strongestId)!;
      winner.coins += province.harvestReward;
    }
  });

  // Bonus: issuer (and ally) gain reward from 1 additional province where they are present
  const issuer = newState.players.find((p) => p.id === issuerId);
  if (issuer) {
    const bonusRecipients = [issuerId, ...(issuer.allies || [])];
    bonusRecipients.forEach((pid) => {
      const player = newState.players.find((p) => p.id === pid);
      if (!player) return;
      // Find a province where player is present but not strongest
      const bonusProvince = Object.values(newState.provinces).find((province) => {
        const force = calculateForce(province, pid);
        if (force <= 0) return false;
        const isStrongest = newState.players.every((other) => {
          if (other.id === pid) return true;
          return calculateForce(province, other.id) < force;
        });
        return !isStrongest;
      });
      if (bonusProvince) {
        player.coins += bonusProvince.harvestReward;
      }
    });
  }

  newState.log = [...newState.log, 'Harvest rewards distributed to strongest players in each province'];
  return newState;
}

function executeBetray(state: GameState, issuerId: string): GameState {
  const newState: GameState = {
    ...state,
    provinces: { ...state.provinces },
    players: state.players.map((p) => ({ ...p })),
    honorTrack: [...state.honorTrack],
    log: [...state.log],
  };

  const order = getResolutionOrder(state, issuerId);

  for (const pid of order) {
    const player = newState.players.find((p) => p.id === pid)!;
    if (player.bushi <= 0) continue;

    // Find a province where player shares with an opponent's Bushi
    const sharedProvince = Object.entries(newState.provinces).find(([_id, prov]) => {
      const hasOwn = prov.figures.some((f) => f.owner === pid && (f.type === 'bushi' || f.type === 'daimyo'));
      const hasEnemy = prov.figures.some((f) => f.owner !== pid && f.type === 'bushi');
      return hasOwn && hasEnemy;
    });

    if (sharedProvince) {
      const [provId, prov] = sharedProvince;
      // Replace 1 enemy Bushi with own Bushi from reserve
      const enemyBushi = prov.figures.find((f) => f.owner !== pid && f.type === 'bushi');
      if (enemyBushi) {
        const newFigures = prov.figures.filter((f) => f.id !== enemyBushi.id);
        newFigures.push(createFigure('bushi', pid));
        newState.provinces[provId] = { ...prov, figures: newFigures };
        player.bushi -= 1;

        // Return the replaced figure to its owner's reserve
        const victim = newState.players.find((p) => p.id === enemyBushi.owner);
        if (victim) {
          victim.bushi += 1;
        }

        // Lose honor
        loseHonor(newState, pid);
      }
    }

    // Bonus: issuer and ally replace 1 additional figure
    if (isIssuerOrAlly(newState, pid, issuerId) && player.bushi > 0) {
      const bonusProvince = Object.entries(newState.provinces).find(([_id, prov]) => {
        const hasOwn = prov.figures.some((f) => f.owner === pid && (f.type === 'bushi' || f.type === 'daimyo'));
        const hasEnemy = prov.figures.some((f) => f.owner !== pid && f.type === 'bushi');
        return hasOwn && hasEnemy;
      });
      if (bonusProvince) {
        const [provId, prov] = bonusProvince;
        const enemyBushi = prov.figures.find((f) => f.owner !== pid && f.type === 'bushi');
        if (enemyBushi) {
          const newFigures = prov.figures.filter((f) => f.id !== enemyBushi.id);
          newFigures.push(createFigure('bushi', pid));
          newState.provinces[provId] = { ...prov, figures: newFigures };
          player.bushi -= 1;
          const victim = newState.players.find((p) => p.id === enemyBushi.owner);
          if (victim) {
            victim.bushi += 1;
          }
        }
      }
    }
  }

  newState.log = [...newState.log, 'Betray mandate resolved - players may replace enemy figures'];
  return newState;
}

// ============================================================
// Kami Turns
// ============================================================

export function resolveKamiTurn(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    temples: state.temples.map((t) => ({ ...t, figures: [...t.figures] })),
    log: [...state.log, 'Kami Turn - resolving temple majorities'],
  };

  // For each temple (left to right by position)
  const sortedTemples = [...newState.temples].sort((a, b) => a.position - b.position);

  for (const temple of sortedTemples) {
    // Count Shinto force per player at this temple
    const forces: { [playerId: string]: number } = {};
    temple.figures.forEach((fig) => {
      forces[fig.playerId] = (forces[fig.playerId] || 0) + 1;
    });

    if (Object.keys(forces).length === 0) continue;

    // Find player with most Shinto force
    let maxForce = 0;
    let winnerId: string | null = null;

    Object.entries(forces).forEach(([pid, force]) => {
      if (force > maxForce) {
        maxForce = force;
        winnerId = pid;
      } else if (force === maxForce) {
        // Ties broken by honor (higher honor wins)
        const currentWinnerHonor = newState.honorTrack.indexOf(winnerId!);
        const challengerHonor = newState.honorTrack.indexOf(pid);
        if (challengerHonor > currentWinnerHonor) {
          winnerId = pid;
        }
      }
    });

    if (winnerId) {
      const winner = newState.players.find((p) => p.id === winnerId);
      const kamiData = KAMI_DATA.find((k) => k.type === temple.kamiType);
      if (winner && kamiData) {
        newState.log = [...newState.log, `${winner.name} gains ${kamiData.name} ability at temple ${temple.position}`];
      }
    }
  }

  return newState;
}

// ============================================================
// War Phase
// ============================================================

export function initiateWarPhase(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    currentPhase: 'war' as const,
    activeBattles: [],
    players: state.players.map((p) => ({ ...p, warProvinceTokens: [...p.warProvinceTokens] })),
    log: [...state.log, 'War Phase begins - resolving battles'],
  };

  // Sort war province slots by number (ascending order)
  const sortedSlots = [...newState.warProvinceSlots].sort((a, b) => a.number - b.number);

  // Create battles for provinces with war tokens
  for (const slot of sortedSlots) {
    const province = newState.provinces[slot.provinceId];
    if (!province) continue;

    // Get unique players with figures in this province
    const playerIds = [...new Set(province.figures.map((f) => f.owner))];

    if (playerIds.length === 0) {
      // Empty province - discard token
      newState.log = [...newState.log, `${province.name}: empty - war token discarded`];
      continue;
    }

    if (playerIds.length === 1) {
      // Solo player wins token without battle
      const winnerId = playerIds[0];
      const winner = newState.players.find((p) => p.id === winnerId);
      if (winner) {
        winner.warProvinceTokens = [...winner.warProvinceTokens, { season: slot.season, provinceId: slot.provinceId }];
        newState.log = [...newState.log, `${winner.name} wins war token in ${province.name} (uncontested)`];
      }
      continue;
    }

    // Check if all players are allied to each other (2 allied players)
    if (playerIds.length === 2) {
      const p1 = newState.players.find((p) => p.id === playerIds[0]);
      const p2 = newState.players.find((p) => p.id === playerIds[1]);
      if (p1 && p2 && p1.allies.includes(p2.id)) {
        // Two allies - strongest wins without battle
        const force1 = calculateForce(province, p1.id);
        const force2 = calculateForce(province, p2.id);
        const winner = force1 >= force2 ? p1 : p2;
        winner.warProvinceTokens = [...winner.warProvinceTokens, { season: slot.season, provinceId: slot.provinceId }];
        newState.log = [...newState.log, `${winner.name} wins war token in ${province.name} (allied - no battle)`];
        continue;
      }
    }

    // 2+ non-allied players - full battle
    const battle: Battle = {
      provinceId: slot.provinceId,
      participants: playerIds,
      warTacticBids: {},
      resolved: false,
    };
    newState.activeBattles.push(battle);
  }

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
  const unresolvedIdx = state.activeBattles.findIndex((b) => !b.resolved);
  if (unresolvedIdx === -1) return state;

  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, warProvinceTokens: [...p.warProvinceTokens], hostages: [...p.hostages] })),
    provinces: { ...state.provinces },
    activeBattles: state.activeBattles.map((b) => ({ ...b, warTacticBids: { ...b.warTacticBids } })),
    log: [...state.log],
  };

  const battle = newState.activeBattles[unresolvedIdx];
  const province = newState.provinces[battle.provinceId];
  if (!province) {
    battle.resolved = true;
    return newState;
  }

  // Resolve War Tactics (left to right: Seppuku, Take Hostage, Hire Ronin, Imperial Poets)
  const sortedTactics = [...WAR_TACTICS].sort((a, b) => a.order - b.order);

  for (const tactic of sortedTactics) {
    // Find highest bidder for this tactic
    let highestBid = 0;
    let highestBidder: string | null = null;

    battle.participants.forEach((pid) => {
      const playerBids = battle.warTacticBids[pid];
      if (playerBids && playerBids[tactic.id] > highestBid) {
        highestBid = playerBids[tactic.id];
        highestBidder = pid;
      } else if (playerBids && playerBids[tactic.id] === highestBid && highestBid > 0) {
        // Tie-breaking by honor
        const currentHonor = newState.honorTrack.indexOf(highestBidder!);
        const challengerHonor = newState.honorTrack.indexOf(pid);
        if (challengerHonor > currentHonor) {
          highestBidder = pid;
        }
      }
    });

    if (!highestBidder || highestBid === 0) continue;

    const bidder = newState.players.find((p) => p.id === highestBidder)!;
    const currentProvFigures = newState.provinces[battle.provinceId];

    switch (tactic.id) {
      case 'seppuku': {
        // Kill own figures for VP and Honor
        const ownFigures = currentProvFigures.figures.filter(
          (f) => f.owner === highestBidder && f.type === 'bushi'
        );
        const killCount = Math.min(ownFigures.length, highestBid);
        for (let i = 0; i < killCount; i++) {
          bidder.victoryPoints += 1;
          bidder.bushi += 1;
        }
        const killedIds = ownFigures.slice(0, killCount).map((f) => f.id);
        newState.provinces[battle.provinceId] = {
          ...currentProvFigures,
          figures: currentProvFigures.figures.filter((f) => !killedIds.includes(f.id)),
        };
        gainHonor(newState, highestBidder);
        newState.log = [...newState.log, `${bidder.name} commits Seppuku: kills ${killCount} figures for VP and Honor`];
        break;
      }
      case 'take-hostage': {
        // Capture 1 enemy Bushi/Shinto as hostage (Daimyo immune)
        const curProv = newState.provinces[battle.provinceId];
        const enemyFigure = curProv.figures.find(
          (f) => f.owner !== highestBidder && (f.type === 'bushi' || f.type === 'shinto')
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
          }
          newState.log = [...newState.log, `${bidder.name} takes a hostage from ${victim?.name}`];
        }
        break;
      }
      case 'hire-ronin': {
        // Ronin tokens add force (tracked for final calculation)
        newState.log = [...newState.log, `${bidder.name} hires ronin: +${bidder.ronin} force`];
        break;
      }
      case 'imperial-poets': {
        // Gain VP per figure in battle
        const curProvIP = newState.provinces[battle.provinceId];
        const figureCount = curProvIP.figures.filter((f) => f.owner === highestBidder).length;
        bidder.victoryPoints += figureCount;
        newState.log = [...newState.log, `${bidder.name} gains ${figureCount} VP from Imperial Poets`];
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
        // Tie-breaking by honor (higher honor wins)
        const currentHonor = newState.honorTrack.indexOf(hireRoninWinner!);
        const challengerHonor = newState.honorTrack.indexOf(pid);
        if (challengerHonor > currentHonor) {
          hireRoninWinner = pid;
        }
      }
    });
  }

  battle.participants.forEach((pid) => {
    const player = newState.players.find((p) => p.id === pid)!;
    let force = calculateForce(finalProvince, pid);
    // Add ronin force only if this player won the hire-ronin tactic
    if (pid === hireRoninWinner) {
      force += player.ronin;
    }
    if (force > maxForce) {
      maxForce = force;
      winnerId = pid;
    } else if (force === maxForce && force > 0) {
      const currentWinnerHonor = newState.honorTrack.indexOf(winnerId!);
      const challengerHonor = newState.honorTrack.indexOf(pid);
      if (challengerHonor > currentWinnerHonor) {
        winnerId = pid;
      }
    }
  });

  if (winnerId) {
    battle.winner = winnerId;
    const winner = newState.players.find((p) => p.id === winnerId)!;

    // Winner gets the war province token
    const slot = state.warProvinceSlots.find((s) => s.provinceId === battle.provinceId);
    if (slot) {
      winner.warProvinceTokens.push({ season: slot.season, provinceId: slot.provinceId });
    }

    // Losing players' figures are killed (return to reserve). Daimyo is immune to kill effects.
    battle.participants.forEach((pid) => {
      if (pid === winnerId) return;
      const loserFigures = finalProvince.figures.filter((f) => f.owner === pid);
      loserFigures.forEach((fig) => {
        if (fig.type === 'daimyo') return; // Daimyo immune
        const loser = newState.players.find((p) => p.id === pid)!;
        if (fig.type === 'bushi') loser.bushi += 1;
        else if (fig.type === 'shinto') loser.shinto += 1;
      });
    });

    // Remove killed figures from province (keep winner's figures, keep daimyos and fortresses)
    newState.provinces[battle.provinceId] = {
      ...finalProvince,
      figures: finalProvince.figures.filter(
        (f) => f.owner === winnerId || f.type === 'daimyo' || f.type === 'fortress'
      ),
    };

    // Distribute winner's bid coins equally to losers
    const winnerBids = battle.warTacticBids[winnerId];
    if (winnerBids) {
      const totalBid = Object.values(winnerBids).reduce((sum, v) => sum + v, 0);
      const losers = battle.participants.filter((pid) => pid !== winnerId);
      if (losers.length > 0 && totalBid > 0) {
        const share = Math.floor(totalBid / losers.length);
        losers.forEach((pid) => {
          const loser = newState.players.find((p) => p.id === pid)!;
          loser.coins += share;
        });
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
      }
    });

    newState.log = [...newState.log, `${winner.name} wins the battle in ${finalProvince.name}!`];
  }

  battle.resolved = true;
  return newState;
}

// ============================================================
// Cleanup & Winter
// ============================================================

export function cleanupSeason(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      ronin: 0,
      coins: 0,
      allies: [...p.allies],
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
    mandatesThisTurn: [],
    activeBattles: [],
    allianceProposals: [],
    politicsMandateCount: 0,
    teaTurnIndex: 0,
    log: [...state.log, 'Cleanup: Ronin and coins discarded, Shinto returned from temples'],
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

  return newState;
}

export function resolveWinter(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    currentPhase: 'winter' as const,
    currentSeason: 'winter' as const,
    players: state.players.map((p) => ({ ...p, warProvinceTokens: [...p.warProvinceTokens], hostages: [...p.hostages], seasonCards: [...p.seasonCards] })),
    log: [...state.log, 'Winter - Final Scoring'],
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
          newState.log = [...newState.log, `${player.name} scores ${vp} VP from ${card.name}`];
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
      newState.log = [...newState.log, `${player.name} scores ${tokenVP} VP from war province tokens`];
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
      newState.log = [...newState.log, `${player.name} scores ${setVP} VP from province token set (${count} unique)`];
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
      if (challengerHonor > currentWinnerHonor) {
        winnerId = player.id;
      }
    }
  });

  // Check for allied players sharing victory
  if (winnerId) {
    const winner = newState.players.find((p) => p.id === winnerId)!;
    if (winner.allies.length > 0) {
      const ally = newState.players.find((p) => p.id === winner.allies[0]);
      if (ally && ally.victoryPoints === maxVP) {
        newState.log = [...newState.log, `${winner.name} and ${ally.name} share victory with ${maxVP} VP!`];
      } else {
        newState.log = [...newState.log, `${winner.name} wins with ${maxVP} VP!`];
      }
    } else {
      newState.log = [...newState.log, `${winner.name} wins with ${maxVP} VP!`];
    }
  }

  newState.winner = winnerId ?? undefined;
  newState.gameOver = true;

  return newState;
}

function scoreWinterUpgrade(gameState: GameState, player: Player, card: SeasonCard): number {
  switch (card.id) {
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
    newState.log = [...newState.log, `${player.name} moves ${figureIds.length} figure(s) from ${fromProvince.name} to ${toProvince.name}`];
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

export function calculateForce(province: Province & { figures: Figure[] }, playerId: string): number {
  // All figures have force 1 unless stated otherwise
  return province.figures.filter((f) => f.owner === playerId).length;
}

export function getHonorRank(state: GameState, playerId: string): number {
  return state.honorTrack.indexOf(playerId) + 1;
}

function gainHonor(state: GameState, playerId: string): void {
  const idx = state.honorTrack.indexOf(playerId);
  if (idx < state.honorTrack.length - 1) {
    [state.honorTrack[idx], state.honorTrack[idx + 1]] = [state.honorTrack[idx + 1], state.honorTrack[idx]];
  }
}

function loseHonor(state: GameState, playerId: string): void {
  const idx = state.honorTrack.indexOf(playerId);
  if (idx > 0) {
    [state.honorTrack[idx], state.honorTrack[idx - 1]] = [state.honorTrack[idx - 1], state.honorTrack[idx]];
  }
}

// ============================================================
// Phase Advancement
// ============================================================

export function advancePhase(state: GameState): GameState {
  let newState: GameState = { ...state, log: [...state.log] };

  switch (newState.currentPhase) {
    case 'seasonSetup':
      newState.currentPhase = 'tea';
      newState.currentPlayerIndex = 0;
      newState = breakAllAlliances(newState);
      newState.log = [...newState.log, 'Tea Ceremony Phase begins'];
      break;
    case 'tea':
      newState.currentPhase = 'politics';
      newState.currentPlayerIndex = 0;
      newState.politicsMandateCount = 0;
      newState.log = [...newState.log, 'Politics Phase begins'];
      break;
    case 'politics':
      newState = initiateWarPhase(newState);
      break;
    case 'war': {
      newState.currentPhase = 'cleanup';
      newState.log = [...newState.log, 'Cleanup Phase begins'];
      break;
    }
    case 'cleanup': {
      // Run cleanup and advance to next season in one step
      newState = cleanupSeason(newState);
      // Advance to next season or winter
      const seasons: Season[] = ['spring', 'summer', 'autumn'];
      const idx = seasons.indexOf(newState.currentSeason);
      if (idx >= 2) {
        // After autumn, go to winter
        newState = resolveWinter(newState);
      } else {
        // Advance to next season
        const nextSeason = seasons[idx + 1];
        newState.round += 1;
        newState = setupSeason(newState, nextSeason);
        newState.currentPhase = 'tea';
        newState = breakAllAlliances(newState);
        newState.log = [...newState.log, `Tea Ceremony Phase begins for ${nextSeason}`];
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
  const newState: GameState = { ...state, drawnMandates: [], mandateChoicePhase: false, log: [...state.log] };
  newState.politicsMandateCount += 1;

  // Check if we need a kami turn
  if (isKamiTurn(newState.politicsMandateCount)) {
    const kamiState = resolveKamiTurn(newState);
    // After kami turn, check if politics phase is done
    if (newState.politicsMandateCount >= newState.maxMandates) {
      return advancePhase(kamiState);
    }
    return { ...kamiState, currentPlayerIndex: (newState.currentPlayerIndex + 1) % newState.players.length };
  }

  // Check if politics phase is done
  if (newState.politicsMandateCount >= newState.maxMandates) {
    return advancePhase(newState);
  }

  // Move to next player
  newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
  return newState;
}

export function getCurrentPlayer(state: GameState): Player | undefined {
  return state.players[state.currentPlayerIndex];
}
