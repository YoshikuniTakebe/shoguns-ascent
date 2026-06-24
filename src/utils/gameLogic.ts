import type { GameState, Player, Region, Season, MandateType, Battle } from '../types/game';
import { REGIONS_DATA, CLANS, SEASON_CARDS, MONSTERS, WAR_POEMS } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

export function createInitialGameState(players: { name: string; clanId: string }[], mode: 'online' | 'hotseat', hostId?: string): GameState {
  const regions: { [regionId: string]: Region } = {};
  REGIONS_DATA.forEach((r) => { regions[r.id] = { ...r, forces: {}, ronin: 0, monsters: [], hasShrine: false }; });
  regions['edo'].hasShrine = true; regions['kansai'].hasShrine = true; regions['kyushu'].hasShrine = true;
  const gamePlayers: Player[] = players.map((p, idx) => {
    const clan = CLANS.find((c) => c.id === p.clanId)!;
    const baseHonor = clan.id === 'dragonfly' ? 5 : 3;
    const baseReserve = clan.id === 'bonsai' ? 12 : 10;
    return { id: hostId && idx === 0 ? hostId : uuidv4(), name: p.name, clanId: p.clanId, coins: 5, honor: baseHonor, victoryPoints: 0, reserveForces: baseReserve, seasonCards: [], monsters: [], warPoems: [], allies: [], isReady: false };
  });
  const homeRegions = ['hokkaido', 'kyushu', 'shikoku', 'oshu', 'nagato', 'kanto'];
  gamePlayers.forEach((player, idx) => { const hr = homeRegions[idx % homeRegions.length]; regions[hr].forces[player.id] = 3; player.reserveForces -= 3; });
  return { id: uuidv4(), mode, players: gamePlayers, regions, currentSeason: 'spring', currentPhase: 'tea', currentPlayerIndex: 0, mandatesThisTurn: [], mandatesDeck: shuffleMandates(), drawnMandates: [], mandateChoicePhase: false, activeBattles: [], seasonCards: [...SEASON_CARDS], availableMonsters: [...MONSTERS], warPoems: [...WAR_POEMS], turnOrder: gamePlayers.map((p) => p.id), allianceProposals: [], politicsMandateCount: 0, maxMandates: gamePlayers.length <= 3 ? 3 : 4, round: 1, maxRounds: 3, teaTurnIndex: 0, gameOver: false, log: ['Game started! Season: Spring - Tea Ceremony Phase'], hostId };
}

function shuffleMandates(): MandateType[] {
  return shuffle<MandateType>([
    'recruit','recruit','recruit','recruit','recruit','recruit',
    'march','march','march','march','march','march',
    'train','train','train','train','train',
    'harvest','harvest','harvest','harvest','harvest','harvest',
    'betray','betray','betray','betray','betray',
  ]);
}

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr;
}

export function drawThreeMandates(state: GameState): GameState {
  const newState = { ...state, mandatesDeck: [...state.mandatesDeck] };
  // If deck is empty, reshuffle a fresh deck before drawing
  if (newState.mandatesDeck.length === 0) {
    newState.mandatesDeck = shuffleMandates();
    newState.log = [...newState.log, 'Mandate deck reshuffled'];
  }
  const currentPlayer = newState.players[newState.currentPlayerIndex];
  const isLotus = currentPlayer && CLANS.find(c => c.id === currentPlayer.clanId)?.id === 'lotus';
  const drawCount = isLotus ? 4 : 3;
  const drawn: MandateType[] = [];
  for (let i = 0; i < drawCount && newState.mandatesDeck.length > 0; i++) {
    drawn.push(newState.mandatesDeck.shift()!);
  }
  newState.drawnMandates = drawn;
  newState.mandateChoicePhase = true;
  return newState;
}

export function chooseMandateFromDrawn(state: GameState, chosenMandate: MandateType, playerId: string): GameState {
  let newState = { ...state, mandatesDeck: [...state.mandatesDeck], drawnMandates: [...state.drawnMandates] };
  const chosenIdx = newState.drawnMandates.indexOf(chosenMandate);
  if (chosenIdx === -1) return state;
  newState.drawnMandates.splice(chosenIdx, 1);
  // Return remaining mandates to top of deck
  newState.mandatesDeck = [...newState.drawnMandates, ...newState.mandatesDeck];
  newState.drawnMandates = [];
  newState.mandateChoicePhase = false;
  // Execute the chosen mandate
  newState = executeMandate(newState, chosenMandate, playerId);
  return newState;
}

