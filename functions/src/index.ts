import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import webpush, { type PushSubscription } from 'web-push';
import { assertChildName, createLinkCode, createRecoveryCode, hashLinkCode, isFreshCheckSubmission, normalizeLinkCode } from './helpers.js';

initializeApp();
const db = getFirestore();
const region = 'europe-west1';
const vapidPrivateKey = defineSecret('WEB_PUSH_VAPID_PRIVATE_KEY');
const vapidPublicKey = defineSecret('WEB_PUSH_VAPID_PUBLIC_KEY');
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
  const recoveryCode = createRecoveryCode();
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
      parentRecoveryCode: recoveryCode,
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
  return { familyId: familyRef.id, code, recoveryCode, expiresAt: expiresAt.toISOString() };
});

export const recoverParent = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const code = normalizeLinkCode(String(request.data?.code ?? ''));
  if (!/^PR-\d{6}$/.test(code)) throw new HttpsError('invalid-argument', 'The recovery code is invalid.');
  const userRef = db.collection('users').doc(uid);
  const families = await db.collection('families').where('parentRecoveryCode', '==', code).limit(1).get();
  const familyDoc = families.docs[0];
  if (!familyDoc) throw new HttpsError('not-found', 'The recovery code is invalid.');

  const familyRef = familyDoc.ref;
  await db.runTransaction(async (transaction) => {
    const [existingUser, family] = await Promise.all([transaction.get(userRef), transaction.get(familyRef)]);
    if (existingUser.exists && existingUser.data()?.familyId === familyRef.id && existingUser.data()?.role === 'parent') {
      return;
    }
    if (existingUser.exists && existingUser.data()?.familyId !== familyRef.id) {
      throw new HttpsError('already-exists', 'This account already belongs to a family.');
    }
    if (!family.exists) throw new HttpsError('not-found', 'The family could not be found.');
    transaction.update(familyRef, { [`members.${uid}`]: 'parent', updatedAt: FieldValue.serverTimestamp() });
    transaction.set(userRef, {
      familyId: familyRef.id,
      role: 'parent',
      recoveredAt: new Date().toISOString(),
    });
  });
  return { familyId: familyRef.id, childName: String(familyDoc.data().childName ?? '') };
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

export const savePushSubscription = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const subscription = request.data?.subscription as Partial<PushSubscription> | undefined;
  const endpoint = String(subscription?.endpoint ?? '');
  const p256dh = String(subscription?.keys?.p256dh ?? '');
  const auth = String(subscription?.keys?.auth ?? '');
  const locale = request.data?.locale === 'fr' ? 'fr' : 'en';
  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    throw new HttpsError('invalid-argument', 'A valid push subscription is required.');
  }

  const profile = await db.collection('users').doc(uid).get();
  if (!profile.exists || profile.data()?.familyId !== familyId || profile.data()?.role !== 'child') {
    throw new HttpsError('permission-denied', 'Only the linked child can enable notifications.');
  }

  const subscriptionRef = db.collection('families').doc(familyId).collection('pushSubscriptions').doc(uid);
  const batch = db.batch();
  batch.set(subscriptionRef, {
    endpoint,
    keys: { p256dh, auth },
    locale,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(profile.ref, { notificationsEnabled: true, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
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
  childIds.forEach((childId) => batch.delete(familyRef.collection('pushSubscriptions').doc(childId)));
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

export const requestCheckNow = onCall({
  region,
  cors,
  enforceAppCheck: true,
  secrets: [vapidPrivateKey, vapidPublicKey],
}, async (request) => {
  type RequestedCheck = {
    id: string;
    sessionId: string;
    requestedAt: string;
    expiresAt: string;
    status: string;
    requestedBy?: string;
  };
  type RequestCheckResult = { check: RequestedCheck; resend: boolean };
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const familyRef = db.collection('families').doc(familyId);
  const userRef = db.collection('users').doc(uid);
  const checkRef = familyRef.collection('checks').doc();
  const pendingChecks = familyRef.collection('checks').where('status', '==', 'pending').limit(10);

  const { check, resend } = await db.runTransaction(async (transaction): Promise<RequestCheckResult> => {
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
    const activePendingCheck = pending.docs.find((doc) => Date.parse(String(doc.data().expiresAt)) > Date.now());
    if (Number.isFinite(activeExpiry) && activeExpiry > Date.now() && activePendingCheck) {
      return { check: { id: activePendingCheck.id, ...activePendingCheck.data() } as RequestedCheck, resend: true };
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
    return { check: { id: checkRef.id, ...check }, resend: false };
  });

  const subscriptions = await familyRef.collection('pushSubscriptions').get();
  if (!subscriptions.empty) {
    webpush.setVapidDetails('https://www.zadiag.com', vapidPublicKey.value(), vapidPrivateKey.value());
    await Promise.allSettled(subscriptions.docs.map(async (document) => {
      const subscription = document.data() as PushSubscription & { locale?: string };
      const isFrench = subscription.locale === 'fr';
      try {
        await webpush.sendNotification(subscription, JSON.stringify({
          sessionId: check.sessionId,
          title: 'Zadiag',
         body: resend
           ? (isFrench ? 'Un rappel est prêt.' : 'A reminder is ready.')
           : (isFrench ? 'Un contrôle rapide est prêt.' : 'A quick check is ready.'),
       }), { TTL: 120 });
     } catch (error) {
       const statusCode = (error as { statusCode?: number }).statusCode;
       if (statusCode === 404 || statusCode === 410) await document.ref.delete();
       else console.error('Unable to send Web Push notification', error);
     }
    }));
  }
  return check;
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
  const capturedAt = String(request.data?.capturedAt ?? '');
  const profile = await db.collection('users').doc(uid).get();
  if (!profile.exists || profile.data()?.familyId !== familyId || profile.data()?.role !== 'child') {
    throw new HttpsError('permission-denied', 'Only the linked child can submit this check.');
  }
  const checkRef = db.collection('families').doc(familyId).collection('checks').doc(checkId);
  const result = { status: 'detected', confidence: 0.94, imageQuality: 0.91 };
  const response = await db.runTransaction(async (transaction) => {
    const check = await transaction.get(checkRef);
    const checkData = check.data();
    if (!check.exists || !checkData || !isFreshCheckSubmission(checkData, capturedAt)) {
      throw new HttpsError('failed-precondition', 'This check is expired, completed, or invalid.');
    }
    transaction.update(checkRef, { ...result, capturedAt });
    transaction.update(db.collection('families').doc(familyId), {
      activeCheckId: FieldValue.delete(),
      activeCheckExpiresAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { id: check.id, ...checkData, capturedAt, ...result };
  });
  return response;
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
      familyRef.collection('pushSubscriptions').doc(uid).delete(),
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
