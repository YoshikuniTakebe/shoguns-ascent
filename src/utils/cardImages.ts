import type { CardType } from '../types/game';
import { getMonsterImage } from './figureImages';

const generatedCardImages = import.meta.glob<string>(
  '../img/cards/*.webp',
  { eager: true, query: '?url', import: 'default' },
);

export function getSeasonCardImage(cardId: string, cardType: CardType): string | null {
  if (cardType === 'monster') return getMonsterImage(cardId);

  const baseCardId = cardId.replace(/-2$/, '');
  return generatedCardImages[`../img/cards/${baseCardId}.webp`] ?? null;
}
