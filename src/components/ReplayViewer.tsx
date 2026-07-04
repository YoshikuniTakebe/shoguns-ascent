import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';
import { CLANS } from '../types/game';

export const ReplayViewer = () => {
  const {
    setScreen,
    replaySnapshots,
    replayCurrentIndex,
    replayTotalSnapshots,
    replayGameMetadata,
    replayNext,
    replayPrev,
    replayNextKami,
    replayPrevKami,
    replayNextBattle,
    replayPrevBattle,
  } = useGameStore();
  const t = useT();

  const currentSnapshot = replaySnapshots[replayCurrentIndex];
  const gameState = currentSnapshot?.state;

  const getClanColor = (clanId: string) => {
    return CLANS.find(c => c.id === clanId)?.color || '#fff';
  };

  return (
    <div className="replay-viewer">
      <div className="replay-header">
        <button className="btn-secondary replay-back-btn" onClick={() => setScreen('games-lobby')}>
          {t('replay.back')}
        </button>
        <h1 className="replay-title">
          {t('replay.title')}: {replayGameMetadata?.name || ''}
        </h1>
      </div>

      {gameState && (
        <div className="replay-content">
          <div className="replay-info-panel">
            <div className="replay-players">
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className="replay-player-card"
                  style={{ borderLeftColor: getClanColor(player.clanId) }}
                >
                  <div className="replay-player-name" style={{ color: getClanColor(player.clanId) }}>
                    {player.name}
                  </div>
                  <div className="replay-player-stats">
                    <span>VP: {player.victoryPoints}</span>
                    <span>Coins: {player.coins}</span>
                    <span>Ronin: {player.ronin}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="replay-state-info">
              <div className="replay-phase">
                <strong>Phase:</strong> {currentSnapshot.phase}
              </div>
              <div className="replay-season">
                <strong>Season:</strong> {currentSnapshot.season}
              </div>
              {currentSnapshot.description && (
                <div className="replay-description">
                  <strong>{t('replay.description')}:</strong> {currentSnapshot.description}
                </div>
              )}
            </div>

            {gameState.provinces && (
              <div className="replay-provinces-summary">
                {Object.values(gameState.provinces)
                  .filter(p => p.figures && p.figures.length > 0)
                  .slice(0, 8)
                  .map(province => (
                    <div key={province.id} className="replay-province-item">
                      <span className="replay-province-name">{province.name}</span>
                      <span className="replay-province-figures">
                        {province.figures.length} figures
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="replay-controls">
        <div className="replay-controls-row">
          <button
            className="replay-ctrl-btn"
            onClick={() => useGameStore.setState({ replayCurrentIndex: 0 })}
            disabled={replayCurrentIndex === 0}
            title={t('replay.first')}
          >
            |&lt;&lt;
          </button>
          <button
            className="replay-ctrl-btn"
            onClick={replayPrevKami}
            disabled={replayCurrentIndex === 0}
            title={t('replay.prevKami')}
          >
            &lt;&lt;
          </button>
          <button
            className="replay-ctrl-btn"
            onClick={replayPrev}
            disabled={replayCurrentIndex === 0}
            title={t('replay.prevStep')}
          >
            &lt;
          </button>
          <span className="replay-step-counter">
            {replayCurrentIndex + 1} / {replayTotalSnapshots}
          </span>
          <button
            className="replay-ctrl-btn"
            onClick={replayNext}
            disabled={replayCurrentIndex >= replayTotalSnapshots - 1}
            title={t('replay.nextStep')}
          >
            &gt;
          </button>
          <button
            className="replay-ctrl-btn"
            onClick={replayNextKami}
            disabled={replayCurrentIndex >= replayTotalSnapshots - 1}
            title={t('replay.nextKami')}
          >
            &gt;&gt;
          </button>
          <button
            className="replay-ctrl-btn"
            onClick={() => useGameStore.setState({ replayCurrentIndex: replayTotalSnapshots - 1 })}
            disabled={replayCurrentIndex >= replayTotalSnapshots - 1}
            title={t('replay.last')}
          >
            &gt;&gt;|
          </button>
        </div>
        <div className="replay-controls-row replay-battle-controls">
          <button
            className="replay-ctrl-btn replay-battle-btn"
            onClick={replayPrevBattle}
            disabled={replayCurrentIndex === 0}
          >
            {t('replay.prevBattle')}
          </button>
          <button
            className="replay-ctrl-btn replay-battle-btn"
            onClick={replayNextBattle}
            disabled={replayCurrentIndex >= replayTotalSnapshots - 1}
          >
            {t('replay.nextBattle')}
          </button>
        </div>
      </div>
    </div>
  );
};
