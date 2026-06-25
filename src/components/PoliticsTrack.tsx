import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';
import type { MandateType } from '../types/game';

const MANDATE_LABELS: Record<MandateType, string> = {
  recruit: 'Recruit',
  marshal: 'Marshal',
  train: 'Train',
  harvest: 'Harvest',
  betray: 'Betray',
};

const MANDATE_COLORS: Record<MandateType, string> = {
  recruit: '#27ae60',
  marshal: '#3498db',
  train: '#9b59b6',
  harvest: '#f39c12',
  betray: '#e74c3c',
};

/**
 * PoliticsTrack - Shows the flow of a season:
 * Tea Ceremony -> 3 mandate slots -> Kami turn -> 2 mandate slots -> Kami turn -> 2 mandate slots -> War
 * Mandate slots fill left-to-right as players choose mandates.
 * Mandates played 2 times are shown as exhausted.
 */
export const PoliticsTrack = () => {
  const { gameState } = useGameStore();
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

  // Build the track structure: 7 mandate slots with kami turns at positions 3 and 5
  // Slot indices: 0,1,2 (first group), then kami, 3,4 (second group), then kami, 5,6 (third group)
  const renderSlot = (slotIndex: number) => {
    const mandate = slotIndex < mandates.length ? mandates[slotIndex] : null;
    const isCurrent = slotIndex === mandateCount && gameState.currentPhase === 'politics';

    if (mandate) {
      const clan = CLANS.find((c) => c.id === mandate.issuer);
      const clanColor = clan?.color || '#888';
      return (
        <div
          key={`slot-${slotIndex}`}
          className="politics-track-slot filled"
          style={{ borderColor: clanColor, backgroundColor: `${clanColor}22` }}
          title={`${MANDATE_LABELS[mandate.type]} - ${clan?.name || 'Unknown'}`}
        >
          <span className="slot-mandate-icon" style={{ color: MANDATE_COLORS[mandate.type] }}>
            {getMandateIcon(mandate.type)}
          </span>
          <span className="slot-mandate-label" style={{ color: MANDATE_COLORS[mandate.type] }}>
            {MANDATE_LABELS[mandate.type]}
          </span>
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
              title={`${MANDATE_LABELS[t]} - exhausted (played 2 times)`}
            >
              {getMandateIcon(t)} <span className="exhausted-x">&times;</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

function getMandateIcon(type: MandateType): string {
  switch (type) {
    case 'recruit':
      return '\u2694'; // crossed swords
    case 'marshal':
      return '\u279A'; // arrow
    case 'train':
      return '\u2606'; // star
    case 'harvest':
      return '\u2618'; // shamrock/plant
    case 'betray':
      return '\u2620'; // skull
  }
}
