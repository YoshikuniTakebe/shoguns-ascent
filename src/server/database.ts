import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { GameState } from '../types/game';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

let db: Database.Database;

export function initDatabase(): void {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'games.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT,
      players_json TEXT,
      status TEXT CHECK(status IN ('active', 'finished')),
      created_at TEXT,
      updated_at TEXT,
      mode TEXT,
      winner TEXT
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT REFERENCES games(id),
      snapshot_index INTEGER,
      state_json TEXT,
      description TEXT,
      phase TEXT,
      season TEXT,
      created_at TEXT,
      is_checkpoint INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_game_id ON snapshots(game_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_game_index ON snapshots(game_id, snapshot_index);
    CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      username TEXT UNIQUE,
      password_hash TEXT,
      created_at TEXT,
      is_admin INTEGER DEFAULT 0,
      language TEXT DEFAULT 'es',
      cards_light_mode INTEGER DEFAULT 0,
      show_figure_measurements INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT REFERENCES games(id),
      user_id TEXT REFERENCES users(id),
      clan_id TEXT,
      joined_at TEXT,
      UNIQUE(game_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_players_user_id ON game_players(user_id);

    CREATE TABLE IF NOT EXISTS user_game_map_views (
      user_id TEXT REFERENCES users(id),
      game_id TEXT REFERENCES games(id),
      x REAL NOT NULL,
      y REAL NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(user_id, game_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_game_map_views_game_id ON user_game_map_views(game_id);

    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id),
      friend_user_id TEXT REFERENCES users(id),
      created_at TEXT,
      UNIQUE(user_id, friend_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);

    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      sender_user_id TEXT REFERENCES users(id),
      recipient_user_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      UNIQUE(sender_user_id, recipient_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient ON friend_requests(recipient_user_id);
    CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_user_id);

    CREATE TABLE IF NOT EXISTS pending_lobbies (
      id TEXT PRIMARY KEY,
      name TEXT,
      host_id TEXT,
      max_players INTEGER,
      players_json TEXT,
      invited_user_ids_json TEXT,
      invited_clans_json TEXT,
      config_json TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_undo_snapshots (
      game_id TEXT REFERENCES games(id),
      action_type TEXT NOT NULL,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(game_id, action_type)
    );
  `);

  // Migration: add is_admin column if it doesn't exist (for existing databases)
  const columns = db.pragma('table_info(users)') as { name: string }[];
  if (!columns.some((col) => col.name === 'is_admin')) {
    db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`);
  }
  if (!columns.some((col) => col.name === 'language')) {
    db.exec(`ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'es'`);
  }
  if (!columns.some((col) => col.name === 'cards_light_mode')) {
    db.exec(`ALTER TABLE users ADD COLUMN cards_light_mode INTEGER DEFAULT 0`);
  }
  if (!columns.some((col) => col.name === 'show_figure_measurements')) {
    db.exec(`ALTER TABLE users ADD COLUMN show_figure_measurements INTEGER DEFAULT 0`);
  }

  // Migration: add password_hash column to games table if it doesn't exist
  const gamesColumns = db.pragma('table_info(games)') as { name: string }[];
  if (!gamesColumns.some((col) => col.name === 'password_hash')) {
    db.exec(`ALTER TABLE games ADD COLUMN password_hash TEXT`);
  }
  const snapshotColumns = db.pragma('table_info(snapshots)') as { name: string }[];
  if (!snapshotColumns.some((col) => col.name === 'is_checkpoint')) {
    db.exec(`ALTER TABLE snapshots ADD COLUMN is_checkpoint INTEGER DEFAULT 0`);
  }

  repairAsymmetricFriendships();
}

export function closeDatabase(): void {
  if (db?.open) {
    db.close();
  }
}

export function saveGame(
  id: string,
  name: string,
  players: { name: string; clanId: string }[],
  mode: string,
  status: string = 'active',
  password?: string
): void {
  const now = new Date().toISOString();
  let passwordHash: string | null = null;
  if (password) {
    passwordHash = bcrypt.hashSync(password, 10);
  }
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO games (id, name, players_json, status, created_at, updated_at, mode, winner, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `);
  stmt.run(id, name, JSON.stringify(players), status, now, now, mode, passwordHash);
}

export function updateGameStatus(id: string, status: string, winner?: string): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE games SET status = ?, winner = ?, updated_at = ? WHERE id = ?
  `);
  stmt.run(status, winner || null, now, id);
}

function isCheckpointState(previous: GameState | null, state: GameState, description?: string): boolean {
  if (!previous || state.gameOver) return true;
  if (description === 'Game started' || description === 'Hotseat save') return true;
  if (previous.currentSeason !== state.currentSeason || previous.currentPhase !== state.currentPhase) return true;
  if (previous.politicsMandateCount !== state.politicsMandateCount) return true;
  if (previous.kamiResolutionActive !== state.kamiResolutionActive) return true;
  if (previous.kamiResolutionIndex !== state.kamiResolutionIndex) return true;
  const previousResolved = previous.activeBattles.filter(battle => battle.resolved || battle.uncontested).length;
  const currentResolved = state.activeBattles.filter(battle => battle.resolved || battle.uncontested).length;
  return previousResolved !== currentResolved;
}

export function saveSnapshot(gameId: string, state: GameState, description?: string, forceCheckpoint = false): void {
  const now = new Date().toISOString();

  const latest = db.prepare(
    `SELECT snapshot_index, state_json FROM snapshots WHERE game_id = ? ORDER BY snapshot_index DESC LIMIT 1`
  ).get(gameId) as { snapshot_index: number; state_json: string } | undefined;
  const snapshotIndex = (latest?.snapshot_index ?? -1) + 1;
  let previousState: GameState | null = null;
  if (latest) {
    try {
      previousState = JSON.parse(latest.state_json) as GameState;
    } catch {
      previousState = null;
    }
  }
  const isCheckpoint = forceCheckpoint || isCheckpointState(previousState, state, description);

  const stmt = db.prepare(`
    INSERT INTO snapshots (game_id, snapshot_index, state_json, description, phase, season, created_at, is_checkpoint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    gameId,
    snapshotIndex,
    JSON.stringify(state),
    description || `${state.currentPhase} - ${state.currentSeason}`,
    state.currentPhase,
    state.currentSeason,
    now,
    isCheckpoint ? 1 : 0,
  );

  // Keep permanent milestones plus a rolling recovery window of recent intermediate states.
  db.prepare(`
    DELETE FROM snapshots
    WHERE game_id = ?
      AND is_checkpoint = 0
      AND id NOT IN (
        SELECT id FROM snapshots
        WHERE game_id = ? AND is_checkpoint = 0
        ORDER BY snapshot_index DESC
        LIMIT 100
      )
  `).run(gameId, gameId);

  // Update game's updated_at timestamp
  const updateStmt = db.prepare(`UPDATE games SET updated_at = ? WHERE id = ?`);
  updateStmt.run(now, gameId);
}

export function getGameById(id: string): {
  id: string;
  name: string;
  players_json: string;
  status: string;
  created_at: string;
  updated_at: string;
  mode: string;
  winner: string | null;
} | undefined {
  const stmt = db.prepare(`SELECT * FROM games WHERE id = ?`);
  return stmt.get(id) as any;
}

export function getGamePasswordHash(gameId: string): string | null {
  const stmt = db.prepare(`SELECT password_hash FROM games WHERE id = ?`);
  const result = stmt.get(gameId) as { password_hash: string | null } | undefined;
  return result?.password_hash || null;
}

export function getActiveGames(): {
  id: string;
  name: string;
  players_json: string;
  status: string;
  created_at: string;
  updated_at: string;
  mode: string;
  winner: string | null;
}[] {
  const stmt = db.prepare(`SELECT * FROM games WHERE status = 'active' ORDER BY updated_at DESC`);
  return stmt.all() as any[];
}

export function getFinishedGames(): {
  id: string;
  name: string;
  players_json: string;
  status: string;
  created_at: string;
  updated_at: string;
  mode: string;
  winner: string | null;
}[] {
  const stmt = db.prepare(`SELECT * FROM games WHERE status = 'finished' ORDER BY updated_at DESC`);
  return stmt.all() as any[];
}

export function getSnapshots(gameId: string): {
  id: number;
  game_id: string;
  snapshot_index: number;
  state_json: string;
  description: string;
  phase: string;
  season: string;
  created_at: string;
}[] {
  const stmt = db.prepare(`SELECT * FROM snapshots WHERE game_id = ? ORDER BY snapshot_index ASC`);
  return stmt.all(gameId) as any[];
}

export function getSnapshotByIndex(gameId: string, index: number): {
  id: number;
  game_id: string;
  snapshot_index: number;
  state_json: string;
  description: string;
  phase: string;
  season: string;
  created_at: string;
} | undefined {
  const stmt = db.prepare(`SELECT * FROM snapshots WHERE game_id = ? AND snapshot_index = ?`);
  return stmt.get(gameId, index) as any;
}

export function getSnapshotCount(gameId: string): number {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM snapshots WHERE game_id = ?`);
  const result = stmt.get(gameId) as { count: number };
  return result.count;
}

export function getLatestSnapshot(gameId: string): {
  id: number;
  game_id: string;
  snapshot_index: number;
  state_json: string;
  description: string;
  phase: string;
  season: string;
  created_at: string;
} | undefined {
  const stmt = db.prepare(`SELECT * FROM snapshots WHERE game_id = ? ORDER BY snapshot_index DESC LIMIT 1`);
  return stmt.get(gameId) as any;
}

// --- User functions ---

export interface DbUser {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: string;
  is_admin: number;
  language: 'en' | 'es';
  cards_light_mode: number;
  show_figure_measurements: number;
}

export type UndoActionType = 'recruit' | 'betray' | 'fujin';

export function saveActionUndoSnapshot(gameId: string, actionType: UndoActionType, state: GameState): void {
  db.prepare(`
    INSERT INTO action_undo_snapshots (game_id, action_type, state_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(game_id, action_type) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `).run(gameId, actionType, JSON.stringify(state), new Date().toISOString());
}

export function getActionUndoSnapshot(gameId: string, actionType: UndoActionType): GameState | null {
  const row = db.prepare(
    `SELECT state_json FROM action_undo_snapshots WHERE game_id = ? AND action_type = ?`
  ).get(gameId, actionType) as { state_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.state_json) as GameState;
  } catch {
    return null;
  }
}

export function deleteActionUndoSnapshot(gameId: string, actionType: UndoActionType): void {
  db.prepare(
    `DELETE FROM action_undo_snapshots WHERE game_id = ? AND action_type = ?`
  ).run(gameId, actionType);
}

export function createUser(email: string, username: string, passwordHash: string): DbUser {
  const id = uuidv4();
  const now = new Date().toISOString();

  // First registered user becomes admin automatically
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM users`);
  const countResult = countStmt.get() as { count: number };
  const isAdmin = countResult.count === 0 ? 1 : 0;

  const stmt = db.prepare(`
    INSERT INTO users (id, email, username, password_hash, created_at, is_admin)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, email, username, passwordHash, now, isAdmin);
  return {
    id,
    email,
    username,
    password_hash: passwordHash,
    created_at: now,
    is_admin: isAdmin,
    language: 'es',
    cards_light_mode: 0,
    show_figure_measurements: 0,
  };
}

