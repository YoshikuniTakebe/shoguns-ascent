import type { TranslationKey } from '../i18n/en';

/**
 * Get the base card ID by stripping the "-2" suffix used for duplicate cards.
 * Duplicate cards share the same effect text, so they use the same translation key.
 */
export function getBaseCardId(cardId: string): string {
  return cardId.replace(/-2$/, '');
}

/**
 * Get the translation key for a card's effect text.
 */
export function getCardEffectKey(cardId: string): TranslationKey {
  return `card.effect.${getBaseCardId(cardId)}` as TranslationKey;
}

/**
 * Get the translation key for a card's name.
 */
export function getCardNameKey(cardId: string): TranslationKey {
  return `card.name.${getBaseCardId(cardId)}` as TranslationKey;
}
