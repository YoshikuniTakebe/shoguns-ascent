import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createInitialGameState, moveForces, advancePlayer, advancePhase, resolveBattleBids, proposeAlliance, acceptAlliance, recruitMonster, drawThreeMandates, chooseMandateFromDrawn } from '../utils/gameLogic';
import type { GameState } from '../types/game';

const app = express(); app.use(cors()); app.use(express.json());
const server = createServer(app); const wss = new WebSocketServer({ server });
interface Lobby { id:string; name:string; host:string; players:{id:string;name:string;clanId:string;ws:WebSocket}[]; maxPlayers:number; gameState:GameState|null; started:boolean; }
const lobbies = new Map<string, Lobby>();

app.get('/api/lobbies', (_req, res) => { res.json(Array.from(lobbies.values()).map(l=>({id:l.id,name:l.name,playerCount:l.players.length,maxPlayers:l.maxPlayers,started:l.started}))); });
app.post('/api/lobbies', (req, res) => { const{name,maxPlayers}=req.body; const lobby:Lobby={id:uuidv4(),name:name||'New Game',host:'',players:[],maxPlayers:maxPlayers||5,gameState:null,started:false}; lobbies.set(lobby.id,lobby); res.json({id:lobby.id}); });

wss.on('connection', (ws: WebSocket) => {
  const playerId = uuidv4(); let currentLobbyId: string|null = null;
  ws.send(JSON.stringify({type:'PLAYER_ID',playerId}));
  ws.on('message', (raw) => { try { const data = JSON.parse(raw.toString()); switch(data.type) {
    case 'JOIN_LOBBY': { const l=lobbies.get(data.lobbyId); if(!l||l.started||l.players.length>=l.maxPlayers){ws.send(JSON.stringify({type:'ERROR',message:'Cannot join'}));return;} const clanId=data.clanId||'koi'; if(l.players.some(p=>p.clanId===clanId)){ws.send(JSON.stringify({type:'ERROR',message:'Clan already taken'}));return;} l.players.push({id:playerId,name:data.playerName||`Player ${l.players.length+1}`,clanId,ws}); if(l.players.length===1)l.host=playerId; currentLobbyId=l.id; ws.send(JSON.stringify({type:'LOBBY_JOINED',lobbyId:l.id})); broadcastLobby(l); break; }
    case 'START_GAME': { const l=lobbies.get(data.lobbyId||currentLobbyId||''); if(!l||l.host!==playerId||l.players.length<2)return; l.gameState=createInitialGameState(l.players.map(p=>({name:p.name,clanId:p.clanId})),'online',l.host); l.players.forEach((p,i)=>{if(l.gameState){l.gameState.players[i].id=p.id;l.gameState.turnOrder[i]=p.id;}}); l.started=true; l.players.forEach(p=>p.ws.send(JSON.stringify({type:'GAME_START',state:l.gameState}))); break; }
        case 'DRAW_MANDATES': { const l=lobbies.get(currentLobbyId||''); if(!l?.gameState)return; l.gameState=drawThreeMandates(l.gameState); broadcastState(l); break; }    case 'DRAW_MANDATES': { const l=lobbies.get(currentLobbyId||''); if(!l?.gameState)return; l.gameState=drawThreeMandates(l.gameState); broadcastState(l); break; }
    case 'CHOOSE_MANDATE': { const l=lobbies.get(currentLobbyId||''); if(!l?.gameState)return; let s=chooseMandateFromDrawn(l.gameState,data.payload.mandate,data.playerId); s=advancePlayer(s); l.gameState=s; broadcastState(l); break; }
    case 'MOVE': { const l=lobbies.get(currentLobbyId||''); if(!l?.gameState)return; l.gameState=moveForces(l.gameState,data.playerId,data.payload.fromRegion,data.payload.toRegion,data.payload.count); broadcastState(l); break; }
    case 'ADVANCE_PHASE': { const l=lobbies.get(currentLobbyId||''); if(!l?.gameState)return; l.gameState=advancePhase(l.gameState); broadcastState(l); break; }
    case 'BID': { const l=lobbies.get(currentLobbyId||''); if(!l?.gameState)return; const b=l.gameState.activeBattles[data.payload.battleIndex]; if(!b)return; b.bids[data.playerId]=data.payload.amount; if(b.participants.every(pid=>b.bids[pid]!==undefined))l.gameState=resolveBattleBids(l.gameState,data.payload.battleIndex); broadcastState(l); break; }
    case 'PROPOSE_ALLIANCE': { const l=lobbies.get(currentLobbyId||''); if(!l?.gameState)return; l.gameState=proposeAlliance(l.gameState,data.playerId,data.payload.toPlayerId); broadcastState(l); break; }
    case 'ACCEPT_ALLIANCE': { const l=lobbies.get(currentLobbyId||''); if(!l?.gameState)return; l.gameState=acceptAlliance(l.gameState,data.payload.fromPlayerId,data.playerId); broadcastState(l); break; }
    case 'RECRUIT_MONSTER': { const l=lobbies.get(currentLobbyId||''); if(!l?.gameState)return; l.gameState=recruitMonster(l.gameState,data.playerId,data.payload.monsterId); broadcastState(l); break; }
  }} catch(e){console.error(e);} });
  ws.on('close', () => { if(currentLobbyId){const l=lobbies.get(currentLobbyId);if(l){l.players=l.players.filter(p=>p.id!==playerId);if(l.players.length===0)lobbies.delete(currentLobbyId);else broadcastLobby(l);}} });
});

function broadcastState(l:Lobby){l.players.forEach(p=>{if(p.ws.readyState===WebSocket.OPEN)p.ws.send(JSON.stringify({type:'GAME_STATE',state:l.gameState}));});}
function broadcastLobby(l:Lobby){const s={type:'LOBBY_STATE',lobby:{id:l.id,name:l.name,host:l.host,players:l.players.map(p=>({id:p.id,name:p.name,clanId:p.clanId})),maxPlayers:l.maxPlayers,started:l.started}};l.players.forEach(p=>{if(p.ws.readyState===WebSocket.OPEN)p.ws.send(JSON.stringify(s));});}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Shogun's Ascent server on port ${PORT}`));
