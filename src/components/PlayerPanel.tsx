import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { Player, GameState } from '../types/game';
import { ClanShield } from './ClanShields';
import { BushiIcon, CoinIcon, HonorIcon, VPIcon, RoninIcon, ShintoIcon, FortressIcon, WarTokenIcon, HostageIcon, DaimyoIcon, MonsterIcon } from './Icons';
import { PlayerCardsModal } from './PlayerCardsModal';
import { WarTokensModal } from './WarTokensModal';
import { HostagesModal } from './HostagesModal';
import { useT } from '../i18n';

// Dual-type monster card IDs
const SHINTO_MONSTER_IDS = ['sp-komainu', 'su-hotei'];
// Note: Fukurokuju card text says "Counts as Daimyo and Fortress" but only daimyo tracking
// is implemented per user spec. The fortress aspect is deliberately omitted.
const DAIMYO_MONSTER_IDS = ['su-yurei', 'sp-fukurokuju'];

function computeReserveTotals(player: Player, gameState: GameState) {
  // Gather all figures on the map owned by this player
  const allMapFigures = Object.values(gameState.provinces).flatMap(p => p.figures.filter(f => f.owner === player.id));
  // Gather all figures in temples owned by this player
  const allTempleFigures = gameState.temples.flatMap(t => t.figures.filter(f => f.playerId === player.id));

  // Determine which monster cards are deployed on the map (have a figure with monsterCardId)
  const deployedMonsterCardIds = new Set<string>();
  allMapFigures.forEach(f => { if (f.type === 'monster' && f.monsterCardId) deployedMonsterCardIds.add(f.monsterCardId); });

  // Monster cards owned by the player
  const monsterCards = player.seasonCards.filter(c => c.cardType === 'monster');
  const totalMonsters = monsterCards.length;

  // Monsters in reserve = authoritative count from player state
  const monstersInReserve = player.monsters;

  // Determine which specific monster cards are in reserve (not deployed on map)
  const notOnMap = monsterCards.filter(c => !deployedMonsterCardIds.has(c.id));

  // Among notOnMap cards, some may be at temples (only Komainu can be at a temple).
  // If notOnMap count exceeds player.monsters (authoritative reserve count), the difference
  // must be at temples. The only monster that can be at a temple is Komainu (sp-komainu).
  const komainuAtTemple = notOnMap.length > player.monsters && notOnMap.some(c => c.id === 'sp-komainu');
  const monsterCardsInReserve = komainuAtTemple ? notOnMap.filter(c => c.id !== 'sp-komainu') : notOnMap;

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
  // Effective shinto reserve includes dual-type monsters in reserve
  const effectiveShintoReserve = shintoReserve + shintoMonstersInReserve;
  const effectiveShintoTotal = shintoTotal + shintoMonstersOwned;

  // Fortresses
  const fortressesOnMap = allMapFigures.filter(f => f.type === 'fortress').length;
  const fortressesReserve = player.fortresses;
  const fortressesTotal = fortressesOnMap + fortressesReserve;

  // Daimyo
  const daimyoReserve = player.hasDaimyo ? 1 : 0;
  const daimyoTotal = 1; // Always has 1 daimyo
  // Effective daimyo reserve includes dual-type monsters in reserve
  const effectiveDaimyoReserve = daimyoReserve + daimyoMonstersInReserve;
  const effectiveDaimyoTotal = daimyoTotal + daimyoMonstersOwned;

  return {
    bushi: { reserve: bushiReserve, total: bushiTotal },
    shinto: { reserve: effectiveShintoReserve, total: effectiveShintoTotal },
    fortresses: { reserve: fortressesReserve, total: fortressesTotal },
    daimyo: { reserve: effectiveDaimyoReserve, total: effectiveDaimyoTotal },
    monsters: { reserve: monstersInReserve, total: totalMonsters },
  };
}

const PlayerReserves = ({ player, gameState }: { player: Player; gameState: GameState }) => {
  const clan = CLANS.find(c => c.id === player.clanId)!;
  const totals = computeReserveTotals(player, gameState);

  return (
    <>
      <span className="reserve-item" title="Bushi">
        <BushiIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.bushi.reserve}/{totals.bushi.total}</span>
      </span>
      <span className="reserve-item" title="Shinto">
        <ShintoIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.shinto.reserve}/{totals.shinto.total}</span>
      </span>
      <span className="reserve-item" title="Fortaleza">
        <FortressIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.fortresses.reserve}/{totals.fortresses.total}</span>
      </span>
      <span className="reserve-item" title="Daimyo">
        <DaimyoIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.daimyo.reserve}/{totals.daimyo.total}</span>
      </span>
      <span className="reserve-item" title="Monstruo">
        <MonsterIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.monsters.reserve}/{totals.monsters.total}</span>
      </span>
    </>
  );
};

