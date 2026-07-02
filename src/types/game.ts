// ============================================================
// Shogun's Ascent - Complete Game Data Model
// Based on the real board game rules
// ============================================================

// --- Core Type Definitions ---

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type Phase = 'seasonSetup' | 'tea' | 'politics' | 'war' | 'cleanup' | 'winter';

export type MandateType = 'recruit' | 'marshal' | 'train' | 'harvest' | 'betray';

export type FigureType = 'daimyo' | 'bushi' | 'shinto' | 'fortress' | 'monster' | 'kami';

export type KamiType = 'amaterasu' | 'fujin' | 'hachiman' | 'raijin' | 'ryujin' | 'susanoo' | 'tsukuyomi';

export type CardType = 'virtue' | 'monster' | 'upgrade' | 'warUpgrade' | 'winterUpgrade';

export interface Clan {
  id: string;
  name: string;
  color: string;
  initialHonor: number;
}

export interface Figure {
  type: FigureType;
  owner: string;
  id: string;
  monsterCardId?: string;
}

export interface Province {
  id: string;
  name: string;
  adjacentProvinces: string[];
  seaRoutes: string[];
  harvestRewards: { vp?: number; coins?: number; ronin?: number; honor?: number };
}

export interface Temple {
  id: string;
  position: number;
  kamiType: KamiType;
  figures: { playerId: string; figureId: string }[];
}

export interface KamiData {
  type: KamiType;
  name: string;
  effect: string;
}

export interface WarProvinceToken {
  season: Season;
  provinceId: string;
}

export interface WarTactic {
  id: string;
  name: string;
  order: number;
}

export interface Hostage {
  fromClanId: string;
  figureType: string;
}

export interface Player {
  id: string;
  name: string;
  clanId: string;
  coins: number;
  ronin: number;
  honor: number;
  victoryPoints: number;
  bushi: number;
  shinto: number;
  hasDaimyo: boolean;
  fortresses: number;
  monsters: number;
  seasonCards: SeasonCard[];
  warProvinceTokens: WarProvinceToken[];
  allies: string[];
  hostages: Hostage[];
  isReady: boolean;
  allianceSeasons: number;
}

export interface SeasonCard {
  id: string;
  name: string;
  cost: number;
  season: Season;
  group: string;
  cardType: CardType;
  effect: string;
  force?: number;
}

export interface Mandate {
  type: MandateType;
  issuer: string;
  executed: boolean;
  hidden?: boolean;
}

export interface Battle {
  provinceId: string;
  participants: string[];
  warTacticBids: { [playerId: string]: { [tacticId: string]: number } };
  resolved: boolean;
  winner?: string;
  uncontested?: boolean;
  logStartIndex?: number;
  killedFigures?: { owner: string; figureType: string; count: number }[];
}

export interface AllianceProposal {
  from: string;
  to: string;
  accepted?: boolean;
  bribeAmount?: number;
  requestAmount?: number;
}

export interface WarProvinceSlot {
  provinceId: string;
  number: number;
  season: Season;
}

// --- Deck Configuration ---

export type DeckName = 'Archway' | 'Tower' | 'Teapot' | 'Horseman' | 'Ship' | 'Mountain';

export const DECK_GROUPS: DeckName[] = ['Archway', 'Tower', 'Teapot', 'Horseman', 'Ship', 'Mountain'];

export interface DeckConfig {
  chosenDeck: DeckName | 'random';
  extraMonsters: 0 | 1 | 2;
  selectedKami?: KamiType[];
}

