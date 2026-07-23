import { useState, type ReactNode } from 'react';
import type { GameState, Player, Season, SeasonCard } from '../types/game';
import { CLANS } from '../types/game';
import { useT, type TranslationKey } from '../i18n';
import { scoreWinterUpgrade } from '../utils/gameLogic';
import { ClanShield } from './ClanShields';
import { AutumnIcon, SpringIcon, SummerIcon, VPIcon, WinterIcon } from './Icons';
import { renderLogEntry } from './GameLog';

type ScoringBreakdown = {
  spring: { count: number; vp: number };
  summer: { count: number; vp: number };
  autumn: { count: number; vp: number };
  tokenVP: number;
  uniqueCount: number;
  setVP: number;
  winterCards: { card: SeasonCard; vp: number }[];
  winterVP: number;
  winterTotal: number;
};

function computeWinterScoringBreakdown(player: Player, gameState: GameState): ScoringBreakdown {
  const counts = { spring: 0, summer: 0, autumn: 0 };
  player.warProvinceTokens.forEach((token) => {
    if (token.season === 'spring' || token.season === 'summer' || token.season === 'autumn') {
      counts[token.season] += 1;
    }
  });

  const spring = { count: counts.spring, vp: counts.spring };
  const summer = { count: counts.summer, vp: counts.summer * 2 };
  const autumn = { count: counts.autumn, vp: counts.autumn * 3 };
  const tokenVP = spring.vp + summer.vp + autumn.vp;
  const uniqueCount = new Set(player.warProvinceTokens.map((token) => token.provinceId)).size;
  const setVP = uniqueCount >= 7 ? 30 : uniqueCount >= 5 ? 20 : uniqueCount >= 3 ? 10 : 0;
  const winterCards = player.seasonCards
    .filter((card) => card.cardType === 'winterUpgrade')
    .map((card) => ({ card, vp: scoreWinterUpgrade(gameState, player, card) }));
  const winterVP = winterCards.reduce((total, item) => total + item.vp, 0);

  return {
    spring,
    summer,
    autumn,
    tokenVP,
    uniqueCount,
    setVP,
    winterCards,
    winterVP,
    winterTotal: tokenVP + setVP + winterVP,
  };
}

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

const SEASON_KEYS: Record<Season, TranslationKey> = {
  spring: 'season.spring',
  summer: 'season.summer',
  autumn: 'season.autumn',
  winter: 'season.winter',
};

const SEASON_COLORS: Record<Season, string> = {
  spring: '#FFB7C5',
  summer: '#FF6B35',
  autumn: '#D4A574',
  winter: '#A8C8E8',
};

const seasonIcon = (season: Season): ReactNode => {
  switch (season) {
    case 'spring': return <SpringIcon size={17} color="#1a1a2e" />;
    case 'summer': return <SummerIcon size={17} color="#1a1a2e" />;
    case 'autumn': return <AutumnIcon size={17} color="#1a1a2e" />;
    case 'winter': return <WinterIcon size={17} color="#1a1a2e" />;
  }
};

function getPublicSeasonLog(gameState: GameState, season: Season): string[] {
  const archived = gameState.logHistory?.[season] ?? [];
  if (season !== 'autumn') return archived;
  if (archived.length > 0) return archived;

  const winterStart = gameState.log.findIndex((entry) =>
    /Invierno\s*-\s*Puntuaci/i.test(entry) || /Winter\s*-\s*Final Scoring/i.test(entry)
  );
  return winterStart >= 0 ? gameState.log.slice(0, winterStart) : gameState.log;
}

function mergePrivateEntries(
  publicEntries: string[],
  gameState: GameState,
  season: Season,
  localPlayerId: string | null,
): string[] {
  const privateEntries = (gameState.privateLogEntries ?? [])
    .filter((entry) => entry.season === season && (
      gameState.mode === 'hotseat' || (!!localPlayerId && entry.playerIds.includes(localPlayerId))
    ));
  const result: string[] = [];

  for (let index = 0; index <= publicEntries.length; index += 1) {
    privateEntries
      .filter((entry) => entry.logIndex === index)
      .forEach((entry) => result.push(entry.text));
    if (index < publicEntries.length) result.push(publicEntries[index]);
  }
  return result;
}

