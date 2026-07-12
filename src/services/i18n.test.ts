import { describe, expect, it } from 'vitest';
import { createTranslator, messageCatalogs, translate } from './i18n';
import { supportedLocales } from './locale';

describe('i18n', () => {
  it('interpolates parameters through the translation API', () => {
    expect(translate('en', 'relationshipSelectedProfileActionsTitle', { name: 'Mina' })).toBe('Actions for Mina');
    expect(translate('fr', 'retryInSeconds', { seconds: 12 })).toBe('Réessai dans 12s.');
  });

  it('keeps an unknown placeholder visible', () => {
    expect(translate('en', 'deleteRoutine', {})).toBe('Delete {routine}');
  });

  it('creates a locale-bound translator', () => {
    expect(createTranslator('fr')('settingsLanguageTitle')).toBe('Langue');
  });

  it('keeps every locale complete and placeholders aligned', () => {
    const englishKeys = Object.keys(messageCatalogs.en).sort();
    const placeholders = (message: string) =>
      Array.from(message.matchAll(/\{([^{}]+)\}/g), (match) => match[1]).sort();

    for (const locale of supportedLocales) {
      expect(Object.keys(messageCatalogs[locale]).sort()).toEqual(englishKeys);
      for (const key of englishKeys) {
        const messageKey = key as keyof typeof messageCatalogs.en;
        expect(placeholders(messageCatalogs[locale][messageKey]), `${locale}.${key}`).toEqual(
          placeholders(messageCatalogs.en[messageKey]),
        );
      }
    }
  });
});