export const PlayerPanel = () => {
  const { gameState, localPlayerId, warPhasePopupVisible } = useGameStore();
  const t = useT();
  const [viewingCardsPlayer, setViewingCardsPlayer] = useState<Player | null>(null);
  const [viewingWarTokensPlayer, setViewingWarTokensPlayer] = useState<Player | null>(null);
  const [viewingHostagesPlayer, setViewingHostagesPlayer] = useState<Player | null>(null);
  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIndex];

  return (
    <div className="player-panel">
      <div className="player-list">
        {[...gameState.players]
          .sort((a, b) => gameState.turnOrder.indexOf(a.id) - gameState.turnOrder.indexOf(b.id))
          .map(player => {
          const clan = CLANS.find(c => c.id === player.clanId)!;
          return (
            <div
              key={player.id}
              className={`player-card ${player.id === cp?.id ? 'active' : ''} ${player.id === localPlayerId ? 'local' : ''}`}
              style={{
                borderLeftColor: clan.color,
                ...(player.id === cp?.id ? { boxShadow: `0 0 12px 3px ${clan.color}, inset 0 0 8px ${clan.color}40` } : {})
              }}
            >
              <div className="player-header">
                <span className="player-name" style={{ color: clan.color }}>
                  <ClanShield clanId={player.clanId} size={48} />
                  {player.name}
                </span>
                <span className="clan-badge" style={{ '--clan-color': clan.color } as React.CSSProperties}>{clan.name}</span>
              </div>
              <div className="player-stats">
                <div className="stat">
                  <span className="stat-icon"><VPIcon size={16} color={clan.color} /></span>
                  <span className="stat-value">{player.victoryPoints} VP</span>
                </div>
                <div className="stat">
                  <span className="stat-icon"><CoinIcon size={16} color={clan.color} /></span>
                  <span className="stat-value">{gameState.currentPhase === 'war' && !warPhasePopupVisible ? '?' : player.coins} coins</span>
                </div>
                <div className="stat">
                  <span className="stat-icon"><HonorIcon size={16} color={clan.color} /></span>
                  <span className="stat-value">{player.honor} honor</span>
                </div>
                <div className="stat">
                  <span className="stat-icon"><RoninIcon size={16} color={clan.color} /></span>
                  <span className="stat-value">{gameState.currentPhase === 'war' && !warPhasePopupVisible && player.clanId === 'koi' ? 0 : player.ronin} ronin</span>
                </div>
              </div>
              <div className="player-reserves">
                <PlayerReserves player={player} gameState={gameState} />
              </div>
              <div className="player-extras">
                {player.warProvinceTokens.length > 0 && (
                  <button
                    className="war-token-btn"
                    onClick={(e) => { e.stopPropagation(); setViewingWarTokensPlayer(player); }}
                    title={t('warTokens.title')}
                  >
                    <WarTokenIcon size={16} color={clan.color} />
                    <span className="icon-btn-badge">{player.warProvinceTokens.length}</span>
                  </button>
                )}
                {player.hostages.length > 0 && (
                  <button
                    className="hostage-btn"
                    onClick={(e) => { e.stopPropagation(); setViewingHostagesPlayer(player); }}
                    title={t('hostages.title')}
                  >
                    <HostageIcon size={16} color={clan.color} />
                    <span className="icon-btn-badge">{player.hostages.length}</span>
                  </button>
                )}
                <button
                  className="player-cards-btn"
                  style={{ borderColor: clan.color }}
                  onClick={(e) => { e.stopPropagation(); setViewingCardsPlayer(player); }}
                >
                  &#x1F3B4; {t('playerCards.button', { count: String(player.seasonCards.length) })}
                </button>
              </div>

            </div>
          );
        })}
      </div>
      {viewingCardsPlayer && (
        <PlayerCardsModal
          player={viewingCardsPlayer}
          onClose={() => setViewingCardsPlayer(null)}
        />
      )}
      {viewingWarTokensPlayer && (
        <WarTokensModal
          player={viewingWarTokensPlayer}
          onClose={() => setViewingWarTokensPlayer(null)}
        />
      )}
      {viewingHostagesPlayer && (
        <HostagesModal
          player={viewingHostagesPlayer}
          onClose={() => setViewingHostagesPlayer(null)}
        />
      )}
    </div>
  );
};