export function getUserByUsername(username: string): DbUser | undefined {
  const stmt = db.prepare(`SELECT * FROM users WHERE username = ?`);
  return stmt.get(username) as DbUser | undefined;
}

export function getUserByEmail(email: string): DbUser | undefined {
  const stmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
  return stmt.get(email) as DbUser | undefined;
}

export function getUserById(id: string): DbUser | undefined {
  const stmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
  return stmt.get(id) as DbUser | undefined;
}

export function updateUserPreferences(
  id: string,
  preferences: {
    language?: 'en' | 'es';
    cardsLightMode?: boolean;
    showFigureMeasurements?: boolean;
  }
): DbUser | undefined {
  const user = getUserById(id);
  if (!user) return undefined;

  const language = preferences.language ?? user.language ?? 'es';
  const cardsLightMode = preferences.cardsLightMode ?? !!user.cards_light_mode;
  const showFigureMeasurements = user.is_admin
    ? (preferences.showFigureMeasurements ?? !!user.show_figure_measurements)
    : false;

  db.prepare(`
    UPDATE users
    SET language = ?, cards_light_mode = ?, show_figure_measurements = ?
    WHERE id = ?
  `).run(language, cardsLightMode ? 1 : 0, showFigureMeasurements ? 1 : 0, id);

  return getUserById(id);
}

