import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';
import { CLANS } from '../types/game';

interface GameRecord {
  id: string;
  name: string;
  players_json: string;
  status: string;
  created_at: string;
  updated_at: string;
  mode: string;
  winner: string | null;
}

export const GamesLobby = () => {
  const { setScreen, resumeGame, loadReplayGame } = useGameStore();
  const t = useT();
  const [activeGames, setActiveGames] = useState<GameRecord[]>([]);
  const [finishedGames, setFinishedGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const [activeRes, finishedRes] = await Promise.all([
          fetch('http://localhost:3001/api/games?status=active'),
          fetch('http://localhost:3001/api/games?status=finished'),
        ]);
        const active = await activeRes.json();
        const finished = await finishedRes.json();
        setActiveGames(active);
        setFinishedGames(finished);
      } catch {
        // Server might not be running
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  const getClanColor = (clanId: string) => {
    return CLANS.find(c => c.id === clanId)?.color || '#fff';
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const renderGameCard = (game: GameRecord, type: 'active' | 'finished') => {
    const players = JSON.parse(game.players_json || '[]') as { name: string; clanId: string }[];
    return (
      <div key={game.id} className="games-lobby-card">
        <div className="games-lobby-card-header">
          <span className="games-lobby-card-name">{game.name}</span>
          <span className="games-lobby-card-date">{formatDate(game.updated_at || game.created_at)}</span>
        </div>
        <div className="games-lobby-card-players">
          {players.map((p, i) => (
            <span key={i} className="games-lobby-player" style={{ color: getClanColor(p.clanId) }}>
              {p.name}
            </span>
          ))}
        </div>
        {type === 'finished' && game.winner && (
          <div className="games-lobby-card-winner">
            Winner: {game.winner}
          </div>
        )}
        <div className="games-lobby-card-actions">
          {type === 'active' && (
            <button className="btn-primary" onClick={() => resumeGame(game.id)}>
              {t('lobby.resume')}
            </button>
          )}
          {type === 'finished' && (
            <button className="btn-secondary" onClick={() => loadReplayGame(game.id)}>
              {t('lobby.replay')}
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
      <h1 className="games-lobby-title">{t('lobby.title')}</h1>

      <div className="games-lobby-section">
        <h2 className="games-lobby-section-title">{t('lobby.activeGames')}</h2>
        {activeGames.length === 0 ? (
          <p className="games-lobby-empty">{t('lobby.noActiveGames')}</p>
        ) : (
          <div className="games-lobby-grid">
            {activeGames.map(g => renderGameCard(g, 'active'))}
          </div>
        )}
      </div>

      <div className="games-lobby-section">
        <h2 className="games-lobby-section-title">{t('lobby.finishedGames')}</h2>
        {finishedGames.length === 0 ? (
          <p className="games-lobby-empty">{t('lobby.noFinishedGames')}</p>
        ) : (
          <div className="games-lobby-grid">
            {finishedGames.map(g => renderGameCard(g, 'finished'))}
          </div>
        )}
      </div>

      <div className="games-lobby-back">
        <button className="btn-secondary" onClick={() => setScreen('menu')}>
          {t('lobby.back')}
        </button>
      </div>
    </div>
  );
};