export function executeMandate(state: GameState, mandate: MandateType, playerId: string): GameState {
  const newState = { ...state, players: state.players.map(p => ({...p})) };
  const player = newState.players.find((p) => p.id === playerId);
  if (!player) return state;
  newState.mandatesThisTurn = [...newState.mandatesThisTurn, { type: mandate, issuer: playerId, executed: false }];
  newState.log = [...newState.log, `${player.name} issues ${mandate.toUpperCase()} mandate`];
  switch (mandate) {
    case 'recruit': return executeRecruit(newState, playerId);
    case 'march': return newState;
    case 'train': return executeTrain(newState, playerId);
    case 'harvest': return executeHarvest(newState, playerId);
    case 'betray': return executeBetray(newState, playerId);
    default: return newState;
  }
}

function executeRecruit(state: GameState, playerId: string): GameState {
  const newState = { ...state, regions: { ...state.regions } };
  const player = newState.players.find((p) => p.id === playerId)!;
  const clan = CLANS.find((c) => c.id === player.clanId)!;
  const totalRecruit = Math.min(2 + (clan.id === 'bonsai' ? 1 : 0), player.reserveForces);
  const controlledRegions = Object.entries(newState.regions).filter(([_, r]) => (r.forces[playerId] || 0) > 0).map(([id]) => id);
  if (controlledRegions.length > 0 && totalRecruit > 0) {
    const rid = controlledRegions[0];
    newState.regions[rid] = { ...newState.regions[rid], forces: { ...newState.regions[rid].forces } };
    newState.regions[rid].forces[playerId] = (newState.regions[rid].forces[playerId] || 0) + totalRecruit;
    player.reserveForces -= totalRecruit;
  }
  player.allies.forEach((allyId) => {
    const ally = newState.players.find((p) => p.id === allyId);
    if (ally && ally.reserveForces > 0) {
      const ar = Object.entries(newState.regions).filter(([_, r]) => (r.forces[allyId] || 0) > 0).map(([id]) => id);
      if (ar.length > 0) { newState.regions[ar[0]] = { ...newState.regions[ar[0]], forces: { ...newState.regions[ar[0]].forces } }; newState.regions[ar[0]].forces[allyId] = (newState.regions[ar[0]].forces[allyId] || 0) + 1; ally.reserveForces -= 1; }
    }
  });
  return newState;
}

function executeTrain(state: GameState, playerId: string): GameState {
  const newState = { ...state }; const player = newState.players.find((p) => p.id === playerId)!;
  const cards = newState.seasonCards.filter((c) => c.season === newState.currentSeason);
  if (cards.length > 0 && player.coins >= cards[0].cost) {
    player.seasonCards = [...player.seasonCards, cards[0].id]; player.coins -= cards[0].cost;
    newState.seasonCards = newState.seasonCards.filter((c) => c.id !== cards[0].id);
    newState.log = [...newState.log, `${player.name} acquired ${cards[0].name}`];
  }
  return newState;
}

function executeHarvest(state: GameState, playerId: string): GameState {
  const newState = { ...state };
  newState.players = newState.players.map((player) => {
    const controlled = Object.values(newState.regions).filter((r) => { const pf = r.forces[player.id] || 0; return pf > 0 && pf >= Math.max(...Object.values(r.forces).map(Number), 0); });
    return { ...player, coins: player.coins + controlled.length + (player.id === playerId ? 1 : 0) };
  });
  newState.log = [...newState.log, 'All players harvest coins from their territories'];
  return newState;
}

function executeBetray(state: GameState, playerId: string): GameState {
  const newState = { ...state }; const player = newState.players.find((p) => p.id === playerId)!;
  const clan = CLANS.find((c) => c.id === player.clanId)!;
  const isFox = clan.id === 'fox';
  const stealAmount = isFox ? 2 : 1;
  const former = [...player.allies]; player.allies = [];
  former.forEach((aid) => { const ally = newState.players.find((p) => p.id === aid); if (ally) { ally.allies = ally.allies.filter((id) => id !== playerId); const stolen = Math.min(stealAmount, ally.coins); ally.coins -= stolen; player.coins += stolen; } });
  if (!isFox) { player.honor = Math.max(0, player.honor - 1); }
  newState.log = [...newState.log, `${player.name} betrays their allies!${isFox ? ' (Fox cunning: steals 2 coins, no honor loss)' : ''}`];
  return newState;
}

export function resolveBattle(state: GameState, regionId: string): GameState {
  const newState = { ...state }; const region = newState.regions[regionId];
  const combatants = Object.entries(region.forces).filter(([_, f]) => f > 0).map(([pid]) => pid);
  if (combatants.length <= 1) return newState;
  const battle: Battle = { regionId, participants: combatants, bids: {}, seppukuDecisions: {}, imperialPoetDecisions: {}, resolved: false };
  newState.activeBattles = [...newState.activeBattles, battle];
  return newState;
}