export interface KamiResolutionTemple {
  templeIndex: number;
  kamiType: KamiType;
  winnerId: string | null;
  reward: string;
  forces: { playerId: string; count: number }[];
  susanooVPGained?: number;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offerCoins: number;
  offerRonin: number;
  requestCoins: number;
  requestRonin: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface GameState {
  id: string;
  mode: 'online' | 'hotseat';
  players: Player[];
  provinces: { [provinceId: string]: Province & { figures: Figure[] } };
  temples: Temple[];
  currentSeason: Season;
  currentPhase: Phase;
  currentPlayerIndex: number;
  mandatesThisTurn: Mandate[];
  mandatesDeck: MandateType[];
  drawnMandates: MandateType[];
  mandateChoicePhase: boolean;
  activeBattles: Battle[];
  seasonCardsDeck: SeasonCard[];
  springDeck: SeasonCard[];
  summerDeck: SeasonCard[];
  autumnDeck: SeasonCard[];
  activeDeckGroup: DeckName | null;
  turnOrder: string[];
  allianceProposals: AllianceProposal[];
  politicsMandateCount: number;
  maxMandates: number;
  round: number;
  maxRounds: number;
  teaTurnIndex: number;
  honorTrack: string[];
  warProvinceSlots: WarProvinceSlot[];
  trainMandateActive: boolean;
  trainResolutionOrder: string[];
  trainResolutionIndex: number;
  trainMandateIssuerId: string | null;
  marshalMandateActive: boolean;
  marshalResolutionOrder: string[];
  marshalResolutionIndex: number;
  marshalMandateIssuerId: string | null;
  marshalFortressBuiltBy: string[];
  marshalMovedFigures: string[];
  recruitMandateActive: boolean;
  recruitResolutionOrder: string[];
  recruitResolutionIndex: number;
  recruitMandateIssuerId: string | null;
  recruitPlacementsRemaining: number;
  recruitUsedFortressProvinces: string[];
  betrayMandateActive: boolean;
  betraySelectionsRemaining: number;
  betraySelectedOwners: string[];
  betrayMandateIssuerId: string | null;
  harvestMandateActive: boolean;
  harvestResolutionOrder: string[];
  harvestResolutionIndex: number;
  harvestPlayerRewards: { playerId: string; provinceId: string; rewards: { vp?: number; coins?: number; ronin?: number; honor?: number } }[];
  harvestPopupVisible: boolean;
  kamiResolutionActive: boolean;
  kamiResolutionTemples: KamiResolutionTemple[];
  kamiResolutionIndex: number;
  kamiResolutionStep: 'showing' | 'interactive' | null;
  kamiResolutionNextPlayerIndex: number;
  fujinMovesRemaining: number;
  raijinPlacementActive: boolean;
  raijinPlacementDone?: boolean;
  ryujinBuyActive: boolean;
  zorroPlacementActive: boolean;
  zorroPlacementPlayerId: string | null;
  zorroPlacementsRemaining: number;
  lotoChoicePhase?: boolean;
  lotoDiscardedMandate?: MandateType | null;
  lastMandateIssuerId: string | null;
  kamiPhasePopupPending?: boolean;
  gameOver: boolean;
  winner?: string;
  tradeOffers: TradeOffer[];
  coinDistributionPending?: {
    battleProvinceId: string;
    winnerId: string;
    losers: string[];
    remainder: number;
    distributed: number;
    sharePerLoser: number;
  } | null;
  log: string[];
  logHistory: { [season: string]: string[] };
  hostId?: string;
}

// ============================================================
// Constants
// ============================================================

// --- Clans (in honor order, lowest to highest) ---

export const CLANS: Clan[] = [
  { id: 'koi', name: 'Koi', color: '#E63946', initialHonor: 1 },
  { id: 'sol', name: 'Sol', color: '#DAA520', initialHonor: 2 },
  { id: 'loto', name: 'Loto', color: '#8B5CF6', initialHonor: 3 },
  { id: 'tortuga', name: 'Tortuga', color: '#2D8B4E', initialHonor: 4 },
  { id: 'libelula', name: 'Libelula', color: '#5BC0EB', initialHonor: 5 },
  { id: 'zorro', name: 'Zorro', color: '#F57C20', initialHonor: 6 },
  { id: 'bonsai', name: 'Bonsai', color: '#F5D020', initialHonor: 7 },
  { id: 'luna', name: 'Luna', color: '#B0BEC5', initialHonor: 8 },
];

// --- Provinces ---

export const PROVINCES_DATA: Province[] = [
  { id: 'hokkaido', name: 'Hokkaido', adjacentProvinces: [], seaRoutes: ['oshu', 'kansai', 'kyushu'], harvestRewards: { ronin: 2 } },
  { id: 'oshu', name: 'Oshu', adjacentProvinces: ['edo', 'kanto'], seaRoutes: ['hokkaido'], harvestRewards: { coins: 3 } },
  { id: 'edo', name: 'Edo', adjacentProvinces: ['oshu', 'kanto', 'kansai'], seaRoutes: [], harvestRewards: { vp: 4 } },
  { id: 'kanto', name: 'Kanto', adjacentProvinces: ['oshu', 'edo'], seaRoutes: [], harvestRewards: { vp: 2, coins: 2 } },
  { id: 'kansai', name: 'Kansai', adjacentProvinces: ['edo', 'nagato'], seaRoutes: ['hokkaido', 'kyushu', 'shikoku'], harvestRewards: { vp: 3 } },
  { id: 'nagato', name: 'Nagato', adjacentProvinces: ['kansai'], seaRoutes: [], harvestRewards: { vp: 1, coins: 1, ronin: 1 } },
  { id: 'shikoku', name: 'Shikoku', adjacentProvinces: [], seaRoutes: ['kansai', 'kyushu'], harvestRewards: { coins: 3 } },
  { id: 'kyushu', name: 'Kyushu', adjacentProvinces: [], seaRoutes: ['shikoku', 'kansai', 'hokkaido'], harvestRewards: { vp: 1, coins: 1, ronin: 1 } },
];

// --- Home Provinces (one per clan, in clan order) ---

export const HOME_PROVINCES: { [clanId: string]: string } = {
  koi: 'kanto',
  sol: 'shikoku',
  loto: 'nagato',
  tortuga: 'edo',
  libelula: 'hokkaido',
  zorro: 'kansai',
  bonsai: 'kyushu',
  luna: 'oshu',
};

// --- Clan Income (fixed per-clan income each season) ---

export const CLAN_INCOME: { [clanId: string]: number } = {
  koi: 5,
  sol: 7,
  loto: 7,
  tortuga: 6,
  libelula: 6,
  zorro: 5,
  bonsai: 4,
  luna: 4,
};

// --- War Tactics (resolved left to right, order 1-4) ---

export const WAR_TACTICS: WarTactic[] = [
  { id: 'seppuku', name: 'Seppuku', order: 1 },
  { id: 'take-hostage', name: 'Take Hostage', order: 2 },
  { id: 'hire-ronin', name: 'Hire Ronin', order: 3 },
  { id: 'imperial-poets', name: 'Imperial Poets', order: 4 },
];

// --- Kami Data (Base Game) ---

export const KAMI_DATA: KamiData[] = [
  { type: 'amaterasu', name: 'Amaterasu', effect: 'Allows worshiper to move clan marker to top of Honor Track.' },
  { type: 'fujin', name: 'Fujin', effect: 'Allows worshiper to perform up to 2 Movements with their figures.' },
  { type: 'hachiman', name: 'Hachiman', effect: 'Grants worshiper 2 Ronin tokens.' },
  { type: 'raijin', name: 'Raijin', effect: 'Allows worshiper to Summon 1 Bushi to any Province.' },
  { type: 'ryujin', name: 'Ryujin', effect: 'Allows worshiper to acquire a Season Card paying full cost.' },
  { type: 'susanoo', name: 'Susanoo', effect: 'Grants worshiper VP equal to their number of Fortresses on the Map.' },
  { type: 'tsukuyomi', name: 'Tsukuyomi', effect: 'Grants worshiper 2 Coins.' },
];

// --- Kami Data (Expansion) ---

export const KAMI_DATA_EXPANSION: KamiData[] = [
  { type: 'amaterasu', name: 'Amaterasu', effect: 'Figures of highest-honor player in this Province cannot be killed by others.' },
  { type: 'fujin', name: 'Fujin', effect: 'Double Harvest reward here. War winner also gets Harvest reward.' },
  { type: 'hachiman', name: 'Hachiman', effect: 'Ronin count as Force 2 each in this Province.' },
  { type: 'raijin', name: 'Raijin', effect: 'Only Bushi and Kami count Force in this Province.' },
  { type: 'ryujin', name: 'Ryujin', effect: 'Force 1 per different season card type owned by controller.' },
  { type: 'susanoo', name: 'Susanoo', effect: 'Non-Kami figures cannot Move out of this Province.' },
  { type: 'tsukuyomi', name: 'Tsukuyomi', effect: 'Before war here, all players with Force gain 4 Coins.' },
];

// --- Season Cards ---

export const SPRING_CARDS: SeasonCard[] = [
  { id: 'sp-benevolence', name: 'Benevolence', cost: 1, season: 'spring', group: 'Archway', cardType: 'virtue', effect: 'When you spend Coins, you may give one to another player. If you do, gain Honor and 2 VP.' },
  { id: 'sp-benevolence-2', name: 'Benevolence', cost: 1, season: 'spring', group: 'Archway', cardType: 'virtue', effect: 'When you spend Coins, you may give one to another player. If you do, gain Honor and 2 VP.' },
  { id: 'sp-courage', name: 'Courage', cost: 3, season: 'spring', group: 'Horseman', cardType: 'virtue', effect: 'Gain 2 VP each time you win a War symbol.' },
  { id: 'sp-courage-2', name: 'Courage', cost: 3, season: 'spring', group: 'Horseman', cardType: 'virtue', effect: 'Gain 2 VP each time you win a War symbol.' },
  { id: 'sp-daikokuten', name: 'Daikokuten', cost: 1, season: 'spring', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Force 8 during Harvest Mandate.', force: 1 },
  { id: 'sp-dignity', name: 'Dignity', cost: 1, season: 'spring', group: 'Ship', cardType: 'virtue', effect: 'Each time you Summon a Monster, gain 2 VP.' },
  { id: 'sp-dignity-2', name: 'Dignity', cost: 1, season: 'spring', group: 'Ship', cardType: 'virtue', effect: 'Each time you Summon a Monster, gain 2 VP.' },
  { id: 'sp-earth-dragon', name: 'Earth Dragon', cost: 3, season: 'spring', group: 'Monster Pack', cardType: 'monster', effect: 'At start of Battle, may Move 1 figure of each other player out of this Province.', force: 3 },
  { id: 'sp-fukurokuju', name: 'Fukurokuju', cost: 3, season: 'spring', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Counts as Daimyo and Fortress.' },
  { id: 'sp-generosity', name: 'Generosity', cost: 0, season: 'spring', group: 'Tower', cardType: 'virtue', effect: 'After you play a Mandate, may offer 1 Coin to any player. If accepted, gain Honor.' },
  { id: 'sp-generosity-2', name: 'Generosity', cost: 0, season: 'spring', group: 'Tower', cardType: 'virtue', effect: 'After you play a Mandate, may offer 1 Coin to any player. If accepted, gain Honor.' },
  { id: 'sp-honesty', name: 'Honesty', cost: 0, season: 'spring', group: 'Teapot', cardType: 'virtue', effect: 'While you have an ally, gain 2 VP each time you select a Mandate other than Betray.' },
  { id: 'sp-honesty-2', name: 'Honesty', cost: 0, season: 'spring', group: 'Teapot', cardType: 'virtue', effect: 'While you have an ally, gain 2 VP each time you select a Mandate other than Betray.' },
  { id: 'sp-jinmenju', name: 'Jinmenju', cost: 2, season: 'spring', group: 'Monster Pack', cardType: 'monster', effect: 'During Recruit Mandate, may summon a figure here and lose Honor.' },
  { id: 'sp-jorogumo', name: 'Jorogumo', cost: 3, season: 'spring', group: 'Monster Pack', cardType: 'monster', effect: 'At start of Battle, take control of 1 local Bushi or Shinto until end of Battle.' },
  { id: 'sp-jurojin', name: 'Jurojin', cost: 1, season: 'spring', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Counts as Virtue: Gain 3 Coins after acquiring another Virtue.' },
  { id: 'sp-komainu', name: 'Komainu', cost: 2, season: 'spring', group: 'Core', cardType: 'monster', effect: 'Counts as a Shinto.' },
  { id: 'sp-kotahi', name: 'Kotahi', cost: 1, season: 'spring', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'You gain the Harvest reward of this Province if you have the most force here, regardless of who played Harvest.' },
  { id: 'sp-oni-of-skulls', name: 'Oni of Skulls', cost: 2, season: 'spring', group: 'Core', cardType: 'monster', effect: 'Force 3 in any Province where you have lowest Honor.', force: 3 },
  { id: 'sp-oni-of-souls', name: 'Oni of Souls', cost: 2, season: 'spring', group: 'Tower', cardType: 'monster', effect: 'If you win a War symbol with this Monster, gain 2 VP per Oni you own.' },
  { id: 'sp-path-of-the-builder', name: 'Path of the Builder', cost: 0, season: 'spring', group: 'Mountain', cardType: 'upgrade', effect: 'When any player uses Marshal Mandate, you may build a Fortress (paying cost).' },
  { id: 'sp-path-of-the-kannushi', name: 'Path of the Kannushi', cost: 2, season: 'spring', group: 'Mountain', cardType: 'upgrade', effect: 'During Marshal, may move 1 of your Shinto to a different Shrine.' },
  { id: 'sp-path-of-the-kannushi-2', name: 'Path of the Kannushi', cost: 2, season: 'spring', group: 'Mountain', cardType: 'upgrade', effect: 'During Marshal, may move 1 of your Shinto to a different Shrine.' },
  { id: 'sp-path-of-the-kenin', name: 'Path of the Kenin', cost: 2, season: 'spring', group: 'Archway', cardType: 'upgrade', effect: 'Bushi Upgrade - After you Summon, may place an extra Bushi at any Fortress.' },
  { id: 'sp-path-of-the-kenin-2', name: 'Path of the Kenin', cost: 2, season: 'spring', group: 'Archway', cardType: 'upgrade', effect: 'Bushi Upgrade - After you Summon, may place an extra Bushi at any Fortress.' },
  { id: 'sp-path-of-the-light', name: 'Path of the Light', cost: 1, season: 'spring', group: 'Archway', cardType: 'upgrade', effect: 'Shinto Upgrade - End of Recruit, may place an extra Shinto at a Shrine.' },
  { id: 'sp-path-of-the-lion', name: 'Path of the Lion', cost: 0, season: 'spring', group: 'Core', cardType: 'upgrade', effect: 'Daimyo Upgrade - Your Daimyo has Force +1.' },
  { id: 'sp-path-of-the-ninja', name: 'Path of the Ninja', cost: 2, season: 'spring', group: 'Horseman', cardType: 'upgrade', effect: 'Dishonorable Upgrade - After you Summon, may kill 1 any Bushi on Map and lose Honor.' },
  { id: 'sp-path-of-the-pacifist', name: 'Path of the Pacifist', cost: 1, season: 'spring', group: 'Ship', cardType: 'upgrade', effect: 'At start of Summer and Autumn, gain 4 VP if you dont have the most War symbols.' },
  { id: 'sp-path-of-the-patron', name: 'Path of the Patron', cost: 2, season: 'spring', group: 'Teapot', cardType: 'upgrade', effect: 'After you Summon, gain 2 Coins if you have higher Honor than at least 2 players.' },
  { id: 'sp-path-of-the-salamander', name: 'Path of the Salamander', cost: 1, season: 'spring', group: 'Ship', cardType: 'upgrade', effect: 'At start of Summer and Autumn, gain 3 Coins and lose Honor.' },
  { id: 'sp-path-of-the-salamander-2', name: 'Path of the Salamander', cost: 1, season: 'spring', group: 'Ship', cardType: 'upgrade', effect: 'At start of Summer and Autumn, gain 3 Coins and lose Honor.' },
  { id: 'sp-path-of-the-vassal', name: 'Path of the Vassal', cost: 0, season: 'spring', group: 'Tower', cardType: 'upgrade', effect: 'After using Kami Shrine ability, may pay 2 Coins to gain 2 VP.' },
  { id: 'sp-path-of-the-vassal-2', name: 'Path of the Vassal', cost: 0, season: 'spring', group: 'Tower', cardType: 'upgrade', effect: 'After using Kami Shrine ability, may pay 2 Coins to gain 2 VP.' },
  { id: 'sp-path-of-the-warlord', name: 'Path of the Warlord', cost: 1, season: 'spring', group: 'Teapot', cardType: 'upgrade', effect: 'After you Summon, gain 1 Coin.' },
  { id: 'sp-path-of-the-warlord-2', name: 'Path of the Warlord', cost: 1, season: 'spring', group: 'Teapot', cardType: 'upgrade', effect: 'After you Summon, gain 1 Coin.' },
  { id: 'sp-phoenix', name: 'Phoenix', cost: 1, season: 'spring', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'If killed, gain 1 VP and return to same Province immediately.' },
  { id: 'sp-piety', name: 'Piety', cost: 1, season: 'spring', group: 'Mountain', cardType: 'virtue', effect: 'If you win a War symbol with a Shinto, gain Honor and 3 VP.' },
  { id: 'sp-piety-2', name: 'Piety', cost: 1, season: 'spring', group: 'Mountain', cardType: 'virtue', effect: 'If you win a War symbol with a Shinto, gain Honor and 3 VP.' },
  { id: 'sp-righteousness', name: 'Righteousness', cost: 2, season: 'spring', group: 'Core', cardType: 'virtue', effect: 'For each of your figures killed, gain 1 VP.' },
  { id: 'sp-righteousness-2', name: 'Righteousness', cost: 2, season: 'spring', group: 'Core', cardType: 'virtue', effect: 'For each of your figures killed, gain 1 VP.' },
  { id: 'sp-way-of-the-righteous', name: 'Way of the Righteous', cost: 2, season: 'spring', group: 'Horseman', cardType: 'warUpgrade', effect: 'At start of War Phase - Take 1 Coin from each player with less Honor.' },
  { id: 'sp-way-of-the-righteous-2', name: 'Way of the Righteous', cost: 2, season: 'spring', group: 'Horseman', cardType: 'warUpgrade', effect: 'At start of War Phase - Take 1 Coin from each player with less Honor.' },
  { id: 'sp-way-of-the-shogun', name: 'Way of the Shogun', cost: 2, season: 'spring', group: 'Core', cardType: 'warUpgrade', effect: 'At start of War Phase - Gain 3 Coins.' },
  { id: 'sp-way-of-the-shogun-2', name: 'Way of the Shogun', cost: 2, season: 'spring', group: 'Core', cardType: 'warUpgrade', effect: 'At start of War Phase - Gain 3 Coins.' },
];

export const SUMMER_CARDS: SeasonCard[] = [
  { id: 'su-bishamon', name: 'Bishamon', cost: 2, season: 'summer', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Force 4 while opponent Monster in same Province.', force: 4 },
  { id: 'su-fire-dragon', name: 'Fire Dragon', cost: 3, season: 'summer', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'At start of Battle, kill 1 other local figure of each player (including you).', force: 3 },
  { id: 'su-hotei', name: 'Hotei', cost: 2, season: 'summer', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Counts as Shinto. Can replace any Shinto when sent to Worship.' },
  { id: 'su-jikininki', name: 'Jikininki', cost: 2, season: 'summer', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Each time another figure killed in this Province, gain 1 VP and lose Honor.' },
  { id: 'su-justice', name: 'Justice', cost: 1, season: 'summer', group: 'Archway', cardType: 'virtue', effect: 'Gain 3 VP whenever you kill 1+ figures of a player with less Honor.' },
  { id: 'su-justice-2', name: 'Justice', cost: 1, season: 'summer', group: 'Archway', cardType: 'virtue', effect: 'Gain 3 VP whenever you kill 1+ figures of a player with less Honor.' },
  { id: 'su-koneko', name: 'Koneko', cost: 0, season: 'summer', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'If killed, gain 2 Coins and 2 Ronin. Others in Province lose 2 Coins and 2 Ronin.' },
  { id: 'su-loyalty', name: 'Loyalty', cost: 1, season: 'summer', group: 'Teapot', cardType: 'virtue', effect: 'If you have an Ally, whenever you gain 1+ VP, gain 1 extra VP.' },
  { id: 'su-loyalty-2', name: 'Loyalty', cost: 1, season: 'summer', group: 'Teapot', cardType: 'virtue', effect: 'If you have an Ally, whenever you gain 1+ VP, gain 1 extra VP.' },
  { id: 'su-mercy', name: 'Mercy', cost: 1, season: 'summer', group: 'Horseman', cardType: 'virtue', effect: 'When you could kill 1+ opponent figures, may leave them all alive and gain 2 VP.' },
  { id: 'su-mercy-2', name: 'Mercy', cost: 1, season: 'summer', group: 'Horseman', cardType: 'virtue', effect: 'When you could kill 1+ opponent figures, may leave them all alive and gain 2 VP.' },
  { id: 'su-nure-onna', name: 'Nure-Onna', cost: 2, season: 'summer', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Force 2. Before resolving War in a Province, may cross a Sea Route to join that Battle.', force: 2 },
  { id: 'su-oni-of-blood', name: 'Oni of Blood', cost: 3, season: 'summer', group: 'Archway/Horseman/Mountain/Ship/Tower', cardType: 'monster', effect: 'Force 2, or Force 4 where you have lowest Honor.', force: 2 },
  { id: 'su-oni-of-souls', name: 'Oni of Souls', cost: 2, season: 'summer', group: 'Archway/Teapot/Ship', cardType: 'monster', effect: 'If you win a War symbol with this Monster, gain 2 VP per Oni you own.' },
  { id: 'su-path-of-might', name: 'Path of Might', cost: 1, season: 'summer', group: 'Tower', cardType: 'upgrade', effect: 'Your Bushi in Province with any Oni have Force +1.' },
  { id: 'su-path-of-might-2', name: 'Path of Might', cost: 1, season: 'summer', group: 'Tower', cardType: 'upgrade', effect: 'Your Bushi in Province with any Oni have Force +1.' },
  { id: 'su-path-of-sengoku', name: 'Path of Sengoku', cost: 1, season: 'summer', group: 'Mountain', cardType: 'upgrade', effect: 'Daimyo Upgrade - End of any Harvest, gain reward of Daimyo Province (if not already).' },
  { id: 'su-path-of-the-favored', name: 'Path of the Favored', cost: 1, season: 'summer', group: 'Mountain', cardType: 'upgrade', effect: 'Shinto Upgrade - Your Shinto counts as Force 3 in Provinces where you have highest Honor.' },
  { id: 'su-path-of-the-monkey', name: 'Path of the Monkey', cost: 0, season: 'summer', group: 'Horseman', cardType: 'upgrade', effect: 'After you Summon, may take 1 Coin from richest opponent(s) and lose Honor.' },
  { id: 'su-path-of-the-monkey-2', name: 'Path of the Monkey', cost: 0, season: 'summer', group: 'Horseman', cardType: 'upgrade', effect: 'After you Summon, may take 1 Coin from richest opponent(s) and lose Honor.' },
  { id: 'su-path-of-the-samurai', name: 'Path of the Samurai', cost: 2, season: 'summer', group: 'Archway', cardType: 'upgrade', effect: 'Bushi Upgrade - End of Recruit, may place extra Bushi in any Province.' },
  { id: 'su-path-of-the-serpent', name: 'Path of the Serpent', cost: 0, season: 'summer', group: 'Core', cardType: 'upgrade', effect: 'Sea Route Upgrade - May charge 1 Coin to others crossing any Sea Route.' },
  { id: 'su-path-of-the-shadow', name: 'Path of the Shadow', cost: 1, season: 'summer', group: 'Tower', cardType: 'upgrade', effect: 'After you play Betray Mandate, gain 3 Coins.' },
  { id: 'su-patience', name: 'Patience', cost: 1, season: 'summer', group: 'Ship', cardType: 'virtue', effect: 'End of each Kami Turn, if you dont have most VP, gain 1 VP.' },
  { id: 'su-patience-2', name: 'Patience', cost: 1, season: 'summer', group: 'Ship', cardType: 'virtue', effect: 'End of each Kami Turn, if you dont have most VP, gain 1 VP.' },
  { id: 'su-respect', name: 'Respect', cost: 0, season: 'summer', group: 'Core', cardType: 'virtue', effect: 'May take 1 additional hostage when Taking Hostages in Battle.' },
  { id: 'su-respect-2', name: 'Respect', cost: 0, season: 'summer', group: 'Core', cardType: 'virtue', effect: 'May take 1 additional hostage when Taking Hostages in Battle.' },
  { id: 'su-sincerity', name: 'Sincerity', cost: 1, season: 'summer', group: 'Mountain', cardType: 'virtue', effect: 'Gain Honor and 1 extra VP when Taking Hostages.' },
  { id: 'su-sincerity-2', name: 'Sincerity', cost: 1, season: 'summer', group: 'Mountain', cardType: 'virtue', effect: 'Gain Honor and 1 extra VP when Taking Hostages.' },
  { id: 'su-sunakake-baba', name: 'Sunakake-Baba', cost: 1, season: 'summer', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'At start of War Phase - May take hostage 1 Bushi or Shinto from this Province.' },
  { id: 'su-way-of-bushido', name: 'Way of Bushido', cost: 3, season: 'summer', group: 'Core', cardType: 'warUpgrade', effect: 'At start of War Phase - Gain 2 Coins and 2 VP per different Virtue you have.' },
  { id: 'su-way-of-naginata', name: 'Way of Naginata', cost: 1, season: 'summer', group: 'Tower', cardType: 'warUpgrade', effect: 'At start of War Phase - Move one of your Bushi to any Province.' },
  { id: 'su-way-of-the-ashigaru', name: 'Way of the Ashigaru', cost: 2, season: 'summer', group: 'Ship', cardType: 'warUpgrade', effect: 'At start of War Phase - Choose Province where you have exactly 1 figure, Summon 2 Bushi there.' },
  { id: 'su-way-of-the-merchant', name: 'Way of the Merchant', cost: 2, season: 'summer', group: 'Teapot', cardType: 'upgrade', effect: 'Whenever a richer player gains Coins from common pile, you also gain 1 Coin.' },
  { id: 'su-way-of-the-merchant-2', name: 'Way of the Merchant', cost: 2, season: 'summer', group: 'Teapot', cardType: 'upgrade', effect: 'Whenever a richer player gains Coins from common pile, you also gain 1 Coin.' },
  { id: 'su-way-of-the-ronin', name: 'Way of the Ronin', cost: 1, season: 'summer', group: 'Core', cardType: 'warUpgrade', effect: 'At start of War Phase - Gain 2 Ronin.' },
  { id: 'su-way-of-the-ronin-2', name: 'Way of the Ronin', cost: 1, season: 'summer', group: 'Core', cardType: 'warUpgrade', effect: 'At start of War Phase - Gain 2 Ronin.' },
  { id: 'su-yurei', name: 'Yurei', cost: 3, season: 'summer', group: 'Core', cardType: 'monster', effect: 'Counts as Daimyo with Force 2.', force: 2 },
];

export const AUTUMN_CARDS: SeasonCard[] = [
  { id: 'au-benten', name: 'Benten', cost: 2, season: 'autumn', group: 'Dynasty Invasion', cardType: 'monster', effect: 'When this figure enters a Province, may force a player to Move out 1 of their Monsters.' },
  { id: 'au-boldness', name: 'Boldness', cost: 1, season: 'autumn', group: 'Tower', cardType: 'virtue', effect: 'Gain 4 VP each time you kill an enemy Oni in Battle.' },
  { id: 'au-daikaiju', name: 'Daikaiju', cost: 5, season: 'autumn', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Summon in ocean. At start of War Phase, place in any Province and destroy all enemy Fortresses there.', force: 5 },
  { id: 'au-ebisu', name: 'Ebisu', cost: 0, season: 'autumn', group: 'Dynasty Invasion', cardType: 'monster', effect: 'If killed, gain 8 Coins.' },
  { id: 'au-form-of-the-beast', name: 'Form of the Beast', cost: 4, season: 'autumn', group: 'Archway', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per Monster you own.' },
  { id: 'au-form-of-the-beast-2', name: 'Form of the Beast', cost: 4, season: 'autumn', group: 'Archway', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per Monster you own.' },
  { id: 'au-form-of-the-demon', name: 'Form of the Demon', cost: 3, season: 'autumn', group: 'Horseman', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per Oni you own.' },
  { id: 'au-form-of-the-demon-2', name: 'Form of the Demon', cost: 3, season: 'autumn', group: 'Horseman', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per Oni you own.' },
  { id: 'au-form-of-the-dragon', name: 'Form of the Dragon', cost: 1, season: 'autumn', group: 'Ship', cardType: 'winterUpgrade', effect: 'End Game - Gain 1 VP per War symbol you own.' },
  { id: 'au-form-of-the-dragon-2', name: 'Form of the Dragon', cost: 1, season: 'autumn', group: 'Ship', cardType: 'winterUpgrade', effect: 'End Game - Gain 1 VP per War symbol you own.' },
  { id: 'au-form-of-the-fox', name: 'Form of the Fox', cost: 3, season: 'autumn', group: 'Tower', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per Province where you have exactly 1 figure.' },
  { id: 'au-form-of-the-fox-2', name: 'Form of the Fox', cost: 3, season: 'autumn', group: 'Tower', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per Province where you have exactly 1 figure.' },
  { id: 'au-form-of-the-kindred', name: 'Form of the Kindred', cost: 3, season: 'autumn', group: 'Teapot', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per Season you had an ally.' },
  { id: 'au-form-of-the-kindred-2', name: 'Form of the Kindred', cost: 3, season: 'autumn', group: 'Teapot', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per Season you had an ally.' },
  { id: 'au-form-of-the-kitsune', name: 'Form of the Kitsune', cost: 4, season: 'autumn', group: 'Core', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per Fortress you own.' },
  { id: 'au-form-of-the-kitsune-2', name: 'Form of the Kitsune', cost: 4, season: 'autumn', group: 'Core', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per Fortress you own.' },
  { id: 'au-form-of-the-phoenix', name: 'Form of the Phoenix', cost: 3, season: 'autumn', group: 'Core', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per different Virtue you own.' },
  { id: 'au-form-of-the-phoenix-2', name: 'Form of the Phoenix', cost: 3, season: 'autumn', group: 'Core', cardType: 'winterUpgrade', effect: 'End Game - Gain 3 VP per different Virtue you own.' },
  { id: 'au-form-of-the-tanuki', name: 'Form of the Tanuki', cost: 2, season: 'autumn', group: 'Mountain', cardType: 'winterUpgrade', effect: 'End Game - Gain 2 VP per different type of Season card you own.' },
  { id: 'au-form-of-the-tanuki-2', name: 'Form of the Tanuki', cost: 2, season: 'autumn', group: 'Mountain', cardType: 'winterUpgrade', effect: 'End Game - Gain 2 VP per different type of Season card you own.' },
  { id: 'au-kitsune', name: 'Kitsune', cost: 0, season: 'autumn', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Whoever wins this War symbol gains 6 VP.' },
  { id: 'au-oni-of-hate', name: 'Oni of Hate', cost: 3, season: 'autumn', group: 'Archway/Horseman/Teapot/Mountain/Ship', cardType: 'monster', effect: 'When entering Province, kill 1 Bushi or Shinto of each player with higher Honor.' },
  { id: 'au-oni-of-plagues', name: 'Oni of Plagues', cost: 1, season: 'autumn', group: 'Monster Pack', cardType: 'monster', effect: 'Players with higher Honor than you cannot Move figures to this Province.' },
  { id: 'au-oni-of-spite', name: 'Oni of Spite', cost: 3, season: 'autumn', group: 'Archway/Horseman/Mountain/Ship/Tower', cardType: 'monster', effect: 'When entering Province, steal 2 VP from each player with higher Honor and any Force there.' },
  { id: 'au-path-of-the-dragon', name: 'Path of the Dragon', cost: 3, season: 'autumn', group: 'Core', cardType: 'upgrade', effect: 'Daimyo Upgrade - Your Daimyo has Force +3.' },
  { id: 'au-path-of-the-unrighteous', name: 'Path of the Unrighteous', cost: 0, season: 'autumn', group: 'Teapot', cardType: 'upgrade', effect: 'Dishonorable Upgrade - Each time you Betray, may replace 1 additional figure of any player (even worshipping Shinto).' },
  { id: 'au-path-of-the-unrighteous-2', name: 'Path of the Unrighteous', cost: 0, season: 'autumn', group: 'Teapot', cardType: 'upgrade', effect: 'Dishonorable Upgrade - Each time you Betray, may replace 1 additional figure of any player (even worshipping Shinto).' },
  { id: 'au-path-of-the-spirit', name: 'Path of the Spirit', cost: 2, season: 'autumn', group: 'Horseman', cardType: 'upgrade', effect: 'After you Summon, gain 2 Coins and 2 VP if you have highest Honor.' },
  { id: 'au-river-dragon', name: 'River Dragon', cost: 3, season: 'autumn', group: 'Core', cardType: 'monster', effect: 'Force 5.', force: 5 },
  { id: 'au-sacred-warrior', name: 'Sacred Warrior', cost: 0, season: 'autumn', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Force +1 per Virtue card you own.' },
  { id: 'au-way-of-naginata', name: 'Way of Naginata', cost: 0, season: 'autumn', group: 'Tower', cardType: 'warUpgrade', effect: 'At start of War Phase - Move one of your Bushi to any Province.' },
  { id: 'au-way-of-the-katana', name: 'Way of the Katana', cost: 3, season: 'autumn', group: 'Archway', cardType: 'warUpgrade', effect: 'During War Phase all your Bushi have Force 2.' },
  { id: 'au-way-of-the-keiri', name: 'Way of the Keiri', cost: 0, season: 'autumn', group: 'Mountain', cardType: 'warUpgrade', effect: 'At start of War Phase - Kill up to 2 opponent Bushi/Shinto in Daimyo Province, gain 3 VP each.' },
  { id: 'au-way-of-the-moneylender', name: 'Way of the Moneylender', cost: 0, season: 'autumn', group: 'Core', cardType: 'warUpgrade', effect: 'At start of War Phase - Gain 5 Coins.' },
  { id: 'au-way-of-the-snake', name: 'Way of the Snake', cost: 3, season: 'autumn', group: 'Ship', cardType: 'upgrade', effect: 'After each Kami Turn is resolved, may perform a Betray Mandate.' },
];

// --- Combined Season Cards ---

export const SEASON_CARDS_DATA: SeasonCard[] = [
  ...SPRING_CARDS,
  ...SUMMER_CARDS,
  ...AUTUMN_CARDS,
];

// --- Province Colors ---

export const PROVINCE_COLORS: Record<string, string> = {
  hokkaido: '#5BC0EB',
  oshu: '#9B8EC4',
  edo: '#2D8B4E',
  kanto: '#E63946',
  kansai: '#F57C20',
  nagato: '#8B5CF6',
  shikoku: '#8B6914',
  kyushu: '#F5D020',
};

