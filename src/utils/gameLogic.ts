import type {
  GameState, Player, Province, Season, MandateType,
  Battle, Figure, Temple, WarProvinceSlot, SeasonCard,
  AllianceProposal, Hostage, DeckConfig, DeckName, KamiType,
  KamiResolutionTemple, KamiData, BattleResolutionData, RuleEventNotice, WarStartAction, PendingMonsterEnterDecision,
} from '../types/game';
import {
  CLANS, PROVINCES_DATA, HOME_PROVINCES, WAR_TACTICS,
  KAMI_DATA, SPRING_CARDS, SUMMER_CARDS, AUTUMN_CARDS,
  DECK_GROUPS, CLAN_INCOME, SEASON_CARDS_DATA,
} from '../types/game';
import { getAvailableNormalShintoReserve } from './reserveUtils';

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

/**
 * Helper to check if a player has a card by base ID, accounting for duplicate
 * cards that have a '-2' suffix (e.g. 'su-path-of-might-2').
 */
export function hasCard(cardIds: Set<string>, baseId: string): boolean {
  return cardIds.has(baseId) || cardIds.has(baseId + '-2');
}

export function isVirtueCard(card: SeasonCard): boolean {
  return card.cardType === 'virtue' || card.id === 'sp-jurojin';
}

export function countVirtueCards(player: Player): number {
  return player.seasonCards.filter(isVirtueCard).length;
}

export function countDifferentVirtues(player: Player): number {
  return new Set(player.seasonCards.filter(isVirtueCard).map(card => card.id.replace(/-2$/, ''))).size;
}

/**
 * Virtue: Loyalty (su-loyalty) - When you gain VP and have an ally, gain 1 extra VP.
 * Call this after any explicit VP gain for the player.
 */
export function applyLoyaltyBonus(state: GameState, playerId: string, context: string): void {
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.allies.length === 0) return;
  const copies = countCardCopies(player, 'su-loyalty');
  if (copies <= 0) return;
  player.victoryPoints += copies;
  state.log = [...state.log, `💎 ${player.name} gana ${copies} PV extra (Lealtad - ${context}${copies > 1 ? `, ${copies} copias` : ''})`];
}

/**
 * Virtue: Righteousness (sp-righteousness) - For each of your own figures killed, gain 1 VP.
 */
export function applyRighteousnessVP(state: GameState, playerId: string, killCount: number): void {
  if (killCount <= 0) return;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  const copies = countCardCopies(player, 'sp-righteousness');
  if (copies <= 0) return;
  const reward = killCount * copies;
  player.victoryPoints += reward;
  state.log = [...state.log, `⚔️ ${player.name} gana ${reward} PV (Rectitud - ${killCount} figura(s) propia(s) eliminada(s)${copies > 1 ? `, ${copies} copias` : ''})`];
  applyLoyaltyBonus(state, playerId, 'Rectitud');
}

function playerHasCard(player: Player | undefined, baseId: string): boolean {
  if (!player) return false;
  return hasCard(new Set(player.seasonCards.map(c => c.id)), baseId);
}

export function gainCoinsFromSupply(state: GameState, playerId: string, amount: number, context: string): void {
  if (amount <= 0) return;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  const coinsBefore = player.coins;
  player.coins += amount;

  for (const merchant of state.players) {
    if (merchant.id === playerId) continue;
    const copies = countCardCopies(merchant, 'su-way-of-the-merchant');
    if (copies <= 0) continue;
    if (coinsBefore > merchant.coins) {
      merchant.coins += copies;
      state.log = [...state.log, `${merchant.name} gana ${copies} moneda(s) (Via del Mercader - ${context}${copies > 1 ? `, ${copies} copias` : ''})`];
    }
  }
}

export function gainVictoryPoints(state: GameState, playerId: string, amount: number, context: string): void {
  if (amount <= 0) return;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  player.victoryPoints += amount;
  applyLoyaltyBonus(state, playerId, context);
}

export function applyDignityMonsterSummon(state: GameState, playerId: string): void {
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player || !playerHasCard(player, 'sp-dignity')) return;
  const copies = countCardCopies(player, 'sp-dignity');
  for (let copy = 0; copy < copies; copy += 1) {
    gainVictoryPoints(state, playerId, 2, 'Dignidad');
    state.log.push(`${player.name} gana 2 PV por invocar un monstruo (Dignidad${copy > 0 ? `, copia ${copy + 1}` : ''})`);
  }
}

function countCardCopies(player: Player | undefined, baseId: string): number {
  if (!player) return 0;
  return player.seasonCards.filter(card => card.id === baseId || card.id === `${baseId}-2`).length;
}

function prepareBenevolence(
  state: GameState,
  playerId: string,
  spentCoins: number,
  ownedCopies: number,
  resume: 'advance-kami' | 'advance-train' | 'advance-marshal' | null,
): GameState {
  const triggers = Math.min(spentCoins, ownedCopies);
  if (triggers <= 0 || state.players.length < 2) return state;
  return {
    ...state,
    pendingBenevolence: {
      ownerId: playerId,
      remainingTriggers: triggers,
      totalTriggers: triggers,
      currentCopy: 1,
      resume,
    },
  };
}

function enqueueSpringPlacement(
  state: GameState,
  entries: Array<{ type: 'kannushi' | 'kenin' | 'light' | 'samurai'; ownerId: string; copyNumber: number }>,
): GameState {
  if (entries.length === 0) return state;
  const queue = [...(state.pendingSpringPlacementQueue || []), ...entries];
  if (state.pendingSpringPlacement) return { ...state, pendingSpringPlacementQueue: queue };
  const [next, ...rest] = queue;
  return { ...state, pendingSpringPlacement: next, pendingSpringPlacementQueue: rest };
}

function advanceSpringPlacementQueue(state: GameState): GameState {
  const [next, ...rest] = state.pendingSpringPlacementQueue || [];
  return { ...state, pendingSpringPlacement: next || null, pendingSpringPlacementQueue: rest };
}

function prepareKannushiForCurrentMarshalPlayer(state: GameState): GameState {
  if (!state.marshalMandateActive || state.pendingSpringPlacement) return state;
  const ownerId = state.marshalResolutionOrder[state.marshalResolutionIndex];
  const owner = state.players.find(player => player.id === ownerId);
  if (!owner || (state.marshalKannushiUsedBy || []).includes(ownerId)) return state;
  const copies = countCardCopies(owner, 'sp-path-of-the-kannushi');
  if (copies <= 0) return state;
  const hasOrigin = state.temples.some(temple => temple.figures.some(figure => figure.playerId === ownerId));
  const hasDestination = state.temples.some(temple => temple.figures.length < state.players.length);
  if (!hasOrigin || !hasDestination) return { ...state, marshalKannushiUsedBy: [...(state.marshalKannushiUsedBy || []), ownerId] };
  return enqueueSpringPlacement(state, Array.from({ length: copies }, (_, index) => ({ type: 'kannushi' as const, ownerId, copyNumber: index + 1 })));
}

export function resolveSpringPlacementDecision(
  state: GameState,
  playerId: string,
  useEffect: boolean,
  provinceId?: string,
  templeId?: string,
  figureId?: string,
): GameState {
  const pending = state.pendingSpringPlacement;
  if (!pending || pending.ownerId !== playerId) return state;
  const nextState = cloneForUpgradeMutation(state);
  nextState.pendingSpringPlacement = null;
  const owner = nextState.players.find(player => player.id === playerId);
  if (!owner) return state;

  if (useEffect && pending.type === 'kenin') {
    const province = provinceId ? nextState.provinces[provinceId] : null;
    const hasFortress = province?.figures.some(figure => figure.owner === playerId && (figure.type === 'fortress' || figure.monsterCardId === 'sp-fukurokuju'));
    if (!province || !hasFortress || !placeExtraBushi(nextState, playerId, province.id, 'Camino del Kenin')) return state;
  } else if (useEffect && pending.type === 'samurai') {
    const province = provinceId ? nextState.provinces[provinceId] : null;
    if (!province || province.id === 'ocean' || !placeExtraBushi(nextState, playerId, province.id, 'Camino del Samurai')) return state;
  } else if (useEffect && pending.type === 'light') {
    const temple = nextState.temples.find(candidate => candidate.id === templeId);
    if (!temple || temple.figures.length >= nextState.players.length || owner.shinto <= 0) return state;
    temple.figures.push({ playerId, figureId: generateId() });
    owner.shinto -= 1;
    nextState.log.push(`${owner.name} coloca 1 Shinto extra en el santuario de ${KAMI_DATA.find(kami => kami.type === temple.kamiType)?.name || temple.kamiType} (Camino de la Luz)`);
  } else if (useEffect && pending.type === 'kannushi') {
    const source = nextState.temples.find(temple => temple.figures.some(figure => figure.figureId === figureId && figure.playerId === playerId));
    const destination = nextState.temples.find(temple => temple.id === templeId);
    if (!source || !destination || source.id === destination.id || destination.figures.length >= nextState.players.length) return state;
    const moving = source.figures.find(figure => figure.figureId === figureId)!;
    source.figures = source.figures.filter(figure => figure.figureId !== figureId);
    destination.figures.push(moving);
    nextState.log.push(`${owner.name} mueve un Shinto al santuario de ${KAMI_DATA.find(kami => kami.type === destination.kamiType)?.name || destination.kamiType} (Camino del Kannushi)`);
  } else if (!useEffect) {
    nextState.log.push(`${owner.name} decide no usar ${pending.type === 'kannushi' ? 'Camino del Kannushi' : pending.type === 'kenin' ? 'Camino del Kenin' : pending.type === 'samurai' ? 'Camino del Samurai' : 'Camino de la Luz'}`);
  }

  if (pending.type === 'kannushi' && !(nextState.pendingSpringPlacementQueue || []).some(entry => entry.type === 'kannushi' && entry.ownerId === playerId)) {
    nextState.marshalKannushiUsedBy = [...(nextState.marshalKannushiUsedBy || []), playerId];
  }
  if (pending.type === 'light' || pending.type === 'kannushi') syncKamiControllers(nextState);
  return refreshPendingKamiResolution(advanceSpringPlacementQueue(nextState));
}

export function resolveBenevolenceDecision(state: GameState, playerId: string, recipientId?: string): GameState {
  const pending = state.pendingBenevolence;
  if (!pending || pending.ownerId !== playerId) return state;
  const owner = state.players.find(player => player.id === playerId);
  const recipient = recipientId ? state.players.find(player => player.id === recipientId && player.id !== playerId) : undefined;
  if (!owner || (recipientId && !recipient)) return state;

  const remainingTriggers = pending.remainingTriggers - 1;
  const nextState: GameState = {
    ...state,
    players: state.players.map(player => ({ ...player })),
    honorTrack: [...state.honorTrack],
    log: [...state.log],
    pendingBenevolence: remainingTriggers > 0
      ? { ...pending, remainingTriggers, currentCopy: pending.currentCopy + 1 }
      : null,
  };
  const nextOwner = nextState.players.find(player => player.id === playerId)!;

  if (!recipient) {
    nextState.log.push(`${nextOwner.name} decide no entregar una moneda gastada (Benevolence${pending.currentCopy > 1 ? `, copia ${pending.currentCopy}` : ''})`);
    return nextState;
  }

  const nextRecipient = nextState.players.find(player => player.id === recipient.id)!;
  nextRecipient.coins += 1;
  gainHonor(nextState, playerId);
  gainVictoryPoints(nextState, playerId, 2, 'Benevolence');
  const honorPosition = nextState.honorTrack.indexOf(playerId) + 1;
  nextState.log.push(`${nextOwner.name} entrega {coin} 1 de lo gastado a ${nextRecipient.name}, gana {h} y 2 PV y asciende a la posición ${honorPosition} {h} (Benevolence${pending.currentCopy > 1 ? `, copia ${pending.currentCopy}` : ''})`);
  const notice: RuleEventNotice = {
    id: generateId(),
    type: 'benevolence',
    actorId: playerId,
    targetId: recipient.id,
    requiredPlayerIds: nextState.players.map(player => player.id),
    acknowledgedPlayerIds: [],
    rewardAmount: 2,
    targetCoins: nextRecipient.coins,
    copyNumber: pending.currentCopy,
    resume: remainingTriggers > 0
      ? 'continue-benevolence'
      : ((nextState.pendingRuleNotices?.length || 0) > 0 ? null : pending.resume),
  };
  nextState.pendingRuleNotices = [notice, ...(nextState.pendingRuleNotices || [])];
  return nextState;
}

function gainHarvestVictoryPoints(state: GameState, playerId: string, amount: number): void {
  if (amount <= 0) return;
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return;
  player.victoryPoints += amount;
  const awarded = state.harvestLoyaltyAwardedPlayers || [];
  if (!awarded.includes(playerId)) {
    state.harvestLoyaltyAwardedPlayers = [...awarded, playerId];
    applyLoyaltyBonus(state, playerId, 'cosecha');
  }
}

function returnHostagesToOwners(state: GameState, hostages: Hostage[]): void {
  for (const hostage of hostages) {
    const owner = state.players.find(player => player.id === hostage.fromClanId);
    if (!owner) continue;
    if (hostage.figureType === 'bushi') owner.bushi += 1;
    else if (hostage.figureType === 'shinto') owner.shinto += 1;
    else if (hostage.figureType === 'monster') owner.monsters += 1;
    else if (hostage.figureType === 'daimyo') owner.hasDaimyo = true;
  }
}

function applyJurojinVirtueReward(state: GameState, playerId: string, acquiredCard: SeasonCard, resume: RuleEventNotice['resume']): void {
  // Jurojin counts as a Virtue for every other rule, but its own text rewards only another Virtue.
  if (!isVirtueCard(acquiredCard) || acquiredCard.id === 'sp-jurojin') return;
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player || !playerHasCard(player, 'sp-jurojin')) return;
  gainCoinsFromSupply(state, playerId, 3, 'Jurojin');
  state.log = [...state.log, `${player.name} obtiene 3 monedas por adquirir ${acquiredCard.name} (Jurojin). Total {coin} ${player.coins}`];
  state.pendingRuleNotices = [...(state.pendingRuleNotices || []), {
    id: generateId(),
    type: 'jurojin',
    actorId: playerId,
    targetId: playerId,
    requiredPlayerIds: state.players.map(candidate => candidate.id),
    acknowledgedPlayerIds: [],
    rewardAmount: 3,
    actorCoins: player.coins,
    resume,
  }];
}

function cloneForUpgradeMutation(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map(p => ({ ...p, seasonCards: [...p.seasonCards], allies: [...p.allies], hostages: [...p.hostages], warProvinceTokens: [...p.warProvinceTokens] })),
    provinces: Object.fromEntries(Object.entries(state.provinces).map(([id, province]) => [id, { ...province, figures: [...province.figures] }])) as GameState['provinces'],
    temples: state.temples.map(t => ({ ...t, figures: [...t.figures] })),
    honorTrack: [...state.honorTrack],
    log: [...state.log],
  };
}

function placeExtraBushi(state: GameState, playerId: string, provinceId: string, reason: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  const province = state.provinces[provinceId];
  if (!player || !province || player.bushi <= 0) return false;
  if (player.clanId === 'luna') {
    const lunaFigures = province.figures.filter(f => f.owner === playerId && f.type !== 'fortress').length;
    if (lunaFigures >= 2) return false;
  }
  state.provinces = {
    ...state.provinces,
    [provinceId]: { ...province, figures: [...province.figures, createFigure('bushi', playerId)] },
  };
  player.bushi -= 1;
  state.log = [...state.log, `${player.name} coloca 1 Bushi extra en ${province.name} (${reason})`];
  return true;
}

function applySummonUpgradeBonuses(state: GameState, playerId: string): GameState {
  const newState = cloneForUpgradeMutation(state);
  const player = newState.players.find(p => p.id === playerId);
  if (!player) return state;

  if (playerHasCard(player, 'sp-path-of-the-patron')) {
    const playerHonorIdx = newState.honorTrack.indexOf(playerId);
    const lowerHonorCount = newState.players.filter(p => p.id !== playerId && newState.honorTrack.indexOf(p.id) > playerHonorIdx).length;
    if (lowerHonorCount >= 2) {
      gainCoinsFromSupply(newState, playerId, 2, 'Camino del Patron');
      newState.log = [...newState.log, `${player.name} gana 2 monedas (Camino del Patron - invocacion)`];
    }
  }

  if (playerHasCard(player, 'au-path-of-the-spirit') && newState.honorTrack[0] === playerId) {
    gainCoinsFromSupply(newState, playerId, 2, 'Camino del Espiritu');
    gainVictoryPoints(newState, playerId, 2, 'Camino del Espiritu');
    newState.log = [...newState.log, `${player.name} gana 2 monedas y 2 PV (Camino del Espiritu - invocacion con mayor honor)`];
  }

  const monkeyCopies = countCardCopies(player, 'su-path-of-the-monkey');
  if (monkeyCopies > 0 && !newState.pendingMonkeyDecision && newState.players.some(candidate => candidate.id !== playerId && candidate.coins > 0)) {
    newState.pendingMonkeyDecision = { ownerId: playerId, remainingCopies: monkeyCopies, copyNumber: 1 };
  }

  if (playerHasCard(player, 'sp-path-of-the-ninja')) {
    const hasTarget = Object.values(newState.provinces).some(province => province.figures.some(figure =>
      figure.type === 'bushi' && figure.owner !== playerId && canBeKilledByPlayer(newState, province.id, figure, playerId)
    ));
    if (hasTarget && !newState.pendingNinjaDecision) newState.pendingNinjaDecision = { ownerId: playerId };
  }

  if (playerHasCard(player, 'sp-path-of-the-kenin')) {
    const hasFortress = Object.values(newState.provinces).some(province => province.figures.some(figure => figure.owner === playerId && (figure.type === 'fortress' || figure.monsterCardId === 'sp-fukurokuju')));
    if (hasFortress && player.bushi > 0) {
      return enqueueSpringPlacement(newState, Array.from({ length: countCardCopies(player, 'sp-path-of-the-kenin') }, (_, index) => ({ type: 'kenin' as const, ownerId: playerId, copyNumber: index + 1 })));
    }
  }

  return newState;
}

/**
 * Upgrade: Path of the Warlord (sp-path-of-the-warlord) - After you Summon, gain 1 Coin.
 *
 * A "summon" is any action that puts a figure on the board. Rules clarifications:
 *  - A Recruit mandate is a single summon, no matter how many figures are placed.
 *  - Any card/effect that uses the word "Summon" is a summon (e.g. Raijin shrine, Jinmenju).
 *  - Buying a monster and placing it on the board is a summon.
 *  - If the figure cannot actually be placed on the board (e.g. Luna with no space, so the
 *    monster goes to reserve), then no summon occurred and no coin is awarded.
 *
 * Returns a NEW GameState with the coin/log applied if the player owns the card, otherwise
 * returns the original state unchanged.
 */
export function grantWarlordSummonCoin(state: GameState, playerId: string): GameState {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  const cardIds = new Set(player.seasonCards.map(c => c.id));
  if (!hasCard(cardIds, 'sp-path-of-the-warlord')) return applySummonUpgradeBonuses(state, playerId);
  const newState = cloneForUpgradeMutation(state);
  gainCoinsFromSupply(newState, playerId, 1, 'Camino del Senor de la Guerra');
  newState.log = [...newState.log, `${player.name} gana 1 moneda (Camino del Senor de la Guerra - invocacion)`];
  return applySummonUpgradeBonuses(newState, playerId);
}

/**
 * Award the Path of the Warlord coin for a Recruit turn. A whole Recruit turn counts as a
 * single summon regardless of how many figures (bushi at fortresses, temple shinto, etc.) are
 * placed, so this awards the coin at most once per recruit turn via recruitWarlordCoinAwarded.
 * Returns a NEW GameState (or the original if nothing to award).
 */
export function grantRecruitWarlordCoinOnce(state: GameState, playerId: string): GameState {
  if (state.recruitWarlordCoinAwarded) return state;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  const cardIds = new Set(player.seasonCards.map(c => c.id));
  if (!hasCard(cardIds, 'sp-path-of-the-warlord')) {
    return applySummonUpgradeBonuses({ ...state, recruitWarlordCoinAwarded: true }, playerId);
  }
  const newState = cloneForUpgradeMutation({ ...state, recruitWarlordCoinAwarded: true });
  gainCoinsFromSupply(newState, playerId, 1, 'Camino del Senor de la Guerra');
  newState.log = [...newState.log, `${player.name} gana 1 moneda (Camino del Senor de la Guerra - invocacion)`];
  return applySummonUpgradeBonuses(newState, playerId);
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
    pendingMonsterPlacementCardId: null,
    pendingMonsterPlacementPlayerId: null,
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
    recruitPlacementsTotal: 0,
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
    harvestLoyaltyAwardedPlayers: [],
    kamiResolutionActive: false,
    kamiResolutionTemples: [],
    kamiResolutionIndex: 0,
    kamiResolutionStep: null,
    kamiResolutionCurrentPlayerId: null,
    kamiResolutionNextPlayerIndex: 0,
    fujinMovesRemaining: 0,
    raijinPlacementActive: false,
    ryujinBuyActive: false,
    kamiUnboundEnabled: config.kamiUnbound === true,
    kamiPlacementActive: false,
    kamiPlacementPlayerId: null,
    kamiPlacementKamiType: null,
    kamiPlacementProvinceId: null,
    kamiManifestedTempleIndexes: [],
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
    warPhaseStartAcknowledged: false,
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
    daikaijuPlacementActive: false,
    daikaijuPlacementPlayerId: null,
    daikaijuPlacementProvinceId: null,
    daikaijuSummaryVisible: false,
    daikaijuSummaryReadyPlayers: [],
    daikaijuSummaryData: null,
    warStartActions: [],
    warStartActionIndex: 0,
    warStartActionsComplete: true,
    warStartSelection: null,
    pendingNureOnnaDecision: null,
    pendingBattleCardDecision: null,
    pendingMonsterEnterDecision: null,
    pendingFujinContinuation: null,
    pendingBattleMercyDecision: null,
    pendingNinjaDecision: null,
    pendingMonkeyDecision: null,
    pendingSnakeDecision: null,
    pendingSnakeOwnerQueue: [],
    snakeResumePlayerIndex: null,
    betrayTriggeredBySnake: false,
    pendingBenevolence: null,
    pendingSpringPlacement: null,
    pendingSpringPlacementQueue: [],
    marshalKannushiUsedBy: [],
    pendingVassalDecision: null,
    kamiVassalResolvedTempleIndexes: [],
    nureOnnaCheckedBattles: {},
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
  // Archive current season's log before transitioning (only if there's content to avoid overwriting)
  const archivedHistory = state.log.length > 0
    ? {
        ...state.logHistory,
        [state.currentSeason]: [...(state.logHistory[state.currentSeason] || []), ...state.log],
      }
    : { ...state.logHistory };

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
  const provinceIds = Object.keys(newState.provinces).filter(id => id !== 'ocean');
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
  newState = applySeasonStartUpgrades(newState);

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
    gainCoinsFromSupply(newState, player.id, income, 'ingresos de estacion');
  });
  return newState;
}

export function resolveNinjaDecision(
  state: GameState,
  playerId: string,
  useEffect: boolean,
  targetFigureId?: string,
  useMercy = false,
): GameState {
  if (state.pendingNinjaDecision?.ownerId !== playerId) return state;
  const nextState: GameState = {
    ...state,
    pendingNinjaDecision: null,
    players: state.players.map(player => ({ ...player })),
    provinces: Object.fromEntries(Object.entries(state.provinces).map(([id, province]) => [id, { ...province, figures: [...province.figures] }])) as GameState['provinces'],
    honorTrack: [...state.honorTrack],
    log: [...state.log],
  };
  const owner = nextState.players.find(player => player.id === playerId);
  if (!owner) return state;
  if (!useEffect) {
    nextState.log.push(`${owner.name} decide no usar Camino del Ninja`);
    return nextState;
  }

  let targetProvinceId: string | null = null;
  let target: Figure | undefined;
  for (const [provinceId, province] of Object.entries(nextState.provinces)) {
    const candidate = province.figures.find(figure => figure.id === targetFigureId && figure.type === 'bushi' && figure.owner !== playerId);
    if (candidate) {
      targetProvinceId = provinceId;
      target = candidate;
      break;
    }
  }
  if (!target || !targetProvinceId) return state;
  if (!canBeKilledByPlayer(nextState, targetProvinceId, target, playerId)) return state;
  const victim = nextState.players.find(player => player.id === target!.owner);
  if (!victim) return state;
  loseHonor(nextState, playerId);

  if (useMercy) {
    if (!playerHasCard(owner, 'su-mercy')) return state;
    gainVictoryPoints(nextState, playerId, 2, 'Misericordia');
    nextState.log.push(`${owner.name} perdona el Bushi de ${victim.name}, gana 2 PV y pierde Honor (Camino del Ninja, Misericordia)`);
    return nextState;
  }

  const figuresBeforeDeath = [...nextState.provinces[targetProvinceId].figures];
  nextState.provinces[targetProvinceId].figures = nextState.provinces[targetProvinceId].figures.filter(figure => figure.id !== target!.id);
  victim.bushi += 1;
  applyRighteousnessVP(nextState, victim.id, 1);
  applyProvinceDeathCardEffects(nextState, targetProvinceId, [target], figuresBeforeDeath);
  nextState.log.push(`${owner.name} elimina 1 Bushi de ${victim.name} en ${nextState.provinces[targetProvinceId].name} y pierde Honor (Camino del Ninja)`);
  if (playerHasCard(owner, 'su-justice') && nextState.honorTrack.indexOf(victim.id) > nextState.honorTrack.indexOf(owner.id)) {
    gainVictoryPoints(nextState, owner.id, 3, 'Justicia');
    nextState.log.push(`${owner.name} gana 3 PV por matar un Bushi de ${victim.name} con menor Honor (Justicia)`);
  }
  return nextState;
}

