import { useT } from '../i18n';
import type { Player, Season } from '../types/game';
import { PROVINCES_DATA } from '../types/game';

const PROVINCE_COLORS: Record<string, string> = {
  hokkaido: '#5BC0EB',
  oshu: '#B0BEC5',
  edo: '#E63946',
  kanto: '#2D8B4E',
  kansai: '#DAA520',
  nagato: '#8B5CF6',
  shikoku: '#F57C20',
  kyushu: '#F5D020',
};

const SEASON_ROMAN: Record<Season, string> = {
  spring: 'I',
  summer: 'II',
  autumn: 'III',
  winter: 'IV',
};

interface WarTokensModalProps {
  player: Player;
  onClose: () => void;
}

export const WarTokensModal = ({ player, onClose }: WarTokensModalProps) => {
  const t = useT();

  return (
    <div className="war-tokens-modal-backdrop" onClick={onClose}>
      <div className="war-tokens-modal" onClick={(e) => e.stopPropagation()}>
        <button className="war-tokens-modal-close" onClick={onClose}>
          &times;
        </button>
        <h2 className="war-tokens-modal-title">{t('warTokens.title')}</h2>
        {player.warProvinceTokens.length === 0 ? (
          <p className="war-tokens-empty">{t('warTokens.empty')}</p>
        ) : (
          <div className="war-token-grid">
            {player.warProvinceTokens.map((token, idx) => {
              const province = PROVINCES_DATA.find(p => p.id === token.provinceId);
              const borderColor = PROVINCE_COLORS[token.provinceId] || '#888';
              return (
                <div
                  key={`${token.provinceId}-${token.season}-${idx}`}
                  className="war-token-card"
                  style={{ borderColor }}
                >
                  <span className="war-token-name">{province?.name || token.provinceId}</span>
                  <span className="war-token-season">{SEASON_ROMAN[token.season]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
