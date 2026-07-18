import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { Player, GameState } from '../types/game';
import { ClanShield } from './ClanShields';
import { BushiIcon, CoinIcon, FistIcon, HonorIcon, VPIcon, RoninIcon, ShintoIcon, FortressIcon, WarTokenIcon, HostageIcon, DaimyoIcon, MonsterIcon } from './Icons';
import { PlayerCardsModal } from './PlayerCardsModal';
import { WarTokensModal } from './WarTokensModal';
import { HostagesModal } from './HostagesModal';
import { useT } from '../i18n';
import { computeReserveTotals, getDeployedMonsterCardIds, getPrayingMonsterCardIds } from '../utils/reserveUtils';

const ClanPowerContent = ({ clanId, color }: { clanId: string; color: string }) => {
  switch (clanId) {
    case 'koi':
      return <>Puede usar <CoinIcon size={16} color={color} /> como <RoninIcon size={16} color={color} />. Al comenzar la Guerra cambia su Ronin por Monedas y, al Contratar Ronin, sus Monedas suman <FistIcon size={16} color={color} />.</>;
    case 'sol':
      return <>Cuando gana un empate por <HonorIcon size={16} color={color} />, gana <CoinIcon size={16} color={color} /> 1 y <VPIcon size={16} color={color} /> 1; el perdedor pierde esas mismas cantidades.</>;
    case 'loto':
      return <>Puede elegir cualquier <strong>Mandato político</strong>, sin importar las fichas que haya robado.</>;
    case 'tortuga':
      return <>Sus <FortressIcon size={17} color={color} /> se mueven como figuras y cuentan como <FistIcon size={16} color={color} /> 1.</>;
    case 'libelula':
      return <>Puede invocar y mover sus <BushiIcon size={16} color={color} /> <ShintoIcon size={17} color={color} /> <DaimyoIcon size={16} color={color} /> a cualquier Provincia.</>;
    case 'zorro':
      return <>Al inicio de la Guerra coloca <BushiIcon size={17} color={color} /> 1 gratis en cada Provincia donde no tenga figuras.</>;
    case 'bonsai':
      return <>El coste máximo de cualquier compra es <CoinIcon size={17} color={color} /> 1.</>;
    case 'luna':
      return <>Todas sus figuras tienen <FistIcon size={17} color={color} /> 2. Máximo 2 figuras por Provincia y 2 en cada Santuario.</>;
    default:
      return null;
  }
};

const ClanPowerTooltip = ({ player }: { player: Player }) => {
  const clan = CLANS.find(candidate => candidate.id === player.clanId)!;
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const showTooltip = (event: React.MouseEvent<HTMLSpanElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ top: rect.top + rect.height / 2, left: rect.right + 10 });
    setVisible(true);
  };

  return (
    <span
      className="player-name clan-power-trigger"
      style={{ color: clan.color }}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setVisible(false)}
    >
      <ClanShield clanId={player.clanId} size={48} />
      {player.name}
      {visible && createPortal(
        <span
          className="clan-power-tooltip-portal"
          style={{
            top: position.top,
            left: position.left,
            borderColor: clan.color,
          }}
        >
          <span className="clan-power-tooltip-title">
            <ClanShield clanId={player.clanId} size={28} />
            <strong style={{ color: clan.color }}>Clan {clan.name}</strong>
          </span>
          <span className="clan-power-tooltip-label">Poder del clan</span>
          <span className="clan-power-tooltip-text">
            <ClanPowerContent clanId={clan.id} color={clan.color} />
          </span>
        </span>,
        document.body,
      )}
    </span>
  );
};