export function getUserGameMapView(userId: string, gameId: string): { x: number; y: number } | undefined {
  return db.prepare(`
    SELECT x, y
    FROM user_game_map_views
    WHERE user_id = ? AND game_id = ?
  `).get(userId, gameId) as { x: number; y: number } | undefined;
}

export function saveUserGameMapView(userId: string, gameId: string, x: number, y: number): void {
  db.prepare(`
    INSERT INTO user_game_map_views (user_id, game_id, x, y, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, game_id) DO UPDATE SET
      x = excluded.x,
      y = excluded.y,
      updated_at = excluded.updated_at
  `).run(userId, gameId, x, y, new Date().toISOString());
}

// --- Game Players functions ---

export function addGamePlayer(gameId: string, userId: string, clanId: string): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO game_players (game_id, user_id, clan_id, joined_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(gameId, userId, clanId, now);
}

export function getGamesByUserId(userId: string): {
  id: string;
  name: string;
  players_json: string;
  status: string;
  created_at: string;
  updated_at: string;
  mode: string;
  winner: string | null;
}[] {
  const stmt = db.prepare(`
    SELECT g.* FROM games g
    INNER JOIN game_players gp ON g.id = gp.game_id
    WHERE gp.user_id = ?
    ORDER BY g.updated_at DESC
  `);
  return stmt.all(userId) as any[];
}

