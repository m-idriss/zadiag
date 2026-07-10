import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface FirestoreIndexField {
  fieldPath: string;
  order: 'ASCENDING' | 'DESCENDING';
}

interface FirestoreIndex {
  collectionGroup: string;
  queryScope: string;
  fields: FirestoreIndexField[];
}

const indexes = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: FirestoreIndex[] };

const hasIndex = (collectionGroup: string, fields: FirestoreIndexField[]) =>
  indexes.indexes.some((index) =>
    index.collectionGroup === collectionGroup
    && index.queryScope === 'COLLECTION'
    && JSON.stringify(index.fields) === JSON.stringify(fields));

describe('Firestore indexes', () => {
  it('covers routine-centric check queries used by scheduled functions', () => {
    expect(hasIndex('checks', [
      { fieldPath: 'routineId', order: 'ASCENDING' },
      { fieldPath: 'requestedAt', order: 'DESCENDING' },
    ])).toBe(true);
    expect(hasIndex('checks', [
      { fieldPath: 'routineId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
    ])).toBe(true);
  });

  it('covers stale pending check cleanup queries', () => {
    expect(hasIndex('checks', [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'expiresAt', order: 'ASCENDING' },
    ])).toBe(true);
  });
});
