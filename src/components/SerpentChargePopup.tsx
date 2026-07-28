import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCE_COLORS } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon } from './Icons';
import { useT } from '../i18n';

export const SerpentChargePopup = () => {
  const t = useT();
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const resolveCharge = useGameStore(state => state.doResolveSerpentCharge);
  const pending = gameState?.pendingSerpentCharge;
  const ruleNoticeActive = Boolean(gameState?.pendingRuleNotices?.length);
  if (!gameState || !pending || ruleNoticeActive) return null;

  const owner = gameState.players.find(player => player.id === pending.ownerId);
  const mover = gameState.players.find(player => player.id === pending.moverId);
  const ownerClan = owner ? CLANS.find(clan => clan.id === owner.clanId) : null;
  const moverClan = mover ? CLANS.find(clan => clan.id === mover.clanId) : null;
  const fromProvince = gameState.provinces[pending.fromProvinceId];
  const toProvince = gameState.provinces[pending.toProvinceId];
  const isOwner = gameState.mode === 'hotseat' || localPlayerId === pending.ownerId;

  return createPortal(
    <div className="battle-popup-overlay">
      <div className="battle-popup-card battle-card-decision" style={{ borderColor: ownerClan?.color || '#c8a951' }}>
        <h3 className="battle-popup-title" style={{ color: ownerClan?.color || '#c8a951' }}>{t('decision.serpent.title')}</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={isOwner ? 28 : 84} />}
          <strong style={{ color: ownerClan?.color }}>{owner?.name}</strong>
        </div>
        <p className="battle-card-decision-question">
          {t('decision.serpent.questionBefore')} <strong>1</strong> <CoinIcon size={19} color="#f1c40f" /> a{' '}
          <span className="rule-event-inline-clan"><ClanShield clanId={mover?.clanId || ''} size={21} /><strong style={{ color: moverClan?.color }}>{mover?.name}</strong></span>{' '}
          {t('decision.serpent.questionAfter')}{' '}
          <strong style={{ color: PROVINCE_COLORS[pending.fromProvinceId] }}>{fromProvince?.name}</strong> a{' '}
          <strong style={{ color: PROVINCE_COLORS[pending.toProvinceId] }}>{toProvince?.name}</strong>?
        </p>
        {isOwner ? (
          <div className="battle-card-decision-actions">
            <button className="btn-primary" disabled={!mover || (!pending.forcedMove && mover.coins <= 0)} onClick={() => resolveCharge(true)}>
              {pending.forcedMove && (mover?.coins || 0) <= 0 ? t('decision.serpent.blockPassage') : t('decision.serpent.charge')}
            </button>
            <button className="btn-secondary" onClick={() => resolveCharge(false)}>{t('decision.serpent.decline')}</button>
          </div>
        ) : (
          <p className="waiting-label">{t('common.waitingForResolution', { name: owner?.name || '', effect: 'Path of the Serpent' })}</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
