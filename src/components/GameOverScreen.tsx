import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { Player, Season, GameState, SeasonCard } from '../types/game';
import { useT } from '../i18n';
import { ClanShield } from './ClanShields';
import { SpringIcon, SummerIcon, AutumnIcon, WinterIcon, WarTokenIcon } from './Icons';
import { WarTokensModal } from './WarTokensModal';
import { PlayerCardsModal } from './PlayerCardsModal';
import { scoreWinterUpgrade } from '../utils/gameLogic';
import titleImg from '../img/NoboruTaiyo.png';

const SeasonIcon = ({ season }: { season: string }) => {
  switch (season) {
    case 'spring': return <SpringIcon size={18} color="#e8b4d8" />;
    case 'summer': return <SummerIcon size={18} color="#f5c842" />;
    case 'autumn': return <AutumnIcon size={18} color="#e87040" />;
    case 'winter': return <WinterIcon size={18} color="#5bc0eb" />;
    default: return null;
  }
};

function computeScoringBreakdown(player: Player, gameState: GameState) {
  // War Province Tokens scoring
  let springCount = 0, summerCount = 0, autumnCount = 0;
  player.warProvinceTokens.forEach(token => {
    switch (token.season) {
      case 'spring': springCount++; break;
      case 'summer': summerCount++; break;
      case 'autumn': autumnCount++; break;
    }
  });
  const tokenVP = springCount * 1 + summerCount * 2 + autumnCount * 3;

  // Province Set bonus
  const uniqueProvinces = new Set(player.warProvinceTokens.map(t => t.provinceId));
  const uniqueCount = uniqueProvinces.size;
  let setVP = 0;
  if (uniqueCount >= 7) setVP = 30;
  else if (uniqueCount >= 5) setVP = 20;
  else if (uniqueCount >= 3) setVP = 10;

  // Winter Upgrade Cards
  const winterCards: { card: SeasonCard; vp: number }[] = [];
  player.seasonCards.forEach(card => {
    if (card.cardType === 'winterUpgrade') {
      const vp = scoreWinterUpgrade(gameState, player, card);
      winterCards.push({ card, vp });
    }
  });
  const winterVP = winterCards.reduce((sum, wc) => sum + wc.vp, 0);

  // Pre-winter VP = total - tokenVP - setVP - winterVP
  const preWinterVP = player.victoryPoints - tokenVP - setVP - winterVP;

  return {
    spring: { count: springCount, vp: springCount * 1 },
    summer: { count: summerCount, vp: summerCount * 2 },
    autumn: { count: autumnCount, vp: autumnCount * 3 },
    tokenVP,
    uniqueCount,
    setVP,
    winterCards,
    winterVP,
    preWinterVP,
    total: player.victoryPoints,
  };
}

