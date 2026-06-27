import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, WAR_TACTICS } from '../types/game';
import type { Battle, GameState } from '../types/game';
import { ClanShield } from './ClanShields';
import { useT } from '../i18n';

/**
 * Extract log entries for a resolved battle using its logStartIndex
 * to avoid pulling entries from other battles.
 */
function extractBattleLogs(log: string[], battle: Battle): string[] {
  const startIdx = battle.logStartIndex ?? 0;
  const battleLogs: string[] = [];
  for (let i = startIdx; i < log.length; i++) {
    const entry = log[i];
    if (
      entry.includes('commits Seppuku') ||
      entry.includes('takes a hostage') ||
      entry.includes('hires ronin') ||
      (entry.includes('gains') && entry.includes('VP from Imperial Poets')) ||
      entry.includes('wins the battle in')
    ) {
      battleLogs.push(entry);
    }
  }
  return battleLogs;
}

/**
 * Shared battle result popup content used by both hotseat and online modes.
 */
function BattleResultPopup({
  battle,
  gameState,
  onAccept,
  t,
}: {
  battle: Battle;
  gameState: GameState;
  onAccept: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const resProvince = gameState.provinces[battle.provinceId];
  const winner = battle.winner ? gameState.players.find(p => p.id === battle.winner) : null;
  const winnerClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;
  const battleLogs = extractBattleLogs(gameState.log, battle);

  return (
    <div className="battle-popup-overlay">
      <div className="battle-popup-card">
        <h3 className="battle-popup-title">{t('battle.resultTitle')}</h3>
        <p className="battle-popup-message" style={{ fontSize: '1.1em', marginBottom: '0.5rem' }}>
          {resProvince?.name || battle.provinceId}
        </p>
        {winner && winnerClan && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ClanShield clanId={winner.clanId} size={28} />
            <span style={{ color: winnerClan.color, fontWeight: 'bold', fontSize: '1.1em' }}>
              {t('battle.resultWinner', { name: winner.name })}
            </span>
          </div>
        )}
        {winner && (
          <p style={{ color: winnerClan?.color, margin: '0.25rem 0' }}>
            {t('battle.resultWarToken', { province: resProvince?.name || battle.provinceId })}
          </p>
        )}
        {battleLogs.length > 0 && (
          <div style={{ textAlign: 'left', margin: '0.75rem 0', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '0.9em' }}>
            {battleLogs.map((entry, i) => (
              <p key={i} style={{ margin: '0.2rem 0' }}>{entry}</p>
            ))}
          </div>
        )}
        <button className="btn-primary battle-popup-accept" onClick={onAccept}>
          {t('battle.continue')}
        </button>
      </div>
    </div>
  );
}

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

  // In hotseat mode with result phase: show battle result summary
  if (isHotseat && effectiveBattleStepPhase === 'result') {
    // Find the most recently resolved battle (the one just resolved)
    const resolvedBattles = allBattles.filter(b => b.resolved && !b.uncontested);
    const justResolved = resolvedBattles[resolvedBattles.length - 1];

    if (justResolved) {
      return (
        <BattleResultPopup
          battle={justResolved}
          gameState={gameState}
          onAccept={doAcceptBattlePopup}
          t={t}
        />
      );
    }
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

  // --- ONLINE MODE or fallback: show result popup for online mode ---
  if (!isHotseat && effectiveBattleStepPhase === 'result') {
    const resolvedBattles = allBattles.filter(b => b.resolved && !b.uncontested);
    const justResolved = resolvedBattles[resolvedBattles.length - 1];

    if (justResolved) {
      return (
        <BattleResultPopup
          battle={justResolved}
          gameState={gameState}
          onAccept={doAcceptBattlePopup}
          t={t}
        />
      );
    }
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
