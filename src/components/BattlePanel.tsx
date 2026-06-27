import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, WAR_TACTICS } from '../types/game';
import { useT } from '../i18n';

export const BattlePanel = () => {
  const {
    gameState,
    localPlayerId,
    doSubmitWarTacticBids,
    doAdvancePhase,
    battleStepPhase,
    battleCurrentBiddingIndex,
    doAcceptBattlePopup,
  } = useGameStore();
  const t = useT();
  const [bids, setBids] = useState<Record<string, number>>({
    seppuku: 0,
    'take-hostage': 0,
    'hire-ronin': 0,
    'imperial-poets': 0,
  });

  if (!gameState) return null;

  const allBattles = gameState.activeBattles;

  // Step-by-step battle flow:
  // Find first battle with resolved === false. That's what we display.
  // If uncontested -> show popup. If contested -> show bidding flow. If all resolved -> war complete.
  const currentBattleIndex = allBattles.findIndex(b => !b.resolved);

  // All battles resolved - war complete
  if (currentBattleIndex === -1) {
    return (
      <div className="battle-panel">
        <h3>{t('battle.warComplete')}</h3>
        <div className="resolved-battles">
          <h4>{t('battle.results')}</h4>
          {allBattles.map((b, i) => {
            const w = b.winner ? gameState.players.find(p => p.id === b.winner) : null;
            const wClan = w ? CLANS.find(c => c.id === w.clanId) : null;
            const prov = gameState.provinces[b.provinceId];
            return (
              <div key={i} className="battle-result">
                <span className="battle-region">{prov?.name || b.provinceId}</span>
                <span className="battle-winner">
                  {w ? <>{t('battle.winner')} <span style={{ color: wClan?.color, fontWeight: 'bold' }}>{w.name}</span></> : t('battle.discarded')}
                </span>
              </div>
            );
          })}
        </div>
        <button className="btn-primary advance-btn" onClick={doAdvancePhase}>{t('battle.endWar')}</button>
      </div>
    );
  }

  const battle = allBattles[currentBattleIndex];
  const province = gameState.provinces[battle.provinceId];
  const battleNumber = currentBattleIndex + 1;

  // --- UNCONTESTED BATTLE: show popup ---
  if (battle.uncontested) {
    const winner = battle.winner ? gameState.players.find(p => p.id === battle.winner) : null;
    const winnerClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;

    return (
      <div className="battle-popup-overlay">
        <div className="battle-popup-card">
          <h3 className="battle-popup-title">{t('battle.battleNumber', { number: battleNumber })}</h3>
          {winner ? (
            <p className="battle-popup-message" style={{ color: winnerClan?.color }}>
              {t('battle.uncontestedWin', { name: winner.name, region: province?.name || battle.provinceId })}
            </p>
          ) : (
            <p className="battle-popup-message">{t('battle.discarded')}</p>
          )}
          <button className="btn-primary battle-popup-accept" onClick={doAcceptBattlePopup}>
            {t('battle.accept')}
          </button>
        </div>
      </div>
    );
  }

  // --- CONTESTED BATTLE ---
  const isHotseat = gameState.mode === 'hotseat';

  // In hotseat mode: if battleStepPhase is null but we have a contested battle, treat as popup phase.
  // This is a safety fallback in case battleStepPhase was not properly initialized.
  const effectiveBattleStepPhase = (isHotseat && battleStepPhase === null) ? 'popup' : battleStepPhase;

  // In hotseat mode with popup phase: show "[Player] tiene que apostar" popup
  if (isHotseat && effectiveBattleStepPhase === 'popup') {
    const currentParticipant = battle.participants[battleCurrentBiddingIndex];
    const player = gameState.players.find(p => p.id === currentParticipant);
    const playerClan = player ? CLANS.find(c => c.id === player.clanId) : null;

    return (
      <div className="battle-popup-overlay">
        <div className="battle-popup-card">
          <h3 className="battle-popup-title">
            {t('battle.battleNumber', { number: battleNumber })}: {province?.name || battle.provinceId}
          </h3>
          <p className="battle-popup-message" style={{ color: playerClan?.color }}>
            {t('battle.playerMustBet', { name: player?.name || '' })}
          </p>
          <button className="btn-primary battle-popup-accept" onClick={doAcceptBattlePopup}>
            {t('battle.accept')}
          </button>
        </div>
      </div>
    );
  }

  // In hotseat mode with bidding phase: show bidding UI for current participant
  if (isHotseat && effectiveBattleStepPhase === 'bidding') {
    const currentParticipant = battle.participants[battleCurrentBiddingIndex];
    const player = gameState.players.find(p => p.id === currentParticipant);
    const playerClan = player ? CLANS.find(c => c.id === player.clanId) : null;
    const maxCoins = player?.coins || 0;
    const totalBid = Object.values(bids).reduce((sum, v) => sum + v, 0);

    const handleSubmitBids = () => {
      if (!currentParticipant) return;
      doSubmitWarTacticBids(battle.provinceId, bids);
      setBids({ seppuku: 0, 'take-hostage': 0, 'hire-ronin': 0, 'imperial-poets': 0 });
    };

    return (
      <div className="battle-panel">
        <h3>{t('battle.battleNumber', { number: battleNumber })}: {t('battle.battleIn', { name: province?.name || battle.provinceId })}</h3>

        <div className="battle-info">
          <h4 style={{ color: playerClan?.color }}>{player?.name} - {t('battle.warTactics')}</h4>
          <p className="bid-info">
            {t('battle.bidInfo', { current: totalBid, max: maxCoins })}
          </p>
          <div className="tactic-bids">
            {WAR_TACTICS.map(tactic => (
              <div key={tactic.id} className="tactic-bid-row">
                <span className="tactic-name">{tactic.name}</span>
                <input
                  type="range"
                  min="0"
                  max={maxCoins}
                  value={bids[tactic.id] || 0}
                  onChange={e => {
                    const newVal = +e.target.value;
                    const otherTotal = totalBid - (bids[tactic.id] || 0);
                    const clampedVal = Math.min(newVal, maxCoins - otherTotal);
                    setBids({ ...bids, [tactic.id]: Math.max(0, clampedVal) });
                  }}
                />
                <span className="tactic-bid-value">{bids[tactic.id] || 0}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={handleSubmitBids}>
            {t('battle.confirmBids', { total: totalBid })}
          </button>
        </div>

        {/* Combatants info */}
        <div className="battle-info">
          <h4>{t('battle.combatants')}</h4>
          {battle.participants.map(pid => {
            const p = gameState.players.find(x => x.id === pid);
            const clan = p ? CLANS.find(c => c.id === p.clanId) : null;
            const figures = province?.figures.filter(f => f.owner === pid) || [];
            return (
              <div key={pid} className="battle-combatant" style={{ borderColor: clan?.color }}>
                <span className="combatant-name" style={{ color: clan?.color }}>{p?.name}</span>
                <span className="combatant-forces">{figures.length} {t('battle.figures')}</span>
                <span className="combatant-bid-status">
                  {battle.warTacticBids[pid] !== undefined ? t('battle.bidsPlaced') : t('battle.waiting')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- ONLINE MODE or fallback: show bidding UI for local player simultaneously ---
  const apid = localPlayerId;
  const isPart = apid ? battle.participants.includes(apid) : false;
  const hasBid = apid ? battle.warTacticBids[apid] !== undefined : false;
  const maxCoins = apid ? (gameState.players.find(p => p.id === apid)?.coins || 0) : 0;
  const totalBid = Object.values(bids).reduce((sum, v) => sum + v, 0);

  const handleSubmitBids = () => {
    if (!apid) return;
    doSubmitWarTacticBids(battle.provinceId, bids);
    setBids({ seppuku: 0, 'take-hostage': 0, 'hire-ronin': 0, 'imperial-poets': 0 });
  };

  return (
    <div className="battle-panel">
      <h3>{t('battle.battleNumber', { number: battleNumber })}: {t('battle.battleIn', { name: province?.name || battle.provinceId })}</h3>

      <div className="battle-info">
        <h4>{t('battle.combatants')}</h4>
        {battle.participants.map(pid => {
          const p = gameState.players.find(x => x.id === pid);
          const clan = p ? CLANS.find(c => c.id === p.clanId) : null;
          const figures = province?.figures.filter(f => f.owner === pid) || [];
          return (
            <div key={pid} className="battle-combatant" style={{ borderColor: clan?.color }}>
              <span className="combatant-name" style={{ color: clan?.color }}>{p?.name}</span>
              <span className="combatant-forces">{figures.length} {t('battle.figures')}</span>
              <span className="combatant-bid-status">
                {battle.warTacticBids[pid] !== undefined ? t('battle.bidsPlaced') : t('battle.waiting')}
              </span>
            </div>
          );
        })}
      </div>

      {isPart && !hasBid && (
        <div className="bid-section">
          <h4>{t('battle.warTactics')}</h4>
          <p className="bid-info">
            {t('battle.bidInfo', { current: totalBid, max: maxCoins })}
          </p>
          <div className="tactic-bids">
            {WAR_TACTICS.map(tactic => (
              <div key={tactic.id} className="tactic-bid-row">
                <span className="tactic-name">{tactic.name}</span>
                <input
                  type="range"
                  min="0"
                  max={maxCoins}
                  value={bids[tactic.id] || 0}
                  onChange={e => {
                    const newVal = +e.target.value;
                    const otherTotal = totalBid - (bids[tactic.id] || 0);
                    const clampedVal = Math.min(newVal, maxCoins - otherTotal);
                    setBids({ ...bids, [tactic.id]: Math.max(0, clampedVal) });
                  }}
                />
                <span className="tactic-bid-value">{bids[tactic.id] || 0}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={handleSubmitBids}>
            {t('battle.confirmBids', { total: totalBid })}
          </button>
        </div>
      )}

      {isPart && hasBid && (
        <div className="bid-waiting">
          <p>{t('battle.bidsSubmitted')}</p>
        </div>
      )}

      {!isPart && (
        <div className="bid-spectator">
          <p>{t('battle.notPart')}</p>
        </div>
      )}
    </div>
  );
};