export const GameOverScreen = () => {
  const { gameState } = useGameStore();
  const t = useT();
  const [viewingWarTokensPlayer, setViewingWarTokensPlayer] = useState<Player | null>(null);
  const [viewingCardsPlayer, setViewingCardsPlayer] = useState<Player | null>(null);
  const [scoringBreakdownPlayer, setScoringBreakdownPlayer] = useState<Player | null>(null);

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
        <img src={titleImg} alt="Noboru Taiyo" className="game-over-title-img" />
        <h1 className="game-over-title game-over-title-animated">{t('gameOver.title')}</h1>

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
                    <td>
                      <span
                        className="scoring-breakdown-link"
                        style={{ color: c.color, cursor: 'pointer' }}
                        onClick={() => setScoringBreakdownPlayer(p)}
                      >
                        {p.name}
                      </span>
                    </td>
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

      {scoringBreakdownPlayer && (() => {
        const p = scoringBreakdownPlayer;
        const c = CLANS.find(x => x.id === p.clanId)!;
        const breakdown = computeScoringBreakdown(p, gameState);
        return (
          <div className="scoring-modal-backdrop" onClick={() => setScoringBreakdownPlayer(null)}>
            <div className="scoring-modal" onClick={e => e.stopPropagation()}>
              <button className="scoring-modal-close" onClick={() => setScoringBreakdownPlayer(null)}>&times;</button>
              <h2 className="scoring-modal-title" style={{ color: c.color }}>
                <ClanShield clanId={c.id} size={28} />
                {p.name} - Desglose de Puntos
              </h2>

              {/* War Province Tokens */}
              <div className="scoring-modal-section">
                <h4>Fichas de Provincia en Guerra</h4>
                <div className="scoring-modal-tokens">
                  <div className="scoring-token-row">
                    <span className="scoring-token-season"><SpringIcon size={16} color="#e8b4d8" /> Primavera</span>
                    <span className="scoring-token-count">{breakdown.spring.count} x 1 VP</span>
                    <span className="scoring-token-vp">{breakdown.spring.vp} VP</span>
                  </div>
                  <div className="scoring-token-row">
                    <span className="scoring-token-season"><SummerIcon size={16} color="#f5c842" /> Verano</span>
                    <span className="scoring-token-count">{breakdown.summer.count} x 2 VP</span>
                    <span className="scoring-token-vp">{breakdown.summer.vp} VP</span>
                  </div>
                  <div className="scoring-token-row">
                    <span className="scoring-token-season"><AutumnIcon size={16} color="#e87040" /> Otono</span>
                    <span className="scoring-token-count">{breakdown.autumn.count} x 3 VP</span>
                    <span className="scoring-token-vp">{breakdown.autumn.vp} VP</span>
                  </div>
                  <div className="scoring-token-row scoring-token-subtotal">
                    <span>Total Fichas</span>
                    <span></span>
                    <span className="scoring-token-vp">{breakdown.tokenVP} VP</span>
                  </div>
                </div>
              </div>

              {/* Province Set Bonus */}
              <div className="scoring-modal-section">
                <h4>Bonus por Set de Provincias</h4>
                <p className="scoring-set-info">
                  Provincias distintas: {breakdown.uniqueCount}
                  {breakdown.uniqueCount >= 3 && breakdown.uniqueCount <= 4 && ' (3-4 = 10 VP)'}
                  {breakdown.uniqueCount >= 5 && breakdown.uniqueCount <= 6 && ' (5-6 = 20 VP)'}
                  {breakdown.uniqueCount >= 7 && ' (7-8 = 30 VP)'}
                  {breakdown.uniqueCount < 3 && ' (necesitas 3+ para bonus)'}
                </p>
                <div className="scoring-token-row scoring-token-subtotal">
                  <span>Bonus Set</span>
                  <span></span>
                  <span className="scoring-token-vp">{breakdown.setVP} VP</span>
                </div>
              </div>

              {/* Winter Upgrade Cards */}
              <div className="scoring-modal-section">
                <h4>Cartas de Puntuacion (Invierno)</h4>
                {breakdown.winterCards.length > 0 ? (
                  <div className="scoring-modal-tokens">
                    {breakdown.winterCards.map((wc, idx) => (
                      <div key={idx} className="scoring-token-row">
                        <span className="scoring-token-season">{wc.card.name}</span>
                        <span></span>
                        <span className="scoring-token-vp">{wc.vp} VP</span>
                      </div>
                    ))}
                    <div className="scoring-token-row scoring-token-subtotal">
                      <span>Total Cartas</span>
                      <span></span>
                      <span className="scoring-token-vp">{breakdown.winterVP} VP</span>
                    </div>
                  </div>
                ) : (
                  <p className="scoring-set-info">Sin cartas de puntuacion</p>
                )}
              </div>

              {/* Pre-winter VP */}
              <div className="scoring-modal-section">
                <h4>Puntos antes del Invierno</h4>
                <div className="scoring-token-row scoring-token-subtotal">
                  <span>VP acumulados durante la partida</span>
                  <span></span>
                  <span className="scoring-token-vp">{breakdown.preWinterVP} VP</span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="scoring-modal-grand-total" style={{ color: c.color, textShadow: `0 0 20px ${c.color}, 0 0 40px ${c.color}` }}>
                {breakdown.total} VP
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
