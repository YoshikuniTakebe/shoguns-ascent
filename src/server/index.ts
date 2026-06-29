import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import {
  createInitialGameState,
  breakAllAlliances,
  proposeAlliance,
  acceptAlliance,
  drawMandateTiles,
  chooseMandateTile,
  submitWarTacticBids,
  allBidsSubmitted,
  resolveNextBattle,
  moveForces,
  advancePhase,
  advancePlayer,
  setupSeason,
  resolveKamiTurn,
  initiateWarPhase,
  resolveWinter,
  buySeasonCard,
  skipMarshalTurn,
  buildFortress,
  betraySelectFigure,
  skipBetrayTurn,
} from '../utils/gameLogic';
import type { GameState } from '../types/game';

const app = express();
app.use(cors());
app.use(express.json());
const server = createServer(app);
const wss = new WebSocketServer({ server });

interface Lobby {
  id: string;
  name: string;
  host: string;
  players: { id: string; name: string; clanId: string; ws: WebSocket }[];
  maxPlayers: number;
  gameState: GameState | null;
  started: boolean;
}

const lobbies = new Map<string, Lobby>();

app.get('/api/lobbies', (_req, res) => {
  res.json(
    Array.from(lobbies.values()).map((l) => ({
      id: l.id,
      name: l.name,
      playerCount: l.players.length,
      maxPlayers: l.maxPlayers,
      started: l.started,
    }))
  );
});

app.post('/api/lobbies', (req, res) => {
  const { name, maxPlayers } = req.body;
  const lobby: Lobby = {
    id: uuidv4(),
    name: name || 'New Game',
    host: '',
    players: [],
    maxPlayers: maxPlayers || 5,
    gameState: null,
    started: false,
  };
  lobbies.set(lobby.id, lobby);
  res.json({ id: lobby.id });
});

