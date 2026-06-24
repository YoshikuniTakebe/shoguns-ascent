import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
export const PlayerPanel = () => {
  const { gameState, localPlayerId } = useGameStore();
  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIndex];
  return (<div className="player-panel"><h3>Players</h3><div className="player-list">{gameState.players.map(player=>{const clan=CLANS.find(c=>c.id===player.clanId)!;return(
    <div key={player.id} className={`player-card ${player.id===cp?.id?'active':''} ${player.id===localPlayerId?'local':''}`} style={{borderLeftColor:clan.color}}>
      <div className="player-header"><span className="player-name" style={{color:clan.color}}>{player.name}{player.id===cp?.id&&' \u2B05'}</span><span className="clan-badge">{clan.name}</span></div>
      <div className="player-stats"><div className="stat"><span className="stat-icon">&#9733;</span><span className="stat-value">{player.victoryPoints} VP</span></div><div className="stat"><span className="stat-icon">&#9790;</span><span className="stat-value">{player.coins} coins</span></div><div className="stat"><span className="stat-icon">&#9876;</span><span className="stat-value">{player.honor} honor</span></div><div className="stat"><span className="stat-icon">&#9812;</span><span className="stat-value">{player.reserveForces} reserve</span></div></div>
      {player.allies.length>0&&<div className="player-allies">Allies: {player.allies.map(id=>gameState.players.find(p=>p.id===id)?.name).join(', ')}</div>}
    </div>);})}</div></div>);
};
