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
  { id: 'sp-benevolence', name: 'Benevolence', cost: 1, season: 'spring', group: 'Archway', cardType: 'virtue', effect: 'Cuando gastas Monedas, puedes dar una a otro jugador. Si lo haces, ganas Honor y 2 PV.' },
  { id: 'sp-benevolence-2', name: 'Benevolence', cost: 1, season: 'spring', group: 'Archway', cardType: 'virtue', effect: 'Cuando gastas Monedas, puedes dar una a otro jugador. Si lo haces, ganas Honor y 2 PV.' },
  { id: 'sp-courage', name: 'Courage', cost: 3, season: 'spring', group: 'Horseman', cardType: 'virtue', effect: 'Gana 2 PV cada vez que ganes un simbolo de Guerra.' },
  { id: 'sp-courage-2', name: 'Courage', cost: 3, season: 'spring', group: 'Horseman', cardType: 'virtue', effect: 'Gana 2 PV cada vez que ganes un simbolo de Guerra.' },
  { id: 'sp-daikokuten', name: 'Daikokuten', cost: 1, season: 'spring', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Fuerza 8 durante el Mandato de Cosecha.', force: 8 },
  { id: 'sp-dignity', name: 'Dignity', cost: 1, season: 'spring', group: 'Ship', cardType: 'virtue', effect: 'Cada vez que Invocas un Monstruo, gana 2 PV.' },
  { id: 'sp-dignity-2', name: 'Dignity', cost: 1, season: 'spring', group: 'Ship', cardType: 'virtue', effect: 'Cada vez que Invocas un Monstruo, gana 2 PV.' },
  { id: 'sp-earth-dragon', name: 'Earth Dragon', cost: 3, season: 'spring', group: 'Monster Pack', cardType: 'monster', effect: 'Al inicio de la Batalla, puede Mover 1 figura de cada otro jugador fuera de esta Provincia.', force: 3 },
  { id: 'sp-fukurokuju', name: 'Fukurokuju', cost: 3, season: 'spring', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Cuenta como Daimyo y Fortaleza.' },
  { id: 'sp-generosity', name: 'Generosity', cost: 0, season: 'spring', group: 'Tower', cardType: 'virtue', effect: 'Despues de jugar un Mandato, puede ofrecer 1 Moneda a cualquier jugador. Si acepta, gana Honor.' },
  { id: 'sp-generosity-2', name: 'Generosity', cost: 0, season: 'spring', group: 'Tower', cardType: 'virtue', effect: 'Despues de jugar un Mandato, puede ofrecer 1 Moneda a cualquier jugador. Si acepta, gana Honor.' },
  { id: 'sp-honesty', name: 'Honesty', cost: 0, season: 'spring', group: 'Teapot', cardType: 'virtue', effect: 'Mientras tengas un aliado, gana 2 PV cada vez que selecciones un Mandato que no sea Traicionar.' },
  { id: 'sp-honesty-2', name: 'Honesty', cost: 0, season: 'spring', group: 'Teapot', cardType: 'virtue', effect: 'Mientras tengas un aliado, gana 2 PV cada vez que selecciones un Mandato que no sea Traicionar.' },
  { id: 'sp-jinmenju', name: 'Jinmenju', cost: 2, season: 'spring', group: 'Monster Pack', cardType: 'monster', effect: 'Durante el Mandato de Reclutar, puede invocar una figura aqui y perder Honor.' },
  { id: 'sp-jorogumo', name: 'Jorogumo', cost: 3, season: 'spring', group: 'Monster Pack', cardType: 'monster', effect: 'Al inicio de la Batalla, toma el control de 1 Bushi o Shinto local hasta el final de la Batalla.' },
  { id: 'sp-jurojin', name: 'Jurojin', cost: 1, season: 'spring', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Cuenta como Virtud: Gana 3 Monedas tras adquirir otra Virtud.' },
  { id: 'sp-komainu', name: 'Komainu', cost: 2, season: 'spring', group: 'Core', cardType: 'monster', effect: 'Cuenta como un Shinto.' },
  { id: 'sp-kotahi', name: 'Kotahi', cost: 1, season: 'spring', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Ganas la recompensa de Cosecha de esta Provincia si tienes la mayor fuerza aqui, sin importar quien jugo Cosecha.' },
  { id: 'sp-oni-of-skulls', name: 'Oni of Skulls', cost: 2, season: 'spring', group: 'Core', cardType: 'monster', effect: 'Fuerza 3 en cualquier Provincia donde tengas el Honor mas bajo.', force: 3 },
  { id: 'sp-oni-of-souls', name: 'Oni of Souls', cost: 2, season: 'spring', group: 'Tower', cardType: 'monster', effect: 'Si ganas un simbolo de Guerra con este Monstruo, gana 2 PV por cada Oni que poseas.' },
  { id: 'sp-path-of-the-builder', name: 'Path of the Builder', cost: 0, season: 'spring', group: 'Mountain', cardType: 'upgrade', effect: 'Cuando cualquier jugador usa el Mandato de Mariscal, puedes construir una Fortaleza (pagando el coste).' },
  { id: 'sp-path-of-the-kannushi', name: 'Path of the Kannushi', cost: 2, season: 'spring', group: 'Mountain', cardType: 'upgrade', effect: 'Durante Mariscal, puede mover 1 de tus Shinto a un Santuario diferente.' },
  { id: 'sp-path-of-the-kannushi-2', name: 'Path of the Kannushi', cost: 2, season: 'spring', group: 'Mountain', cardType: 'upgrade', effect: 'Durante Mariscal, puede mover 1 de tus Shinto a un Santuario diferente.' },
  { id: 'sp-path-of-the-kenin', name: 'Path of the Kenin', cost: 2, season: 'spring', group: 'Archway', cardType: 'upgrade', effect: 'Mejora de Bushi - Despues de Invocar, puede colocar un Bushi extra en cualquier Fortaleza.' },
  { id: 'sp-path-of-the-kenin-2', name: 'Path of the Kenin', cost: 2, season: 'spring', group: 'Archway', cardType: 'upgrade', effect: 'Mejora de Bushi - Despues de Invocar, puede colocar un Bushi extra en cualquier Fortaleza.' },
  { id: 'sp-path-of-the-light', name: 'Path of the Light', cost: 1, season: 'spring', group: 'Archway', cardType: 'upgrade', effect: 'Mejora de Shinto - Al final de Reclutar, puede colocar un Shinto extra en un Santuario.' },
  { id: 'sp-path-of-the-lion', name: 'Path of the Lion', cost: 0, season: 'spring', group: 'Core', cardType: 'upgrade', effect: 'Mejora de Daimyo - Tu Daimyo tiene Fuerza +1.' },
  { id: 'sp-path-of-the-ninja', name: 'Path of the Ninja', cost: 2, season: 'spring', group: 'Horseman', cardType: 'upgrade', effect: 'Mejora Deshonrosa - Despues de Invocar, puede matar 1 Bushi cualquiera en el Mapa y perder Honor.' },
  { id: 'sp-path-of-the-pacifist', name: 'Path of the Pacifist', cost: 1, season: 'spring', group: 'Ship', cardType: 'upgrade', effect: 'Al inicio de Verano y Otono, gana 4 PV si no tienes la mayoria de simbolos de Guerra.' },
  { id: 'sp-path-of-the-patron', name: 'Path of the Patron', cost: 2, season: 'spring', group: 'Teapot', cardType: 'upgrade', effect: 'Despues de Invocar, gana 2 Monedas si tienes mas Honor que al menos 2 jugadores.' },
  { id: 'sp-path-of-the-salamander', name: 'Path of the Salamander', cost: 1, season: 'spring', group: 'Ship', cardType: 'upgrade', effect: 'Al inicio de Verano y Otono, gana 3 Monedas y pierde Honor.' },
  { id: 'sp-path-of-the-salamander-2', name: 'Path of the Salamander', cost: 1, season: 'spring', group: 'Ship', cardType: 'upgrade', effect: 'Al inicio de Verano y Otono, gana 3 Monedas y pierde Honor.' },
  { id: 'sp-path-of-the-vassal', name: 'Path of the Vassal', cost: 0, season: 'spring', group: 'Tower', cardType: 'upgrade', effect: 'Despues de usar la habilidad del Santuario Kami, puede pagar 2 Monedas para ganar 2 PV.' },
  { id: 'sp-path-of-the-vassal-2', name: 'Path of the Vassal', cost: 0, season: 'spring', group: 'Tower', cardType: 'upgrade', effect: 'Despues de usar la habilidad del Santuario Kami, puede pagar 2 Monedas para ganar 2 PV.' },
  { id: 'sp-path-of-the-warlord', name: 'Path of the Warlord', cost: 1, season: 'spring', group: 'Teapot', cardType: 'upgrade', effect: 'Despues de Invocar, gana 1 Moneda.' },
  { id: 'sp-path-of-the-warlord-2', name: 'Path of the Warlord', cost: 1, season: 'spring', group: 'Teapot', cardType: 'upgrade', effect: 'Despues de Invocar, gana 1 Moneda.' },
  { id: 'sp-phoenix', name: 'Phoenix', cost: 1, season: 'spring', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Si muere, gana 1 PV y vuelve a la misma Provincia inmediatamente.' },
  { id: 'sp-piety', name: 'Piety', cost: 1, season: 'spring', group: 'Mountain', cardType: 'virtue', effect: 'Si ganas un simbolo de Guerra con un Shinto, gana Honor y 3 PV.' },
  { id: 'sp-piety-2', name: 'Piety', cost: 1, season: 'spring', group: 'Mountain', cardType: 'virtue', effect: 'Si ganas un simbolo de Guerra con un Shinto, gana Honor y 3 PV.' },
  { id: 'sp-righteousness', name: 'Righteousness', cost: 2, season: 'spring', group: 'Core', cardType: 'virtue', effect: 'Por cada una de tus figuras eliminadas, gana 1 PV.' },
  { id: 'sp-righteousness-2', name: 'Righteousness', cost: 2, season: 'spring', group: 'Core', cardType: 'virtue', effect: 'Por cada una de tus figuras eliminadas, gana 1 PV.' },
  { id: 'sp-way-of-the-righteous', name: 'Way of the Righteous', cost: 2, season: 'spring', group: 'Horseman', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Toma 1 Moneda de cada jugador con menos Honor.' },
  { id: 'sp-way-of-the-righteous-2', name: 'Way of the Righteous', cost: 2, season: 'spring', group: 'Horseman', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Toma 1 Moneda de cada jugador con menos Honor.' },
  { id: 'sp-way-of-the-shogun', name: 'Way of the Shogun', cost: 2, season: 'spring', group: 'Core', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Gana 3 Monedas.' },
  { id: 'sp-way-of-the-shogun-2', name: 'Way of the Shogun', cost: 2, season: 'spring', group: 'Core', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Gana 3 Monedas.' },
];

export const SUMMER_CARDS: SeasonCard[] = [
  { id: 'su-bishamon', name: 'Bishamon', cost: 2, season: 'summer', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Fuerza 4 mientras haya un Monstruo oponente en la misma Provincia.', force: 4 },
  { id: 'su-fire-dragon', name: 'Fire Dragon', cost: 3, season: 'summer', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Al inicio de la Batalla, mata 1 otra figura local de cada jugador (incluyendote).', force: 3 },
  { id: 'su-hotei', name: 'Hotei', cost: 2, season: 'summer', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Cuenta como Shinto. Puede reemplazar a cualquier Shinto cuando se envia a Adorar.' },
  { id: 'su-jikininki', name: 'Jikininki', cost: 2, season: 'summer', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Cada vez que otra figura muere en esta Provincia, gana 1 PV y pierde Honor.' },
  { id: 'su-justice', name: 'Justice', cost: 1, season: 'summer', group: 'Archway', cardType: 'virtue', effect: 'Gana 3 PV cada vez que mates 1+ figuras de un jugador con menos Honor.' },
  { id: 'su-justice-2', name: 'Justice', cost: 1, season: 'summer', group: 'Archway', cardType: 'virtue', effect: 'Gana 3 PV cada vez que mates 1+ figuras de un jugador con menos Honor.' },
  { id: 'su-koneko', name: 'Koneko', cost: 0, season: 'summer', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Si muere, gana 2 Monedas y 2 Ronin. Los demas en la Provincia pierden 2 Monedas y 2 Ronin.' },
  { id: 'su-loyalty', name: 'Loyalty', cost: 1, season: 'summer', group: 'Teapot', cardType: 'virtue', effect: 'Si tienes un Aliado, cada vez que ganes 1+ PV, gana 1 PV extra.' },
  { id: 'su-loyalty-2', name: 'Loyalty', cost: 1, season: 'summer', group: 'Teapot', cardType: 'virtue', effect: 'Si tienes un Aliado, cada vez que ganes 1+ PV, gana 1 PV extra.' },
  { id: 'su-mercy', name: 'Mercy', cost: 1, season: 'summer', group: 'Horseman', cardType: 'virtue', effect: 'Cuando puedas matar 1+ figuras oponentes, puedes dejarlas todas vivas y ganar 2 PV.' },
  { id: 'su-mercy-2', name: 'Mercy', cost: 1, season: 'summer', group: 'Horseman', cardType: 'virtue', effect: 'Cuando puedas matar 1+ figuras oponentes, puedes dejarlas todas vivas y ganar 2 PV.' },
  { id: 'su-nure-onna', name: 'Nure-Onna', cost: 2, season: 'summer', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Fuerza 2. Antes de resolver la Guerra en una Provincia, puede cruzar una Ruta Maritima para unirse a esa Batalla.', force: 2 },
  { id: 'su-oni-of-blood', name: 'Oni of Blood', cost: 3, season: 'summer', group: 'Archway/Horseman/Mountain/Ship/Tower', cardType: 'monster', effect: 'Fuerza 2, o Fuerza 4 donde tengas el Honor mas bajo.', force: 2 },
  { id: 'su-oni-of-souls', name: 'Oni of Souls', cost: 2, season: 'summer', group: 'Archway/Teapot/Ship', cardType: 'monster', effect: 'Si ganas un simbolo de Guerra con este Monstruo, gana 2 PV por cada Oni que poseas.' },
  { id: 'su-path-of-might', name: 'Path of Might', cost: 1, season: 'summer', group: 'Tower', cardType: 'upgrade', effect: 'Tus Bushi en Provincia con cualquier Oni tienen Fuerza +1.' },
  { id: 'su-path-of-might-2', name: 'Path of Might', cost: 1, season: 'summer', group: 'Tower', cardType: 'upgrade', effect: 'Tus Bushi en Provincia con cualquier Oni tienen Fuerza +1.' },
  { id: 'su-path-of-sengoku', name: 'Path of Sengoku', cost: 1, season: 'summer', group: 'Mountain', cardType: 'upgrade', effect: 'Mejora de Daimyo - Al final de cualquier Cosecha, gana la recompensa de la Provincia del Daimyo (si no la tienes ya).' },
  { id: 'su-path-of-the-favored', name: 'Path of the Favored', cost: 1, season: 'summer', group: 'Mountain', cardType: 'upgrade', effect: 'Mejora de Shinto - Tu Shinto cuenta como Fuerza 3 en Provincias donde tengas el Honor mas alto.' },
  { id: 'su-path-of-the-monkey', name: 'Path of the Monkey', cost: 0, season: 'summer', group: 'Horseman', cardType: 'upgrade', effect: 'Despues de Invocar, puede tomar 1 Moneda del oponente(s) mas rico y perder Honor.' },
  { id: 'su-path-of-the-monkey-2', name: 'Path of the Monkey', cost: 0, season: 'summer', group: 'Horseman', cardType: 'upgrade', effect: 'Despues de Invocar, puede tomar 1 Moneda del oponente(s) mas rico y perder Honor.' },
  { id: 'su-path-of-the-samurai', name: 'Path of the Samurai', cost: 2, season: 'summer', group: 'Archway', cardType: 'upgrade', effect: 'Mejora de Bushi - Al final de Reclutar, puede colocar un Bushi extra en cualquier Provincia.' },
  { id: 'su-path-of-the-serpent', name: 'Path of the Serpent', cost: 0, season: 'summer', group: 'Core', cardType: 'upgrade', effect: 'Mejora de Ruta Maritima - Puede cobrar 1 Moneda a otros que crucen cualquier Ruta Maritima.' },
  { id: 'su-path-of-the-shadow', name: 'Path of the Shadow', cost: 1, season: 'summer', group: 'Tower', cardType: 'upgrade', effect: 'Despues de jugar el Mandato de Traicionar, gana 3 Monedas.' },
  { id: 'su-patience', name: 'Patience', cost: 1, season: 'summer', group: 'Ship', cardType: 'virtue', effect: 'Al final de cada Turno Kami, si no tienes la mayoria de PV, gana 1 PV.' },
  { id: 'su-patience-2', name: 'Patience', cost: 1, season: 'summer', group: 'Ship', cardType: 'virtue', effect: 'Al final de cada Turno Kami, si no tienes la mayoria de PV, gana 1 PV.' },
  { id: 'su-respect', name: 'Respect', cost: 0, season: 'summer', group: 'Core', cardType: 'virtue', effect: 'Puede tomar 1 rehen adicional al Tomar Rehenes en Batalla.' },
  { id: 'su-respect-2', name: 'Respect', cost: 0, season: 'summer', group: 'Core', cardType: 'virtue', effect: 'Puede tomar 1 rehen adicional al Tomar Rehenes en Batalla.' },
  { id: 'su-sincerity', name: 'Sincerity', cost: 1, season: 'summer', group: 'Mountain', cardType: 'virtue', effect: 'Gana Honor y 1 PV extra al Tomar Rehenes.' },
  { id: 'su-sincerity-2', name: 'Sincerity', cost: 1, season: 'summer', group: 'Mountain', cardType: 'virtue', effect: 'Gana Honor y 1 PV extra al Tomar Rehenes.' },
  { id: 'su-sunakake-baba', name: 'Sunakake-Baba', cost: 1, season: 'summer', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Al inicio de la Fase de Guerra - Puede tomar como rehen 1 Bushi o Shinto de esta Provincia.' },
  { id: 'su-way-of-bushido', name: 'Way of Bushido', cost: 3, season: 'summer', group: 'Core', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Gana 2 Monedas y 2 PV por cada Virtud diferente que tengas.' },
  { id: 'su-way-of-naginata', name: 'Way of Naginata', cost: 1, season: 'summer', group: 'Tower', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Mueve uno de tus Bushi a cualquier Provincia.' },
  { id: 'su-way-of-the-ashigaru', name: 'Way of the Ashigaru', cost: 2, season: 'summer', group: 'Ship', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Elige una Provincia donde tengas exactamente 1 figura, Invoca 2 Bushi alli.' },
  { id: 'su-way-of-the-merchant', name: 'Way of the Merchant', cost: 2, season: 'summer', group: 'Teapot', cardType: 'upgrade', effect: 'Cada vez que un jugador mas rico gana Monedas del fondo comun, tu tambien ganas 1 Moneda.' },
  { id: 'su-way-of-the-merchant-2', name: 'Way of the Merchant', cost: 2, season: 'summer', group: 'Teapot', cardType: 'upgrade', effect: 'Cada vez que un jugador mas rico gana Monedas del fondo comun, tu tambien ganas 1 Moneda.' },
  { id: 'su-way-of-the-ronin', name: 'Way of the Ronin', cost: 1, season: 'summer', group: 'Core', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Gana 2 Ronin.' },
  { id: 'su-way-of-the-ronin-2', name: 'Way of the Ronin', cost: 1, season: 'summer', group: 'Core', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Gana 2 Ronin.' },
  { id: 'su-yurei', name: 'Yurei', cost: 3, season: 'summer', group: 'Core', cardType: 'monster', effect: 'Cuenta como Daimyo con Fuerza 2.', force: 2 },
];

export const AUTUMN_CARDS: SeasonCard[] = [
  { id: 'au-benten', name: 'Benten', cost: 2, season: 'autumn', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Cuando esta figura entra en una Provincia, puede forzar a un jugador a Mover fuera 1 de sus Monstruos.' },
  { id: 'au-boldness', name: 'Boldness', cost: 1, season: 'autumn', group: 'Tower', cardType: 'virtue', effect: 'Gana 4 PV cada vez que mates un Oni enemigo en Batalla.' },
  { id: 'au-daikaiju', name: 'Daikaiju', cost: 5, season: 'autumn', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Invoca en el oceano. Al inicio de la Fase de Guerra, coloca en cualquier Provincia y destruye todas las Fortalezas enemigas alli.', force: 5 },
  { id: 'au-ebisu', name: 'Ebisu', cost: 0, season: 'autumn', group: 'Dynasty Invasion', cardType: 'monster', effect: 'Si muere, gana 8 Monedas.' },
  { id: 'au-form-of-the-beast', name: 'Form of the Beast', cost: 4, season: 'autumn', group: 'Archway', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Monstruo que poseas.' },
  { id: 'au-form-of-the-beast-2', name: 'Form of the Beast', cost: 4, season: 'autumn', group: 'Archway', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Monstruo que poseas.' },
  { id: 'au-form-of-the-demon', name: 'Form of the Demon', cost: 3, season: 'autumn', group: 'Horseman', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Oni que poseas.' },
  { id: 'au-form-of-the-demon-2', name: 'Form of the Demon', cost: 3, season: 'autumn', group: 'Horseman', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Oni que poseas.' },
  { id: 'au-form-of-the-dragon', name: 'Form of the Dragon', cost: 1, season: 'autumn', group: 'Ship', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 1 PV por cada simbolo de Guerra que poseas.' },
  { id: 'au-form-of-the-dragon-2', name: 'Form of the Dragon', cost: 1, season: 'autumn', group: 'Ship', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 1 PV por cada simbolo de Guerra que poseas.' },
  { id: 'au-form-of-the-fox', name: 'Form of the Fox', cost: 3, season: 'autumn', group: 'Tower', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Provincia donde tengas exactamente 1 figura.' },
  { id: 'au-form-of-the-fox-2', name: 'Form of the Fox', cost: 3, season: 'autumn', group: 'Tower', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Provincia donde tengas exactamente 1 figura.' },
  { id: 'au-form-of-the-kindred', name: 'Form of the Kindred', cost: 3, season: 'autumn', group: 'Teapot', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Estacion en la que tuviste un aliado.' },
  { id: 'au-form-of-the-kindred-2', name: 'Form of the Kindred', cost: 3, season: 'autumn', group: 'Teapot', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Estacion en la que tuviste un aliado.' },
  { id: 'au-form-of-the-kitsune', name: 'Form of the Kitsune', cost: 4, season: 'autumn', group: 'Core', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Fortaleza que poseas.' },
  { id: 'au-form-of-the-kitsune-2', name: 'Form of the Kitsune', cost: 4, season: 'autumn', group: 'Core', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Fortaleza que poseas.' },
  { id: 'au-form-of-the-phoenix', name: 'Form of the Phoenix', cost: 3, season: 'autumn', group: 'Core', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Virtud diferente que poseas.' },
  { id: 'au-form-of-the-phoenix-2', name: 'Form of the Phoenix', cost: 3, season: 'autumn', group: 'Core', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 3 PV por cada Virtud diferente que poseas.' },
  { id: 'au-form-of-the-tanuki', name: 'Form of the Tanuki', cost: 2, season: 'autumn', group: 'Mountain', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 2 PV por cada tipo diferente de carta de Estacion que poseas.' },
  { id: 'au-form-of-the-tanuki-2', name: 'Form of the Tanuki', cost: 2, season: 'autumn', group: 'Mountain', cardType: 'winterUpgrade', effect: 'Fin del Juego - Gana 2 PV por cada tipo diferente de carta de Estacion que poseas.' },
  { id: 'au-kitsune', name: 'Kitsune', cost: 0, season: 'autumn', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Quien gane este simbolo de Guerra gana 6 PV.' },
  { id: 'au-oni-of-hate', name: 'Oni of Hate', cost: 3, season: 'autumn', group: 'Archway/Horseman/Teapot/Mountain/Ship', cardType: 'monster', effect: 'Al entrar en una Provincia, mata 1 Bushi o Shinto de cada jugador con mayor Honor.' },
  { id: 'au-oni-of-plagues', name: 'Oni of Plagues', cost: 1, season: 'autumn', group: 'Monster Pack', cardType: 'monster', effect: 'Los jugadores con mayor Honor que tu no pueden Mover figuras a esta Provincia.' },
  { id: 'au-oni-of-spite', name: 'Oni of Spite', cost: 3, season: 'autumn', group: 'Archway/Horseman/Mountain/Ship/Tower', cardType: 'monster', effect: 'Al entrar en una Provincia, roba 2 PV de cada jugador con mayor Honor y cualquier Fuerza alli.' },
  { id: 'au-path-of-the-dragon', name: 'Path of the Dragon', cost: 3, season: 'autumn', group: 'Core', cardType: 'upgrade', effect: 'Mejora de Daimyo - Tu Daimyo tiene Fuerza +3.' },
  { id: 'au-path-of-the-unrighteous', name: 'Path of the Unrighteous', cost: 0, season: 'autumn', group: 'Teapot', cardType: 'upgrade', effect: 'Mejora Deshonrosa - Cada vez que Traiciones, puede reemplazar 1 figura adicional de cualquier jugador (incluso Shinto adorando).' },
  { id: 'au-path-of-the-unrighteous-2', name: 'Path of the Unrighteous', cost: 0, season: 'autumn', group: 'Teapot', cardType: 'upgrade', effect: 'Mejora Deshonrosa - Cada vez que Traiciones, puede reemplazar 1 figura adicional de cualquier jugador (incluso Shinto adorando).' },
  { id: 'au-path-of-the-spirit', name: 'Path of the Spirit', cost: 2, season: 'autumn', group: 'Horseman', cardType: 'upgrade', effect: 'Despues de Invocar, gana 2 Monedas y 2 PV si tienes el Honor mas alto.' },
  { id: 'au-river-dragon', name: 'River Dragon', cost: 3, season: 'autumn', group: 'Core', cardType: 'monster', effect: 'Fuerza 5.', force: 5 },
  { id: 'au-sacred-warrior', name: 'Sacred Warrior', cost: 0, season: 'autumn', group: 'Kickstarter Exclusive', cardType: 'monster', effect: 'Fuerza +1 por cada carta de Virtud que poseas.' },
  { id: 'au-way-of-naginata', name: 'Way of Naginata', cost: 0, season: 'autumn', group: 'Tower', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Mueve uno de tus Bushi a cualquier Provincia.' },
  { id: 'au-way-of-the-katana', name: 'Way of the Katana', cost: 3, season: 'autumn', group: 'Archway', cardType: 'warUpgrade', effect: 'Durante la Fase de Guerra todos tus Bushi tienen Fuerza 2.' },
  { id: 'au-way-of-the-keiri', name: 'Way of the Keiri', cost: 0, season: 'autumn', group: 'Mountain', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Mata hasta 2 Bushi/Shinto oponentes en la Provincia del Daimyo, gana 3 PV por cada uno.' },
  { id: 'au-way-of-the-moneylender', name: 'Way of the Moneylender', cost: 0, season: 'autumn', group: 'Core', cardType: 'warUpgrade', effect: 'Al inicio de la Fase de Guerra - Gana 5 Monedas.' },
  { id: 'au-way-of-the-snake', name: 'Way of the Snake', cost: 3, season: 'autumn', group: 'Ship', cardType: 'upgrade', effect: 'Despues de cada Turno Kami resuelto, puede realizar un Mandato de Traicionar.' },
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

