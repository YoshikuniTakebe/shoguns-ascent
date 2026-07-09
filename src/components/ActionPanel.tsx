import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { MandateType } from '../types/game';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import { BushiIcon, ShintoIcon, MonsterIcon, DaimyoIcon, CoinIcon, UndoIcon, SpringIcon, SummerIcon, AutumnIcon, HandshakeIcon } from './Icons';
import { ClanShield } from './ClanShields';
import { getCardEffectKey } from '../utils/cardTranslations';

export const ActionPanel = () => {
  const {
    gameState, localPlayerId, moveMode, toggleMoveMode,
    doAdvancePhase, doAdvancePlayer, doProposeAlliance, doAcceptAlliance,
    doTeaProposeAlliance, doTeaAcceptAlliance, doTeaRejectAlliance, doTeaOptOut,
    doSetupSeason, doDrawMandateTiles, doChooseMandateTile,
    doLotoChooseActualMandate,
    doSkipMarshalTurn, toggleBuildFortressMode, buildFortressMode,
    toggleBuildFukurokujuMode, buildFukurokujuMode,
    doSkipRecruitTurn, toggleRecruitMode, recruitMode, recruitFigureType, setRecruitFigureType,
    doSkipBetrayTurn,
    doResolveWinter,
    undoMandateState, doUndoMandate,
    jinmenjuSummonActive, doJinmenjuActivate, doJinmenjuCancel,
    setTradeModalOpen,
    betrayMonsterSelectionVisible, betrayMonsterSelectionProvinceId: _betrayMonsterSelectionProvinceId, betrayMonsterSelectionFigureId: _betrayMonsterSelectionFigureId,
    doBetrayConfirmMonster, doBetrayDismissMonsterSelection,
    recruitMonsterSelectionVisible, recruitDaimyoSelectionVisible,
    doRecruitConfirmMonster, doRecruitConfirmDaimyo, doRecruitDismissSelection,
  } = useGameStore();
  const t = useT();

  const [selectedAllianceTarget, setSelectedAllianceTarget] = useState<string | null>(null);
  const [bribeAmount, setBribeAmount] = useState<number>(0);
  const [requestAmount, setRequestAmount] = useState<number>(0);
  const [selectedBetrayMonster, setSelectedBetrayMonster] = useState<string | null>(null);

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

  const mandateColors: Record<string, string> = {
    train: '#8B4513',
    recruit: '#87CEEB',
    harvest: '#2E8B57',
    marshal: '#808080',
    betray: '#DC143C',
  };

  const pending = gameState.allianceProposals.filter(
    p => p.to === (gameState.mode === 'hotseat' ? cp?.id : localPlayerId) && !p.accepted
  );

  return (
    <div className="action-panel">
      <h3>{t('actions.title')}</h3>

      {/* Season Setup Phase */}
      {gameState.currentPhase === 'seasonSetup' && (() => {
        const seasonColors: Record<string, string> = { spring: '#FFB7C5', summer: '#FFD700', autumn: '#FF8C00' };
        const seasonColor = seasonColors[gameState.currentSeason] || '#ccc';
        const SeasonIcon = gameState.currentSeason === 'spring' ? SpringIcon : gameState.currentSeason === 'summer' ? SummerIcon : AutumnIcon;
        return (
          <div className="phase-section">
            <h4 style={{ marginBottom: '0.2rem' }}>{t('actions.seasonSetup')}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.8rem' }}>
              <SeasonIcon size={30} color={seasonColor} />
              <span style={{ color: seasonColor, fontWeight: 'bold', fontSize: '1.2em' }}>{t(`season.${gameState.currentSeason}` as TranslationKey)}</span>
            </div>
            <p className="phase-description">{t('actions.seasonSetupDesc')}</p>
            {gameState.mode === 'online' ? (
              <p style={{ color: '#aaa', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                {t('game.teaReadyWaiting', { ready: String((gameState.teaReadyPlayers || []).length), total: String(gameState.players.length) })}
              </p>
            ) : (
              isMyTurn && (
                <button className="btn-primary advance-btn" onClick={doSetupSeason}>
                  {t('actions.beginSeason')}
                </button>
              )
            )}
          </div>
        );
      })()}

      {/* Tea Ceremony Phase */}
      {gameState.currentPhase === 'tea' && gameState.mode === 'online' && (() => {
        const localPlayer = gameState.players.find(p => p.id === localPlayerId);
        const hasAlly = localPlayer && localPlayer.allies.length > 0;
        const hasOptedOut = localPlayerId ? gameState.teaOptedOut.includes(localPlayerId) : false;
        const allyPlayer = hasAlly ? gameState.players.find(p => localPlayer!.allies.includes(p.id)) : null;
        const incomingProposals = gameState.allianceProposals.filter(ap => ap.to === localPlayerId && !ap.accepted);
        const availableTargets = gameState.players.filter(
          p => p.id !== localPlayerId && p.allies.length === 0 && !gameState.teaOptedOut.includes(p.id)
        );
        const hasPendingOutgoing = gameState.allianceProposals.some(ap => ap.from === localPlayerId);

        return (
          <div className="tea-phase tea-online-panel">
            <h4>{t('actions.teaCeremony')}</h4>
            <p className="phase-description">{t('actions.teaOnlineDesc')}</p>

            {/* Alliance formed state */}
            {hasAlly && allyPlayer && (
              <div className="tea-alliance-formed">
                <ClanShield clanId={allyPlayer.clanId} size={30} />
                <span>{t('actions.allianceFormed', { name: allyPlayer.name })}</span>
              </div>
            )}

            {/* Opted out state */}
            {!hasAlly && hasOptedOut && (
              <div className="tea-opted-out-msg">
                <span>{t('actions.youOptedOut')}</span>
              </div>
            )}

            {/* Waiting state (allied or opted out) */}
            {(hasAlly || hasOptedOut) && (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                {t('actions.waitingTeaEnd')}
              </p>
            )}

            {/* Active state: can propose/accept/reject */}
            {!hasAlly && !hasOptedOut && (
              <>
                {/* Incoming proposals */}
                {incomingProposals.length > 0 && (
                  <div className="pending-alliances">
                    <h5>{t('actions.pendingProposals')}</h5>
                    {incomingProposals.map(pr => {
                      const fp = gameState.players.find(p => p.id === pr.from);
                      return (
                        <div key={pr.from} className="tea-proposal-card">
                          <div className="alliance-proposal">
                            <ClanShield clanId={fp?.clanId || ''} size={30} />
                            <span>{t('actions.wantsAlliance', { name: '' })} <span style={{ color: CLANS.find(c => c.id === fp?.clanId)?.color, fontWeight: 'bold' }}>{fp?.name || ''}</span></span>
                            {pr.bribeAmount && pr.bribeAmount > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '0.5rem', fontWeight: 'bold', color: '#DAA520' }}>
                                <CoinIcon size={16} color="#DAA520" />
                                <span>{pr.bribeAmount}</span>
                              </span>
                            )}
                            {pr.requestAmount && pr.requestAmount > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '0.5rem', fontWeight: 'bold', color: '#e74c3c' }}>
                                <CoinIcon size={16} color="#e74c3c" />
                                <span>-{pr.requestAmount}</span>
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', justifyContent: 'center' }}>
                            <button className="btn-small btn-accept" onClick={() => doTeaAcceptAlliance(pr.from)}>
                              {t('actions.accept')}
                            </button>
                            <button className="btn-small" onClick={() => doTeaRejectAlliance(pr.from)}>
                              {t('actions.rejectAlliance')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Proposal targets */}
                {!hasPendingOutgoing && availableTargets.length > 0 && (
                  <div className="alliance-options" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {availableTargets.map(p => {
                      const clan = CLANS.find(c => c.id === p.clanId)!;
                      const isSelected = selectedAllianceTarget === p.id;
                      return (
                        <button
                          key={p.id}
                          className={`btn-alliance${isSelected ? ' selected' : ''}`}
                          style={{ borderColor: clan.color, display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => setSelectedAllianceTarget(isSelected ? null : p.id)}
                        >
                          <ClanShield clanId={p.clanId} size={22} />
                          <span style={{ color: clan.color, fontWeight: 'bold' }}>{p.name}</span>
                          <span style={{ opacity: 0.7 }}>({clan.name})</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Notification that proposal was sent */}
                {hasPendingOutgoing && (
                  <p style={{ color: 'var(--accent-gold)', fontStyle: 'italic', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    {t('actions.allianceProposalSent')}
                  </p>
                )}

                {/* Bribe/Request sliders and Propose button */}
                {!hasPendingOutgoing && (
                  <div className="tea-turn-actions">
                    {selectedAllianceTarget && localPlayer && localPlayer.coins > 0 && (
                      <div className="bribe-slider" style={{ marginBottom: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85em' }}>
                          <span style={{ minWidth: '5.5em' }}>{t('actions.bribeLabel')}:</span>
                          <input
                            type="range"
                            min={0}
                            max={localPlayer.coins}
                            value={bribeAmount}
                            onChange={(e) => { setBribeAmount(Number(e.target.value)); if (Number(e.target.value) > 0) setRequestAmount(0); }}
                            style={{ flex: 1 }}
                          />
                          <span style={{ fontWeight: 'bold', color: '#DAA520', minWidth: '2.5em', textAlign: 'center' }}>
                            {bribeAmount}
                          </span>
                        </label>
                      </div>
                    )}
                    {selectedAllianceTarget && (() => {
                      const targetPlayer = gameState.players.find(p => p.id === selectedAllianceTarget);
                      return targetPlayer && targetPlayer.coins > 0 ? (
                        <div className="request-slider" style={{ marginBottom: '0.5rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85em' }}>
                            <span style={{ minWidth: '5.5em' }}>{t('actions.requestLabel')}:</span>
                            <input
                              type="range"
                              min={0}
                              max={targetPlayer.coins}
                              value={requestAmount}
                              onChange={(e) => { setRequestAmount(Number(e.target.value)); if (Number(e.target.value) > 0) setBribeAmount(0); }}
                              style={{ flex: 1 }}
                            />
                            <span style={{ fontWeight: 'bold', color: '#e74c3c', minWidth: '2.5em', textAlign: 'center' }}>
                              {requestAmount}
                            </span>
                          </label>
                        </div>
                      ) : null;
                    })()}
                    {selectedAllianceTarget && (
                      <button
                        className="btn-primary advance-btn"
                        onClick={() => {
                          if (selectedAllianceTarget) {
                            doTeaProposeAlliance(selectedAllianceTarget, bribeAmount > 0 ? bribeAmount : undefined, requestAmount > 0 ? requestAmount : undefined);
                            setSelectedAllianceTarget(null);
                            setBribeAmount(0);
                            setRequestAmount(0);
                          }
                        }}
                      >
                        {t('actions.endTeaTurn')}
                      </button>
                    )}
                  </div>
                )}

                {/* Opt out button */}
                <button
                  className="tea-opt-out-btn"
                  onClick={() => doTeaOptOut()}
                >
                  {t('actions.noAllianceButton')}
                </button>
              </>
            )}

            {/* Trade button - always available during tea */}
            <button
              className="btn-secondary trade-btn"
              onClick={() => setTradeModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', marginTop: '0.7rem', padding: '0.5rem', borderColor: '#c8a951' }}
            >
              <HandshakeIcon size={22} color="#c8a951" />
              <span style={{ fontWeight: 'bold', color: '#c8a951', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('trade.button')}</span>
            </button>
          </div>
        );
      })()}

      {gameState.currentPhase === 'tea' && gameState.mode !== 'online' && (
        <div className="tea-phase">
          <h4>{t('actions.teaCeremony')}</h4>

          {isMyTurn && cp && (() => {
            const cpClan = CLANS.find(c => c.id === cp.clanId);
            return (
              <p className="phase-description" style={{ marginTop: 0 }}>
                <ClanShield clanId={cp.clanId} size={30} />
                <span style={{ color: cpClan?.color, fontWeight: 'bold', fontSize: '1.3em', marginLeft: '4px' }}>{cp.name}</span>{' '}
                {t('actions.teaActivePlayerSuffix')}
              </p>
            );
          })()}

          {pending.length > 0 && (
            <div className="pending-alliances">
              <h5>{t('actions.pendingProposals')}</h5>
              {pending.map(pr => {
                const fp = gameState.players.find(p => p.id === pr.from);
                return (
                  <div key={pr.from} className="alliance-proposal">
                    <ClanShield clanId={fp?.clanId || ''} size={30} />
                    <span>{t('actions.wantsAlliance', { name: '' })} <span style={{ color: CLANS.find(c => c.id === fp?.clanId)?.color, fontWeight: 'bold' }}>{fp?.name || ''}</span></span>
                    {pr.bribeAmount && pr.bribeAmount > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '0.5rem', fontWeight: 'bold', color: '#DAA520' }}>
                        <CoinIcon size={16} color="#DAA520" />
                        <span>{pr.bribeAmount}</span>
                      </span>
                    )}
                    {pr.requestAmount && pr.requestAmount > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '0.5rem', fontWeight: 'bold', color: '#e74c3c' }}>
                        <CoinIcon size={16} color="#e74c3c" />
                        <span>-{pr.requestAmount}</span>
                      </span>
                    )}
                    <button className="btn-small btn-accept" onClick={() => doAcceptAlliance(pr.from)}>
                      {t('actions.accept')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {isMyTurn && (!cp || cp.allies.length === 0) && (
            <div className="alliance-options" style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {gameState.players
                .filter(p => p.id !== (gameState.mode === 'hotseat' ? cp?.id : localPlayerId))
                .filter(p => !cp?.allies.includes(p.id) && p.allies.length === 0)
                .map(p => {
                  const clan = CLANS.find(c => c.id === p.clanId)!;
                  const isSelected = selectedAllianceTarget === p.id;
                  const proposalsToThisPlayer = gameState.allianceProposals.filter(ap => ap.to === p.id);
                  return (
                    <button
                      key={p.id}
                      className={`btn-alliance${isSelected ? ' selected' : ''}`}
                      style={{ borderColor: clan.color, display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setSelectedAllianceTarget(isSelected ? null : p.id)}
                    >
                      <ClanShield clanId={p.clanId} size={22} />
                      <span style={{ color: clan.color, fontWeight: 'bold' }}>{p.name}</span>
                      <span style={{ opacity: 0.7 }}>({clan.name})</span>
                      {proposalsToThisPlayer.length > 0 && (
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: '2px', alignItems: 'center' }}>
                          {proposalsToThisPlayer.map(ap => {
                            const proposer = gameState.players.find(pl => pl.id === ap.from);
                            return proposer ? (
                              <ClanShield key={ap.from} clanId={proposer.clanId} size={30} />
                            ) : null;
                          })}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}

          {isMyTurn && (
            <div className="tea-turn-actions">
              {selectedAllianceTarget && cp && cp.coins > 0 && (
                <div className="bribe-slider" style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85em' }}>
                    <span style={{ minWidth: '5.5em' }}>{t('actions.bribeLabel')}:</span>
                    <input
                      type="range"
                      min={0}
                      max={cp.coins}
                      value={bribeAmount}
                      onChange={(e) => { setBribeAmount(Number(e.target.value)); if (Number(e.target.value) > 0) setRequestAmount(0); }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontWeight: 'bold', color: '#DAA520', minWidth: '2.5em', textAlign: 'center' }}>
                      {bribeAmount}
                    </span>
                  </label>
                  {bribeAmount > 0 && (
                    <p style={{ fontSize: '0.75em', margin: '0.2rem 0 0', color: '#888' }}>
                      {t('actions.offeringCoins', { amount: bribeAmount })}
                    </p>
                  )}
                </div>
              )}
              {selectedAllianceTarget && (() => {
                const targetPlayer = gameState.players.find(p => p.id === selectedAllianceTarget);
                return targetPlayer && targetPlayer.coins > 0 ? (
                  <div className="request-slider" style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85em' }}>
                      <span style={{ minWidth: '5.5em' }}>{t('actions.requestLabel')}:</span>
                      <input
                        type="range"
                        min={0}
                        max={targetPlayer.coins}
                        value={requestAmount}
                        onChange={(e) => { setRequestAmount(Number(e.target.value)); if (Number(e.target.value) > 0) setBribeAmount(0); }}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontWeight: 'bold', color: '#e74c3c', minWidth: '2.5em', textAlign: 'center' }}>
                        {requestAmount}
                      </span>
                    </label>
                    {requestAmount > 0 && (
                      <p style={{ fontSize: '0.75em', margin: '0.2rem 0 0', color: '#888' }}>
                        {t('actions.requestingCoins', { amount: requestAmount })}
                      </p>
                    )}
                  </div>
                ) : null;
              })()}
              <button
                className="btn-primary advance-btn"
                disabled={!selectedAllianceTarget}
                onClick={() => {
                  if (selectedAllianceTarget) {
                    doProposeAlliance(selectedAllianceTarget, bribeAmount > 0 ? bribeAmount : undefined, requestAmount > 0 ? requestAmount : undefined);
                    setSelectedAllianceTarget(null);
                    setBribeAmount(0);
                    setRequestAmount(0);
                    doAdvancePlayer();
                  }
                }}
              >
                {t('actions.endTeaTurn')}
              </button>
              <button
                className="btn-secondary advance-btn"
                style={{ marginTop: '0.5rem', width: '100%' }}
                onClick={() => {
                  setSelectedAllianceTarget(null);
                  setBribeAmount(0);
                  setRequestAmount(0);
                  doAdvancePlayer();
                }}
              >
                {t('actions.passTurn')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Politics Phase */}
      {gameState.currentPhase === 'politics' && isMyTurn && (
        <div className="politics-phase">
          <h4>{t('actions.politics', { current: gameState.politicsMandateCount + 1, total: gameState.maxMandates })}</h4>
          <p className="phase-description">{t('actions.politicsDesc')}</p>

          {/* Trade button */}
          <button
            className="btn-secondary trade-btn"
            onClick={() => setTradeModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', marginBottom: '0.7rem', padding: '0.5rem', borderColor: '#c8a951' }}
          >
            <HandshakeIcon size={22} color="#c8a951" />
            <span style={{ fontWeight: 'bold', color: '#c8a951', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('trade.button')}</span>
          </button>

          {/* Train mandate active - show skip option */}
          {gameState.trainMandateActive && (() => {
            const cpClan = cp ? CLANS.find(c => c.id === cp.clanId) : null;
            return (
              <div className="train-active">
                <p className="train-notice" style={{ margin: 0 }}>
                  <span style={{ fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>{t('actions.mandateName.train')}</span>
                </p>
                <p style={{ margin: '4px 0' }}>
                  <ClanShield clanId={cp?.clanId || ''} size={40} />
                  <span style={{ color: cpClan?.color || '#8B4513', fontWeight: 'bold', marginLeft: '4px' }}>{cp?.name || ''}</span>
                </p>
                <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>
                  {t('actions.mandateDesc.train')}
                </p>
                <p className="recruit-player-info">
                  JUGADOR {gameState.trainResolutionIndex + 1} DE {gameState.trainResolutionOrder.length}
                </p>
              </div>
            );
          })()}

          {/* Marshal mandate active - show move/build/end turn options */}
          {gameState.marshalMandateActive && (() => {
            const cpClan = cp ? CLANS.find(c => c.id === cp.clanId) : null;
            const hasBonus = gameState.marshalMandateIssuerId && cp &&
              (cp.id === gameState.marshalMandateIssuerId || gameState.players.find(p => p.id === gameState.marshalMandateIssuerId)?.allies.includes(cp.id));
            return (
              <div className="marshal-active">
                <p className="marshal-notice" style={{ margin: 0 }}>
                  <span style={{ fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>{t('actions.mandateName.marshal')}</span>
                </p>
                <p style={{ margin: '4px 0' }}>
                  <ClanShield clanId={cp?.clanId || ''} size={40} />
                  <span style={{ color: cpClan?.color || '#4CAF50', fontWeight: 'bold', marginLeft: '4px' }}>{cp?.name || ''}</span>
                </p>
                <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>
                  {t('actions.mandateDesc.marshal')}{' '}
                  {hasBonus && t('actions.marshalBonusFortress')}
                </p>
                <p className="recruit-player-info">
                  JUGADOR {gameState.marshalResolutionIndex + 1} DE {gameState.marshalResolutionOrder.length}
                </p>
                <p className="move-instruction">{t('actions.marshalMoveInstruction')}</p>
                {gameState.marshalMovedFigures.length > 0 && (
                  <p className="marshal-moved-count">{t('actions.marshalMovedCount', { count: gameState.marshalMovedFigures.length })}</p>
                )}
                <div className="march-controls">
                  <button className={`btn-secondary ${moveMode ? 'active' : ''}`} style={{ width: '100%', fontSize: '0.85rem' }} onClick={toggleMoveMode}>
                    {moveMode ? t('actions.cancelMove') : t('actions.moveForces')}
                  </button>
                  {moveMode && (
                    <ol className="marshal-steps-list">
                      {t('actions.marshalMoveSteps').split(/\d+\.\s/).filter(Boolean).map((step, idx) => (
                        <li key={idx}>{step.trim()}</li>
                      ))}
                    </ol>
                  )}
                </div>
                {hasBonus &&
                  !gameState.marshalFortressBuiltBy.includes(cp!.id) &&
                  cp!.fortresses > 0 && cp!.coins >= 3 && (
                  <div style={{ marginTop: '6px' }}>
                    <button className={`btn-secondary ${buildFortressMode ? 'active' : ''}`} style={{ fontSize: '0.85rem', width: '100%' }} onClick={toggleBuildFortressMode}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                        {t('actions.buildFortress')}
                        <CoinIcon size={16} color="#DAA520" />
                        <span style={{ fontWeight: 'bold', color: '#DAA520', fontSize: '1.1em' }}>3</span>
                      </span>
                    </button>
                    {buildFortressMode && <p className="move-instruction">{t('actions.marshalSelectProvince')}</p>}
                  </div>
                )}
                {hasBonus &&
                  !gameState.marshalFortressBuiltBy.includes(cp!.id) &&
                  cp!.coins >= (cp!.clanId === 'bonsai' ? 1 : 3) &&
                  cp!.seasonCards.some(c => c.id === 'sp-fukurokuju') &&
                  !Object.values(gameState.provinces).some(prov => prov.figures.some(f => f.type === 'monster' && f.monsterCardId === 'sp-fukurokuju' && f.owner === cp!.id)) && (
                  <div style={{ marginTop: '6px' }}>
                    <button className={`btn-secondary ${buildFukurokujuMode ? 'active' : ''}`} style={{ fontSize: '0.85rem', width: '100%' }} onClick={toggleBuildFukurokujuMode}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                        Fukurokuju
                        <CoinIcon size={16} color="#DAA520" />
                        <span style={{ fontWeight: 'bold', color: '#DAA520', fontSize: '1.1em' }}>{cp!.clanId === 'bonsai' ? 1 : 3}</span>
                      </span>
                    </button>
                    {buildFukurokujuMode && <p className="move-instruction">{t('actions.marshalSelectProvince')}</p>}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                  {undoMandateState && (
                    <button
                      className="btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', padding: 0, marginRight: '8px' }}
                      onClick={doUndoMandate}
                      title="Undo"
                    >
                      <UndoIcon size={20} color="currentColor" />
                    </button>
                  )}
                  <button className="btn-primary" style={{ flex: 1 }} onClick={doSkipMarshalTurn}>
                    {t('actions.endMarshalTurn')}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Recruit mandate active - show figure type selector and place/end turn options */}
          {gameState.recruitMandateActive && (
            <div className="recruit-active" style={{ borderColor: (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan ? clan.color : undefined; })() }}>
              <p className="recruit-notice" style={{ margin: 0 }}>
                <span style={{ fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>{t('actions.mandateName.recruit')}</span>
              </p>
              <p style={{ margin: '4px 0' }}>
                <ClanShield clanId={cp?.clanId || ''} size={40} />
                <span style={{ color: (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan?.color || '#87CEEB'; })(), fontWeight: 'bold', marginLeft: '4px' }}>{cp?.name || ''}</span>
              </p>
              <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>
                {t('actions.mandateDesc.recruit')}{' '}
                {gameState.recruitMandateIssuerId && cp &&
                  (cp.id === gameState.recruitMandateIssuerId || gameState.players.find(p => p.id === gameState.recruitMandateIssuerId)?.allies.includes(cp.id)) &&
                  t('actions.recruitBonus')}
              </p>
              <p className="recruit-player-info">
                JUGADOR {gameState.recruitResolutionIndex + 1} DE {gameState.recruitResolutionOrder.length}
              </p>
              <p style={{ fontWeight: 'bold', color: '#00CED1', fontSize: '1.1em' }}>{t('actions.recruitPlacementsLeft', { count: gameState.recruitPlacementsRemaining })}</p>
              {cp && cp.clanId === 'libelula' && (
                <p className="move-instruction">{t('actions.recruitDragonflyHint')}</p>
              )}
              <div className="recruit-buttons">
                {(cp?.bushi ?? 0) > 0 && (
                <button
                  className={`recruit-type-btn ${recruitFigureType === 'bushi' && recruitMode ? 'active' : ''}`}
                  onClick={() => { if (recruitFigureType === 'bushi' && recruitMode) { toggleRecruitMode(); } else { setRecruitFigureType('bushi'); if (!recruitMode) toggleRecruitMode(); } }}
                  style={{ '--recruit-clan-color': (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan?.color || '#87CEEB'; })() } as React.CSSProperties}
                >
                  <BushiIcon size={18} color={recruitFigureType === 'bushi' && recruitMode ? (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan?.color || '#87CEEB'; })() : 'var(--text-secondary)'} />
                  <span className="recruit-type-label">{t('actions.recruitBushi')}</span>
                  <span className="recruit-type-count">{cp?.bushi ?? 0}</span>
                </button>
                )}
                {(() => {
                  // Effective shinto: player.shinto + shinto-type monsters in reserve (not deployed, not praying)
                  const SHINTO_MONSTER_IDS_LOCAL = ['sp-komainu', 'su-hotei'];
                  const deployedIds = new Set<string>();
                  Object.values(gameState.provinces).forEach((prov) => {
                    prov.figures.forEach((f) => {
                      if (f.type === 'monster' && f.owner === cp?.id && f.monsterCardId) {
                        deployedIds.add(f.monsterCardId);
                      }
                    });
                  });
                  const prayingIds = new Set<string>();
                  gameState.temples.forEach(temple => {
                    temple.figures.forEach(f => {
                      if (f.playerId === cp?.id && f.monsterCardId) {
                        prayingIds.add(f.monsterCardId);
                      }
                    });
                  });
                  const shintoMonstersInReserve = cp?.seasonCards.filter(c => c.cardType === 'monster' && SHINTO_MONSTER_IDS_LOCAL.includes(c.id) && !deployedIds.has(c.id) && !prayingIds.has(c.id)).length || 0;
                  const effectiveShintoReserve = (cp?.shinto ?? 0) + shintoMonstersInReserve;
                  return effectiveShintoReserve > 0 ? (
                <button
                  className={`recruit-type-btn ${recruitFigureType === 'shinto' && recruitMode ? 'active' : ''}`}
                  onClick={() => { if (recruitFigureType === 'shinto' && recruitMode) { toggleRecruitMode(); } else { setRecruitFigureType('shinto'); if (!recruitMode) toggleRecruitMode(); } }}
                  style={{ '--recruit-clan-color': (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan?.color || '#87CEEB'; })() } as React.CSSProperties}
                >
                  <ShintoIcon size={18} color={recruitFigureType === 'shinto' && recruitMode ? (() => { const clan = cp ? CLANS.find(c => c.id === cp.clanId) : null; return clan?.color || '#87CEEB'; })() : 'var(--text-secondary)'} />
                  <span className="recruit-type-label">{t('actions.recruitShinto')}</span>
                  <span className="recruit-type-count">{effectiveShintoReserve}</span>
                </button>
                  ) : null;
                })()}
                {cp && (() => {
                  const DAIMYO_MONSTER_IDS = ['su-yurei', 'sp-fukurokuju'];
                  const deployedMonsterCardIds = new Set<string>();
                  Object.values(gameState.provinces).forEach((prov) => {
                    prov.figures.forEach((f) => {
                      if (f.type === 'monster' && f.owner === cp.id && f.monsterCardId) {
                        deployedMonsterCardIds.add(f.monsterCardId);
                      }
                    });
                  });
                  // Detect praying monsters at temples
                  const prayingMonsterCardIds = new Set<string>();
                  gameState.temples.forEach(temple => {
                    temple.figures.forEach(f => {
                      if (f.playerId === cp.id && f.monsterCardId) {
                        prayingMonsterCardIds.add(f.monsterCardId);
                      }
                    });
                  });
                  // Monster cards in reserve: not deployed on map AND not praying at temple
                  const actualReserveMonsters = cp.seasonCards.filter(
                    (card) => card.cardType === 'monster' && !deployedMonsterCardIds.has(card.id) && !prayingMonsterCardIds.has(card.id)
                  );
                  const nonDaimyoMonsters = actualReserveMonsters.filter(c => !DAIMYO_MONSTER_IDS.includes(c.id));
                  const monsterCount = nonDaimyoMonsters.length;
                  // Daimyo count: normal daimyo + daimyo-type monsters in reserve
                  const daimyoMonstersInReserve = actualReserveMonsters.filter(c => DAIMYO_MONSTER_IDS.includes(c.id));
                  const daimyoCount = (cp.hasDaimyo ? 1 : 0) + daimyoMonstersInReserve.length;
                  const clanColor = (() => { const clan = CLANS.find(c => c.id === cp.clanId); return clan?.color || '#87CEEB'; })();
                  return (
                    <>
                      {monsterCount > 0 && (
                        <button
                          className={`recruit-type-btn ${recruitFigureType === 'monster' && recruitMode ? 'active' : ''}`}
                          onClick={() => { if (recruitFigureType === 'monster' && recruitMode) { toggleRecruitMode(); } else { setRecruitFigureType('monster'); if (!recruitMode) toggleRecruitMode(); } }}
                          style={{ '--recruit-clan-color': clanColor } as React.CSSProperties}
                        >
                          <MonsterIcon size={18} color={recruitFigureType === 'monster' && recruitMode ? clanColor : 'var(--text-secondary)'} />
                          <span className="recruit-type-label">Monstruo</span>
                          <span className="recruit-type-count">{monsterCount}</span>
                        </button>
                      )}
                      {daimyoCount > 0 && (
                        <button
                          className={`recruit-type-btn ${recruitFigureType === 'daimyo' && recruitMode ? 'active' : ''}`}
                          onClick={() => { if (recruitFigureType === 'daimyo' && recruitMode) { toggleRecruitMode(); } else { setRecruitFigureType('daimyo'); if (!recruitMode) toggleRecruitMode(); } }}
                          style={{ '--recruit-clan-color': clanColor } as React.CSSProperties}
                        >
                          <DaimyoIcon size={18} color={recruitFigureType === 'daimyo' && recruitMode ? clanColor : 'var(--text-secondary)'} />
                          <span className="recruit-type-label">Daimyo</span>
                          <span className="recruit-type-count">{daimyoCount}</span>
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
              {recruitMode && <p className="move-instruction">{recruitFigureType === 'shinto' ? t('actions.recruitSelectProvinceOrTemple') : t('actions.recruitSelectProvince')}</p>}
              {/* Monster selection popup for recruit */}
              {recruitMonsterSelectionVisible && cp && (() => {
                const cpClan = CLANS.find(c => c.id === cp.clanId);
                const DAIMYO_MONSTER_IDS = ['su-yurei', 'sp-fukurokuju'];
                const deployedMonsterCardIds = new Set<string>();
                Object.values(gameState.provinces).forEach((prov) => {
                  prov.figures.forEach((f) => {
                    if (f.type === 'monster' && f.owner === cp.id && f.monsterCardId) {
                      deployedMonsterCardIds.add(f.monsterCardId);
                    }
                  });
                });
                const prayingMonsterCardIds = new Set<string>();
                gameState.temples.forEach(temple => {
                  temple.figures.forEach(f => {
                    if (f.playerId === cp.id && f.monsterCardId) {
                      prayingMonsterCardIds.add(f.monsterCardId);
                    }
                  });
                });
                const actualReserveMonsters = cp.seasonCards.filter(
                  (card) => card.cardType === 'monster' && !deployedMonsterCardIds.has(card.id) && !prayingMonsterCardIds.has(card.id)
                );
                const nonDaimyoMonsters = actualReserveMonsters.filter(c => !DAIMYO_MONSTER_IDS.includes(c.id));
                return createPortal(
                  <div className="monster-placement-popup">
                    <div className="monster-placement-popup-content" style={{ border: `2px solid ${cpClan?.color || '#87CEEB'}`, maxWidth: '400px' }}>
                      <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Elige monstruo</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '8px 0' }}>
                        {nonDaimyoMonsters.map((card) => (
                          <button
                            key={card.id}
                            className="btn-alliance"
                            style={{ borderColor: cpClan?.color || '#87CEEB', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: '8px 12px' }}
                            onClick={() => doRecruitConfirmMonster(card.id)}
                          >
                            <span style={{ color: cpClan?.color || '#87CEEB', fontWeight: 'bold' }}>{card.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t(getCardEffectKey(card.id))}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        className="btn-secondary"
                        style={{ width: '100%', marginTop: '4px' }}
                        onClick={() => doRecruitDismissSelection()}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>,
                  document.body
                );
              })()}
              {/* Daimyo selection popup for recruit */}
              {recruitDaimyoSelectionVisible && cp && (() => {
                const cpClan = CLANS.find(c => c.id === cp.clanId);
                const DAIMYO_MONSTER_IDS = ['su-yurei', 'sp-fukurokuju'];
                const deployedMonsterCardIds = new Set<string>();
                Object.values(gameState.provinces).forEach((prov) => {
                  prov.figures.forEach((f) => {
                    if (f.type === 'monster' && f.owner === cp.id && f.monsterCardId) {
                      deployedMonsterCardIds.add(f.monsterCardId);
                    }
                  });
                });
                const prayingMonsterCardIds = new Set<string>();
                gameState.temples.forEach(temple => {
                  temple.figures.forEach(f => {
                    if (f.playerId === cp.id && f.monsterCardId) {
                      prayingMonsterCardIds.add(f.monsterCardId);
                    }
                  });
                });
                const actualReserveMonsters = cp.seasonCards.filter(
                  (card) => card.cardType === 'monster' && !deployedMonsterCardIds.has(card.id) && !prayingMonsterCardIds.has(card.id)
                );
                const daimyoMonstersInReserve = actualReserveMonsters.filter(c => DAIMYO_MONSTER_IDS.includes(c.id));
                const clanName = cpClan?.name || '';
                return createPortal(
                  <div className="monster-placement-popup">
                    <div className="monster-placement-popup-content" style={{ border: `2px solid ${cpClan?.color || '#87CEEB'}`, maxWidth: '400px' }}>
                      <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Elige daimyo</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '8px 0' }}>
                        {cp.hasDaimyo && (
                          <button
                            className="btn-alliance"
                            style={{ borderColor: cpClan?.color || '#87CEEB', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: '8px 12px' }}
                            onClick={() => doRecruitConfirmDaimyo('normal')}
                          >
                            <span style={{ color: cpClan?.color || '#87CEEB', fontWeight: 'bold' }}>Daimyo Clan {clanName}</span>
                          </button>
                        )}
                        {daimyoMonstersInReserve.map((card) => (
                          <button
                            key={card.id}
                            className="btn-alliance"
                            style={{ borderColor: cpClan?.color || '#87CEEB', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: '8px 12px' }}
                            onClick={() => doRecruitConfirmDaimyo(card.id)}
                          >
                            <span style={{ color: cpClan?.color || '#87CEEB', fontWeight: 'bold' }}>{card.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t(getCardEffectKey(card.id))}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        className="btn-secondary"
                        style={{ width: '100%', marginTop: '4px' }}
                        onClick={() => doRecruitDismissSelection()}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>,
                  document.body
                );
              })()}
              {/* Jinmenju ability button */}
              {cp && !jinmenjuSummonActive && (() => {
                const hasJinmenju = cp.seasonCards.some(c => c.id === 'sp-jinmenju');
                if (!hasJinmenju) return null;
                if (gameState.jinmenjuUsedThisMandate) return null;
                // Check if Jinmenju is placed on the map
                const jinmenjuOnMap = Object.values(gameState.provinces).some(prov =>
                  prov.figures.some(f => f.owner === cp.id && f.monsterCardId === 'sp-jinmenju')
                );
                if (!jinmenjuOnMap) return null;
                return (
                  <div style={{ marginTop: '8px', padding: '0.5rem', background: 'rgba(155,89,182,0.15)', border: '1px solid rgba(155,89,182,0.4)', borderRadius: '6px' }}>
                    <button className="btn-secondary" style={{ width: '100%', color: '#c89bdb', borderColor: '#9b59b6' }} onClick={doJinmenjuActivate}>
                      {t('actions.jinmenjuSummon')}
                    </button>
                    <p style={{ fontSize: '0.75rem', color: '#e57373', margin: '4px 0 0', textAlign: 'center' }}>
                      {t('actions.jinmenjuCost')}
                    </p>
                  </div>
                );
              })()}
              {jinmenjuSummonActive && (
                <div style={{ marginTop: '8px', padding: '0.5rem', background: 'rgba(155,89,182,0.2)', border: '1px solid rgba(155,89,182,0.5)', borderRadius: '6px' }}>
                  <p style={{ fontSize: '0.85rem', color: '#c89bdb', fontWeight: 'bold', margin: '0 0 4px', textAlign: 'center' }}>
                    {t('actions.jinmenjuSummon')}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 6px', textAlign: 'center' }}>
                    {recruitFigureType === 'shinto' ? t('actions.recruitSelectProvinceOrTemple') : t('actions.recruitSelectProvince')}
                  </p>
                  <button className="btn-secondary" style={{ width: '100%', fontSize: '0.8rem' }} onClick={doJinmenjuCancel}>
                    {t('actions.recruitCancelPlace')}
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                {undoMandateState && (
                  <button
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', padding: 0, marginRight: '8px' }}
                    onClick={doUndoMandate}
                    title="Undo"
                  >
                    <UndoIcon size={20} color="currentColor" />
                  </button>
                )}
                <button className="btn-primary" style={{ flex: 1 }} onClick={doSkipRecruitTurn}>
                  {t('actions.endRecruitTurn')}
                </button>
              </div>
            </div>
          )}

          {/* Betray mandate active - issuer selects enemy figures to replace */}
          {gameState.betrayMandateActive && (() => {
            const cpClan = cp ? CLANS.find(c => c.id === cp.clanId) : null;

            // Determine which figure types the issuer can deploy from reserve
            const canDeployBushi = cp ? cp.bushi > 0 : false;
            const canDeployShinto = cp ? cp.shinto > 0 : false;
            const canDeployMonster = (() => {
              if (!cp) return false;
              if (cp.monsters <= 0) return false;
              const deployedMonsterCardIds = new Set<string>();
              Object.values(gameState.provinces).forEach((prov) => {
                prov.figures.forEach((f) => {
                  if (f.type === 'monster' && f.owner === cp.id && f.monsterCardId) {
                    deployedMonsterCardIds.add(f.monsterCardId);
                  }
                });
              });
              return cp.seasonCards.some(
                (card) => card.cardType === 'monster' && !deployedMonsterCardIds.has(card.id)
              );
            })();

            // Get reserve monsters for the popup
            const reserveMonsters = (() => {
              if (!cp || !betrayMonsterSelectionVisible) return [];
              const deployedMonsterCardIds = new Set<string>();
              Object.values(gameState.provinces).forEach((prov) => {
                prov.figures.forEach((f) => {
                  if (f.type === 'monster' && f.owner === cp.id && f.monsterCardId) {
                    deployedMonsterCardIds.add(f.monsterCardId);
                  }
                });
              });
              return cp.seasonCards.filter(
                (card) => card.cardType === 'monster' && !deployedMonsterCardIds.has(card.id)
              );
            })();

            return (
              <div className="betray-active">
                <p className="betray-notice" style={{ margin: 0 }}>
                  <span style={{ fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>{t('actions.mandateName.betray')}</span>
                </p>
                <p style={{ margin: '4px 0' }}>
                  <ClanShield clanId={cp?.clanId || ''} size={40} />
                  <span style={{ color: cpClan?.color || '#E63946', fontWeight: 'bold', marginLeft: '4px' }}>{cp?.name || ''}</span>
                </p>
                <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>
                  Puedes reemplazar 2 figuras de clanes distintos desde tu reserva.
                </p>
                <p className="betray-selections">{t('actions.betraySelectionsLeft', { count: gameState.betraySelectionsRemaining })}</p>
                {(canDeployBushi || canDeployShinto || canDeployMonster) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '8px 0' }}>
                    {canDeployBushi && <BushiIcon size={36} color={cpClan?.color || '#E63946'} />}
                    {canDeployShinto && <ShintoIcon size={36} color={cpClan?.color || '#E63946'} />}
                    {canDeployMonster && <MonsterIcon size={36} color={cpClan?.color || '#E63946'} />}
                  </div>
                )}
                <p className="betray-instruction">{t('actions.betrayClickInstruction')}</p>

                {/* Monster selection popup */}
                {betrayMonsterSelectionVisible && cp && (
                  <div style={{ background: 'rgba(15,52,96,0.97)', border: `2px solid ${cpClan?.color || '#E63946'}`, borderRadius: '10px', padding: '12px', margin: '8px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <ClanShield clanId={cp.clanId} size={36} />
                      <span style={{ color: cpClan?.color || '#E63946', fontWeight: 'bold' }}>{cp.name}</span>
                    </div>
                    <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Selecciona monstruo</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '8px 0' }}>
                      {reserveMonsters.map((card) => (
                        <button
                          key={card.id}
                          className={`btn-alliance${selectedBetrayMonster === card.id ? ' selected' : ''}`}
                          style={{ borderColor: cpClan?.color || '#E63946', display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => setSelectedBetrayMonster(selectedBetrayMonster === card.id ? null : card.id)}
                        >
                          <MonsterIcon size={18} color={cpClan?.color || '#E63946'} />
                          <span style={{ color: cpClan?.color || '#E63946', fontWeight: 'bold' }}>{card.name}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      <button
                        className="btn-primary"
                        style={{ flex: 1 }}
                        disabled={!selectedBetrayMonster}
                        onClick={() => {
                          if (selectedBetrayMonster) {
                            doBetrayConfirmMonster(selectedBetrayMonster);
                            setSelectedBetrayMonster(null);
                          }
                        }}
                      >
                        Reemplazar
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ flex: 1 }}
                        onClick={() => { doBetrayDismissMonsterSelection(); setSelectedBetrayMonster(null); }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {gameState.betrayReplacements.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.85em' }}>
                    {gameState.betrayReplacements.map((entry, idx) => {
                      const entryClan = CLANS.find(c => c.id === entry.targetClanId);
                      const tooltipParts: string[] = [];
                      if (entry.figureType === 'monster') {
                        if (entry.targetMonsterName) tooltipParts.push(`Sustituido: ${entry.targetMonsterName}`);
                        if (entry.targetMonsterCardId) {
                          const effect = t(getCardEffectKey(entry.targetMonsterCardId));
                          if (effect) tooltipParts.push(effect);
                        }
                        if (entry.replacementMonsterName) tooltipParts.push(`Desplegado: ${entry.replacementMonsterName}`);
                        if (entry.replacementMonsterCardId) {
                          const effect = t(getCardEffectKey(entry.replacementMonsterCardId));
                          if (effect) tooltipParts.push(effect);
                        }
                      }
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }} title={tooltipParts.length > 0 ? tooltipParts.join(' | ') : undefined}>
                          <ClanShield clanId={entry.targetClanId} size={22} />
                          <span style={{ color: entryClan?.color || '#fff', fontWeight: 'bold' }}>{entry.targetPlayerName}</span>
                          {entry.figureType === 'bushi' && <BushiIcon size={18} color={entryClan?.color || '#fff'} />}
                          {entry.figureType === 'shinto' && <ShintoIcon size={18} color={entryClan?.color || '#fff'} />}
                          {entry.figureType === 'monster' && <MonsterIcon size={18} color={entryClan?.color || '#fff'} />}
                          {entry.figureType === 'monster' && entry.targetMonsterName && (
                            <span style={{ color: entryClan?.color || '#fff', fontSize: '0.9em' }}>{entry.targetMonsterName}</span>
                          )}
                          <span style={{ color: 'var(--text-secondary)' }}>en {entry.provinceName}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                  {undoMandateState && (
                    <button
                      className="btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', padding: 0, marginRight: '8px' }}
                      onClick={doUndoMandate}
                      title="Undo"
                    >
                      <UndoIcon size={20} color="currentColor" />
                    </button>
                  )}
                  <button className="btn-primary" style={{ flex: 1 }} onClick={doSkipBetrayTurn}>
                    {t('actions.betrayEndTurn')}
                  </button>
                </div>
              </div>
            );
          })()}

          {!gameState.trainMandateActive && !gameState.marshalMandateActive && !gameState.recruitMandateActive && !gameState.betrayMandateActive && gameState.drawnMandates.length === 0 && !gameState.mandateChoicePhase && !gameState.lotoChoicePhase && (
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
                  <span className="mandate-name" style={{ color: mandateColors[m] }}>{m.toUpperCase()}</span>
                  <span className="mandate-desc">{t(mandateDescKeys[m])}</span>
                </button>
              ))}
            </div>
          )}

          {gameState.lotoChoicePhase === true && (
            <div className="mandate-options loto-choice">
              <p className="loto-choice-label">Sustituir por:</p>
              {(['recruit', 'marshal', 'train', 'harvest', 'betray'] as MandateType[]).map((m: MandateType) => (
                <button
                  key={`loto-${m}`}
                  className={`btn-mandate mandate-${m}`}
                  onClick={() => doLotoChooseActualMandate(m)}
                >
                  <span className="mandate-name" style={{ color: mandateColors[m] }}>{m.toUpperCase()}</span>
                  <span className="mandate-desc">{t(mandateDescKeys[m])}</span>
                </button>
              ))}
            </div>
          )}


        </div>
      )}

      {/* Politics - not my turn */}
      {gameState.currentPhase === 'politics' && !isMyTurn && (() => {
        const cpClan = cp ? CLANS.find(c => c.id === cp.clanId) : null;
        return (
          <div className="politics-phase">
            <h4>{t('actions.politicsPhase')}</h4>
            <p className="phase-description">
              {t('actions.waitingFor', { name: '' })} <span style={{ color: cpClan?.color, fontWeight: 'bold' }}>{cp?.name || ''}</span>
            </p>
            {gameState.mode === 'online' && (
              <button
                className="btn-secondary trade-btn"
                onClick={() => setTradeModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', marginBottom: '0.7rem', padding: '0.5rem', borderColor: '#c8a951' }}
              >
                <HandshakeIcon size={22} color="#c8a951" />
                <span style={{ fontWeight: 'bold', color: '#c8a951', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('trade.button')}</span>
              </button>
            )}
          </div>
        );
      })()}

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
          {gameState.mode === 'hotseat' && isMyTurn && (
            <button className="btn-primary advance-btn" onClick={doAdvancePhase}>
              {t('actions.proceedNextSeason')}
            </button>
          )}
          {gameState.mode === 'online' && (
            <p className="phase-description" style={{ fontStyle: 'italic', opacity: 0.7 }}>
              {gameState.hostageReturnActive ? 'Devolucion de rehenes en curso...' :
               gameState.cleanupTeaCeremonyReady ? 'Esperando ceremonia del te...' :
               'Procesando limpieza...'}
            </p>
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
