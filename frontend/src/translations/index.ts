import { en } from './en';
import { kn, TranslationKey } from './kn';
import { hi } from './hi';
import { SupportedLanguage } from '../types/api';

export const translations: Record<SupportedLanguage, Record<TranslationKey, string>> = {
  en,
  kn,
  hi,
};

export function getTranslation(lang: SupportedLanguage, key: TranslationKey): string {
  return translations[lang]?.[key] || translations.en?.[key] || translations.kn?.[key] || key;
}

export { en, kn, hi };
export type { TranslationKey };
