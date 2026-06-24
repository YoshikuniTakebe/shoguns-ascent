import type { CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
export const RegionCard = ({regionId, style}:{regionId:string;style:CSSProperties}) => {
  const { gameState, selectedRegion, selectRegion, moveMode, moveFrom, doMoveForces, localPlayerId, setMoveFrom } = useGameStore();
  if (!gameState) return null;
  const region = gameState.regions[regionId]; if (!region) return null;
  const isSelected = selectedRegion === regionId;
  const isMoveTarget = moveMode && moveFrom && moveFrom !== regionId && gameState.regions[moveFrom]?.adjacentRegions.includes(regionId);
  const handleClick = () => {
    if (moveMode && moveFrom && isMoveTarget) { const cp = gameState.players[gameState.currentPlayerIndex]; const apid = gameState.mode==='hotseat'?cp?.id:localPlayerId; if(apid){const f=gameState.regions[moveFrom].forces[apid]||0;if(f>0)doMoveForces(moveFrom,regionId,Math.min(f,2));} }
    else if (moveMode && !moveFrom) setMoveFrom(regionId);
    else selectRegion(isSelected ? null : regionId);
  };
  const forces = Object.entries(region.forces).filter(([_,c])=>c>0);
  return (
    <div className={`region-card ${isSelected?'selected':''} ${isMoveTarget?'move-target':''} ${moveMode&&moveFrom===regionId?'move-source':''}`} style={style} onClick={handleClick}>
      <div className="region-name">{region.name}</div><div className="region-reward">VP: {region.reward}</div>
      {region.hasShrine&&<div className="region-shrine">&#9961;</div>}
      <div className="region-forces">{forces.map(([pid,count])=>{const p=gameState.players.find(x=>x.id===pid);const clan=p?CLANS.find(c=>c.id===p.clanId):null;return<div key={pid} className="force-indicator" style={{backgroundColor:clan?.color||'#666'}} title={`${p?.name}: ${count}`}>{count}</div>;})}
      {forces.length===0&&<div className="empty-region">Empty</div>}</div>
    </div>
  );
};
