import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS, WAR_TACTICS } from '../types/game';
import { useT } from '../i18n';

export const BattlePanel = () => {
  const { gameState, localPlayerId, doSubmitWarTacticBids, doResolveNextBattle, doAdvancePhase, warTacticBidsSubmitted } = useGameStore();
  const t = useT();
  const [bids, setBids] = useState<Record<string, number>>({
    seppuku: 0,
    'take-hostage': 0,
    'hire-ronin': 0,
    'imperial-poets': 0,
  });

  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIndex];
  const apid = gameState.mode === 'hotseat' ? cp?.id : localPlayerId;
  const isMyTurn = gameState.mode === 'hotseat' || cp?.id === localPlayerId;

  const active = gameState.activeBattles.filter(b => !b.resolved);
  const resolved = gameState.activeBattles.filter(b => b.resolved);

  if (active.length === 0) {
    return (
      <div className="battle-panel">
        <h3>{t('battle.warComplete')}</h3>
        {resolved.length > 0 && (
          <div className="resolved-battles">
            <h4>{t('battle.results')}</h4>
            {resolved.map((b, i) => {
              const w = gameState.players.find(p => p.id === b.winner);
              const prov = gameState.provinces[b.provinceId];
              return (
                <div key={i} className="battle-result">
                  <span className="battle-region">{prov?.name || b.provinceId}</span>
                  <span className="battle-winner">{t('battle.winner')} {w?.name || 'None'}</span>
                </div>
              );
            })}
          </div>
        )}
        {isMyTurn && (
          <button className="btn-primary advance-btn" onClick={doAdvancePhase}>{t('battle.endWar')}</button>
        )}
      </div>
    );
  }

  const battle = active[0];
  const province = gameState.provinces[battle.provinceId];
  const isPart = apid ? battle.participants.includes(apid) : false;
  const hasBid = apid ? battle.warTacticBids[apid] !== undefined : false;

  const totalBid = Object.values(bids).reduce((sum, v) => sum + v, 0);
  const maxCoins = cp?.coins || 0;

  const handleSubmitBids = () => {
    if (!apid) return;
    doSubmitWarTacticBids(battle.provinceId, bids);
    setBids({ seppuku: 0, 'take-hostage': 0, 'hire-ronin': 0, 'imperial-poets': 0 });
  };

  return (
    <div className="battle-panel">
      <h3>{t('battle.battleIn', { name: province?.name || battle.provinceId })}</h3>

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

      {isPart && !hasBid && !warTacticBidsSubmitted && (
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

      {(hasBid || warTacticBidsSubmitted) && isPart && (
        <div className="bid-waiting">
          <p>{t('battle.bidsSubmitted')}</p>
          {isMyTurn && (
            <button className="btn-primary" onClick={doResolveNextBattle}>
              {t('battle.resolveBattle')}
            </button>
          )}
        </div>
      )}

      {!isPart && (
        <div className="bid-spectator">
          <p>{t('battle.notPart')}</p>
          {isMyTurn && (
            <button className="btn-primary" onClick={doResolveNextBattle}>
              {t('battle.resolveBattle')}
            </button>
          )}
        </div>
      )}

      {/* Show resolved battles */}
      {resolved.length > 0 && (
        <div className="resolved-battles">
          <h4>{t('battle.previousResults')}</h4>
          {resolved.map((b, i) => {
            const w = gameState.players.find(p => p.id === b.winner);
            const prov = gameState.provinces[b.provinceId];
            return (
              <div key={i} className="battle-result">
                <span className="battle-region">{prov?.name || b.provinceId}</span>
                <span className="battle-winner">{t('battle.winner')} {w?.name || 'None'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
