import { useGameStore } from '../store/gameStore';
import { CLANS, KAMI_DATA, PROVINCE_COLORS } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon, HonorIcon, MonsterIcon, RoninIcon, ShintoIcon, VPIcon } from './Icons';
import { useT } from '../i18n';

export const RuleEventNoticePopup = () => {
  const { gameState, localPlayerId, doAcknowledgeRuleNotice } = useGameStore();
  const t = useT();
  const notice = gameState?.pendingRuleNotices?.[0];
  if (!gameState || !notice || (gameState.pendingBenevolence && notice.type !== 'benevolence')) return null;

  const actor = gameState.players.find(player => player.id === notice.actorId);
  const target = gameState.players.find(player => player.id === notice.targetId);
  const actorClan = actor ? CLANS.find(clan => clan.id === actor.clanId) : null;
  const targetClan = target ? CLANS.find(clan => clan.id === target.clanId) : null;
  const nextHotseatPlayer = notice.requiredPlayerIds.find(id => !notice.acknowledgedPlayerIds.includes(id));
  const viewerId = gameState.mode === 'hotseat' ? nextHotseatPlayer : localPlayerId;
  const mustAcknowledge = !!viewerId && notice.requiredPlayerIds.includes(viewerId) && !notice.acknowledgedPlayerIds.includes(viewerId);
  const kamiName = KAMI_DATA.find(kami => kami.type === notice.templeKami)?.name || notice.templeKami || '';
  const province = notice.provinceId ? gameState.provinces[notice.provinceId] : null;
  const fromProvince = notice.fromProvinceId ? gameState.provinces[notice.fromProvinceId] : null;
  const toProvince = notice.toProvinceId ? gameState.provinces[notice.toProvinceId] : null;
  const readyCount = notice.acknowledgedPlayerIds.length;
  const title = notice.type === 'serpent' ? 'Camino de la Serpiente'
    : notice.type === 'ebisu' ? 'Ebisu'
      : notice.type === 'jurojin' ? 'Jurojin'
        : notice.type === 'benevolence' ? `Benevolence${(notice.copyNumber || 1) > 1 ? ` (${notice.copyNumber}ª copia)` : ''}`
          : notice.type === 'jikininki' ? 'Jikininki'
            : notice.type === 'koneko' ? 'Koneko'
              : notice.type === 'patience' ? 'Patience'
                : 'Hotei';
  const noticeColor = notice.type === 'hotei' ? targetClan?.color : actorClan?.color;

  return (
    <div className="harvest-popup-backdrop">
      <div className="harvest-popup rule-event-popup" style={{ borderColor: noticeColor }}>
        <h3 className="harvest-popup-title" style={{ color: noticeColor }}>{title}</h3>

        {notice.type === 'hotei' && (
          <>
            <div className="rule-event-transfer">
              <span><ClanShield clanId={actor?.clanId || ''} size={30} /><strong style={{ color: actorClan?.color }}>{actor?.name}</strong></span>
              <MonsterIcon size={24} color={actorClan?.color} />
              <span><ClanShield clanId={target?.clanId || ''} size={30} /><strong style={{ color: targetClan?.color }}>{target?.name}</strong></span>
            </div>
            <p><ShintoIcon size={18} color={targetClan?.color} /> El Shinto de {target?.name} ha sido sustituido por Hotei en el santuario de {kamiName}.</p>
          </>
        )}

        {(notice.type === 'ebisu' || notice.type === 'jurojin') && (
          <p className="rule-event-ebisu-message" style={{ color: noticeColor }}>
            <span className="rule-event-ebisu-player"><ClanShield clanId={actor?.clanId || ''} size={34} /><strong>{actor?.name}</strong></span>
            <strong>{notice.type === 'jurojin' ? t('jurojin.notice.received') : t('ebisu.notice.received')}</strong>
            <span className="rule-event-ebisu-reward"><CoinIcon size={25} color={noticeColor} /><strong>{notice.rewardAmount || (notice.type === 'jurojin' ? 3 : 8)}</strong></span>
            <strong>{notice.type === 'jurojin' ? t('jurojin.notice.virtue') : t('ebisu.notice.death')}</strong>
          </p>
        )}

        {notice.type === 'benevolence' && (
          <p><strong style={{ color: actorClan?.color }}>{actor?.name}</strong> ha entregado <CoinIcon size={18} color="#f1c40f" /> 1 a <strong style={{ color: targetClan?.color }}>{target?.name}</strong> y ha obtenido Honor y <strong style={{ color: actorClan?.color }}>2 PV</strong>.</p>
        )}

        {notice.type === 'serpent' && (
          <>
            <p>
              <span className="rule-event-inline-clan"><ClanShield clanId={actor?.clanId || ''} size={22} /><strong style={{ color: actorClan?.color }}>{actor?.name}</strong></span>{' '}
              ha cobrado a <span className="rule-event-inline-clan"><ClanShield clanId={target?.clanId || ''} size={22} /><strong style={{ color: targetClan?.color }}>{target?.name}</strong></span>{' '}
              <CoinIcon size={18} color="#f1c40f" /> <strong>1</strong> por usar la ruta marítima de{' '}
              <strong style={{ color: notice.fromProvinceId ? PROVINCE_COLORS[notice.fromProvinceId] : undefined }}>{fromProvince?.name}</strong> a{' '}
              <strong style={{ color: notice.toProvinceId ? PROVINCE_COLORS[notice.toProvinceId] : undefined }}>{toProvince?.name}</strong>.
            </p>
            <div className="rule-event-totals">
              <span style={{ color: actorClan?.color }}><ClanShield clanId={actor?.clanId || ''} size={22} /><CoinIcon size={17} color={actorClan?.color} />{notice.actorCoins}</span>
              <span style={{ color: targetClan?.color }}><ClanShield clanId={target?.clanId || ''} size={22} /><CoinIcon size={17} color={targetClan?.color} />{notice.targetCoins}</span>
            </div>
          </>
        )}

        {notice.type === 'jikininki' && (
          <p className="rule-event-card-reward">
            <span className="rule-event-inline-clan"><ClanShield clanId={actor?.clanId || ''} size={28} /><strong style={{ color: actorClan?.color }}>{actor?.name}</strong></span>{' '}
            gana <VPIcon size={21} color={actorClan?.color} /> <strong style={{ color: actorClan?.color }}>{notice.rewardAmount}</strong> y pierde{' '}
            <HonorIcon size={21} color={actorClan?.color} /> <strong style={{ color: actorClan?.color }}>{notice.honorLost}</strong> por las bajas en{' '}
            <strong style={{ color: notice.provinceId ? PROVINCE_COLORS[notice.provinceId] : undefined }}>{province?.name}</strong>.
          </p>
        )}

        {notice.type === 'koneko' && (
          <>
            <p className="rule-event-card-reward">
              <span className="rule-event-inline-clan"><ClanShield clanId={actor?.clanId || ''} size={28} /><strong style={{ color: actorClan?.color }}>{actor?.name}</strong></span>{' '}
              gana <CoinIcon size={21} color={actorClan?.color} /> <strong style={{ color: actorClan?.color }}>2</strong> y <RoninIcon size={21} color={actorClan?.color} /> <strong style={{ color: actorClan?.color }}>2</strong> por la muerte de Koneko.
            </p>
            {(notice.affectedPlayers || []).map(entry => {
              const player = gameState.players.find(candidate => candidate.id === entry.playerId);
              const clan = player ? CLANS.find(candidate => candidate.id === player.clanId) : null;
              return <p key={entry.playerId} className="rule-event-affected"><ClanShield clanId={player?.clanId || ''} size={20} /><strong style={{ color: clan?.color }}>{player?.name}</strong> pierde hasta <CoinIcon size={17} color={clan?.color} /> 2 y <RoninIcon size={17} color={clan?.color} /> 2. Total: <CoinIcon size={17} color={clan?.color} /> {entry.coins} <RoninIcon size={17} color={clan?.color} /> {entry.ronin}</p>;
            })}
          </>
        )}

        {notice.type === 'patience' && (
          <p className="rule-event-card-reward"><span className="rule-event-inline-clan"><ClanShield clanId={actor?.clanId || ''} size={28} /><strong style={{ color: actorClan?.color }}>{actor?.name}</strong></span> gana <VPIcon size={21} color={actorClan?.color} /> <strong style={{ color: actorClan?.color }}>{notice.rewardAmount}</strong> por Patience.</p>
        )}

        {mustAcknowledge ? (
          <button className="btn-primary" onClick={doAcknowledgeRuleNotice}>Aceptar</button>
        ) : (
          <p className="rule-event-waiting" style={{ color: noticeColor }}>{readyCount}/{notice.requiredPlayerIds.length} listos. Esperando al resto de jugadores.</p>
        )}
      </div>
    </div>
  );
};