const PlayerReserves = ({ player, gameState }: { player: Player; gameState: GameState }) => {
  const clan = CLANS.find(c => c.id === player.clanId)!;
  const totals = computeReserveTotals(player, gameState);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

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

  const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    setTooltipVisible(true);
  };

  const handleMouseLeave = () => {
    setTooltipVisible(false);
  };

  return (
    <>
      <span className="reserve-item" title="Bushi">
        <BushiIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.bushi.reserve}/{totals.bushi.total}</span>
      </span>
      <span className="reserve-item" title="Shinto">
        <ShintoIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.shinto.reserve}/{totals.shinto.total}</span>
      </span>
      <span className="reserve-item" title="Fortaleza">
        <FortressIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.fortresses.reserve}/{totals.fortresses.total}</span>
      </span>
      <span className="reserve-item" title="Daimyo">
        <DaimyoIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.daimyo.reserve}/{totals.daimyo.total}</span>
      </span>
      <span
        className="reserve-item reserve-item-monster-wrapper"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <MonsterIcon size={18} color={clan.color} className="reserve-icon" />
        <span className="reserve-count">{totals.monsters.reserve}/{totals.monsters.total}</span>
        {monsterCards.length > 0 && tooltipVisible && createPortal(
          <span
            className="monster-reserve-tooltip-portal"
            style={{
              position: 'fixed',
              top: tooltipPos.top,
              left: tooltipPos.left,
              transform: 'translateX(-50%) translateY(-100%)',
              borderColor: clan.color,
              zIndex: 10000,
            }}
          >
            {monsterCards.map((mc, idx) => (
              <span key={idx} className="figure-tooltip-name" style={{ color: mc.status === 'reserve' ? clan.color : '#888' }}>{mc.name}{mc.status === 'deployed' ? ' (mapa)' : mc.status === 'praying' ? ' (Rezando)' : ''}</span>
            ))}
          </span>,
          document.body
        )}
      </span>
    </>
  );
};

export const PlayerPanel = () => {
  const { gameState, localPlayerId, warPhasePopupVisible } = useGameStore();
  const t = useT();
  const [viewingCardsPlayer, setViewingCardsPlayer] = useState<Player | null>(null);
  const [viewingWarTokensPlayer, setViewingWarTokensPlayer] = useState<Player | null>(null);
  const [viewingHostagesPlayer, setViewingHostagesPlayer] = useState<Player | null>(null);
  if (!gameState) return null;
  const cp = gameState.players[gameState.currentPlayerIndex];

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
                <ClanPowerTooltip player={player} />
                <span className="clan-badge" style={{ '--clan-color': clan.color } as React.CSSProperties}>{clan.name}</span>
              </div>
              <div className="player-stats">
                <div className="stat">
                  <span className="stat-icon"><VPIcon size={16} color={clan.color} /></span>
                  <span className="stat-value">{player.victoryPoints} VP</span>
                </div>
                <div className="stat">
                  <span className="stat-icon"><CoinIcon size={16} color={clan.color} /></span>
                  <span className="stat-value">{gameState.currentPhase === 'war' && !warPhasePopupVisible ? '?' : player.coins} coins</span>
                </div>
                <div className="stat">
                  <span className="stat-icon"><HonorIcon size={16} color={clan.color} /></span>
                  <span className="stat-value">{player.honor} honor</span>
                </div>
                <div className="stat">
                  <span className="stat-icon"><RoninIcon size={16} color={clan.color} /></span>
                  <span className="stat-value">{gameState.currentPhase === 'war' && !warPhasePopupVisible && player.clanId === 'koi' ? 0 : player.ronin} ronin</span>
                </div>
              </div>
              <div className="player-reserves">
                <PlayerReserves player={player} gameState={gameState} />
              </div>
              <div className="player-extras">
                {player.warProvinceTokens.length > 0 && (
                  <button
                    className="war-token-btn"
                    onClick={(e) => { e.stopPropagation(); setViewingWarTokensPlayer(player); }}
                    title={t('warTokens.title')}
                  >
                    <WarTokenIcon size={16} color={clan.color} />
                    <span className="icon-btn-badge">{player.warProvinceTokens.length}</span>
                  </button>
                )}
                {player.hostages.length > 0 && (
                  <button
                    className="hostage-btn"
                    onClick={(e) => { e.stopPropagation(); setViewingHostagesPlayer(player); }}
                    title={t('hostages.title')}
                  >
                    <HostageIcon size={16} color={clan.color} />
                    <span className="icon-btn-badge">{player.hostages.length}</span>
                  </button>
                )}
                <button
                  className="player-cards-btn"
                  style={{ borderColor: clan.color }}
                  onClick={(e) => { e.stopPropagation(); setViewingCardsPlayer(player); }}
                >
                  &#x1F3B4; {t('playerCards.button', { count: String(player.seasonCards.length) })}
                </button>
              </div>

            </div>
          );
        })}
      </div>
      {viewingCardsPlayer && createPortal(
        <PlayerCardsModal
          player={viewingCardsPlayer}
          onClose={() => setViewingCardsPlayer(null)}
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
