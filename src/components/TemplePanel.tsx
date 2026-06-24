import { useGameStore } from '../store/gameStore';
import { CLANS, KAMI_DATA } from '../types/game';

export const TemplePanel = () => {
  const { gameState } = useGameStore();
  if (!gameState) return null;

  if (gameState.temples.length === 0) return null;

  return (
    <div className="temple-panel">
      <h4>Temples</h4>
      <div className="temple-list">
        {gameState.temples.map(temple => {
          const kami = KAMI_DATA.find(k => k.type === temple.kamiType);
          return (
            <div key={temple.id} className="temple-card">
              <div className="temple-header">
                <span className="temple-position">Temple {temple.position}</span>
                <span className="kami-name">{kami?.name || temple.kamiType}</span>
              </div>
              <div className="kami-effect">{kami?.effect || ''}</div>
              {temple.figures.length > 0 && (
                <div className="temple-figures">
                  {temple.figures.map((fig, i) => {
                    const player = gameState.players.find(p => p.id === fig.playerId);
                    const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
                    return (
                      <span
                        key={i}
                        className="temple-figure"
                        style={{ color: clan?.color || '#666' }}
                        title={player?.name || ''}
                      >
                        &#9961;
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