export function resolveBattleBids(state: GameState, battleIndex: number): GameState {
  const newState = { ...state, players: state.players.map(p => ({...p})), regions: { ...state.regions } };
  const battle = { ...newState.activeBattles[battleIndex] };
  if (!battle || battle.resolved) return state;
  const strengths: { [pid: string]: number } = {};
  battle.participants.forEach((pid) => { strengths[pid] = (newState.regions[battle.regionId].forces[pid] || 0) + (battle.bids[pid] || 0); });
  let maxS = -1, winnerId = '';
  Object.entries(strengths).forEach(([pid, s]) => { if (s > maxS) { maxS = s; winnerId = pid; } });
  battle.winner = winnerId; battle.resolved = true;
  battle.participants.forEach((pid) => { const p = newState.players.find((x) => x.id === pid)!; p.coins -= battle.bids[pid] || 0; });
  newState.regions[battle.regionId] = { ...newState.regions[battle.regionId], forces: { ...newState.regions[battle.regionId].forces } };
  battle.participants.forEach((pid) => { if (pid !== winnerId) { const p = newState.players.find((x) => x.id === pid)!; const clan = CLANS.find((c) => c.id === p.clanId)!; const cur = newState.regions[battle.regionId].forces[pid] || 0; const lost = clan.id === 'turtle' ? Math.max(1, cur - 1) : cur; p.reserveForces += lost; newState.regions[battle.regionId].forces[pid] = cur - lost; if (newState.regions[battle.regionId].forces[pid] <= 0) delete newState.regions[battle.regionId].forces[pid]; } });
  const winner = newState.players.find((p) => p.id === winnerId)!;
  newState.log = [...newState.log, `${winner.name} wins the battle in ${newState.regions[battle.regionId].name}!`];
  newState.activeBattles = [...newState.activeBattles]; newState.activeBattles[battleIndex] = battle;
  return newState;
}

export function advancePhase(state: GameState): GameState {
  let newState = { ...state };
  switch (newState.currentPhase) {
    case 'tea': newState.currentPhase = 'politics'; newState.currentPlayerIndex = 0; newState.log = [...newState.log, 'Politics Phase begins']; break;
    case 'politics': newState.currentPhase = 'war'; newState.drawnMandates = []; newState.mandateChoicePhase = false; newState.log = [...newState.log, 'War Phase begins']; Object.keys(newState.regions).forEach((rid) => { if (Object.entries(newState.regions[rid].forces).filter(([_, f]) => f > 0).length > 1) newState = resolveBattle(newState, rid); }); break;
    case 'war': newState.currentPhase = 'cleanup'; newState = scoreRegions(newState); newState.log = [...newState.log, 'Cleanup Phase']; break;
    case 'cleanup': newState = advanceSeason(newState); break;
  }
  return newState;
}

export function advanceTeaTurn(state: GameState): GameState {
  const newState = { ...state };
  const nextTea = newState.teaTurnIndex + 1;
  if (nextTea >= newState.players.length) {
    // All players have had their tea turn, advance to politics
    return advancePhase(newState);
  }
  newState.teaTurnIndex = nextTea;
  newState.currentPlayerIndex = nextTea;
  const cp = newState.players[newState.currentPlayerIndex];
  newState.log = [...newState.log, `${cp.name}'s turn in Tea Ceremony`];
  return newState;
}

function scoreRegions(state: GameState): GameState {
  const newState = { ...state, players: state.players.map(p => ({...p})) };
  // Determine who has highest honor for Dragonfly bonus
  const maxHonor = Math.max(...newState.players.map(p => p.honor));
  Object.values(newState.regions).forEach((region) => {
    const forces = Object.entries(region.forces).filter(([_, f]) => f > 0);
    if (forces.length === 1) {
      const [cid] = forces[0];
      const p = newState.players.find((x) => x.id === cid);
      if (p) {
        const clan = CLANS.find((c) => c.id === p.clanId)!;
        const shrineBonus = region.hasShrine && clan.id === 'turtle' ? 1 : 0;
        const honorBonus = clan.id === 'dragonfly' && p.honor >= maxHonor ? 1 : 0;
        const totalVP = region.reward + shrineBonus + honorBonus;
        p.victoryPoints += totalVP;
        newState.log = [...newState.log, `${p.name} scores ${totalVP} VP from ${region.name}`];
      }
    }
  });
  return newState;
}

