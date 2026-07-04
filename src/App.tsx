import { useGameStore } from './store/gameStore';
import { MainMenu } from './components/MainMenu';
import { GameBoard } from './components/GameBoard';
import { GamesLobby } from './components/GamesLobby';
import { ReplayViewer } from './components/ReplayViewer';
import './App.css';
const App = () => {
  const { screen, lobbyId, ws } = useGameStore();
  if (screen === 'lobby') return (<div className="lobby-screen"><h2>Lobby</h2><p>ID: <code>{lobbyId}</code></p><p>Share this ID to join.</p><button className="btn-primary" onClick={()=>{if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'START_GAME',lobbyId}))}}>Start</button><button className="btn-secondary" onClick={()=>useGameStore.setState({screen:'menu'})}>Leave</button></div>);
  if (screen === 'game') return <GameBoard />;
  if (screen === 'games-lobby') return <GamesLobby />;
  if (screen === 'replay') return <ReplayViewer />;
  return <MainMenu />;
};
export default App;
