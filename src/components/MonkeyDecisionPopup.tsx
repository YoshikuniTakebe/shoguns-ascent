import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon, HonorIcon } from './Icons';
import { useT } from '../i18n';

export const MonkeyDecisionPopup = () => {
  const t = useT();
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveMonkeyDecision);
  const pending = gameState?.pendingMonkeyDecision;

  const targets = useMemo(() => {
    if (!gameState || !pending) return [];
    const opponents = gameState.players.filter(player => player.id !== pending.ownerId && player.coins > 0);
    const richestCoins = Math.max(0, ...opponents.map(player => player.coins));
    return opponents.filter(player => player.coins === richestCoins);
  }, [gameState, pending]);

  if (!gameState || !pending || gameState.pendingRuleNotices?.length || gameState.pendingMonsterEnterDecision) return null;
  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const ownerClan = owner ? CLANS.find(clan => clan.id === owner.clanId) : null;
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: ownerClan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: ownerClan?.color || '#c8a951' }}>
          {t('decision.monkey.title', { copy: pending.copyNumber > 1 ? ` (${pending.copyNumber})` : '' })}
        </h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={isOwner ? 28 : 84} />}
          <strong style={{ color: ownerClan?.color }}>{owner?.name}</strong>
        </div>
        {isOwner ? (
          <>
            <p>{t('decision.monkey.questionBefore')} <strong>1</strong> <CoinIcon size={19} color="#f1c40f" /> {t('decision.monkey.questionAfter')} <HonorIcon size={19} color={ownerClan?.color} /></p>
            <div className="battle-card-target-list">
              {targets.map(target => {
                const clan = CLANS.find(candidate => candidate.id === target.clanId);
                return (
                  <div key={target.id} className="btn-secondary">
                    <ClanShield clanId={target.clanId} size={22} />
                    <strong style={{ color: clan?.color }}>{target.name}</strong>
                    <strong>{target.coins}</strong> <CoinIcon size={17} color="#f1c40f" />
                  </div>
                );
              })}
            </div>
            <div className="battle-card-decision-actions">
              <button className="btn-secondary" onClick={() => resolveDecision(false)}>{t('decision.monkey.decline')}</button>
              <button className="btn-primary" disabled={targets.length === 0} onClick={() => resolveDecision(true)}>{t('decision.monkey.take')}</button>
            </div>
          </>
        ) : (
          <p className="waiting-label">{t('common.waitingForResolution', { name: owner?.name || '', effect: 'Path of the Monkey' })}</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
