import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import { BushiIcon, CoinIcon, HonorIcon, VPIcon, RoninIcon, ShintoIcon, FortressIcon } from './Icons';

export const PlayerPanel = () => {
  const { gameState, localPlayerId } = useGameStore();
  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIndex];

  return (
    <div className="player-panel">
      <h3>Players</h3>
      <div className="player-list">
        {gameState.players.map(player => {
          const clan = CLANS.find(c => c.id === player.clanId)!;
          return (
            <div
              key={player.id}
              className={`player-card ${player.id === cp?.id ? 'active' : ''} ${player.id === localPlayerId ? 'local' : ''}`}
              style={{ borderLeftColor: clan.color }}
            >
              <div className="player-header">
                <span className="player-name" style={{ color: clan.color }}>
                  <ClanShield clanId={player.clanId} size={24} />
                  {player.name}
                  {player.id === cp?.id && ' \u2B05'}
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
                  <span className="stat-value">{player.coins} coins</span>
                </div>
                <div className="stat">
                  <span className="stat-icon"><HonorIcon size={16} color={clan.color} /></span>
                  <span className="stat-value">{player.honor} honor</span>
                </div>
                <div className="stat">
                  <span className="stat-icon"><RoninIcon size={16} color={clan.color} /></span>
                  <span className="stat-value">{player.ronin} ronin</span>
                </div>
              </div>
              <div className="player-reserves">
                <span className="reserve-item" title="Bushi in reserve">
                  <BushiIcon size={24} color={clan.color} className="reserve-icon" />
                  <span className="reserve-count">{player.bushi}</span>
                </span>
                <span className="reserve-item" title="Shinto in reserve">
                  <ShintoIcon size={24} color={clan.color} className="reserve-icon" />
                  <span className="reserve-count">{player.shinto}</span>
                </span>
                <span className="reserve-item" title="Fortresses in reserve">
                  <FortressIcon size={24} color={clan.color} className="reserve-icon" />
                  <span className="reserve-count">{player.fortresses}</span>
                </span>
                {player.hasDaimyo && <span className="reserve-item daimyo-indicator">&#9813;</span>}
              </div>
              <div className="player-extras">
                {player.warProvinceTokens.length > 0 && (
                  <span className="extra-item">War Tokens: {player.warProvinceTokens.length}</span>
                )}
                {player.seasonCards.length > 0 && (
                  <span className="extra-item">Cards: {player.seasonCards.length}</span>
                )}
                {player.hostages.length > 0 && (
                  <span className="extra-item">Hostages: {player.hostages.length}</span>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