export function resolveMonkeyDecision(state: GameState, playerId: string, useEffect: boolean, targetPlayerId?: string): GameState {
  const pending = state.pendingMonkeyDecision;
  if (!pending || pending.ownerId !== playerId) return state;
  const nextState: GameState = {
    ...state,
    players: state.players.map(player => ({ ...player })),
    honorTrack: [...state.honorTrack],
    log: [...state.log],
    pendingMonkeyDecision: null,
  };
  const owner = nextState.players.find(player => player.id === playerId);
  if (!owner) return state;

  const opponentsWithCoins = nextState.players.filter(player => player.id !== playerId && player.coins > 0);
  const richestCoins = Math.max(0, ...opponentsWithCoins.map(player => player.coins));
  const validTargets = opponentsWithCoins.filter(player => player.coins === richestCoins);
  if (useEffect) {
    const target = validTargets.find(player => player.id === targetPlayerId);
    if (!target) return state;
    target.coins -= 1;
    owner.coins += 1;
    loseHonor(nextState, playerId);
    nextState.log.push(`${owner.name} toma 1 moneda de ${target.name} y pierde Honor (Camino del Mono${pending.copyNumber > 1 ? `, copia ${pending.copyNumber}` : ''})`);
  } else {
    nextState.log.push(`${owner.name} decide no usar Camino del Mono${pending.copyNumber > 1 ? ` (copia ${pending.copyNumber})` : ''}`);
  }

  const remainingCopies = pending.remainingCopies - 1;
  if (remainingCopies > 0 && nextState.players.some(player => player.id !== playerId && player.coins > 0)) {
    nextState.pendingMonkeyDecision = { ownerId: playerId, remainingCopies, copyNumber: pending.copyNumber + 1 };
  }
  return nextState;
}

