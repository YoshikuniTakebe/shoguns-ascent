import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { MandateType } from '../types/game';

export const ActionPanel = () => {
  const {
    gameState, localPlayerId, moveMode, toggleMoveMode,
    doAdvancePhase, doAdvancePlayer, doProposeAlliance, doAcceptAlliance,
    doSetupSeason, doBreakAlliances, doDrawMandateTiles, doChooseMandateTile,
    doResolveKami, doInitiateWar,
    doResolveWinter,
  } = useGameStore();

  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = gameState.mode === 'hotseat' || cp?.id === localPlayerId;

  const mandateDesc: Record<string, string> = {
    recruit: 'Add figures from reserve to your home province',
    marshal: 'Move your figures between provinces',
    train: 'Acquire a season card from the market',
    harvest: 'Gain coins from provinces you control',
    betray: 'Replace an opponent figure with yours',
  };

  const pending = gameState.allianceProposals.filter(
    p => p.to === (gameState.mode === 'hotseat' ? cp?.id : localPlayerId) && !p.accepted
  );

  return (
    <div className="action-panel">
      <h3>Actions</h3>

      {/* Season Setup Phase */}
      {gameState.currentPhase === 'seasonSetup' && (
        <div className="phase-section">
          <h4>Season Setup - {gameState.currentSeason.toUpperCase()}</h4>
          <p className="phase-description">Prepare for the new season. Return figures and set turn order.</p>
          {isMyTurn && (
            <button className="btn-primary advance-btn" onClick={doSetupSeason}>
              Begin Season
            </button>
          )}
        </div>
      )}

      {/* Tea Ceremony Phase */}
      {gameState.currentPhase === 'tea' && (
        <div className="tea-phase">
          <h4>Tea Ceremony - Alliances</h4>
          <p className="phase-description">
            Each player takes a turn to propose or accept alliances.
            Player {gameState.teaTurnIndex + 1} of {gameState.players.length}.
          </p>

          {isMyTurn && (
            <button className="btn-secondary break-btn" onClick={doBreakAlliances}>
              Break All Alliances
            </button>
          )}

          {pending.length > 0 && (
            <div className="pending-alliances">
              <h5>Pending Proposals:</h5>
              {pending.map(pr => {
                const fp = gameState.players.find(p => p.id === pr.from);
                return (
                  <div key={pr.from} className="alliance-proposal">
                    <span>{fp?.name} wants alliance</span>
                    <button className="btn-small btn-accept" onClick={() => doAcceptAlliance(pr.from)}>
                      Accept
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {isMyTurn && (
            <div className="alliance-options">
              <h5>Propose Alliance:</h5>
              {gameState.players
                .filter(p => p.id !== (gameState.mode === 'hotseat' ? cp?.id : localPlayerId))
                .filter(p => !cp?.allies.includes(p.id))
                .map(p => {
                  const clan = CLANS.find(c => c.id === p.clanId)!;
                  return (
                    <button
                      key={p.id}
                      className="btn-alliance"
                      style={{ borderColor: clan.color }}
                      onClick={() => doProposeAlliance(p.id)}
                    >
                      {p.name} ({clan.name})
                    </button>
                  );
                })}
            </div>
          )}

          {isMyTurn && (
            <button className="btn-primary advance-btn" onClick={doAdvancePlayer}>
              End My Tea Turn
            </button>
          )}
        </div>
      )}

      {/* Politics Phase */}
      {gameState.currentPhase === 'politics' && isMyTurn && (
        <div className="politics-phase">
          <h4>Politics - Mandate {gameState.politicsMandateCount + 1}/{gameState.maxMandates}</h4>
          <p className="phase-description">Draw mandate tiles and pick one for all players to execute.</p>

          {gameState.drawnMandates.length === 0 && !gameState.mandateChoicePhase && (
            <button className="btn-primary" onClick={doDrawMandateTiles}>
              Draw Mandate Tiles
            </button>
          )}

          {gameState.mandateChoicePhase && gameState.drawnMandates.length === 0 && (
            <div className="mandate-empty">
              <p>No mandates available.</p>
              <button className="btn-primary" onClick={doAdvancePlayer}>Skip</button>
            </div>
          )}

          {gameState.drawnMandates.length > 0 && (
            <div className="mandate-options">
              {gameState.drawnMandates.map((m: MandateType, i: number) => (
                <button
                  key={`${m}-${i}`}
                  className={`btn-mandate mandate-${m}`}
                  onClick={() => doChooseMandateTile(m)}
                >
                  <span className="mandate-name">{m.toUpperCase()}</span>
                  <span className="mandate-desc">{mandateDesc[m]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Last executed mandate display */}
          {gameState.mandatesThisTurn.length > 0 && (
            <div className="current-mandate">
              <h5>Last Mandate: {gameState.mandatesThisTurn[gameState.mandatesThisTurn.length - 1]?.type.toUpperCase()}</h5>
              <p className="mandate-info">Mandate resolved for all players in order.</p>
            </div>
          )}

          <div className="march-controls">
            <button className={`btn-secondary ${moveMode ? 'active' : ''}`} onClick={toggleMoveMode}>
              {moveMode ? 'Cancel Move' : 'Move Forces'}
            </button>
            {moveMode && <p className="move-instruction">Click source province, then target.</p>}
          </div>

          <button className="btn-primary advance-btn" onClick={doAdvancePlayer}>
            End Turn
          </button>
        </div>
      )}

      {/* Politics - not my turn */}
      {gameState.currentPhase === 'politics' && !isMyTurn && (
        <div className="politics-phase">
          <h4>Politics Phase</h4>
          <p className="phase-description">Waiting for {cp?.name} to choose a mandate...</p>
        </div>
      )}

      {/* Kami resolution (between politics and war) */}
      {gameState.currentPhase === 'politics' && gameState.politicsMandateCount >= gameState.maxMandates && isMyTurn && (
        <div className="kami-phase">
          <h4>Kami Turn</h4>
          <p className="phase-description">Resolve Kami abilities at temples.</p>
          <button className="btn-primary advance-btn" onClick={doResolveKami}>
            Resolve Kami
          </button>
        </div>
      )}

      {/* War Phase */}
      {gameState.currentPhase === 'war' && (
        <div className="war-phase">
          <h4>War Phase</h4>
          {gameState.activeBattles.filter(b => !b.resolved).length === 0 ? (
            <div>
              <p>No battles to resolve.</p>
              {isMyTurn && (
                <button className="btn-primary advance-btn" onClick={doInitiateWar}>
                  Initiate War
                </button>
              )}
              {isMyTurn && (
                <button className="btn-primary advance-btn" onClick={doAdvancePhase}>
                  End War Phase
                </button>
              )}
            </div>
          ) : (
            <p>Resolve battles in the Battle Panel.</p>
          )}
        </div>
      )}

      {/* Cleanup Phase */}
      {gameState.currentPhase === 'cleanup' && (
        <div className="cleanup-phase">
          <h4>Cleanup</h4>
          <p className="phase-description">Return war tokens, reset for next season.</p>
          {isMyTurn && (
            <button className="btn-primary advance-btn" onClick={doAdvancePhase}>
              Proceed to Next Season
            </button>
          )}
        </div>
      )}

      {/* Winter Phase */}
      {gameState.currentPhase === 'winter' && (
        <div className="winter-phase">
          <h4>Winter - Final Scoring</h4>
          <p className="phase-description">Score war province tokens, set bonuses, and winter upgrades.</p>
          {isMyTurn && (
            <button className="btn-primary advance-btn" onClick={doResolveWinter}>
              Resolve Winter Scoring
            </button>
          )}
        </div>
      )}
    </div>
  );
};
