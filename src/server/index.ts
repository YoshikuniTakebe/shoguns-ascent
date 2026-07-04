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
import {
  initDatabase,
  saveGame,
  updateGameStatus,
  saveSnapshot,
  getGameById,
  getActiveGames,
  getFinishedGames,
  getSnapshots,
  getSnapshotByIndex,
  getSnapshotCount,
  getLatestSnapshot,
} from './database';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
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
  persistentGameId: string | null;
}

const lobbies = new Map<string, Lobby>();

// Initialize the database
initDatabase();

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
    persistentGameId: null,
  };
  lobbies.set(lobby.id, lobby);
  res.json({ id: lobby.id });
});

// --- Game persistence REST endpoints ---

app.get('/api/games', (req, res) => {
  const status = req.query.status as string | undefined;
  if (status === 'active') {
    res.json(getActiveGames().map(formatGame));
  } else if (status === 'finished') {
    res.json(getFinishedGames().map(formatGame));
  } else {
    const all = [...getActiveGames(), ...getFinishedGames()];
    res.json(all.map(formatGame));
  }
});

app.get('/api/games/:id', (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  res.json(formatGame(game));
});

app.get('/api/games/:id/snapshots', (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  const snapshots = getSnapshots(req.params.id);
  res.json(
    snapshots.map((s) => ({
      id: s.id,
      gameId: s.game_id,
      snapshotIndex: s.snapshot_index,
      state: JSON.parse(s.state_json),
      description: s.description,
      phase: s.phase,
      season: s.season,
      createdAt: s.created_at,
    }))
  );
});

app.get('/api/games/:id/snapshots/:index', (req, res) => {
  const index = parseInt(req.params.index, 10);
  if (isNaN(index)) {
    res.status(400).json({ error: 'Invalid snapshot index' });
    return;
  }
  const snapshot = getSnapshotByIndex(req.params.id, index);
  if (!snapshot) {
    res.status(404).json({ error: 'Snapshot not found' });
    return;
  }
  res.json({
    id: snapshot.id,
    gameId: snapshot.game_id,
    snapshotIndex: snapshot.snapshot_index,
    state: JSON.parse(snapshot.state_json),
    description: snapshot.description,
    phase: snapshot.phase,
    season: snapshot.season,
    createdAt: snapshot.created_at,
  });
});

app.get('/api/games/:id/snapshot-count', (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  res.json({ count: getSnapshotCount(req.params.id) });
});

// --- Hotseat persistence endpoints ---

app.post('/api/games/save-hotseat', (req, res) => {
  const { state } = req.body as { state: GameState };
  if (!state) {
    res.status(400).json({ error: 'Missing state in request body' });
    return;
  }
  const gameId = state.id || uuidv4();
  const players = state.players.map((p) => ({ name: p.name, clanId: p.clanId }));
  const gameName = state.gameName || `Hotseat - ${players.map((p) => p.name).join(' vs ')}`;
  const status = state.gameOver ? 'finished' : 'active';

  saveGame(gameId, gameName, players, 'hotseat', status);
  saveSnapshot(gameId, state, 'Hotseat save');

  if (state.gameOver) {
    updateGameStatus(gameId, 'finished', state.winner);
  }

  res.json({ id: gameId });
});

app.put('/api/games/:id/snapshot', (req, res) => {
  const { state } = req.body as { state: GameState };
  if (!state) {
    res.status(400).json({ error: 'Missing state in request body' });
    return;
  }
  const game = getGameById(req.params.id);
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  const description = `${state.currentPhase} - ${state.currentSeason} (round ${state.round})`;
  saveSnapshot(req.params.id, state, description);

  if (state.gameOver) {
    updateGameStatus(req.params.id, 'finished', state.winner);
  }

  res.json({ success: true });
});

function formatGame(game: { id: string; name: string; players_json: string; status: string; created_at: string; updated_at: string; mode: string; winner: string | null }) {
  const latest = getLatestSnapshot(game.id);
  let lastSeason: string | null = null;
  let lastPhase: string | null = null;
  let politicsMandateCount: number | null = null;
  let kamiResolutionIndex: number | null = null;
  let battleCount: number | null = null;
  if (latest) {
    try {
      const state = JSON.parse(latest.state_json);
      lastSeason = state.currentSeason || latest.season;
      lastPhase = state.currentPhase || latest.phase;
      politicsMandateCount = state.politicsMandateCount ?? null;
      kamiResolutionIndex = state.kamiResolutionIndex ?? null;
      battleCount = Array.isArray(state.activeBattles) ? state.activeBattles.length : null;
    } catch {
      lastSeason = latest.season;
      lastPhase = latest.phase;
    }
  }
  return {
    id: game.id,
    name: game.name,
    players: JSON.parse(game.players_json),
    status: game.status,
    createdAt: game.created_at,
    updatedAt: game.updated_at,
    mode: game.mode,
    winner: game.winner,
    lastSeason,
    lastPhase,
    politicsMandateCount,
    kamiResolutionIndex,
    battleCount,
  };
}

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

          // Persist game to database
          const persistId = l.gameState.id || uuidv4();
          l.persistentGameId = persistId;
          saveGame(
            persistId,
            l.name,
            l.players.map((p) => ({ name: p.name, clanId: p.clanId })),
            'online'
          );
          saveSnapshot(persistId, l.gameState, 'Game started');

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
  // Save snapshot to database if game is persisted
  if (l.persistentGameId && l.gameState) {
    const description = `${l.gameState.currentPhase} - ${l.gameState.currentSeason} (round ${l.gameState.round})`;
    saveSnapshot(l.persistentGameId, l.gameState, description);

    // Detect game over and mark as finished
    if (l.gameState.gameOver) {
      updateGameStatus(l.persistentGameId, 'finished', l.gameState.winner);
    }
  }

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
