import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
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
      members: { parent: 'parent', child: 'child', 'suspended-account': 'parent' },
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
    await setDoc(doc(db, 'users/suspended-account'), { familyId: 'family-1', role: 'parent' });
    await setDoc(doc(db, 'userAccess/suspended-account'), { contactEmail: 'blocked@example.com', status: 'suspended' });
    await setDoc(doc(db, 'linkCodes/private-hash'), { familyId: 'family-1' });
    await setDoc(doc(db, 'participants/participant-1'), { displayName: 'Maya', status: 'active' });
    await setDoc(doc(db, 'participants/participant-1/memberships/parent'), {
      uid: 'parent', role: 'owner', status: 'active', permissions: { view: true, manageRoutines: true },
    });
    await setDoc(doc(db, 'participants/participant-1/memberships/coparent'), {
      uid: 'coparent', role: 'caregiver', status: 'active', permissions: { view: true, manageRoutines: true },
    });
    await setDoc(doc(db, 'participants/participant-1/memberships/suspended'), {
      uid: 'suspended', role: 'caregiver', status: 'suspended', permissions: { view: true },
    });
    await setDoc(doc(db, 'participants/participant-1/checks/check-1'), { status: 'pending' });
    await setDoc(doc(db, 'participants/participant-1/routineAssignments/routine-1'), { status: 'active' });
    await setDoc(doc(db, 'participants/participant-1/routineDrafts/parent-draft'), { ownerId: 'parent', revision: 1 });
    await setDoc(doc(db, 'participants/participant-1/routineDrafts/coparent-draft'), { ownerId: 'coparent', revision: 1 });
    await setDoc(doc(db, 'participants/participant-1/pushSubscriptions/parent'), { endpoint: 'parent-device' });
    await setDoc(doc(db, 'participants/participant-1/pushSubscriptions/coparent'), { endpoint: 'coparent-device' });
    await setDoc(doc(db, 'users/parent/participantRefs/participant-1'), {
      participantId: 'participant-1', role: 'owner', status: 'active',
    });
    await setDoc(doc(db, 'participants/self-managed'), { displayName: 'Jordan', status: 'active', userId: 'jordan' });
    await setDoc(doc(db, 'participants/self-managed/memberships/jordan'), {
      uid: 'jordan', role: 'owner', label: 'self', status: 'active', permissions: { view: true },
    });
    await setDoc(doc(db, 'relationshipInvitations/private-invitation'), { participantId: 'participant-1' });
    await setDoc(doc(db, 'relationshipRecoveryCodes/private-recovery'), { participantId: 'participant-1' });
    await setDoc(doc(db, 'parentRecoveryCodes/private-parent-recovery'), { familyId: 'family-1' });
    await setDoc(doc(db, 'recoveryAttempts/parent'), { attempts: 2 });
    await setDoc(doc(db, 'auditEvents/private-audit'), { action: 'accept_relationship_invitation', actorUid: 'parent' });
    await setDoc(doc(db, 'routineCatalogEntries/catalog-entry'), { visibility: 'listed', moderationStatus: 'approved' });
    await setDoc(doc(db, 'routineShareCodes/private-share'), { entryId: 'catalog-entry' });
    await setDoc(doc(db, 'routineCatalogReports/private-report'), { entryId: 'catalog-entry', reporterUid: 'parent' });
    await setDoc(doc(db, 'routineRegistry/state'), { status: 'healthy' });
    await setDoc(doc(db, 'families/family-1/pushSubscriptions/parent'), { endpoint: 'legacy-parent-device' });
    await setDoc(doc(db, 'families/family-1/pushSubscriptions/child'), { endpoint: 'legacy-child-device' });
  });
});

