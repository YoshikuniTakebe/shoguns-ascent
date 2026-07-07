import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { URL } from 'url';
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
  shouldEndTeaPhase,
  recruitPlaceFigure,
  skipRecruitTurn,
  skipTrainPurchase,
  advanceTrainResolution,
  advanceHarvestResolution,
  lotoChooseActualMandate,
  resolveCurrentKamiReward,
  advanceKamiResolution,
  ryujinBuyCard as ryujinBuyCardFn,
  resolveUncontestedBattles,
  calculateForce,
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
  createUser,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  addGamePlayer,
  getGamesByUserId,
  getGamePlayersByGameId,
  deleteGame,
  purgeOrphanGames,
  getGamePasswordHash,
} from './database';
import { generateToken, verifyToken } from './auth';
import bcrypt from 'bcryptjs';

const app = express();

// Manual CORS middleware for Express 5 compatibility
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.json({ limit: '50mb' }));
const server = createServer(app);
const wss = new WebSocketServer({ server });

interface LobbyConfig {
  availableClans: string[];
  deckConfig: { chosenDeck: string; extraMonsters: 0 | 1 | 2; selectedKami?: string[] };
  kamiMode: 'random' | 'manual';
  selectedKami?: string[];
  autoAssignClan?: boolean;
}

interface Lobby {
  id: string;
  name: string;
  host: string;
  players: { id: string; name: string; clanId: string; ws: WebSocket }[];
  maxPlayers: number;
  gameState: GameState | null;
  started: boolean;
  persistentGameId: string | null;
  config: LobbyConfig | null;
}

const lobbies = new Map<string, Lobby>();

// Initialize the database
initDatabase();

// --- Auth endpoints ---

app.post('/api/auth/register', async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    res.status(400).json({ error: 'Email, username, and password are required' });
    return;
  }

  // Basic email format validation: must contain @ with a dot after it
  const atIndex = email.indexOf('@');
  if (atIndex < 1 || email.indexOf('.', atIndex) === -1) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  if (username.length < 3) {
    res.status(400).json({ error: 'Username must be at least 3 characters' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const existingUsername = getUserByUsername(username);
  if (existingUsername) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const existingEmail = getUserByEmail(email);
  if (existingEmail) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser(email, username, passwordHash);
  const token = generateToken(user.id);

  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, isAdmin: !!user.is_admin },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const user = getUserByUsername(username);
  if (!user) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const token = generateToken(user.id);

  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, isAdmin: !!user.is_admin },
  });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const user = getUserById(payload.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  res.json({ user: { id: user.id, username: user.username, email: user.email, isAdmin: !!user.is_admin } });
});

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
    config: null,
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

app.get('/api/games/my-games', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const games = getGamesByUserId(payload.userId);
  res.json(games.map(formatGame));
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
  const { state, password } = req.body as { state: GameState; password?: string };
  if (!state) {
    res.status(400).json({ error: 'Missing state in request body' });
    return;
  }
  const gameId = state.id || uuidv4();
  const players = state.players.map((p) => ({ name: p.name, clanId: p.clanId }));
  const gameName = state.gameName || `Hotseat - ${players.map((p) => p.name).join(' vs ')}`;
  const status = state.gameOver ? 'finished' : 'active';

  saveGame(gameId, gameName, players, 'hotseat', status, password);
  saveSnapshot(gameId, state, 'Hotseat save');

  if (state.gameOver) {
    updateGameStatus(gameId, 'finished', state.winner);
  }

  res.json({ id: gameId });
});

app.get('/api/games/:id/has-password', (req, res) => {
  const hash = getGamePasswordHash(req.params.id);
  res.json({ hasPassword: !!hash });
});

