import { useT } from '../i18n';
import type { Player } from '../types/game';
import { CLANS } from '../types/game';
import { BushiIcon, ShintoIcon, RoninIcon } from './Icons';

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
              const clanName = clan?.name || hostage.fromClanId;

              let IconComponent: React.FC<{ size?: number; color?: string; className?: string }>;
              if (hostage.figureType === 'bushi') {
                IconComponent = BushiIcon;
              } else if (hostage.figureType === 'shinto') {
                IconComponent = ShintoIcon;
              } else {
                // monster or other types
                IconComponent = RoninIcon;
              }

              return (
                <div key={`${hostage.fromClanId}-${hostage.figureType}-${idx}`} className="hostage-item">
                  <IconComponent size={48} color={color} />
                  <span className="hostage-clan-name" style={{ color }}>{clanName}</span>
                  <span className="hostage-figure-type">{hostage.figureType}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
