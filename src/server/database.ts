import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { GameState } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

let db: Database.Database;

export function initDatabase(): void {
  const dataDir = path.resolve(process.cwd(), 'data');
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
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_game_id ON snapshots(game_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_game_index ON snapshots(game_id, snapshot_index);
    CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      username TEXT UNIQUE,
      password_hash TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
}

export function saveGame(
  id: string,
  name: string,
  players: { name: string; clanId: string }[],
  mode: string,
  status: string = 'active'
): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO games (id, name, players_json, status, created_at, updated_at, mode, winner)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `);
  stmt.run(id, name, JSON.stringify(players), status, now, now, mode);
}

export function updateGameStatus(id: string, status: string, winner?: string): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE games SET status = ?, winner = ?, updated_at = ? WHERE id = ?
  `);
  stmt.run(status, winner || null, now, id);
}

export function saveSnapshot(gameId: string, state: GameState, description?: string): void {
  const now = new Date().toISOString();

  // Get next snapshot index
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM snapshots WHERE game_id = ?`);
  const result = countStmt.get(gameId) as { count: number };
  const snapshotIndex = result.count;

  const stmt = db.prepare(`
    INSERT INTO snapshots (game_id, snapshot_index, state_json, description, phase, season, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    gameId,
    snapshotIndex,
    JSON.stringify(state),
    description || `${state.currentPhase} - ${state.currentSeason}`,
    state.currentPhase,
    state.currentSeason,
    now
  );

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
}

export function createUser(email: string, username: string, passwordHash: string): DbUser {
  const id = uuidv4();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO users (id, email, username, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, email, username, passwordHash, now);
  return { id, email, username, password_hash: passwordHash, created_at: now };
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
