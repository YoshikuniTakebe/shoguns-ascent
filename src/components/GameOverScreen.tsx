import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { useT } from '../i18n';

export const GameOverScreen = () => {
  const { gameState } = useGameStore();
  const t = useT();
  if (!gameState) return null;

  const winner = gameState.players.find(p => p.id === gameState.winner);
  const wClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;
  const sorted = [...gameState.players].sort((a, b) => {
    if (b.victoryPoints !== a.victoryPoints) return b.victoryPoints - a.victoryPoints;
    return b.honor - a.honor; // Honor tiebreaker
  });

  return (
    <div className="game-over-screen">
      <div className="game-over-content">
        <h1 className="game-over-title">{t('gameOver.title')}</h1>

        {winner && wClan && (
          <div className="winner-announcement" style={{ borderColor: wClan.color }}>
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
                    <td>{c.name}</td>
                    <td className="vp-cell">{p.victoryPoints}</td>
                    <td>{p.honor}</td>
                    <td>{p.warProvinceTokens.length}</td>
                    <td>{p.seasonCards.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Scoring Breakdown */}
        <div className="scoring-breakdown">
          <h3>{t('gameOver.warProvinceTokens')}</h3>
          {sorted.map(p => {
            const c = CLANS.find(x => x.id === p.clanId)!;
            if (p.warProvinceTokens.length === 0) return null;
            const bySeason: Record<string, number> = {};
            for (const tok of p.warProvinceTokens) {
              bySeason[tok.season] = (bySeason[tok.season] || 0) + 1;
            }
            return (
              <div key={p.id} className="player-token-breakdown" style={{ borderColor: c.color }}>
                <span style={{ color: c.color }}>{p.name}:</span>
                {Object.entries(bySeason).map(([season, count]) => (
                  <span key={season} className="token-season">{season}: {count}</span>
                ))}
                <span className="token-total">Total: {p.warProvinceTokens.length}</span>
              </div>
            );
          })}
        </div>

        <div className="game-over-actions">
          <button className="btn-primary" onClick={() => useGameStore.setState({ gameState: null, screen: 'menu' })}>
            {t('gameOver.returnToMenu')}
          </button>
        </div>
      </div>
    </div>
  );
};
