import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { assertChildName, createLinkCode, hashLinkCode, normalizeLinkCode } from './helpers.js';

initializeApp();
const db = getFirestore();
const region = 'europe-west1';
const cors = [
  'https://zadiag.vercel.app',
  'https://zadiag.com',
  'https://www.zadiag.com',
  /^https:\/\/zadiag-.*\.vercel\.app$/,
  'http://localhost:5173',
];

const requireUid = (auth: { uid: string } | undefined) => {
  if (!auth) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return auth.uid;
};

const defaultPlan = {
  checksPerDay: 3,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  windows: [
    { id: 'morning', start: '07:30', end: '09:30' },
    { id: 'midday', start: '12:00', end: '14:00' },
    { id: 'evening', start: '17:00', end: '20:00' },
  ],
  expiryMinutes: 20,
  timeZone: 'Europe/Paris',
};

export const createFamily = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  let childName: string;
  try { childName = assertChildName(request.data?.childName); }
  catch { throw new HttpsError('invalid-argument', 'A valid child name is required.'); }

  const familyRef = db.collection('families').doc();
  const userRef = db.collection('users').doc(uid);
  const checkRef = familyRef.collection('checks').doc();
  const code = createLinkCode();
  const linkRef = db.collection('linkCodes').doc(hashLinkCode(code));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const checkExpiresAt = new Date(now.getTime() + defaultPlan.expiryMinutes * 60 * 1000);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(userRef);
    if (existing.exists) throw new HttpsError('already-exists', 'This account already belongs to a family.');
    transaction.create(familyRef, {
      childName,
      members: { [uid]: 'parent' },
      plan: defaultPlan,
      activeCheckId: checkRef.id,
      activeCheckExpiresAt: checkExpiresAt.toISOString(),
      createdAt: now.toISOString(),
    });
    transaction.create(userRef, {
      familyId: familyRef.id,
      role: 'parent',
      linkingCode: code,
      linkingCodeExpiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    });
    transaction.create(linkRef, {
      familyId: familyRef.id,
      createdBy: uid,
      expiresAt: expiresAt.toISOString(),
      consumedAt: null,
    });
    transaction.create(checkRef, {
      sessionId: crypto.randomUUID(),
      requestedAt: now.toISOString(),
      expiresAt: checkExpiresAt.toISOString(),
      status: 'pending',
    });
  });
  return { familyId: familyRef.id, code, expiresAt: expiresAt.toISOString() };
});

export const joinFamily = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const code = normalizeLinkCode(String(request.data?.code ?? ''));
  if (!/^ZD-\d{6}$/.test(code)) throw new HttpsError('invalid-argument', 'The linking code is invalid.');
  const linkRef = db.collection('linkCodes').doc(hashLinkCode(code));
  const userRef = db.collection('users').doc(uid);

  const familyId = await db.runTransaction(async (transaction) => {
    const [link, existingUser] = await Promise.all([transaction.get(linkRef), transaction.get(userRef)]);
    if (existingUser.exists) throw new HttpsError('already-exists', 'This account already belongs to a family.');
    if (!link.exists) throw new HttpsError('not-found', 'The linking code is invalid.');
    const data = link.data();
    if (!data) throw new HttpsError('not-found', 'The linking code is invalid.');
    if (data.consumedAt || Date.parse(data.expiresAt) <= Date.now()) {
      throw new HttpsError('failed-precondition', 'The linking code has expired or was already used.');
    }
    const targetFamilyId = String(data.familyId);
    const familyRef = db.collection('families').doc(targetFamilyId);
    transaction.update(familyRef, { [`members.${uid}`]: 'child', updatedAt: FieldValue.serverTimestamp() });
    transaction.create(userRef, { familyId: targetFamilyId, role: 'child', createdAt: new Date().toISOString() });
    transaction.update(linkRef, { consumedAt: new Date().toISOString(), consumedBy: uid });
    return targetFamilyId;
  });
  return { familyId };
});

export const regenerateLinkCode = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const userRef = db.collection('users').doc(uid);
  const familyRef = db.collection('families').doc(familyId);
  const [profile, family, links] = await Promise.all([
    userRef.get(),
    familyRef.get(),
    db.collection('linkCodes').where('familyId', '==', familyId).get(),
  ]);

  if (!profile.exists || profile.data()?.familyId !== familyId || profile.data()?.role !== 'parent') {
    throw new HttpsError('permission-denied', 'Only the parent can generate a new linking code.');
  }
  if (!family.exists || family.data()?.members?.[uid] !== 'parent') {
    throw new HttpsError('not-found', 'The family could not be found.');
  }

  const childIds = Object.entries((family.data()?.members ?? {}) as Record<string, string>)
    .filter(([, role]) => role === 'child')
    .map(([memberId]) => memberId);
  const code = createLinkCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const linkRef = db.collection('linkCodes').doc(hashLinkCode(code));
  const familyUpdate: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  childIds.forEach((childId) => { familyUpdate[`members.${childId}`] = FieldValue.delete(); });

  const batch = db.batch();
  links.docs.forEach((link) => batch.delete(link.ref));
  childIds.forEach((childId) => batch.delete(db.collection('users').doc(childId)));
  batch.update(familyRef, familyUpdate);
  batch.update(userRef, {
    linkingCode: code,
    linkingCodeExpiresAt: expiresAt.toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.create(linkRef, {
    familyId,
    createdBy: uid,
    expiresAt: expiresAt.toISOString(),
    consumedAt: null,
  });
  await batch.commit();

  return { code, expiresAt: expiresAt.toISOString() };
});

