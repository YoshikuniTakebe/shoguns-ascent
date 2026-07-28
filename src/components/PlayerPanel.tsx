import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { Player, GameState } from '../types/game';
import { ClanShield } from './ClanShields';
import { BushiIcon, CoinIcon, HonorIcon, VPIcon, RoninIcon, ShintoIcon, FortressIcon, WarTokenIcon, HostageIcon, DaimyoIcon, MonsterIcon } from './Icons';
import { ClanPowerTooltip } from './ClanPowerTooltip';
import { PlayerCardsModal } from './PlayerCardsModal';
import { WarTokensModal } from './WarTokensModal';
import { HostagesModal } from './HostagesModal';
import { useT } from '../i18n';
import { computeReserveTotals, getDeployedMonsterCardIds, getPrayingMonsterCardIds } from '../utils/reserveUtils';

const SidebarIconTooltip = ({
  label,
  color,
  detail,
  className,
  as = 'span',
  children,
}: {
  label: string;
  color: string;
  detail?: ReactNode;
  className?: string;
  as?: 'span' | 'div';
  children: ReactNode;
}) => {
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; bottom: number; left: number }>({ top: 0, bottom: 0, left: 0 });
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'above' | 'below' }>({ top: 0, left: 0, placement: 'above' });
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const Tag = as;

  const showTooltip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const nextAnchor = { top: rect.top, bottom: rect.bottom, left: rect.left + rect.width / 2 };
    setAnchor(nextAnchor);
    setPos({ top: rect.top - 10, left: nextAnchor.left, placement: 'above' });
    setVisible(true);
  };

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!visible || !tooltip) return;
    const rect = tooltip.getBoundingClientRect();
    const padding = 8;
    const halfWidth = rect.width / 2;
    const left = Math.min(
      window.innerWidth - halfWidth - padding,
      Math.max(halfWidth + padding, anchor.left),
    );
    const fitsAbove = rect.height + 10 <= anchor.top;
    setPos({
      top: fitsAbove ? anchor.top - 10 : anchor.bottom + 10,
      left,
      placement: fitsAbove ? 'above' : 'below',
    });
  }, [anchor, visible]);

  return (
    <Tag
      className={className}
      aria-label={label}
      onMouseEnter={(e) => showTooltip(e.currentTarget)}
      onMouseLeave={() => setVisible(false)}
      onFocus={(e) => showTooltip(e.currentTarget)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && createPortal(
        <span
          ref={tooltipRef}
          className="figure-tooltip figure-tooltip-portal"
          style={{
            top: pos.top,
            left: pos.left,
            borderColor: color,
            maxWidth: 'calc(100vw - 16px)',
            transform: pos.placement === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
        >
          <span className="figure-tooltip-name" style={{ color }}>{label}</span>
          {detail && <span className="figure-tooltip-power">{detail}</span>}
        </span>,
        document.body,
      )}
    </Tag>
  );
};

const PlayerReserves = ({ player, gameState }: { player: Player; gameState: GameState }) => {
  const t = useT();
  const clan = CLANS.find(c => c.id === player.clanId)!;
  const totals = computeReserveTotals(player, gameState);

  // Use shared utility for deployed/praying detection (handles legacy saves)
  const deployedMonsterCardIds = getDeployedMonsterCardIds(player.id, gameState);
  const prayingMonsterCardIds = getPrayingMonsterCardIds(player.id, gameState, deployedMonsterCardIds);

  // Get list of monster cards with deployment status
  const monsterCards = player.seasonCards
    .filter(c => c.cardType === 'monster')
    .map(c => ({
      name: c.name,
      id: c.id,
      status: deployedMonsterCardIds.has(c.id) ? 'deployed' as const : prayingMonsterCardIds.has(c.id) ? 'praying' as const : 'reserve' as const,
    }));

  return (
    <>
      <SidebarIconTooltip className="reserve-item" label={t('legend.bushi')} color={clan.color}>
        <BushiIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.bushi.reserve}/{totals.bushi.total}</span>
      </SidebarIconTooltip>
      <SidebarIconTooltip className="reserve-item" label={t('legend.shinto')} color={clan.color}>
        <ShintoIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.shinto.reserve}/{totals.shinto.total}</span>
      </SidebarIconTooltip>
      <SidebarIconTooltip className="reserve-item" label={t('legend.fortress')} color={clan.color}>
        <FortressIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.fortresses.reserve}/{totals.fortresses.total}</span>
      </SidebarIconTooltip>
      <SidebarIconTooltip className="reserve-item" label={t('legend.daimyo')} color={clan.color}>
        <DaimyoIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.daimyo.reserve}/{totals.daimyo.total}</span>
      </SidebarIconTooltip>
      <SidebarIconTooltip
        className="reserve-item reserve-item-monster-wrapper"
        label={t('legend.monster')}
        color={clan.color}
        detail={monsterCards.length > 0 ? (
          <>
            {monsterCards.map((mc, idx) => (
              <span key={idx} className="sidebar-tooltip-line" style={{ color: mc.status === 'reserve' ? clan.color : '#888' }}>
                {mc.name}{mc.status === 'deployed' ? ' (mapa)' : mc.status === 'praying' ? ' (Rezando)' : ''}
              </span>
            ))}
          </>
        ) : undefined}
      >
        <MonsterIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.monsters.reserve}/{totals.monsters.total}</span>
      </SidebarIconTooltip>
    </>
  );
};

