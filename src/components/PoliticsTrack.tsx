import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { MandateType } from '../types/game';
import { SeasonCardsModal } from './SeasonCardsModal';

const MANDATE_LABELS: Record<MandateType, string> = {
  train: 'Entrenamiento',
  recruit: 'Reclutar',
  harvest: 'Cosechar',
  marshal: 'Movilizar',
  betray: 'Traicionar',
};

const MANDATE_COLORS: Record<MandateType, string> = {
  train: '#8B4513',     // Brown / Marron
  recruit: '#87CEEB',   // Light blue / Celeste
  harvest: '#2E8B57',   // Green / Verde
  marshal: '#808080',   // Gray / Gris
  betray: '#DC143C',    // Red / Rojo
};

const MANDATE_BG_COLORS: Record<MandateType, string> = {
  train: 'rgba(139,69,19,0.15)',
  recruit: 'rgba(135,206,235,0.15)',
  harvest: 'rgba(46,139,87,0.15)',
  marshal: 'rgba(128,128,128,0.15)',
  betray: 'rgba(220,20,60,0.15)',
};

/** Feudal Japanese illustration SVG for each mandate type */
function MandateIllustration({ type, size = 40 }: { type: MandateType; size?: number }) {
  const color = MANDATE_COLORS[type];

  switch (type) {
    case 'train':
      // Samurai training with katana - dojo scene
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          {/* Dojo floor */}
          <rect x="8" y="50" width="48" height="4" rx="1" fill={color} opacity="0.3" />
          {/* Samurai figure */}
          <circle cx="32" cy="18" r="6" fill={color} opacity="0.8" />
          {/* Body in stance */}
          <path d="M32 24 L32 42 M26 32 L38 32 M32 42 L26 52 M32 42 L38 52" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          {/* Katana raised */}
          <path d="M38 32 L48 14 L50 13" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M48 14 L50 13 L49 15" fill={color} />
          {/* Training dummy */}
          <path d="M14 28 L14 48 M10 28 L18 28" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <circle cx="14" cy="24" r="3" stroke={color} strokeWidth="1.5" fill="none" opacity="0.5" />
          {/* Torii gate detail */}
          <path d="M46 44 L46 52 M54 44 L54 52 M44 44 L56 44 M44 46 L56 46" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        </svg>
      );

    case 'recruit':
      // Ashigaru soldiers gathering with banners
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          {/* Banner/Sashimono */}
          <rect x="12" y="8" width="2" height="44" fill={color} opacity="0.7" />
          <rect x="14" y="8" width="12" height="16" rx="1" fill={color} opacity="0.5" />
          <path d="M16 12 L22 16 L16 20" fill="white" opacity="0.6" />
          {/* First soldier */}
          <circle cx="22" cy="32" r="4" fill={color} opacity="0.8" />
          <path d="M22 36 L22 48 M18 40 L26 40 M22 48 L18 54 M22 48 L26 54" stroke={color} strokeWidth="2" strokeLinecap="round" />
          {/* Yari (spear) */}
          <path d="M18 40 L16 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <path d="M15 10 L16 6 L17 10" fill={color} opacity="0.6" />
          {/* Second soldier */}
          <circle cx="38" cy="34" r="4" fill={color} opacity="0.7" />
          <path d="M38 38 L38 50 M34 42 L42 42 M38 50 L34 56 M38 50 L42 56" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          {/* Third soldier (background) */}
          <circle cx="50" cy="36" r="3.5" fill={color} opacity="0.5" />
          <path d="M50 39.5 L50 50 M47 43 L53 43" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          {/* Mon emblem */}
          <circle cx="50" cy="14" r="6" stroke={color} strokeWidth="1.5" fill="none" opacity="0.4" />
          <circle cx="50" cy="14" r="3" stroke={color} strokeWidth="1" fill="none" opacity="0.4" />
        </svg>
      );

    case 'harvest':
      // Rice paddy harvest scene
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          {/* Rice paddies - terraced */}
          <path d="M4 40 Q16 36 32 38 Q48 40 60 36" stroke={color} strokeWidth="1.5" fill="none" opacity="0.5" />
          <path d="M4 46 Q16 42 32 44 Q48 46 60 42" stroke={color} strokeWidth="1.5" fill="none" opacity="0.4" />
          <path d="M4 52 Q16 48 32 50 Q48 52 60 48" stroke={color} strokeWidth="1.5" fill="none" opacity="0.3" />
          {/* Rice stalks */}
          <path d="M20 38 L20 20 M18 22 L20 20 L22 22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M16 24 L20 20 L24 24" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
          <path d="M28 36 L28 18 M26 20 L28 18 L30 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M24 22 L28 18 L32 22" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
          {/* Farmer figure */}
          <circle cx="42" cy="26" r="4" fill={color} opacity="0.8" />
          <path d="M42 30 L42 42 M38 34 L46 34 M42 42 L38 50 M42 42 L46 50" stroke={color} strokeWidth="2" strokeLinecap="round" />
          {/* Kasa (hat) */}
          <path d="M36 24 Q42 20 48 24" stroke={color} strokeWidth="2" strokeLinecap="round" />
          {/* Sickle */}
          <path d="M46 34 L52 30 Q54 28 52 26" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          {/* Sun */}
          <circle cx="10" cy="12" r="5" fill={color} opacity="0.3" />
          <path d="M10 5 L10 3 M10 19 L10 21 M3 12 L1 12 M17 12 L19 12 M5 7 L3.5 5.5 M15 17 L16.5 18.5 M5 17 L3.5 18.5 M15 7 L16.5 5.5" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.3" />
        </svg>
      );

    case 'marshal':
      // Army on march - war banners and movement
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          {/* Path/road */}
          <path d="M8 54 Q20 48 32 50 Q44 52 56 46" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          {/* Horse and rider */}
          <ellipse cx="34" cy="38" rx="10" ry="6" fill={color} opacity="0.4" />
          <path d="M28 38 L26 48 M30 38 L28 48 M38 38 L40 48 M40 38 L42 48" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          {/* Rider */}
          <circle cx="34" cy="26" r="4" fill={color} opacity="0.8" />
          <path d="M34 30 L34 36" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          {/* Horse head */}
          <path d="M24 36 L20 32 L22 28" stroke={color} strokeWidth="2" strokeLinecap="round" />
          {/* War banner */}
          <path d="M40 36 L40 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <rect x="41" y="10" width="10" height="14" rx="1" fill={color} opacity="0.5" />
          <path d="M43 14 L49 17 L43 20" stroke="white" strokeWidth="1" fill="none" opacity="0.5" />
          {/* Movement arrows */}
          <path d="M8 28 L16 28 L14 26 M16 28 L14 30" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <path d="M8 34 L14 34 L12 32 M14 34 L12 36" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          {/* Dust clouds */}
          <circle cx="48" cy="46" r="3" fill={color} opacity="0.15" />
          <circle cx="52" cy="44" r="2" fill={color} opacity="0.1" />
        </svg>
      );

    case 'betray':
      // Ninja/betrayal - dagger and shadow
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          {/* Dark shadow figure */}
          <path d="M24 16 Q28 12 32 16 Q36 12 40 16 L40 24 Q36 28 32 24 Q28 28 24 24 Z" fill={color} opacity="0.3" />
          {/* Hooded figure */}
          <path d="M28 20 Q32 14 36 20 L36 28 Q32 32 28 28 Z" fill={color} opacity="0.7" />
          {/* Eyes only visible */}
          <ellipse cx="30" cy="24" rx="1.5" ry="1" fill="white" opacity="0.9" />
          <ellipse cx="34" cy="24" rx="1.5" ry="1" fill="white" opacity="0.9" />
          {/* Body crouched */}
          <path d="M32 32 L32 42 M28 36 L36 36" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M32 42 L26 50 M32 42 L38 50" stroke={color} strokeWidth="2" strokeLinecap="round" />
          {/* Tanto (dagger) */}
          <path d="M36 36 L48 28 L50 26" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M48 28 L52 26 L50 30" fill={color} opacity="0.8" />
          {/* Blood drops */}
          <circle cx="52" cy="32" r="1.5" fill={color} opacity="0.6" />
          <circle cx="54" cy="36" r="1" fill={color} opacity="0.4" />
          {/* Shuriken */}
          <path d="M12 38 L16 36 L14 40 L18 38 L14 42 L12 38" fill={color} opacity="0.5" />
          {/* Smoke/shadow effects */}
          <path d="M8 48 Q16 44 24 48 Q16 52 8 48" fill={color} opacity="0.15" />
          <path d="M40 50 Q48 46 56 50 Q48 54 40 50" fill={color} opacity="0.1" />
        </svg>
      );
  }
}

