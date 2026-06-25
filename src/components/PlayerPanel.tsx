import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';

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
                <span className="clan-badge">{clan.name}</span>
              </div>
              <div className="player-stats">
                <div className="stat">
                  <span className="stat-icon">&#9733;</span>
                  <span className="stat-value">{player.victoryPoints} VP</span>
                </div>
                <div className="stat">
                  <span className="stat-icon">&#9790;</span>
                  <span className="stat-value">{player.coins} coins</span>
                </div>
                <div className="stat">
                  <span className="stat-icon">&#9876;</span>
                  <span className="stat-value">{player.honor} honor</span>
                </div>
                <div className="stat">
                  <span className="stat-icon">&#9812;</span>
                  <span className="stat-value">{player.ronin} ronin</span>
                </div>
              </div>
              <div className="player-reserves">
                <span className="reserve-item" title="Bushi in reserve">
                  <svg className="reserve-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 20l3-3h8l3 3H5z" opacity="0.5"/>
                    <path d="M7 17l1-7h8l1 7H7z"/>
                    <path d="M9 10V7l3-4 3 4v3H9z"/>
                    <path d="M11 7h2v3h-2z" opacity="0.7"/>
                  </svg>
                  <span className="reserve-count">{player.bushi}</span>
                </span>
                <span className="reserve-item" title="Shinto in reserve">
                  <svg className="reserve-icon" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="6" width="16" height="2" rx="1"/>
                    <rect x="6" y="4" width="12" height="2" rx="0.5" opacity="0.7"/>
                    <rect x="7" y="8" width="2" height="14"/>
                    <rect x="15" y="8" width="2" height="14"/>
                    <rect x="9" y="12" width="6" height="1.5" opacity="0.5"/>
                  </svg>
                  <span className="reserve-count">{player.shinto}</span>
                </span>
                <span className="reserve-item" title="Fortresses in reserve">
                  <svg className="reserve-icon" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="18" width="18" height="3"/>
                    <rect x="5" y="12" width="14" height="6"/>
                    <rect x="4" y="11" width="16" height="2" opacity="0.7"/>
                    <rect x="7" y="6" width="10" height="6"/>
                    <rect x="6" y="5" width="12" height="2" opacity="0.7"/>
                    <rect x="10" y="2" width="4" height="4"/>
                    <rect x="9" y="1" width="6" height="2" opacity="0.7"/>
                    <rect x="10" y="14" width="4" height="4" fill="rgba(0,0,0,0.3)"/>
                  </svg>
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
              {player.allies.length > 0 && (
                <div className="player-allies">
                  Allies: {player.allies.map(id => gameState.players.find(p => p.id === id)?.name).join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
