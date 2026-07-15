import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { API_BASE, getServerWsUrl } from '../config';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import { CLANS } from '../types/game';
import { ClanShield, WarSeal } from './ClanShields';
import { ConfigModal } from './ConfigModal';
import { AddFriendModal, FriendsListModal } from './FriendsModal';
import titleImg from '../img/NoboruTaiyo.png';

interface GameRecord {
  id: string;
  name: string;
  players: { name: string; clanId: string; userId: string | null }[];
  status: string;
  createdAt: string;
  updatedAt: string;
  mode: string;
  winner: string | null;
  lastSeason: string | null;
  lastPhase: string | null;
  politicsMandateCount: number | null;
  kamiResolutionIndex: number | null;
  battleCount: number | null;
  currentPlayerIndex: number | null;
}

interface WaitingLobby {
  id: string;
  name: string;
  maxPlayers: number;
  playerCount: number;
  open: boolean;
  openSlots: number;
  invited: boolean;
  isHost: boolean;
  isParticipant: boolean;
  createdAt: string;
  players: { name: string; clanId: string; userId: string }[];
  slots: { userId: string | null; name: string | null; clanId: string; status: 'joined' | 'waiting' | 'open' }[];
}

export const GamesLobby = () => {
  const { setScreen, resumeGame, loadFinishedGameScore, authToken, authUser, logout, connectWebSocket, setLobbyId } = useGameStore();
  const t = useT();
  const [waitingLobbies, setWaitingLobbies] = useState<WaitingLobby[]>([]);
  const [yourTurnGames, setYourTurnGames] = useState<GameRecord[]>([]);
  const [waitingGames, setWaitingGames] = useState<GameRecord[]>([]);
  const [finishedGames, setFinishedGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [passwordModal, setPasswordModal] = useState<{ gameId: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [passwordGames, setPasswordGames] = useState<Set<string>>(new Set());
  const [modeFilter, setModeFilter] = useState<'online' | 'hotseat'>(authToken ? 'online' : 'hotseat');
  const [showConfig, setShowConfig] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const headers: Record<string, string> = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Task 7: waiting lobbies visible to this user (invited or open games)
        try {
          const lobbiesRes = await fetch(`${API_BASE}/api/lobbies/visible`, { headers });
          if (lobbiesRes.ok) {
            setWaitingLobbies(await lobbiesRes.json());
          }
        } catch {
          setWaitingLobbies([]);
        }

        if (authToken) {
          // Logged in: fetch user's online games + all hotseat games
          const [myGamesRes, hotseatActiveRes, hotseatFinishedRes] = await Promise.all([
            fetch(`${API_BASE}/api/games/my-games`, { headers }),
            fetch(`${API_BASE}/api/games?status=active`),
            fetch(`${API_BASE}/api/games?status=finished`),
          ]);
          const myGames: GameRecord[] = await myGamesRes.json();
          const allActive: GameRecord[] = await hotseatActiveRes.json();
          const allFinished: GameRecord[] = await hotseatFinishedRes.json();

          // My online games (active)
          const myActiveOnline = myGames.filter((g) => g.status === 'active');
          const myFinishedOnline = myGames.filter((g) => g.status === 'finished');

          // Hotseat games not already in my-games
          const myGameIds = new Set(myGames.map(g => g.id));
          const hotseatActive = allActive.filter(g => g.mode === 'hotseat' && !myGameIds.has(g.id));
          const hotseatFinished = allFinished.filter(g => g.mode === 'hotseat' && !myGameIds.has(g.id));

          // Combine active games
          const allActiveGames = [...myActiveOnline, ...hotseatActive];
          const allFinishedGames = [...myFinishedOnline, ...hotseatFinished];

          // Separate active games into "your turn" and "waiting"
          const currentUserId = authUser?.id || '';
          const yourTurn: GameRecord[] = [];
          const waiting: GameRecord[] = [];

          for (const game of allActiveGames) {
            if (game.mode === 'online' && game.currentPlayerIndex != null && game.players[game.currentPlayerIndex]) {
              const currentPlayer = game.players[game.currentPlayerIndex];
              if (currentPlayer.userId && currentPlayer.userId === currentUserId) {
                yourTurn.push(game);
              } else {
                waiting.push(game);
              }
            } else {
              waiting.push(game);
            }
          }

          setYourTurnGames(yourTurn);
          setWaitingGames(waiting);
          setFinishedGames(allFinishedGames);
        } else {
          // Not logged in: show only hotseat games
          const [activeRes, finishedRes] = await Promise.all([
            fetch(`${API_BASE}/api/games?status=active`),
            fetch(`${API_BASE}/api/games?status=finished`),
          ]);
          const active: GameRecord[] = await activeRes.json();
          const finished: GameRecord[] = await finishedRes.json();
          const hotseatActive = active.filter(g => g.mode === 'hotseat');
          const hotseatFinished = finished.filter(g => g.mode === 'hotseat');
          setYourTurnGames([]);
          setWaitingGames(hotseatActive);
          setFinishedGames(hotseatFinished);
        }
      } catch {
        // Server might not be running
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
    // Poll every 15 seconds to keep the list in sync across clients
    const interval = setInterval(fetchGames, 15000);
    return () => clearInterval(interval);
  }, [authToken, authUser]);

  // Check which hotseat games have passwords
  useEffect(() => {
    const allGames = [...yourTurnGames, ...waitingGames];
    const hotseatGames = allGames.filter(g => g.mode === 'hotseat');
    if (hotseatGames.length === 0) return;
    const checkPasswords = async () => {
      const pwSet = new Set<string>();
      await Promise.all(
        hotseatGames.map(async (g) => {
          try {
            const res = await fetch(`${API_BASE}/api/games/${g.id}/has-password`);
            const data = await res.json();
            if (data.hasPassword) pwSet.add(g.id);
          } catch { /* ignore */ }
        })
      );
      setPasswordGames(pwSet);
    };
    checkPasswords();
  }, [yourTurnGames, waitingGames]);

  const handleResumeGame = async (gameId: string, mode: string) => {
    if (mode === 'hotseat' && passwordGames.has(gameId)) {
      setPasswordModal({ gameId });
      setPasswordInput('');
      setPasswordError(false);
      return;
    }
    resumeGame(gameId);
  };

  const handlePasswordSubmit = async () => {
    if (!passwordModal) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${passwordModal.gameId}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (data.valid) {
        setPasswordModal(null);
        setPasswordInput('');
        setPasswordError(false);
        resumeGame(passwordModal.gameId);
      } else {
        setPasswordError(true);
      }
    } catch {
      setPasswordError(true);
    }
  };

  const getClanColor = (clanId: string) => {
    return CLANS.find(c => c.id === clanId)?.color || '#fff';
  };

  // Task 7: enter/join a waiting lobby (invited or open game). If we already hold an open
  // connection to this lobby (e.g. the host who stepped back to the list), just re-open the
  // waiting room instead of opening a second socket (which would drop the original one and
  // tear the lobby down server-side).
  const handleEnterLobby = (lobbyId: string) => {
    const { ws, lobbyId: currentLobbyId } = useGameStore.getState();
    if (ws && ws.readyState === WebSocket.OPEN && currentLobbyId === lobbyId) {
      setScreen('lobby');
      return;
    }
    const playerName = authUser?.username || 'Player';
    connectWebSocket(getServerWsUrl(), (socket) => {
      socket.send(JSON.stringify({ type: 'JOIN_LOBBY', lobbyId, playerName }));
      setLobbyId(lobbyId);
    });
  };

  const isAdmin = authUser?.isAdmin || false;

  const handleDeleteGame = async (e: React.MouseEvent, gameId: string) => {
    e.stopPropagation();
    if (!confirm(t('admin.confirmDelete'))) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setYourTurnGames((prev) => prev.filter((g) => g.id !== gameId));
        setWaitingGames((prev) => prev.filter((g) => g.id !== gameId));
        setFinishedGames((prev) => prev.filter((g) => g.id !== gameId));
      }
    } catch {
      // ignore
    }
  };

  const handlePurgeOrphans = async () => {
    if (!confirm(t('admin.confirmPurge'))) return;
    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/purge-orphan-games`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPurgeResult(`${data.purgedCount} ${t('admin.gamesPurged')}`);
      }
    } catch {
      // ignore
    } finally {
      setPurging(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
    } catch {
      return dateStr;
    }
  };

  // Build the human-friendly game identifier shown in parentheses after the game name,
  // e.g. "2607050028origami": DDMMYY + HHMM from the creation date + a themed word derived
  // deterministically from the game id so it stays stable across reloads.
  const GAME_ID_WORDS = ['origami', 'sakura', 'katana', 'shogun', 'ronin', 'daimyo', 'tsuki', 'kaze', 'yama', 'hana', 'take', 'mori'];
  const getGameIdentifier = (game: GameRecord): string => {
    let digits = '';
    try {
      const d = new Date(game.createdAt);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      digits = `${dd}${mm}${yy}${hh}${mi}`;
    } catch {
      digits = '';
    }
    // Deterministic word from the game id hash
    let hash = 0;
    for (let i = 0; i < game.id.length; i++) {
      hash = (hash * 31 + game.id.charCodeAt(i)) >>> 0;
    }
    const word = GAME_ID_WORDS[hash % GAME_ID_WORDS.length];
    return `${digits}${word}`;
  };

  const getProgressPoint = (game: GameRecord): string => {
    if (!game.lastSeason || !game.lastPhase) return '';
    const seasonKey = `season.${game.lastSeason}` as TranslationKey;
    const seasonName = t(seasonKey);
    let phaseCode = '';
    if (game.lastPhase === 'politics') {
      phaseCode = `P${game.politicsMandateCount ?? 0}`;
    } else if (game.lastPhase === 'kamiResolution' || game.lastPhase === 'kami') {
      phaseCode = `K${(game.kamiResolutionIndex ?? 0) + 1}`;
    } else if (game.lastPhase === 'war') {
      phaseCode = `B${game.battleCount ?? 0}`;
    } else {
      phaseCode = game.lastPhase.charAt(0).toUpperCase() + '0';
    }
    return `${seasonName} ${phaseCode}`.toUpperCase();
  };

  const renderGameCard = (game: GameRecord, type: 'your-turn' | 'waiting' | 'finished') => {
    const cardClass = [
      'games-lobby-card',
      type === 'your-turn' ? 'games-lobby-card-your-turn' : '',
      type === 'waiting' ? 'games-lobby-card-waiting' : '',
      type === 'finished' ? 'games-lobby-card-finished' : '',
    ].filter(Boolean).join(' ');

    const handleAction = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (type === 'finished') {
        loadFinishedGameScore(game.id);
      } else {
        handleResumeGame(game.id, game.mode);
      }
    };

    const modeIcon = game.mode === 'online' ? (
      <span className="games-lobby-mode-badge games-lobby-mode-online" title={t('game.modeOnline')}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <ellipse cx="12" cy="12" rx="4.5" ry="10" />
          <path d="M2 12h20" />
        </svg>
        <span>{t('game.modeOnline')}</span>
      </span>
    ) : (
      <span className="games-lobby-mode-badge games-lobby-mode-hotseat" title={t('game.modeHotseat')}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <circle cx="8" cy="7" r="3" />
          <circle cx="16" cy="7" r="3" />
          <path d="M2 19c0-3 2.5-5 6-5s6 2 6 5" opacity="0.7" />
          <path d="M10 19c0-3 2.5-5 6-5s6 2 6 5" opacity="0.7" />
        </svg>
        <span>{t('game.modeHotseat')}</span>
      </span>
    );

    const currentPlayer = type !== 'finished' && game.currentPlayerIndex != null ? game.players[game.currentPlayerIndex] : null;
    const isWarPhase = type !== 'finished' && game.lastPhase === 'war';

    return (
      <div
        key={game.id}
        className={cardClass}
        onClick={() => type === 'finished' ? loadFinishedGameScore(game.id) : handleResumeGame(game.id, game.mode)}
      >
        {/* Left: name + identifier + creation date, and player names grid */}
        <div className="games-lobby-card-left">
          <div className="games-lobby-card-title-row">
            {passwordGames.has(game.id) && (
              <span className="games-lobby-lock-icon" title={t('game.passwordProtected')}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </span>
            )}
            <span className="games-lobby-card-gamename">{game.name}</span>
            <span className="games-lobby-card-gameid">({getGameIdentifier(game)})</span>
            <span className="games-lobby-card-created-inline">· {t('lobby.createdOn', { date: formatDate(game.createdAt) })}</span>
          </div>
          <span className="games-lobby-card-clans games-lobby-card-clans-grid">
            {game.players.map((p, i) => (
              <span
                key={i}
                className={`games-lobby-card-clan-entry${type !== 'finished' && game.currentPlayerIndex === i ? ' games-lobby-card-clan-entry-active' : ''}`}
              >
                <ClanShield clanId={p.clanId} size={16} />
                <span style={{ color: getClanColor(p.clanId) }}>{p.name}</span>
              </span>
            ))}
          </span>
        </div>

        {/* Center: War marker or current-turn player seal (compact) */}
        {isWarPhase ? (
          <div className="games-lobby-card-turn-seal games-lobby-card-war-seal">
            <WarSeal size={42} />
            <span className="games-lobby-card-war-seal-name">{t('lobby.war')}</span>
          </div>
        ) : currentPlayer ? (
          <div className="games-lobby-card-turn-seal">
            <span className="games-lobby-card-turn-seal-label">{t('lobby.turnOf')}</span>
            <ClanShield clanId={currentPlayer.clanId} size={38} />
            <span className="games-lobby-card-turn-seal-name" style={{ color: getClanColor(currentPlayer.clanId) }}>{currentPlayer.name}</span>
          </div>
        ) : null}

        {/* Right: mode + date + progress + actions */}
        <div className="games-lobby-card-right">
          <span className="games-lobby-card-header-right">
            {modeIcon}
            <span className="games-lobby-card-date">{formatDate(game.updatedAt || game.createdAt)}</span>
          </span>
          {game.lastSeason && (
            <span className="games-lobby-card-progress">{getProgressPoint(game)}</span>
          )}
          <div className="games-lobby-card-actions">
            {type === 'your-turn' && (
              <button className="games-lobby-play-btn" onClick={handleAction}>{t('lobby.play')}</button>
            )}
            {type === 'waiting' && (
              <button className="games-lobby-view-btn" onClick={handleAction}>{t('lobby.view')}</button>
            )}
            {type === 'finished' && (
              <button className="games-lobby-view-btn" onClick={handleAction}>{t('lobby.replay')}</button>
            )}
            {isAdmin && (
              <button className="games-lobby-delete-btn" onClick={(e) => handleDeleteGame(e, game.id)} title={t('admin.deleteGame')}>✕</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="games-lobby">
        <div className="games-lobby-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="games-lobby">
      {/* Header with title and user profile */}
      <div className="games-lobby-header">
        <div className="games-lobby-header-left">
          <img src={titleImg} alt="Noboru Taiyo" className="games-lobby-title-img" />
          <h1 className="games-lobby-title">{t('lobby.title')}</h1>
        </div>
        {authUser && (
          <div className="games-lobby-user-badge">
            <span className="games-lobby-user-name">
              {t('lobby.loggedAs')} <strong>{authUser.username}</strong>
            </span>
            {/* Add friend (person with +) */}
            <button className="friends-btn friends-btn-add" onClick={() => setShowAddFriend(true)} title={t('friends.add')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="7" r="3.5" />
                <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" />
                <path d="M18 8v6M15 11h6" />
              </svg>
            </button>
            {/* Friends list (two people) */}
            <button className="friends-btn friends-btn-list" onClick={() => setShowFriendsList(true)} title={t('friends.list')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="7" r="3" />
                <circle cx="16" cy="7" r="3" />
                <path d="M2 19c0-3 2.5-5 6-5s6 2 6 5" />
                <path d="M14 14c3.5 0 6 2 6 5" />
              </svg>
            </button>
            {authUser.isAdmin && (
              <button className="friends-btn" onClick={() => setShowConfig(true)} title={t('config.title')}>
                &#9881; {t('config.button')}
              </button>
            )}
            <button className="games-lobby-logout-btn" onClick={logout}>
              {t('auth.logout')}
            </button>
          </div>
        )}
      </div>

      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
      {showAddFriend && <AddFriendModal onClose={() => setShowAddFriend(false)} />}
      {showFriendsList && <FriendsListModal onClose={() => setShowFriendsList(false)} />}

      {/* Action buttons */}
      <div className="games-lobby-actions">
        {authToken && (
          <>
            <button className="games-lobby-create-btn" onClick={() => useGameStore.setState({ menuMode: 'online-create', screen: 'menu' })}>
              {t('lobby.createNew')}
            </button>
            <button className="games-lobby-join-btn" onClick={() => useGameStore.setState({ menuMode: 'online-join', screen: 'menu' })}>
              {t('lobby.joinExisting')}
            </button>
          </>
        )}
        {isAdmin && (
          <button className="games-lobby-purge-btn" onClick={handlePurgeOrphans} disabled={purging}>
            {purging ? '...' : t('admin.purgeOrphans')}
          </button>
        )}
      </div>
      {purgeResult && (
        <div className="games-lobby-purge-result">{purgeResult}</div>
      )}

      {/* Mode filter toggle */}
      <div className="games-lobby-mode-filter">
        <button
          className={`games-lobby-mode-filter-btn ${modeFilter === 'online' ? 'active' : ''}`}
          onClick={() => setModeFilter('online')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <ellipse cx="12" cy="12" rx="4.5" ry="10" />
            <path d="M2 12h20" />
          </svg>
          {t('game.modeOnline')}
        </button>
        <button
          className={`games-lobby-mode-filter-btn ${modeFilter === 'hotseat' ? 'active' : ''}`}
          onClick={() => setModeFilter('hotseat')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <circle cx="8" cy="7" r="3" />
            <circle cx="16" cy="7" r="3" />
            <path d="M2 19c0-3 2.5-5 6-5s6 2 6 5" opacity="0.7" />
            <path d="M10 19c0-3 2.5-5 6-5s6 2 6 5" opacity="0.7" />
          </svg>
          {t('game.modeHotseat')}
        </button>
      </div>

      {/* Waiting lobbies: games you are invited to, host, or open games anyone can join */}
      {modeFilter === 'online' && waitingLobbies.length > 0 && (
        <div className="games-lobby-section">
          <h2 className="games-lobby-section-title">
            {t('lobby.pendingGames')}
            <span className="games-lobby-section-count">{waitingLobbies.length}</span>
          </h2>
          <div className="games-lobby-grid">
            {waitingLobbies.map((l) => {
              const highlight = l.invited || l.isHost || l.isParticipant;
              const canEnter = l.isParticipant || l.isHost || l.invited || l.open;
              return (
                <div
                  key={l.id}
                  className={`games-lobby-card games-lobby-card-waiting${highlight ? ' games-lobby-card-invited' : ''}`}
                  onClick={() => canEnter && handleEnterLobby(l.id)}
                >
                  <div className="games-lobby-card-left">
                    <div className="games-lobby-card-title-row">
                      <span className="games-lobby-card-gamename">{l.name}</span>
                      {l.open && <span className="games-lobby-card-gameid">{t('lobby.openGame')}</span>}
                      <span className="games-lobby-card-created-inline">· {t('lobby.createdOn', { date: formatDate(l.createdAt) })}</span>
                    </div>
                    <span className="games-lobby-card-clans games-lobby-card-clans-grid">
                      {(l.slots || l.players.map(p => ({ ...p, status: 'joined' as const }))).map((slot, i) => (
                        <span
                          key={slot.userId || `open-${slot.clanId}-${i}`}
                          className={`games-lobby-card-clan-entry games-lobby-card-slot-${slot.status}`}
                        >
                          {slot.clanId ? <ClanShield clanId={slot.clanId} size={16} /> : null}
                          {slot.status === 'open' ? (
                            <span style={{ color: getClanColor(slot.clanId) }}>{t('lobby.freeJoin')}</span>
                          ) : (
                            <span style={{ color: slot.status === 'waiting' ? undefined : getClanColor(slot.clanId) }}>
                              {slot.name}{slot.status === 'waiting' ? ` (${t('lobby.waiting')})` : ''}
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="games-lobby-card-right">
                    <span className="games-lobby-card-playercount">{l.playerCount}/{l.maxPlayers}</span>
                    {l.openSlots > 0 && (
                      <span className="games-lobby-card-progress">{t('lobby.openSlots', { count: l.openSlots })}</span>
                    )}
                    <div className="games-lobby-card-actions">
                      <button
                        className={highlight ? 'games-lobby-play-btn' : 'games-lobby-view-btn'}
                        onClick={(e) => { e.stopPropagation(); handleEnterLobby(l.id); }}
                      >
                        {highlight ? t('lobby.play') : t('lobby.join')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Your Turn section */}
      {yourTurnGames.filter(g => g.mode === modeFilter).length > 0 && (
        <div className="games-lobby-section games-lobby-section-your-turn">
          <h2 className="games-lobby-section-title games-lobby-section-title-your-turn">
            {t('lobby.yourTurn')}
            <span className="games-lobby-section-count">{yourTurnGames.filter(g => g.mode === modeFilter).length}</span>
          </h2>
          <div className="games-lobby-grid">
            {yourTurnGames.filter(g => g.mode === modeFilter).map(g => renderGameCard(g, 'your-turn'))}
          </div>
        </div>
      )}

      {/* Waiting section */}
      <div className="games-lobby-section">
        <h2 className="games-lobby-section-title">
          {t('lobby.waiting')}
          {waitingGames.filter(g => g.mode === modeFilter).length > 0 && <span className="games-lobby-section-count">{waitingGames.filter(g => g.mode === modeFilter).length}</span>}
        </h2>
        {waitingGames.filter(g => g.mode === modeFilter).length === 0 ? (
          <p className="games-lobby-empty">{t('lobby.noGamesYet')}</p>
        ) : (
          <div className="games-lobby-grid">
            {waitingGames.filter(g => g.mode === modeFilter).map(g => renderGameCard(g, 'waiting'))}
          </div>
        )}
      </div>

      {/* Finished Games section */}
      <div className="games-lobby-section">
        <h2 className="games-lobby-section-title">
          {t('lobby.finishedGames')}
          {finishedGames.filter(g => g.mode === modeFilter).length > 0 && <span className="games-lobby-section-count">{finishedGames.filter(g => g.mode === modeFilter).length}</span>}
        </h2>
        {finishedGames.filter(g => g.mode === modeFilter).length === 0 ? (
          <p className="games-lobby-empty">{t('lobby.noFinishedGames')}</p>
        ) : (
          <div className="games-lobby-grid">
            {finishedGames.filter(g => g.mode === modeFilter).map(g => renderGameCard(g, 'finished'))}
          </div>
        )}
      </div>

      {/* Back button */}
      <div className="games-lobby-back">
        <button className="btn-secondary" onClick={() => setScreen('menu')}>
          {t('lobby.back')}
        </button>
      </div>

      {/* Password modal */}
      {passwordModal && (
        <div className="password-modal-overlay" onClick={() => setPasswordModal(null)}>
          <div className="password-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('game.enterPassword')}</h3>
            <input
              type="password"
              className="password-modal-input"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit(); }}
              autoFocus
              placeholder={t('game.password')}
            />
            {passwordError && (
              <p className="password-modal-error">{t('game.wrongPassword')}</p>
            )}
            <div className="password-modal-actions">
              <button className="btn-primary" onClick={handlePasswordSubmit}>{t('lobby.resume')}</button>
              <button className="btn-secondary" onClick={() => setPasswordModal(null)}>{t('lobby.back')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