/**
 * PoliticsTrack - Shows the flow of a season:
 * Tea Ceremony -> 3 mandate slots -> Kami turn -> 2 mandate slots -> Kami turn -> 2 mandate slots -> War
 * Mandate slots fill left-to-right as players choose mandates.
 * Each mandate tile has a feudal Japanese illustration style.
 */
export const PoliticsTrack = () => {
  const { gameState, showTrainModal, setShowTrainModal, monsterPlacementPopupVisible, monsterPlacementMode, komainuChoiceVisible } = useGameStore();
  const [showSeasonCards, setShowSeasonCards] = useState(false);

  // Auto-open the season cards modal when trainMandateActive becomes true
  useEffect(() => {
    if (gameState?.trainMandateActive) {
      setShowSeasonCards(true);
    } else {
      // Auto-close when train mandate completes
      setShowSeasonCards(false);
    }
  }, [gameState?.trainMandateActive]);

  // Close the modal when monster placement is active
  useEffect(() => {
    if (monsterPlacementPopupVisible || monsterPlacementMode || komainuChoiceVisible) {
      setShowSeasonCards(false);
    }
  }, [monsterPlacementPopupVisible, monsterPlacementMode, komainuChoiceVisible]);

  // Also open when triggered from outside (e.g. ActionPanel button)
  useEffect(() => {
    if (showTrainModal) {
      setShowSeasonCards(true);
      setShowTrainModal(false);
    }
  }, [showTrainModal, setShowTrainModal]);

  if (!gameState) return null;

  const mandates = gameState.mandatesThisTurn;
  const mandateCount = gameState.politicsMandateCount;

  // Count how many times each mandate type has been played this season
  const mandateCounts: Record<MandateType, number> = {
    recruit: 0,
    marshal: 0,
    train: 0,
    harvest: 0,
    betray: 0,
  };
  for (const m of mandates) {
    mandateCounts[m.type]++;
  }

  // Exhausted mandates (played 2 times already)
  const exhaustedMandates = (Object.keys(mandateCounts) as MandateType[]).filter(
    (t) => mandateCounts[t] >= 2
  );

  const renderSlot = (slotIndex: number) => {
    const mandate = slotIndex < mandates.length ? mandates[slotIndex] : null;
    const isCurrent = slotIndex === mandateCount && gameState.currentPhase === 'politics';

    if (mandate) {
      const player = gameState.players.find(p => p.id === mandate.issuer);
      const clan = player ? CLANS.find(c => c.id === player.clanId) : null;
      const clanColor = clan?.color || '#888';
      const playerName = player?.name;

      // Loto clan power: mandate tile is face down (hidden from other players)
      if (mandate.hidden) {
        return (
          <div
            key={`slot-${slotIndex}`}
            className="politics-track-slot filled hidden-mandate"
            style={{
              borderColor: '#4a3a6a',
              backgroundColor: 'rgba(30, 20, 50, 0.85)',
            }}
            title={`Mandato secreto - ${clan?.name || 'Loto'}`}
          >
            <div className="slot-illustration hidden-illustration">
              <svg width={40} height={40} viewBox="0 0 64 64" fill="none">
                <rect x="8" y="8" width="48" height="48" rx="6" fill="#1a1030" opacity="0.9" />
                <text x="32" y="42" textAnchor="middle" fontSize="28" fill="#9b7fcf" opacity="0.9" fontFamily="serif">秘</text>
              </svg>
            </div>
            <span className="slot-mandate-label" style={{ color: '#9b7fcf' }}>
              Secreto
            </span>
            {playerName && (
              <span className="slot-player-name" style={{ color: clanColor }}>
                {playerName}
              </span>
            )}
            <span className="slot-clan-dot" style={{ backgroundColor: clanColor }} />
          </div>
        );
      }

      return (
        <div
          key={`slot-${slotIndex}`}
          className="politics-track-slot filled"
          style={{
            borderColor: MANDATE_COLORS[mandate.type],
            backgroundColor: MANDATE_BG_COLORS[mandate.type],
          }}
          title={`${MANDATE_LABELS[mandate.type]} - ${clan?.name || 'Unknown'}`}
        >
          <div className="slot-illustration">
            <MandateIllustration type={mandate.type} size={40} />
          </div>
          <span className="slot-mandate-label" style={{ color: MANDATE_COLORS[mandate.type] }}>
            {MANDATE_LABELS[mandate.type]}
          </span>
          {playerName && (
            <span className="slot-player-name" style={{ color: clanColor }}>
              {playerName}
            </span>
          )}
          <span className="slot-clan-dot" style={{ backgroundColor: clanColor }} />
        </div>
      );
    }

    return (
      <div
        key={`slot-${slotIndex}`}
        className={`politics-track-slot empty${isCurrent ? ' current' : ''}`}
      >
        <span className="slot-number">{slotIndex + 1}</span>
      </div>
    );
  };

  const renderKamiIcon = (key: string) => (
    <div key={key} className="politics-track-kami" title="Kami Turn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2L14.5 8.5L21 9.5L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9.5L9.5 8.5L12 2Z"
          fill="var(--accent-gold)"
          opacity="0.9"
        />
      </svg>
    </div>
  );

  return (
    <div className="politics-track">
      {/* Tea Ceremony icon */}
      <div className="politics-track-phase-icon tea" title="Tea Ceremony">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12h14a2 2 0 01-2 6H7a2 2 0 01-2-6zm1-2c0-3 2-5 6-5s6 2 6 5"
            stroke="var(--accent-cream)"
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M8 8c0-1 1-2.5 4-2.5s4 1.5 4 2.5" stroke="var(--accent-cream)" strokeWidth="1" opacity="0.5" />
          <path d="M10 5V3M12 5V2M14 5V3" stroke="var(--accent-cream)" strokeWidth="1" opacity="0.6" strokeLinecap="round" />
        </svg>
      </div>

      {/* First 3 mandate slots */}
      {renderSlot(0)}
      {renderSlot(1)}
      {renderSlot(2)}

      {/* Kami turn */}
      {renderKamiIcon('kami-1')}

      {/* Next 2 mandate slots */}
      {renderSlot(3)}
      {renderSlot(4)}

      {/* Kami turn */}
      {renderKamiIcon('kami-2')}

      {/* Last 2 mandate slots */}
      {renderSlot(5)}
      {renderSlot(6)}

      {/* War phase icon */}
      <div className="politics-track-phase-icon war" title="War Phase">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 3l6 4 6-4v14l-6 4-6-4V3z"
            stroke="var(--accent-red)"
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M12 7v10" stroke="var(--accent-red)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M9 9l3 2 3-2" stroke="var(--accent-red)" strokeWidth="1" opacity="0.7" />
        </svg>
      </div>

      {/* Exhausted mandates indicator */}
      {exhaustedMandates.length > 0 && (
        <div className="politics-track-exhausted">
          {exhaustedMandates.map((t) => (
            <span
              key={t}
              className="exhausted-mandate"
              style={{ color: MANDATE_COLORS[t], borderColor: MANDATE_COLORS[t] }}
              title={`${MANDATE_LABELS[t]} - agotada (jugada 2 veces)`}
            >
              <MandateIllustration type={t} size={16} />
              <span className="exhausted-x">&times;</span>
            </span>
          ))}
        </div>
      )}

      {/* Season Cards Button */}
      <button
        className="season-cards-btn"
        onClick={() => setShowSeasonCards(true)}
        title="Cartas de Estacion"
      >
        <span className="season-cards-btn-kanji">旭</span>
        <span className="season-cards-btn-text">Cartas</span>
      </button>

      {/* Season Cards Modal */}
      <SeasonCardsModal open={showSeasonCards} onClose={() => setShowSeasonCards(false)} />
    </div>
  );
};
