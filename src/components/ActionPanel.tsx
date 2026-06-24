import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { MandateType } from '../types/game';
export const ActionPanel = () => {
  const { gameState, localPlayerId, moveMode, toggleMoveMode, issueMandate, doAdvancePhase, doProposeAlliance, doAcceptAlliance, doRecruitMonster } = useGameStore();
  const [showM, setShowM] = useState(false);
  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = gameState.mode === 'hotseat' || cp?.id === localPlayerId;
  const mandates: MandateType[] = ['recruit','march','train','harvest','betray'];
  const desc: Record<string,string> = { recruit:'Add forces from reserve', march:'Move forces between regions', train:'Acquire a season card', harvest:'Gain coins from regions', betray:'Break alliances, steal coins' };
  const pending = gameState.allianceProposals.filter(p => p.to === (gameState.mode==='hotseat'?cp?.id:localPlayerId) && !p.accepted);
  return (<div className="action-panel"><h3>Actions</h3>
    {gameState.currentPhase==='tea'&&<div className="tea-phase"><h4>Tea Ceremony - Alliances</h4><p className="phase-description">Form alliances. Allied players benefit from each other's mandates.</p>
      {pending.length>0&&<div className="pending-alliances"><h5>Pending:</h5>{pending.map(pr=>{const fp=gameState.players.find(p=>p.id===pr.from);return<div key={pr.from} className="alliance-proposal"><span>{fp?.name} wants alliance</span><button className="btn-small btn-accept" onClick={()=>doAcceptAlliance(pr.from)}>Accept</button></div>;})}</div>}
      {isMyTurn&&<div className="alliance-options"><h5>Propose:</h5>{gameState.players.filter(p=>p.id!==(gameState.mode==='hotseat'?cp?.id:localPlayerId)).filter(p=>!cp?.allies.includes(p.id)).map(p=>{const clan=CLANS.find(c=>c.id===p.clanId)!;return<button key={p.id} className="btn-alliance" style={{borderColor:clan.color}} onClick={()=>doProposeAlliance(p.id)}>{p.name} ({clan.name})</button>;})}</div>}
      {isMyTurn&&<button className="btn-primary advance-btn" onClick={doAdvancePhase}>End Tea Phase</button>}
    </div>}
    {gameState.currentPhase==='politics'&&isMyTurn&&<div className="politics-phase"><h4>Politics - Choose Mandate</h4><p className="phase-description">Issue a mandate all players follow.</p>
      <div className="mandate-options">{mandates.map(m=><button key={m} className={`btn-mandate mandate-${m}`} onClick={()=>issueMandate(m)}><span className="mandate-name">{m.toUpperCase()}</span><span className="mandate-desc">{desc[m]}</span></button>)}</div>
      <div className="march-controls"><button className={`btn-secondary ${moveMode?'active':''}`} onClick={toggleMoveMode}>{moveMode?'Cancel Move':'Move Forces'}</button>{moveMode&&<p className="move-instruction">Click source region, then target.</p>}</div>
    </div>}
    {gameState.currentPhase==='war'&&<div className="war-phase"><h4>War Phase</h4>{gameState.activeBattles.filter(b=>!b.resolved).length===0?<div><p>No battles.</p>{isMyTurn&&<button className="btn-primary advance-btn" onClick={doAdvancePhase}>End War</button>}</div>:<p>Resolve battles.</p>}</div>}
    {gameState.currentPhase==='cleanup'&&<div className="cleanup-phase"><h4>Cleanup</h4><p>Regions scored.</p>{isMyTurn&&<button className="btn-primary advance-btn" onClick={doAdvancePhase}>Next Season</button>}</div>}
    {gameState.availableMonsters.length>0&&gameState.currentPhase==='politics'&&isMyTurn&&<div className="monster-section"><button className="btn-secondary" onClick={()=>setShowM(!showM)}>{showM?'Hide':'Show'} Monsters ({gameState.availableMonsters.length})</button>
      {showM&&<div className="monster-list">{gameState.availableMonsters.map(m=><div key={m.id} className="monster-card"><div className="monster-name">{m.name}</div><div className="monster-power">{m.power}</div><div className="monster-stats">Force:{m.force} Combat:+{m.combatBonus}</div><button className="btn-small" onClick={()=>doRecruitMonster(m.id)} disabled={!cp||cp.coins<2}>Recruit (2 coins)</button></div>)}</div>}
    </div>}
  </div>);
};
