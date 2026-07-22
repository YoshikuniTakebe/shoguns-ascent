import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(process.env.SOURCE_DB || 'data/games.db');
const destinationPath = path.resolve(process.env.DESTINATION_DB || 'deployment-data/games.db');
const requestedAdmin = process.env.PRODUCTION_ADMIN_USERNAME?.trim();

if (!fs.existsSync(sourcePath)) throw new Error(`Source database not found: ${sourcePath}`);
if (sourcePath === destinationPath) throw new Error('Destination must be different from the local database');

fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
if (fs.existsSync(destinationPath)) fs.rmSync(destinationPath);

const source = new Database(sourcePath, { readonly: true });
await source.backup(destinationPath);
source.close();

const target = new Database(destinationPath);
const admins = target.prepare('SELECT id, username FROM users WHERE is_admin = 1').all() as Array<{ id: string; username: string }>;
const admin = requestedAdmin
  ? admins.find(candidate => candidate.username.toLowerCase() === requestedAdmin.toLowerCase())
  : admins.length === 1 ? admins[0] : undefined;

if (!admin) {
  target.close();
  fs.rmSync(destinationPath);
  throw new Error(requestedAdmin
    ? `Admin user not found: ${requestedAdmin}`
    : `Expected exactly one admin, found ${admins.length}. Set PRODUCTION_ADMIN_USERNAME.`);
}

const sanitize = target.transaction(() => {
  target.prepare('DELETE FROM snapshots').run();
  target.prepare('DELETE FROM game_players').run();
  target.prepare('DELETE FROM friends').run();
  target.prepare('DELETE FROM pending_lobbies').run();
  target.prepare('DELETE FROM games').run();
  target.prepare('DELETE FROM users WHERE id <> ?').run(admin.id);
  target.prepare('DELETE FROM sqlite_sequence WHERE name IN (?, ?, ?)').run('snapshots', 'game_players', 'friends');
});

sanitize();
target.pragma('wal_checkpoint(TRUNCATE)');
target.exec('VACUUM');
target.close();

console.log(`Production database created at ${destinationPath} with admin ${admin.username} and no games.`);
