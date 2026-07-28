import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoguns-persistence-'));
process.env.DATA_DIR = dataDir;
let closeDatabase: (() => void) | undefined;

try {
  const database = await import('../src/server/database');
  closeDatabase = database.closeDatabase;
  const { createInitialGameState } = await import('../src/utils/gameLogic');
  database.initDatabase();

  const gameId = 'persistence-check';
  const state = createInitialGameState(
    [
      { name: 'One', clanId: 'sol' },
      { name: 'Two', clanId: 'luna' },
    ],
    'online',
  );
  state.id = gameId;
  database.saveGame(gameId, 'Persistence check', state.players, 'online');
  for (let index = 0; index < 105; index += 1) {
    state.round = index + 1;
    database.saveSnapshot(gameId, state, `intermediate-${index}`);
  }

  const snapshots = database.getSnapshots(gameId);
  assert.equal(snapshots.length, 101, 'Hybrid retention must keep the initial checkpoint plus 100 recent states');
  assert.equal(snapshots[0].snapshot_index, 0, 'The permanent initial checkpoint must survive pruning');
  assert.equal(snapshots.at(-1)?.snapshot_index, 104, 'The most recent state must survive pruning');

  database.saveActionUndoSnapshot(gameId, 'recruit', state);
  assert.equal(database.getActionUndoSnapshot(gameId, 'recruit')?.round, state.round);
  database.deleteActionUndoSnapshot(gameId, 'recruit');
  assert.equal(database.getActionUndoSnapshot(gameId, 'recruit'), null);

  database.deleteGame(gameId);
  console.log('Hybrid persistence checks passed.');
} finally {
  closeDatabase?.();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
