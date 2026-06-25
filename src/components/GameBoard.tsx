import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCES_DATA } from '../types/game';
import { RegionCard } from './RegionCard';
import { PlayerPanel } from './PlayerPanel';
import { ActionPanel } from './ActionPanel';
import { BattlePanel } from './BattlePanel';
import { GameLog } from './GameLog';
import { GameOverScreen } from './GameOverScreen';
import { JapanMapBackground } from './JapanMapBackground';
import { TemplePanel } from './TemplePanel';
import { HonorTrack } from './HonorTrack';
import { PoliticsTrack } from './PoliticsTrack';

const positions: Record<string, { x: number; y: number }> = {
  hokkaido: { x: 650, y: 80 },
  oshu: { x: 600, y: 180 },
  edo: { x: 550, y: 300 },
  kanto: { x: 480, y: 250 },
  kansai: { x: 380, y: 350 },
  nagato: { x: 250, y: 420 },
  shikoku: { x: 350, y: 470 },
  kyushu: { x: 180, y: 500 },
};

export const GameBoard = () => {
  const { gameState, localPlayerId } = useGameStore();
  if (!gameState) return <div className="loading">Loading...</div>;
  if (gameState.gameOver) return <GameOverScreen />;

  const cp = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = gameState.mode === 'hotseat' || cp?.id === localPlayerId;

  const seasonColors: Record<string, string> = {
    spring: '#FFB7C5',
    summer: '#FF6B35',
    autumn: '#D4A574',
    winter: '#A8C8E8',
  };

  const phaseLabels: Record<string, string> = {
    seasonSetup: 'SEASON SETUP',
    tea: 'TEA CEREMONY',
    politics: `POLITICS (${gameState.politicsMandateCount}/${gameState.maxMandates})`,
    war: 'WAR',
    cleanup: 'CLEANUP',
    winter: 'WINTER',
  };

  return (
    <div className="game-board">
      <div className="game-header">
        <div className="season-indicator" style={{ backgroundColor: seasonColors[gameState.currentSeason] }}>
          <span className="season-name">{gameState.currentSeason.toUpperCase()}</span>
          <span className="phase-name">{phaseLabels[gameState.currentPhase] || gameState.currentPhase.toUpperCase()}</span>
        </div>
        <div className="turn-indicator">
          <span className="current-player-name" style={{ color: CLANS.find(c => c.id === cp?.clanId)?.color }}>
            {cp?.name}&apos;s Turn
          </span>
          {gameState.mode === 'hotseat' && <span className="hotseat-label">[HOTSEAT]</span>}
          {!isMyTurn && gameState.mode === 'online' && <span className="waiting-label">[WAITING]</span>}
        </div>
        <div className="mandate-counter">
          Round: {gameState.round}/{gameState.maxRounds}
        </div>
      </div>

      <div className="game-content">
        <div className="left-panel">
          <PlayerPanel />
          <HonorTrack />
        </div>
        <div className="center-panel">
          <PoliticsTrack />
          <TemplePanel />
          <div className="map-container">
            <JapanMapBackground />
            <svg viewBox="0 0 800 600" className="japan-map">
              {PROVINCES_DATA.map(r =>
                r.adjacentProvinces.map(a => {
                  if (r.id > a) return null;
                  const p1 = positions[r.id] || { x: 400, y: 300 };
                  const p2 = positions[a] || { x: 400, y: 300 };
                  return (
                    <line
                      key={`${r.id}-${a}`}
                      x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                      stroke="rgba(200,170,100,0.4)" strokeWidth="2" strokeDasharray="5,5"
                    />
                  );
                })
              )}
              {/* Sea routes in blue */}
              {PROVINCES_DATA.map(r =>
                r.seaRoutes.map(a => {
                  if (r.id > a) return null;
                  const p1 = positions[r.id] || { x: 400, y: 300 };
                  const p2 = positions[a] || { x: 400, y: 300 };
                  return (
                    <line
                      key={`sea-${r.id}-${a}`}
                      x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                      stroke="rgba(100,150,200,0.4)" strokeWidth="2" strokeDasharray="3,6"
                    />
                  );
                })
              )}
            </svg>
            <div className="regions-overlay">
              {PROVINCES_DATA.map(r => {
                const p = positions[r.id] || { x: 400, y: 300 };
                return (
                  <RegionCard
                    key={r.id}
                    regionId={r.id}
                    style={{ left: `${(p.x / 800) * 100}%`, top: `${(p.y / 600) * 100}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className="right-panel">
          {isMyTurn && gameState.activeBattles.some(b => !b.resolved) ? <BattlePanel /> : <ActionPanel />}
          <GameLog />
        </div>
      </div>
    </div>
  );
};