function advanceSeason(state: GameState): GameState {
  const newState = { ...state }; const seasons: Season[] = ['spring', 'summer', 'autumn'];
  const idx = seasons.indexOf(newState.currentSeason);
  if (idx >= 2) { newState.gameOver = true; const maxVP = Math.max(...newState.players.map((p) => p.victoryPoints)); const w = newState.players.find((p) => p.victoryPoints === maxVP); newState.winner = w?.id; newState.log = [...newState.log, `Game Over! ${w?.name} wins with ${maxVP} VP!`]; }
  else { newState.currentSeason = seasons[idx + 1]; newState.currentPhase = 'tea'; newState.currentPlayerIndex = 0; newState.politicsMandateCount = 0; newState.mandatesDeck = shuffleMandates(); newState.drawnMandates = []; newState.mandateChoicePhase = false; newState.allianceProposals = []; newState.activeBattles = []; newState.teaTurnIndex = 0; newState.round += 1; newState.log = [...newState.log, `Season: ${newState.currentSeason.charAt(0).toUpperCase() + newState.currentSeason.slice(1)}`]; }
  return newState;
}

export function moveForces(state: GameState, playerId: string, fromRegion: string, toRegion: string, count: number): GameState {
  const newState = { ...state, regions: { ...state.regions }, players: state.players.map(p => ({...p})) };
  const from = newState.regions[fromRegion]; const to = newState.regions[toRegion];
  if (!from || !to) return state;
  const player = newState.players.find((x) => x.id === playerId);
  if (!player) return state;
  const clan = CLANS.find((c) => c.id === player.clanId);
  // Check adjacency: Koi can move 2 hops
  if (!from.adjacentRegions.includes(toRegion)) {
    if (clan?.id === 'koi') {
      // Koi can move to regions 2 hops away
      const twoHopReachable = from.adjacentRegions.some(mid => {
        const midRegion = newState.regions[mid];
        return midRegion && midRegion.adjacentRegions.includes(toRegion);
      });
      if (!twoHopReachable) return state;
    } else {
      return state;
    }
  }
  const available = from.forces[playerId] || 0; if (count > available) return state;
  newState.regions[fromRegion] = { ...from, forces: { ...from.forces } }; newState.regions[toRegion] = { ...to, forces: { ...to.forces } };
  newState.regions[fromRegion].forces[playerId] = available - count; if (newState.regions[fromRegion].forces[playerId] === 0) delete newState.regions[fromRegion].forces[playerId];
  newState.regions[toRegion].forces[playerId] = (to.forces[playerId] || 0) + count;
  newState.log = [...newState.log, `${player.name} moves ${count} forces from ${from.name} to ${to.name}`];
  return newState;
}

export function proposeAlliance(state: GameState, fromId: string, toId: string): GameState {
  const newState = { ...state }; newState.allianceProposals = [...newState.allianceProposals, { from: fromId, to: toId }];
  const from = newState.players.find((p) => p.id === fromId)!; const to = newState.players.find((p) => p.id === toId)!;
  newState.log = [...newState.log, `${from.name} proposes alliance to ${to.name}`]; return newState;
}

export function acceptAlliance(state: GameState, fromId: string, toId: string): GameState {
  const newState = { ...state, players: state.players.map(p => ({...p, allies: [...p.allies]})) };
  const from = newState.players.find((p) => p.id === fromId)!; const to = newState.players.find((p) => p.id === toId)!;
  if (!from.allies.includes(toId)) from.allies.push(toId); if (!to.allies.includes(fromId)) to.allies.push(fromId);
  newState.allianceProposals = newState.allianceProposals.filter((p) => !(p.from === fromId && p.to === toId));
  newState.log = [...newState.log, `${from.name} and ${to.name} form an alliance!`]; return newState;
}

export function recruitMonster(state: GameState, playerId: string, monsterId: string): GameState {
  const newState = { ...state, players: state.players.map(p => ({...p})) };
  const player = newState.players.find((p) => p.id === playerId)!;
  const monster = newState.availableMonsters.find((m) => m.id === monsterId);
  if (!monster || player.coins < 2) return state;
  player.coins -= 2; player.monsters = [...player.monsters, monsterId];
  newState.availableMonsters = newState.availableMonsters.filter((m) => m.id !== monsterId);
  newState.log = [...newState.log, `${player.name} recruits ${monster.name}!`]; return newState;
}

export function drawMandate(state: GameState): { state: GameState; mandate: MandateType | null } {
  const newState = { ...state }; if (newState.mandatesDeck.length === 0) return { state: newState, mandate: null };
  const [mandate, ...rest] = newState.mandatesDeck; newState.mandatesDeck = rest; return { state: newState, mandate };
}

export function getCurrentPlayer(state: GameState): Player | undefined { return state.players[state.currentPlayerIndex]; }

export function advancePlayer(state: GameState): GameState {
  const newState = { ...state }; newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length; newState.politicsMandateCount += 1;
  newState.drawnMandates = []; newState.mandateChoicePhase = false;
  if (newState.politicsMandateCount >= newState.maxMandates) return advancePhase(newState); return newState;
}
