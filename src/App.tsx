import { useGameStore } from './store/gameStore';
import { MainMenu } from './components/MainMenu';
import { GameBoard } from './components/GameBoard';
import { GamesLobby } from './components/GamesLobby';
import { ReplayViewer } from './components/ReplayViewer';
import { ClanShield } from './components/ClanShields';
import { CLANS } from './types/game';
import { useT } from './i18n';
import './App.css';

const LobbyScreen = () => {
  const { lobbyId, lobbyState, localPlayerId, sendSelectClan, ws } = useGameStore();
  const t = useT();

  const isHost = lobbyState?.host === localPlayerId;
  const availableClans = lobbyState?.availableClans || [];
  const players = lobbyState?.players || [];
  const takenClanIds = players.filter(p => p.clanId !== '').map(p => p.clanId);
  const selectableClans = availableClans.filter(clanId => !takenClanIds.includes(clanId));
  const myPlayer = players.find(p => p.id === localPlayerId);
  const hasSelectedClan = myPlayer && myPlayer.clanId !== '';

  return (
    <div className="lobby-screen">
      <h2 style={{ color: 'var(--accent-gold)', fontSize: '2rem', marginBottom: '0.5rem' }}>
        {t('lobby.waitingForPlayers')}
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
        {t('lobby.gameOfXPlayers', { count: lobbyState?.maxPlayers || '?' })}
      </p>

      <div className="lobby-info-section">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{t('lobby.gameId')}:</p>
        <code style={{ background: 'var(--bg-panel)', padding: '0.5rem 1rem', borderRadius: '6px', color: 'var(--accent-gold)', fontSize: '1.2rem', display: 'inline-block', marginBottom: '0.5rem' }}>
          {lobbyId}
        </code>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('lobby.shareId')}</p>
      </div>

      <div className="lobby-players-list">
        <h3 style={{ color: 'var(--accent-cream)', marginBottom: '0.75rem' }}>{t('lobby.connectedPlayers')} ({players.length}/{lobbyState?.maxPlayers || '?'})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '300px' }}>
          {players.map(p => {
            const clan = CLANS.find(c => c.id === p.clanId);
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.5rem 0.75rem', background: 'var(--bg-dark)',
                borderRadius: '6px', borderLeft: `3px solid ${clan?.color || 'var(--border-gold)'}`,
              }}>
                {clan && <ClanShield clanId={clan.id} size={24} />}
                <span style={{ fontWeight: 'bold', color: clan?.color || 'var(--text-primary)' }}>{p.name}</span>
                {p.id === lobbyState?.host && <span style={{ fontSize: '0.7rem', background: 'var(--accent-gold)', color: 'var(--bg-dark)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>HOST</span>}
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {p.clanId ? (clan?.name || p.clanId) : t('lobby.noClanYet')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {!hasSelectedClan && !isHost && selectableClans.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ color: 'var(--accent-cream)', marginBottom: '0.75rem' }}>{t('lobby.selectClan')}</h3>
          <div className="clan-badges-grid">
            {selectableClans.map(clanId => {
              const clan = CLANS.find(c => c.id === clanId);
              if (!clan) return null;
              return (
                <button
                  key={clanId}
                  className="clan-badge-btn"
                  style={{ borderColor: clan.color }}
                  onClick={() => sendSelectClan(lobbyId || '', clanId)}
                >
                  <ClanShield clanId={clanId} size={20} />
                  <span className="clan-badge-name" style={{ color: clan.color }}>{clan.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasSelectedClan && !isHost && (
        <p style={{ color: 'var(--accent-gold)', marginTop: '1.5rem', fontStyle: 'italic' }}>
          {t('lobby.hostWaiting')}
        </p>
      )}

      {isHost && lobbyState?.autoAssignClan !== true && (
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <button
            className="btn-primary"
            disabled={players.some(p => p.clanId === '')}
            onClick={() => {
              if (ws && ws.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify({ type: 'START_GAME', lobbyId }));
            }}
          >
            {t('menu.start')}
          </button>
        </div>
      )}

      <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={() => useGameStore.setState({ screen: 'menu', lobbyState: null })}>
        {t('menu.back')}
      </button>
    </div>
  );
};

const App = () => {
  const { screen } = useGameStore();
  if (screen === 'lobby') return <LobbyScreen />;
  if (screen === 'game') return <GameBoard />;
  if (screen === 'games-lobby') return <GamesLobby />;
  if (screen === 'replay') return <ReplayViewer />;
  return <MainMenu />;
};
export default App;
