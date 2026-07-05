import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { API_BASE } from '../config';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
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

export const GamesLobby = () => {
  const { setScreen, resumeGame, loadReplayGame, authToken, authUser, logout } = useGameStore();
  const t = useT();
  const [yourTurnGames, setYourTurnGames] = useState<GameRecord[]>([]);
  const [waitingGames, setWaitingGames] = useState<GameRecord[]>([]);
  const [finishedGames, setFinishedGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const headers: Record<string, string> = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        if (authToken) {
          const res = await fetch(`${API_BASE}/api/games/my-games`, { headers });
          const games: GameRecord[] = await res.json();
          const active = games.filter((g) => g.status === 'active');
          const finished = games.filter((g) => g.status === 'finished');

          // Separate active games into "your turn" and "waiting"
          const currentUserId = authUser?.id || '';
          const yourTurn: GameRecord[] = [];
          const waiting: GameRecord[] = [];

          for (const game of active) {
            if (game.currentPlayerIndex != null && game.players[game.currentPlayerIndex]) {
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
          setFinishedGames(finished);
        } else {
          const [activeRes, finishedRes] = await Promise.all([
            fetch(`${API_BASE}/api/games?status=active`),
            fetch(`${API_BASE}/api/games?status=finished`),
          ]);
          const active = await activeRes.json();
          const finished = await finishedRes.json();
          setYourTurnGames([]);
          setWaitingGames(active);
          setFinishedGames(finished);
        }
      } catch {
        // Server might not be running
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, [authToken, authUser]);

  const getClanColor = (clanId: string) => {
    return CLANS.find(c => c.id === clanId)?.color || '#fff';
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
        loadReplayGame(game.id);
      } else {
        resumeGame(game.id);
      }
    };

    return (
      <div
        key={game.id}
        className={cardClass}
        onClick={() => type === 'finished' ? loadReplayGame(game.id) : resumeGame(game.id)}
      >
        <div className="games-lobby-card-header">
          <span className="games-lobby-card-gamename">{game.name}</span>
          <span className="games-lobby-card-date">{formatDate(game.updatedAt || game.createdAt)}</span>
        </div>
        <div className="games-lobby-card-body">
          <span className="games-lobby-card-clans">
            {game.players.map((p, i) => (
              <span
                key={i}
                className={`games-lobby-card-clan-entry${type !== 'finished' && game.currentPlayerIndex === i ? ' games-lobby-card-clan-entry-active' : ''}`}
              >
                <ClanShield clanId={p.clanId} size={18} />
                <span style={{ color: getClanColor(p.clanId) }}>{p.name}</span>
              </span>
            ))}
          </span>
          <div className="games-lobby-card-info">
            {game.lastSeason && (
              <span className="games-lobby-card-progress">{getProgressPoint(game)}</span>
            )}
            {type !== 'finished' && game.currentPlayerIndex != null && game.players[game.currentPlayerIndex] && (() => {
              const currentPlayer = game.players[game.currentPlayerIndex!];
              const clanColor = getClanColor(currentPlayer.clanId);
              return (
                <span className="games-lobby-card-turn" style={{ color: clanColor }}>
                  {t('lobby.turnOf')} <ClanShield clanId={currentPlayer.clanId} size={14} /> {currentPlayer.name}
                </span>
              );
            })()}
          </div>
        </div>
        <div className="games-lobby-card-actions">
          {type === 'your-turn' && (
            <button className="games-lobby-play-btn" onClick={handleAction}>
              {t('lobby.play')}
            </button>
          )}
          {type === 'waiting' && (
            <button className="games-lobby-view-btn" onClick={handleAction}>
              {t('lobby.view')}
            </button>
          )}
          {type === 'finished' && (
            <button className="games-lobby-view-btn" onClick={handleAction}>
              {t('lobby.replay')}
            </button>
          )}
          {isAdmin && (
            <button className="games-lobby-delete-btn" onClick={(e) => handleDeleteGame(e, game.id)} title={t('admin.deleteGame')}>
              ✕
            </button>
          )}
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
            <button className="games-lobby-logout-btn" onClick={logout}>
              {t('auth.logout')}
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="games-lobby-actions">
        <button className="games-lobby-create-btn" onClick={() => setScreen('menu')}>
          {t('lobby.createNew')}
        </button>
        <button className="games-lobby-join-btn" onClick={() => setScreen('menu')}>
          {t('lobby.joinExisting')}
        </button>
        {isAdmin && (
          <button className="games-lobby-purge-btn" onClick={handlePurgeOrphans} disabled={purging}>
            {purging ? '...' : t('admin.purgeOrphans')}
          </button>
        )}
      </div>
      {purgeResult && (
        <div className="games-lobby-purge-result">{purgeResult}</div>
      )}

      {/* Your Turn section */}
      {yourTurnGames.length > 0 && (
        <div className="games-lobby-section games-lobby-section-your-turn">
          <h2 className="games-lobby-section-title games-lobby-section-title-your-turn">
            {t('lobby.yourTurn')}
            <span className="games-lobby-section-count">{yourTurnGames.length}</span>
          </h2>
          <div className="games-lobby-grid">
            {yourTurnGames.map(g => renderGameCard(g, 'your-turn'))}
          </div>
        </div>
      )}

      {/* Waiting section */}
      <div className="games-lobby-section">
        <h2 className="games-lobby-section-title">
          {t('lobby.waiting')}
          {waitingGames.length > 0 && <span className="games-lobby-section-count">{waitingGames.length}</span>}
        </h2>
        {waitingGames.length === 0 ? (
          <p className="games-lobby-empty">{t('lobby.noGamesYet')}</p>
        ) : (
          <div className="games-lobby-grid">
            {waitingGames.map(g => renderGameCard(g, 'waiting'))}
          </div>
        )}
      </div>

      {/* Finished Games section */}
      <div className="games-lobby-section">
        <h2 className="games-lobby-section-title">
          {t('lobby.finishedGames')}
          {finishedGames.length > 0 && <span className="games-lobby-section-count">{finishedGames.length}</span>}
        </h2>
        {finishedGames.length === 0 ? (
          <p className="games-lobby-empty">{t('lobby.noFinishedGames')}</p>
        ) : (
          <div className="games-lobby-grid">
            {finishedGames.map(g => renderGameCard(g, 'finished'))}
          </div>
        )}
      </div>

      {/* Back button */}
      <div className="games-lobby-back">
        <button className="btn-secondary" onClick={() => setScreen('menu')}>
          {t('lobby.back')}
        </button>
      </div>
    </div>
  );
};
