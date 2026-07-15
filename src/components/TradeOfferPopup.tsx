import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { CoinIcon, RoninIcon } from './Icons';
import { ClanShield } from './ClanShields';
import { useT } from '../i18n';

export const TradeOfferPopup = () => {
  const { gameState, localPlayerId, doAcceptTrade, doRejectTrade } = useGameStore();
  const t = useT();

  if (!gameState) return null;
  if (gameState.currentPhase === 'war') return null;
  const cp = gameState.mode === 'online'
    ? gameState.players.find(p => p.id === localPlayerId)
    : gameState.players[gameState.currentPlayerIndex];
  if (!cp) return null;

  const pendingOffers = gameState.tradeOffers.filter(
    o => o.toPlayerId === cp.id && o.status === 'pending'
  );

  if (pendingOffers.length === 0) return null;

  return (
    <div className="trade-offer-popup-backdrop">
      <div className="trade-offer-popup">
        <h3 className="trade-offer-title">{t('trade.incoming')}</h3>
        {pendingOffers.map(offer => {
          const sender = gameState.players.find(p => p.id === offer.fromPlayerId);
          const senderClan = sender ? CLANS.find(c => c.id === sender.clanId) : null;
          return (
            <div key={offer.id} className="trade-offer-card">
              <div className="trade-offer-from">
                <span className="trade-offer-from-label">{t('trade.from')}:</span>
                {sender && <ClanShield clanId={sender.clanId} size={24} />}
                <span style={{ color: senderClan?.color, fontWeight: 'bold' }}>{sender?.name || ''}</span>
              </div>
              <div className="trade-offer-details">
                {(offer.offerCoins > 0 || offer.offerRonin > 0) && (
                  <div className="trade-offer-section">
                    <span className="trade-offer-section-label">{t('trade.offers')}:</span>
                    {offer.offerCoins > 0 && (
                      <span className="trade-offer-resource">
                        <CoinIcon size={18} color="#f1c40f" />
                        <span style={{ fontWeight: 'bold', color: '#f1c40f' }}>{offer.offerCoins}</span>
                      </span>
                    )}
                    {offer.offerRonin > 0 && (
                      <span className="trade-offer-resource">
                        <RoninIcon size={18} color="#e74c3c" />
                        <span style={{ fontWeight: 'bold', color: '#e74c3c' }}>{offer.offerRonin}</span>
                      </span>
                    )}
                  </div>
                )}
                {(offer.requestCoins > 0 || offer.requestRonin > 0) && (
                  <div className="trade-offer-section">
                    <span className="trade-offer-section-label">{t('trade.requests')}:</span>
                    {offer.requestCoins > 0 && (
                      <span className="trade-offer-resource">
                        <CoinIcon size={18} color="#f1c40f" />
                        <span style={{ fontWeight: 'bold', color: '#f1c40f' }}>{offer.requestCoins}</span>
                      </span>
                    )}
                    {offer.requestRonin > 0 && (
                      <span className="trade-offer-resource">
                        <RoninIcon size={18} color="#e74c3c" />
                        <span style={{ fontWeight: 'bold', color: '#e74c3c' }}>{offer.requestRonin}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              {offer.message && <p className="trade-offer-message">“{offer.message}”</p>}
              <p className="trade-offer-nonbinding">{t('trade.nonBinding')}</p>
              <div className="trade-offer-actions">
                <button className="btn-primary trade-offer-accept" onClick={() => doAcceptTrade(offer.id)}>
                  {t('trade.accept')}
                </button>
                <button className="btn-secondary trade-offer-reject" onClick={() => doRejectTrade(offer.id)}>
                  {t('trade.reject')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
