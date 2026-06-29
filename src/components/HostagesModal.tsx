import { useT } from '../i18n';
import type { Player } from '../types/game';
import { CLANS } from '../types/game';
import { BushiIcon } from './Icons';
import { ClanShield } from './ClanShields';

interface HostagesModalProps {
  player: Player;
  onClose: () => void;
}

export const HostagesModal = ({ player, onClose }: HostagesModalProps) => {
  const t = useT();

  return (
    <div className="hostages-modal-backdrop" onClick={onClose}>
      <div className="hostages-modal" onClick={(e) => e.stopPropagation()}>
        <button className="hostages-modal-close" onClick={onClose}>
          &times;
        </button>
        <h2 className="hostages-modal-title">{t('hostages.title')}</h2>
        {player.hostages.length === 0 ? (
          <p className="hostages-empty">{t('hostages.empty')}</p>
        ) : (
          <div className="hostage-grid">
            {player.hostages.map((hostage, idx) => {
              const clan = CLANS.find(c => c.id === hostage.fromClanId);
              const color = clan?.color || '#888';

              return (
                <div key={`${hostage.fromClanId}-${hostage.figureType}-${idx}`} className="hostage-item">
                  <BushiIcon size={48} color={color} />
                  <ClanShield clanId={hostage.fromClanId} size={36} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