export function getGamePlayersByGameId(gameId: string): {
  game_id: string;
  user_id: string;
  clan_id: string;
  joined_at: string;
}[] {
  const stmt = db.prepare(`SELECT game_id, user_id, clan_id, joined_at FROM game_players WHERE game_id = ?`);
  return stmt.all(gameId) as any[];
}

// --- Friends functions ---

/** Find a user by exact username or exact email (used for the "add friend" search). */
export function findUserByUsernameOrEmail(identifier: string): DbUser | undefined {
  const stmt = db.prepare(`SELECT * FROM users WHERE username = ? OR email = ?`);
  return stmt.get(identifier, identifier) as DbUser | undefined;
}

/** Add friendUserId to userId's friends list (directed). Returns false if already present. */
export function addFriend(userId: string, friendUserId: string): boolean {
  const now = new Date().toISOString();
  const existing = db.prepare(`SELECT id FROM friends WHERE user_id = ? AND friend_user_id = ?`).get(userId, friendUserId);
  if (existing) return false;
  db.prepare(`INSERT INTO friends (user_id, friend_user_id, created_at) VALUES (?, ?, ?)`).run(userId, friendUserId, now);
  return true;
}

export function areFriends(userId: string, friendUserId: string): boolean {
  const row = db.prepare(`
    SELECT id FROM friends
    WHERE (user_id = ? AND friend_user_id = ?)
       OR (user_id = ? AND friend_user_id = ?)
  `).get(userId, friendUserId, friendUserId, userId);
  return !!row;
}

/** Get the list of a user's friends (basic public info). */
export function getFriends(userId: string): { id: string; username: string }[] {
  const stmt = db.prepare(`
    SELECT DISTINCT u.id, u.username
    FROM friends f
    INNER JOIN users u ON u.id = CASE
      WHEN f.user_id = ? THEN f.friend_user_id
      ELSE f.user_id
    END
    WHERE (f.user_id = ? OR f.friend_user_id = ?)
      AND u.id <> ?
    ORDER BY u.username COLLATE NOCASE ASC
  `);
  return stmt.all(userId, userId, userId, userId) as { id: string; username: string }[];
}

function insertMutualFriendship(userId: string, friendUserId: string): void {
  const createdAt = new Date().toISOString();
  const insertFriend = db.prepare(`
    INSERT OR IGNORE INTO friends (user_id, friend_user_id, created_at)
    VALUES (?, ?, ?)
  `);
  insertFriend.run(userId, friendUserId, createdAt);
  insertFriend.run(friendUserId, userId, createdAt);
}

export function ensureMutualFriendship(userId: string, friendUserId: string): void {
  db.transaction(() => insertMutualFriendship(userId, friendUserId))();
}

