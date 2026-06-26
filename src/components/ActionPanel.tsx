import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { MandateType } from '../types/game';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import { BushiIcon, ShintoIcon } from './Icons';

export const ActionPanel = () => {
  const {
    gameState, localPlayerId, moveMode, toggleMoveMode,
    doAdvancePhase, doAdvancePlayer, doProposeAlliance, doAcceptAlliance,
    doSetupSeason, doBreakAlliances, doDrawMandateTiles, doChooseMandateTile,
    doSkipTrainPurchase, setShowTrainModal,
    doSkipMarshalTurn, toggleBuildFortressMode, buildFortressMode,
    doSkipRecruitTurn, toggleRecruitMode, recruitMode, recruitFigureType, setRecruitFigureType,
    doSkipBetrayTurn,
    doResolveWinter,
  } = useGameStore();
  const t = useT();

  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = gameState.mode === 'hotseat' || cp?.id === localPlayerId;

  const mandateDescKeys: Record<string, TranslationKey> = {
    recruit: 'mandate.recruit',
    marshal: 'mandate.marshal',
    train: 'mandate.train',
    harvest: 'mandate.harvest',
    betray: 'mandate.betray',
  };

  const pending = gameState.allianceProposals.filter(
    p => p.to === (gameState.mode === 'hotseat' ? cp?.id : localPlayerId) && !p.accepted
  );

  return (
    <div className="action-panel">
      <h3>{t('actions.title')}</h3>

      {/* Season Setup Phase */}
      {gameState.currentPhase === 'seasonSetup' && (
        <div className="phase-section">
          <h4>{t('actions.seasonSetup')} - {t(`season.${gameState.currentSeason}` as any)}</h4>
          <p className="phase-description">{t('actions.seasonSetupDesc')}</p>
          {isMyTurn && (
            <button className="btn-primary advance-btn" onClick={doSetupSeason}>
              {t('actions.beginSeason')}
            </button>
          )}
        </div>
      )}

      {/* Tea Ceremony Phase */}
      {gameState.currentPhase === 'tea' && (
        <div className="tea-phase">
          <h4>{t('actions.teaCeremony')}</h4>
          <p className="phase-description">
            {t('actions.teaDesc')}{' '}
            {t('actions.playerOf', { current: gameState.teaTurnIndex + 1, total: gameState.players.length })}
          </p>

          {isMyTurn && (
            <button className="btn-secondary break-btn" onClick={doBreakAlliances}>
              {t('actions.breakAlliances')}
            </button>
          )}

          {pending.length > 0 && (
            <div className="pending-alliances">
              <h5>{t('actions.pendingProposals')}</h5>
              {pending.map(pr => {
                const fp = gameState.players.find(p => p.id === pr.from);
                return (
                  <div key={pr.from} className="alliance-proposal">
                    <span>{t('actions.wantsAlliance', { name: fp?.name || '' })}</span>
                    <button className="btn-small btn-accept" onClick={() => doAcceptAlliance(pr.from)}>
                      {t('actions.accept')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {isMyTurn && (!cp || cp.allies.length === 0) && (
            <div className="alliance-options">
              <h5>{t('actions.proposeAlliance')}</h5>
              {gameState.players
                .filter(p => p.id !== (gameState.mode === 'hotseat' ? cp?.id : localPlayerId))
                .filter(p => !cp?.allies.includes(p.id) && p.allies.length === 0)
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
              {t('actions.endTeaTurn')}
            </button>
          )}
        </div>
      )}

      {/* Politics Phase */}
      {gameState.currentPhase === 'politics' && isMyTurn && (
        <div className="politics-phase">
          <h4>{t('actions.politics', { current: gameState.politicsMandateCount + 1, total: gameState.maxMandates })}</h4>
          <p className="phase-description">{t('actions.politicsDesc')}</p>

          {/* Train mandate active - show skip option */}
          {gameState.trainMandateActive && (
            <div className="train-active">
              <p className="train-notice">
                {t('actions.trainNotice', { name: cp?.name || '' })}{' '}
                {t('actions.trainPlayer', { current: gameState.trainResolutionIndex + 1, total: gameState.trainResolutionOrder.length })}
              </p>
              <button className="btn-primary" onClick={() => setShowTrainModal(true)} style={{ marginBottom: '6px' }}>
                {t('seasonCardsModal.openMarket')}
              </button>
              <button className="btn-secondary" onClick={doSkipTrainPurchase}>
                {t('actions.skipCardPurchase')}
              </button>
            </div>
          )}

          {/* Marshal mandate active - show move/build/end turn options */}
          {gameState.marshalMandateActive && (
            <div className="marshal-active">
              <p className="marshal-notice">
                {t('actions.marshalNotice', {
                  name: cp?.name || '',
                  bonus: gameState.marshalMandateIssuerId && cp &&
                    (cp.id === gameState.marshalMandateIssuerId || gameState.players.find(p => p.id === gameState.marshalMandateIssuerId)?.allies.includes(cp.id))
                    ? t('actions.marshalBonus')
                    : t('actions.marshalNoBonus'),
                })}{' '}
                {t('actions.marshalPlayer', { current: gameState.marshalResolutionIndex + 1, total: gameState.marshalResolutionOrder.length })}
              </p>
              <p className="move-instruction">{t('actions.marshalMoveInstruction')}</p>
              {gameState.marshalMovedFigures.length > 0 && (
                <p className="marshal-moved-count">{t('actions.marshalMovedCount', { count: gameState.marshalMovedFigures.length })}</p>
              )}
              <div className="march-controls">
                <button className={`btn-secondary ${moveMode ? 'active' : ''}`} onClick={toggleMoveMode}>
                  {moveMode ? t('actions.cancelMove') : t('actions.moveForces')}
                </button>
                {moveMode && <p className="move-instruction">{t('actions.marshalMoveSteps')}</p>}
              </div>
              {gameState.marshalMandateIssuerId && cp &&
                (cp.id === gameState.marshalMandateIssuerId || gameState.players.find(p => p.id === gameState.marshalMandateIssuerId)?.allies.includes(cp.id)) &&
                !gameState.marshalFortressBuiltBy.includes(cp.id) &&
                cp.fortresses > 0 && cp.coins >= 3 && (
                <div style={{ marginTop: '6px' }}>
                  <button className={`btn-secondary ${buildFortressMode ? 'active' : ''}`} onClick={toggleBuildFortressMode}>
                    {t('actions.buildFortress')}
                  </button>
                  {buildFortressMode && <p className="move-instruction">{t('actions.marshalSelectProvince')}</p>}
                </div>
              )}
              <button className="btn-primary" style={{ marginTop: '8px' }} onClick={doSkipMarshalTurn}>
                {t('actions.endMarshalTurn')}
              </button>
            </div>
          )}

          {/* Recruit mandate active - show figure type selector and place/end turn options */}
          {gameState.recruitMandateActive && (
            <div className="recruit-active" style={{ borderColor: (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan ? clan.color : undefined; })() }}>
              <p className="recruit-notice">
                {t('actions.recruitNotice', {
                  name: cp?.name || '',
                  bonus: gameState.recruitMandateIssuerId && cp &&
                    (cp.id === gameState.recruitMandateIssuerId || gameState.players.find(p => p.id === gameState.recruitMandateIssuerId)?.allies.includes(cp.id))
                    ? t('actions.recruitBonus')
                    : t('actions.recruitNoBonus'),
                })}{' '}
                {t('actions.recruitPlayer', { current: gameState.recruitResolutionIndex + 1, total: gameState.recruitResolutionOrder.length })}
              </p>
              <p>{t('actions.recruitPlacementsLeft', { count: gameState.recruitPlacementsRemaining })}</p>
              {cp && cp.clanId === 'libelula' && (
                <p className="move-instruction">{t('actions.recruitDragonflyHint')}</p>
              )}
              <div className="recruit-buttons">
                <button
                  className={`recruit-type-btn ${recruitFigureType === 'bushi' ? 'active' : ''}`}
                  onClick={() => { setRecruitFigureType('bushi'); if (!recruitMode) toggleRecruitMode(); }}
                  style={{ '--recruit-clan-color': (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan?.color || '#87CEEB'; })() } as React.CSSProperties}
                >
                  <BushiIcon size={18} color={recruitFigureType === 'bushi' ? (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan?.color || '#87CEEB'; })() : 'var(--text-secondary)'} />
                  <span className="recruit-type-label">{t('actions.recruitBushi')}</span>
                  <span className="recruit-type-count">{cp?.bushi ?? 0}</span>
                </button>
                <button
                  className={`recruit-type-btn ${recruitFigureType === 'shinto' ? 'active' : ''}`}
                  onClick={() => { setRecruitFigureType('shinto'); if (!recruitMode) toggleRecruitMode(); }}
                  style={{ '--recruit-clan-color': (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan?.color || '#87CEEB'; })() } as React.CSSProperties}
                >
                  <ShintoIcon size={18} color={recruitFigureType === 'shinto' ? (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan?.color || '#87CEEB'; })() : 'var(--text-secondary)'} />
                  <span className="recruit-type-label">{t('actions.recruitShinto')}</span>
                  <span className="recruit-type-count">{cp?.shinto ?? 0}</span>
                </button>
              </div>
              {recruitMode && <p className="move-instruction">{recruitFigureType === 'shinto' ? t('actions.recruitSelectProvinceOrTemple') : t('actions.recruitSelectProvince')}</p>}
              <button className="btn-primary" style={{ marginTop: '8px' }} onClick={doSkipRecruitTurn}>
                {t('actions.endRecruitTurn')}
              </button>
            </div>
          )}

          {/* Betray mandate active - issuer selects enemy figures to replace */}
          {gameState.betrayMandateActive && (
            <div className="betray-active">
              <p className="betray-notice">
                {t('actions.betrayNotice', { name: cp?.name || '' })}
              </p>
              <p>{t('actions.betraySelectionsLeft', { count: gameState.betraySelectionsRemaining })}</p>
              <p className="move-instruction">{t('actions.betraySelectTarget')}</p>
              <button className="btn-primary" style={{ marginTop: '8px' }} onClick={doSkipBetrayTurn}>
                {t('actions.betrayEndTurn')}
              </button>
            </div>
          )}

          {!gameState.trainMandateActive && !gameState.marshalMandateActive && !gameState.recruitMandateActive && !gameState.betrayMandateActive && gameState.drawnMandates.length === 0 && !gameState.mandateChoicePhase && (
            <button className="btn-primary" onClick={doDrawMandateTiles}>
              {t('actions.drawMandateTiles')}
            </button>
          )}

          {gameState.mandateChoicePhase && gameState.drawnMandates.length === 0 && (
            <div className="mandate-empty">
              <p>{t('actions.noMandates')}</p>
              <button className="btn-primary" onClick={doAdvancePlayer}>{t('actions.skip')}</button>
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
                  <span className="mandate-desc">{t(mandateDescKeys[m])}</span>
                </button>
              ))}
            </div>
          )}

          {/* Last executed mandate display */}
          {gameState.mandatesThisTurn.length > 0 && !gameState.trainMandateActive && !gameState.marshalMandateActive && !gameState.recruitMandateActive && !gameState.betrayMandateActive && (
            <div className="current-mandate">
              <h5>{t('actions.lastMandate')} {gameState.mandatesThisTurn[gameState.mandatesThisTurn.length - 1]?.type.toUpperCase()}</h5>
              <p className="mandate-info">{t('actions.mandateResolved')}</p>
            </div>
          )}


        </div>
      )}

      {/* Politics - not my turn */}
      {gameState.currentPhase === 'politics' && !isMyTurn && (
        <div className="politics-phase">
          <h4>{t('actions.politicsPhase')}</h4>
          <p className="phase-description">{t('actions.waitingFor', { name: cp?.name || '' })}</p>
        </div>
      )}

      {/* War Phase */}
      {gameState.currentPhase === 'war' && (
        <div className="war-phase">
          <h4>{t('actions.warPhase')}</h4>
          {gameState.activeBattles.filter(b => !b.resolved).length === 0 ? (
            <div>
              <p>{t('actions.allBattlesResolved')}</p>
              {isMyTurn && (
                <button className="btn-primary advance-btn" onClick={doAdvancePhase}>
                  {t('actions.endWarPhase')}
                </button>
              )}
            </div>
          ) : (
            <div>
              <p>{t('actions.resolveBattles', { count: gameState.activeBattles.filter(b => !b.resolved).length })}</p>
            </div>
          )}
        </div>
      )}

      {/* Cleanup Phase */}
      {gameState.currentPhase === 'cleanup' && (
        <div className="cleanup-phase">
          <h4>{t('actions.cleanup')}</h4>
          <p className="phase-description">{t('actions.cleanupDesc')}</p>
          {isMyTurn && (
            <button className="btn-primary advance-btn" onClick={doAdvancePhase}>
              {t('actions.proceedNextSeason')}
            </button>
          )}
        </div>
      )}

      {/* Winter Phase */}
      {gameState.currentPhase === 'winter' && (
        <div className="winter-phase">
          <h4>{t('actions.winterScoring')}</h4>
          {gameState.gameOver ? (
            <div>
              <p className="phase-description">{t('actions.gameOverDesc')}</p>
              {gameState.winner && (
                <p><strong>{t('actions.winner')} {gameState.players.find(p => p.id === gameState.winner)?.name}</strong></p>
              )}
            </div>
          ) : (
            <div>
              <p className="phase-description">{t('actions.winterDesc')}</p>
              {isMyTurn && (
                <button className="btn-primary advance-btn" onClick={doResolveWinter}>
                  {t('actions.resolveWinterScoring')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