wss.on('connection', (ws: WebSocket) => {
  const playerId = uuidv4();
  let currentLobbyId: string | null = null;

  ws.send(JSON.stringify({ type: 'PLAYER_ID', playerId }));

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case 'JOIN_LOBBY': {
          const l = lobbies.get(data.lobbyId);
          if (!l || l.started || l.players.length >= l.maxPlayers) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Cannot join' }));
            return;
          }
          const clanId = data.clanId || 'koi';
          if (l.players.some((p) => p.clanId === clanId)) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Clan already taken' }));
            return;
          }
          l.players.push({ id: playerId, name: data.playerName || `Player ${l.players.length + 1}`, clanId, ws });
          if (l.players.length === 1) l.host = playerId;
          currentLobbyId = l.id;
          ws.send(JSON.stringify({ type: 'LOBBY_JOINED', lobbyId: l.id }));
          broadcastLobby(l);
          break;
        }

        case 'START_GAME': {
          const l = lobbies.get(data.lobbyId || currentLobbyId || '');
          if (!l || l.host !== playerId || l.players.length < 2) return;
          l.gameState = createInitialGameState(
            l.players.map((p) => ({ name: p.name, clanId: p.clanId })),
            'online',
            l.host
          );
          l.players.forEach((p, i) => {
            if (l.gameState) {
              l.gameState.players[i].id = p.id;
              l.gameState.turnOrder[i] = p.id;
            }
          });
          l.started = true;
          l.players.forEach((p) =>
            p.ws.send(JSON.stringify({ type: 'GAME_START', state: l.gameState }))
          );
          break;
        }

        case 'DRAW_MANDATE_TILES': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          l.gameState = drawMandateTiles(l.gameState);
          broadcastState(l);
          break;
        }

        case 'CHOOSE_MANDATE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const mandate = data.payload?.mandate;
          if (!mandate) return;
          let s = chooseMandateTile(l.gameState, mandate, data.playerId);
          if (!s.betrayMandateActive && !s.trainMandateActive && !s.marshalMandateActive && !s.recruitMandateActive && !s.harvestMandateActive) {
            s = advancePlayer(s);
          }
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'MOVE_FIGURE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const { fromProvinceId, toProvinceId, figureIds } = data.payload || {};
          if (!fromProvinceId || !toProvinceId || !figureIds) return;
          l.gameState = moveForces(l.gameState, data.playerId, fromProvinceId, toProvinceId, figureIds);
          broadcastState(l);
          break;
        }

        case 'SUBMIT_WAR_BIDS': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const { provinceId, tacticBids } = data.payload || {};
          if (!provinceId || !tacticBids) return;
          l.gameState = submitWarTacticBids(l.gameState, provinceId, data.playerId, tacticBids);
          // Only resolve once all participants have submitted their bids
          if (allBidsSubmitted(l.gameState, provinceId)) {
            l.gameState = resolveNextBattle(l.gameState);
          }
          broadcastState(l);
          break;
        }

        case 'FORM_ALLIANCE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const { toPlayerId, fromPlayerId, accept } = data.payload || {};
          if (accept && fromPlayerId) {
            l.gameState = acceptAlliance(l.gameState, fromPlayerId, data.playerId);
          } else if (toPlayerId) {
            l.gameState = proposeAlliance(l.gameState, data.playerId, toPlayerId);
          }
          broadcastState(l);
          break;
        }

        case 'BREAK_ALLIANCE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          l.gameState = breakAllAlliances(l.gameState);
          broadcastState(l);
          break;
        }

        case 'ADVANCE_PHASE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          l.gameState = advancePhase(l.gameState);
          broadcastState(l);
          break;
        }

        case 'SETUP_SEASON': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          l.gameState = setupSeason(l.gameState, l.gameState.currentSeason);
          broadcastState(l);
          break;
        }

        case 'RESOLVE_KAMI': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          l.gameState = resolveKamiTurn(l.gameState);
          broadcastState(l);
          break;
        }

        case 'INITIATE_WAR': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          l.gameState = initiateWarPhase(l.gameState);
          broadcastState(l);
          break;
        }

        case 'RESOLVE_BATTLE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          l.gameState = resolveNextBattle(l.gameState);
          broadcastState(l);
          break;
        }

        case 'RESOLVE_WINTER': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          l.gameState = resolveWinter(l.gameState);
          broadcastState(l);
          break;
        }

        case 'PLACE_FIGURE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          // Place figure is handled as part of recruit mandate resolution
          broadcastState(l);
          break;
        }

        case 'BUY_CARD': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const { cardId } = data.payload || {};
          if (!cardId) return;
          l.gameState = buySeasonCard(l.gameState, data.playerId, cardId);
          broadcastState(l);
          break;
        }

        case 'SKIP_MARSHAL_TURN': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          let s = skipMarshalTurn(l.gameState);
          if (!s.marshalMandateActive) {
            s = advancePlayer(s);
          }
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'BUILD_FORTRESS': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const { provinceId } = data.payload || {};
          if (!provinceId) return;
          l.gameState = buildFortress(l.gameState, data.playerId, provinceId);
          broadcastState(l);
          break;
        }

        case 'BETRAY_SELECT_FIGURE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const { figureId, provinceId } = data.payload || {};
          if (!figureId || !provinceId) return;
          let s = betraySelectFigure(l.gameState, data.playerId, figureId, provinceId);
          if (!s.betrayMandateActive) {
            s = advancePlayer(s);
          }
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'SKIP_BETRAY_TURN': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          let s = skipBetrayTurn(l.gameState);
          s = advancePlayer(s);
          l.gameState = s;
          broadcastState(l);
          break;
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  ws.on('close', () => {
    if (currentLobbyId) {
      const l = lobbies.get(currentLobbyId);
      if (l) {
        l.players = l.players.filter((p) => p.id !== playerId);
        if (l.players.length === 0) lobbies.delete(currentLobbyId);
        else broadcastLobby(l);
      }
    }
  });
});

function broadcastState(l: Lobby) {
  l.players.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({ type: 'GAME_STATE', state: l.gameState }));
    }
  });
}

function broadcastLobby(l: Lobby) {
  const s = {
    type: 'LOBBY_STATE',
    lobby: {
      id: l.id,
      name: l.name,
      host: l.host,
      players: l.players.map((p) => ({ id: p.id, name: p.name, clanId: p.clanId })),
      maxPlayers: l.maxPlayers,
      started: l.started,
    },
  };
  l.players.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify(s));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Shogun's Ascent server on port ${PORT}`));
