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

export const KamiSummaryPopup = () => {
  const { gameState, doKamiSummaryReady } = useGameStore();
  const localPlayerId = useGameStore(s => s.localPlayerId);
  const t = useT();

  if (!gameState || !gameState.kamiSummaryVisible || !gameState.kamiSummaryData.length) {
    return null;
  }

  const isOnline = gameState.mode === 'online';
  const hasAccepted = isOnline && localPlayerId && gameState.kamiSummaryReadyPlayers.includes(localPlayerId);

  return (
    <div className="harvest-popup-backdrop">
      <div
        className="harvest-popup"
        style={{
          borderColor: '#9B59B6',
          maxWidth: '480px',
          minWidth: '320px',
          background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #1a0a2e 100%)',
          boxShadow: '0 0 20px rgba(155, 89, 182, 0.4), inset 0 0 30px rgba(155, 89, 182, 0.05)',
          borderWidth: '2px',
        }}
      >
        <h3 style={{ color: '#9B59B6', textAlign: 'center', margin: '0 0 16px 0', fontSize: '1.3rem' }}>
          {t('kami.summary.title')}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {gameState.kamiSummaryData.map((temple, idx) => {
            const kamiData = KAMI_DATA.find(k => k.type === temple.kamiType);
            const kamiName = kamiData?.name || temple.kamiType;
            const winner = temple.winnerId
              ? gameState.players.find(p => p.id === temple.winnerId)
              : null;
            const winnerClan = winner ? CLANS.find(c => c.id === winner.clanId) : null;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.25)',
                  border: `1px solid ${winnerClan?.color || '#555'}44`,
                }}
              >
                <img
                  src={KAMI_IMAGES[temple.kamiType]}
                  alt={kamiName}
                  width={40}
                  height={40}
                  style={{
                    borderRadius: '6px',
                    objectFit: 'cover',
                    border: '1px solid #555',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#ddd' }}>
                    {kamiName}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                    {t(`kami.${temple.kamiType}.summary` as TranslationKey)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {winner && winnerClan ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ClanShield clanId={winner.clanId} size={20} />
                      <span style={{ color: winnerClan.color, fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {t('kami.summary.winner', { name: winner.name })}
                      </span>
                    </div>
                  ) : (
                    <span style={{ opacity: 0.6, fontStyle: 'italic', fontSize: '0.85rem' }}>
                      {t('kami.summary.orphaned')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center' }}>
          {hasAccepted ? (
            <p style={{ color: '#9B59B6', fontSize: '1rem', fontWeight: 'bold' }}>
              {t('kami.summary.waiting', { count: String(gameState.kamiSummaryReadyPlayers.length), total: String(gameState.players.length) })}
            </p>
          ) : (
            <button
              className="btn-primary harvest-popup-btn"
              onClick={doKamiSummaryReady}
              style={{ borderColor: '#9B59B6' }}
            >
              {t('kami.summary.accept')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
