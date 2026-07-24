import { useState } from 'react';
import { getConfiguredServerUrl, setConfiguredServerUrl, WS_BASE } from '../config';
import { useT } from '../i18n';
import { useGameStore } from '../store/gameStore';
import { AdminDioramaModal } from './AdminDioramaModal';
import { AdminCardsModal } from './AdminCardsModal';

/**
 * Admin-only configuration panel. Currently exposes the internal server URL used for online
 * play (hidden from regular users and injected transparently when creating/joining games).
 * More admin settings can be added here later.
 */
export const ConfigModal = ({ onClose }: { onClose: () => void }) => {
  const t = useT();
  const [serverUrl, setServerUrl] = useState(getConfiguredServerUrl());
  const [saved, setSaved] = useState(false);
  const [showDiorama, setShowDiorama] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const { authUser, showFigureMeasurements, setShowFigureMeasurements } = useGameStore();

  if (!authUser?.isAdmin) return null;

  const handleSave = () => {
    setConfiguredServerUrl(serverUrl);
    setSaved(true);
    setTimeout(onClose, 700);
  };

  return (
    <>
      <div className="config-modal-overlay" onClick={onClose}>
        <div className="config-modal" onClick={(e) => e.stopPropagation()}>
        <button className="config-modal-close" onClick={onClose}>&times;</button>
        <h3 className="config-modal-title">{t('config.title')}</h3>

        <label className="config-modal-label">{t('config.serverUrl')}</label>
        <input
          className="config-modal-input"
          value={serverUrl}
          onChange={(e) => { setServerUrl(e.target.value); setSaved(false); }}
          placeholder={WS_BASE}
        />
        <p className="config-modal-hint">{t('config.serverUrlHint')}</p>

        <div className="config-debug-section">
          <h4>Modo debug</h4>
          <label className="config-checkbox-row">
            <input
              type="checkbox"
              checked={showFigureMeasurements}
              onChange={event => setShowFigureMeasurements(event.target.checked)}
            />
            <span>Mostrar medidas de las figuras</span>
          </label>
          <div className="config-debug-actions">
            <button className="btn-secondary" onClick={() => setShowDiorama(true)}>
              Diorama
            </button>
            <button className="btn-secondary" onClick={() => setShowCards(true)}>
              {t('admin.cards.button')}
            </button>
          </div>
        </div>

        <div className="config-modal-actions">
          <button className="btn-primary" onClick={handleSave}>{saved ? t('config.saved') : t('config.save')}</button>
          <button className="btn-secondary" onClick={onClose}>{t('config.close')}</button>
        </div>
        </div>
      </div>
      {showDiorama && <AdminDioramaModal onClose={() => setShowDiorama(false)} />}
      {showCards && <AdminCardsModal onClose={() => setShowCards(false)} />}
    </>
  );
};
