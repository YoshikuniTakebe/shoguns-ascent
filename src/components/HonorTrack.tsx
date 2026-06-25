import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';

export const HonorTrack = () => {
  const { gameState } = useGameStore();
  if (!gameState) return null;

  const players = gameState.players;
  const maxHonor = Math.max(8, ...players.map(p => p.honor));

  // Sort players by honor ascending: honor 1 = best/highest position
  const sortedPlayers = [...players].sort((a, b) => a.honor - b.honor);

  return (
    <div className="honor-track">
      <div className="honor-track-title">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <polygon points="8,1 10,6 15,6 11,9 12,14 8,11 4,14 5,9 1,6 6,6" fill="#DAA520" opacity="0.9"/>
        </svg>
        <span>HONOR TRACK</span>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <polygon points="8,1 10,6 15,6 11,9 12,14 8,11 4,14 5,9 1,6 6,6" fill="#DAA520" opacity="0.9"/>
        </svg>
      </div>
      <div className="honor-track-hexagons">
        {sortedPlayers.map((player) => {
          const clan = CLANS.find(c => c.id === player.clanId);
          if (!clan) return null;
          const progressPercent = maxHonor > 0 ? ((maxHonor - player.honor + 1) / maxHonor) * 100 : 0;
          return (
            <div key={player.id} className="honor-track-entry">
              <div className="honor-hexagon" style={{ '--clan-color': clan.color } as React.CSSProperties}>
                <svg viewBox="0 0 100 100" className="hexagon-bg">
                  <polygon
                    points="50,3 93,25 93,75 50,97 7,75 7,25"
                    fill="rgba(0,0,0,0.4)"
                    stroke={clan.color}
                    strokeWidth="3"
                  />
                  <polygon
                    points="50,10 85,28 85,72 50,90 15,72 15,28"
                    fill="rgba(0,0,0,0.2)"
                    stroke={clan.color}
                    strokeWidth="1"
                    opacity="0.5"
                  />
                </svg>
                <div className="hexagon-content">
                  <ClanShield clanId={player.clanId} size={28} />
                </div>
              </div>
              <div className="honor-info">
                <span className="honor-clan-name" style={{ color: clan.color }}>
                  {clan.name}
                </span>
                <div className="honor-bar-container">
                  <div
                    className="honor-bar-fill"
                    style={{ width: `${progressPercent}%`, backgroundColor: clan.color }}
                  />
                </div>
                <span className="honor-value">{player.honor}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