function applySeasonStartUpgrades(state: GameState): GameState {
  if (state.currentSeason !== 'summer' && state.currentSeason !== 'autumn') return state;
  const newState = cloneForUpgradeMutation(state);
  const maxWarTokens = Math.max(...newState.players.map(p => p.warProvinceTokens.length));

  for (const player of newState.players) {
    if (playerHasCard(player, 'sp-path-of-the-pacifist') && player.warProvinceTokens.length < maxWarTokens) {
      gainVictoryPoints(newState, player.id, 4, 'Camino del Pacifista');
      newState.log = [...newState.log, `${player.name} gana 4 PV (Camino del Pacifista - inicio de estacion)`];
    }
    if (playerHasCard(player, 'sp-path-of-the-salamander')) {
      gainCoinsFromSupply(newState, player.id, 3, 'Camino de la Salamandra');
      loseHonor(newState, player.id);
      newState.log = [...newState.log, `${player.name} gana 3 monedas y pierde honor (Camino de la Salamandra - inicio de estacion)`];
    }
  }

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
      returnHostagesToOwners(newState, player.hostages);
      gainCoinsFromSupply(newState, player.id, player.hostages.length, 'devolucion de rehenes');
      // Group hostages by their original owner (fromClanId = player ID)
      const hostagesByOwner: Record<string, number> = {};
      player.hostages.forEach((h) => {
        hostagesByOwner[h.fromClanId] = (hostagesByOwner[h.fromClanId] || 0) + 1;
      });
      Object.entries(hostagesByOwner).forEach(([ownerId, count]) => {
        const targetPlayer = newState.players.find((p) => p.id === ownerId);
        const targetName = targetPlayer ? targetPlayer.name : ownerId;
        newState.log = [...newState.log, `${player.name} devuelve ${count} rehén(es) a ${targetName}, gana ${count} moneda(s). Total {coin} ${player.coins}`];
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
            log: [...resultState.log, `${counterTarget.name} recibe ${actualBribe} monedas de soborno de ${counterProposer.name}. Total {coin} ${counterTarget.coins + actualBribe}`],
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
            log: [...resultState.log, `${requester.name} recibe ${actualRequest} monedas de peticion de ${payer.name}. Total {coin} ${requester.coins + actualRequest}`],
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
      newState.log = [...newState.log, `${to.name} recibe ${actualBribe} monedas de soborno de ${from.name}. Total {coin} ${to.coins}`];
    }
  }

  // Transfer request coins from accepter (to) to proposer (from)
  if (requestAmount > 0) {
    const actualRequest = Math.min(requestAmount, to.coins);
    if (actualRequest > 0) {
      to.coins -= actualRequest;
      from.coins += actualRequest;
      newState.log = [...newState.log, `${from.name} recibe ${actualRequest} monedas de peticion de ${to.name}. Total {coin} ${from.coins}`];
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
  const resolutionActive =
    state.trainMandateActive ||
    state.marshalMandateActive ||
    state.recruitMandateActive ||
    state.betrayMandateActive ||
    state.harvestMandateActive;
  if (
    state.currentPhase !== 'politics' ||
    state.mandateChoicePhase ||
    state.lotoChoicePhase ||
    state.drawnMandates.length > 0 ||
    resolutionActive ||
    state.kamiResolutionActive ||
    state.kamiPhasePopupPending ||
    state.kamiSummaryVisible ||
    state.generosityPending
  ) return state;

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

/** Helper: Apply Generosity virtue effect after mandate execution */
function applyGenerosity(state: GameState, playerId: string): GameState {
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.coins < 1 || state.generosityPending) return state;
  if (!player.seasonCards.some(card => card.id === 'sp-generosity')) return state;
  if (!state.players.some(p => p.id !== playerId)) return state;
  return {
    ...state,
    generosityPending: { fromPlayerId: playerId, toPlayerId: null, stage: 'choose-recipient' },
  };
}

export function chooseGenerosityRecipient(state: GameState, playerId: string, toPlayerId: string | null): GameState {
  const pending = state.generosityPending;
  if (!pending || pending.stage !== 'choose-recipient' || pending.fromPlayerId !== playerId) return state;
  if (!toPlayerId) return { ...state, generosityPending: null };
  if (toPlayerId === playerId || !state.players.some(p => p.id === toPlayerId)) return state;
  return { ...state, generosityPending: { ...pending, toPlayerId, stage: 'awaiting-response' } };
}

export function respondToGenerosity(state: GameState, playerId: string, accept: boolean): GameState {
  const pending = state.generosityPending;
  if (!pending || pending.stage !== 'awaiting-response' || pending.toPlayerId !== playerId) return state;
  const sender = state.players.find(p => p.id === pending.fromPlayerId);
  const recipient = state.players.find(p => p.id === playerId);
  if (!sender || !recipient || !accept || sender.coins < 1) {
    return {
      ...state,
      generosityPending: null,
      log: !accept && sender && recipient
        ? [...state.log, `${recipient.name} rechaza la oferta de Generosidad de ${sender.name}`]
        : state.log,
    };
  }
  let newState: GameState = {
    ...state,
    players: state.players.map(p => p.id === sender.id
      ? { ...p, coins: p.coins - 1 }
      : p.id === recipient.id ? { ...p, coins: p.coins + 1 } : p),
    honorTrack: [...state.honorTrack],
    generosityPending: null,
    log: [...state.log, `${sender.name} ofrece 1 Moneda a ${recipient.name} (Generosidad) y gana Honor`],
  };
  gainHonor(newState, sender.id);
  return newState;
}

export function chooseMandateTile(state: GameState, mandate: MandateType, playerId: string): GameState {
  if (!state.mandateChoicePhase || state.lotoChoicePhase) return state;
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

  // Virtue: Generosity (sp-generosity) - After mandate, give 1 coin to poorest player, gain Honor
  newState = applyGenerosity(newState, playerId);

  return newState;
}

export function lotoChooseActualMandate(state: GameState, mandate: MandateType, playerId: string): GameState {
  const player = state.players.find(candidate => candidate.id === playerId);
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!state.lotoChoicePhase || player?.clanId !== 'loto' || currentPlayer?.id !== playerId) return state;
  let newState: GameState = {
    ...state,
    drawnMandates: [],
    mandateChoicePhase: false,
    lotoChoicePhase: false,
    lotoDiscardedMandate: null,
    lastMandateIssuerId: playerId,
  };
  newState = executeMandate(newState, mandate, playerId);

  // Virtue: Generosity (sp-generosity) - After mandate, give 1 coin to poorest player, gain Honor
  newState = applyGenerosity(newState, playerId);

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

  // Virtue: Honesty (sp-honesty) - Gain 2 VP when selecting non-Betray mandate while having an ally
  const mandatePlayerCardIds = new Set(player.seasonCards.map(c => c.id));
  if (hasCard(mandatePlayerCardIds, 'sp-honesty') && mandate !== 'betray' && player.allies.length > 0) {
    gainVictoryPoints(newState, playerId, 2, 'Honestidad');
    newState.log = [...newState.log, `🤝 ${player.name} gana 2 PV (Honestidad - mandato no traicion con aliado)`];
  }

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
    recruitPlacementsTotal: 0,
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
export function recruitPlaceFigure(state: GameState, playerId: string, provinceId: string, figureType: 'bushi' | 'shinto' | 'monster' | 'daimyo'): GameState {
  if (!state.recruitMandateActive) return state;
  if (state.recruitPlacementsRemaining <= 0) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  // Check reserve
  if (figureType === 'bushi' && player.bushi <= 0) return state;
  if (figureType === 'shinto' && getAvailableNormalShintoReserve(player, state) <= 0) return state;
  if (figureType === 'monster' && player.monsters <= 0) return state;
  if (figureType === 'daimyo' && !player.hasDaimyo) return state;

  const province = state.provinces[provinceId];
  if (!province) return state;

  // Validate province: must have player's fortress, UNLESS player is Dragonfly (libelula)
  const isDragonfly = player.clanId === 'libelula';
  if (!isDragonfly) {
    const hasFortress = province.figures.some(f => f.owner === playerId && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju')));
    if (!hasFortress) return state;
  }

  // Luna clan power: max 2 figures per province (excluding fortresses)
  if (player.clanId === 'luna' && (figureType === 'bushi' || figureType === 'shinto' || figureType === 'monster' || figureType === 'daimyo')) {
    const lunaFiguresInProvince = province.figures.filter(
      (f) => f.owner === playerId && f.type !== 'fortress'
    ).length;
    if (lunaFiguresInProvince >= 2) return state;
  }

  // Enforce one-per-fortress-province rule for all figure types (bushi, shinto, monster).
  // Rule: each fortress province can be used once for a "base" placement.
  // If the player is issuer/ally, they get +1 bonus that can go to ANY fortress province (even one already used).
  {
    const usedProvinces = state.recruitUsedFortressProvinces;
    const timesProvinceUsed = usedProvinces.filter(p => p === provinceId).length;

    if (timesProvinceUsed === 0) {
      // First figure in this province - always allowed (base placement)
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

  let newState: GameState = {
    ...state,
    provinces: { ...state.provinces },
    players: state.players.map((p) => ({ ...p })),
    recruitPlacementsRemaining: state.recruitPlacementsRemaining - 1,
    recruitUsedFortressProvinces: [...state.recruitUsedFortressProvinces, provinceId],
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
  } else if (figureType === 'monster') {
    updatedPlayer.monsters -= 1;
  } else if (figureType === 'daimyo') {
    updatedPlayer.hasDaimyo = false;
  }

  // Path of the Warlord: a Recruit is a single summon regardless of how many figures are
  // placed, so award the coin at most once per recruit turn (see grantRecruitWarlordCoinOnce).
  return grantRecruitWarlordCoinOnce(newState, playerId);
}

/**
 * Place a daimyo figure during the recruit mandate.
 * daimyoType is 'normal' for the clan daimyo, or a monsterCardId for daimyo-type monsters.
 */
export function recruitPlaceDaimyo(state: GameState, playerId: string, provinceId: string, daimyoType: string): GameState {
  if (!state.recruitMandateActive) return state;
  if (state.recruitPlacementsRemaining <= 0) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  const province = state.provinces[provinceId];
  if (!province) return state;

  // Validate province: must have player's fortress, UNLESS player is Dragonfly (libelula)
  const isDragonfly = player.clanId === 'libelula';
  if (!isDragonfly) {
    const hasFortress = province.figures.some(f => f.owner === playerId && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju')));
    if (!hasFortress) return state;
  }

  // Luna clan power: max 2 figures per province (excluding fortresses)
  if (player.clanId === 'luna') {
    const lunaFiguresInProvince = province.figures.filter(
      (f) => f.owner === playerId && f.type !== 'fortress'
    ).length;
    if (lunaFiguresInProvince >= 2) return state;
  }

  // Enforce one-per-fortress-province rule
  {
    const usedProvinces = state.recruitUsedFortressProvinces;
    const timesProvinceUsed = usedProvinces.filter(p => p === provinceId).length;
    if (timesProvinceUsed > 0) {
      const isBonus = state.recruitMandateIssuerId ? isIssuerOrAlly(state, playerId, state.recruitMandateIssuerId) : false;
      if (!isBonus) return state;
      const bonusUsesConsumed = usedProvinces.length - new Set(usedProvinces).size;
      if (bonusUsesConsumed >= 1) return state;
    }
  }

  const DAIMYO_MONSTER_IDS = ['su-yurei', 'sp-fukurokuju'];

  if (daimyoType === 'normal') {
    if (!player.hasDaimyo) return state;
    const figureId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newFigure = { type: 'daimyo' as const, owner: playerId, id: figureId };

    const newState: GameState = {
      ...state,
      provinces: { ...state.provinces },
      players: state.players.map((p) => {
        if (p.id === playerId) return { ...p, hasDaimyo: false };
        return { ...p };
      }),
      recruitPlacementsRemaining: state.recruitPlacementsRemaining - 1,
      recruitUsedFortressProvinces: [...state.recruitUsedFortressProvinces, provinceId],
      log: [...state.log, `${player.name} despliega su Daimyo en ${province.name}`],
    };

    const prov = newState.provinces[provinceId];
    newState.provinces[provinceId] = { ...prov, figures: [...prov.figures, newFigure] };
    // Path of the Warlord: recruit counts as a single summon; award at most once per turn.
    return grantRecruitWarlordCoinOnce(newState, playerId);
  } else if (DAIMYO_MONSTER_IDS.includes(daimyoType)) {
    // Daimyo-type monster
    const monsterCard = player.seasonCards.find(c => c.id === daimyoType && c.cardType === 'monster');
    if (!monsterCard) return state;
    // Verify it's not already deployed
    const deployedMonsterCardIds = new Set<string>();
    Object.values(state.provinces).forEach((prov) => {
      prov.figures.forEach((f) => {
        if (f.type === 'monster' && f.owner === playerId && f.monsterCardId) {
          deployedMonsterCardIds.add(f.monsterCardId);
        }
      });
    });
    if (deployedMonsterCardIds.has(daimyoType)) return state;

    const figureId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newFigure = { type: 'monster' as const, owner: playerId, id: figureId, monsterCardId: daimyoType };

    const newState: GameState = {
      ...state,
      provinces: { ...state.provinces },
      players: state.players.map((p) => {
        if (p.id === playerId) return { ...p, monsters: Math.max(0, p.monsters - 1) };
        return { ...p };
      }),
      recruitPlacementsRemaining: state.recruitPlacementsRemaining - 1,
      recruitUsedFortressProvinces: [...state.recruitUsedFortressProvinces, provinceId],
      log: [...state.log, `${player.name} despliega a ${monsterCard.name} en ${province.name}`],
    };

    const prov = newState.provinces[provinceId];
    newState.provinces[provinceId] = { ...prov, figures: [...prov.figures, newFigure] };
    // Path of the Warlord: recruit counts as a single summon; award at most once per turn.
    return grantRecruitWarlordCoinOnce(newState, playerId);
  }

  return state;
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
    const completedState = applyRecruitEndUpgrades(state);
    // All players have had their turn - clear recruit mandate
    return {
      ...completedState,
      recruitMandateActive: false,
      recruitResolutionOrder: [],
      recruitResolutionIndex: 0,
      recruitMandateIssuerId: null,
      recruitPlacementsRemaining: 0,
      recruitPlacementsTotal: 0,
      recruitUsedFortressProvinces: [],
      log: [...completedState.log, 'Mandato de Reclutar resuelto'],
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
    return { ...state, currentPlayerIndex: nextPlayerIdx, recruitPlacementsRemaining: placements, recruitPlacementsTotal: placements, recruitUsedFortressProvinces: [], recruitWarlordCoinAwarded: false };
  }
  return state;
}

function applyRecruitEndUpgrades(state: GameState): GameState {
  let newState = cloneForUpgradeMutation(state);
  const placementEntries: Array<{ type: 'light' | 'samurai'; ownerId: string; copyNumber: number }> = [];
  for (const player of newState.players) {
    if (playerHasCard(player, 'sp-path-of-the-light') && player.shinto > 0 && newState.temples.some(temple => temple.figures.length < newState.players.length)) {
      for (let index = 0; index < countCardCopies(player, 'sp-path-of-the-light'); index += 1) {
        placementEntries.push({ type: 'light', ownerId: player.id, copyNumber: index + 1 });
      }
    }
    if (playerHasCard(player, 'su-path-of-the-samurai') && player.bushi > 0) {
      for (let index = 0; index < countCardCopies(player, 'su-path-of-the-samurai'); index += 1) {
        placementEntries.push({ type: 'samurai', ownerId: player.id, copyNumber: index + 1 });
      }
    }
  }
  newState = enqueueSpringPlacement(newState, placementEntries);
  return newState;
}

function executeMarshal(state: GameState, issuerId: string): GameState {
  // Marshal: Each player may move figures. Issuer+ally may also build a fortress (3 coins) in any province.
  // Resolution order: starting from NEXT player after issuer (clockwise by seating/turnOrder).
  const resolutionOrder = getResolutionOrder(state, issuerId);
  const issuer = state.players.find((p) => p.id === issuerId);
  let newState: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    marshalMandateActive: true,
    marshalResolutionOrder: resolutionOrder,
    marshalResolutionIndex: 0,
    marshalMandateIssuerId: issuerId,
    marshalFortressBuiltBy: [],
    marshalMovedFigures: [],
    marshalKannushiUsedBy: [],
    log: [...state.log, `Mandato de Movilizar emitido por ${issuer?.name ?? 'Jugador'} - todos los jugadores pueden mover figuras. Emisor y aliado pueden construir una fortaleza (3 monedas).`],
  };
  // Set currentPlayerIndex to the first player in resolution order
  const firstPlayerId = resolutionOrder[0];
  const firstPlayerIdx = newState.players.findIndex(p => p.id === firstPlayerId);
  if (firstPlayerIdx >= 0) {
    newState.currentPlayerIndex = firstPlayerIdx;
  }
  newState = prepareKannushiForCurrentMarshalPlayer(newState);
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
    pendingMonsterPlacementCardId: null,
    pendingMonsterPlacementPlayerId: null,
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
  // Follow-up effects belong to the purchase already made. Until they resolve,
  // the Train buyer cannot start another purchase from a stale market window.
  if (
    state.pendingBenevolence ||
    state.pendingMonsterPlacementCardId ||
    (state.pendingRuleNotices?.length || 0) > 0
  ) return state;

  const card = state.seasonCardsDeck.find((c) => c.id === cardId);
  if (!card) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;
  const benevolenceCopies = countCardCopies(player, 'sp-benevolence');

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

  let newState: GameState = {
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

  applyJurojinVirtueReward(newState, playerId, card, 'advance-train');
  newState = prepareBenevolence(newState, playerId, effectiveCost, benevolenceCopies, card.cardType === 'monster' ? null : 'advance-train');

  return newState;
}

/**
 * Buy a season card for the Ryujin kami reward. Full cost, no issuer discount.
 * Bonsai clan power still applies.
 */
export function ryujinBuyCard(state: GameState, playerId: string, cardId: string): GameState {
  if (!state.kamiResolutionActive || !state.ryujinBuyActive) return state;
  const currentTemple = state.kamiResolutionTemples[state.kamiResolutionIndex];
  if (!currentTemple || currentTemple.kamiType !== 'ryujin' || currentTemple.winnerId !== playerId) return state;
  const card = state.seasonCardsDeck.find((c) => c.id === cardId);
  if (!card) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;
  const benevolenceCopies = countCardCopies(player, 'sp-benevolence');

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

  let newState: GameState = {
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

  applyJurojinVirtueReward(newState, playerId, card, 'advance-kami');
  newState = prepareBenevolence(newState, playerId, effectiveCost, benevolenceCopies, card.cardType === 'monster' ? null : 'advance-kami');

  return newState;
}

function executeHarvest(state: GameState, issuerId: string): GameState {
  const newState: GameState = { ...state, players: state.players.map((p) => ({ ...p })), log: [...state.log] };

  // ALL players receive +1 coin when harvest is executed
  newState.players.forEach((p) => {
    gainCoinsFromSupply(newState, p.id, 1, 'Mandato de Cosecha');
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
      const multiplier = getKamiInProvince(newState, province.id, 'fujin') ? 2 : 1;
      const rewards = Object.fromEntries(Object.entries(province.harvestRewards).map(([key, value]) => [key, (value || 0) * multiplier]));
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

    const multiplier = getKamiInProvince(state, province.id, 'fujin') ? 2 : 1;
    const rewards = Object.fromEntries(Object.entries(province.harvestRewards).map(([key, value]) => [key, (value || 0) * multiplier]));
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
    newState.harvestLoyaltyAwardedPlayers = [];
    newState.harvestMandateActive = true;
    newState.harvestResolutionOrder = orderedRewards.map(r => r.playerId);
    newState.harvestResolutionIndex = 0;
    newState.harvestPlayerRewards = orderedRewards;
    newState.harvestPopupVisible = true;
    newState.harvestAllPlayersOrder = [...newState.turnOrder];
    newState.harvestCurrentPlayerId = newState.turnOrder[0];
    newState.harvestCoinAcknowledged = false;
  } else if (orderedRewards.length > 0) {
    newState.harvestLoyaltyAwardedPlayers = [];
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
          if (rewards.vp) gainHarvestVictoryPoints(newState, player.id, rewards.vp);
          if (rewards.coins) gainCoinsFromSupply(newState, player.id, rewards.coins, 'cosecha');
          if (rewards.ronin) player.ronin += rewards.ronin;
          if (rewards.honor) {
            gainHonor(newState, player.id);
          }
          const provinceName = newState.provinces[entry.provinceId]?.name || entry.provinceId;
          const rewardParts: string[] = [];
          if (rewards.vp) rewardParts.push(`${rewards.vp} PV`);
          if (rewards.coins) rewardParts.push(`${rewards.coins} monedas`);
          if (rewards.ronin) rewardParts.push(`${rewards.ronin} ronin`);
          if (rewards.honor) rewardParts.push(`${rewards.honor} honor`);
          newState.log = [...newState.log, `${player.name} obtiene recompensa de ${provinceName}: ${rewardParts.join(', ')}${rewards.coins ? `. Total {coin} ${player.coins}` : ''}`];
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
      if (rewards.vp) gainHarvestVictoryPoints(newState, player.id, rewards.vp);
      if (rewards.coins) gainCoinsFromSupply(newState, player.id, rewards.coins, 'cosecha');
      if (rewards.ronin) player.ronin += rewards.ronin;
      if (rewards.honor) {
        gainHonor(newState, player.id);
      }
      const provinceName = newState.provinces[entry.provinceId]?.name || entry.provinceId;
      const rewardParts: string[] = [];
      if (rewards.vp) rewardParts.push(`${rewards.vp} PV`);
      if (rewards.coins) rewardParts.push(`${rewards.coins} monedas`);
      if (rewards.ronin) rewardParts.push(`${rewards.ronin} ronin`);
      if (rewards.honor) rewardParts.push(`${rewards.honor} honor`);
      newState.log = [...newState.log, `${player.name} obtiene recompensa de ${provinceName}: ${rewardParts.join(', ')}${rewards.coins ? `. Total {coin} ${player.coins}` : ''}`];
    }
  }

  const nextIdx = idx + 1;
  if (nextIdx >= newState.harvestPlayerRewards.length) {
    applySengokuHarvestBonus(newState);
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
 * Path of Sengoku: at the end of any Harvest, gain the Daimyo province reward
 * if that player did not already receive that province's reward in this Harvest.
 */
function applySengokuHarvestBonus(state: GameState): void {
  for (const player of state.players) {
    if (!playerHasCard(player, 'su-path-of-sengoku')) continue;
    let daimyoProvinceId: string | null = null;
    for (const [provinceId, province] of Object.entries(state.provinces)) {
      if (province.figures.some(f => f.owner === player.id && (f.type === 'daimyo' || (f.type === 'monster' && ['sp-fukurokuju', 'su-yurei'].includes(f.monsterCardId || ''))))) {
        daimyoProvinceId = provinceId;
        break;
      }
    }
    if (!daimyoProvinceId) continue;
    const alreadyRewarded = state.harvestPlayerRewards.some(r => r.playerId === player.id && r.provinceId === daimyoProvinceId);
    if (alreadyRewarded) continue;
    const province = state.provinces[daimyoProvinceId];
    if (!province) continue;
    const multiplier = getKamiInProvince(state, province.id, 'fujin') ? 2 : 1;
    const rewards = Object.fromEntries(Object.entries(province.harvestRewards).map(([key, value]) => [key, (value || 0) * multiplier]));
    if (rewards.vp) gainVictoryPoints(state, player.id, rewards.vp, 'Camino de Sengoku');
    if (rewards.coins) gainCoinsFromSupply(state, player.id, rewards.coins, 'Camino de Sengoku');
    if (rewards.ronin) player.ronin += rewards.ronin;
    if (rewards.honor) gainHonor(state, player.id);
    const rewardParts: string[] = [];
    if (rewards.vp) rewardParts.push(`${rewards.vp} PV`);
    if (rewards.coins) rewardParts.push(`${rewards.coins} monedas`);
    if (rewards.ronin) rewardParts.push(`${rewards.ronin} ronin`);
    if (rewards.honor) rewardParts.push(`${rewards.honor} honor`);
    state.log = [...state.log, `${player.name} obtiene recompensa de ${province.name}: ${rewardParts.join(', ')} (Camino de Sengoku)`];
  }
}

function applyOniOfSoulsWarTokenBonus(state: GameState, playerId: string, provinceId: string): void {
  const player = state.players.find(candidate => candidate.id === playerId);
  const province = state.provinces[provinceId];
  if (!player || !province) return;
  const survivesInBattle = province.figures.some(figure =>
    figure.owner === playerId &&
    figure.type === 'monster' &&
    (figure.monsterCardId === 'sp-oni-of-souls' || figure.monsterCardId === 'su-oni-of-souls')
  );
  if (!survivesInBattle) return;
  const oniCount = player.seasonCards.filter(card => card.name.toLowerCase().includes('oni of')).length;
  const reward = oniCount * 2;
  if (reward <= 0) return;
  gainVictoryPoints(state, playerId, reward, 'Oni de las Almas');
  state.log = [...state.log, `${player.name} gana ${reward} PV por ${oniCount} Oni que posee (Oni de las Almas sobrevive en ${province.name}). Total ${player.victoryPoints} PV`];
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
    applySengokuHarvestBonus(state);
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
  let newState: GameState = {
    ...state,
    provinces: { ...state.provinces },
    players: state.players.map((p) => ({ ...p, allies: [...p.allies] })),
    honorTrack: [...state.honorTrack],
    log: [...state.log],
  };

  const issuer = newState.players.find((p) => p.id === issuerId)!;
  const unrighteousCopies = countCardCopies(issuer, 'au-path-of-the-unrighteous');
  const issuerHasUnrighteous = unrighteousCopies > 0;
  const issuerHasShadow = playerHasCard(issuer, 'su-path-of-the-shadow');

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
  newState.betraySelectionsRemaining = 2 + unrighteousCopies;
  newState.betraySelectedOwners = [];
  newState.betrayMandateIssuerId = issuerId;

  // Set current player to the issuer so they can interact
  const issuerIdx = newState.players.findIndex((p) => p.id === issuerId);
  if (issuerIdx >= 0) {
    newState.currentPlayerIndex = issuerIdx;
  }

  if (issuerHasShadow) {
    gainCoinsFromSupply(newState, issuerId, 3, 'Camino de la Sombra');
    newState.log = [...newState.log, `${issuer.name} gana 3 monedas (Camino de la Sombra - Traicionar)`];
  }

  if (issuerHasUnrighteous) {
    newState.log = [...newState.log, `${issuer.name} puede reemplazar 1 figura adicional (Camino del Injusto)`];
  }

  return newState;
}

export function betraySelectFigure(state: GameState, issuerId: string, figureId: string, provinceId: string, selectedMonsterCardId?: string): GameState {
  if (!state.betrayMandateActive || state.betrayMandateIssuerId !== issuerId) return state;

  let newState: GameState = {
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
  const unrighteousCopies = countCardCopies(issuer, 'au-path-of-the-unrighteous');
  const isUnrighteousExtraSelection = unrighteousCopies > 0 && newState.betraySelectionsRemaining <= unrighteousCopies;
  const figureOwner = newState.players.find((p) => p.id === figure.owner);
  if (!figureOwner) return state;

  // Validation: cannot target own figure
  if (figure.owner === issuerId) return state;

  // Validation: cannot target daimyo
  if (figure.type === 'daimyo' || figure.type === 'kami') return state;

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
  if (!isUnrighteousExtraSelection && newState.betraySelectedOwners.includes(figure.owner)) return state;

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
    newState.temples.forEach(temple => temple.figures.forEach(templeFigure => {
      if (templeFigure.playerId === issuerId && templeFigure.monsterCardId) deployedMonsterCardIds.add(templeFigure.monsterCardId);
    }));
    const availableMonsterCards = issuer.seasonCards.filter(
      (card) => card.cardType === 'monster' && !deployedMonsterCardIds.has(card.id)
    );
    if (!selectedMonsterCardId || !availableMonsterCards.some(card => card.id === selectedMonsterCardId) || issuer.monsters <= 0) return state;
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
    // Phoenix resurrection: if Phoenix is targeted by Betray, it revives in the same province
    if (figure.monsterCardId === 'sp-phoenix') {
      gainVictoryPoints(newState, figureOwner.id, 1, 'Phoenix');
      const phoenixId = Math.random().toString(36).substring(2, 10);
      const phoenixFigure: Figure = { type: 'monster', owner: figure.owner, id: phoenixId, monsterCardId: 'sp-phoenix' };
      newState.provinces[provinceId] = {
        ...newState.provinces[provinceId],
        figures: [...newState.provinces[provinceId].figures, phoenixFigure],
      };
      newState.log = [...newState.log, `Phoenix renace en ${province.name} - ${figureOwner.name} gana 1 PV`];
    } else {
      figureOwner.monsters += 1;
    }
  }

  // Decrement issuer's reserve
  if (figure.type === 'bushi') {
    issuer.bushi -= 1;
  } else if (figure.type === 'shinto') {
    issuer.shinto -= 1;
  } else if (figure.type === 'monster') {
    issuer.monsters -= 1;
  }

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

  if (replacementFigure.type === 'monster' && replacementFigure.monsterCardId) {
    applyMonsterEnterEffects(newState, provinceId, replacementFigure, issuerId);
  }

  // Virtue: Righteousness (sp-righteousness) - figure owner's figure was killed/replaced by betray
  applyRighteousnessVP(newState, figure.owner, 1);

  // If no selections remaining, keep betrayMandateActive true (wait for 'Terminar' button)
  if (newState.betraySelectionsRemaining <= 0) {
    return newState;
  }

  return newState;
}

function finalizeBetray(state: GameState): GameState {
  const triggeredBySnake = state.betrayTriggeredBySnake === true;
  const newState: GameState = {
    ...state,
    betrayMandateActive: false,
    betraySelectionsRemaining: 0,
    betraySelectedOwners: [],
    betrayReplacements: [],
    betrayMandateIssuerId: null,
    betrayTriggeredBySnake: false,
    log: [...state.log, 'Mandato de Traicionar resuelto'],
  };
  return triggeredBySnake ? advanceSnakeDecisionQueue(newState) : newState;
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
        syncKamiControllers(newState);
        newState.log = [...newState.log, `${player.name} sube a la cima del Track de Honor (Amaterasu)`];
      } else {
        newState.log = [...newState.log, `${player.name} permanece en la cima del Track de Honor (Amaterasu)`];
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
      gainVictoryPoints(newState, playerId, fortressCount, 'Susanoo');
      newState.log = [...newState.log, `${player.name} obtiene ${fortressCount} PV por Fortalezas (Susanoo)`];
      break;
    }
    case 'tsukuyomi': {
      // Grant +2 coins
      gainCoinsFromSupply(newState, playerId, 2, 'Tsukuyomi');
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

export function getKamiInProvince(state: GameState, provinceId: string, kamiType?: KamiType): Figure | undefined {
  return state.provinces[provinceId]?.figures.find(figure =>
    figure.type === 'kami' && (!kamiType || figure.kamiType === kamiType)
  );
}

export function isProtectedByAmaterasu(state: GameState, provinceId: string, playerId: string): boolean {
  if (!state.kamiUnboundEnabled || !getKamiInProvince(state, provinceId, 'amaterasu')) return false;
  const province = state.provinces[provinceId];
  if (!province || calculateForce(province, playerId, state) <= 0) return false;
  const represented = state.players.filter(player => calculateForce(province, player.id, state) > 0);
  const playerHonor = state.honorTrack.indexOf(playerId);
  return represented.every(player => state.honorTrack.indexOf(player.id) >= playerHonor);
}

export function canBeKilledByPlayer(state: GameState, provinceId: string, figure: Figure, killerId: string): boolean {
  if (figure.type === 'kami') return false;
  if (figure.owner !== killerId && isProtectedByAmaterasu(state, provinceId, figure.owner)) return false;
  return true;
}

/** Keep manifested Kami attached to the current top worshipper after shrine or Honor changes. */
export function syncKamiControllers(state: GameState): void {
  if (!state.kamiUnboundEnabled) return;
  for (const temple of state.temples) {
    const { winnerId } = computeTempleWinner(temple.figures, state.honorTrack, state.players);
    if (!winnerId) continue;
    for (const province of Object.values(state.provinces)) {
      const kami = province.figures.find(figure => figure.type === 'kami' && figure.kamiType === temple.kamiType);
      if (kami) kami.owner = winnerId;
    }
  }

  // A control change during War can introduce a new clan into an unresolved
  // battle. Preserve existing bidders and include the new controller in force totals.
  for (const battle of state.activeBattles) {
    if (battle.resolved) continue;
    const province = state.provinces[battle.provinceId];
    if (!province) continue;
    const presentOwners = province.figures
      .filter(figure => figure.type !== 'fortress')
      .map(figure => figure.owner);
    battle.participants = [...new Set([...battle.participants, ...presentOwners])];
  }
}

export function selectKamiManifestationProvince(state: GameState, playerId: string, provinceId: string): GameState {
  if (!state.kamiUnboundEnabled || !state.kamiPlacementActive || state.kamiPlacementPlayerId !== playerId) return state;
  if (!state.provinces[provinceId] || provinceId === 'ocean') return state;
  return { ...state, kamiPlacementProvinceId: provinceId };
}

export function undoKamiManifestationProvince(state: GameState, playerId: string): GameState {
  if (!state.kamiPlacementActive || state.kamiPlacementPlayerId !== playerId) return state;
  return { ...state, kamiPlacementProvinceId: null };
}

export function confirmKamiManifestation(state: GameState, playerId: string): GameState {
  const kamiType = state.kamiPlacementKamiType;
  if (!state.kamiPlacementActive || state.kamiPlacementPlayerId !== playerId || !kamiType) return state;
  const currentProvinceId = Object.entries(state.provinces).find(([, province]) =>
    province.figures.some(figure => figure.type === 'kami' && figure.kamiType === kamiType)
  )?.[0];
  const provinceId = state.kamiPlacementProvinceId || currentProvinceId;
  if (!provinceId) return state;
  const destination = state.provinces[provinceId];
  if (!destination || provinceId === 'ocean') return state;

  const provinces = Object.fromEntries(Object.entries(state.provinces).map(([id, province]) => [
    id,
    { ...province, figures: province.figures.filter(figure => !(figure.type === 'kami' && figure.kamiType === kamiType)) },
  ]));
  provinces[provinceId] = {
    ...provinces[provinceId],
    figures: [...provinces[provinceId].figures, { type: 'kami', owner: playerId, id: `kami-${kamiType}`, kamiType }],
  };
  const player = state.players.find(candidate => candidate.id === playerId);
  const kamiName = KAMI_DATA.find(kami => kami.type === kamiType)?.name || kamiType;
  let nextState: GameState = {
    ...state,
    provinces,
    kamiPlacementActive: false,
    kamiPlacementPlayerId: null,
    kamiPlacementKamiType: null,
    kamiPlacementProvinceId: null,
    kamiManifestedTempleIndexes: [...new Set([...(state.kamiManifestedTempleIndexes || []), state.kamiResolutionIndex])],
    log: [
      ...state.log,
      state.kamiPlacementProvinceId
        ? `${player?.name || 'Jugador'} manifiesta a ${kamiName} en ${destination.name} (Kami Unbound)`
        : `${player?.name || 'Jugador'} mantiene a ${kamiName} en ${destination.name} (Kami Unbound)`,
    ],
  };
  syncKamiControllers(nextState);
  nextState = advanceKamiResolution(nextState);
  return nextState;
}

/**
 * Rebuild a prepared Kami turn after optional end-of-Recruit placements finish.
 * Path of the Light may populate a shrine that was empty when advancePlayer first
 * prepared the Kami queue, so the final board must be authoritative.
 */
export function refreshPendingKamiResolution(state: GameState): GameState {
  if (!state.kamiPhasePopupPending || state.pendingSpringPlacement) return state;

  const sortedTemples = [...state.temples].sort((a, b) => a.position - b.position);
  const resolutionTemples: KamiResolutionTemple[] = [];
  const occupiedSkipEntries = new Set<string>();

  for (const temple of sortedTemples) {
    const kamiData = KAMI_DATA.find(kami => kami.type === temple.kamiType);
    const { forces } = computeTempleWinner(temple.figures, state.honorTrack, state.players);
    if (forces.length === 0) continue;

    occupiedSkipEntries.add(`Santuario ${temple.position} (${kamiData?.name || temple.kamiType}) - sin figuras, saltado`);
    resolutionTemples.push({
      templeIndex: state.temples.findIndex(candidate => candidate.id === temple.id),
      kamiType: temple.kamiType,
      winnerId: null,
      reward: kamiData?.effect || '',
      forces,
    });
  }

  if (resolutionTemples.length === 0) return state;

  const firstTemple = resolutionTemples[0];
  const firstBoardTemple = state.temples[firstTemple.templeIndex];
  const { winnerId: firstWinnerId } = computeTempleWinner(
    firstBoardTemple.figures,
    state.honorTrack,
    state.players,
  );
  resolutionTemples[0] = { ...firstTemple, winnerId: firstWinnerId };

  if (firstTemple.kamiType === 'susanoo' && firstWinnerId) {
    const fortressCount = Object.values(state.provinces).reduce((total, province) =>
      total + province.figures.filter(figure =>
        figure.owner === firstWinnerId
        && (figure.type === 'fortress' || (figure.type === 'monster' && figure.monsterCardId === 'sp-fukurokuju'))
      ).length, 0);
    resolutionTemples[0] = { ...resolutionTemples[0], susanooVPGained: fortressCount };
  }

  const currentKamiLogStart = state.log.lastIndexOf('--- Turno Kami ---');
  return {
    ...state,
    kamiResolutionTemples: resolutionTemples,
    kamiResolutionIndex: 0,
    kamiResolutionStep: 'showing',
    kamiResolutionCurrentPlayerId: firstWinnerId,
    log: state.log.filter((entry, index) =>
      index <= currentKamiLogStart || !occupiedSkipEntries.has(entry)
    ),
  };
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

  applyPatienceAtKamiEnd(newState);

  return newState;
}

export function betrayReplaceWorshippingShinto(state: GameState, issuerId: string, templeId: string, figureId: string): GameState {
  if (!state.betrayMandateActive || state.betrayMandateIssuerId !== issuerId) return state;
  const issuer = state.players.find(player => player.id === issuerId);
  const unrighteousCopies = countCardCopies(issuer, 'au-path-of-the-unrighteous');
  const isExtraSelection = unrighteousCopies > 0 && state.betraySelectionsRemaining <= unrighteousCopies;
  if (!issuer || !isExtraSelection || issuer.shinto <= 0) return state;
  const temple = state.temples.find(candidate => candidate.id === templeId);
  const target = temple?.figures.find(figure => figure.figureId === figureId && figure.playerId !== issuerId);
  if (!temple || !target) return state;
  const victim = state.players.find(player => player.id === target.playerId);
  if (!victim) return state;

  const nextState: GameState = {
    ...state,
    players: state.players.map(player => ({ ...player })),
    temples: state.temples.map(candidate => ({ ...candidate, figures: [...candidate.figures] })),
    betraySelectedOwners: [...state.betraySelectedOwners],
    betrayReplacements: [...state.betrayReplacements],
    log: [...state.log],
  };
  const nextIssuer = nextState.players.find(player => player.id === issuerId)!;
  const nextVictim = nextState.players.find(player => player.id === target.playerId)!;
  const nextTemple = nextState.temples.find(candidate => candidate.id === templeId)!;
  nextTemple.figures = [
    ...nextTemple.figures.filter(figure => figure.figureId !== figureId),
    { playerId: issuerId, figureId: generateId() },
  ];
  nextIssuer.shinto -= 1;
  if (target.monsterCardId) nextVictim.monsters += 1;
  else nextVictim.shinto += 1;
  nextState.betraySelectionsRemaining -= 1;
  nextState.betraySelectedOwners.push(target.playerId);
  const kamiName = KAMI_DATA.find(kami => kami.type === nextTemple.kamiType)?.name || nextTemple.kamiType;
  nextState.betrayReplacements.push({
    figureType: 'shinto',
    targetClanId: nextVictim.clanId,
    targetPlayerName: nextVictim.name,
    provinceId: `temple:${templeId}`,
    provinceName: kamiName,
    targetMonsterName: target.monsterCardId ? SEASON_CARDS_DATA.find(card => card.id === target.monsterCardId)?.name : undefined,
    targetMonsterCardId: target.monsterCardId,
  });
  applyRighteousnessVP(nextState, nextVictim.id, 1);
  nextState.log.push(`${nextIssuer.name} reemplaza el Shinto rezando de ${nextVictim.name} en ${kamiName}; la figura sustituida vuelve a su reserva (Camino del Injusto)`);
  syncKamiControllers(nextState);
  return nextState;
}

function applyPatienceAtKamiEnd(state: GameState): void {
  const maxVP = Math.max(...state.players.map(player => player.victoryPoints));
  const qualifyingPlayerIds = state.players.filter(player => player.victoryPoints < maxVP).map(player => player.id);
  for (const playerId of qualifyingPlayerIds) {
    const player = state.players.find(candidate => candidate.id === playerId)!;
    const copies = countCardCopies(player, 'su-patience');
    if (copies <= 0) continue;
    for (let copy = 0; copy < copies; copy += 1) gainVictoryPoints(state, player.id, 1, 'Paciencia');
    state.log.push(`${player.name} gana ${copies} PV por no estar empatado a la mayor cantidad de PV (Paciencia${copies > 1 ? `, ${copies} copias` : ''})`);
    state.pendingRuleNotices = [...(state.pendingRuleNotices || []), {
      id: generateId(),
      type: 'patience',
      actorId: player.id,
      targetId: player.id,
      requiredPlayerIds: state.players.map(candidate => candidate.id),
      acknowledgedPlayerIds: [],
      rewardAmount: copies,
      resume: null,
    }];
  }
}

/**
 * Apply the kami ability for the current kamiResolutionIndex temple's winner.
 * For auto rewards (amaterasu, hachiman, susanoo, tsukuyomi), apply the effect.
 * For interactive rewards (fujin, raijin, ryujin), set interactive flags.
 */
export function resolveCurrentKamiReward(state: GameState): GameState {
  if (!state.kamiResolutionActive) return state;
  let currentTemple = state.kamiResolutionTemples[state.kamiResolutionIndex];
  if (!currentTemple) return state;

  // The board is authoritative. Earlier Kami rewards may add a praying figure to a
  // later Shrine, so both its forces and winner must be rebuilt at resolution time.
  let winnerId: string | null = null;
  let newState = { ...state };
  {
    const temple = newState.temples[currentTemple.templeIndex];
    const computed = computeTempleWinner(temple.figures, newState.honorTrack, newState.players);
    winnerId = computed.winnerId;
    const updatedTemples = [...newState.kamiResolutionTemples];
    const updatedTemple = { ...updatedTemples[newState.kamiResolutionIndex], winnerId, forces: computed.forces };

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
    currentTemple = updatedTemple;
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
  const currentTemple = state.kamiResolutionTemples[state.kamiResolutionIndex];
  const vassalOwnerId = currentTemple?.winnerId || state.kamiResolutionCurrentPlayerId;
  const vassalOwner = state.players.find(player => player.id === vassalOwnerId);
  if (vassalOwner && !(state.kamiVassalResolvedTempleIndexes || []).includes(state.kamiResolutionIndex)) {
    const copies = countCardCopies(vassalOwner, 'sp-path-of-the-vassal');
    if (copies > 0 && vassalOwner.coins >= 2) {
      return {
        ...state,
        pendingVassalDecision: { ownerId: vassalOwner.id, templeIndex: state.kamiResolutionIndex, copyNumber: 1, remainingCopies: copies },
      };
    }
    state = { ...state, kamiVassalResolvedTempleIndexes: [...(state.kamiVassalResolvedTempleIndexes || []), state.kamiResolutionIndex] };
  }

  // Kami Unbound: after the shrine ability (and its reactions) the top worshipper
  // manifests or relocates the Kami in any Province. The selection is persisted so
  // reconnecting players resume the exact interaction instead of advancing the turn.
  if (
    state.kamiUnboundEnabled
    && currentTemple?.winnerId
    && !(state.kamiManifestedTempleIndexes || []).includes(state.kamiResolutionIndex)
  ) {
    return {
      ...state,
      kamiResolutionStep: 'interactive',
      kamiPlacementActive: true,
      kamiPlacementPlayerId: currentTemple.winnerId,
      kamiPlacementKamiType: currentTemple.kamiType,
      kamiPlacementProvinceId: null,
    };
  }
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
      kamiPlacementActive: false,
      kamiPlacementPlayerId: null,
      kamiPlacementKamiType: null,
      kamiPlacementProvinceId: null,
      kamiManifestedTempleIndexes: [],
      kamiSummaryVisible: false,
      kamiSummaryData: summaryData,
      kamiSummaryReadyPlayers: [],
      pendingVassalDecision: null,
      kamiVassalResolvedTempleIndexes: [],
    };
    applyPatienceAtKamiEnd(newState);
    newState.log = [...newState.log, '--- Fin Turno Kami ---'];

    // Advance currentPlayerIndex to the next player (computed at kami start)
    newState.currentPlayerIndex = state.kamiResolutionNextPlayerIndex;

    newState = startWayOfTheSnakeDecisions(newState);

    // Check if politics phase is done
    if (newState.politicsMandateCount >= newState.maxMandates) {
      return newState;
    }

    // Continue with next player's mandate turn
    return newState;
  }

  // Move to the next temple
  const nextTemple = state.kamiResolutionTemples[nextIndex];
  let nextWinnerId: string | null = null;

  // Compute winner dynamically for the next temple using current honorTrack
  let updatedTemples = state.kamiResolutionTemples;
  if (nextTemple) {
    const temple = state.temples[nextTemple.templeIndex];
    const computed = computeTempleWinner(temple.figures, state.honorTrack, state.players);
    nextWinnerId = computed.winnerId;
    updatedTemples = [...state.kamiResolutionTemples];
    const updatedNextTemple: typeof nextTemple = { ...nextTemple, winnerId: nextWinnerId, forces: computed.forces };

    // Compute susanoo VP if applicable
    if (nextTemple.kamiType === 'susanoo' && nextWinnerId) {
      let fortressCount = 0;
      Object.values(state.provinces).forEach((province) => {
        fortressCount += province.figures.filter(
          (f) => f.owner === nextWinnerId && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju'))
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
    kamiPlacementActive: false,
    kamiPlacementPlayerId: null,
    kamiPlacementKamiType: null,
    kamiPlacementProvinceId: null,
  };
}

export function resolveVassalDecision(state: GameState, playerId: string, accept: boolean): GameState {
  const pending = state.pendingVassalDecision;
  if (!pending || pending.ownerId !== playerId) return state;
  const nextState = cloneForUpgradeMutation(state);
  const owner = nextState.players.find(player => player.id === playerId);
  if (!owner) return state;
  if (accept) {
    if (owner.coins < 2) return state;
    owner.coins -= 2;
    gainVictoryPoints(nextState, playerId, 2, 'Camino del Vasallo');
    nextState.log.push(`${owner.name} dona 2 monedas y gana 2 PV (Camino del Vasallo)`);
  } else {
    nextState.log.push(`${owner.name} decide no usar Camino del Vasallo${pending.copyNumber > 1 ? ` (copia ${pending.copyNumber})` : ''}`);
  }
  const remainingCopies = pending.remainingCopies - 1;
  if (remainingCopies > 0 && owner.coins >= 2) {
    nextState.pendingVassalDecision = { ...pending, remainingCopies, copyNumber: pending.copyNumber + 1 };
    return nextState;
  }
  nextState.pendingVassalDecision = null;
  nextState.kamiVassalResolvedTempleIndexes = [...(nextState.kamiVassalResolvedTempleIndexes || []), pending.templeIndex];
  return advanceKamiResolution(nextState);
}

function advanceSnakeDecisionQueue(state: GameState): GameState {
  const [nextOwnerId, ...remainingOwnerIds] = state.pendingSnakeOwnerQueue || [];
  if (!nextOwnerId) {
    return {
      ...state,
      pendingSnakeDecision: null,
      pendingSnakeOwnerQueue: [],
      betrayTriggeredBySnake: false,
      kamiSummaryVisible: true,
      currentPlayerIndex: state.snakeResumePlayerIndex ?? state.currentPlayerIndex,
      snakeResumePlayerIndex: null,
    };
  }
  return {
    ...state,
    pendingSnakeDecision: { ownerId: nextOwnerId },
    pendingSnakeOwnerQueue: remainingOwnerIds,
    kamiSummaryVisible: false,
    snakeResumePlayerIndex: state.snakeResumePlayerIndex ?? state.currentPlayerIndex,
  };
}

function startWayOfTheSnakeDecisions(state: GameState): GameState {
  if (state.betrayMandateActive) return state;
  const ownerIds = state.honorTrack.filter(playerId => {
    const player = state.players.find(candidate => candidate.id === playerId);
    return playerHasCard(player, 'au-way-of-the-snake');
  });
  if (ownerIds.length === 0) return { ...state, kamiSummaryVisible: true, snakeResumePlayerIndex: null };
  const [firstOwnerId, ...remainingOwnerIds] = ownerIds;
  return {
    ...state,
    pendingSnakeDecision: { ownerId: firstOwnerId },
    pendingSnakeOwnerQueue: remainingOwnerIds,
    snakeResumePlayerIndex: state.currentPlayerIndex,
    kamiSummaryVisible: false,
  };
}

export function resolveSnakeDecision(state: GameState, playerId: string, useEffect: boolean): GameState {
  if (state.pendingSnakeDecision?.ownerId !== playerId || state.betrayMandateActive) return state;
  const owner = state.players.find(player => player.id === playerId);
  if (!owner || !playerHasCard(owner, 'au-way-of-the-snake')) return state;
  const nextState: GameState = {
    ...state,
    pendingSnakeDecision: null,
    log: [...state.log],
  };
  if (!useEffect) {
    nextState.log.push(`${owner.name} decide no usar Via de la Serpiente tras el Turno Kami`);
    return advanceSnakeDecisionQueue(nextState);
  }
  const betrayed = executeBetray(nextState, playerId);
  betrayed.betrayTriggeredBySnake = true;
  betrayed.kamiSummaryVisible = false;
  betrayed.log.push(`${owner.name} activa Via de la Serpiente y realiza un Mandato de Traicionar`);
  return betrayed;
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
          gainCoinsFromSupply(state, player.id, 3, 'Way of the Shogun');
          state.log = [...state.log, `${player.name} obtiene 3 Monedas (Way of the Shogun). Total {coin} ${player.coins}`];
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
          state.log = [...state.log, `${player.name} toma monedas de jugadores con menor honor (Way of the Righteous). Total {coin} ${player.coins}`];
          break;
        }
        case 'su-way-of-bushido': {
          // Gain 2 Coins and 2 VP for each Virtue owned.
          const virtueCount = countDifferentVirtues(player);
          const reward = 2 * virtueCount;
          gainCoinsFromSupply(state, player.id, reward, 'Way of Bushido');
          gainVictoryPoints(state, player.id, reward, 'Way of Bushido');
          state.log = [...state.log, `${player.name} obtiene ${reward} Monedas y ${reward} PV (Way of Bushido, ${virtueCount} virtudes). Total {coin} ${player.coins}`];
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
          gainCoinsFromSupply(state, player.id, 5, 'Way of the Moneylender');
          state.log = [...state.log, `${player.name} obtiene 5 Monedas (Way of the Moneylender). Total {coin} ${player.coins}`];
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
    tradeOffers: [],
    activeBattles: [],
    warPhaseReadyPlayers: [],
    warPhaseStartAcknowledged: false,
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
    daikaijuPlacementActive: false,
    daikaijuPlacementPlayerId: null,
    daikaijuPlacementProvinceId: null,
    daikaijuSummaryVisible: false,
    daikaijuSummaryReadyPlayers: [],
    daikaijuSummaryData: null,
    zorroPlacementActive: false,
    zorroPlacementPlayerId: null,
    zorroPlacementsRemaining: 0,
    warStartActions: [],
    warStartActionIndex: 0,
    warStartActionsComplete: false,
    warStartSelection: null,
    pendingBattleCardDecision: null,
    pendingMonsterEnterDecision: null,
    pendingBattleMercyDecision: null,
    pendingNinjaDecision: null,
    players: state.players.map((p) => ({ ...p, warProvinceTokens: [...p.warProvinceTokens], hostages: [...p.hostages], seasonCards: [...p.seasonCards] })),
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

  // Apply war upgrade card effects at start of war phase
  applyWarUpgrades(newState);

  // Legacy automatic path disabled: Sunakake-Baba now resolves through the honor-ordered queue.
  for (const provId of [] as string[]) {
    const prov = newState.provinces[provId];
    const sunakakeFigure = prov.figures.find(f => f.type === 'monster' && f.monsterCardId === 'su-sunakake-baba');
    if (!sunakakeFigure) continue;
    const sunakakeOwner = newState.players.find(p => p.id === sunakakeFigure.owner);
    if (!sunakakeOwner) continue;
    const targetFigure = prov.figures.find(
      f => f.owner !== sunakakeFigure.owner && (f.type === 'bushi' || f.type === 'shinto')
    );
    if (!targetFigure) continue;
    const victim = newState.players.find(p => p.id === targetFigure.owner);
    if (!victim) continue;
    const hostage: Hostage = { fromClanId: targetFigure.owner, figureType: targetFigure.type, monsterCardId: targetFigure.monsterCardId };
    sunakakeOwner.hostages = [...sunakakeOwner.hostages, hostage];
    newState.provinces[provId] = {
      ...prov,
      figures: prov.figures.filter(f => f.id !== targetFigure.id),
    };
    const stolenVP = Math.min(1, victim.victoryPoints);
    victim.victoryPoints -= stolenVP;
    if (stolenVP > 0) gainVictoryPoints(newState, sunakakeOwner.id, stolenVP, 'Sunakake-Baba');
    newState.log = [...newState.log, `${sunakakeOwner.name} roba ${stolenVP} PV a ${victim.name} al tomar el rehen. Total ${sunakakeOwner.name}: ${sunakakeOwner.victoryPoints} PV; ${victim.name}: ${victim.victoryPoints} PV`];
    newState.log = [...newState.log, `🧹 Sunakake-Baba de ${sunakakeOwner.name} toma rehén ${targetFigure.type} de ${victim.name} en ${prov.name}`];
  }

  // Daikaiju effect: detect if Daikaiju is in ocean, set up interactive placement
  const oceanProv = newState.provinces['ocean'];
  if (oceanProv) {
    const daikaijuFigure = oceanProv.figures.find(f => f.type === 'monster' && f.monsterCardId === 'au-daikaiju');
    if (daikaijuFigure) {
      newState.daikaijuPlacementActive = true;
      newState.daikaijuPlacementPlayerId = daikaijuFigure.owner;
      newState.daikaijuPlacementProvinceId = null;
      const daikaijuOwner = newState.players.find(p => p.id === daikaijuFigure.owner);
      newState.log = [...newState.log, `🦕 Daikaiju de ${daikaijuOwner?.name || 'jugador'} espera para ser colocado en una provincia`];
    }
  }

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

    // Classification is deferred until Nure-Onna has decided whether to join this battle.
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
    newState.log = [...newState.log, `${activeBattles.length} batallas por resolver`];
  }
  newState.warStartActions = buildWarStartActions(newState);
  newState.warStartActionsComplete = newState.warStartActions.length === 0;
  return activateCurrentWarStartAction(newState);
}

/**
 * After Zorro finishes placing bushi, re-evaluate battles:
 * - Award tokens for uncontested provinces (0 or 1 player)
 * - Resolve allied battles (2 allied players, strongest wins)
 * Must be called after Zorro placement is complete.
 */
function findPendingNureOnnaForBattle(state: GameState, battle: Battle) {
  const checked = state.nureOnnaCheckedBattles?.[battle.provinceId] || [];
  const destination = state.provinces[battle.provinceId];
  for (const ownerId of state.honorTrack) {
    const plague = destination?.figures.find(figure => figure.type === 'monster' && figure.monsterCardId === 'au-oni-of-plagues' && figure.owner !== ownerId);
    if (plague && state.honorTrack.indexOf(ownerId) < state.honorTrack.indexOf(plague.owner)) continue;
    for (const [fromProvinceId, province] of Object.entries(state.provinces)) {
      if (fromProvinceId === battle.provinceId || !province.seaRoutes.includes(battle.provinceId)) continue;
      const figure = province.figures.find(item =>
        item.owner === ownerId && item.type === 'monster' && item.monsterCardId === 'su-nure-onna' && !checked.includes(item.id));
      if (figure && !isFigureTrappedBySusanoo(state, fromProvinceId, figure)) {
        return { ownerId, figureId: figure.id, fromProvinceId, battleProvinceId: battle.provinceId };
      }
    }
  }
  return null;
}

function buildWarStartActions(state: GameState): WarStartAction[] {
  const actions: WarStartAction[] = [];
  for (const playerId of state.honorTrack) {
    const player = state.players.find(candidate => candidate.id === playerId);
    if (!player) continue;
    if (player.clanId === 'zorro') {
      actions.push({ id: generateId(), type: 'zorro', playerId });
    }
    const sunakakeFigure = Object.values(state.provinces).flatMap(province => province.figures).find(figure =>
      figure.owner === playerId && figure.type === 'monster' && figure.monsterCardId === 'su-sunakake-baba');
    if (sunakakeFigure) actions.push({ id: generateId(), type: 'sunakake', playerId, cardId: 'su-sunakake-baba' });
    for (const card of player.seasonCards) {
      const cardId = card.id.endsWith('-2') ? card.id.slice(0, -2) : card.id;
      if (cardId === 'su-way-of-naginata' || cardId === 'au-way-of-naginata') {
        actions.push({ id: generateId(), type: 'naginata', playerId, cardId: card.id });
      } else if (cardId === 'su-way-of-the-ashigaru') {
        actions.push({ id: generateId(), type: 'ashigaru', playerId, cardId: card.id });
      } else if (cardId === 'au-way-of-the-keiri') {
        actions.push({ id: generateId(), type: 'keiri', playerId, cardId: card.id });
      }
    }
  }
  return actions;
}

export function getCurrentWarStartAction(state: GameState): WarStartAction | null {
  if (state.warStartActionsComplete) return null;
  return state.warStartActions?.[state.warStartActionIndex || 0] || null;
}

function refreshBattleParticipants(state: GameState): void {
  state.activeBattles = state.activeBattles.map(battle => {
    const province = state.provinces[battle.provinceId];
    const participants = state.honorTrack.filter(playerId => {
      const player = state.players.find(candidate => candidate.id === playerId);
      if (player?.clanId === 'tortuga') return province.figures.some(figure => figure.owner === playerId);
      return province.figures.some(figure => figure.owner === playerId && figure.type !== 'fortress');
    });
    return { ...battle, participants, uncontested: undefined, winner: undefined };
  });
}

function activateCurrentWarStartAction(state: GameState): GameState {
  const nextState: GameState = {
    ...state,
    zorroPlacementActive: false,
    zorroPlacementPlayerId: null,
    zorroPlacementsRemaining: 0,
    warStartSelection: null,
  };
  const action = getCurrentWarStartAction(nextState);
  if (!action) {
    nextState.warStartActionsComplete = true;
    refreshBattleParticipants(nextState);
    return nextState;
  }
  if (action.type === 'zorro') {
    const player = nextState.players.find(candidate => candidate.id === action.playerId);
    const eligible = nextState.warProvinceSlots.filter(slot => {
      const province = nextState.provinces[slot.provinceId];
      return province && !province.figures.some(figure => figure.owner === action.playerId && figure.type !== 'fortress');
    });
    const remaining = Math.min(player?.bushi || 0, eligible.length);
    if (remaining > 0) {
      nextState.zorroPlacementActive = true;
      nextState.zorroPlacementPlayerId = action.playerId;
      nextState.zorroPlacementsRemaining = remaining;
    } else {
      return advanceWarStartAction(nextState);
    }
  }
  return nextState;
}

export function advanceWarStartAction(state: GameState): GameState {
  const nextIndex = (state.warStartActionIndex || 0) + 1;
  const nextState: GameState = { ...state, warStartActionIndex: nextIndex, warStartSelection: null };
  if (nextIndex >= (state.warStartActions?.length || 0)) {
    nextState.warStartActionsComplete = true;
  }
  return activateCurrentWarStartAction(nextState);
}

export function selectWarStartFigure(state: GameState, playerId: string, provinceId: string, figureId: string): GameState {
  const action = getCurrentWarStartAction(state);
  const province = state.provinces[provinceId];
  const figure = province?.figures.find(candidate => candidate.id === figureId);
  if (!action || action.playerId !== playerId || !province || !figure) return state;

  if (action.type === 'naginata') {
    if (figure.owner !== playerId || figure.type !== 'bushi') return state;
    return { ...state, warStartSelection: { sourceProvinceId: provinceId, figureId } };
  }

  if (action.type === 'keiri') {
    if (figure.owner === playerId || (figure.type !== 'bushi' && figure.type !== 'shinto') || !canBeKilledByPlayer(state, provinceId, figure, playerId)) return state;
    const hasDaimyo = province.figures.some(candidate => candidate.owner === playerId && (
      candidate.type === 'daimyo' || (candidate.type === 'monster' && ['su-yurei', 'sp-fukurokuju'].includes(candidate.monsterCardId || ''))
    ));
    if (!hasDaimyo) return state;
    const selected = state.warStartSelection?.targetFigureIds || [];
    const alreadySelected = selected.includes(figureId);
    const selectedInProvince = selected.filter(id => province.figures.some(candidate => candidate.id === id)).length;
    if (!alreadySelected && selectedInProvince >= 2) return state;
    return {
      ...state,
      warStartSelection: {
        ...state.warStartSelection,
        targetFigureIds: alreadySelected ? selected.filter(id => id !== figureId) : [...selected, figureId],
      },
    };
  }
  if (action.type === 'sunakake') {
    if (figure.owner === playerId || (figure.type !== 'bushi' && figure.type !== 'shinto')) return state;
    const hasSunakake = province.figures.some(candidate => candidate.owner === playerId && candidate.type === 'monster' && candidate.monsterCardId === 'su-sunakake-baba');
    if (!hasSunakake) return state;
    return { ...state, warStartSelection: { targetFigureIds: [figureId] } };
  }
  return state;
}

export function selectWarStartProvince(state: GameState, playerId: string, provinceId: string): GameState {
  const action = getCurrentWarStartAction(state);
  const province = state.provinces[provinceId];
  if (!action || action.playerId !== playerId || !province || provinceId === 'ocean') return state;
  if (action.type === 'naginata') {
    const selection = state.warStartSelection;
    if (!selection?.figureId || selection.sourceProvinceId === provinceId) return state;
    return { ...state, warStartSelection: { ...selection, destinationProvinceId: provinceId } };
  }
  if (action.type === 'ashigaru') {
    const player = state.players.find(candidate => candidate.id === playerId);
    if (!player || player.bushi <= 0) return state;
    const ownFigures = province.figures.filter(figure => figure.owner === playerId && (figure.type !== 'fortress' || player.clanId === 'tortuga'));
    if (ownFigures.length !== 1) return state;
    return { ...state, warStartSelection: { provinceId } };
  }
  return state;
}

export function resetWarStartSelection(state: GameState, playerId: string): GameState {
  const action = getCurrentWarStartAction(state);
  return action?.playerId === playerId ? { ...state, warStartSelection: null } : state;
}

export function toggleWarStartMercy(state: GameState, playerId: string, provinceId: string): GameState {
  const action = getCurrentWarStartAction(state);
  const player = state.players.find(candidate => candidate.id === playerId);
  if (action?.type !== 'keiri' || action.playerId !== playerId || !playerHasCard(player, 'su-mercy')) return state;
  const selectedTargets = state.warStartSelection?.targetFigureIds || [];
  const province = state.provinces[provinceId];
  if (!province?.figures.some(figure => selectedTargets.includes(figure.id))) return state;
  const mercyProvinceIds = state.warStartSelection?.mercyProvinceIds || [];
  return {
    ...state,
    warStartSelection: {
      ...state.warStartSelection,
      mercyProvinceIds: mercyProvinceIds.includes(provinceId)
        ? mercyProvinceIds.filter(id => id !== provinceId)
        : [...mercyProvinceIds, provinceId],
    },
  };
}

export function confirmWarStartAction(state: GameState, playerId: string): GameState {
  const action = getCurrentWarStartAction(state);
  if (!action || action.playerId !== playerId) return state;
  const nextState: GameState = {
    ...state,
    players: state.players.map(player => ({ ...player })),
    provinces: Object.fromEntries(Object.entries(state.provinces).map(([id, province]) => [id, { ...province, figures: [...province.figures] }])) as GameState['provinces'],
    log: [...state.log],
  };
  const player = nextState.players.find(candidate => candidate.id === playerId);
  const selection = state.warStartSelection;

  if (action.type === 'naginata' && selection?.sourceProvinceId && selection.destinationProvinceId && selection.figureId) {
    const source = nextState.provinces[selection.sourceProvinceId];
    const destination = nextState.provinces[selection.destinationProvinceId];
    const figure = source?.figures.find(candidate => candidate.id === selection.figureId && candidate.owner === playerId && candidate.type === 'bushi');
    if (!source || !destination || !figure) return state;
    if (isFigureTrappedBySusanoo(nextState, selection.sourceProvinceId, figure)) return state;
    const plague = destination.figures.find(candidate => candidate.type === 'monster' && candidate.monsterCardId === 'au-oni-of-plagues' && candidate.owner !== playerId);
    if (plague && nextState.honorTrack.indexOf(playerId) < nextState.honorTrack.indexOf(plague.owner)) return state;
    if (player?.clanId === 'luna' && destination.figures.filter(candidate => candidate.owner === playerId && candidate.type !== 'fortress').length >= 2) return state;
    source.figures = source.figures.filter(candidate => candidate.id !== figure.id);
    destination.figures.push(figure);
    nextState.log.push(`${player?.name || 'Jugador'} mueve 1 Bushi de ${source.name} a ${destination.name} (Way of Naginata)`);
  } else if (action.type === 'ashigaru' && selection?.provinceId && player) {
    const province = nextState.provinces[selection.provinceId];
    const ownFigures = province?.figures.filter(figure => figure.owner === playerId && (figure.type !== 'fortress' || player.clanId === 'tortuga')) || [];
    if (!province || ownFigures.length !== 1 || player.bushi <= 0) return state;
    const summoned = Math.min(2, player.bushi);
    for (let index = 0; index < summoned; index += 1) province.figures.push(createFigure('bushi', playerId));
    player.bushi -= summoned;
    nextState.log.push(`${player.name} invoca ${summoned} Bushi en ${province.name} (Way of the Ashigaru)`);
  } else if (action.type === 'keiri' && player) {
    const targets = selection?.targetFigureIds || [];
    const mercyProvinceIds = selection?.mercyProvinceIds || [];
    let killed = 0;
    const justiceVictims = new Set<string>();
    for (const [provinceId, province] of Object.entries(nextState.provinces)) {
      const provinceTargets = province.figures.filter(figure => targets.includes(figure.id));
      if (provinceTargets.length === 0) continue;
      const figuresBeforeDeath = [...province.figures];
      const hasDaimyo = province.figures.some(figure => figure.owner === playerId && (
        figure.type === 'daimyo' || (figure.type === 'monster' && ['su-yurei', 'sp-fukurokuju'].includes(figure.monsterCardId || ''))
      ));
      if (!hasDaimyo || provinceTargets.length > 2 || provinceTargets.some(figure =>
        figure.owner === playerId
        || (figure.type !== 'bushi' && figure.type !== 'shinto')
        || !canBeKilledByPlayer(nextState, provinceId, figure, playerId)
      )) return state;
      if (provinceTargets.length > 0 && mercyProvinceIds.includes(provinceId)) {
        gainVictoryPoints(nextState, playerId, 2, 'Misericordia');
        nextState.log.push(`${player.name} perdona las figuras seleccionadas en ${province.name} y gana 2 PV (Misericordia)`);
        continue;
      }
      for (const target of provinceTargets) {
        const victim = nextState.players.find(candidate => candidate.id === target.owner);
        if (target.type === 'bushi' && victim) victim.bushi += 1;
        if (target.type === 'shinto' && victim) victim.shinto += 1;
        province.figures = province.figures.filter(figure => figure.id !== target.id);
        killed += 1;
        if (victim) {
          applyRighteousnessVP(nextState, victim.id, 1);
          if (nextState.honorTrack.indexOf(victim.id) > nextState.honorTrack.indexOf(playerId)) justiceVictims.add(victim.id);
        }
      }
      applyProvinceDeathCardEffects(nextState, provinceId, provinceTargets, figuresBeforeDeath);
    }
    if (killed > 0) {
      gainVictoryPoints(nextState, playerId, killed * 3, 'Way of the Keiri');
      nextState.log.push(`${player.name} ejecuta ${killed} figura(s) y gana ${killed * 3} PV (Way of the Keiri). Total ${player.victoryPoints} PV`);
    } else {
      nextState.log.push(`${player.name} no ejecuta figuras (Way of the Keiri)`);
    }
    if (playerHasCard(player, 'su-justice')) {
      for (const victimId of justiceVictims) {
        gainVictoryPoints(nextState, playerId, 3, 'Justicia');
        const victim = nextState.players.find(candidate => candidate.id === victimId);
        nextState.log.push(`${player.name} gana 3 PV por matar figuras de ${victim?.name || 'un jugador'} con menor Honor (Justicia)`);
      }
    }
  } else if (action.type === 'sunakake' && player) {
    const targetId = selection?.targetFigureIds?.[0];
    let target: Figure | undefined;
    let targetProvinceId: string | undefined;
    for (const [provinceId, province] of Object.entries(nextState.provinces)) {
      const candidate = province.figures.find(figure => figure.id === targetId);
      if (candidate) {
        target = candidate;
        targetProvinceId = provinceId;
        break;
      }
    }
    const targetProvince = targetProvinceId ? nextState.provinces[targetProvinceId] : null;
    const hasSunakake = targetProvince?.figures.some(figure => figure.owner === playerId && figure.monsterCardId === 'su-sunakake-baba');
    if (!target || !targetProvince || !hasSunakake || target.owner === playerId || (target.type !== 'bushi' && target.type !== 'shinto')) return state;
    const victim = nextState.players.find(candidate => candidate.id === target!.owner);
    if (!victim) return state;
    targetProvince.figures = targetProvince.figures.filter(figure => figure.id !== target!.id);
    player.hostages = [...player.hostages, { fromClanId: victim.id, figureType: target.type, figureName: target.type }];
    const stolenVP = Math.min(1, victim.victoryPoints);
    victim.victoryPoints -= stolenVP;
    if (stolenVP > 0) gainVictoryPoints(nextState, playerId, stolenVP, 'Sunakake-Baba');
    nextState.log.push(`${player.name} toma como rehen un ${target.type} de ${victim.name} en ${targetProvince.name} y roba ${stolenVP} PV (Sunakake-Baba). Total ${player.name}: ${player.victoryPoints} PV; ${victim.name}: ${victim.victoryPoints} PV`);
  } else if (action.type !== 'keiri' && action.type !== 'zorro') {
    return state;
  }
  if (action.type === 'ashigaru') {
    return advanceWarStartAction(grantWarlordSummonCoin(nextState, playerId));
  }
  if (action.type === 'naginata' && selection?.sourceProvinceId && selection.destinationProvinceId) {
    const withCrossing: GameState = {
      ...nextState,
      pendingSerpentCrossings: nextState.provinces[selection.sourceProvinceId]?.seaRoutes.includes(selection.destinationProvinceId)
        ? [...(nextState.pendingSerpentCrossings || []), { moverId: playerId, fromProvinceId: selection.sourceProvinceId, toProvinceId: selection.destinationProvinceId }]
        : [...(nextState.pendingSerpentCrossings || [])],
    };
    const resolved = resolvePendingSerpentCrossings(withCrossing, 'advance-war-start');
    if (resolved.pendingSerpentCharge || (resolved.pendingRuleNotices?.length || 0) > (nextState.pendingRuleNotices?.length || 0)) return resolved;
    return advanceWarStartAction(resolved);
  }
  return advanceWarStartAction(nextState);
}

export function skipWarStartAction(state: GameState, playerId: string): GameState {
  const action = getCurrentWarStartAction(state);
  if (!action || action.playerId !== playerId) return state;
  const player = state.players.find(candidate => candidate.id === playerId);
  const label = action.type === 'naginata' ? 'Way of Naginata' : action.type === 'ashigaru' ? 'Way of the Ashigaru' : action.type === 'keiri' ? 'Way of the Keiri' : action.type === 'sunakake' ? 'Sunakake-Baba' : 'Zorro';
  return advanceWarStartAction({ ...state, log: [...state.log, `${player?.name || 'Jugador'} omite ${label}`] });
}

export function prepareNureOnnaDecision(state: GameState): GameState {
  if (state.pendingNureOnnaDecision || state.currentPhase !== 'war') return state;
  const battle = state.activeBattles.find(item => !item.resolved && !item.uncontested);
  if (!battle) return state;
  const pending = findPendingNureOnnaForBattle(state, battle);
  return pending ? { ...state, pendingNureOnnaDecision: pending } : state;
}

export function resolveNureOnnaDecision(state: GameState, playerId: string, move: boolean): GameState {
  const pending = state.pendingNureOnnaDecision;
  if (!pending || pending.ownerId !== playerId) return state;

  const checked = { ...(state.nureOnnaCheckedBattles || {}) };
  checked[pending.battleProvinceId] = [...(checked[pending.battleProvinceId] || []), pending.figureId];
  let nextState: GameState = { ...state, pendingNureOnnaDecision: null, nureOnnaCheckedBattles: checked };

  if (move) {
    const source = nextState.provinces[pending.fromProvinceId];
    const destination = nextState.provinces[pending.battleProvinceId];
    const figure = source?.figures.find(item => item.id === pending.figureId && item.owner === playerId);
    if (source && destination && figure && source.seaRoutes.includes(pending.battleProvinceId) && !isFigureTrappedBySusanoo(nextState, pending.fromProvinceId, figure)) {
      nextState = {
        ...nextState,
        provinces: {
          ...nextState.provinces,
          [pending.fromProvinceId]: { ...source, figures: source.figures.filter(item => item.id !== figure.id) },
          [pending.battleProvinceId]: { ...destination, figures: [...destination.figures, figure] },
        },
        activeBattles: nextState.activeBattles.map(battle => battle.provinceId === pending.battleProvinceId
          ? { ...battle, participants: [...new Set([...battle.participants, playerId])].sort((a, b) => nextState.honorTrack.indexOf(a) - nextState.honorTrack.indexOf(b)) }
          : battle),
        log: [...nextState.log, `Nure-Onna de ${nextState.players.find(player => player.id === playerId)?.name || 'jugador'} cruza ruta maritima de ${source.name} a ${destination.name} para unirse a la batalla`],
      };
    }
  } else {
    const owner = nextState.players.find(player => player.id === playerId);
    const destination = nextState.provinces[pending.battleProvinceId];
    nextState = {
      ...nextState,
      log: [...nextState.log, `${owner?.name || 'Jugador'} decide no mover a Nure-Onna a la batalla de ${destination?.name || pending.battleProvinceId}`],
    };
  }

  nextState = prepareNureOnnaDecision(nextState);
  return nextState.pendingNureOnnaDecision ? nextState : resolveUncontestedBattles(nextState);
}

export function resolveUncontestedBattles(state: GameState): GameState {
  const newState: GameState = {
    ...state,
    players: state.players.map(p => ({ ...p, warProvinceTokens: [...p.warProvinceTokens] })),
    activeBattles: [...state.activeBattles],
    log: [...state.log],
  };

  const sortedSlots = [...newState.warProvinceSlots].sort((a, b) => a.number - b.number);

  const currentBattleIndex = newState.activeBattles.findIndex(battle => !battle.resolved && !battle.uncontested);
  newState.activeBattles = newState.activeBattles.map((battle, battleIndex) => {
    if (battleIndex !== currentBattleIndex) return battle;
    // Skip already resolved/uncontested battles (e.g., empty provinces already handled)
    if (battle.uncontested) return battle;
    if (battle.winner) return battle;
    // Do not classify or award this battle until every reachable Nure-Onna has decided.
    if (findPendingNureOnnaForBattle(newState, battle)) return battle;

    const slot = sortedSlots.find(s => s.provinceId === battle.provinceId);
    if (!slot) return battle;

    const province = newState.provinces[battle.provinceId];
    if (!province) return battle;

    if (getKamiInProvince(newState, province.id, 'tsukuyomi') && !battle.tsukuyomiEffectApplied) {
      const recipients = newState.players.filter(player => calculateForce(province, player.id, newState) > 0);
      for (const recipient of recipients) gainCoinsFromSupply(newState, recipient.id, 4, 'Tsukuyomi');
      if (recipients.length > 0) {
        newState.log.push(`${recipients.map(player => player.name).join(', ')} ${recipients.length === 1 ? 'gana' : 'ganan'} 4 monedas antes de resolver ${province.name} (Tsukuyomi)`);
      }
      battle = { ...battle, tsukuyomiEffectApplied: true };
    }

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
        applyWarTokenCardRewards(newState, winner.id, province.id);
        applyKitsuneWarTokenBonus(newState, winner.id, province.id);
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
        applyWarTokenCardRewards(newState, winner.id, province.id);
        applyKitsuneWarTokenBonus(newState, winner.id, province.id);
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
    players: state.players.map(player => ({ ...player, coins: Math.max(0, player.coins) })),
    activeBattles: state.activeBattles.map((b) => ({ ...b, warTacticBids: { ...b.warTacticBids } })),
  };

  const battle = newState.activeBattles.find((b) => b.provinceId === provinceId);
  if (!battle || battle.resolved || !battle.participants.includes(playerId)) return state;
  if (battle.warTacticBids[playerId] !== undefined) return state;

  // Validate bids against player coin balance
  const player = newState.players.find((p) => p.id === playerId);
  if (!player) return state;
  const validTacticIds = new Set(WAR_TACTICS.map(tactic => tactic.id));
  const bidEntries = Object.entries(tacticBids);
  if (bidEntries.some(([tacticId, amount]) =>
    !validTacticIds.has(tacticId) || !Number.isInteger(amount) || amount < 0
  )) return state;
  const totalBid = bidEntries.reduce((sum, [, amount]) => sum + amount, 0);
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

/**
 * Fire Dragon's Incineration pre-battle effect.
 * When a battle begins in a province containing the Fire Dragon, each player with figures there
 * must kill one of their own figures (weakest first: bushi > shinto > non-immune monsters).
 * Immune figures: Daimyo type, daimyo-type monsters (Yurei, Fukurokuju), and the Fire Dragon itself.
 * If a player has only immune figures, they lose nothing.
 * Returns the updated state with killed figures returned to reserves and log entries added.
 */
export function applyFireDragonEffect(
  state: GameState,
  provinceId: string,
  selectedByPlayer?: Record<string, string>,
  spareOpponents = false,
): GameState {
  const province = state.provinces[provinceId];
  if (!province) return state;

  // Check if Fire Dragon is present in this province
  const fireDragonFigure = province.figures.find(f => f.type === 'monster' && f.monsterCardId === 'su-fire-dragon');
  if (!fireDragonFigure) return state;

  // Deep copy relevant parts of state
  const newState: GameState = {
    ...state,
    players: state.players.map(p => ({ ...p })),
    provinces: { ...state.provinces },
    log: [...state.log],
  };

  // Get all unique players with figures in this province
  const playersInProvince = [...new Set(province.figures.map(f => f.owner))];

  // Daimyo-immune monster card IDs
  const DAIMYO_IMMUNE_MONSTERS = ['su-yurei', 'sp-fukurokuju'];
  const killedOwnerIds = new Set<string>();
  const figuresBeforeFire = [...province.figures];
  const killedFigures: Figure[] = [];

  for (const playerId of playersInProvince) {
    if (spareOpponents && playerId !== fireDragonFigure.owner) continue;
    const currentProv = newState.provinces[provinceId];
    const playerFigures = currentProv.figures.filter(f => f.owner === playerId);

    // Find a killable figure (not daimyo, not daimyo-type monsters, not Fire Dragon itself)
    // Priority: bushi first, then shinto, then non-immune monsters
    const isImmune = (f: Figure): boolean => {
      if (f.type === 'kami') return true;
      if (f.type === 'daimyo') return true;
      if (f.type === 'monster' && f.monsterCardId === 'su-fire-dragon') return true;
      if (f.type === 'monster' && f.monsterCardId && DAIMYO_IMMUNE_MONSTERS.includes(f.monsterCardId)) return true;
      return false;
    };

    // Find weakest killable figure
    let targetFigure: Figure | undefined;
    if (selectedByPlayer) {
      targetFigure = playerFigures.find(f => f.id === selectedByPlayer[playerId] && !isImmune(f));
    } else {
      targetFigure = playerFigures.find(f => f.type === 'bushi');
      if (!targetFigure) targetFigure = playerFigures.find(f => f.type === 'shinto');
      if (!targetFigure) targetFigure = playerFigures.find(f => f.type === 'monster' && !isImmune(f));
    }

    if (!targetFigure) continue; // Player has only immune figures

    // Kill the figure: remove from province, return to reserve
    newState.provinces[provinceId] = {
      ...currentProv,
      figures: currentProv.figures.filter(f => f.id !== targetFigure!.id),
    };
    killedFigures.push(targetFigure);

    const player = newState.players.find(p => p.id === playerId)!;
    let figureTypeName: string;
    if (targetFigure.type === 'bushi') {
      player.bushi += 1;
      figureTypeName = 'bushi';
    } else if (targetFigure.type === 'shinto') {
      player.shinto += 1;
      figureTypeName = 'shinto';
    } else {
      // Monster
      player.monsters += 1;
      figureTypeName = SEASON_CARDS_DATA.find(c => c.id === targetFigure!.monsterCardId)?.name || 'monster';
    }

    newState.log = [...newState.log, `🐉 Dragón de Fuego incinera: ${player.name} pierde 1 ${figureTypeName}`];

    // Virtue: Righteousness (sp-righteousness) - own figure killed by Fire Dragon
    applyRighteousnessVP(newState, playerId, 1);

    // Handle Ebisu death trigger
    if (targetFigure.type === 'monster' && targetFigure.monsterCardId === 'au-ebisu') {
      applyEbisuDeathEffect(newState, playerId);
    }

    killedOwnerIds.add(playerId);

    // Handle Phoenix resurrection: if Phoenix was killed, gain 1 VP and place it back
    if (targetFigure.type === 'monster' && targetFigure.monsterCardId === 'sp-phoenix') {
      gainVictoryPoints(newState, playerId, 1, 'Phoenix');
      const figureId = Math.random().toString(36).substring(2, 10);
      const phoenixFigure: Figure = { type: 'monster', owner: playerId, id: figureId, monsterCardId: 'sp-phoenix' };
      newState.provinces[provinceId] = {
        ...newState.provinces[provinceId],
        figures: [...newState.provinces[provinceId].figures, phoenixFigure],
      };
      player.monsters -= 1;
      newState.log = [...newState.log, `🔥 Phoenix renace en ${province.name} - ${player.name} gana 1 PV`];
    }
  }

  applyProvinceDeathCardEffects(newState, provinceId, killedFigures, figuresBeforeFire);

  const fireOwner = newState.players.find(player => player.id === fireDragonFigure.owner);
  if (spareOpponents && fireOwner) {
    gainVictoryPoints(newState, fireOwner.id, 2, 'Misericordia');
    newState.log.push(`${fireOwner.name} perdona las figuras rivales afectadas por Fire Dragon y gana 2 PV (Misericordia)`);
  }
  if (fireOwner && playerHasCard(fireOwner, 'su-justice')) {
    const fireOwnerHonor = newState.honorTrack.indexOf(fireOwner.id);
    const qualifyingVictims = [...killedOwnerIds].filter(victimId => victimId !== fireOwner.id && newState.honorTrack.indexOf(victimId) > fireOwnerHonor);
    for (const victimId of qualifyingVictims) {
      gainVictoryPoints(newState, fireOwner.id, 3, 'Justicia');
      const victim = newState.players.find(player => player.id === victimId);
      newState.log.push(`${fireOwner.name} gana 3 PV por matar figuras de ${victim?.name || 'un jugador'} con menor Honor (Justicia)`);
    }
  }

  return newState;
}

function applyWarTokenCardRewards(state: GameState, winnerId: string, provinceId: string): void {
  const winner = state.players.find(player => player.id === winnerId);
  const province = state.provinces[provinceId];
  if (!winner || !province) return;

  const courageCopies = countCardCopies(winner, 'sp-courage');
  for (let copy = 0; copy < courageCopies; copy += 1) {
    gainVictoryPoints(state, winnerId, 2, 'Coraje');
    state.log.push(`${winner.name} gana 2 PV por obtener una ficha de Provincia en Guerra (Coraje${copy > 0 ? `, copia ${copy + 1}` : ''})`);
  }

  if (getKamiInProvince(state, provinceId, 'fujin')) {
    const rewards = province.harvestRewards;
    if (rewards.vp) gainVictoryPoints(state, winnerId, rewards.vp, 'Fujin');
    if (rewards.coins) gainCoinsFromSupply(state, winnerId, rewards.coins, 'Fujin');
    if (rewards.ronin) winner.ronin += rewards.ronin;
    if (rewards.honor) {
      for (let step = 0; step < rewards.honor; step += 1) gainHonor(state, winnerId);
    }
    const parts = [
      rewards.vp ? `${rewards.vp} PV` : '',
      rewards.coins ? `${rewards.coins} monedas` : '',
      rewards.ronin ? `${rewards.ronin} ronin` : '',
      rewards.honor ? `${rewards.honor} Honor` : '',
    ].filter(Boolean);
    state.log.push(`${winner.name} obtiene la recompensa de Cosecha de ${province.name}: ${parts.join(', ')} (Fujin)`);
  }

  const hasShinto = province.figures.some(figure => figure.owner === winnerId && (
    figure.type === 'shinto' || (figure.type === 'monster' && ['sp-komainu', 'su-hotei'].includes(figure.monsterCardId || ''))
  ));
  if (!hasShinto) return;
  const pietyCopies = countCardCopies(winner, 'sp-piety');
  for (let copy = 0; copy < pietyCopies; copy += 1) {
    gainHonor(state, winnerId);
    gainVictoryPoints(state, winnerId, 3, 'Piedad');
    state.log.push(`${winner.name} gana Honor y 3 PV por obtener la ficha de ${province.name} con un Shinto (Piedad${copy > 0 ? `, copia ${copy + 1}` : ''})`);
  }
}

function applyKitsuneWarTokenBonus(state: GameState, winnerId: string, provinceId: string): void {
  const winner = state.players.find(player => player.id === winnerId);
  const province = state.provinces[provinceId];
  if (!winner || !province) return;
  const kitsuneAlive = province.figures.some(figure => figure.type === 'monster' && figure.monsterCardId === 'au-kitsune');
  if (!kitsuneAlive) return;
  gainVictoryPoints(state, winnerId, 6, 'Kitsune');
  state.log.push(`${winner.name} gana 6 PV porque Kitsune sigue presente al obtener la ficha de ${province.name} (Kitsune)`);
}

/**
 * Earth Dragon pre-battle effect.
 * At start of battle, for each OTHER player with figures in the province, move 1 figure out
 * to an adjacent province. Priority: bushi > shinto > non-immune monster. Skip daimyo/daimyo-type monsters.
 * Earth Dragon MOVES figures, it does NOT kill them (no Phoenix trigger).
 */
export function applyEarthDragonEffect(
  state: GameState,
  provinceId: string,
  selectedByPlayer?: Record<string, string>,
  destinationsByFigure?: Record<string, string>,
): GameState {
  const province = state.provinces[provinceId];
  if (!province) return state;

  const earthDragonFigure = province.figures.find(f => f.type === 'monster' && f.monsterCardId === 'sp-earth-dragon');
  if (!earthDragonFigure) return state;

  const earthDragonOwner = earthDragonFigure.owner;

  const newState: GameState = {
    ...state,
    players: state.players.map(p => ({ ...p })),
    provinces: { ...state.provinces },
    log: [...state.log],
  };

  const DAIMYO_IMMUNE_MONSTERS = ['su-yurei', 'sp-fukurokuju'];

  const playersInProvince = [...new Set(province.figures.map(f => f.owner))].filter(pid => pid !== earthDragonOwner);

  for (const playerId of playersInProvince) {
    const currentProv = newState.provinces[provinceId];
    const playerFigures = currentProv.figures.filter(f => f.owner === playerId);

    const isImmune = (f: Figure): boolean => {
      if (f.type === 'daimyo') return true;
      if (f.type === 'fortress') return true;
      if (f.type === 'kami') return true;
      if (isFigureTrappedBySusanoo(newState, provinceId, f)) return true;
      if (f.type === 'monster' && f.monsterCardId && DAIMYO_IMMUNE_MONSTERS.includes(f.monsterCardId)) return true;
      return false;
    };

    let targetFigure: Figure | undefined;
    if (selectedByPlayer) {
      targetFigure = playerFigures.find(f => f.id === selectedByPlayer[playerId] && !isImmune(f));
    } else {
      targetFigure = playerFigures.find(f => f.type === 'bushi');
      if (!targetFigure) targetFigure = playerFigures.find(f => f.type === 'shinto');
      if (!targetFigure) targetFigure = playerFigures.find(f => f.type === 'monster' && !isImmune(f));
    }

    if (!targetFigure) continue;

    // Find first valid adjacent province
    const provData = PROVINCES_DATA.find(p => p.id === provinceId);
    if (!provData) continue;
    const adjacentIds = [...provData.adjacentProvinces, ...provData.seaRoutes];
    const requestedDestination = destinationsByFigure?.[targetFigure.id];
    const destProvinceId = requestedDestination && adjacentIds.includes(requestedDestination) && newState.provinces[requestedDestination]
      ? requestedDestination
      : selectedByPlayer ? undefined : adjacentIds.find(id => newState.provinces[id]);
    if (!destProvinceId) continue;

    // Move the figure
    newState.provinces[provinceId] = {
      ...newState.provinces[provinceId],
      figures: newState.provinces[provinceId].figures.filter(f => f.id !== targetFigure!.id),
    };
    newState.provinces[destProvinceId] = {
      ...newState.provinces[destProvinceId],
      figures: [...newState.provinces[destProvinceId].figures, targetFigure],
    };

    const player = newState.players.find(p => p.id === playerId);
    const destProv = newState.provinces[destProvinceId];
    const figureTypeName = targetFigure.type === 'monster' && targetFigure.monsterCardId
      ? (SEASON_CARDS_DATA.find(c => c.id === targetFigure!.monsterCardId)?.name || 'monster')
      : targetFigure.type;
    newState.log = [...newState.log, `🐲 Dragon de Tierra mueve ${figureTypeName} de ${player?.name || 'jugador'} a ${destProv?.name || destProvinceId}`];
  }

  return newState;
}

/**
 * Jorogumo pre-battle effect.
 * At start of battle, take control of 1 enemy Bushi or Shinto in the province.
 * Returns the modified state and the capture info for later reversion.
 */
export function applyJorogumoEffect(state: GameState, provinceId: string, selectedFigureId?: string): { state: GameState; captured: { figureId: string; originalOwner: string } | null } {
  const province = state.provinces[provinceId];
  if (!province) return { state, captured: null };

  const jorogumoFigure = province.figures.find(f => f.type === 'monster' && f.monsterCardId === 'sp-jorogumo');
  if (!jorogumoFigure) return { state, captured: null };

  const jorogumoOwner = jorogumoFigure.owner;

  // Find an enemy Bushi or Shinto to take control of
  const targetFigure = province.figures.find(
    f => (!selectedFigureId || f.id === selectedFigureId) && f.owner !== jorogumoOwner && (f.type === 'bushi' || f.type === 'shinto')
  );
  if (!targetFigure) return { state, captured: null };

  const newState: GameState = {
    ...state,
    provinces: { ...state.provinces },
    log: [...state.log],
  };

  const originalOwner = targetFigure.owner;

  // Change the figure's owner temporarily
  newState.provinces[provinceId] = {
    ...newState.provinces[provinceId],
    figures: newState.provinces[provinceId].figures.map(f =>
      f.id === targetFigure.id ? { ...f, owner: jorogumoOwner } : f
    ),
  };

  const jorogumoOwnerPlayer = state.players.find(p => p.id === jorogumoOwner);
  const victimPlayer = state.players.find(p => p.id === originalOwner);
  newState.log = [...newState.log, `🕷️ Jorogumo de ${jorogumoOwnerPlayer?.name || 'jugador'} toma control de ${targetFigure.type} de ${victimPlayer?.name || 'jugador'}`];

  return { state: newState, captured: { figureId: targetFigure.id, originalOwner } };
}

/**
 * Revert Jorogumo effect: change captured figure back to original owner.
 */
export function revertJorogumoEffect(state: GameState, provinceId: string, captured: { figureId: string; originalOwner: string }): GameState {
  const province = state.provinces[provinceId];
  if (!province) return state;

  const newState: GameState = {
    ...state,
    provinces: { ...state.provinces },
  };

  newState.provinces[provinceId] = {
    ...newState.provinces[provinceId],
    figures: newState.provinces[provinceId].figures.map(f =>
      f.id === captured.figureId ? { ...f, owner: captured.originalOwner } : f
    ),
  };

  return newState;
}

export function selectDaikaijuProvince(state: GameState, playerId: string, provinceId: string): GameState {
  if (!state.daikaijuPlacementActive || state.daikaijuPlacementPlayerId !== playerId) return state;
  if (state.daikaijuPlacementProvinceId || provinceId === 'ocean') return state;
  const ocean = state.provinces.ocean;
  const target = state.provinces[provinceId];
  if (!ocean || !target) return state;
  const figure = ocean.figures.find(item => item.type === 'monster' && item.monsterCardId === 'au-daikaiju' && item.owner === playerId);
  if (!figure) return state;

  return {
    ...state,
    provinces: {
      ...state.provinces,
      ocean: { ...ocean, figures: ocean.figures.filter(item => item.id !== figure.id) },
      [provinceId]: { ...target, figures: [...target.figures, figure] },
    },
    daikaijuPlacementProvinceId: provinceId,
  };
}

export function undoDaikaijuProvinceSelection(state: GameState, playerId: string): GameState {
  const provinceId = state.daikaijuPlacementProvinceId;
  if (!state.daikaijuPlacementActive || state.daikaijuPlacementPlayerId !== playerId || !provinceId) return state;
  const province = state.provinces[provinceId];
  const ocean = state.provinces.ocean;
  if (!province || !ocean) return state;
  const figure = province.figures.find(item => item.type === 'monster' && item.monsterCardId === 'au-daikaiju' && item.owner === playerId);
  if (!figure) return state;

  return {
    ...state,
    provinces: {
      ...state.provinces,
      [provinceId]: { ...province, figures: province.figures.filter(item => item.id !== figure.id) },
      ocean: { ...ocean, figures: [...ocean.figures, figure] },
    },
    daikaijuPlacementProvinceId: null,
  };
}

export function confirmDaikaijuPlacement(state: GameState, playerId: string): GameState {
  const provinceId = state.daikaijuPlacementProvinceId;
  if (!state.daikaijuPlacementActive || state.daikaijuPlacementPlayerId !== playerId || !provinceId) return state;
  const province = state.provinces[provinceId];
  if (!province?.figures.some(item => item.type === 'monster' && item.monsterCardId === 'au-daikaiju' && item.owner === playerId)) return state;

  const fortresses = province.figures.filter(item => item.type === 'fortress');
  const destroyedByPlayer: Record<string, number> = {};
  for (const fortress of fortresses) {
    destroyedByPlayer[fortress.owner] = (destroyedByPlayer[fortress.owner] || 0) + 1;
  }
  const players = state.players.map(player => ({
    ...player,
    fortresses: player.fortresses + (destroyedByPlayer[player.id] || 0),
  }));
  const destroyedFortresses = Object.entries(destroyedByPlayer).map(([ownerId, count]) => ({
    playerId: ownerId,
    playerName: players.find(player => player.id === ownerId)?.name || 'jugador',
    count,
  }));
  const owner = players.find(player => player.id === playerId);

  return {
    ...state,
    players,
    provinces: {
      ...state.provinces,
      [provinceId]: { ...province, figures: province.figures.filter(item => item.type !== 'fortress') },
    },
    daikaijuPlacementActive: false,
    daikaijuPlacementPlayerId: null,
    daikaijuPlacementProvinceId: null,
    daikaijuSummaryVisible: true,
    daikaijuSummaryReadyPlayers: [],
    daikaijuSummaryData: { provinceId, provinceName: province.name, destroyedFortresses },
    log: [...state.log, `Daikaiju de ${owner?.name || 'jugador'} aparece en ${province.name} y destruye ${fortresses.length} fortaleza(s)`],
  };
}

/** Apply and persist Jorogumo's temporary control before War Tactics remove possible targets. */
export function prepareJorogumoEffect(state: GameState, provinceId: string): GameState {
  const battleIndex = state.activeBattles.findIndex(b => b.provinceId === provinceId && !b.resolved);
  if (battleIndex < 0 || state.activeBattles[battleIndex].jorogumoEffectApplied) return state;

  const result = applyJorogumoEffect(state, provinceId);
  const activeBattles = result.state.activeBattles.map((battle, index) => index === battleIndex
    ? { ...battle, jorogumoEffectApplied: true, jorogumoCaptured: result.captured }
    : battle);
  return { ...result.state, activeBattles };
}

const DAIMYO_CARD_EFFECT_IMMUNE_MONSTERS = ['su-yurei', 'sp-fukurokuju'];

function isCardEffectImmuneDaimyo(figure: Figure): boolean {
  return figure.type === 'daimyo'
    || (figure.type === 'monster' && DAIMYO_CARD_EFFECT_IMMUNE_MONSTERS.includes(figure.monsterCardId || ''));
}

function battleDecisionCandidates(state: GameState, type: 'earth-dragon' | 'fire-dragon' | 'jorogumo', ownerId: string, provinceId: string): Record<string, Figure[]> {
  const province = state.provinces[provinceId];
  if (!province) return {};
  const grouped: Record<string, Figure[]> = {};
  for (const figure of province.figures) {
    if (isCardEffectImmuneDaimyo(figure)) continue;
    if (type === 'earth-dragon') {
      if (figure.owner === ownerId || figure.type === 'fortress') continue;
    } else if (type === 'fire-dragon') {
      if (figure.type === 'fortress' || (figure.type === 'monster' && figure.monsterCardId === 'su-fire-dragon')) continue;
    } else if (figure.owner === ownerId || (figure.type !== 'bushi' && figure.type !== 'shinto')) {
      continue;
    }
    grouped[figure.owner] = [...(grouped[figure.owner] || []), figure];
  }
  return grouped;
}

function markBattleDecisionApplied(state: GameState, provinceId: string, type: 'earth-dragon' | 'fire-dragon' | 'jorogumo', captured?: { figureId: string; originalOwner: string } | null): GameState {
  return {
    ...state,
    pendingBattleCardDecision: null,
    activeBattles: state.activeBattles.map(battle => battle.provinceId !== provinceId || battle.resolved ? battle : {
      ...battle,
      ...(type === 'earth-dragon' ? { earthDragonEffectApplied: true } : {}),
      ...(type === 'fire-dragon' ? { fireDragonEffectApplied: true } : {}),
      ...(type === 'jorogumo' ? { jorogumoEffectApplied: true, jorogumoCaptured: captured || null } : {}),
    }),
  };
}

export function prepareBattleCardDecision(state: GameState, provinceId: string): GameState {
  if (state.pendingBattleCardDecision) return state;
  const province = state.provinces[provinceId];
  const battle = state.activeBattles.find(candidate => candidate.provinceId === provinceId && !candidate.resolved);
  if (!province || !battle) return state;

  const effectOrder: Array<{ type: 'earth-dragon' | 'fire-dragon' | 'jorogumo'; cardId: string; applied: boolean }> = [
    { type: 'fire-dragon', cardId: 'su-fire-dragon', applied: !!battle.fireDragonEffectApplied },
    { type: 'jorogumo', cardId: 'sp-jorogumo', applied: !!battle.jorogumoEffectApplied },
  ];
  const pendingEffects = effectOrder
    .filter(effect => !effect.applied)
    .map(effect => ({ ...effect, figure: province.figures.find(figure => figure.type === 'monster' && figure.monsterCardId === effect.cardId) }))
    .filter((effect): effect is typeof effect & { figure: Figure } => !!effect.figure)
    .sort((left, right) => state.honorTrack.indexOf(left.figure.owner) - state.honorTrack.indexOf(right.figure.owner));

  const nextEffect = pendingEffects[0];
  if (!nextEffect) return state;
  const candidates = battleDecisionCandidates(state, nextEffect.type, nextEffect.figure.owner, provinceId);
  if (Object.keys(candidates).length === 0) {
    return prepareBattleCardDecision(markBattleDecisionApplied(state, provinceId, nextEffect.type), provinceId);
  }
  return {
    ...state,
    pendingBattleCardDecision: {
      type: nextEffect.type,
      ownerId: nextEffect.figure.owner,
      provinceId,
      sourceFigureId: nextEffect.figure.id,
      stage: 'post-bids',
    },
  };
}

export function preparePreBattleCardDecision(state: GameState, provinceId: string): GameState {
  if (state.pendingBattleCardDecision) return state;
  const province = state.provinces[provinceId];
  const battle = state.activeBattles.find(candidate => candidate.provinceId === provinceId && !candidate.resolved);
  if (!province || !battle) return state;

  const effectOrder: Array<{ type: 'earth-dragon' | 'fire-dragon' | 'jorogumo'; cardId: string; applied: boolean }> = [
    { type: 'earth-dragon', cardId: 'sp-earth-dragon', applied: !!battle.earthDragonEffectApplied },
    { type: 'fire-dragon', cardId: 'su-fire-dragon', applied: !!battle.fireDragonEffectApplied },
    { type: 'jorogumo', cardId: 'sp-jorogumo', applied: !!battle.jorogumoEffectApplied },
  ];
  const pendingEffects = effectOrder
    .filter(effect => !effect.applied)
    .map(effect => ({ ...effect, figure: province.figures.find(figure => figure.type === 'monster' && figure.monsterCardId === effect.cardId) }))
    .filter((effect): effect is typeof effect & { figure: Figure } => !!effect.figure)
    .sort((left, right) => state.honorTrack.indexOf(left.figure.owner) - state.honorTrack.indexOf(right.figure.owner));

  const nextEffect = pendingEffects[0];
  if (!nextEffect) {
    let completedState = state;
    for (const effect of effectOrder.filter(effect => !effect.applied)) {
      completedState = markBattleDecisionApplied(completedState, provinceId, effect.type);
    }
    return completedState;
  }
  const candidates = battleDecisionCandidates(state, nextEffect.type, nextEffect.figure.owner, provinceId);
  if (Object.keys(candidates).length === 0) {
    return preparePreBattleCardDecision(markBattleDecisionApplied(state, provinceId, nextEffect.type), provinceId);
  }

  return {
    ...state,
    pendingBattleCardDecision: {
      type: nextEffect.type,
      ownerId: nextEffect.figure.owner,
      provinceId,
      sourceFigureId: nextEffect.figure.id,
      stage: 'pre-battle',
    },
  };
}

export function resolveBattleCardDecision(
  state: GameState,
  playerId: string,
  useEffect: boolean,
  selectedByPlayer: Record<string, string>,
  destinationsByFigure: Record<string, string> = {},
  useMercy = false,
): GameState {
  const pending = state.pendingBattleCardDecision;
  if (!pending || pending.ownerId !== playerId) return state;
  const candidates = battleDecisionCandidates(state, pending.type, playerId, pending.provinceId);
  if (!useEffect && pending.type !== 'earth-dragon') return state;

  let resolvedState = state;
  let captured: { figureId: string; originalOwner: string } | null = null;
  if (useEffect) {
    if (pending.type === 'jorogumo') {
      const targetId = Object.values(selectedByPlayer)[0];
      if (!Object.values(candidates).flat().some(figure => figure.id === targetId)) return state;
    } else {
      const requiredCandidates = pending.type === 'fire-dragon' && useMercy
        ? Object.fromEntries(Object.entries(candidates).filter(([ownerId]) => ownerId === playerId))
        : candidates;
      for (const [ownerId, ownerCandidates] of Object.entries(requiredCandidates)) {
        const selectedId = selectedByPlayer[ownerId];
        if (!ownerCandidates.some(figure => figure.id === selectedId)) return state;
        if (pending.type !== 'earth-dragon') continue;
        const destinationId = destinationsByFigure[selectedId];
        const provinceData = PROVINCES_DATA.find(province => province.id === pending.provinceId);
        if (!destinationId || !provinceData || ![...provinceData.adjacentProvinces, ...provinceData.seaRoutes].includes(destinationId)) return state;
        const destination = state.provinces[destinationId];
        const targetOwner = state.players.find(player => player.id === ownerId);
        if (!destination || !targetOwner) return state;
        const plague = destination.figures.find(figure => figure.type === 'monster' && figure.monsterCardId === 'au-oni-of-plagues' && figure.owner !== ownerId);
        if (plague && state.honorTrack.indexOf(ownerId) < state.honorTrack.indexOf(plague.owner)) return state;
        if (targetOwner.clanId === 'luna' && destination.figures.filter(figure => figure.owner === ownerId && figure.type !== 'fortress').length >= 2) return state;
      }
    }
    if (pending.type === 'earth-dragon') {
      resolvedState = applyEarthDragonEffect(state, pending.provinceId, selectedByPlayer, destinationsByFigure);
    } else if (pending.type === 'fire-dragon') {
      const owner = state.players.find(player => player.id === playerId);
      if (useMercy && !owner?.seasonCards.some(card => card.id === 'su-mercy' || card.id === 'su-mercy-2')) return state;
      resolvedState = applyFireDragonEffect(state, pending.provinceId, selectedByPlayer, useMercy);
    } else {
      const targetId = Object.values(selectedByPlayer)[0];
      const result = applyJorogumoEffect(state, pending.provinceId, targetId);
      resolvedState = result.state;
      captured = result.captured;
    }
  } else {
    const owner = state.players.find(player => player.id === playerId);
    resolvedState = { ...state, log: [...state.log, `${owner?.name || 'Jugador'} decide no usar Earth Dragon en ${state.provinces[pending.provinceId]?.name || pending.provinceId}`] };
  }
  const completedState = markBattleDecisionApplied(resolvedState, pending.provinceId, pending.type, captured);
  if (pending.stage === 'pre-battle') {
    const nextState = preparePreBattleCardDecision(completedState, pending.provinceId);
    return nextState.pendingBattleCardDecision ? nextState : resolveUncontestedBattles(nextState);
  }
  return prepareBattleCardDecision(completedState, pending.provinceId);
}

/**
 * Jikininki passive effect.
 * Each time another figure is killed in the same province as Jikininki,
 * the Jikininki owner gains 1 VP and loses honor per kill.
 */
export function applyProvinceDeathCardEffects(
  state: GameState,
  provinceId: string,
  killedFigures: Figure[],
  figuresBeforeDeath: Figure[],
): void {
  if (killedFigures.length === 0) return;

  const jikininkiFigures = figuresBeforeDeath.filter(figure => figure.type === 'monster' && figure.monsterCardId === 'su-jikininki');
  for (const jikininki of jikininkiFigures) {
    const eligibleKills = killedFigures.filter(figure => figure.id !== jikininki.id).length;
    const owner = state.players.find(player => player.id === jikininki.owner);
    if (!owner || eligibleKills <= 0) continue;
    const honorRankBefore = state.honorTrack.indexOf(owner.id);
    for (let index = 0; index < eligibleKills; index += 1) {
      gainVictoryPoints(state, owner.id, 1, 'Jikininki');
      loseHonor(state, owner.id);
    }
    const honorLost = Math.max(0, state.honorTrack.indexOf(owner.id) - honorRankBefore);
    state.log.push(`Jikininki: ${owner.name} gana ${eligibleKills} PV y pierde ${honorLost} Honor por figuras eliminadas en ${state.provinces[provinceId]?.name || provinceId}`);
    state.pendingRuleNotices = [...(state.pendingRuleNotices || []), {
      id: generateId(),
      type: 'jikininki',
      actorId: owner.id,
      targetId: owner.id,
      requiredPlayerIds: state.players.map(player => player.id),
      acknowledgedPlayerIds: [],
      rewardAmount: eligibleKills,
      honorLost,
      provinceId,
      resume: null,
    }];
  }

  for (const koneko of killedFigures.filter(figure => figure.type === 'monster' && figure.monsterCardId === 'su-koneko')) {
    const owner = state.players.find(player => player.id === koneko.owner);
    if (!owner) continue;
    gainCoinsFromSupply(state, owner.id, 2, 'Koneko');
    owner.ronin += 2;
    const affectedPlayerIds = [...new Set(figuresBeforeDeath.map(figure => figure.owner))].filter(playerId => playerId !== owner.id);
    const affectedPlayers: NonNullable<RuleEventNotice['affectedPlayers']> = [];
    for (const affectedId of affectedPlayerIds) {
      const affected = state.players.find(player => player.id === affectedId);
      if (!affected) continue;
      const coinsLost = Math.min(2, Math.max(0, affected.coins));
      const roninLost = Math.min(2, Math.max(0, affected.ronin));
      affected.coins = Math.max(0, affected.coins - 2);
      affected.ronin = Math.max(0, affected.ronin - 2);
      affectedPlayers.push({ playerId: affected.id, coins: affected.coins, ronin: affected.ronin, coinsLost, roninLost });
    }
    state.log.push(`Koneko muere: ${owner.name} gana 2 Monedas y 2 Ronin; los demas clanes presentes pierden hasta 2 Monedas y 2 Ronin`);
    state.pendingRuleNotices = [...(state.pendingRuleNotices || []), {
      id: generateId(),
      type: 'koneko',
      actorId: owner.id,
      targetId: owner.id,
      requiredPlayerIds: state.players.map(player => player.id),
      acknowledgedPlayerIds: [],
      rewardAmount: 2,
      actorCoins: owner.coins,
      actorRonin: owner.ronin,
      provinceId,
      affectedPlayers,
      resume: null,
    }];
  }
}

/**
 * Ebisu death trigger.
 * When Ebisu is killed, owner gains 8 Coins.
 */
export function applyEbisuDeathEffect(state: GameState, ebisuOwnerId: string): void {
  const owner = state.players.find(p => p.id === ebisuOwnerId);
  if (!owner) return;

  gainCoinsFromSupply(state, owner.id, 8, 'Ebisu');
  state.log = [...state.log, `💰 Ebisu muere: ${owner.name} gana 8 Monedas. Total {coin} ${owner.coins}`];
  state.pendingRuleNotices = [...(state.pendingRuleNotices || []), {
    id: generateId(),
    type: 'ebisu',
    actorId: owner.id,
    targetId: owner.id,
    requiredPlayerIds: state.players.map(player => player.id),
    acknowledgedPlayerIds: [],
    actorCoins: owner.coins,
    rewardAmount: 8,
    resume: null,
  }];
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
  const isFinalBattle = newState.activeBattles.every((candidate, index) =>
    index === unresolvedIdx || candidate.resolved || candidate.uncontested
  );
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

  // Apply Fire Dragon's Incineration effect (pre-battle) when NOT in step-by-step mode.
  // In step-by-step mode, this is already applied by the store before determineTacticWinners.
  if (!stepByStepMode && !battle.fireDragonEffectApplied) {
    const fireDragonResult = applyFireDragonEffect(newState, battle.provinceId);
    // Merge Fire Dragon changes back into newState
    newState.players = fireDragonResult.players;
    newState.provinces = fireDragonResult.provinces;
    newState.log = fireDragonResult.log;
    battle.fireDragonEffectApplied = true;
  }

  // Apply Earth Dragon effect (move 1 figure of each other player out)
  // Applied regardless of step-by-step mode since it's a start-of-battle effect
  if (!battle.earthDragonEffectApplied) {
    const earthDragonResult = applyEarthDragonEffect(newState, battle.provinceId);
    newState.players = earthDragonResult.players;
    newState.provinces = earthDragonResult.provinces;
    newState.log = earthDragonResult.log;
    battle.earthDragonEffectApplied = true;
  }

  // New battles apply this before War Tactics. The fallback keeps old saves compatible.
  let jorogumoCaptured = battle.jorogumoCaptured || null;
  if (!battle.jorogumoEffectApplied) {
    const jorogumoResult = applyJorogumoEffect(newState, battle.provinceId);
    newState.provinces = jorogumoResult.state.provinces;
    newState.log = jorogumoResult.state.log;
    jorogumoCaptured = jorogumoResult.captured;
    battle.jorogumoEffectApplied = true;
    battle.jorogumoCaptured = jorogumoCaptured;
  }

  // Re-read province reference after potential Fire Dragon kills
  const provinceAfterDragon = newState.provinces[battle.provinceId];

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
    let force = calculateForce(provinceAfterDragon, pid, newState);
    if (pid === preHireRoninWinner) {
      const player = newState.players.find(p => p.id === pid)!;
      const hachimanMultiplier = getKamiInProvince(newState, battle.provinceId, 'hachiman') ? 2 : 1;
      force += player.ronin * hachimanMultiplier;
      if (player.clanId === 'koi') {
        const totalBidByPlayer = Object.values(battle.warTacticBids[pid] || {}).reduce((s, v) => s + v, 0);
        const remainingCoins = player.coins - totalBidByPlayer;
        force += Math.max(0, remainingCoins) * hachimanMultiplier;
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
        for (const fig of ownFigures) {
          if (fig.type === 'monster' && fig.monsterCardId === 'au-ebisu') {
            applyEbisuDeathEffect(newState, highestBidder);
          }
        }
        const killedIds = ownFigures.map((f) => f.id);
        newState.provinces[battle.provinceId] = {
          ...currentProvFigures,
          figures: currentProvFigures.figures.filter((f) => !killedIds.includes(f.id)),
        };
        // Phoenix revival
        if (phoenixDiedInSeppuku) {
          bidder.victoryPoints += 1;
          applyLoyaltyBonus(newState, highestBidder, 'Phoenix');
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
        // Seppuku Honor is resolved first; Jikininki then loses Honor per other figure.
        applyProvinceDeathCardEffects(newState, battle.provinceId, ownFigures, currentProvFigures.figures);
        // Virtue: Righteousness (sp-righteousness) - own figures killed in seppuku
        applyRighteousnessVP(newState, highestBidder, killCount);
        applyLoyaltyBonus(newState, highestBidder, 'seppuku');
        // Compute figure type breakdown for seppuku
        const figTypeCounts: Record<string, number> = {};
        for (const fig of ownFigures) {
          figTypeCounts[fig.type] = (figTypeCounts[fig.type] || 0) + 1;
        }
        seppukuFigures = Object.entries(figTypeCounts).map(([type, count]) => ({ type, count }));
        break;
      }
      case 'take-hostage': {
        let takeHostageVpGained = 0;
        // Capture 1 enemy Bushi/Shinto/Monster as hostage (Daimyo and daimyo-type monsters immune)
        const curProv = newState.provinces[battle.provinceId];
        const enemyFigure = curProv.figures.find(
          (f) => f.owner !== highestBidder && (f.type === 'bushi' || f.type === 'shinto' || (f.type === 'monster' && f.monsterCardId && !['su-yurei', 'sp-fukurokuju'].includes(f.monsterCardId)))
        );
        if (enemyFigure) {
          const hostageMonsterName = enemyFigure.type === 'monster' && enemyFigure.monsterCardId
            ? (SEASON_CARDS_DATA.find(c => c.id === enemyFigure.monsterCardId)?.name || enemyFigure.type)
            : enemyFigure.type;
          const hostage: Hostage = { fromClanId: enemyFigure.owner, figureType: enemyFigure.type, figureName: hostageMonsterName, monsterCardId: enemyFigure.monsterCardId };
          bidder.hostages.push(hostage);
          newState.provinces[battle.provinceId] = {
            ...curProv,
            figures: curProv.figures.filter((f) => f.id !== enemyFigure.id),
          };
          const victim = newState.players.find((p) => p.id === enemyFigure.owner);
          if (victim) {
            const stolenVP = Math.min(1, victim.victoryPoints);
            victim.victoryPoints -= stolenVP;
            bidder.victoryPoints += stolenVP;
            takeHostageVpGained += stolenVP;
            newState.log = [...newState.log, `${bidder.name} toma un rehen de ${victim.name} y roba ${stolenVP} PV. Total ${bidder.name}: ${bidder.victoryPoints} PV; ${victim.name}: ${victim.victoryPoints} PV`];
          }

          // Virtue: Sincerity (su-sincerity) - Gain Honor and 1 extra VP when taking hostage
          const bidderCardIds = new Set(bidder.seasonCards.map(c => c.id));
          if (hasCard(bidderCardIds, 'su-sincerity')) {
            gainHonor(newState, highestBidder);
            bidder.victoryPoints += 1;
            takeHostageVpGained += 1;
            newState.log = [...newState.log, `🎎 ${bidder.name} gana Honor y 1 PV extra (Sinceridad - tomar rehen)`];
          }

          // Virtue: Respect (su-respect) - Take 1 additional hostage
          if (hasCard(bidderCardIds, 'su-respect')) {
            const curProvAfter = newState.provinces[battle.provinceId];
            const secondEnemy = curProvAfter.figures.find(
              (f) => f.owner !== highestBidder && !bidder.allies.includes(f.owner) && (f.type === 'bushi' || f.type === 'shinto' || (f.type === 'monster' && f.monsterCardId && !['su-yurei', 'sp-fukurokuju'].includes(f.monsterCardId)))
            );
            if (secondEnemy) {
              const hostageMonsterName2 = secondEnemy.type === 'monster' && secondEnemy.monsterCardId
                ? (SEASON_CARDS_DATA.find(c => c.id === secondEnemy.monsterCardId)?.name || secondEnemy.type)
                : secondEnemy.type;
              const hostage2: Hostage = { fromClanId: secondEnemy.owner, figureType: secondEnemy.type, figureName: hostageMonsterName2, monsterCardId: secondEnemy.monsterCardId };
              bidder.hostages.push(hostage2);
              newState.provinces[battle.provinceId] = {
                ...curProvAfter,
                figures: curProvAfter.figures.filter((f) => f.id !== secondEnemy.id),
              };
              const victim2 = newState.players.find((p) => p.id === secondEnemy.owner);
              if (victim2) {
                const stolenVP = Math.min(1, victim2.victoryPoints);
                victim2.victoryPoints -= stolenVP;
                bidder.victoryPoints += stolenVP;
                takeHostageVpGained += stolenVP;
                newState.log = [...newState.log, `${bidder.name} toma un rehen adicional de ${victim2.name} y roba ${stolenVP} PV (Respeto). Total ${bidder.name}: ${bidder.victoryPoints} PV; ${victim2.name}: ${victim2.victoryPoints} PV`];
              }
            }
          }
          if (takeHostageVpGained > 0) applyLoyaltyBonus(newState, highestBidder, 'tomar rehen');
        }
        break;
      }
      case 'hire-ronin': {
        // Ronin tokens add force (tracked for final calculation)
        const hachimanMultiplier = getKamiInProvince(newState, battle.provinceId, 'hachiman') ? 2 : 1;
        let roninForce = bidder.ronin * hachimanMultiplier;
        if (bidder.clanId === 'koi') {
          // Koi clan: coins count as ronin, but only coins remaining after all bids
          const totalBidByBidder = Object.values(battle.warTacticBids[highestBidder] || {}).reduce((s, v) => s + v, 0);
          const remainingCoins = bidder.coins - totalBidByBidder;
          roninForce += Math.max(0, remainingCoins) * hachimanMultiplier;
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
      const hachimanMultiplier = getKamiInProvince(newState, battle.provinceId, 'hachiman') ? 2 : 1;
      force += player.ronin * hachimanMultiplier;
      // Koi clan power: coins also count as ronin for hire-ronin, but only remaining coins after bids
      if (player.clanId === 'koi') {
        const totalBidByPlayer = Object.values(battle.warTacticBids[pid] || {}).reduce((s, v) => s + v, 0);
        const remainingCoins = player.coins - totalBidByPlayer;
        force += Math.max(0, remainingCoins) * hachimanMultiplier;
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
        const hachimanMultiplier = getKamiInProvince(newState, battle.provinceId, 'hachiman') ? 2 : 1;
        force += player.ronin * hachimanMultiplier;
        if (player.clanId === 'koi') {
          const totalBidByPlayer = Object.values(battle.warTacticBids[pid] || {}).reduce((s, v) => s + v, 0);
          const remainingCoins = player.coins - totalBidByPlayer;
          force += Math.max(0, remainingCoins) * hachimanMultiplier;
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
      applyOniOfSoulsWarTokenBonus(newState, winnerId, battle.provinceId);
      applyWarTokenCardRewards(newState, winnerId, battle.provinceId);
    }

    const winnerCardIds = new Set(winner.seasonCards.map(c => c.id));

    // Losing players' figures are killed (return to reserve).
    // Allied figures of the winner are also protected.
    // Virtue: Mercy (su-mercy) - May leave all opponent figures alive and gain 2 VP instead
    const hasMercyVirtue = hasCard(winnerCardIds, 'su-mercy');
    const wouldKillFigures = battle.participants.some((pid) => {
      if (pid === winnerId) return false;
      if (winner.allies.includes(pid)) return false;
      return finalProvince.figures.some((f) => f.owner === pid && f.type !== 'fortress' && canBeKilledByPlayer(newState, battle.provinceId, f, winnerId!));
    });
    if (hasMercyVirtue && wouldKillFigures && battle.mercyChoice === undefined) {
      return {
        ...state,
        pendingBattleMercyDecision: { ownerId: winnerId, provinceId: battle.provinceId },
      };
    }
    const mercyActive = hasMercyVirtue && battle.mercyChoice === true;
    if (mercyActive && wouldKillFigures) {
      gainVictoryPoints(newState, winnerId!, 2, 'Misericordia');
      newState.log = [...newState.log, `🕊️ ${winner.name} muestra Misericordia: +2 PV, figuras enemigas sobreviven`];
    }

    const killedMap: Record<string, Record<string, number>> = {};
    const killedMonsterNames: Record<string, string[]> = {};
    let oniKilledCount = 0; // Track Oni kills for Boldness virtue
    if (!mercyActive || !wouldKillFigures) {
      // Normal kill logic (no mercy)
      battle.participants.forEach((pid) => {
        if (pid === winnerId) return;
        // Skip killing figures of players allied with the winner
        if (winner.allies.includes(pid)) return;
        const loserFigures = finalProvince.figures.filter((f) =>
          f.owner === pid && canBeKilledByPlayer(newState, battle.provinceId, f, winnerId!)
        );
        loserFigures.forEach((fig) => {
          if (fig.type === 'fortress') return; // Fortresses immune
          const loser = newState.players.find((p) => p.id === pid)!;
          if (fig.type === 'bushi') loser.bushi += 1;
          else if (fig.type === 'shinto') loser.shinto += 1;
          else if (fig.type === 'daimyo') loser.hasDaimyo = true;
          else if (fig.type === 'monster') {
            loser.monsters += 1;
            // Track monster names for display
            if (fig.monsterCardId) {
              const key = `${pid}|monster`;
              if (!killedMonsterNames[key]) killedMonsterNames[key] = [];
              const monsterName = SEASON_CARDS_DATA.find(c => c.id === fig.monsterCardId)?.name;
              if (monsterName) killedMonsterNames[key].push(monsterName);
              // Track Oni kills for Boldness virtue
              if (fig.monsterCardId.includes('oni-of')) {
                oniKilledCount++;
              }
            }
          }
          // Track killed figures for display
          if (!killedMap[pid]) killedMap[pid] = {};
          killedMap[pid][fig.type] = (killedMap[pid][fig.type] || 0) + 1;
        });
        // Virtue: Righteousness - for each loser whose figures are killed
        const loserKillCount = Object.values(killedMap[pid] || {}).reduce((sum, c) => sum + c, 0);
        applyRighteousnessVP(newState, pid, loserKillCount);
      });
    }

    // Build killedFigures array from the map
    const killedFigures: { owner: string; figureType: string; count: number; monsterNames?: string[] }[] = [];
    for (const ownerId of Object.keys(killedMap)) {
      for (const figType of Object.keys(killedMap[ownerId])) {
        const entry: { owner: string; figureType: string; count: number; monsterNames?: string[] } = { owner: ownerId, figureType: figType, count: killedMap[ownerId][figType] };
        if (figType === 'monster') {
          const key = `${ownerId}|monster`;
          if (killedMonsterNames[key] && killedMonsterNames[key].length > 0) {
            entry.monsterNames = killedMonsterNames[key];
          }
        }
        killedFigures.push(entry);
      }
    }
    battle.killedFigures = killedFigures;

    // Virtue: Justice (su-justice) - Gain 3 VP when killing figures of a player with less Honor
    if (hasCard(winnerCardIds, 'su-justice') && Object.keys(killedMap).length > 0) {
      const winnerHonorIdx = newState.honorTrack.indexOf(winnerId!);
      const playersWithLessHonorKilled = Object.keys(killedMap).filter(pid => {
        const pidHonorIdx = newState.honorTrack.indexOf(pid);
        return pidHonorIdx > winnerHonorIdx; // higher index = less honor
      });
      for (const victimId of playersWithLessHonorKilled) {
        gainVictoryPoints(newState, winnerId!, 3, 'Justicia');
        const victim = newState.players.find(player => player.id === victimId);
        newState.log = [...newState.log, `${winner.name} gana 3 PV por matar figuras de ${victim?.name || 'un jugador'} con menor Honor (Justicia)`];
      }
    }

    // Virtue: Boldness (au-boldness) - Gain 4 VP per enemy Oni killed in battle
    if (hasCard(winnerCardIds, 'au-boldness') && oniKilledCount > 0) {
      const boldnessVP = oniKilledCount * 4;
      gainVictoryPoints(newState, winnerId!, boldnessVP, 'Audacia');
      newState.log = [...newState.log, `🔥 ${winner.name} gana ${boldnessVP} PV (Audacia - ${oniKilledCount} Oni eliminados)`];
    }

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
      gainVictoryPoints(newState, imperialPoetsBidder, totalDeaths, 'Poetas Imperiales');
      newState.log = [...newState.log, `${poetsBidder.name} obtiene ${totalDeaths} PV de Poetas Imperiales`];
      // Store on resolutionData for popup display
      if (stepByStepMode) {
        battle.resolutionData = {
          ...resData,
          imperialPoetsWinnerId: imperialPoetsBidder,
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
        imperialPoetsWinnerId: null,
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

    // Monster death triggers for battle casualties
    if (!mercyActive || !wouldKillFigures) {
      const casualtyFigures = battle.participants
        .filter(pid => pid !== winnerId && !winner.allies.includes(pid))
        .flatMap(pid => finalProvince.figures.filter(figure => figure.owner === pid && figure.type !== 'fortress' && canBeKilledByPlayer(newState, battle.provinceId, figure, winnerId!)));
      battle.participants.forEach((pid) => {
        if (pid === winnerId) return;
        if (winner.allies.includes(pid)) return;
        const loserFiguresForTriggers = finalProvince.figures.filter(f => f.owner === pid && f.type !== 'fortress' && canBeKilledByPlayer(newState, battle.provinceId, f, winnerId!));
        for (const fig of loserFiguresForTriggers) {
          if (fig.type === 'monster' && fig.monsterCardId === 'au-ebisu') {
            applyEbisuDeathEffect(newState, pid);
          }
        }
      });
      applyProvinceDeathCardEffects(newState, battle.provinceId, casualtyFigures, finalProvince.figures);
    }

    // Remove killed figures from province (keep winner's figures, allied figures, daimyos, and fortresses)
    // If mercy is active and figures would have been killed, skip removal
    if (!mercyActive || !wouldKillFigures) {
      newState.provinces[battle.provinceId] = {
        ...finalProvince,
        figures: finalProvince.figures.filter(
          (f) => f.owner === winnerId || winner.allies.includes(f.owner) || f.type === 'fortress' || !canBeKilledByPlayer(newState, battle.provinceId, f, winnerId!)
        ),
      };
    }

    // FAQ 2.0: Kitsune must still be alive and present after battle casualties resolve.
    applyKitsuneWarTokenBonus(newState, winnerId, battle.provinceId);

    // Revert Jorogumo effect (return captured figure to original owner)
    if (jorogumoCaptured) {
      const revertedState = revertJorogumoEffect(newState, battle.provinceId, jorogumoCaptured);
      newState.provinces = revertedState.provinces;
    }

    // Phoenix revival in battle: if any killed loser figure was Phoenix, revive it
    if (!mercyActive || !wouldKillFigures) {
      const phoenixKilled = battle.participants
        .filter((pid) => pid !== winnerId && !winner.allies.includes(pid))
        .flatMap((pid) => finalProvince.figures.filter((f) => f.owner === pid && f.monsterCardId === 'sp-phoenix' && canBeKilledByPlayer(newState, battle.provinceId, f, winnerId!)));
      if (phoenixKilled.length > 0) {
        const phoenixFig = phoenixKilled[0];
        const phoenixOwner = newState.players.find((p) => p.id === phoenixFig.owner)!;
        const figureId = Math.random().toString(36).substring(2, 10);
        const newPhoenixFigure = { type: 'monster' as const, owner: phoenixFig.owner, id: figureId, monsterCardId: 'sp-phoenix' };
        newState.provinces[battle.provinceId] = {
          ...newState.provinces[battle.provinceId],
          figures: [...newState.provinces[battle.provinceId].figures, newPhoenixFigure],
        };
        phoenixOwner.monsters -= 1;
        gainVictoryPoints(newState, phoenixOwner.id, 1, 'Phoenix');
        newState.log = [...newState.log, `Fenix revive en ${finalProvince.name || battle.provinceId}`];
      }
    }

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
        const allocations: Record<string, number> = Object.fromEntries(losers.map(pid => [pid, share]));
        if (share > 0) {
          losers.forEach((pid) => {
            const loser = newState.players.find((p) => p.id === pid)!;
            loser.coins += share;
            newState.log = [...newState.log, `${loser.name} recibe ${share} monedas del ganador. Total {coin} ${loser.coins}`];
          });
        }
        // Remainders are deterministic; the following popup only reports the final allocation.
        losers.slice(0, remainder).forEach((pid) => {
          const loser = newState.players.find((p) => p.id === pid)!;
          loser.coins += 1;
          allocations[pid] += 1;
          newState.log = [...newState.log, `${loser.name} recibe 1 moneda restante del ganador. Total {coin} ${loser.coins}`];
        });
        if (!isFinalBattle) {
          newState.coinDistributionPending = {
            battleProvinceId: battle.provinceId,
            winnerId,
            losers,
            remainder: 0,
            distributed: totalBid,
            sharePerLoser: share,
            allocations,
          };
        }
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

export function resolveBattleMercyDecision(state: GameState, playerId: string, useMercy: boolean): GameState {
  const pending = state.pendingBattleMercyDecision;
  if (!pending || pending.ownerId !== playerId) return state;
  const battle = state.activeBattles.find(candidate => candidate.provinceId === pending.provinceId && !candidate.resolved);
  if (!battle) return { ...state, pendingBattleMercyDecision: null };
  const nextState: GameState = {
    ...state,
    pendingBattleMercyDecision: null,
    activeBattles: state.activeBattles.map(candidate => candidate.provinceId === pending.provinceId && !candidate.resolved
      ? { ...candidate, mercyChoice: useMercy }
      : candidate),
  };
  return resolveNextBattle(nextState);
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
    provinces: Object.fromEntries(Object.entries(state.provinces).map(([id, province]) => [
      id,
      { ...province, figures: province.figures.filter(figure => figure.type !== 'kami') },
    ])) as GameState['provinces'],
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
    pendingMonsterPlacementCardId: null,
    pendingMonsterPlacementPlayerId: null,
    teaTurnIndex: 0,
    warPhaseReadyPlayers: [],
    warPhaseStartAcknowledged: false,
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
    kamiPlacementActive: false,
    kamiPlacementPlayerId: null,
    kamiPlacementKamiType: null,
    kamiPlacementProvinceId: null,
    kamiManifestedTempleIndexes: [],
    log: [...state.log, 'Limpieza: Ronin y monedas descartados, Shinto devueltos de los santuarios, alianzas rotas'],
  };

  // Return all Shinto from temples to reserves
  state.temples.forEach((temple) => {
    temple.figures.forEach((fig) => {
      const player = newState.players.find((p) => p.id === fig.playerId);
      if (player && !fig.monsterCardId) {
        player.shinto += 1;
      }
    });
  });

  // Autumn ends the game, so returning hostages for Coins would add a useless interaction.
  // Clear them silently; earlier seasons keep the normal return reward.
  newState.players.forEach((player) => {
    if (player.hostages.length > 0) {
      returnHostagesToOwners(newState, player.hostages);
      if (state.currentSeason !== 'autumn') {
        gainCoinsFromSupply(newState, player.id, player.hostages.length, 'devolucion de rehenes');
        newState.log = [...newState.log, `${player.name} devuelve ${player.hostages.length} rehen(es) y gana ${player.hostages.length} moneda(s). Total {coin} ${player.coins}`];
      }
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
    provinces: Object.fromEntries(Object.entries(state.provinces).map(([id, province]) => [
      id,
      { ...province, figures: province.figures.filter(figure => figure.type !== 'kami') },
    ])) as GameState['provinces'],
    allianceProposals: [],
    hostageReturnActive: false,
    hostageReturnOrder: [],
    hostageReturnIndex: 0,
    hostageReturnReadyPlayers: [],
    cleanupTeaCeremonyReady: false,
    cleanupTeaCeremonyReadyPlayers: [],
    kamiPlacementActive: false,
    kamiPlacementPlayerId: null,
    kamiPlacementKamiType: null,
    kamiPlacementProvinceId: null,
    kamiManifestedTempleIndexes: [],
    log: [...state.log, 'Limpieza: Ronin y monedas descartados, Shinto devueltos de los santuarios, alianzas rotas'],
  };

  // Return all Shinto from temples to reserves
  state.temples.forEach((temple) => {
    temple.figures.forEach((fig) => {
      const player = newState.players.find((p) => p.id === fig.playerId);
      if (player && !fig.monsterCardId) {
        player.shinto += 1;
      }
    });
  });

  // At the end of Autumn, Coins no longer have a purpose. Discard hostages and
  // bypass the complete interactive return flow before entering Winter.
  if (state.currentSeason === 'autumn') {
    newState.players.forEach(player => {
      returnHostagesToOwners(newState, player.hostages);
      player.hostages = [];
    });
    return finalizeCleanupAndAdvance(newState);
  }

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
    newState = finalizeCleanupAndAdvance(newState);
  }

  return newState;
}

/**
 * Process a hostage return acceptance during interactive cleanup.
 * Returns coins to the player and clears their hostages.
 */
export function processHostageReturn(state: GameState): GameState {
  let newState: GameState = {
    ...state,
    players: state.players.map(p => ({ ...p, hostages: [...p.hostages] })),
    log: [...state.log],
  };

  const currentPlayerId = newState.hostageReturnOrder[newState.hostageReturnIndex];
  const player = newState.players.find(p => p.id === currentPlayerId);
  if (!player) return newState;

  const coinsGained = player.hostages.length;
  returnHostagesToOwners(newState, player.hostages);
  gainCoinsFromSupply(newState, player.id, coinsGained, 'devolucion de rehenes');
  newState.log = [...newState.log, `${player.name} devuelve ${coinsGained} rehen(es) y gana ${coinsGained} moneda(s). Total {coin} ${player.coins}`];
  player.hostages = [];

  newState.hostageReturnIndex += 1;

  if (newState.hostageReturnIndex >= newState.hostageReturnOrder.length) {
    newState.hostageReturnActive = false;
    newState = finalizeCleanupAndAdvance(newState);
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
    pendingMonsterPlacementCardId: null,
    pendingMonsterPlacementPlayerId: null,
    teaTurnIndex: 0,
    warPhaseReadyPlayers: [],
    warPhaseStartAcknowledged: false,
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
    newState.logHistory = {
      ...newState.logHistory,
      [newState.currentSeason]: [...(newState.logHistory[newState.currentSeason] || []), ...newState.log],
    };
    newState.log = [];
    newState.currentSeason = nextSeason;
    newState.round += 1;
    newState.currentPhase = 'seasonSetup';
    newState.teaReadyPlayers = [];
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

  // Legacy Autumn snapshots may still reach Winter with hostages. Remove them
  // without granting Coins, matching the streamlined Autumn cleanup flow.
  newState.players.forEach((player) => {
    if (player.hostages.length > 0) {
      returnHostagesToOwners(newState, player.hostages);
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

export function scoreWinterUpgrade(gameState: GameState, player: Player, card: SeasonCard): number {
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
        const figs = province.figures.filter((f) => f.owner === player.id && (f.type !== 'fortress' || player.clanId === 'tortuga'));
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
        fortCount += province.figures.filter((f) => f.owner === player.id && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju'))).length;
      });
      return fortCount * 3;
    }
    case 'au-form-of-the-phoenix': {
      return countDifferentVirtues(player) * 3;
    }
    case 'au-form-of-the-tanuki': {
      const types = new Set(player.seasonCards.map((c) => c.cardType));
      if (playerHasCard(player, 'sp-jurojin')) types.add('virtue');
      return types.size * 2;
    }
    default:
      return 0;
  }
}

// ============================================================
// Movement & Utility
// ============================================================

/**
 * Apply on-enter effects for monster figures: Benten, Oni of Hate, Oni of Spite.
 * Called after a monster figure has been placed in a destination province.
 * Mutates the state in place.
 */
function applyMonsterEnterEffects(state: GameState, provinceId: string, figure: Figure, playerId: string): void {
  if (!figure.monsterCardId) return;

  const province = state.provinces[provinceId];
  if (!province) return;

  // Benten: force a player to move out 1 of their monsters
  if (figure.monsterCardId === 'au-benten') {
    const hasEnemyMonster = province.figures.some(candidate =>
      candidate.type === 'monster'
      && candidate.owner !== playerId
      && candidate.id !== figure.id
      && !isCardEffectImmuneDaimyo(candidate));
    if (hasEnemyMonster && !state.pendingMonsterEnterDecision) {
      state.pendingMonsterEnterDecision = { type: 'benten', ownerId: playerId, provinceId, sourceFigureId: figure.id };
    }
    return;
  }

  // Oni of Hate: kill 1 Bushi or Shinto of each player with higher honor
  if (figure.monsterCardId === 'au-oni-of-hate') {
    const oniOwnerHonorIndex = state.honorTrack.indexOf(playerId);
    const hasTargets = province.figures.some(candidate =>
      candidate.owner !== playerId
      && state.honorTrack.indexOf(candidate.owner) < oniOwnerHonorIndex
      && (candidate.type === 'bushi' || candidate.type === 'shinto')
      && canBeKilledByPlayer(state, provinceId, candidate, playerId));
    if (hasTargets && !state.pendingMonsterEnterDecision) {
      state.pendingMonsterEnterDecision = { type: 'oni-hate', ownerId: playerId, provinceId, sourceFigureId: figure.id };
    }
    return;
  }

  // Oni of Spite: steal 2 VP from each player with higher honor and any force there
  if (figure.monsterCardId === 'au-oni-of-spite') {
    const oniOwnerHonorIdx = state.honorTrack.indexOf(playerId);
    const owner = state.players.find(p => p.id === playerId);
    if (!owner) return;
    const currentProvFiguresForSpite = state.provinces[provinceId].figures;
    const playersInProvince = [...new Set(currentProvFiguresForSpite.map(f => f.owner))].filter(pid => pid !== playerId);
    for (const pid of playersInProvince) {
      const pidHonorIdx = state.honorTrack.indexOf(pid);
      if (pidHonorIdx < oniOwnerHonorIdx) {
        // This player has higher honor and has figures here - steal 2 VP
        const victim = state.players.find(p => p.id === pid);
        if (victim) {
          const stolen = Math.min(2, victim.victoryPoints);
          victim.victoryPoints -= stolen;
          if (stolen > 0) gainVictoryPoints(state, owner.id, stolen, 'Oni of Spite');
          state.log = [...state.log, `😈 Oni of Spite: roba ${stolen} PV de ${victim.name}`];
        }
      }
    }
  }
}

export function prepareMonsterEnterDecision(state: GameState, provinceId: string, figureId: string, resume: 'advance-kami' | 'advance-train' | null = null): GameState {
  const province = state.provinces[provinceId];
  const figure = province?.figures.find(candidate => candidate.id === figureId);
  if (!province || !figure || figure.type !== 'monster') return state;
  const nextState: GameState = {
    ...state,
    players: state.players.map(player => ({ ...player })),
    provinces: Object.fromEntries(Object.entries(state.provinces).map(([id, item]) => [id, { ...item, figures: [...item.figures] }])) as GameState['provinces'],
    log: [...state.log],
  };
  applyMonsterEnterEffects(nextState, provinceId, figure, figure.owner);
  if (nextState.pendingMonsterEnterDecision) {
    nextState.pendingMonsterEnterDecision = { ...nextState.pendingMonsterEnterDecision, resume };
  }
  return nextState;
}

export function resolveMonsterEnterDecision(
  state: GameState,
  playerId: string,
  useEffect: boolean,
  selectedByPlayer: Record<string, string>,
  destinationId?: string,
  useMercy = false,
): GameState {
  const pending = state.pendingMonsterEnterDecision;
  if (!pending || pending.ownerId !== playerId) return state;
  const province = state.provinces[pending.provinceId];
  if (!province) return state;
  const nextState: GameState = {
    ...state,
    pendingMonsterEnterDecision: null,
    players: state.players.map(player => ({ ...player })),
    provinces: Object.fromEntries(Object.entries(state.provinces).map(([id, item]) => [id, { ...item, figures: [...item.figures] }])) as GameState['provinces'],
    log: [...state.log],
  };
  const owner = nextState.players.find(player => player.id === playerId);

  if (pending.type === 'oni-hate' && useMercy) {
    if (!owner?.seasonCards.some(card => card.id === 'su-mercy' || card.id === 'su-mercy-2')) return state;
    gainVictoryPoints(nextState, playerId, 2, 'Misericordia');
    nextState.log.push(`${owner.name} perdona las figuras que Oni of Hate podria eliminar y gana 2 PV (Misericordia)`);
    return resumeAfterMonsterEnter(nextState, pending.resume);
  }

  if (!useEffect) {
    if (pending.type !== 'benten') return state;
    nextState.log.push(`${owner?.name || 'Jugador'} decide no usar Benten en ${province.name}`);
    return resumeAfterMonsterEnter(nextState, pending.resume);
  }

  if (pending.type === 'benten') {
    const targetId = Object.values(selectedByPlayer)[0];
    const target = province.figures.find(figure =>
      figure.id === targetId
      && figure.type === 'monster'
      && figure.owner !== playerId
      && !isCardEffectImmuneDaimyo(figure));
    const provinceData = PROVINCES_DATA.find(item => item.id === pending.provinceId);
    if (!target || !destinationId || !provinceData || ![...provinceData.adjacentProvinces, ...provinceData.seaRoutes].includes(destinationId)) return state;
    if (isFigureTrappedBySusanoo(nextState, pending.provinceId, target)) return state;
    const destination = nextState.provinces[destinationId];
    const targetOwner = nextState.players.find(player => player.id === target.owner);
    if (!destination || !targetOwner) return state;
    const plague = destination.figures.find(figure => figure.owner !== target.owner && figure.monsterCardId === 'au-oni-of-plagues');
    if (plague && nextState.honorTrack.indexOf(target.owner) < nextState.honorTrack.indexOf(plague.owner)) return state;
    if (targetOwner.clanId === 'luna' && destination.figures.filter(figure => figure.owner === target.owner && figure.type !== 'fortress').length >= 2) return state;
    nextState.provinces[pending.provinceId].figures = nextState.provinces[pending.provinceId].figures.filter(figure => figure.id !== target.id);
    destination.figures.push(target);
    nextState.log.push(`${owner?.name || 'Jugador'} obliga a ${SEASON_CARDS_DATA.find(card => card.id === target.monsterCardId)?.name || 'un monstruo'} de ${targetOwner.name} a moverse a ${destination.name} (Benten)`);
    applyMonsterEnterEffects(nextState, destinationId, target, target.owner);
    if (nextState.pendingMonsterEnterDecision) {
      nextState.pendingMonsterEnterDecision = { ...nextState.pendingMonsterEnterDecision, resume: pending.resume || null };
    }
    return resumeAfterMonsterEnter(nextState, pending.resume);
  }

  const ownerHonorIndex = nextState.honorTrack.indexOf(playerId);
  const requiredOwners = [...new Set(province.figures
    .filter(figure => figure.owner !== playerId && nextState.honorTrack.indexOf(figure.owner) < ownerHonorIndex && (figure.type === 'bushi' || figure.type === 'shinto') && canBeKilledByPlayer(nextState, pending.provinceId, figure, playerId))
    .map(figure => figure.owner))];
  const figuresBeforeDeath = [...province.figures];
  const killedFigures: Figure[] = [];
  for (const victimId of requiredOwners) {
    const targetId = selectedByPlayer[victimId];
    const target = nextState.provinces[pending.provinceId].figures.find(figure =>
      figure.id === targetId && figure.owner === victimId && (figure.type === 'bushi' || figure.type === 'shinto') && canBeKilledByPlayer(nextState, pending.provinceId, figure, playerId));
    if (!target) return state;
    const victim = nextState.players.find(player => player.id === victimId);
    if (!victim) return state;
    nextState.provinces[pending.provinceId].figures = nextState.provinces[pending.provinceId].figures.filter(figure => figure.id !== target.id);
    if (target.type === 'bushi') victim.bushi += 1;
    else victim.shinto += 1;
    killedFigures.push(target);
    applyRighteousnessVP(nextState, victimId, 1);
    nextState.log.push(`${owner?.name || 'Jugador'} elimina 1 ${target.type} de ${victim.name} en ${province.name} (Oni of Hate)`);
  }
  applyProvinceDeathCardEffects(nextState, pending.provinceId, killedFigures, figuresBeforeDeath);
  return resumeAfterMonsterEnter(nextState, pending.resume);
}

function resumeAfterMonsterEnter(state: GameState, resume: PendingMonsterEnterDecision['resume']): GameState {
  if (state.pendingMonsterEnterDecision || resume !== 'continue-fujin') return state;
  return continuePendingFujinMovement(state);
}

export function isFigureTrappedBySusanoo(state: GameState, provinceId: string, figure: Figure): boolean {
  return figure.type !== 'kami' && !!getKamiInProvince(state, provinceId, 'susanoo');
}

export function moveForces(
  state: GameState,
  playerId: string,
  fromProvinceId: string,
  toProvinceId: string,
  figureIds: string[]
): GameState {
  const newState: GameState = {
    ...state,
    players: state.players.map(p => ({ ...p })),
    provinces: { ...state.provinces },
    honorTrack: [...state.honorTrack],
    log: [...state.log],
  };

  const fromProvince = newState.provinces[fromProvinceId];
  const toProvince = newState.provinces[toProvinceId];
  if (!fromProvince || !toProvince) return state;

  const isFujinMovement = state.kamiResolutionActive && state.fujinMovesRemaining > 0;

  // A restored game can temporarily retain a stale Marshal flag while Fujin is resolving.
  // Fujin must take precedence because its Sea Route effects remain provisional until confirmation.
  if (state.marshalMandateActive && !isFujinMovement) {
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
      if (isFigureTrappedBySusanoo(state, fromProvinceId, figure)) continue;

      // Reject fortress movement unless player is Tortuga clan
      if (figure.type === 'fortress' && player.clanId !== 'tortuga') continue;

      // Adjacency check: skip for Libelula clan (can move anywhere)
      if (player.clanId !== 'libelula') {
        if (!isValidMove(fromProvinceId, toProvinceId)) continue;
      } else {
        // Libelula can move to any province except the same one
        if (fromProvinceId === toProvinceId) continue;
      }

      // Oni of Plagues: players with higher honor cannot move figures to this province
      const oniOfPlaguesFigure = currentToFigures.find(f => f.type === 'monster' && f.monsterCardId === 'au-oni-of-plagues');
      if (oniOfPlaguesFigure && oniOfPlaguesFigure.owner !== playerId) {
        const oniOwnerHonorIdx = state.honorTrack.indexOf(oniOfPlaguesFigure.owner);
        const moverHonorIdx = state.honorTrack.indexOf(playerId);
        if (moverHonorIdx < oniOwnerHonorIdx) continue; // Higher honor (lower index) is blocked
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
    const isSeaCrossing = fromProvince.seaRoutes.includes(toProvinceId);
    newState.pendingSerpentCrossings = isSeaCrossing
      ? [...(state.pendingSerpentCrossings || []), { moverId: playerId, fromProvinceId, toProvinceId }]
      : [...(state.pendingSerpentCrossings || [])];

    // Apply on-enter monster effects for moved figures
    for (const figureId of figureIds) {
      const latestFigures = newState.provinces[toProvinceId].figures;
      const movedFig = latestFigures.find(f => f.id === figureId);
      if (!movedFig || movedFig.type !== 'monster' || !movedFig.monsterCardId) continue;
      applyMonsterEnterEffects(newState, toProvinceId, movedFig, playerId);
    }

    return newState;
  }

  // Fujin grants two movement points: move two figures one step, one figure two steps,
  // or spend the points in two separate actions (including moving the same figure twice).
  if (isFujinMovement) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return state;

    const uniqueFigureIds = [...new Set(figureIds)];
    if (uniqueFigureIds.length < 1 || uniqueFigureIds.length > 2 || uniqueFigureIds.length !== figureIds.length) return state;
    const movedFigures = fromProvince.figures.filter(f => uniqueFigureIds.includes(f.id) && f.owner === playerId);
    if (movedFigures.length !== uniqueFigureIds.length) return state;
    if (movedFigures.some(figure => isFigureTrappedBySusanoo(state, fromProvinceId, figure))) return state;
    if (movedFigures.some(figure => figure.type === 'fortress') && player.clanId !== 'tortuga') return state;

    const path = getFujinMovementPath(player.clanId, fromProvinceId, toProvinceId, movedFigures.length);
    if (!path) return state;
    const movementCost = movedFigures.length === 2 ? 2 : path.length - 1;
    if (movementCost > state.fujinMovesRemaining) return state;

    if (path.length === 3 && movedFigures.length === 1) {
      const intermediateId = path[1];
      const intermediate = newState.provinces[intermediateId];
      const figure = movedFigures[0];
      if (!intermediate) return state;
      const intermediatePlague = intermediate.figures.find(candidate => candidate.owner !== playerId && candidate.monsterCardId === 'au-oni-of-plagues');
      if (intermediatePlague && state.honorTrack.indexOf(playerId) < state.honorTrack.indexOf(intermediatePlague.owner)) return state;
      if (player.clanId === 'luna' && figure.type !== 'fortress' && intermediate.figures.filter(candidate => candidate.owner === playerId && candidate.type !== 'fortress').length >= 2) return state;

      newState.provinces[fromProvinceId] = { ...fromProvince, figures: fromProvince.figures.filter(candidate => candidate.id !== figure.id) };
      newState.provinces[intermediateId] = { ...intermediate, figures: [...intermediate.figures, figure] };
      newState.pendingFujinContinuation = { playerId, figureId: figure.id, fromProvinceId: intermediateId, toProvinceId };
      newState.log.push(`${player.name} mueve 1 figura de ${fromProvince.name} a ${intermediate.name} (Fujin, primer movimiento)`);
      if (fromProvince.seaRoutes.includes(intermediateId)) {
        newState.pendingSerpentCrossings = [...(state.pendingSerpentCrossings || []), { moverId: playerId, fromProvinceId, toProvinceId: intermediateId }];
      }
      if (figure.type === 'monster' && figure.monsterCardId) {
        applyMonsterEnterEffects(newState, intermediateId, figure, playerId);
        if (newState.pendingMonsterEnterDecision) {
          newState.pendingMonsterEnterDecision = { ...newState.pendingMonsterEnterDecision, resume: 'continue-fujin' };
          return newState;
        }
      }
      return continuePendingFujinMovement(newState);
    }

    // Oni of Plagues: players with higher honor cannot move figures to this province
    const oniOfPlaguesFujin = toProvince.figures.find(f => f.type === 'monster' && f.monsterCardId === 'au-oni-of-plagues');
    if (oniOfPlaguesFujin && oniOfPlaguesFujin.owner !== playerId) {
      const oniOwnerHonorIdx = state.honorTrack.indexOf(oniOfPlaguesFujin.owner);
      const moverHonorIdx = state.honorTrack.indexOf(playerId);
      if (moverHonorIdx < oniOwnerHonorIdx) return state; // Higher honor (lower index) is blocked
    }

    // Luna clan power: max 2 figures per province (excluding fortresses).
    if (player.clanId === 'luna') {
      const lunaFiguresInDest = toProvince.figures.filter(
        (f) => f.owner === playerId && f.type !== 'fortress'
      ).length;
      const movedLunaFigures = movedFigures.filter(figure => figure.type !== 'fortress').length;
      if (lunaFiguresInDest + movedLunaFigures > 2) return state;
    }

    const remainingFigures = fromProvince.figures.filter(f => !uniqueFigureIds.includes(f.id));

    newState.provinces[fromProvinceId] = { ...fromProvince, figures: remainingFigures };
    newState.provinces[toProvinceId] = { ...toProvince, figures: [...toProvince.figures, ...movedFigures] };

    newState.log = [...newState.log, `${player.name} mueve ${movedFigures.length} ${movedFigures.length === 1 ? 'figura' : 'figuras'} de ${fromProvince.name} a ${toProvince.name} (Fujin)`];
    const seaCrossings = path.slice(0, -1).flatMap((pathProvinceId, index) => {
      const nextProvinceId = path[index + 1];
      const pathProvince = state.provinces[pathProvinceId];
      return pathProvince?.seaRoutes.includes(nextProvinceId)
        ? [{ moverId: playerId, fromProvinceId: pathProvinceId, toProvinceId: nextProvinceId }]
        : [];
    });
    newState.pendingSerpentCrossings = [...(state.pendingSerpentCrossings || []), ...seaCrossings];

    for (const figure of movedFigures) {
      if (figure.type === 'monster' && figure.monsterCardId) {
        applyMonsterEnterEffects(newState, toProvinceId, figure, playerId);
      }
    }

    return newState;
  }

  // Non-marshal movement (standard)
  // Check valid move (adjacent or sea route)
  if (!isValidMove(fromProvinceId, toProvinceId)) return state;

  // Oni of Plagues: players with higher honor cannot move figures to this province
  const oniOfPlaguesStd = toProvince.figures.find(f => f.type === 'monster' && f.monsterCardId === 'au-oni-of-plagues');
  if (oniOfPlaguesStd && oniOfPlaguesStd.owner !== playerId) {
    const oniOwnerHonorIdx = state.honorTrack.indexOf(oniOfPlaguesStd.owner);
    const moverHonorIdx = state.honorTrack.indexOf(playerId);
    if (moverHonorIdx < oniOwnerHonorIdx) return state; // Higher honor (lower index) is blocked
  }

  // Verify all figures belong to the player and are in the source province
  const figuresValid = figureIds.every((fid) =>
    fromProvince.figures.some((f) => f.id === fid && f.owner === playerId && !isFigureTrappedBySusanoo(state, fromProvinceId, f))
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
  chargeSerpentSeaRoute(newState, playerId, fromProvinceId, toProvinceId);

  // Apply on-enter monster effects for moved figures
  for (const fig of movedFigures) {
    if (fig.type === 'monster' && fig.monsterCardId) {
      applyMonsterEnterEffects(newState, toProvinceId, fig, playerId);
    }
  }

  return newState;
}

function continuePendingFujinMovement(state: GameState): GameState {
  const pending = state.pendingFujinContinuation;
  if (!pending) return state;
  const source = state.provinces[pending.fromProvinceId];
  const destination = state.provinces[pending.toProvinceId];
  const figure = source?.figures.find(candidate => candidate.id === pending.figureId && candidate.owner === pending.playerId);
  const player = state.players.find(candidate => candidate.id === pending.playerId);
  if (!source || !destination || !figure || !player) return { ...state, pendingFujinContinuation: null };

  const nextState: GameState = {
    ...state,
    provinces: { ...state.provinces },
    log: [...state.log],
    pendingFujinContinuation: null,
  };
  const plague = destination.figures.find(candidate => candidate.owner !== player.id && candidate.monsterCardId === 'au-oni-of-plagues');
  const plagueBlocks = plague && nextState.honorTrack.indexOf(player.id) < nextState.honorTrack.indexOf(plague.owner);
  const lunaBlocked = player.clanId === 'luna' && figure.type !== 'fortress'
    && destination.figures.filter(candidate => candidate.owner === player.id && candidate.type !== 'fortress').length >= 2;
  if (plagueBlocks || lunaBlocked) {
    nextState.log.push(`${player.name} no puede completar el segundo movimiento de Fujin hacia ${destination.name}`);
    return nextState;
  }

  nextState.provinces[pending.fromProvinceId] = { ...source, figures: source.figures.filter(candidate => candidate.id !== figure.id) };
  nextState.provinces[pending.toProvinceId] = { ...destination, figures: [...destination.figures, figure] };
  nextState.log.push(`${player.name} mueve 1 figura de ${source.name} a ${destination.name} (Fujin, segundo movimiento)`);
  if (source.seaRoutes.includes(pending.toProvinceId)) {
    nextState.pendingSerpentCrossings = [...(state.pendingSerpentCrossings || []), {
      moverId: player.id,
      fromProvinceId: pending.fromProvinceId,
      toProvinceId: pending.toProvinceId,
    }];
  }
  if (figure.type === 'monster' && figure.monsterCardId) applyMonsterEnterEffects(nextState, pending.toProvinceId, figure, player.id);
  return nextState;
}

function chargeSerpentSeaRoute(state: GameState, moverId: string, fromProvinceId: string, toProvinceId: string): void {
  const fromProvince = state.provinces[fromProvinceId];
  if (!fromProvince?.seaRoutes.includes(toProvinceId)) return;
  const charges = state.players
    .filter(player => player.id !== moverId && playerHasCard(player, 'su-path-of-the-serpent'))
    .map(player => ({ ownerId: player.id, moverId, fromProvinceId, toProvinceId, resume: null }));
  if (charges.length === 0) return;
  const queue = [...(state.pendingSerpentChargeQueue || []), ...charges];
  if (!state.pendingSerpentCharge) {
    const [next, ...rest] = queue;
    state.pendingSerpentCharge = next;
    state.pendingSerpentChargeQueue = rest;
  } else {
    state.pendingSerpentChargeQueue = queue;
  }
}

export function resolveSerpentChargeDecision(state: GameState, playerId: string, chargeCoin: boolean): GameState {
  const pending = state.pendingSerpentCharge;
  if (!pending || pending.ownerId !== playerId) return state;
  const nextState: GameState = {
    ...state,
    players: state.players.map(player => ({ ...player })),
    log: [...state.log],
    pendingRuleNotices: [...(state.pendingRuleNotices || [])],
  };
  const [nextCharge, ...remaining] = state.pendingSerpentChargeQueue || [];
  nextState.pendingSerpentCharge = nextCharge || null;
  nextState.pendingSerpentChargeQueue = remaining;
  const owner = nextState.players.find(player => player.id === pending.ownerId);
  const mover = nextState.players.find(player => player.id === pending.moverId);
  if (!owner || !mover) return state;

  if (!chargeCoin || mover.coins <= 0) {
    nextState.log.push(`${owner.name} decide no cobrar a ${mover.name} por cruzar la ruta maritima de ${nextState.provinces[pending.fromProvinceId]?.name} a ${nextState.provinces[pending.toProvinceId]?.name} (Camino de la Serpiente)`);
    return nextState;
  }

  mover.coins -= 1;
  owner.coins += 1;
  nextState.log.push(`${owner.name} cobra 1 moneda a ${mover.name} por cruzar ruta maritima de ${nextState.provinces[pending.fromProvinceId]?.name} a ${nextState.provinces[pending.toProvinceId]?.name} (Camino de la Serpiente). Total {clanCoins:${owner.clanId}:${owner.coins}} {clanCoins:${mover.clanId}:${mover.coins}}`);
  nextState.pendingRuleNotices!.push({
    id: generateId(),
    type: 'serpent',
    actorId: owner.id,
    targetId: mover.id,
    requiredPlayerIds: nextState.players.map(player => player.id),
    acknowledgedPlayerIds: [],
    actorCoins: owner.coins,
    targetCoins: mover.coins,
    fromProvinceId: pending.fromProvinceId,
    toProvinceId: pending.toProvinceId,
    resume: nextCharge ? null : pending.resume,
  });
  return nextState;
}

function getFujinMovementPath(clanId: string, fromProvinceId: string, toProvinceId: string, figureCount: number): string[] | null {
  if (fromProvinceId === toProvinceId) return null;
  if (clanId === 'libelula') return [fromProvinceId, toProvinceId];
  if (isValidMove(fromProvinceId, toProvinceId)) return [fromProvinceId, toProvinceId];
  if (figureCount !== 1) return null;

  const fromProvince = PROVINCES_DATA.find(province => province.id === fromProvinceId);
  if (!fromProvince) return null;
  const firstStepIds = [...fromProvince.adjacentProvinces, ...fromProvince.seaRoutes];
  const intermediateId = firstStepIds.find(provinceId => isValidMove(provinceId, toProvinceId));
  return intermediateId ? [fromProvinceId, intermediateId, toProvinceId] : null;
}

export function getFujinMovementCost(
  state: GameState,
  playerId: string,
  fromProvinceId: string,
  toProvinceId: string,
  figureCount: number
): number | null {
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player || figureCount < 1 || figureCount > 2) return null;
  const path = getFujinMovementPath(player.clanId, fromProvinceId, toProvinceId, figureCount);
  if (!path) return null;
  return figureCount === 2 ? 2 : path.length - 1;
}

export function resolvePendingSerpentCrossings(
  state: GameState,
  resume: RuleEventNotice['resume'] = 'advance-kami'
): GameState {
  const crossings = state.pendingSerpentCrossings || [];
  if (crossings.length === 0) return { ...state, pendingSerpentCrossings: [] };

  const resolved: GameState = {
    ...state,
    pendingSerpentCrossings: [],
  };
  const charges = [];
  for (const crossing of crossings) {
    const fromProvince = resolved.provinces[crossing.fromProvinceId];
    if (!fromProvince?.seaRoutes.includes(crossing.toProvinceId)) continue;
    for (const owner of resolved.players) {
      if (owner.id !== crossing.moverId && playerHasCard(owner, 'su-path-of-the-serpent')) {
        charges.push({ ownerId: owner.id, moverId: crossing.moverId, fromProvinceId: crossing.fromProvinceId, toProvinceId: crossing.toProvinceId, resume });
      }
    }
  }
  const queue = [...(resolved.pendingSerpentChargeQueue || []), ...charges];
  if (!resolved.pendingSerpentCharge && queue.length > 0) {
    const [next, ...rest] = queue;
    resolved.pendingSerpentCharge = next;
    resolved.pendingSerpentChargeQueue = rest;
  } else if (queue.length > 0) {
    resolved.pendingSerpentChargeQueue = queue;
  }
  return resolved;
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

  gainCoinsFromSupply(state, winner.id, 1, 'desempate de clan Sol');
  gainVictoryPoints(state, winner.id, 1, 'desempate de clan Sol');
  for (const loserId of losers) {
    const loser = state.players.find((p) => p.id === loserId);
    if (loser) {
      if (loser.coins > 0) loser.coins -= 1;
      if (loser.victoryPoints > 0) loser.victoryPoints -= 1;
    }
  }
  state.log = [...state.log, `${winner.name} (Sol) gana 1 Moneda y 1 PV por empate y ganar en Honor a ${losers.map((id) => state.players.find((p) => p.id === id)?.name ?? id).join(', ')} que pierde 1 Moneda y 1 PV`];
}

export function calculateForce(province: Province & { figures: Figure[] }, playerId: string, state: GameState): number {
  const playerFigures = province.figures.filter((f) => f.owner === playerId);
  const raijinUnbound = state.kamiUnboundEnabled && province.figures.some(
    figure => figure.type === 'kami' && figure.kamiType === 'raijin'
  );

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
    // Raijin suppresses every figure except Bushi and manifested Kami.
    if (raijinUnbound && fig.type !== 'bushi' && fig.type !== 'kami') continue;

    // Fortresses do NOT count as force for anyone except Tortuga (handled post-loop)
    if (fig.type === 'fortress') {
      continue;
    }

    let figForce = isLuna ? 2 : 1; // Luna base force is 2, others 1

    if (fig.type === 'kami' && fig.kamiType === 'ryujin') {
      const cardTypes = new Set((player?.seasonCards || []).map(card => card.cardType));
      if (playerHasCard(player, 'sp-jurojin')) cardTypes.add('virtue');
      figForce = isLuna ? Math.max(2, cardTypes.size) : cardTypes.size;
    }

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
      // Shinto counts as Force 3 when its owner has the highest Honor among
      // the players represented in this Province.
      const representedOwners = [...new Set(province.figures.map(figure => figure.owner))];
      const ownerHonorIndex = state.honorTrack.indexOf(playerId);
      const hasHighestLocalHonor = representedOwners.every(ownerId => state.honorTrack.indexOf(ownerId) >= ownerHonorIndex);
      if (hasHighestLocalHonor) {
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
        const otherOwnerIds = ownerIds.filter(id => id !== playerId);
        const hasLowestHonor = otherOwnerIds.length > 0 && otherOwnerIds.every(id => {
          const idx = state.honorTrack.indexOf(id);
          return idx <= ownerHonorIndex;
        });
        figForce = hasLowestHonor ? 3 : 1;
        if (isLuna) figForce = Math.max(figForce, 2);
      } else if (fig.monsterCardId === 'su-oni-of-blood') {
        const ownerIds = [...new Set(province.figures.map(f => f.owner))];
        const ownerHonorIndex = state.honorTrack.indexOf(playerId);
        const otherOwnerIds = ownerIds.filter(id => id !== playerId);
        const hasLowestHonor = otherOwnerIds.length > 0 && otherOwnerIds.every(id => {
          const idx = state.honorTrack.indexOf(id);
          return idx <= ownerHonorIndex;
        });
        figForce = hasLowestHonor ? 4 : 2;
        if (isLuna) figForce = Math.max(figForce, 2);
      } else if (fig.monsterCardId === 'sp-daikokuten') {
        figForce = (state.currentPhase === 'politics' && state.harvestMandateActive) ? 8 : 1;
        if (isLuna) figForce = Math.max(figForce, 2);
      } else if (fig.monsterCardId === 'su-bishamon') {
        const hasOpponentMonster = province.figures.some(f => f.type === 'monster' && f.owner !== fig.owner);
        figForce = hasOpponentMonster ? 4 : 1;
        if (isLuna) figForce = Math.max(figForce, 2);
      } else if (fig.monsterCardId === 'au-sacred-warrior') {
        const virtueCount = player ? countVirtueCards(player) : 0;
        figForce = 1 + virtueCount;
        if (isLuna) figForce = Math.max(figForce, 2);
      } else {
        // Other monsters with defined force always use their card force
        const allCards = [...SPRING_CARDS, ...SUMMER_CARDS, ...AUTUMN_CARDS];
        const monsterCard = allCards.find(c => c.id === fig.monsterCardId);
        if (monsterCard && monsterCard.force !== undefined) {
          figForce = isLuna ? Math.max(monsterCard.force, 2) : monsterCard.force;
        }
      }
      // Fukurokuju counts as daimyo - apply daimyo bonus cards
      if (fig.monsterCardId === 'sp-fukurokuju') {
        if (hasCard(cardIds, 'sp-path-of-the-lion')) {
          figForce += 1;
        }
        if (hasCard(cardIds, 'au-path-of-the-dragon')) {
          figForce += 3;
        }
      }
    }

    totalForce += figForce;
  }

  // Tortuga clan power: each fortress in the province counts as 1 force
  if (isTortuga && !raijinUnbound) {
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
  syncKamiControllers(state);
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
  const newState: GameState = { ...state, drawnMandates: [], mandateChoicePhase: false, trainMandateActive: false, trainResolutionOrder: [], trainResolutionIndex: 0, trainMandateIssuerId: null, pendingMonsterPlacementCardId: null, pendingMonsterPlacementPlayerId: null, marshalMandateActive: false, marshalResolutionOrder: [], marshalResolutionIndex: 0, marshalMandateIssuerId: null, marshalFortressBuiltBy: [], marshalMovedFigures: [], recruitMandateActive: false, recruitResolutionOrder: [], recruitResolutionIndex: 0, recruitMandateIssuerId: null, recruitPlacementsRemaining: 0, recruitPlacementsTotal: 0, recruitUsedFortressProvinces: [], betrayMandateActive: false, betraySelectionsRemaining: 0, betraySelectedOwners: [], betrayReplacements: [], betrayMandateIssuerId: null, log: [...state.log] };
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
    newState.log = [...newState.log, '--- Turno Kami ---'];

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
            (f) => f.owner === firstWinnerId && (f.type === 'fortress' || (f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju'))
          ).length;
        });
        kamiResolutionTemples[0] = { ...kamiResolutionTemples[0], susanooVPGained: fortressCount };
      }
    }
    newState.kamiResolutionCurrentPlayerId = firstWinnerId;
    newState.kamiResolutionNextPlayerIndex = advanceToNextInSeating(referenceIdx);
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
      pendingMonsterPlacementCardId: null,
      pendingMonsterPlacementPlayerId: null,
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
      marshalKannushiUsedBy: [],
    };
  }
  // Set currentPlayerIndex to the next player in resolution order
  const nextPlayerId = state.marshalResolutionOrder[state.marshalResolutionIndex];
  const nextPlayerIdx = state.players.findIndex(p => p.id === nextPlayerId);
  if (nextPlayerIdx >= 0) {
    return prepareKannushiForCurrentMarshalPlayer({ ...state, currentPlayerIndex: nextPlayerIdx });
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
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;
  const canBuild = isIssuerOrAlly(state, playerId, state.marshalMandateIssuerId) || playerHasCard(player, 'sp-path-of-the-builder');
  if (!canBuild || state.marshalFortressBuiltBy.includes(playerId)) return state;

  // Bonsai clan power: fortress costs max 1 coin instead of 3
  const fortressCost = player.clanId === 'bonsai' ? 1 : 3;
  if (player.coins < fortressCost) return state;
  if (player.fortresses <= 0) return state;

  const province = state.provinces[provinceId];
  if (!province) return state;

  let newState: GameState = {
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
  newState = prepareBenevolence(newState, playerId, fortressCost, countCardCopies(player, 'sp-benevolence'), null);
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
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;
  const canBuild = isIssuerOrAlly(state, playerId, state.marshalMandateIssuerId) || playerHasCard(player, 'sp-path-of-the-builder');
  if (!canBuild || state.marshalFortressBuiltBy.includes(playerId)) return state;

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

  let newState: GameState = {
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
  newState = prepareBenevolence(newState, playerId, fortressCost, countCardCopies(player, 'sp-benevolence'), null);
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
    capturedHostages: [],
    hostagesTaken: 0,
    hostageLimit: 1,
    hostageVPGained: 0,
    sincerityApplied: false,
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
        result.hostageLimit = 1 + countCardCopies(state.players.find(player => player.id === highestBidder), 'su-respect');
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