export function repairAsymmetricFriendships(): number {
  const result = db.prepare(`
    INSERT OR IGNORE INTO friends (user_id, friend_user_id, created_at)
    SELECT friend_user_id, user_id, created_at
    FROM friends
    WHERE user_id <> friend_user_id
  `).run();
  return result.changes;
}

export interface FriendRequestView {
  id: string;
  user: { id: string; username: string };
  createdAt: string;
}

export function getFriendRequestDirection(
  userId: string,
  otherUserId: string,
): 'outgoing' | 'incoming' | null {
  const outgoing = db.prepare(`
    SELECT id FROM friend_requests
    WHERE sender_user_id = ? AND recipient_user_id = ?
  `).get(userId, otherUserId);
  if (outgoing) return 'outgoing';
  const incoming = db.prepare(`
    SELECT id FROM friend_requests
    WHERE sender_user_id = ? AND recipient_user_id = ?
  `).get(otherUserId, userId);
  return incoming ? 'incoming' : null;
}

export function createFriendRequest(
  senderUserId: string,
  recipientUserId: string,
): { id: string; createdAt: string } {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO friend_requests (id, sender_user_id, recipient_user_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, senderUserId, recipientUserId, createdAt);
  return { id, createdAt };
}

export function getFriendRequests(userId: string): {
  incoming: FriendRequestView[];
  outgoing: FriendRequestView[];
} {
  const incoming = db.prepare(`
    SELECT fr.id, fr.created_at AS createdAt, u.id AS userId, u.username
    FROM friend_requests fr
    INNER JOIN users u ON u.id = fr.sender_user_id
    WHERE fr.recipient_user_id = ?
    ORDER BY fr.created_at DESC
  `).all(userId) as Array<{ id: string; createdAt: string; userId: string; username: string }>;
  const outgoing = db.prepare(`
    SELECT fr.id, fr.created_at AS createdAt, u.id AS userId, u.username
    FROM friend_requests fr
    INNER JOIN users u ON u.id = fr.recipient_user_id
    WHERE fr.sender_user_id = ?
    ORDER BY fr.created_at DESC
  `).all(userId) as Array<{ id: string; createdAt: string; userId: string; username: string }>;
  const mapRequest = (request: { id: string; createdAt: string; userId: string; username: string }): FriendRequestView => ({
    id: request.id,
    user: { id: request.userId, username: request.username },
    createdAt: request.createdAt,
  });
  return {
    incoming: incoming.map(mapRequest),
    outgoing: outgoing.map(mapRequest),
  };
}

export function acceptFriendRequest(
  requestId: string,
  recipientUserId: string,
): { id: string; username: string } | null {
  const accept = db.transaction(() => {
    const request = db.prepare(`
      SELECT sender_user_id AS senderUserId
      FROM friend_requests
      WHERE id = ? AND recipient_user_id = ?
    `).get(requestId, recipientUserId) as { senderUserId: string } | undefined;
    if (!request) return null;

    insertMutualFriendship(recipientUserId, request.senderUserId);
    db.prepare(`
      DELETE FROM friend_requests
      WHERE (sender_user_id = ? AND recipient_user_id = ?)
         OR (sender_user_id = ? AND recipient_user_id = ?)
    `).run(recipientUserId, request.senderUserId, request.senderUserId, recipientUserId);

    return db.prepare(`SELECT id, username FROM users WHERE id = ?`)
      .get(request.senderUserId) as { id: string; username: string };
  });
  return accept();
}

export function rejectFriendRequest(requestId: string, recipientUserId: string): boolean {
  const result = db.prepare(`
    DELETE FROM friend_requests
    WHERE id = ? AND recipient_user_id = ?
  `).run(requestId, recipientUserId);
  return result.changes > 0;
}

// --- Pending lobby persistence ---
// Waiting rooms (pre-game lobbies) are persisted so a host/player disconnection (or a server
// restart) does not lose the game. They are removed once the game actually starts.

export interface DbPendingLobby {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  players: { id: string; name: string; clanId: string }[];
  invitedUserIds: string[];
  invitedClans: Record<string, string>;
  config: unknown;
  createdAt: string;
}

interface PendingLobbyRow {
  id: string;
  name: string;
  host_id: string;
  max_players: number;
  players_json: string;
  invited_user_ids_json: string;
  invited_clans_json: string;
  config_json: string;
  created_at: string;
  updated_at: string;
}