type FinalGameLogModalProps = {
  gameState: GameState;
  localPlayerId: string | null;
  onClose: () => void;
};

export const FinalGameLogModal = ({ gameState, localPlayerId, onClose }: FinalGameLogModalProps) => {
  const t = useT();
  const [activeSeason, setActiveSeason] = useState<Season>('spring');
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (b.victoryPoints !== a.victoryPoints) return b.victoryPoints - a.victoryPoints;
    return gameState.honorTrack.indexOf(a.id) - gameState.honorTrack.indexOf(b.id);
  });
  const displayLog = activeSeason === 'winter'
    ? []
    : mergePrivateEntries(getPublicSeasonLog(gameState, activeSeason), gameState, activeSeason, localPlayerId);

  return (
    <div className="final-log-backdrop" onClick={onClose}>
      <section
        className="final-log-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="final-log-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="final-log-header">
          <h2 id="final-log-title">{t('gameOver.fullLog')}</h2>
          <button className="final-log-close" onClick={onClose} aria-label={t('gameOver.closeLog')}>&times;</button>
        </header>

        <div className="final-log-tabs" role="tablist">
          {SEASONS.map((season) => {
            const color = SEASON_COLORS[season];
            const active = season === activeSeason;
            return (
              <button
                key={season}
                className={`final-log-tab${active ? ' active' : ''}`}
                style={{ borderColor: color, backgroundColor: active ? color : `${color}22` }}
                onClick={() => setActiveSeason(season)}
                role="tab"
                aria-selected={active}
              >
                {seasonIcon(season)}
                {t(SEASON_KEYS[season])}
              </button>
            );
          })}
        </div>

        <div className="final-log-content">
          {activeSeason !== 'winter' ? (
            displayLog.length > 0 ? (
              displayLog.map((entry, index) => (
                <div key={`${index}-${entry.slice(0, 30)}`} className="final-log-entry">
                  {renderLogEntry(entry, gameState.players)}
                </div>
              ))
            ) : (
              <p className="final-log-empty">{t('gameOver.noLogEntries')}</p>
            )
          ) : (
            <div className="winter-score-log">
              {sortedPlayers.map((player) => {
                const clan = CLANS.find((item) => item.id === player.clanId);
                const breakdown = computeWinterScoringBreakdown(player, gameState);
                return (
                  <section key={player.id} className="winter-score-player" style={{ borderColor: clan?.color }}>
                    <h3 style={{ color: clan?.color }}>
                      <ClanShield clanId={player.clanId} size={28} />
                      {player.name}
                    </h3>
                    <div className="winter-score-row">
                      <span><SpringIcon size={17} color="#e8b4d8" /> {t('gameOver.springTokens')} ({breakdown.spring.count} x 1)</span>
                      <strong>{breakdown.spring.vp} <VPIcon size={16} /></strong>
                    </div>
                    <div className="winter-score-row">
                      <span><SummerIcon size={17} color="#f5c842" /> {t('gameOver.summerTokens')} ({breakdown.summer.count} x 2)</span>
                      <strong>{breakdown.summer.vp} <VPIcon size={16} /></strong>
                    </div>
                    <div className="winter-score-row">
                      <span><AutumnIcon size={17} color="#e87040" /> {t('gameOver.autumnTokens')} ({breakdown.autumn.count} x 3)</span>
                      <strong>{breakdown.autumn.vp} <VPIcon size={16} /></strong>
                    </div>
                    <div className="winter-score-row">
                      <span>{t('gameOver.provinceSet')} ({breakdown.uniqueCount})</span>
                      <strong>{breakdown.setVP} <VPIcon size={16} /></strong>
                    </div>
                    {breakdown.winterCards.map(({ card, vp }, index) => (
                      <div className="winter-score-row" key={`${card.id}-${index}`}>
                        <span>{card.name}</span>
                        <strong>{vp} <VPIcon size={16} /></strong>
                      </div>
                    ))}
                    <div className="winter-score-total" style={{ color: clan?.color }}>
                      <span>{t('gameOver.winterTotal')}</span>
                      <strong>{breakdown.winterTotal} <VPIcon size={19} /></strong>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
