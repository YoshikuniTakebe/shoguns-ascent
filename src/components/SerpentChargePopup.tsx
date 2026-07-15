import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS, PROVINCE_COLORS } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon } from './Icons';

export const SerpentChargePopup = () => {
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
        <h3 className="battle-popup-title" style={{ color: ownerClan?.color || '#c8a951' }}>Camino de la Serpiente</h3>
        <div className="battle-card-decision-owner">
          {owner && <ClanShield clanId={owner.clanId} size={28} />}
          <strong style={{ color: ownerClan?.color }}>{owner?.name}</strong>
        </div>
        <p>
          ¿Quieres cobrar <CoinIcon size={19} color="#f1c40f" /> <strong>1</strong> a{' '}
          <span className="rule-event-inline-clan"><ClanShield clanId={mover?.clanId || ''} size={21} /><strong style={{ color: moverClan?.color }}>{mover?.name}</strong></span>{' '}
          por usar la ruta marítima de{' '}
          <strong style={{ color: PROVINCE_COLORS[pending.fromProvinceId] }}>{fromProvince?.name}</strong> a{' '}
          <strong style={{ color: PROVINCE_COLORS[pending.toProvinceId] }}>{toProvince?.name}</strong>?
        </p>
        {isOwner ? (
          <div className="battle-card-decision-actions">
            <button className="btn-primary" disabled={!mover || mover.coins <= 0} onClick={() => resolveCharge(true)}>Cobrar</button>
            <button className="btn-secondary" onClick={() => resolveCharge(false)}>No cobrar</button>
          </div>
        ) : (
          <p className="waiting-label">Esperando a que {owner?.name || 'el jugador'} decida si cobra la ruta marítima...</p>
        )}
      </div>
    </div>,
    document.body,
  );
};
