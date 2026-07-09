import { beforeEach, describe, expect, it } from 'vitest';
import { readUiStorageJson, readUiStorageString, removeUiStorageItem, writeUiStorageString } from './uiStorage';

describe('uiStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads, writes and removes string values safely', () => {
    expect(readUiStorageString('missing')).toBeUndefined();

    writeUiStorageString('key', 'value');
    expect(readUiStorageString('key')).toBe('value');

    removeUiStorageItem('key');
    expect(readUiStorageString('key')).toBeUndefined();
  });

  it('normalizes stored JSON and falls back when invalid', () => {
    writeUiStorageString('json', JSON.stringify(['one', 2, 'two']));

    const result = readUiStorageJson('json', [] as string[], (value) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

    expect(result).toEqual(['one', 'two']);

    writeUiStorageString('json', '{');
    expect(readUiStorageJson('json', ['fallback'])).toEqual(['fallback']);
  });
});