export const requestCheckNow = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const familyRef = db.collection('families').doc(familyId);
  const userRef = db.collection('users').doc(uid);
  const checkRef = familyRef.collection('checks').doc();
  const pendingChecks = familyRef.collection('checks').where('status', '==', 'pending').limit(10);

  return db.runTransaction(async (transaction) => {
    const [profile, family, pending] = await Promise.all([
      transaction.get(userRef),
      transaction.get(familyRef),
      transaction.get(pendingChecks),
    ]);
    if (!profile.exists || profile.data()?.familyId !== familyId || profile.data()?.role !== 'parent') {
      throw new HttpsError('permission-denied', 'Only the parent can request a check.');
    }
    if (!family.exists || family.data()?.members?.[uid] !== 'parent') {
      throw new HttpsError('not-found', 'The family could not be found.');
    }

    const familyData = family.data();
    const activeExpiry = Date.parse(String(familyData?.activeCheckExpiresAt ?? ''));
    const hasActivePendingCheck = pending.docs.some((check) => Date.parse(String(check.data().expiresAt)) > Date.now());
    if ((Number.isFinite(activeExpiry) && activeExpiry > Date.now()) || hasActivePendingCheck) {
      throw new HttpsError('already-exists', 'A check is already waiting for a response.');
    }

    const configuredMinutes = Number(familyData?.plan?.expiryMinutes);
    const expiryMinutes = Number.isFinite(configuredMinutes)
      ? Math.min(120, Math.max(1, configuredMinutes))
      : defaultPlan.expiryMinutes;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);
    const check = {
      sessionId: crypto.randomUUID(),
      requestedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
      requestedBy: uid,
    };

    transaction.create(checkRef, check);
    transaction.update(familyRef, {
      activeCheckId: checkRef.id,
      activeCheckExpiresAt: expiresAt.toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { id: checkRef.id, ...check };
  });
});

export const updatePlan = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const profile = await db.collection('users').doc(uid).get();
  if (!profile.exists || profile.data()?.familyId !== familyId || profile.data()?.role !== 'parent') {
    throw new HttpsError('permission-denied', 'Only the parent can update this plan.');
  }
  await db.collection('families').doc(familyId).update({ plan: request.data.plan, updatedAt: FieldValue.serverTimestamp() });
});

export const analyzeCheck = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const checkId = String(request.data?.checkId ?? '');
  const profile = await db.collection('users').doc(uid).get();
  if (!profile.exists || profile.data()?.familyId !== familyId || profile.data()?.role !== 'child') {
    throw new HttpsError('permission-denied', 'Only the linked child can submit this check.');
  }
  const checkRef = db.collection('families').doc(familyId).collection('checks').doc(checkId);
  const check = await checkRef.get();
  if (!check.exists || check.data()?.status !== 'analyzing') {
    throw new HttpsError('failed-precondition', 'This check cannot be analyzed.');
  }
  const result = { status: 'detected', confidence: 0.94, imageQuality: 0.91 };
  const batch = db.batch();
  batch.update(checkRef, result);
  batch.update(db.collection('families').doc(familyId), {
    activeCheckId: FieldValue.delete(),
    activeCheckExpiresAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { id: check.id, ...check.data(), ...result };
});

export const deleteAccountData = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const userRef = db.collection('users').doc(uid);
  const profile = await userRef.get();
  if (!profile.exists) return;
  const { familyId, role } = profile.data() as { familyId: string; role: 'parent' | 'child' };
  const familyRef = db.collection('families').doc(familyId);

  if (role === 'child') {
    await Promise.all([
      familyRef.update({ [`members.${uid}`]: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }),
      userRef.delete(),
    ]);
    return;
  }

  const family = await familyRef.get();
  const memberIds = Object.keys((family.data()?.members ?? {}) as Record<string, string>);
  const links = await db.collection('linkCodes').where('familyId', '==', familyId).get();
  const batch = db.batch();
  memberIds.forEach((memberId) => batch.delete(db.collection('users').doc(memberId)));
  links.docs.forEach((link) => batch.delete(link.ref));
  await batch.commit();
  await db.recursiveDelete(familyRef);
});
