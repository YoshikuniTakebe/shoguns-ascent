import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
export const BattlePanel = () => {
  const { gameState, localPlayerId, doBid, doAdvancePhase } = useGameStore();
  const [bid, setBid] = useState(0);
  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIndex];
  const apid = gameState.mode==='hotseat'?cp?.id:localPlayerId;
  const active = gameState.activeBattles.filter(b=>!b.resolved);
  const resolved = gameState.activeBattles.filter(b=>b.resolved);
  if (active.length===0) return (<div className="battle-panel"><h3>War Complete</h3>{resolved.length>0&&<div className="resolved-battles"><h4>Results:</h4>{resolved.map((b,i)=>{const w=gameState.players.find(p=>p.id===b.winner);return<div key={i} className="battle-result"><span className="battle-region">{gameState.regions[b.regionId]?.name}</span><span className="battle-winner">Winner: {w?.name}</span></div>;})}</div>}<button className="btn-primary advance-btn" onClick={doAdvancePhase}>End War</button></div>);
  const battle = active[0]; const bi = gameState.activeBattles.indexOf(battle);
  const region = gameState.regions[battle.regionId];
  const hasBid = apid ? battle.bids[apid] !== undefined : false;
  const isPart = apid ? battle.participants.includes(apid) : false;
  return (<div className="battle-panel"><h3>Battle in {region?.name}</h3>
    <div className="battle-info"><h4>Combatants:</h4>{battle.participants.map(pid=>{const p=gameState.players.find(x=>x.id===pid);const clan=p?CLANS.find(c=>c.id===p.clanId):null;return<div key={pid} className="battle-combatant" style={{borderColor:clan?.color}}><span className="combatant-name" style={{color:clan?.color}}>{p?.name}</span><span className="combatant-forces">{region?.forces[pid]||0} forces</span><span className="combatant-bid-status">{battle.bids[pid]!==undefined?'Bid placed':'Waiting...'}</span></div>;})}</div>
    {isPart&&!hasBid&&<div className="bid-section"><h4>Your Bid:</h4><p className="bid-info">Higher bid = stronger. Coins spent regardless.</p><div className="bid-controls"><input type="range" min="0" max={cp?.coins||0} value={bid} onChange={e=>setBid(+e.target.value)}/><span className="bid-display">{bid} coins</span></div><button className="btn-primary" onClick={()=>{doBid(bid,bi);setBid(0);}}>Confirm</button></div>}
    {hasBid&&<div className="bid-waiting"><p>Waiting for others...</p></div>}
    {!isPart&&<div className="bid-spectator"><p>Not in this battle.</p></div>}
  </div>);
};
