import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';

export const GameLog = () => {
  const { gameState } = useGameStore();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  useEffect(() => {
    if (ref.current && selectedSeason === null) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [gameState?.log, selectedSeason]);

  if (!gameState) return null;

  const currentSeason = gameState.currentSeason;
  const logHistory = gameState.logHistory ?? {};

  // Build the list of seasons that have logs (in order)
  const seasonOrder = ['spring', 'summer', 'autumn', 'winter'];
  const availableSeasons = seasonOrder.filter(
    (s) => s === currentSeason || logHistory[s]
  );

  const seasonTranslationKeys: Record<string, TranslationKey> = {
    spring: 'season.spring',
    summer: 'season.summer',
    autumn: 'season.autumn',
    winter: 'season.winter',
  };

  // Determine which log to display
  const activeTab = selectedSeason ?? currentSeason;
  const displayLog =
    activeTab === currentSeason
      ? gameState.log
      : logHistory[activeTab] ?? [];

  return (
    <div className="game-log">
      <h4>Game Log</h4>
      {availableSeasons.length > 1 && (
        <div className="log-season-tabs">
          {availableSeasons.map((season) => (
            <button
              key={season}
              className={`log-season-tab ${activeTab === season ? 'active' : ''}`}
              onClick={() => setSelectedSeason(season === currentSeason ? null : season)}
            >
              {t(seasonTranslationKeys[season])}
            </button>
          ))}
        </div>
      )}
      <div className="log-entries" ref={ref}>
        {displayLog.slice(-20).map((e, i) => (
          <div key={i} className="log-entry">{e}</div>
        ))}
      </div>
    </div>
  );
};