function rowToPendingLobby(row: PendingLobbyRow): DbPendingLobby {
  const safeParse = <T>(json: string, fallback: T): T => {
    try {
      return json ? (JSON.parse(json) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    id: row.id,
    name: row.name,
    hostId: row.host_id,
    maxPlayers: row.max_players,
    players: safeParse(row.players_json, [] as { id: string; name: string; clanId: string }[]),
    invitedUserIds: safeParse(row.invited_user_ids_json, [] as string[]),
    invitedClans: safeParse(row.invited_clans_json, {} as Record<string, string>),
    config: safeParse(row.config_json, null),
    createdAt: row.created_at,
  };
}

export function savePendingLobby(lobby: DbPendingLobby): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO pending_lobbies
      (id, name, host_id, max_players, players_json, invited_user_ids_json, invited_clans_json, config_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    lobby.id,
    lobby.name,
    lobby.hostId,
    lobby.maxPlayers,
    JSON.stringify(lobby.players),
    JSON.stringify(lobby.invitedUserIds),
    JSON.stringify(lobby.invitedClans),
    JSON.stringify(lobby.config ?? null),
    lobby.createdAt || now,
    now
  );
}

export function getPendingLobby(id: string): DbPendingLobby | undefined {
  const row = db.prepare(`SELECT * FROM pending_lobbies WHERE id = ?`).get(id) as PendingLobbyRow | undefined;
  return row ? rowToPendingLobby(row) : undefined;
}

export function getAllPendingLobbies(): DbPendingLobby[] {
  const rows = db.prepare(`SELECT * FROM pending_lobbies ORDER BY created_at DESC`).all() as PendingLobbyRow[];
  return rows.map(rowToPendingLobby);
}

export function deletePendingLobby(id: string): void {
  db.prepare(`DELETE FROM pending_lobbies WHERE id = ?`).run(id);
}

export function getAppSetting(key: string): string | undefined {
  const row = db.prepare(
    `SELECT setting_value FROM app_settings WHERE setting_key = ?`
  ).get(key) as { setting_value: string } | undefined;
  return row?.setting_value;
}

export function setAppSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO app_settings (setting_key, setting_value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = excluded.updated_at
  `).run(key, value, new Date().toISOString());
}

// --- Admin functions ---

export function deleteGame(gameId: string): void {
  const deleteSnapshots = db.prepare(`DELETE FROM snapshots WHERE game_id = ?`);
  const deleteGamePlayers = db.prepare(`DELETE FROM game_players WHERE game_id = ?`);
  const deleteMapViews = db.prepare(`DELETE FROM user_game_map_views WHERE game_id = ?`);
  const deleteUndoSnapshots = db.prepare(`DELETE FROM action_undo_snapshots WHERE game_id = ?`);
  const deleteGameStmt = db.prepare(`DELETE FROM games WHERE id = ?`);

  const transaction = db.transaction(() => {
    deleteSnapshots.run(gameId);
    deleteGamePlayers.run(gameId);
    deleteMapViews.run(gameId);
    deleteUndoSnapshots.run(gameId);
    deleteGameStmt.run(gameId);
  });
  transaction();
}

export function purgeOrphanGames(): number {
  const orphanGames = db.prepare(`
    SELECT g.id FROM games g
    LEFT JOIN game_players gp ON g.id = gp.game_id
    WHERE gp.id IS NULL
  `).all() as { id: string }[];

  const deleteSnapshots = db.prepare(`DELETE FROM snapshots WHERE game_id = ?`);
  const deleteMapViews = db.prepare(`DELETE FROM user_game_map_views WHERE game_id = ?`);
  const deleteUndoSnapshots = db.prepare(`DELETE FROM action_undo_snapshots WHERE game_id = ?`);
  const deleteGameStmt = db.prepare(`DELETE FROM games WHERE id = ?`);

  const transaction = db.transaction(() => {
    for (const game of orphanGames) {
      deleteSnapshots.run(game.id);
      deleteMapViews.run(game.id);
      deleteUndoSnapshots.run(game.id);
      deleteGameStmt.run(game.id);
    }
  });
  transaction();

  return orphanGames.length;
}
