import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';

const projectId = 'demo-zadiag-rules';
let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync(resolve('firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve('storage.rules'), 'utf8') },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'families/family-1'), {
      members: { owner: 'parent', participant: 'child', 'suspended-owner': 'parent' },
    });
    await setDoc(doc(db, 'participants/participant-1'), { status: 'active' });
    await setDoc(doc(db, 'participants/participant-1/memberships/owner'), {
      status: 'active', permissions: { reviewProofs: true },
    });
    await setDoc(doc(db, 'participants/participant-1/memberships/viewer'), {
      status: 'active', permissions: { view: true, reviewProofs: false },
    });
    await setDoc(doc(db, 'participants/participant-1/memberships/removed'), {
      status: 'suspended', permissions: { reviewProofs: true },
    });
    await setDoc(doc(db, 'userAccess/suspended-owner'), { status: 'suspended' });
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(ref(context.storage(), 'families/family-1/checks/check-1/proof.jpg'), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(context.storage(), 'participants/participant-1/checks/check-1/proof.jpg'), new Uint8Array([4, 5, 6]));
  });
});

describe('proof image isolation', () => {
  test('allows only active responsible accounts to read retained proofs', async () => {
    await assertSucceeds(getBytes(ref(environment.authenticatedContext('owner').storage(), 'families/family-1/checks/check-1/proof.jpg')));
    await assertSucceeds(getBytes(ref(environment.authenticatedContext('owner').storage(), 'participants/participant-1/checks/check-1/proof.jpg')));
    for (const uid of ['participant', 'suspended-owner', 'outsider']) {
      await assertFails(getBytes(ref(environment.authenticatedContext(uid).storage(), 'families/family-1/checks/check-1/proof.jpg')));
    }
    for (const uid of ['participant', 'viewer', 'removed', 'suspended-owner', 'outsider']) {
      await assertFails(getBytes(ref(environment.authenticatedContext(uid).storage(), 'participants/participant-1/checks/check-1/proof.jpg')));
    }
  });

  test('keeps all proof writes server-only', async () => {
    const ownerStorage = environment.authenticatedContext('owner').storage();
    await assertFails(uploadBytes(ref(ownerStorage, 'participants/participant-1/checks/check-2/proof.jpg'), new Uint8Array([7])));
  });
});

afterAll(async () => environment.cleanup());
