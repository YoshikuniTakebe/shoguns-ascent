import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
export const GameLog = () => {
  const { gameState } = useGameStore(); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [gameState?.log]);
  if (!gameState) return null;
  return (<div className="game-log"><h4>Game Log</h4><div className="log-entries" ref={ref}>{gameState.log.slice(-20).map((e,i)=><div key={i} className="log-entry">{e}</div>)}</div></div>);
};
