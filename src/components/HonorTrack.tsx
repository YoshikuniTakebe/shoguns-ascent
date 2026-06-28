import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';

export const HonorTrack = () => {
  const { gameState } = useGameStore();
  const [promotedPlayerId, setPromotedPlayerId] = useState<string | null>(null);
  const prevFirstRef = useRef<string | null>(null);

  // Use honorTrack ordering directly for accurate position display
  const sortedPlayers = gameState ? gameState.honorTrack.map(pid => gameState.players.find(p => p.id === pid)).filter((p): p is NonNullable<typeof p> => p != null) : [];
  const currentFirst = sortedPlayers.length > 0 ? sortedPlayers[0].id : null;

  useEffect(() => {
    if (prevFirstRef.current !== null && currentFirst !== null && prevFirstRef.current !== currentFirst) {
      setPromotedPlayerId(currentFirst);
      const timer = setTimeout(() => setPromotedPlayerId(null), 1500);
      return () => clearTimeout(timer);
    }
    prevFirstRef.current = currentFirst;
  }, [currentFirst]);

  if (!gameState) return null;

  return (
    <div className="honor-track">
      <div className="honor-track-title">
        <span>Honor</span>
      </div>
      <div className="honor-track-hexagons">
        {sortedPlayers.map((player, index) => {
          const clan = CLANS.find(c => c.id === player.clanId);
          if (!clan) return null;
          const isPromoted = player.id === promotedPlayerId;
          return (
            <div key={player.id} className={`honor-track-entry${isPromoted ? ' honor-promoted' : ''}`}>
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
                <span className="honor-value">{index + 1}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
