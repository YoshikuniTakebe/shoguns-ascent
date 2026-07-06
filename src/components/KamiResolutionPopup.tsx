import { useGameStore } from '../store/gameStore';
import { CLANS, KAMI_DATA } from '../types/game';
import type { KamiType } from '../types/game';
import { ClanShield } from './ClanShields';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';

import amaterasuImg from '../img/Amaterasu.png';
import fujinImg from '../img/Fujin.png';
import hachimanImg from '../img/Hachiman.png';
import raijinImg from '../img/Raijin.png';
import ryujinImg from '../img/Ryujin.png';
import susanooImg from '../img/Susanoo.png';
import tsukuyomiImg from '../img/Tsukuyomi.png';

const KAMI_IMAGES: Record<KamiType, string> = {
  amaterasu: amaterasuImg,
  fujin: fujinImg,
  hachiman: hachimanImg,
  raijin: raijinImg,
  ryujin: ryujinImg,
  susanoo: susanooImg,
  tsukuyomi: tsukuyomiImg,
};

const KAMI_PALETTES: Record<KamiType, { primary: string; secondary: string; glow: string }> = {
  amaterasu: { primary: '#FFD700', secondary: '#FFA500', glow: 'rgba(255,215,0,0.3)' },
  fujin: { primary: '#4ECDC4', secondary: '#2C7873', glow: 'rgba(78,205,196,0.3)' },
  hachiman: { primary: '#DC143C', secondary: '#8B0000', glow: 'rgba(220,20,60,0.3)' },
  raijin: { primary: '#9B59B6', secondary: '#6C3483', glow: 'rgba(155,89,182,0.3)' },
  ryujin: { primary: '#1E90FF', secondary: '#003366', glow: 'rgba(30,144,255,0.3)' },
  susanoo: { primary: '#2ECC71', secondary: '#145A32', glow: 'rgba(46,204,113,0.3)' },
  tsukuyomi: { primary: '#C0C0C0', secondary: '#4A4A8A', glow: 'rgba(192,192,192,0.3)' },
};

export const KamiResolutionPopup = () => {
  const { gameState, doAcknowledgeKamiReward } = useGameStore();
  const localPlayerId = useGameStore(s => s.localPlayerId);
  const turnPopupPlayer = useGameStore(s => s.turnPopupPlayer);
  const t = useT();

  if (!gameState || !gameState.kamiResolutionActive || gameState.kamiResolutionStep !== 'showing') {
    return null;
  }

  // In online mode: don't show kami resolution popup if turn popup is active for this player
  if (gameState.mode === 'online' && turnPopupPlayer && turnPopupPlayer === localPlayerId) {
    return null;
  }

  const currentTemple = gameState.kamiResolutionTemples[gameState.kamiResolutionIndex];
  if (!currentTemple) return null;

  const isOnline = gameState.mode === 'online';
  const currentPlayerId = gameState.kamiResolutionCurrentPlayerId;

  // In online mode: if the local player is NOT the current resolving player, show waiting message
  if (isOnline && currentPlayerId && currentPlayerId !== localPlayerId) {
    const waitingPlayer = gameState.players.find(p => p.id === currentPlayerId);
    const waitingClan = waitingPlayer ? CLANS.find(c => c.id === waitingPlayer.clanId) : null;
    return (
      <div className="harvest-popup-backdrop">
        <div className="harvest-popup" style={{ borderColor: waitingClan?.color || '#c8a951' }}>
          <h3 className="harvest-popup-title" style={{ color: waitingClan?.color || '#c8a951', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <ClanShield clanId={waitingPlayer?.clanId || ''} size={24} />
            {t('kami.resolution.waitingFor' as TranslationKey, { name: waitingPlayer?.name || '' })}
          </h3>
        </div>
      </div>
    );
  }

  const kamiData = KAMI_DATA.find(k => k.type === currentTemple.kamiType);
  const palette = KAMI_PALETTES[currentTemple.kamiType];
  const kamiName = kamiData?.name || currentTemple.kamiType;

  const winner = currentTemple.winnerId
    ? gameState.players.find(p => p.id === currentTemple.winnerId)
    : null;
  const winnerClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;

  return (
    <div className="harvest-popup-backdrop">
      <div
        className="harvest-popup"
        style={{
          borderColor: palette.primary,
          maxWidth: '420px',
          minWidth: '320px',
        }}
      >
        {/* Temple number indicator */}
        <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '4px', textAlign: 'center' }}>
          {t('kami.resolution.templeOf', { number: String(gameState.kamiResolutionIndex + 1) })}
          {' ('}{gameState.kamiResolutionIndex + 1}/{gameState.kamiResolutionTemples.length}{')'}
        </div>

        {/* Kami image */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <img
            src={KAMI_IMAGES[currentTemple.kamiType]}
            alt={kamiName}
            width={120}
            height={120}
            style={{
              borderRadius: '10px',
              objectFit: 'cover',
              border: `2px solid ${palette.primary}`,
              boxShadow: `0 0 20px ${palette.glow}`,
            }}
          />
        </div>

        {/* Kami name */}
        <h3 style={{ color: palette.primary, textAlign: 'center', margin: '0 0 12px 0', fontSize: '1.4rem' }}>
          {kamiName}
        </h3>

        {/* Force breakdown */}
        {currentTemple.forces.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '6px', textAlign: 'center' }}>
              {t('kami.resolution.force')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {currentTemple.forces
                .sort((a, b) => b.count - a.count)
                .map(({ playerId, count }) => {
                  const player = gameState.players.find(p => p.id === playerId);
                  const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
                  return (
                    <div
                      key={playerId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: playerId === currentTemple.winnerId
                          ? `${clan?.color || '#666'}22`
                          : 'transparent',
                        border: playerId === currentTemple.winnerId
                          ? `1px solid ${clan?.color || '#666'}66`
                          : '1px solid transparent',
                      }}
                    >
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: clan?.color || '#666',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, fontSize: '0.9rem' }}>
                        {clan?.name || 'Unknown'}
                      </span>
                      <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Winner declaration */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(0,0,0,0.2)',
          marginBottom: '12px',
        }}>
          {winner && winnerClan ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <ClanShield clanId={winner.clanId} size={48} />
              <span style={{ color: winnerClan.color, fontWeight: 'bold', fontSize: '1.1rem' }}>
                {t('kami.resolution.winner', { name: winner.name })}
              </span>
              {currentTemple.reward && (
                <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                  {t('kami.resolution.reward', { reward: t(`kami.${currentTemple.kamiType}.summary` as TranslationKey) })}
                </span>
              )}
              {currentTemple.kamiType === 'susanoo' && currentTemple.susanooVPGained !== undefined && (
                <span style={{ fontSize: '0.9rem', color: palette.primary, fontWeight: 'bold' }}>
                  {t('kami.resolution.susanooVP', { vp: String(currentTemple.susanooVPGained), fortresses: String(currentTemple.susanooVPGained) })}
                </span>
              )}
            </div>
          ) : (
            <span style={{ opacity: 0.7, fontStyle: 'italic' }}>
              {t('kami.resolution.noWinner')}
            </span>
          )}
        </div>

        {/* Continue button */}
        <div style={{ textAlign: 'center' }}>
          <button
            className="btn-primary harvest-popup-btn"
            onClick={doAcknowledgeKamiReward}
            style={{ borderColor: palette.primary }}
          >
            {t('kami.resolution.continue')}
          </button>
        </div>
      </div>
    </div>
  );
};
