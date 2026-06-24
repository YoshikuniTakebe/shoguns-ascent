export type Season = 'spring' | 'summer' | 'autumn';
export type Phase = 'tea' | 'politics' | 'war' | 'cleanup';
export type MandateType = 'recruit' | 'march' | 'train' | 'harvest' | 'betray';

export interface Region {
  id: string; name: string; reward: number; adjacentRegions: string[];
  forces: { [clanId: string]: number }; ronin: number; monsters: string[]; hasShrine: boolean;
}

export interface Clan { id: string; name: string; color: string; ability: string; abilityDescription: string; }

export interface Player {
  id: string; name: string; clanId: string; coins: number; honor: number;
  victoryPoints: number; reserveForces: number; seasonCards: string[];
  monsters: string[]; warPoems: string[]; allies: string[]; isReady: boolean;
}

export interface Mandate { type: MandateType; issuer: string; executed: boolean; }

export interface Battle {
  regionId: string; participants: string[]; bids: { [playerId: string]: number };
  seppukuDecisions: { [playerId: string]: boolean };
  imperialPoetDecisions: { [playerId: string]: boolean };
  resolved: boolean; winner?: string;
}

export interface SeasonCard { id: string; name: string; season: Season; effect: string; cost: number; }
export interface Monster { id: string; name: string; power: string; combatBonus: number; force: number; }
export interface WarPoem { id: string; name: string; victoryPoints: number; condition: string; }

export interface GameState {
  id: string; mode: 'online' | 'hotseat'; players: Player[];
  regions: { [regionId: string]: Region }; currentSeason: Season; currentPhase: Phase;
  currentPlayerIndex: number; mandatesThisTurn: Mandate[]; mandatesDeck: MandateType[];
  drawnMandates: MandateType[]; mandateChoicePhase: boolean;
  activeBattles: Battle[]; seasonCards: SeasonCard[]; availableMonsters: Monster[];
  warPoems: WarPoem[]; turnOrder: string[];
  allianceProposals: { from: string; to: string; accepted?: boolean }[];
  politicsMandateCount: number; maxMandates: number; round: number; maxRounds: number;
  teaTurnIndex: number;
  gameOver: boolean; winner?: string; log: string[]; hostId?: string;
}

export const REGIONS_DATA: Omit<Region, 'forces' | 'ronin' | 'monsters' | 'hasShrine'>[] = [
  { id: 'hokkaido', name: 'Hokkaido', reward: 2, adjacentRegions: ['oshu'] },
  { id: 'oshu', name: 'Oshu', reward: 3, adjacentRegions: ['hokkaido', 'edo', 'kanto'] },
  { id: 'edo', name: 'Edo', reward: 4, adjacentRegions: ['oshu', 'kanto', 'kansai'] },
  { id: 'kanto', name: 'Kanto', reward: 3, adjacentRegions: ['oshu', 'edo', 'kansai'] },
  { id: 'kansai', name: 'Kansai', reward: 3, adjacentRegions: ['edo', 'kanto', 'nagato', 'shikoku'] },
  { id: 'nagato', name: 'Nagato', reward: 2, adjacentRegions: ['kansai', 'kyushu', 'shikoku'] },
  { id: 'shikoku', name: 'Shikoku', reward: 2, adjacentRegions: ['kansai', 'nagato', 'kyushu'] },
  { id: 'kyushu', name: 'Kyushu', reward: 3, adjacentRegions: ['nagato', 'shikoku'] },
];

export const CLANS: Clan[] = [
  { id: 'koi', name: 'Koi Clan', color: '#2E86AB', ability: 'Migratory Current', abilityDescription: 'Can move forces to non-adjacent regions (up to 2 hops away). Superior mobility.' },
  { id: 'dragonfly', name: 'Dragonfly Clan', color: '#C4A747', ability: 'Wings of Honor', abilityDescription: 'Gains +1 VP when scoring if honor is highest among all players. Starts with higher honor.' },
  { id: 'bonsai', name: 'Bonsai Clan', color: '#1E8449', ability: 'Steady Growth', abilityDescription: 'Recruits 1 extra force with each Recruit mandate. Starts with +2 reserve forces.' },
  { id: 'fox', name: 'Fox Clan', color: '#6B4C9A', ability: 'Shadow Step', abilityDescription: 'May move forces through enemy-occupied regions. Deception and surprise.' },
  { id: 'lotus', name: 'Lotus Clan', color: '#D4358C', ability: 'Political Mastery', abilityDescription: 'Draws 4 mandate tiles instead of 3 during politics phase. Superior political choice.' },
  { id: 'turtle', name: 'Turtle Clan', color: '#1A5276', ability: 'Iron Shell', abilityDescription: 'Loses 1 fewer force in battles when defending. Shrines provide +1 VP.' },
];