app.post('/api/games/:id/verify-password', async (req, res) => {
  const { password } = req.body as { password: string };
  if (!password) {
    res.status(400).json({ error: 'Missing password' });
    return;
  }
  const hash = getGamePasswordHash(req.params.id);
  if (!hash) {
    res.json({ valid: true });
    return;
  }
  const valid = await bcrypt.compare(password, hash);
  res.json({ valid });
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

// --- Admin endpoints ---

app.delete('/api/games/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const user = getUserById(payload.userId);
  if (!user || !user.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const game = getGameById(req.params.id);
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  deleteGame(req.params.id);
  res.json({ success: true, message: 'Game deleted' });
});

app.post('/api/admin/purge-orphan-games', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const user = getUserById(payload.userId);
  if (!user || !user.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const count = purgeOrphanGames();
  res.json({ success: true, purgedCount: count, message: `Purged ${count} orphan game(s)` });
});

function formatGame(game: { id: string; name: string; players_json: string; status: string; created_at: string; updated_at: string; mode: string; winner: string | null }) {
  const latest = getLatestSnapshot(game.id);
  let lastSeason: string | null = null;
  let lastPhase: string | null = null;
  let politicsMandateCount: number | null = null;
  let kamiResolutionIndex: number | null = null;
  let battleCount: number | null = null;
  let currentPlayerIndex: number | null = null;
  if (latest) {
    try {
      const state = JSON.parse(latest.state_json);
      lastSeason = state.currentSeason || latest.season;
      lastPhase = state.currentPhase || latest.phase;
      politicsMandateCount = state.politicsMandateCount ?? null;
      kamiResolutionIndex = state.kamiResolutionIndex ?? null;
      battleCount = Array.isArray(state.activeBattles) ? state.activeBattles.length : null;
      currentPlayerIndex = state.currentPlayerIndex ?? null;
    } catch {
      lastSeason = latest.season;
      lastPhase = latest.phase;
    }
  }

  // Enrich players with userId from game_players table
  const basePlayers: { name: string; clanId: string }[] = JSON.parse(game.players_json);
  const gamePlayers = getGamePlayersByGameId(game.id);
  const enrichedPlayers = basePlayers.map((p) => {
    const gp = gamePlayers.find((gp) => gp.clan_id === p.clanId);
    return { name: p.name, clanId: p.clanId, userId: gp?.user_id || null };
  });

  return {
    id: game.id,
    name: game.name,
    players: enrichedPlayers,
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
    currentPlayerIndex,
  };
}

function startLobbyGame(l: Lobby): void {
  const deckConfig = l.config?.deckConfig || { chosenDeck: 'random' as const, extraMonsters: 0 as const };
  l.gameState = createInitialGameState(
    l.players.map((p) => ({ name: p.name, clanId: p.clanId })),
    'online',
    l.host,
    deckConfig as import('../types/game').DeckConfig
  );
  if (l.gameState) {
    // Match lobby players to game state players by clanId (game state is honor-sorted)
    // Build a map from old auto-generated IDs to lobby player IDs
    const idMap = new Map<string, string>();
    for (let i = 0; i < l.gameState.players.length; i++) {
      const gamePlayer = l.gameState.players[i];
      const lobbyPlayer = l.players.find(p => p.clanId === gamePlayer.clanId);
      if (lobbyPlayer) {
        idMap.set(gamePlayer.id, lobbyPlayer.id);
        gamePlayer.id = lobbyPlayer.id;
      }
    }
    // Remap turnOrder using idMap (preserves honor-sorted order)
    l.gameState.turnOrder = l.gameState.turnOrder.map(pid => idMap.get(pid) || pid);
    // Update honorTrack to use lobby player IDs
    l.gameState.honorTrack = l.gameState.honorTrack.map(pid => idMap.get(pid) || pid);
    // Update figure owners in provinces to use lobby player IDs
    for (const provinceId of Object.keys(l.gameState.provinces)) {
      const province = l.gameState.provinces[provinceId];
      for (const figure of province.figures) {
        const newId = idMap.get(figure.owner);
        if (newId) figure.owner = newId;
      }
    }
    // Update temple figures to use lobby player IDs (defensive for future safety)
    for (const temple of l.gameState.temples) {
      for (const fig of temple.figures) {
        const newId = idMap.get(fig.playerId);
        if (newId) fig.playerId = newId;
      }
    }
  }
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

  // Persist player-to-game associations
  for (const p of l.players) {
    addGamePlayer(persistId, p.id, p.clanId);
  }

  l.players.forEach((p) =>
    p.ws.send(JSON.stringify({ type: 'GAME_START', state: l.gameState }))
  );
}

wss.on('connection', (ws: WebSocket, req) => {
  // Authenticate via token query parameter
  let userId: string | null = null;
  let authenticatedUsername: string | null = null;
  let playerId = uuidv4();

  try {
    const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = reqUrl.searchParams.get('token');
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        const user = getUserById(payload.userId);
        if (user) {
          userId = user.id;
          authenticatedUsername = user.username;
          playerId = user.id; // Use user ID as player ID
        }
      }
      // Token was provided but verification failed - notify the client
      if (!userId) {
        ws.send(JSON.stringify({ type: 'AUTH_WARNING', message: 'Token is invalid or expired. You are connected as a guest.' }));
      }
    }
  } catch {
    // Ignore URL parsing errors, continue as anonymous
  }

  let currentLobbyId: string | null = null;

  ws.send(JSON.stringify({ type: 'PLAYER_ID', playerId }));

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case 'CREATE_LOBBY': {
          const lobbyId = uuidv4();
          const availableClans: string[] = data.availableClans || [];
          const hostClanId: string = data.clanId || '';
          const config: LobbyConfig = {
            availableClans,
            deckConfig: data.deckConfig || { chosenDeck: 'random', extraMonsters: 0 },
            kamiMode: data.kamiMode || 'random',
            selectedKami: data.selectedKami,
            autoAssignClan: data.autoAssignClan || false,
          };
          // Validate host clan is within available clans
          if (availableClans.length > 0 && hostClanId && !availableClans.includes(hostClanId)) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Host clan not in available clans' }));
            return;
          }
          // Validate maxPlayers does not exceed available clans when autoAssignClan is enabled
          if (config.autoAssignClan && availableClans.length > 0 && (data.maxPlayers || 5) > availableClans.length) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'maxPlayers exceeds available clans count' }));
            return;
          }
          const playerName = authenticatedUsername || data.playerName || 'Host';
          const l: Lobby = {
            id: lobbyId,
            name: playerName ? `${playerName}'s game` : 'New Game',
            host: playerId,
            players: [{ id: playerId, name: playerName, clanId: hostClanId, ws }],
            maxPlayers: data.maxPlayers || 5,
            gameState: null,
            started: false,
            persistentGameId: null,
            config,
          };
          lobbies.set(lobbyId, l);
          currentLobbyId = lobbyId;
          ws.send(JSON.stringify({ type: 'LOBBY_CREATED', lobbyId }));
          broadcastLobby(l);
          break;
        }

        case 'JOIN_LOBBY': {
          const l = lobbies.get(data.lobbyId);
          if (!l) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Lobby not found' }));
            return;
          }
          if (l.started || l.players.length >= l.maxPlayers) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Cannot join' }));
            return;
          }
          const joinPlayerName = authenticatedUsername || data.playerName || `Player ${l.players.length + 1}`;
          const newPlayer = { id: playerId, name: joinPlayerName, clanId: '', ws };
          l.players.push(newPlayer);
          currentLobbyId = l.id;

          // Auto-assign clan if autoAssignClan is enabled
          if (l.config?.autoAssignClan) {
            const takenClans = l.players.filter(p => p.clanId !== '').map(p => p.clanId);
            const availableForAssign = (l.config.availableClans || []).filter(c => !takenClans.includes(c));
            if (availableForAssign.length > 0) {
              const randomIndex = Math.floor(Math.random() * availableForAssign.length);
              newPlayer.clanId = availableForAssign[randomIndex];
            }
          }

          ws.send(JSON.stringify({ type: 'LOBBY_JOINED', lobbyId: l.id }));
          broadcastLobby(l);

          // Check if all players have clans and lobby is full, then start game
          if (l.config?.autoAssignClan) {
            const allHaveClans = l.players.length >= l.maxPlayers && l.players.every(p => p.clanId !== '');
            if (allHaveClans) {
              startLobbyGame(l);
            }
          }
          break;
        }

        case 'SELECT_CLAN': {
          const l = lobbies.get(data.lobbyId || currentLobbyId || '');
          if (!l) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Lobby not found' }));
            return;
          }
          const clanId = data.clanId;
          if (!clanId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'No clan specified' }));
            return;
          }
          // Validate clan is in available clans
          if (l.config && l.config.availableClans.length > 0 && !l.config.availableClans.includes(clanId)) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Clan not available' }));
            return;
          }
          // Validate clan is not already taken
          if (l.players.some(p => p.clanId === clanId)) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Clan already taken' }));
            return;
          }
          // Assign clan to the requesting player
          const player = l.players.find(p => p.id === playerId);
          if (!player) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Player not in lobby' }));
            return;
          }
          player.clanId = clanId;
          broadcastLobby(l);

          // Check if all players have selected a clan and lobby is full
          const allHaveClans = l.players.length >= l.maxPlayers && l.players.every(p => p.clanId !== '');
          if (allHaveClans) {
            startLobbyGame(l);
          }
          break;
        }

        case 'START_GAME': {
          const l = lobbies.get(data.lobbyId || currentLobbyId || '');
          if (!l || l.host !== playerId || l.players.length < 2) return;
          // Validate all players have a clan assigned
          if (l.players.some(p => p.clanId === '')) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'All players must select a clan before starting' }));
            return;
          }
          startLobbyGame(l);
          break;
        }

        case 'TEA_ADVANCE_PLAYER': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (l.gameState.currentPhase !== 'tea') return;
          // Only use turn-based advancement for hotseat-style flow (not simultaneous online tea)
          if (l.gameState.mode === 'online') return;
          l.gameState = advancePlayer(l.gameState);
          broadcastState(l);
          break;
        }

        case 'DRAW_MANDATE_TILES': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (l.gameState.currentPhase !== 'politics') {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Cannot draw mandate tiles outside of politics phase' }));
            return;
          }
          // Validate that the requesting player is the current player
          const currentPlayer = l.gameState.players[l.gameState.currentPlayerIndex];
          if (currentPlayer && currentPlayer.id !== playerId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'It is not your turn to draw mandate tiles' }));
            return;
          }
          l.gameState = drawMandateTiles(l.gameState);
          broadcastState(l);
          break;
        }

        case 'CHOOSE_MANDATE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const mandate = data.payload?.mandate;
          if (!mandate) return;
          // Validate that the requesting player is the current player
          const choosingPlayer = l.gameState.players[l.gameState.currentPlayerIndex];
          if (choosingPlayer && choosingPlayer.id !== playerId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'It is not your turn to choose a mandate' }));
            return;
          }
          let s = chooseMandateTile(l.gameState, mandate, playerId);
          if (!s.lotoChoicePhase && !s.betrayMandateActive && !s.trainMandateActive && !s.marshalMandateActive && !s.recruitMandateActive && !s.harvestMandateActive) {
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
            // After accepting an alliance during tea phase, advance the player's turn
            if (l.gameState.currentPhase === 'tea') {
              l.gameState = advancePlayer(l.gameState);
            }
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

        case 'TEA_PROPOSE_ALLIANCE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (l.gameState.currentPhase !== 'tea') return;
          const { toPlayerId: teaPropTo, bribeAmount: teaPropBribe, requestAmount: teaPropRequest } = data.payload || {};
          const fromId = data.playerId;
          if (!fromId || !teaPropTo) return;
          // Validate sender is unallied and not opted out
          const sender = l.gameState.players.find(p => p.id === fromId);
          const target = l.gameState.players.find(p => p.id === teaPropTo);
          if (!sender || !target) return;
          if (sender.allies.length > 0 || target.allies.length > 0) return;
          if (l.gameState.teaOptedOut.includes(fromId) || l.gameState.teaOptedOut.includes(teaPropTo)) return;
          l.gameState = proposeAlliance(l.gameState, fromId, teaPropTo, teaPropBribe || 0, teaPropRequest || 0);
          // If proposeAlliance auto-accepted (reverse proposal existed), check if tea should end
          const updatedSender = l.gameState.players.find(p => p.id === fromId);
          if (updatedSender && updatedSender.allies.length > 0 && shouldEndTeaPhase(l.gameState)) {
            l.gameState = advancePhase(l.gameState);
          }
          broadcastState(l);
          break;
        }

        case 'TEA_ACCEPT_ALLIANCE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (l.gameState.currentPhase !== 'tea') return;
          const { fromPlayerId: teaAccFrom } = data.payload || {};
          const acceptingId = data.playerId;
          if (!teaAccFrom || !acceptingId) return;
          l.gameState = acceptAlliance(l.gameState, teaAccFrom, acceptingId);
          if (shouldEndTeaPhase(l.gameState)) {
            l.gameState = advancePhase(l.gameState);
          }
          broadcastState(l);
          break;
        }

        case 'TEA_REJECT_ALLIANCE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (l.gameState.currentPhase !== 'tea') return;
          const { fromPlayerId: teaRejFrom } = data.payload || {};
          const rejectingId = data.playerId;
          if (!teaRejFrom || !rejectingId) return;
          // Remove proposal from the specified sender to the rejecting player
          l.gameState = {
            ...l.gameState,
            allianceProposals: l.gameState.allianceProposals.filter(
              ap => !(ap.from === teaRejFrom && ap.to === rejectingId)
            ),
          };
          if (shouldEndTeaPhase(l.gameState)) {
            l.gameState = advancePhase(l.gameState);
          }
          broadcastState(l);
          break;
        }

        case 'TEA_OPT_OUT': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (l.gameState.currentPhase !== 'tea') return;
          const optOutId = data.playerId;
          if (!optOutId) return;
          // Only opt out if not already opted out and not already allied
          const optPlayer = l.gameState.players.find(p => p.id === optOutId);
          if (!optPlayer || optPlayer.allies.length > 0) return;
          if (l.gameState.teaOptedOut.includes(optOutId)) return;
          // Add to teaOptedOut and remove all proposals to/from this player
          l.gameState = {
            ...l.gameState,
            teaOptedOut: [...l.gameState.teaOptedOut, optOutId],
            allianceProposals: l.gameState.allianceProposals.filter(
              ap => ap.from !== optOutId && ap.to !== optOutId
            ),
          };
          if (shouldEndTeaPhase(l.gameState)) {
            l.gameState = advancePhase(l.gameState);
          }
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
          // In online mode, require all players to be ready before starting the season
          if (l.gameState.mode === 'online' && l.gameState.teaReadyPlayers.length < l.gameState.players.length) return;
          l.gameState = setupSeason(l.gameState, l.gameState.currentSeason);
          broadcastState(l);
          break;
        }

        case 'TEA_READY': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!playerId) return;
          if (!l.gameState.teaReadyPlayers.includes(playerId)) {
            l.gameState = { ...l.gameState, teaReadyPlayers: [...l.gameState.teaReadyPlayers, playerId] };
          }
          // Check if all players are ready
          if (l.gameState.teaReadyPlayers.length >= l.gameState.players.length) {
            l.gameState = setupSeason(l.gameState, l.gameState.currentSeason);
          }
          broadcastState(l);
          break;
        }

        case 'KAMI_PHASE_READY': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!playerId) return;
          if (!l.gameState.kamiReadyPlayers.includes(playerId)) {
            l.gameState = { ...l.gameState, kamiReadyPlayers: [...l.gameState.kamiReadyPlayers, playerId] };
          }
          if (l.gameState.kamiReadyPlayers.length >= l.gameState.players.length) {
            l.gameState = { ...l.gameState, kamiResolutionActive: true, kamiPhasePopupPending: false, kamiReadyPlayers: [] };
          }
          broadcastState(l);
          break;
        }

        case 'KAMI_SUMMARY_READY': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!playerId) return;
          if (!l.gameState.kamiSummaryReadyPlayers.includes(playerId)) {
            l.gameState = { ...l.gameState, kamiSummaryReadyPlayers: [...l.gameState.kamiSummaryReadyPlayers, playerId] };
          }
          if (l.gameState.kamiSummaryReadyPlayers.length >= l.gameState.players.length) {
            l.gameState = { ...l.gameState, kamiSummaryVisible: false, kamiSummaryData: [], kamiSummaryReadyPlayers: [] };
          }
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

        case 'ZORRO_PLACE_BUSHI': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.zorroPlacementActive) return;
          if (data.playerId !== l.gameState.zorroPlacementPlayerId) return;
          const { provinceId: zpProvinceId } = data.payload || {};
          if (!zpProvinceId) return;

          const zorroPlayer = l.gameState.players.find(p => p.id === data.playerId);
          if (!zorroPlayer) return;

          // Validate: province must be a battle province where Zorro has no figures
          const isBattleProvince = l.gameState.warProvinceSlots.some(s => s.provinceId === zpProvinceId);
          if (!isBattleProvince) return;
          const zpProvince = l.gameState.provinces[zpProvinceId];
          if (!zpProvince) return;
          const hasOwnFigure = zpProvince.figures.some(f => f.owner === data.playerId && f.type !== 'fortress');
          if (hasOwnFigure) return;
          if (zorroPlayer.bushi <= 0) return;
          if (l.gameState.zorroPlacementsRemaining <= 0) return;

          // Place bushi
          const newPlayers = l.gameState.players.map(p => {
            if (p.id === data.playerId) return { ...p, bushi: p.bushi - 1 };
            return p;
          });
          const newFigure = { type: 'bushi' as const, owner: data.playerId, id: `fig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
          const newProvinces = {
            ...l.gameState.provinces,
            [zpProvinceId]: { ...zpProvince, figures: [...zpProvince.figures, newFigure] },
          };
          const newRemaining = l.gameState.zorroPlacementsRemaining - 1;
          l.gameState = {
            ...l.gameState,
            players: newPlayers,
            provinces: newProvinces,
            zorroPlacementsRemaining: newRemaining,
            log: [...l.gameState.log, `${zorroPlayer.name} (Zorro) coloca 1 Bushi en ${zpProvince.name}`],
          };

          // Auto-end Zorro placement when remaining reaches 0
          if (newRemaining === 0) {
            const zorroId = l.gameState.zorroPlacementPlayerId;
            l.gameState = {
              ...l.gameState,
              zorroPlacementActive: false,
              zorroPlacementPlayerId: null,
              zorroPlacementsRemaining: 0,
            };
            // Update battle participants to include Zorro in provinces where they now have figures
            if (zorroId) {
              l.gameState = {
                ...l.gameState,
                activeBattles: l.gameState.activeBattles.map(b => {
                  const prov = l.gameState!.provinces[b.provinceId];
                  const hasFigures = prov?.figures.some(f => f.owner === zorroId);
                  if (hasFigures && !b.participants.includes(zorroId)) {
                    const participants = [...b.participants, zorroId].sort((a, bb) => {
                      const aIdx = l.gameState!.turnOrder.indexOf(a);
                      const bIdx = l.gameState!.turnOrder.indexOf(bb);
                      return aIdx - bIdx;
                    });
                    return { ...b, participants, uncontested: false, winner: undefined };
                  }
                  return b;
                }),
              };
            }
          }

          broadcastState(l);
          break;
        }

        case 'ZORRO_SKIP_PLACEMENT': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.zorroPlacementActive) return;
          if (data.playerId !== l.gameState.zorroPlacementPlayerId) return;

          const zorroId = l.gameState.zorroPlacementPlayerId;
          let zpState: GameState = {
            ...l.gameState,
            zorroPlacementActive: false,
            zorroPlacementPlayerId: null,
            zorroPlacementsRemaining: 0,
          };

          // Update battle participants to include Zorro in provinces where they now have figures
          if (zorroId) {
            zpState = {
              ...zpState,
              activeBattles: zpState.activeBattles.map(b => {
                const prov = zpState.provinces[b.provinceId];
                const hasFigures = prov?.figures.some(f => f.owner === zorroId);
                if (hasFigures && !b.participants.includes(zorroId)) {
                  const participants = [...b.participants, zorroId].sort((a, bb) => {
                    const aIdx = zpState.turnOrder.indexOf(a);
                    const bIdx = zpState.turnOrder.indexOf(bb);
                    return aIdx - bIdx;
                  });
                  return { ...b, participants, uncontested: false, winner: undefined };
                }
                return b;
              }),
            };
          }
          l.gameState = zpState;
          broadcastState(l);
          break;
        }

        case 'WAR_PHASE_READY': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!playerId) return;
          if (!l.gameState.warPhaseReadyPlayers.includes(playerId)) {
            l.gameState = { ...l.gameState, warPhaseReadyPlayers: [...l.gameState.warPhaseReadyPlayers, playerId] };
          }
          if (l.gameState.warPhaseReadyPlayers.length >= l.gameState.players.length) {
            // All players accepted war summary - resolve uncontested battles and clear
            l.gameState = resolveUncontestedBattles(l.gameState);
            l.gameState = { ...l.gameState, warPhaseReadyPlayers: [] };
          }
          broadcastState(l);
          break;
        }

        case 'BATTLE_RESULT_ACCEPTED': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!playerId) return;
          if (!l.gameState.battleResultReadyPlayers.includes(playerId)) {
            l.gameState = { ...l.gameState, battleResultReadyPlayers: [...l.gameState.battleResultReadyPlayers, playerId] };
          }
          // Check if all players have accepted
          if (l.gameState.battleResultReadyPlayers.length >= l.gameState.players.length) {
            // Find current unresolved battle and mark it resolved if it's uncontested
            const currentBattleIndex = l.gameState.activeBattles.findIndex(b => !b.resolved);
            if (currentBattleIndex !== -1) {
              const battle = l.gameState.activeBattles[currentBattleIndex];
              if (battle.uncontested) {
                const updatedBattles = [...l.gameState.activeBattles];
                updatedBattles[currentBattleIndex] = { ...battle, resolved: true };
                l.gameState = { ...l.gameState, activeBattles: updatedBattles };
              }
            }
            l.gameState = { ...l.gameState, battleResultReadyPlayers: [] };
            // After clearing ready players, check if ALL battles are now resolved - set warSummaryVisible on server
            const allBattlesResolved = l.gameState.activeBattles.length > 0 && l.gameState.activeBattles.every(b => b.resolved || b.uncontested);
            if (allBattlesResolved) {
              l.gameState = { ...l.gameState, warSummaryVisible: true };
            }
          }
          broadcastState(l);
          break;
        }

        case 'WAR_SUMMARY_READY': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!playerId) return;
          if (!l.gameState.warSummaryReadyPlayers.includes(playerId)) {
            l.gameState = { ...l.gameState, warSummaryReadyPlayers: [...l.gameState.warSummaryReadyPlayers, playerId] };
          }
          if (l.gameState.warSummaryReadyPlayers.length >= l.gameState.players.length) {
            // All players accepted war summary - advance to cleanup phase
            l.gameState = advancePhase(l.gameState);
            l.gameState = { ...l.gameState, warSummaryVisible: false, warSummaryReadyPlayers: [] };
          }
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
          // Validate that the player is the current train resolution player
          if (l.gameState.trainMandateActive) {
            const expectedPlayer = l.gameState.trainResolutionOrder[l.gameState.trainResolutionIndex];
            if (data.playerId !== expectedPlayer) return;
          }
          let s = buySeasonCard(l.gameState, data.playerId, cardId);
          // Check if the bought card is a monster
          const boughtCard = s.players.find(p => p.id === data.playerId)?.seasonCards.find(c => c.id === cardId);
          if (boughtCard && boughtCard.cardType === 'monster') {
            // Monster cards: broadcast state for client to handle placement UI
            // The train resolution will advance after monster placement completes
            l.gameState = s;
            broadcastState(l);
          } else {
            // Non-monster card: advance train resolution
            s = { ...s, trainResolutionIndex: s.trainResolutionIndex + 1 };
            s = advanceTrainResolution(s);
            if (!s.trainMandateActive) {
              s = advancePlayer(s);
            }
            l.gameState = s;
            broadcastState(l);
          }
          break;
        }

        case 'MONSTER_PLACED': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          // Validate that the sender is the current train resolution player
          if (l.gameState.trainMandateActive) {
            const expectedPlayer = l.gameState.trainResolutionOrder[l.gameState.trainResolutionIndex];
            if (data.playerId !== expectedPlayer) return;
          }
          // Validate that the sender is the kami resolution player (for Ryujin monster purchases)
          if (l.gameState.kamiResolutionActive && l.gameState.kamiResolutionCurrentPlayerId) {
            if (data.playerId !== l.gameState.kamiResolutionCurrentPlayerId) return;
          }
          const { cardId, provinceId, templeId, replaceFigureId, reserve } = data.payload || {};
          if (!cardId) return;
          let s = l.gameState;

          if (templeId) {
            // Komainu/Hotei placed at temple as shinto
            const templeIndex = s.temples.findIndex(t => t.id === templeId);
            if (templeIndex === -1) return;
            const temple = s.temples[templeIndex];
            const figureId = Math.random().toString(36).substring(2, 10);

            let updatedFigures = [...temple.figures];
            let updatedPlayers = s.players;

            // Hotei replacement logic
            if (replaceFigureId) {
              const replacedFigure = temple.figures.find(f => f.figureId === replaceFigureId && f.playerId !== data.playerId);
              if (replacedFigure) {
                updatedFigures = updatedFigures.filter(f => f.figureId !== replaceFigureId);
                updatedPlayers = s.players.map(p => {
                  if (p.id !== replacedFigure.playerId) return p;
                  return { ...p, shinto: p.shinto + 1 };
                });
              }
            }

            updatedFigures = [...updatedFigures, { playerId: data.playerId, figureId }];
            const updatedTemples = [...s.temples];
            updatedTemples[templeIndex] = { ...temple, figures: updatedFigures };

            s = {
              ...s,
              players: updatedPlayers,
              temples: updatedTemples,
              log: [...s.log, `Komainu/Hotei colocado como shinto en santuario`],
            };
          } else if (provinceId) {
            // Monster placed in province
            const province = s.provinces[provinceId];
            if (!province) return;
            const figureId = Math.random().toString(36).substring(2, 10);
            const newFigure = { type: 'monster' as const, owner: data.playerId, id: figureId, monsterCardId: cardId };
            s = {
              ...s,
              provinces: {
                ...s.provinces,
                [provinceId]: {
                  ...province,
                  figures: [...province.figures, newFigure],
                },
              },
              log: [...s.log, `Monstruo colocado en ${province.name}`],
            };
          } else if (reserve) {
            // Monster goes to reserve (Luna no valid province or cancel)
            s = {
              ...s,
              log: [...s.log, `Monstruo enviado a reserva`],
            };
          }

          // Advance resolution depending on context
          if (s.kamiResolutionActive && !s.trainMandateActive) {
            // Monster placed during kami resolution (e.g., Ryujin purchase)
            s = advanceKamiResolution(s);
          } else {
            // Monster placed during train mandate resolution
            s = { ...s, trainResolutionIndex: s.trainResolutionIndex + 1 };
            s = advanceTrainResolution(s);
            if (!s.trainMandateActive) {
              s = advancePlayer(s);
            }
          }
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'SKIP_MARSHAL_TURN': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          // Validate that the sender is the current marshal resolution player
          if (l.gameState.marshalMandateActive) {
            const expectedPlayer = l.gameState.marshalResolutionOrder[l.gameState.marshalResolutionIndex];
            if (data.playerId !== expectedPlayer) return;
          }
          let s = l.gameState;

          // Replay buffered moves and fortresses from the client payload
          const { moves, fortresses } = data.payload || {};
          if (moves && Array.isArray(moves)) {
            for (const move of moves) {
              if (move.fromProvinceId && move.toProvinceId && move.figureIds) {
                s = moveForces(s, data.playerId, move.fromProvinceId, move.toProvinceId, move.figureIds);
              }
            }
          }
          if (fortresses && Array.isArray(fortresses)) {
            for (const fort of fortresses) {
              if (fort.provinceId) {
                s = buildFortress(s, data.playerId, fort.provinceId);
              }
            }
          }

          s = skipMarshalTurn(s);
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
          // Only the current player (betray issuer) can skip
          if (!l.gameState.betrayMandateActive) return;
          const currentPlayer = l.gameState.players[l.gameState.currentPlayerIndex];
          if (!currentPlayer || currentPlayer.id !== data.playerId) return;
          let s = skipBetrayTurn(l.gameState);
          s = advancePlayer(s);
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'RECRUIT_PLACE_FIGURE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const { provinceId, figureType } = data.payload || {};
          if (!provinceId || !figureType) return;
          l.gameState = recruitPlaceFigure(l.gameState, data.playerId, provinceId, figureType);
          broadcastState(l);
          break;
        }

        case 'RECRUIT_PLACE_TEMPLE_SHINTO': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const { templeId } = data.payload || {};
          if (!templeId) return;
          // Place shinto in temple during recruit mandate
          if (!l.gameState.recruitMandateActive) return;
          if (l.gameState.recruitPlacementsRemaining <= 0) return;
          const recruitPlayer = l.gameState.players.find(p => p.id === data.playerId);
          if (!recruitPlayer || recruitPlayer.shinto <= 0) return;
          const templeIndex = l.gameState.temples.findIndex(t => t.id === templeId);
          if (templeIndex === -1) return;
          const temple = l.gameState.temples[templeIndex];
          // Luna clan power: max 2 shinto per temple
          if (recruitPlayer.clanId === 'luna') {
            const shintoInTemple = temple.figures.filter(f => f.playerId === data.playerId).length;
            if (shintoInTemple >= 2) return;
          }
          const figureId = Math.random().toString(36).substring(2, 10);
          const updatedTemples = [...l.gameState.temples];
          updatedTemples[templeIndex] = {
            ...temple,
            figures: [...temple.figures, { playerId: data.playerId, figureId }],
          };
          const updatedPlayers = l.gameState.players.map(p => {
            if (p.id === data.playerId) return { ...p, shinto: Math.max(0, p.shinto - 1) };
            return p;
          });
          l.gameState = {
            ...l.gameState,
            temples: updatedTemples,
            players: updatedPlayers,
            recruitPlacementsRemaining: l.gameState.recruitPlacementsRemaining - 1,
            log: [...l.gameState.log, `${recruitPlayer.name} coloca un shinto en santuario`],
          };
          broadcastState(l);
          break;
        }

        case 'SKIP_RECRUIT_TURN': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          let s = skipRecruitTurn(l.gameState);
          if (!s.recruitMandateActive) {
            s = advancePlayer(s);
          }
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'SKIP_TRAIN_PURCHASE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          // Validate that the player is the current train resolution player
          if (l.gameState.trainMandateActive) {
            const expectedPlayer = l.gameState.trainResolutionOrder[l.gameState.trainResolutionIndex];
            if (data.playerId !== expectedPlayer) return;
          }
          let s = skipTrainPurchase(l.gameState);
          if (!s.trainMandateActive) {
            s = advancePlayer(s);
          }
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'ACKNOWLEDGE_HARVEST': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.harvestMandateActive) return;
          // Validate that the acknowledging player is the one whose turn it is
          if (l.gameState.harvestCurrentPlayerId && data.playerId !== l.gameState.harvestCurrentPlayerId) return;
          let s = advanceHarvestResolution(l.gameState);
          if (!s.harvestMandateActive) {
            s = advancePlayer(s);
          }
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'LOTO_CHOOSE_ACTUAL_MANDATE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          const { mandate: lotoMandate } = data.payload || {};
          if (!lotoMandate) return;
          let s = lotoChooseActualMandate(l.gameState, lotoMandate, data.playerId);
          if (!s.betrayMandateActive && !s.trainMandateActive && !s.marshalMandateActive && !s.recruitMandateActive && !s.harvestMandateActive) {
            s = advancePlayer(s);
          }
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'ACKNOWLEDGE_KAMI_REWARD': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.kamiResolutionActive) return;
          // Validate that the acknowledging player is the one whose turn it is
          if (l.gameState.kamiResolutionCurrentPlayerId && data.playerId !== l.gameState.kamiResolutionCurrentPlayerId) return;

          const currentTemple = l.gameState.kamiResolutionTemples[l.gameState.kamiResolutionIndex];
          if (!currentTemple) return;

          // If no winner and no forces, auto-advance (empty temple that slipped through)
          if (!currentTemple.winnerId && currentTemple.forces.length === 0) {
            const s = advanceKamiResolution(l.gameState);
            l.gameState = s;
            broadcastState(l);
            break;
          }

          // Apply the reward for the current temple (resolveCurrentKamiReward will compute winner dynamically if needed)
          let s = resolveCurrentKamiReward(l.gameState);

          // If the reward is interactive, keep state and wait for player input
          if (s.kamiResolutionStep === 'interactive') {
            l.gameState = s;
            broadcastState(l);
            break;
          }

          // Check if winner was computed but no reward to apply (shouldn't happen, but handle gracefully)
          // Auto reward applied - advance to next temple
          s = advanceKamiResolution(s);
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'FUJIN_MOVE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.kamiResolutionActive || l.gameState.fujinMovesRemaining <= 0) return;
          if (l.gameState.kamiResolutionCurrentPlayerId && data.playerId !== l.gameState.kamiResolutionCurrentPlayerId) return;

          const { fromProvinceId, toProvinceId, figureIds } = data.payload || {};
          if (!fromProvinceId || !toProvinceId || !figureIds) return;

          const currentTemple = l.gameState.kamiResolutionTemples[l.gameState.kamiResolutionIndex];
          if (!currentTemple || !currentTemple.winnerId) return;

          const moved = moveForces(l.gameState, currentTemple.winnerId, fromProvinceId, toProvinceId, figureIds);
          if (moved === l.gameState) return; // validation failed

          const remaining = moved.fujinMovesRemaining - 1;
          l.gameState = { ...moved, fujinMovesRemaining: remaining };
          broadcastState(l);
          break;
        }

        case 'FUJIN_DONE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.kamiResolutionActive) return;
          if (l.gameState.kamiResolutionCurrentPlayerId && data.playerId !== l.gameState.kamiResolutionCurrentPlayerId) return;

          const ns = { ...l.gameState, fujinMovesRemaining: 0 };
          const s = advanceKamiResolution(ns);
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'RAIJIN_PLACE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.kamiResolutionActive || !l.gameState.raijinPlacementActive) return;
          if (l.gameState.kamiResolutionCurrentPlayerId && data.playerId !== l.gameState.kamiResolutionCurrentPlayerId) return;

          const { provinceId } = data.payload || {};
          if (!provinceId) return;

          const currentTemple = l.gameState.kamiResolutionTemples[l.gameState.kamiResolutionIndex];
          if (!currentTemple || !currentTemple.winnerId) return;

          const player = l.gameState.players.find(p => p.id === currentTemple.winnerId);
          if (!player || player.bushi <= 0) return;

          const province = l.gameState.provinces[provinceId];
          if (!province) return;

          const figureId = Math.random().toString(36).substring(2, 10);
          const newFigure = { type: 'bushi' as const, owner: currentTemple.winnerId, id: figureId };

          const updatedProvinces = {
            ...l.gameState.provinces,
            [provinceId]: {
              ...province,
              figures: [...province.figures, newFigure],
            },
          };

          const updatedPlayers = l.gameState.players.map(p => {
            if (p.id === currentTemple.winnerId) {
              return { ...p, bushi: Math.max(0, p.bushi - 1) };
            }
            return p;
          });

          l.gameState = {
            ...l.gameState,
            provinces: updatedProvinces,
            players: updatedPlayers,
            raijinPlacementActive: false,
            raijinPlacementDone: true,
            log: [...l.gameState.log, `${player.name} invoca un Bushi en ${province.name} (Raijin)`],
          };
          broadcastState(l);
          break;
        }

        case 'RAIJIN_CONFIRM': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.raijinPlacementDone) return;
          if (l.gameState.kamiResolutionCurrentPlayerId && data.playerId !== l.gameState.kamiResolutionCurrentPlayerId) return;

          let s: GameState = { ...l.gameState, raijinPlacementDone: false };
          s = advanceKamiResolution(s);
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'RYUJIN_BUY': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.kamiResolutionActive || !l.gameState.ryujinBuyActive) return;
          if (l.gameState.kamiResolutionCurrentPlayerId && data.playerId !== l.gameState.kamiResolutionCurrentPlayerId) return;

          const { cardId } = data.payload || {};
          if (!cardId) return;

          const currentTemple = l.gameState.kamiResolutionTemples[l.gameState.kamiResolutionIndex];
          if (!currentTemple || !currentTemple.winnerId) return;

          let s = ryujinBuyCardFn(l.gameState, currentTemple.winnerId, cardId);
          s = { ...s, ryujinBuyActive: false };

          // Check if the bought card is a monster - if so, wait for MONSTER_PLACED
          const boughtCard = s.players.find(p => p.id === currentTemple.winnerId)?.seasonCards.find(c => c.id === cardId);
          if (boughtCard && boughtCard.cardType === 'monster') {
            // Monster: don't advance kami resolution, wait for MONSTER_PLACED message
            l.gameState = s;
            broadcastState(l);
          } else {
            // Non-monster: advance kami resolution immediately
            s = advanceKamiResolution(s);
            l.gameState = s;
            broadcastState(l);
          }
          break;
        }

        case 'RYUJIN_SKIP': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.kamiResolutionActive || !l.gameState.ryujinBuyActive) return;
          if (l.gameState.kamiResolutionCurrentPlayerId && data.playerId !== l.gameState.kamiResolutionCurrentPlayerId) return;

          let s: GameState = {
            ...l.gameState,
            ryujinBuyActive: false,
            log: [...l.gameState.log, 'Recompensa de Ryujin saltada'],
          };
          s = advanceKamiResolution(s);
          l.gameState = s;
          broadcastState(l);
          break;
        }

        case 'BATTLE_POPUP_READY': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!playerId) return;
          if (!l.gameState.battlePopupReadyPlayers.includes(playerId)) {
            l.gameState = { ...l.gameState, battlePopupReadyPlayers: [...l.gameState.battlePopupReadyPlayers, playerId] };
          }
          if (l.gameState.battlePopupReadyPlayers.length >= l.gameState.players.length) {
            l.gameState = { ...l.gameState, battlePopupReadyPlayers: [] };
          }
          broadcastState(l);
          break;
        }

        case 'COIN_DISTRIBUTION_CHOICE': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.coinDistributionPending) return;
          const pending = l.gameState.coinDistributionPending;
          // Only the winner can distribute
          if (data.playerId !== pending.winnerId) return;
          const { targetPlayerId } = data.payload || {};
          if (!targetPlayerId || !pending.losers.includes(targetPlayerId)) return;

          // Give 1 coin to target
          const newPlayers = l.gameState.players.map(p => {
            if (p.id === targetPlayerId) return { ...p, coins: p.coins + 1 };
            return p;
          });
          const winner = l.gameState.players.find(p => p.id === pending.winnerId);
          const target = l.gameState.players.find(p => p.id === targetPlayerId);
          const newLog = [...l.gameState.log, `${winner?.name || ''} da 1 moneda extra a ${target?.name || ''}`];
          const newRemainder = pending.remainder - 1;

          l.gameState = {
            ...l.gameState,
            players: newPlayers,
            log: newLog,
            coinDistributionPending: newRemainder > 0
              ? { ...pending, remainder: newRemainder, distributed: pending.distributed + 1 }
              : null,
          };
          broadcastState(l);
          break;
        }

        case 'COIN_DISTRIBUTION_DISMISS': {
          const l = lobbies.get(currentLobbyId || '');
          if (!l?.gameState) return;
          if (!l.gameState.coinDistributionPending) return;
          const pendingDismiss = l.gameState.coinDistributionPending;
          // Only allow dismiss if remainder is 0 (informational) or the sender is the winner
          if (pendingDismiss.remainder !== 0 && data.playerId !== pendingDismiss.winnerId) return;
          l.gameState = { ...l.gameState, coinDistributionPending: null };
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
        if (l.host === playerId && !l.started) {
          // Host disconnected - destroy the lobby and notify remaining players
          l.players.forEach((p) => {
            if (p.id !== playerId && p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(JSON.stringify({ type: 'LOBBY_CLOSED', message: 'Host disconnected' }));
            }
          });
          lobbies.delete(currentLobbyId);
        } else {
          l.players = l.players.filter((p) => p.id !== playerId);
          if (l.players.length === 0) lobbies.delete(currentLobbyId);
          else broadcastLobby(l);
        }
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
      availableClans: l.config?.availableClans || [],
      deckConfig: l.config?.deckConfig || null,
      kamiMode: l.config?.kamiMode || 'random',
      autoAssignClan: l.config?.autoAssignClan || false,
    },
  };
  l.players.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify(s));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Shogun's Ascent server on port ${PORT}`));