describe('participant relationship isolation', () => {
  test('allows two active caregivers to read the same participant data', async () => {
    for (const uid of ['parent', 'coparent']) {
      const memberDb = environment.authenticatedContext(uid).firestore();
      await assertSucceeds(getDoc(doc(memberDb, 'participants/participant-1')));
      await assertSucceeds(getDocs(collection(memberDb, 'participants/participant-1/memberships')));
      await assertSucceeds(getDoc(doc(memberDb, 'participants/participant-1/checks/check-1')));
      await assertSucceeds(getDoc(doc(memberDb, 'participants/participant-1/routineAssignments/routine-1')));
    }
  });

  test('allows a self-managed owner to read their participant', async () => {
    const selfDb = environment.authenticatedContext('jordan').firestore();
    await assertSucceeds(getDoc(doc(selfDb, 'participants/self-managed')));
  });

  test('denies unrelated and suspended users', async () => {
    for (const uid of ['outsider', 'suspended']) {
      const deniedDb = environment.authenticatedContext(uid).firestore();
      await assertFails(getDoc(doc(deniedDb, 'participants/participant-1')));
      await assertFails(getDocs(collection(deniedDb, 'participants/participant-1/checks')));
    }
  });

  test('allows only the account owner to read participant indexes', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    const coparentDb = environment.authenticatedContext('coparent').firestore();
    await assertSucceeds(getDoc(doc(parentDb, 'users/parent/participantRefs/participant-1')));
    await assertFails(getDoc(doc(coparentDb, 'users/parent/participantRefs/participant-1')));
  });

  test('exposes routine drafts only to their active owner and keeps writes server-only', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    const coparentDb = environment.authenticatedContext('coparent').firestore();
    const suspendedDb = environment.authenticatedContext('suspended').firestore();
    const drafts = collection(parentDb, 'participants/participant-1/routineDrafts');

    await assertSucceeds(getDoc(doc(drafts, 'parent-draft')));
    await assertSucceeds(getDocs(query(drafts, where('ownerId', '==', 'parent'))));
    await assertSucceeds(getDoc(doc(coparentDb, 'participants/participant-1/routineDrafts/coparent-draft')));
    await assertFails(getDocs(drafts));
    await assertFails(getDoc(doc(coparentDb, 'participants/participant-1/routineDrafts/parent-draft')));
    await assertFails(getDoc(doc(suspendedDb, 'participants/participant-1/routineDrafts/parent-draft')));
    await assertFails(updateDoc(doc(drafts, 'parent-draft'), { revision: 2 }));
    await assertFails(deleteDoc(doc(drafts, 'parent-draft')));
  });

  test('denies all direct relationship writes and invitation reads', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    await assertFails(updateDoc(doc(parentDb, 'participants/participant-1'), { displayName: 'Changed' }));
    await assertFails(updateDoc(doc(parentDb, 'participants/participant-1/memberships/coparent'), { role: 'owner' }));
    await assertFails(getDoc(doc(parentDb, 'relationshipInvitations/private-invitation')));
  });

  test('keeps every bearer code, recovery attempt, and audit event server-only', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    for (const path of [
      'linkCodes/private-hash',
      'parentRecoveryCodes/private-parent-recovery',
      'relationshipInvitations/private-invitation',
      'relationshipRecoveryCodes/private-recovery',
      'recoveryAttempts/parent',
      'auditEvents/private-audit',
    ]) {
      await assertFails(getDoc(doc(parentDb, path)));
      await assertFails(setDoc(doc(parentDb, path), { tampered: true }));
      await assertFails(deleteDoc(doc(parentDb, path)));
    }
  });

  test('keeps marketplace, registry, share codes, and reports behind callable functions', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    for (const path of [
      'routineCatalogEntries/catalog-entry',
      'routineShareCodes/private-share',
      'routineCatalogReports/private-report',
      'routineRegistry/state',
    ]) {
      await assertFails(getDoc(doc(parentDb, path)));
      await assertFails(setDoc(doc(parentDb, path), { tampered: true }));
      await assertFails(deleteDoc(doc(parentDb, path)));
    }
    await assertFails(getDocs(collection(parentDb, 'routineCatalogEntries')));
    await assertFails(getDocs(collection(parentDb, 'routineCatalogReports')));
  });

  test('exposes only the signed-in member own push registration', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    await assertSucceeds(getDoc(doc(parentDb, 'participants/participant-1/pushSubscriptions/parent')));
    await assertFails(getDoc(doc(parentDb, 'participants/participant-1/pushSubscriptions/coparent')));
    await assertFails(getDocs(collection(parentDb, 'participants/participant-1/pushSubscriptions')));
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

  test('allows family members to run client collection queries for routines and checks', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    await assertSucceeds(getDocs(query(
      collection(parentDb, 'families/family-1/routineAssignments'),
      orderBy('assignedAt', 'asc'),
    )));
    await assertSucceeds(getDocs(query(
      collection(parentDb, 'families/family-1/checks'),
      orderBy('requestedAt', 'desc'),
    )));
  });

  test('denies outsiders and hides linking documents', async () => {
    const outsiderDb = environment.authenticatedContext('outsider').firestore();
    const parentDb = environment.authenticatedContext('parent').firestore();
    await assertFails(getDoc(doc(outsiderDb, 'families/family-1')));
    await assertFails(getDoc(doc(outsiderDb, 'families/family-1/routineAssignments/orthodontic-elastics')));
    await assertFails(getDocs(collection(outsiderDb, 'families/family-1/checks')));
    await assertFails(getDoc(doc(parentDb, 'linkCodes/private-hash')));
  });

  test('lets a suspended account see only its own suspension profile', async () => {
    const suspendedDb = environment.authenticatedContext('suspended-account').firestore();
    await assertSucceeds(getDoc(doc(suspendedDb, 'userAccess/suspended-account')));
    await assertFails(getDoc(doc(suspendedDb, 'families/family-1')));
  });

  test('keeps legacy family device endpoints private to their owner', async () => {
    const parentDb = environment.authenticatedContext('parent').firestore();
    await assertSucceeds(getDoc(doc(parentDb, 'families/family-1/pushSubscriptions/parent')));
    await assertFails(getDoc(doc(parentDb, 'families/family-1/pushSubscriptions/child')));
    await assertFails(getDocs(collection(parentDb, 'families/family-1/pushSubscriptions')));
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
