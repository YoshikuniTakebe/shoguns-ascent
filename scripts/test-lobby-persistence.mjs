// Ad-hoc integration test for pending-lobby persistence.
// Assumes the server is running on ws://localhost:3001 / http://localhost:3001.
import WebSocket from 'ws';

const WS = 'ws://localhost:3001';
const API = 'http://localhost:3001';

function once(ws, type, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeout);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === type) { clearTimeout(to); resolve(msg); }
    });
  });
}

function connect() {
  const ws = new WebSocket(WS);
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

async function visible() {
  const res = await fetch(`${API}/api/lobbies/visible`);
  return res.json();
}

const results = [];
function check(name, cond) {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}`);
}

(async () => {
  // 1. Host creates a lobby
  const host = await connect();
  await once(host, 'PLAYER_ID');
  host.send(JSON.stringify({ type: 'CREATE_LOBBY', playerName: 'HostTester', clanId: 'koi', maxPlayers: 2, availableClans: ['koi', 'sol'], autoAssignClan: false }));
  const created = await once(host, 'LOBBY_CREATED');
  const lobbyId = created.lobbyId;
  check('lobby created with id', !!lobbyId);

  let vis = await visible();
  check('lobby appears in visible list after create', vis.some(l => l.id === lobbyId));

  // 2. Host disconnects
  host.close();
  await new Promise(r => setTimeout(r, 500));

  vis = await visible();
  const survived = vis.find(l => l.id === lobbyId);
  check('lobby SURVIVES host disconnect (still in visible list)', !!survived);
  check('host slot is reserved (playerCount 1)', survived && survived.playerCount === 1);

  // 3. Host reconnects and rejoins the same lobby
  const host2 = await connect();
  await once(host2, 'PLAYER_ID');
  host2.send(JSON.stringify({ type: 'JOIN_LOBBY', lobbyId, playerName: 'HostTester' }));
  const joined = await once(host2, 'LOBBY_JOINED');
  check('host can rejoin the persisted lobby', joined.lobbyId === lobbyId);
  const lobbyState = await once(host2, 'LOBBY_STATE');
  check('rejoined lobby has the host player', lobbyState.lobby.players.some(p => p.name === 'HostTester'));
  host2.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => { console.error('TEST ERROR', e); process.exit(1); });
