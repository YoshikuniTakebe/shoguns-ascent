import type { TranslationKey } from '../i18n';
import type { Season, SeasonCard } from '../types/game';
import type { CardSetName } from '../components/DeckSetIcons';

export const CARD_CATALOG_SETS = [
  'Core',
  'Archway',
  'Tower',
  'Teapot',
  'Horseman',
  'Ship',
  'Mountain',
  'Dynasty Invasion',
  'Monster Pack',
  'Kickstarter Exclusive',
] as const satisfies readonly CardSetName[];

export type CardCatalogSet = typeof CARD_CATALOG_SETS[number];
export type CardCatalogSeason = Extract<Season, 'spring' | 'summer' | 'autumn'>;

export const CARD_CATALOG_SEASONS: CardCatalogSeason[] = ['spring', 'summer', 'autumn'];

export const CARD_CATALOG_SET_KEYS: Record<CardCatalogSet, TranslationKey> = {
  Core: 'deck.core',
  Archway: 'deck.archway',
  Tower: 'deck.tower',
  Teapot: 'deck.teapot',
  Horseman: 'deck.horseman',
  Ship: 'deck.ship',
  Mountain: 'deck.mountain',
  'Dynasty Invasion': 'deck.dynastyInvasion',
  'Monster Pack': 'deck.monsterPack',
  'Kickstarter Exclusive': 'deck.kickstarterExclusive',
};

export const CARD_CATALOG_SEASON_KEYS: Record<CardCatalogSeason, TranslationKey> = {
  spring: 'season.spring',
  summer: 'season.summer',
  autumn: 'season.autumn',
};

export const cardBelongsToSet = (card: SeasonCard, setName: CardCatalogSet) =>
  card.group.split('/').map((group) => group.trim()).includes(setName);
