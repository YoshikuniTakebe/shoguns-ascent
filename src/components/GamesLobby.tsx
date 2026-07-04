import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import titleImg from '../img/NoboruTaiyo.png';

interface GameRecord {
  id: string;
  name: string;
  players: { name: string; clanId: string }[];
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

  const renderGameCard = (game: GameRecord, type: 'active' | 'finished') => {
    const cardClass = type === 'active' ? 'games-lobby-card games-lobby-card-active' : 'games-lobby-card games-lobby-card-finished';
    return (
      <div
        key={game.id}
        className={cardClass}
        onClick={() => type === 'active' ? resumeGame(game.id) : loadReplayGame(game.id)}
      >
        <span className="games-lobby-card-gamename">{game.name}</span>
        <span className="games-lobby-card-playercount">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          <strong>{game.players.length}</strong>
        </span>
        <span className="games-lobby-card-clans">
          {game.players.map((p, i) => (
            <span key={i} className={`games-lobby-card-clan-entry${type === 'active' && game.currentPlayerIndex === i ? ' games-lobby-card-clan-entry-active' : ''}`}>
              <ClanShield clanId={p.clanId} size={18} />
              <span style={{ color: getClanColor(p.clanId) }}>{p.name}</span>
            </span>
          ))}
        </span>
        <span className="games-lobby-card-progress">{getProgressPoint(game)}</span>
        <span className="games-lobby-card-date">{formatDate(game.updatedAt || game.createdAt)}</span>
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
      <img src={titleImg} alt="Noboru Taiyo" className="games-lobby-title-img" />
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