export const SEASON_CARDS: SeasonCard[] = [
  { id: 'sc-1', name: 'Cherry Blossom Wind', season: 'spring', effect: 'recruit_2', cost: 2 },
  { id: 'sc-2', name: 'Mountain Path', season: 'spring', effect: 'move_extra', cost: 1 },
  { id: 'sc-3', name: 'Peasant Levy', season: 'spring', effect: 'recruit_3', cost: 3 },
  { id: 'sc-4', name: 'Scout Network', season: 'spring', effect: 'reveal_bids', cost: 2 },
  { id: 'sc-5', name: 'Sakura Festival', season: 'spring', effect: 'gain_coins_2', cost: 0 },
  { id: 'sc-6', name: 'Typhoon Advance', season: 'summer', effect: 'force_retreat', cost: 3 },
  { id: 'sc-7', name: 'Samurai Training', season: 'summer', effect: 'combat_bonus_2', cost: 2 },
  { id: 'sc-8', name: 'War Drums', season: 'summer', effect: 'intimidate', cost: 2 },
  { id: 'sc-9', name: 'Iron Forge', season: 'summer', effect: 'recruit_elite', cost: 4 },
  { id: 'sc-10', name: 'Summer Heat', season: 'summer', effect: 'weaken_enemy', cost: 2 },
  { id: 'sc-11', name: 'Harvest Moon', season: 'autumn', effect: 'gain_coins_3', cost: 0 },
  { id: 'sc-12', name: 'Autumn Ambush', season: 'autumn', effect: 'surprise_attack', cost: 3 },
  { id: 'sc-13', name: 'Fallen Leaves', season: 'autumn', effect: 'honor_gain', cost: 1 },
  { id: 'sc-14', name: 'Last Stand', season: 'autumn', effect: 'defense_bonus_3', cost: 2 },
  { id: 'sc-15', name: 'Winter Preparation', season: 'autumn', effect: 'gain_vp_2', cost: 4 },
];

export const MONSTERS: Monster[] = [
  { id: 'oni-1', name: 'Komainu Guardian', power: 'Blocks enemy movement into region', combatBonus: 1, force: 2 },
  { id: 'oni-2', name: 'Oni War Chief', power: '+2 combat strength', combatBonus: 2, force: 3 },
  { id: 'oni-3', name: 'Kitsune Trickster', power: 'Steal 1 coin from battle loser', combatBonus: 0, force: 1 },
  { id: 'oni-4', name: 'Tengu Warrior', power: 'Flies over regions (ignore adjacency)', combatBonus: 1, force: 2 },
  { id: 'oni-5', name: 'River Dragon', power: 'Controls river regions, +1 VP per river', combatBonus: 2, force: 3 },
  { id: 'oni-6', name: 'Yuki-Onna', power: 'Freezes 1 enemy force (cannot fight)', combatBonus: 0, force: 1 },
];

export const WAR_POEMS: WarPoem[] = [
  { id: 'wp-1', name: 'Verse of Dominance', victoryPoints: 3, condition: 'Control 4+ regions' },
  { id: 'wp-2', name: 'Poem of Honor', victoryPoints: 2, condition: 'Have highest honor' },
  { id: 'wp-3', name: 'Ode to Battle', victoryPoints: 2, condition: 'Win 3+ battles in a season' },
  { id: 'wp-4', name: 'Song of Alliance', victoryPoints: 2, condition: 'Have 2+ active alliances' },
  { id: 'wp-5', name: 'Hymn of Wealth', victoryPoints: 2, condition: 'Have 8+ coins at end' },
  { id: 'wp-6', name: 'Ballad of the Monster', victoryPoints: 3, condition: 'Control 3+ monsters' },
  { id: 'wp-7', name: 'Chronicle of War', victoryPoints: 4, condition: 'Win battles in 5+ different regions' },
  { id: 'wp-8', name: 'Saga of Conquest', victoryPoints: 5, condition: 'Control all regions of one coast' },
];
