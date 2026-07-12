import type { Locale } from '../domain/models';

export const supportedLocales = ['en', 'fr'] as const satisfies readonly Locale[];

export const localeConfig: Record<Locale, { languageTag: string; documentLanguage: string; label: string }> = {
  en: { languageTag: 'en-US', documentLanguage: 'en', label: 'English' },
  fr: { languageTag: 'fr-FR', documentLanguage: 'fr', label: 'Français' },
};

export const languageTag = (locale: Locale) => localeConfig[locale].languageTag;
export const documentLanguage = (locale: Locale) => localeConfig[locale].documentLanguage;

export const resolveLocale = (language?: string): Locale =>
  language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
