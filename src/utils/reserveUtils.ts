import type { Player, GameState } from '../types/game';

// Dual-type monster card IDs
export const SHINTO_MONSTER_IDS = ['sp-komainu', 'su-hotei'];
export const DAIMYO_MONSTER_IDS = ['su-yurei', 'sp-fukurokuju'];
export const FORTRESS_MONSTER_IDS = ['sp-fukurokuju'];

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
 * Includes a fallback heuristic for legacy saves where monsterCardId is undefined:
 * If a temple figure from this player has no monsterCardId, check if there is
 * an unaccounted shinto-type monster card (not on map, not already accounted for)
 * and infer it as that monster.
 */
export function getPrayingMonsterCardIds(playerId: string, gameState: GameState, deployedMonsterCardIds?: Set<string>): Set<string> {
  const deployed = deployedMonsterCardIds ?? getDeployedMonsterCardIds(playerId, gameState);
  const praying = new Set<string>();

  // First pass: collect explicitly tagged temple figures
  gameState.temples.forEach(temple => {
    temple.figures.forEach(f => {
      if (f.playerId === playerId && f.monsterCardId) {
        praying.add(f.monsterCardId);
      }
    });
  });

  // Second pass: fallback heuristic for legacy figures without monsterCardId
  // Count temple figures from this player that have NO monsterCardId
  let untaggedTempleFigureCount = 0;
  gameState.temples.forEach(temple => {
    temple.figures.forEach(f => {
      if (f.playerId === playerId && !f.monsterCardId) {
        untaggedTempleFigureCount++;
      }
    });
  });

  if (untaggedTempleFigureCount > 0) {
    // Find the player object to check their monster cards
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
      // Only shinto-type monsters (Komainu, Hotei) can pray at temples
      const shintoMonsterCards = player.seasonCards.filter(
        c => c.cardType === 'monster' && SHINTO_MONSTER_IDS.includes(c.id)
      );
      // For each shinto-type monster card that is NOT on the map and NOT already
      // accounted for in prayingMonsterCardIds, assume it is praying (legacy figure)
      for (const card of shintoMonsterCards) {
        if (untaggedTempleFigureCount <= 0) break;
        if (!deployed.has(card.id) && !praying.has(card.id)) {
          praying.add(card.id);
          untaggedTempleFigureCount--;
        }
      }
    }
  }

  return praying;
}

/**
 * Computes reserve totals for a player. This is the single source of truth
 * for all reserve-related display logic across the app.
 */
export function computeReserveTotals(player: Player, gameState: GameState) {
  const allMapFigures = Object.values(gameState.provinces).flatMap(p => p.figures.filter(f => f.owner === player.id));
  const deployedMonsterCardIds = getDeployedMonsterCardIds(player.id, gameState);
  const prayingMonsterCardIds = getPrayingMonsterCardIds(player.id, gameState, deployedMonsterCardIds);

  // All temple figures for this player (for shinto count)
  const allTempleFigures = gameState.temples.flatMap(t => t.figures.filter(f => f.playerId === player.id));

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
  const shintoOnMap = allMapFigures.filter(f => f.type === 'shinto').length;
  const shintoInTemples = allTempleFigures.length;
  const shintoReserve = player.shinto;
  const shintoTotal = shintoOnMap + shintoInTemples + shintoReserve;
  // Effective shinto reserve includes shinto-type monsters in reserve
  const effectiveShintoReserve = shintoReserve + shintoMonstersInReserve;
  const effectiveShintoTotal = shintoTotal + shintoMonstersOwned;

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
