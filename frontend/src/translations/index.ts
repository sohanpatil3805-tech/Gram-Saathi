import { kn, TranslationKey } from './kn';
import { hi } from './hi';
import { SupportedLanguage } from '../types/api';

export const translations = {
  kn,
  hi,
};

export function getTranslation(lang: SupportedLanguage, key: TranslationKey): string {
  return translations[lang]?.[key] || translations.kn[key] || key;
}

export { kn, hi };
export type { TranslationKey };
