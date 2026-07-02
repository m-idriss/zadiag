import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';

const projectId = 'zadiag-rules-test';
let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync(resolve('firestore.rules'), 'utf8') },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'families/family-1'), {
      childName: 'Maya',
      members: { parent: 'parent', child: 'child' },
    });
    await setDoc(doc(db, 'families/family-1/checks/check-1'), {
      routineId: 'orthodontic-elastics',
      sessionId: 'session-1',
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      status: 'pending',
    });
    await setDoc(doc(db, 'families/family-1/routineAssignments/orthodontic-elastics'), {
      routineId: 'orthodontic-elastics',
      status: 'active',
      assignedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'users/parent'), { familyId: 'family-1', role: 'parent' });
    await setDoc(doc(db, 'linkCodes/private-hash'), { familyId: 'family-1' });
  });
});

afterAll(async () => environment.cleanup());

describe('family isolation', () => {
  test('allows family members to read their family and checks', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    await assertSucceeds(getDoc(doc(parentDb, 'families/family-1')));
    await assertSucceeds(getDoc(doc(parentDb, 'families/family-1/checks/check-1')));
    await assertSucceeds(getDoc(doc(parentDb, 'families/family-1/routineAssignments/orthodontic-elastics')));
  });

  test('denies outsiders and hides linking documents', async () => {
    const outsiderDb = environment.authenticatedContext('outsider').firestore();
    const parentDb = environment.authenticatedContext('parent').firestore();
    await assertFails(getDoc(doc(outsiderDb, 'families/family-1')));
    await assertFails(getDoc(doc(outsiderDb, 'families/family-1/routineAssignments/orthodontic-elastics')));
    await assertFails(getDoc(doc(parentDb, 'linkCodes/private-hash')));
  });
});

describe('check submission', () => {
  test('denies direct child check submissions so the server validates expiry', async () => {
    const childDb = environment.authenticatedContext('child').firestore();
    await assertFails(updateDoc(doc(childDb, 'families/family-1/checks/check-1'), {
      status: 'analyzing',
      capturedAt: new Date().toISOString(),
    }));
  });

  test('denies parent updates and extra child-controlled analysis fields', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    const childDb = environment.authenticatedContext('child').firestore();
    await assertFails(updateDoc(doc(parentDb, 'families/family-1/checks/check-1'), { status: 'analyzing' }));
    await assertFails(updateDoc(doc(childDb, 'families/family-1/checks/check-1'), {
      status: 'analyzing',
      capturedAt: new Date().toISOString(),
      confidence: 1,
    }));
  });

  test('denies all direct writes to family and user documents', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    await assertFails(updateDoc(doc(parentDb, 'families/family-1'), { childName: 'Changed' }));
    await assertFails(updateDoc(doc(parentDb, 'users/parent'), { role: 'child' }));
    await assertFails(updateDoc(doc(parentDb, 'families/family-1/routineAssignments/orthodontic-elastics'), { status: 'paused' }));
  });
});
