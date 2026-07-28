import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCE_COLORS } from '../types/game';
import { ClanShield } from './ClanShields';
import { useT } from '../i18n';

export const BattleMercyDecisionPopup = () => {
  const t = useT();
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveDecision = useGameStore(state => state.doResolveBattleMercyDecision);
  const pending = gameState?.pendingBattleMercyDecision;
  if (!gameState || !pending) return null;

  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const clan = owner ? CLANS.find(candidate => candidate.id === owner.clanId) : null;
  const province = gameState.provinces[pending.provinceId];
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: clan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: clan?.color || '#c8a951' }}>Misericordia</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={isOwner ? 24 : 72} />}
          <strong style={{ color: clan?.color }}>{owner?.name}</strong>
        </div>
        <p>
          {t('decision.mercy.questionBefore')}{' '}
          <strong style={{ color: PROVINCE_COLORS[pending.provinceId] || '#fff' }}>{province?.name}</strong>
          {' '}{t('decision.mercy.questionAfter')} <strong>2 PV</strong>.
        </p>
        {isOwner ? (
          <div className="battle-card-decision-actions">
            <button className="btn-primary" onClick={() => resolveDecision(true)}>{t('common.spare')}</button>
            <button className="btn-secondary" onClick={() => resolveDecision(false)}>{t('common.resolveCasualties')}</button>
          </div>
        ) : (
          <p className="waiting-label">{t('common.waitingForPlayer', { name: owner?.name || '' })}</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
