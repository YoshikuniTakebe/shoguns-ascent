import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { Player, Season } from '../types/game';
import { useT } from '../i18n';
import { ClanShield } from './ClanShields';
import { SpringIcon, SummerIcon, AutumnIcon, WinterIcon, WarTokenIcon } from './Icons';
import { WarTokensModal } from './WarTokensModal';
import { PlayerCardsModal } from './PlayerCardsModal';

const SeasonIcon = ({ season }: { season: string }) => {
  switch (season) {
    case 'spring': return <SpringIcon size={18} color="#e8b4d8" />;
    case 'summer': return <SummerIcon size={18} color="#f5c842" />;
    case 'autumn': return <AutumnIcon size={18} color="#e87040" />;
    case 'winter': return <WinterIcon size={18} color="#5bc0eb" />;
    default: return null;
  }
};

export const GameOverScreen = () => {
  const { gameState } = useGameStore();
  const t = useT();
  const [viewingWarTokensPlayer, setViewingWarTokensPlayer] = useState<Player | null>(null);
  const [viewingCardsPlayer, setViewingCardsPlayer] = useState<Player | null>(null);

  if (!gameState) return null;

  const winner = gameState.players.find(p => p.id === gameState.winner);
  const wClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;
  const sorted = [...gameState.players].sort((a, b) => {
    if (b.victoryPoints !== a.victoryPoints) return b.victoryPoints - a.victoryPoints;
    return b.honor - a.honor;
  });

  // Collect all seasons that appear in war province tokens
  const allSeasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
  const seasonsWithTokens = allSeasons.filter(s =>
    sorted.some(p => p.warProvinceTokens.some(tok => tok.season === s))
  );

  return (
    <div className="game-over-screen">
      <div className="game-over-content">
        <h1 className="game-over-title">{t('gameOver.title')}</h1>

        {winner && wClan && (
          <>
            <div className="winner-seal">
              <ClanShield clanId={wClan.id} size={120} />
            </div>
            <div className="winner-announcement" style={{ borderColor: wClan.color }}>
              <div className="winner-announcement-glow" style={{ background: `radial-gradient(ellipse at center, ${wClan.color}22 0%, transparent 70%)` }} />
              <h2 style={{ color: wClan.color }}>{winner.name} of {wClan.name}</h2>
              <p className="winner-subtitle">{t('gameOver.ascended')}</p>
              <div className="winner-vp">{winner.victoryPoints} VP</div>
              {winner.allies.length > 0 && (
                <div className="shared-victory">
                  <p>{t('gameOver.sharedVictory')}</p>
                  <ul>
                    {winner.allies.map(allyId => {
                      const ally = gameState.players.find(p => p.id === allyId);
                      return ally ? <li key={allyId}>{ally.name}</li> : null;
                    })}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

        <div className="final-standings">
          <h3>{t('gameOver.finalStandings')}</h3>
          <table className="standings-table">
            <thead>
              <tr>
                <th>{t('gameOver.rank')}</th>
                <th>{t('gameOver.player')}</th>
                <th>{t('gameOver.clan')}</th>
                <th>{t('gameOver.vp')}</th>
                <th>{t('gameOver.honor')}</th>
                <th>{t('gameOver.warTokens')}</th>
                <th>{t('gameOver.cards')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const c = CLANS.find(x => x.id === p.clanId)!;
                return (
                  <tr key={p.id} className={i === 0 ? 'winner-row' : ''}>
                    <td>{i + 1}</td>
                    <td style={{ color: c.color }}>{p.name}</td>
                    <td>
                      <span className="standings-clan-cell">
                        <ClanShield clanId={c.id} size={20} />
                        <span style={{ color: c.color, fontWeight: 'bold', fontStyle: 'italic' }}>{c.name}</span>
                      </span>
                    </td>
                    <td className="vp-cell">{p.victoryPoints}</td>
                    <td>{p.honor}</td>
                    <td>
                      <button
                        className="war-token-btn"
                        onClick={() => setViewingWarTokensPlayer(p)}
                        style={{ borderColor: c.color }}
                      >
                        <WarTokenIcon size={14} color={c.color} />
                        <span className="icon-btn-badge">{p.warProvinceTokens.length}</span>
                      </button>
                    </td>
                    <td>
                      <button
                        className="player-cards-btn"
                        onClick={() => setViewingCardsPlayer(p)}
                        style={{ borderColor: c.color }}
                      >
                        🎴 <span className="icon-btn-badge">{p.seasonCards.length}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Scoring Breakdown */}
        <div className="scoring-breakdown">
          <h3>{t('gameOver.warProvinceTokens')}</h3>
          {seasonsWithTokens.length > 0 && (
            <table className="scoring-breakdown-table">
              <thead>
                <tr>
                  <th>{t('gameOver.player')}</th>
                  {seasonsWithTokens.map(season => (
                    <th key={season}><SeasonIcon season={season} /></th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => {
                  const c = CLANS.find(x => x.id === p.clanId)!;
                  if (p.warProvinceTokens.length === 0) return null;
                  const bySeason: Record<string, number> = {};
                  for (const tok of p.warProvinceTokens) {
                    bySeason[tok.season] = (bySeason[tok.season] || 0) + 1;
                  }
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="scoring-player-cell">
                          <ClanShield clanId={c.id} size={18} />
                          <span style={{ color: c.color, fontWeight: 'bold' }}>{p.name}</span>
                        </span>
                      </td>
                      {seasonsWithTokens.map(season => (
                        <td key={season} className="scoring-season-cell">
                          {bySeason[season] || 0}
                        </td>
                      ))}
                      <td className="scoring-total-cell">{p.warProvinceTokens.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="game-over-actions">
          <button className="btn-primary" onClick={() => useGameStore.setState({ gameState: null, screen: 'menu' })}>
            {t('gameOver.returnToMenu')}
          </button>
        </div>
      </div>

      {viewingWarTokensPlayer && (
        <WarTokensModal player={viewingWarTokensPlayer} onClose={() => setViewingWarTokensPlayer(null)} />
      )}
      {viewingCardsPlayer && (
        <PlayerCardsModal player={viewingCardsPlayer} onClose={() => setViewingCardsPlayer(null)} />
      )}
    </div>
  );
};
