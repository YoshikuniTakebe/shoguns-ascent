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
import { AllianceDisplay } from './AllianceDisplay';
import { PoliticsTrack } from './PoliticsTrack';

const positions: Record<string, { x: number; y: number }> = {
  hokkaido: { x: 588, y: 154 },
  oshu: { x: 572, y: 280 },
  edo: { x: 529, y: 378 },
  kanto: { x: 509, y: 415 },
  kansai: { x: 375, y: 437 },
  nagato: { x: 259, y: 397 },
  shikoku: { x: 345, y: 527 },
  kyushu: { x: 193, y: 524 },
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
        </div>
        <div className="center-panel">
          <PoliticsTrack />
          <TemplePanel />
          <div className="map-container">
            <HonorTrack />
            <AllianceDisplay />
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
              {/* Sea routes as curved paths */}
              {(() => {
                const seaRoutePaths: { from: string; to: string; path: string }[] = [
                  {
                    from: 'hokkaido',
                    to: 'shikoku',
                    path: `M ${positions.hokkaido.x} ${positions.hokkaido.y} C ${positions.hokkaido.x + 80} ${positions.hokkaido.y + 120}, ${positions.shikoku.x + 100} ${positions.shikoku.y - 180}, ${positions.shikoku.x} ${positions.shikoku.y}`,
                  },
                  {
                    from: 'nagato',
                    to: 'shikoku',
                    path: `M ${positions.nagato.x} ${positions.nagato.y} Q ${positions.nagato.x + 30} ${positions.nagato.y + 40}, ${positions.shikoku.x} ${positions.shikoku.y}`,
                  },
                  {
                    from: 'shikoku',
                    to: 'kyushu',
                    path: `M ${positions.shikoku.x} ${positions.shikoku.y} Q ${positions.shikoku.x - 60} ${positions.shikoku.y + 30}, ${positions.kyushu.x} ${positions.kyushu.y}`,
                  },
                ];
                return seaRoutePaths.map(route => (
                  <path
                    key={`sea-${route.from}-${route.to}`}
                    d={route.path}
                    fill="none"
                    stroke="rgba(80,160,220,0.5)"
                    strokeWidth="2.5"
                    strokeDasharray="6,4"
                    strokeLinecap="round"
                  />
                ));
              })()}
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
