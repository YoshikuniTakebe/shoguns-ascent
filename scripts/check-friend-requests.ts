import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoguns-friends-'));
process.env.DATA_DIR = dataDir;

const database = await import('../src/server/database');

try {
  database.initDatabase();
  const sender = database.createUser('sender@example.com', 'Sender', 'hash');
  const recipient = database.createUser('recipient@example.com', 'Recipient', 'hash');
  const stranger = database.createUser('stranger@example.com', 'Stranger', 'hash');

  const request = database.createFriendRequest(sender.id, recipient.id);
  assert.equal(database.getFriendRequestDirection(sender.id, recipient.id), 'outgoing');
  assert.equal(database.getFriendRequestDirection(recipient.id, sender.id), 'incoming');

  const recipientRequests = database.getFriendRequests(recipient.id);
  assert.equal(recipientRequests.incoming[0]?.id, request.id);
  assert.deepEqual(recipientRequests.incoming[0]?.user, { id: sender.id, username: sender.username });
  assert.equal('email' in (recipientRequests.incoming[0]?.user || {}), false, 'Friend requests must not expose emails');

  assert.equal(
    database.acceptFriendRequest(request.id, stranger.id),
    null,
    'A user must not be able to accept somebody else\'s request',
  );
  assert.equal(database.getFriendRequests(recipient.id).incoming.length, 1);

  const acceptedFriend = database.acceptFriendRequest(request.id, recipient.id);
  assert.deepEqual(acceptedFriend, { id: sender.id, username: sender.username });
  assert.deepEqual(database.getFriends(sender.id), [{ id: recipient.id, username: recipient.username }]);
  assert.deepEqual(database.getFriends(recipient.id), [{ id: sender.id, username: sender.username }]);
  assert.deepEqual(database.getFriendRequests(sender.id), { incoming: [], outgoing: [] });
  assert.deepEqual(database.getFriendRequests(recipient.id), { incoming: [], outgoing: [] });

  const rejectedRequest = database.createFriendRequest(sender.id, stranger.id);
  assert.equal(database.rejectFriendRequest(rejectedRequest.id, recipient.id), false);
  assert.equal(database.rejectFriendRequest(rejectedRequest.id, stranger.id), true);
  assert.equal(database.areFriends(sender.id, stranger.id), false);
  assert.equal(database.areFriends(stranger.id, sender.id), false);
  assert.deepEqual(database.getFriendRequests(stranger.id), { incoming: [], outgoing: [] });

  const legacyOwner = database.createUser('legacy-owner@example.com', 'Yoshikuni', 'hash');
  const legacyFriend = database.createUser('legacy-friend@example.com', 'LegacyFriend', 'hash');
  assert.equal(database.addFriend(legacyOwner.id, legacyFriend.id), true);
  assert.deepEqual(
    database.getFriends(legacyFriend.id),
    [{ id: legacyOwner.id, username: legacyOwner.username }],
    'A legacy one-way friendship must be visible from both accounts',
  );
  assert.equal(database.repairAsymmetricFriendships(), 1, 'The migration must create the missing reverse row');
  assert.equal(database.addFriend(legacyFriend.id, legacyOwner.id), false, 'The repaired reverse row must be persisted');
  assert.equal(database.areFriends(legacyFriend.id, legacyOwner.id), true);

  console.log('Friend request checks passed.');
} finally {
  database.closeDatabase();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
