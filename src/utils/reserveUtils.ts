import type { Player, GameState } from '../types/game';

// Dual-type monster card IDs
export const SHINTO_MONSTER_IDS = ['sp-komainu', 'su-hotei'];
export const DAIMYO_MONSTER_IDS = ['su-yurei', 'sp-fukurokuju'];
export const FORTRESS_MONSTER_IDS = ['sp-fukurokuju'];
export const NORMAL_SHINTO_TOTAL = 3;

/**
 * Returns the set of monsterCardIds deployed on the map by a given player.
 */
export function getDeployedMonsterCardIds(playerId: string, gameState: GameState): Set<string> {
  const deployed = new Set<string>();
  Object.values(gameState.provinces).forEach(prov => {
    prov.figures.forEach(f => {
      if (f.type === 'monster' && f.owner === playerId && f.monsterCardId) {
        deployed.add(f.monsterCardId);
      }
    });
  });
  return deployed;
}

/**
 * Returns the set of monsterCardIds praying at temples for a given player.
 * Only explicitly tagged figures count as praying monsters. Untagged figures are normal Shinto.
 */
export function getPrayingMonsterCardIds(playerId: string, gameState: GameState, _deployedMonsterCardIds?: Set<string>): Set<string> {
  const praying = new Set<string>();

  // First pass: collect explicitly tagged temple figures
  gameState.temples.forEach(temple => {
    temple.figures.forEach(f => {
      if (f.playerId === playerId && f.monsterCardId) {
        praying.add(f.monsterCardId);
      }
    });
  });

  return praying;
}

/** Normal Shinto still available, excluding dual-type monsters and repairing legacy over-counts. */
export function getAvailableNormalShintoReserve(player: Player, gameState: GameState): number {
  const normalShintoOnMap = Object.values(gameState.provinces)
    .flatMap(province => province.figures)
    .filter(figure => figure.owner === player.id && figure.type === 'shinto').length;
  const normalShintoInTemples = gameState.temples
    .flatMap(temple => temple.figures)
    .filter(figure => figure.playerId === player.id && !figure.monsterCardId).length;
  const remainingPhysicalFigures = Math.max(0, NORMAL_SHINTO_TOTAL - normalShintoOnMap - normalShintoInTemples);
  return Math.min(player.shinto, remainingPhysicalFigures);
}

/**
 * Computes reserve totals for a player. This is the single source of truth
 * for all reserve-related display logic across the app.
 */
export function computeReserveTotals(player: Player, gameState: GameState) {
  const allMapFigures = Object.values(gameState.provinces).flatMap(p => p.figures.filter(f => f.owner === player.id));
  const deployedMonsterCardIds = getDeployedMonsterCardIds(player.id, gameState);
  const prayingMonsterCardIds = getPrayingMonsterCardIds(player.id, gameState, deployedMonsterCardIds);

  // Monster cards owned by the player
  const monsterCards = player.seasonCards.filter(c => c.cardType === 'monster');
  const totalMonsters = monsterCards.length;

  // Monsters in reserve = total owned - deployed on map - praying at temples
  const monsterCardsInReserve = monsterCards.filter(c => !deployedMonsterCardIds.has(c.id) && !prayingMonsterCardIds.has(c.id));
  const monstersInReserve = monsterCardsInReserve.length;

  // Dual-type bonus counts for secondary types (only when monster is in reserve)
  const shintoMonstersInReserve = monsterCardsInReserve.filter(c => SHINTO_MONSTER_IDS.includes(c.id)).length;
  const daimyoMonstersInReserve = monsterCardsInReserve.filter(c => DAIMYO_MONSTER_IDS.includes(c.id)).length;
  // Dual-type bonus counts for ALL owned monsters (for total computation)
  const shintoMonstersOwned = monsterCards.filter(c => SHINTO_MONSTER_IDS.includes(c.id)).length;
  const daimyoMonstersOwned = monsterCards.filter(c => DAIMYO_MONSTER_IDS.includes(c.id)).length;

  // Bushi
  const bushiOnMap = allMapFigures.filter(f => f.type === 'bushi').length;
  const bushiReserve = player.bushi;
  const bushiTotal = bushiOnMap + bushiReserve;

  // Shinto
  const shintoReserve = getAvailableNormalShintoReserve(player, gameState);
  // Effective shinto reserve includes shinto-type monsters in reserve
  const effectiveShintoReserve = shintoReserve + shintoMonstersInReserve;
  const effectiveShintoTotal = NORMAL_SHINTO_TOTAL + shintoMonstersOwned;

  // Fortresses
  const fortressMonstersOwned = monsterCards.filter(c => FORTRESS_MONSTER_IDS.includes(c.id)).length;
  const fortressMonstersInReserve = monsterCardsInReserve.filter(c => FORTRESS_MONSTER_IDS.includes(c.id)).length;

  const fortressesOnMap = allMapFigures.filter(f => f.type === 'fortress').length;
  const fortressesReserve = player.fortresses;
  const effectiveFortressReserve = fortressesReserve + fortressMonstersInReserve;
  const effectiveFortressTotal = fortressesOnMap + fortressesReserve + fortressMonstersOwned;

  // Daimyo
  const daimyoReserve = player.hasDaimyo ? 1 : 0;
  const daimyoTotal = 1; // Always has 1 daimyo
  // Effective daimyo reserve includes daimyo-type monsters in reserve
  const effectiveDaimyoReserve = daimyoReserve + daimyoMonstersInReserve;
  const effectiveDaimyoTotal = daimyoTotal + daimyoMonstersOwned;

  return {
    bushi: { reserve: bushiReserve, total: bushiTotal },
    shinto: { reserve: effectiveShintoReserve, total: effectiveShintoTotal },
    fortresses: { reserve: effectiveFortressReserve, total: effectiveFortressTotal },
    daimyo: { reserve: effectiveDaimyoReserve, total: effectiveDaimyoTotal },
    monsters: { reserve: monstersInReserve, total: totalMonsters },
    // Expose computed details for ActionPanel recruit logic
    monsterCardsInReserve,
    deployedMonsterCardIds,
    prayingMonsterCardIds,
  };
}
