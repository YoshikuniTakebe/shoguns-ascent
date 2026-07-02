import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import { CoinIcon, RoninIcon } from './Icons';
import { ClanShield } from './ClanShields';
import { useT } from '../i18n';

export const TradeModal = () => {
  const { gameState, tradeModalOpen, setTradeModalOpen, doSendTrade } = useGameStore();
  const t = useT();

  const [offerCoins, setOfferCoins] = useState(0);
  const [offerRonin, setOfferRonin] = useState(0);
  const [requestCoins, setRequestCoins] = useState(0);
  const [requestRonin, setRequestRonin] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  if (!tradeModalOpen || !gameState) return null;

  const cp = gameState.players[gameState.currentPlayerIndex];
  if (!cp) return null;

  const otherPlayers = gameState.players.filter(p => p.id !== cp.id);

  const handleSend = () => {
    if (!selectedPlayer) return;
    if (offerCoins === 0 && offerRonin === 0 && requestCoins === 0 && requestRonin === 0) return;
    doSendTrade(selectedPlayer, offerCoins, offerRonin, requestCoins, requestRonin);
    setOfferCoins(0);
    setOfferRonin(0);
    setRequestCoins(0);
    setRequestRonin(0);
    setSelectedPlayer(null);
  };

  const handleClose = () => {
    setTradeModalOpen(false);
    setOfferCoins(0);
    setOfferRonin(0);
    setRequestCoins(0);
    setRequestRonin(0);
    setSelectedPlayer(null);
  };

  return (
    <div className="trade-modal-backdrop" onClick={handleClose}>
      <div className="trade-modal" onClick={(e) => e.stopPropagation()}>
        <button className="trade-modal-close" onClick={handleClose}>&times;</button>
        <h3 className="trade-modal-title">{t('trade.title')}</h3>
        <p className="trade-modal-subtitle">{t('trade.nonBinding')}</p>

        <div className="trade-modal-columns">
          {/* Coins column */}
          <div className="trade-modal-column">
            <div className="trade-modal-icon">
              <CoinIcon size={48} color="#f1c40f" />
            </div>
            <div className="trade-slider-group">
              <label className="trade-slider-label">
                <span>{t('trade.offerCoins')}</span>
                <span className="trade-slider-value" style={{ color: '#f1c40f' }}>{offerCoins}</span>
              </label>
              <input
                type="range"
                min={0}
                max={cp.coins}
                value={offerCoins}
                onChange={(e) => setOfferCoins(Number(e.target.value))}
                className="trade-slider"
              />
            </div>
            <div className="trade-slider-group">
              <label className="trade-slider-label">
                <span>{t('trade.requestCoins')}</span>
                <span className="trade-slider-value" style={{ color: '#e74c3c' }}>{requestCoins}</span>
              </label>
              <input
                type="range"
                min={0}
                max={20}
                value={requestCoins}
                onChange={(e) => setRequestCoins(Number(e.target.value))}
                className="trade-slider"
              />
            </div>
          </div>

          {/* Ronin column */}
          <div className="trade-modal-column">
            <div className="trade-modal-icon">
              <RoninIcon size={48} color="#e74c3c" />
            </div>
            <div className="trade-slider-group">
              <label className="trade-slider-label">
                <span>{t('trade.offerRonin')}</span>
                <span className="trade-slider-value" style={{ color: '#f1c40f' }}>{offerRonin}</span>
              </label>
              <input
                type="range"
                min={0}
                max={cp.ronin}
                value={offerRonin}
                onChange={(e) => setOfferRonin(Number(e.target.value))}
                className="trade-slider"
              />
            </div>
            <div className="trade-slider-group">
              <label className="trade-slider-label">
                <span>{t('trade.requestRonin')}</span>
                <span className="trade-slider-value" style={{ color: '#e74c3c' }}>{requestRonin}</span>
              </label>
              <input
                type="range"
                min={0}
                max={20}
                value={requestRonin}
                onChange={(e) => setRequestRonin(Number(e.target.value))}
                className="trade-slider"
              />
            </div>
          </div>
        </div>

        {/* Player selector */}
        <div className="trade-player-selector">
          <p className="trade-player-label">{t('trade.selectPlayer')}</p>
          <div className="trade-player-list">
            {otherPlayers.map(p => {
              const clan = CLANS.find(c => c.id === p.clanId);
              const isSelected = selectedPlayer === p.id;
              return (
                <button
                  key={p.id}
                  className={`trade-player-btn${isSelected ? ' selected' : ''}`}
                  style={{ borderColor: isSelected ? (clan?.color || '#c8a951') : 'transparent' }}
                  onClick={() => setSelectedPlayer(p.id)}
                >
                  <ClanShield clanId={p.clanId} size={28} />
                  <span style={{ color: clan?.color, fontWeight: 'bold' }}>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Send button */}
        <button
          className="btn-primary trade-send-btn"
          disabled={!selectedPlayer || (offerCoins === 0 && offerRonin === 0 && requestCoins === 0 && requestRonin === 0)}
          onClick={handleSend}
        >
          {t('trade.send')}
        </button>
      </div>
    </div>
  );
};
