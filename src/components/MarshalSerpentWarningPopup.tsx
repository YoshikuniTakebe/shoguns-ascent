import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { ClanShield } from './ClanShields';
import { CoinIcon } from './Icons';
import { useT } from '../i18n';

export const MarshalSerpentWarningPopup = () => {
  const t = useT();
  const {
    gameState,
    localPlayerId,
    doAcknowledgeMarshalSerpentWarning,
  } = useGameStore();
  const playerId = gameState?.pendingMarshalSerpentWarningPlayerId;
  if (!gameState || !playerId) return null;

  const player = gameState.players.find(candidate => candidate.id === playerId);
  const clan = player ? CLANS.find(candidate => candidate.id === player.clanId) : null;
  const canAcknowledge = gameState.mode === 'hotseat' || localPlayerId === playerId;

  return (
    <div className="harvest-popup-backdrop">
      <div className="harvest-popup marshal-serpent-warning" style={{ borderColor: clan?.color }}>
        <h3 className="harvest-popup-title" style={{ color: clan?.color }}>
          <ClanShield clanId={player?.clanId || ''} size={34} />
          <span>{t('decision.serpent.warningTitle')}</span>
        </h3>
        <p className="marshal-serpent-warning-cost">
          <span>{t('decision.serpent.warningLineOne')}</span>
          <strong>1</strong>
          <CoinIcon size={22} color="#f1c40f" />
        </p>
        {canAcknowledge ? (
          <button className="btn-primary" onClick={doAcknowledgeMarshalSerpentWarning}>
            {t('common.accept')}
          </button>
        ) : (
          <p className="waiting-label">{t('common.waitingForPlayer', { name: player?.name || '' })}</p>
        )}
      </div>
    </div>
  );
};
