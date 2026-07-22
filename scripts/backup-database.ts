import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(process.env.DATABASE_PATH || 'data/games.db');
const backupDir = path.resolve(process.env.BACKUP_DIR || 'backups');
if (!fs.existsSync(sourcePath)) throw new Error(`Database not found: ${sourcePath}`);

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destinationPath = path.join(backupDir, `games-${stamp}.db`);

const database = new Database(sourcePath, { readonly: true });
await database.backup(destinationPath);
database.close();

console.log(destinationPath);
