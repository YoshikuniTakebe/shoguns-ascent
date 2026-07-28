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
  const title = notice.type === 'serpent' ? t('decision.serpent.title')
    : notice.type === 'ebisu' ? 'Ebisu'
      : notice.type === 'jurojin' ? 'Jurojin'
        : notice.type === 'benevolence' ? `Benevolence${(notice.copyNumber || 1) > 1 ? t('common.copySuffix', { number: notice.copyNumber || 1 }) : ''}`
          : notice.type === 'jikininki' ? 'Jikininki'
            : notice.type === 'koneko' ? 'Koneko'
              : notice.type === 'patience' ? 'Patience'
                : notice.type === 'righteousness' ? t('card.name.sp-righteousness')
                  : notice.type === 'oni-spite' ? t('card.name.au-oni-of-spite')
                    : notice.type === 'shadow' ? t('card.name.su-path-of-the-shadow')
                      : notice.type === 'vassal' ? t('card.name.sp-path-of-the-vassal')
                        : notice.type === 'merchant' ? t('card.name.su-way-of-the-merchant')
                : 'Hotei';
  const noticeColor = notice.type === 'hotei' ? targetClan?.color : actorClan?.color;

  return (
    <div className="harvest-popup-backdrop">
      <div className="harvest-popup rule-event-popup" style={{ borderColor: noticeColor }}>
        <h3 className={`harvest-popup-title${notice.type === 'benevolence' ? ' benevolence-notice-title' : ''}`} style={{ color: noticeColor }}>
          {notice.type === 'benevolence' && <ClanShield clanId={actor?.clanId || ''} size={32} />}
          <span>{title}</span>
        </h3>

        {notice.type === 'hotei' && (
          <>
            <div className="rule-event-transfer">
              <span><ClanShield clanId={actor?.clanId || ''} size={30} /><strong style={{ color: actorClan?.color }}>{actor?.name}</strong></span>
              <MonsterIcon size={24} color={actorClan?.color} />
              <span><ClanShield clanId={target?.clanId || ''} size={30} /><strong style={{ color: targetClan?.color }}>{target?.name}</strong></span>
            </div>
            <p><ShintoIcon size={18} color={targetClan?.color} /> {t('decision.hotei.replaced', { name: target?.name || '', kami: kamiName })}</p>
          </>
        )}

        {(notice.type === 'ebisu' || notice.type === 'jurojin') && (
          <p className="rule-event-ebisu-message" style={{ color: noticeColor }}>
            <span className="rule-event-ebisu-player"><ClanShield clanId={actor?.clanId || ''} size={34} /><strong>{actor?.name}</strong></span>
            <strong>{notice.type === 'jurojin' ? t('jurojin.notice.received') : t('ebisu.notice.received')}</strong>
            <span className="rule-event-ebisu-reward"><strong>{notice.rewardAmount || (notice.type === 'jurojin' ? 3 : 8)}</strong><CoinIcon size={25} color={noticeColor} /></span>
            <strong>{notice.type === 'jurojin' ? t('jurojin.notice.virtue') : t('ebisu.notice.death')}</strong>
          </p>
        )}

        {notice.type === 'benevolence' && (
          <p className="rule-event-card-reward">
            <span className="rule-event-inline-clan">
              <ClanShield clanId={actor?.clanId || ''} size={24} />
              <strong style={{ color: actorClan?.color }}>{actor?.name}</strong>
            </span>{' '}
            {t('notice.benevolence.gave')} <strong>1</strong> <CoinIcon size={18} color="#f1c40f" /> {t('notice.benevolence.to')}{' '}
            <span className="rule-event-inline-clan">
              <ClanShield clanId={target?.clanId || ''} size={22} />
              <strong style={{ color: targetClan?.color }}>{target?.name}</strong>
            </span>{' '}
            {t('notice.benevolence.received')} <HonorIcon size={20} color={actorClan?.color} /> {t('clanPower.and')}{' '}
            <strong style={{ color: actorClan?.color }}>2</strong> <VPIcon size={20} color={actorClan?.color} />.
          </p>
        )}

        {notice.type === 'serpent' && (
          <>
            <p>
              <span className="rule-event-inline-clan"><ClanShield clanId={actor?.clanId || ''} size={22} /><strong style={{ color: actorClan?.color }}>{actor?.name}</strong></span>{' '}
              {t('notice.serpent.charged')} <span className="rule-event-inline-clan"><ClanShield clanId={target?.clanId || ''} size={22} /><strong style={{ color: targetClan?.color }}>{target?.name}</strong></span>{' '}
              <strong>1</strong> <CoinIcon size={18} color="#f1c40f" /> {t('notice.serpent.route')}{' '}
              <strong style={{ color: notice.fromProvinceId ? PROVINCE_COLORS[notice.fromProvinceId] : undefined }}>{fromProvince?.name}</strong> a{' '}
              <strong style={{ color: notice.toProvinceId ? PROVINCE_COLORS[notice.toProvinceId] : undefined }}>{toProvince?.name}</strong>.
            </p>
            <div className="rule-event-totals">
              <span style={{ color: actorClan?.color }}><ClanShield clanId={actor?.clanId || ''} size={22} /><strong>{notice.actorCoins}</strong><CoinIcon size={17} color={actorClan?.color} /></span>
              <span style={{ color: targetClan?.color }}><ClanShield clanId={target?.clanId || ''} size={22} /><strong>{notice.targetCoins}</strong><CoinIcon size={17} color={targetClan?.color} /></span>
            </div>
          </>
        )}

        {notice.type === 'jikininki' && (
          <p className="rule-event-card-reward">
            <span className="rule-event-inline-clan"><ClanShield clanId={actor?.clanId || ''} size={28} /><strong style={{ color: actorClan?.color }}>{actor?.name}</strong></span>{' '}
            {t('notice.jikininki.gains')} <strong style={{ color: actorClan?.color }}>{notice.rewardAmount}</strong> <VPIcon size={21} color={actorClan?.color} /> {t('notice.jikininki.loses')}{' '}
            <strong style={{ color: actorClan?.color }}>{notice.honorLost}</strong> <HonorIcon size={21} color={actorClan?.color} /> {t('notice.jikininki.casualties')}{' '}
            <strong style={{ color: notice.provinceId ? PROVINCE_COLORS[notice.provinceId] : undefined }}>{province?.name}</strong>.
          </p>
        )}

        {notice.type === 'koneko' && (
          <>
            <p className="rule-event-card-reward">
              <span className="rule-event-inline-clan"><ClanShield clanId={actor?.clanId || ''} size={28} /><strong style={{ color: actorClan?.color }}>{actor?.name}</strong></span>{' '}
              {t('notice.koneko.gains')} <strong style={{ color: actorClan?.color }}>2</strong> <CoinIcon size={21} color={actorClan?.color} /> {t('clanPower.and')} <strong style={{ color: actorClan?.color }}>2</strong> <RoninIcon size={21} color={actorClan?.color} /> {t('notice.koneko.death')}
            </p>
            {(notice.affectedPlayers || []).map(entry => {
              const player = gameState.players.find(candidate => candidate.id === entry.playerId);
              const clan = player ? CLANS.find(candidate => candidate.id === player.clanId) : null;
              const coinsLost = entry.coinsLost ?? (entry.coins === 0 ? 2 : 0);
              const roninLost = entry.roninLost ?? (entry.ronin === 0 ? 2 : 0);
              return (
                <p key={entry.playerId} className="rule-event-affected">
                  <ClanShield clanId={player?.clanId || ''} size={20} />
                  <strong style={{ color: clan?.color }}>{player?.name}</strong> {t('notice.koneko.loses')}{' '}
                  <strong style={{ color: clan?.color }}>{coinsLost}</strong> <CoinIcon size={17} color={clan?.color} /> {t('clanPower.and')}{' '}
                  <strong style={{ color: clan?.color }}>{roninLost}</strong> <RoninIcon size={17} color={clan?.color} />.
                  {coinsLost < 2 && <> {t('notice.koneko.total')} <strong style={{ color: clan?.color }}>0</strong> <CoinIcon size={17} color={clan?.color} /></>}
                </p>
              );
            })}
          </>
        )}

        {notice.type === 'patience' && (
          <p className="rule-event-card-reward"><span className="rule-event-inline-clan"><ClanShield clanId={actor?.clanId || ''} size={28} /><strong style={{ color: actorClan?.color }}>{actor?.name}</strong></span> {t('notice.patience.gains')} <strong style={{ color: actorClan?.color }}>{notice.rewardAmount}</strong> <VPIcon size={21} color={actorClan?.color} /> {t('notice.patience.reason')}</p>
        )}

        {notice.type === 'righteousness' && (
          <p className="rule-event-card-reward">
            <span className="rule-event-inline-clan">
              <ClanShield clanId={actor?.clanId || ''} size={30} />
              <strong style={{ color: actorClan?.color }}>{actor?.name}</strong>
            </span>{' '}
            {t('notice.righteousness.gains')} <strong style={{ color: actorClan?.color }}>{notice.rewardAmount}</strong>{' '}
            <VPIcon size={22} color={actorClan?.color} />{' '}
            {t('notice.righteousness.reason', { count: notice.figureCount || 1 })}{' '}
            {t('notice.righteousness.total')}{' '}
            <strong style={{ color: actorClan?.color }}>{actor?.victoryPoints}</strong>{' '}
            <VPIcon size={20} color={actorClan?.color} />.
          </p>
        )}

        {notice.type === 'oni-spite' && (
          <>
            <p className="rule-event-card-reward">
              <span className="rule-event-inline-clan">
                <ClanShield clanId={actor?.clanId || ''} size={30} />
                <strong style={{ color: actorClan?.color }}>{actor?.name}</strong>
              </span>{' '}
              {t('notice.oniSpite.gains')} <strong style={{ color: actorClan?.color }}>{notice.rewardAmount}</strong>{' '}
              <VPIcon size={22} color={actorClan?.color} />{' '}
              {t('notice.oniSpite.inProvince')}{' '}
              <strong style={{ color: notice.provinceId ? PROVINCE_COLORS[notice.provinceId] : undefined }}>
                {province?.name}
              </strong>.
            </p>
            <div className="rule-event-victim-list">
              {(notice.affectedVictoryPoints || []).map(entry => {
                const victim = gameState.players.find(player => player.id === entry.playerId);
                const victimClan = victim ? CLANS.find(clan => clan.id === victim.clanId) : null;
                return (
                  <div key={entry.playerId} className="rule-event-victim-badge" style={{ borderColor: victimClan?.color }}>
                    <ClanShield clanId={victim?.clanId || ''} size={24} />
                    <strong style={{ color: victimClan?.color }}>{victim?.name}</strong>
                    <span>{t('notice.oniSpite.loses')}</span>
                    <strong style={{ color: victimClan?.color }}>{entry.amount}</strong>
                    <VPIcon size={18} color={victimClan?.color} />
                    <small>{t('notice.oniSpite.remaining')} <strong>{entry.remaining}</strong> <VPIcon size={14} color={victimClan?.color} /></small>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {notice.type === 'shadow' && (
          <p className="rule-event-card-reward">
            <span className="rule-event-inline-clan">
              <ClanShield clanId={actor?.clanId || ''} size={30} />
              <strong style={{ color: actorClan?.color }}>{actor?.name}</strong>
            </span>{' '}
            {t('notice.shadow.gains')} <strong style={{ color: actorClan?.color }}>{notice.rewardAmount || 3}</strong>{' '}
            <CoinIcon size={22} color={actorClan?.color} /> {t('notice.shadow.reason')}{' '}
            {t('notice.shadow.total')} <strong style={{ color: actorClan?.color }}>{notice.actorCoins}</strong>{' '}
            <CoinIcon size={19} color={actorClan?.color} />
          </p>
        )}

        {notice.type === 'vassal' && (
          <p className="rule-event-card-reward">
            <span className="rule-event-inline-clan">
              <ClanShield clanId={actor?.clanId || ''} size={30} />
              <strong style={{ color: actorClan?.color }}>{actor?.name}</strong>
            </span>{' '}
            {t('notice.vassal.gains')}{' '}
            <strong style={{ color: actorClan?.color }}>{notice.rewardAmount || 2}</strong>{' '}
            <VPIcon size={22} color={actorClan?.color} />{' '}
            {t('notice.vassal.total')}{' '}
            <strong style={{ color: actorClan?.color }}>{actor?.victoryPoints}</strong>{' '}
            <VPIcon size={20} color={actorClan?.color} />
          </p>
        )}

        {notice.type === 'merchant' && (
          <p className="rule-event-card-reward">
            <span className="rule-event-inline-clan">
              <ClanShield clanId={actor?.clanId || ''} size={30} />
              <strong style={{ color: actorClan?.color }}>{actor?.name}</strong>
            </span>{' '}
            {t('notice.merchant.gains')}{' '}
            <strong style={{ color: actorClan?.color }}>{notice.rewardAmount || 1}</strong>{' '}
            <CoinIcon size={22} color={actorClan?.color} />{' '}
            {t('notice.merchant.reasonBefore')}{' '}
            <span className="rule-event-inline-clan">
              <ClanShield clanId={target?.clanId || ''} size={24} />
              <strong style={{ color: targetClan?.color }}>{target?.name}</strong>
            </span>{' '}
            {t('notice.merchant.reasonAfter')}{' '}
            {t('notice.merchant.total')}{' '}
            <strong style={{ color: actorClan?.color }}>{notice.actorCoins}</strong>{' '}
            <CoinIcon size={19} color={actorClan?.color} />.
          </p>
        )}

        {mustAcknowledge ? (
          <button className="btn-primary" onClick={doAcknowledgeRuleNotice}>{t('common.accept')}</button>
        ) : (
          <p className="rule-event-waiting" style={{ color: noticeColor }}>{t('common.readyWaiting', { count: String(readyCount), total: String(notice.requiredPlayerIds.length) })}</p>
        )}
      </div>
    </div>
  );
};
