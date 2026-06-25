import { useGameStore } from '../store/gameStore';
import { CLANS } from '../types/game';

interface AlliancePair {
  player1ClanColor: string;
  player2ClanColor: string;
  player1ClanName: string;
  player2ClanName: string;
}

const YinYangSymbol = ({ color1, color2, size = 40 }: { color1: string; color2: string; size?: number }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    {/* Outer circle */}
    <circle cx="50" cy="50" r="48" fill={color1} stroke="rgba(200,169,81,0.6)" strokeWidth="2" />
    {/* Right half */}
    <path d="M50,2 A48,48 0 0,1 50,98 A24,24 0 0,1 50,50 A24,24 0 0,0 50,2" fill={color2} />
    {/* Small circles */}
    <circle cx="50" cy="26" r="7" fill={color1} />
    <circle cx="50" cy="74" r="7" fill={color2} />
  </svg>
);

export const AllianceDisplay = () => {
  const { gameState } = useGameStore();
  if (!gameState) return null;

  // Collect unique alliance pairs
  const seenPairs = new Set<string>();
  const alliancePairs: AlliancePair[] = [];

  for (const player of gameState.players) {
    if (player.allies.length > 0) {
      for (const allyId of player.allies) {
        const pairKey = [player.id, allyId].sort().join('-');
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          const ally = gameState.players.find(p => p.id === allyId);
          if (ally) {
            const clan1 = CLANS.find(c => c.id === player.clanId);
            const clan2 = CLANS.find(c => c.id === ally.clanId);
            if (clan1 && clan2) {
              alliancePairs.push({
                player1ClanColor: clan1.color,
                player2ClanColor: clan2.color,
                player1ClanName: clan1.name,
                player2ClanName: clan2.name,
              });
            }
          }
        }
      }
    }
  }

  if (alliancePairs.length === 0) return null;

  return (
    <div className="alliance-display">
      <div className="alliance-display-title">
        <span>Alliances</span>
      </div>
      <div className="alliance-display-symbols">
        {alliancePairs.map((pair, idx) => (
          <div key={idx} className="alliance-pair">
            <YinYangSymbol color1={pair.player1ClanColor} color2={pair.player2ClanColor} size={36} />
            <div className="alliance-pair-names">
              <span style={{ color: pair.player1ClanColor }}>{pair.player1ClanName}</span>
              <span className="alliance-separator">&amp;</span>
              <span style={{ color: pair.player2ClanColor }}>{pair.player2ClanName}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
