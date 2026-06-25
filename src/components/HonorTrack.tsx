import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';

export const HonorTrack = () => {
  const { gameState } = useGameStore();
  if (!gameState) return null;

  const players = gameState.players;

  // Sort players by honor ascending: honor 1 = best/highest position
  const sortedPlayers = [...players].sort((a, b) => a.honor - b.honor);

  return (
    <div className="honor-track">
      <div className="honor-track-title">
        <span>Honor</span>
      </div>
      <div className="honor-track-hexagons">
        {sortedPlayers.map((player) => {
          const clan = CLANS.find(c => c.id === player.clanId);
          if (!clan) return null;
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
                <span className="honor-value">{player.honor}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