export const PlayerPanel = () => {
  const { gameState, localPlayerId, warPhasePopupVisible, setShowTrainModal } = useGameStore();
  const t = useT();
  const [viewingCardsPlayer, setViewingCardsPlayer] = useState<Player | null>(null);
  const [viewingWarTokensPlayer, setViewingWarTokensPlayer] = useState<Player | null>(null);
  const [viewingHostagesPlayer, setViewingHostagesPlayer] = useState<Player | null>(null);
  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIndex];
  const trainBuyerId = gameState.trainResolutionOrder?.[gameState.trainResolutionIndex];
  const ryujinBuyerId = gameState.ryujinBuyActive
    ? gameState.kamiResolutionTemples?.[gameState.kamiResolutionIndex]?.winnerId
    : null;
  const canReturnToCardPurchase = Boolean(
    viewingCardsPlayer &&
    (
      (
        gameState.trainMandateActive &&
        viewingCardsPlayer.id === trainBuyerId &&
        (gameState.mode !== 'online' || localPlayerId === trainBuyerId)
      ) ||
      (
        gameState.ryujinBuyActive &&
        gameState.kamiResolutionStep === 'interactive' &&
        viewingCardsPlayer.id === ryujinBuyerId &&
        (gameState.mode !== 'online' || localPlayerId === ryujinBuyerId)
      )
    ) &&
    !gameState.pendingMonsterPlacementCardId &&
    !gameState.pendingBenevolence &&
    !(gameState.pendingRuleNotices?.length || 0)
  );

  return (
    <div className="player-panel">
      <div className="player-list">
        {[...gameState.players]
          .sort((a, b) => gameState.turnOrder.indexOf(a.id) - gameState.turnOrder.indexOf(b.id))
          .map(player => {
          const clan = CLANS.find(c => c.id === player.clanId)!;
          return (
            <div
              key={player.id}
              className={`player-card ${player.id === cp?.id ? 'active' : ''} ${player.id === localPlayerId ? 'local' : ''}`}
              style={{
                borderLeftColor: clan.color,
                ...(player.id === cp?.id ? { boxShadow: `0 0 12px 3px ${clan.color}, inset 0 0 8px ${clan.color}40` } : {})
              }}
            >
              <div className="player-header">
                <ClanPowerTooltip player={player} className="player-name">
                  <ClanShield clanId={player.clanId} size={48} />
                  <span style={{ color: clan.color }}>{player.name}</span>
                </ClanPowerTooltip>
                <span className="clan-badge" style={{ '--clan-color': clan.color } as React.CSSProperties}>{clan.name}</span>
              </div>
              <div className="player-stats">
                <SidebarIconTooltip as="div" className="stat" label={t('legend.vp')} color={clan.color}>
                  <span className="stat-value">{player.victoryPoints}</span>
                  <span className="stat-icon"><VPIcon size={16} color={clan.color} /></span>
                </SidebarIconTooltip>
                <SidebarIconTooltip as="div" className="stat" label={t('legend.coin')} color={clan.color}>
                  <span className="stat-value">{gameState.currentPhase === 'war' && !warPhasePopupVisible ? '?' : player.coins}</span>
                  <span className="stat-icon"><CoinIcon size={16} color={clan.color} /></span>
                </SidebarIconTooltip>
                <SidebarIconTooltip as="div" className="stat" label={t('legend.honor')} color={clan.color}>
                  <span className="stat-value">{player.honor}</span>
                  <span className="stat-icon"><HonorIcon size={16} color={clan.color} /></span>
                </SidebarIconTooltip>
                <SidebarIconTooltip as="div" className="stat" label={t('legend.ronin')} color={clan.color}>
                  <span className="stat-value">{gameState.currentPhase === 'war' && !warPhasePopupVisible && player.clanId === 'koi' ? 0 : player.ronin}</span>
                  <span className="stat-icon"><RoninIcon size={16} color={clan.color} /></span>
                </SidebarIconTooltip>
              </div>
              <div className="player-reserves">
                <PlayerReserves player={player} gameState={gameState} />
              </div>
              <div className="player-extras">
                {player.warProvinceTokens.length > 0 && (
                  <SidebarIconTooltip className="player-extra-tooltip player-extra-tooltip-fixed" label={t('warTokens.title')} color={clan.color}>
                    <button
                      className="war-token-btn"
                      onClick={(e) => { e.stopPropagation(); setViewingWarTokensPlayer(player); }}
                      aria-label={t('warTokens.title')}
                    >
                      <WarTokenIcon size={16} color={clan.color} />
                      <span className="icon-btn-badge">{player.warProvinceTokens.length}</span>
                    </button>
                  </SidebarIconTooltip>
                )}
                {player.hostages.length > 0 && (
                  <SidebarIconTooltip className="player-extra-tooltip player-extra-tooltip-fixed" label={t('hostages.title')} color={clan.color}>
                    <button
                      className="hostage-btn"
                      onClick={(e) => { e.stopPropagation(); setViewingHostagesPlayer(player); }}
                      aria-label={t('hostages.title')}
                    >
                      <HostageIcon size={16} color={clan.color} />
                      <span className="icon-btn-badge">{player.hostages.length}</span>
                    </button>
                  </SidebarIconTooltip>
                )}
                <SidebarIconTooltip className="player-extra-tooltip player-extra-tooltip-cards" label={t('playerCards.button', { count: String(player.seasonCards.length) })} color={clan.color}>
                  <button
                    className="player-cards-btn"
                    style={{ borderColor: clan.color }}
                    onClick={(e) => { e.stopPropagation(); setViewingCardsPlayer(player); }}
                    aria-label={t('playerCards.button', { count: String(player.seasonCards.length) })}
                  >
                    &#x1F3B4; {t('playerCards.button', { count: String(player.seasonCards.length) })}
                  </button>
                </SidebarIconTooltip>
              </div>

            </div>
          );
        })}
      </div>
      {viewingCardsPlayer && createPortal(
        <PlayerCardsModal
          player={viewingCardsPlayer}
          onClose={() => setViewingCardsPlayer(null)}
          onReturnToPurchase={canReturnToCardPurchase ? () => {
            setViewingCardsPlayer(null);
            setShowTrainModal(true);
          } : undefined}
        />,
        document.body
      )}
      {viewingWarTokensPlayer && createPortal(
        <WarTokensModal
          player={viewingWarTokensPlayer}
          onClose={() => setViewingWarTokensPlayer(null)}
        />,
        document.body
      )}
      {viewingHostagesPlayer && createPortal(
        <HostagesModal
          player={viewingHostagesPlayer}
          onClose={() => setViewingHostagesPlayer(null)}
        />,
        document.body
      )}
    </div>
  );
};
