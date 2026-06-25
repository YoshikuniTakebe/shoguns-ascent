import { en } from './en';
import { es } from './es';
import type { TranslationKey } from './en';
import { useGameStore } from '../store/gameStore';

export type Language = 'en' | 'es';
export type { TranslationKey };

const translations: Record<Language, Record<TranslationKey, string>> = { en, es };

/**
 * Get a translated string by key using the current language from the store.
 * Supports interpolation with {placeholder} syntax.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const lang = useGameStore.getState().language;
  let value = translations[lang][key] || translations['en'][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
}

/**
 * React hook that subscribes to language changes so components re-render
 * when the language is changed. Returns a t() function.
 */
export function useT() {
  const language = useGameStore(state => state.language);
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    let value = translations[language][key] || translations['en'][key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{${k}}`, String(v));
      }
    }
    return value;
  };
}
