import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleAuth } from 'google-auth-library';
import webpush, { type PushSubscription } from 'web-push';
import { assertChildName, createLinkCode, createRecoveryCode, hashLinkCode, isFreshCheckSubmission, isLegacyRecoveryCode, isRecoveryCode, normalizeLinkCode } from './helpers.js';
import { analyzeWithGemini, type AnalysisResult } from './analysis.js';

initializeApp();
const db = getFirestore();
const region = 'europe-west1';
const vapidPrivateKey = defineSecret('WEB_PUSH_VAPID_PRIVATE_KEY');
const vapidPublicKey = defineSecret('WEB_PUSH_VAPID_PUBLIC_KEY');
const geminiAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/generative-language'],
});
const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
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
const recoveryLifetimeMs = 90 * 24 * 60 * 60 * 1000;
const createRecoveryRecord = (familyId: string, expiresAt: Date) => ({
  familyId,
  expiresAt: expiresAt.toISOString(),
  createdAt: new Date().toISOString(),
});

const recordRecoveryAttempt = async (uid: string) => {
  const attemptRef = db.collection('recoveryAttempts').doc(uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(attemptRef);
    const data = snapshot.data();
    const windowStartedAt = Date.parse(String(data?.windowStartedAt ?? ''));
    const inWindow = Number.isFinite(windowStartedAt) && Date.now() - windowStartedAt < 15 * 60 * 1000;
    const attempts = inWindow ? Number(data?.attempts ?? 0) : 0;
    if (attempts >= 5) throw new HttpsError('resource-exhausted', 'Too many recovery attempts. Try again later.');
    transaction.set(attemptRef, {
      attempts: attempts + 1,
      windowStartedAt: inWindow ? data?.windowStartedAt : new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
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
  const recoveryExpiresAt = new Date(now.getTime() + recoveryLifetimeMs);
  const recoveryRef = db.collection('parentRecoveryCodes').doc(hashLinkCode(recoveryCode));
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
      parentRecoveryCodeExpiresAt: recoveryExpiresAt.toISOString(),
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
    transaction.create(recoveryRef, createRecoveryRecord(familyRef.id, recoveryExpiresAt));
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
  if (!isRecoveryCode(code) && !isLegacyRecoveryCode(code)) throw new HttpsError('invalid-argument', 'The recovery code is invalid.');
  await recordRecoveryAttempt(uid);
  const userRef = db.collection('users').doc(uid);
  const recoveryRef = isRecoveryCode(code)
    ? db.collection('parentRecoveryCodes').doc(hashLinkCode(code))
    : undefined;
  const recovery = recoveryRef ? await recoveryRef.get() : undefined;
  const legacyFamilies = recoveryRef
    ? undefined
    : await db.collection('families').where('parentRecoveryCode', '==', code).limit(1).get();
  const familyId = recovery?.exists ? String(recovery.data()?.familyId ?? '') : legacyFamilies?.docs[0]?.id;
  const familyDoc = familyId ? await db.collection('families').doc(familyId).get() : undefined;
  if (!familyDoc?.exists) throw new HttpsError('not-found', 'The recovery code is invalid.');
  if (recovery && (!recovery.exists || Date.parse(String(recovery.data()?.expiresAt ?? '')) <= Date.now())) {
    throw new HttpsError('failed-precondition', 'The recovery code has expired.');
  }

  const familyRef = familyDoc.ref;
  const nextCode = createRecoveryCode();
  const nextExpiresAt = new Date(Date.now() + recoveryLifetimeMs);
  const nextRecoveryRef = db.collection('parentRecoveryCodes').doc(hashLinkCode(nextCode));
  await db.runTransaction(async (transaction) => {
    const [existingUser, family] = await Promise.all([transaction.get(userRef), transaction.get(familyRef)]);
    if (existingUser.exists && existingUser.data()?.familyId !== familyRef.id) {
      throw new HttpsError('already-exists', 'This account already belongs to a family.');
    }
    if (existingUser.exists && existingUser.data()?.role !== 'parent') {
      throw new HttpsError('already-exists', 'This device already uses the child profile.');
    }
    if (!family.exists) throw new HttpsError('not-found', 'The family could not be found.');
    const previousParentIds = Object.entries((family.data()?.members ?? {}) as Record<string, string>)
      .filter(([memberId, role]) => role === 'parent' && memberId !== uid)
      .map(([memberId]) => memberId);
    const familyUpdate: Record<string, unknown> = {
      [`members.${uid}`]: 'parent',
      parentRecoveryCode: nextCode,
      parentRecoveryCodeExpiresAt: nextExpiresAt.toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    previousParentIds.forEach((memberId) => { familyUpdate[`members.${memberId}`] = FieldValue.delete(); });
    transaction.update(familyRef, familyUpdate);
    previousParentIds.forEach((memberId) => transaction.delete(db.collection('users').doc(memberId)));
    transaction.set(userRef, {
      familyId: familyRef.id,
      role: 'parent',
      recoveredAt: new Date().toISOString(),
    });
    transaction.create(nextRecoveryRef, createRecoveryRecord(familyRef.id, nextExpiresAt));
    if (recoveryRef) transaction.delete(recoveryRef);
    transaction.delete(db.collection('recoveryAttempts').doc(uid));
  });
  return { familyId: familyRef.id, childName: String(familyDoc.data()?.childName ?? ''), recoveryCode: nextCode };
});

export const ensureParentRecoveryCode = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const familyRef = db.collection('families').doc(familyId);
  const profileRef = db.collection('users').doc(uid);
  const [family, profile] = await Promise.all([familyRef.get(), profileRef.get()]);
  if (!family.exists || !profile.exists || profile.data()?.familyId !== familyId) {
    throw new HttpsError('permission-denied', 'Only a family member can refresh the recovery code.');
  }
  const existingCode = String(family.data()?.parentRecoveryCode ?? '');
  const existingExpiry = Date.parse(String(family.data()?.parentRecoveryCodeExpiresAt ?? ''));
  if (isRecoveryCode(existingCode) && existingExpiry > Date.now()) return { recoveryCode: existingCode };

  const recoveryCode = createRecoveryCode();
  const expiresAt = new Date(Date.now() + recoveryLifetimeMs);
  const recoveryRef = db.collection('parentRecoveryCodes').doc(hashLinkCode(recoveryCode));
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(familyRef);
    const currentCode = String(current.data()?.parentRecoveryCode ?? '');
    const currentExpiry = Date.parse(String(current.data()?.parentRecoveryCodeExpiresAt ?? ''));
    if (isRecoveryCode(currentCode) && currentExpiry > Date.now()) return;
    transaction.update(familyRef, {
      parentRecoveryCode: recoveryCode,
      parentRecoveryCodeExpiresAt: expiresAt.toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(recoveryRef, createRecoveryRecord(familyId, expiresAt));
    if (isRecoveryCode(currentCode)) {
      transaction.delete(db.collection('parentRecoveryCodes').doc(hashLinkCode(currentCode)));
    }
  });
  const refreshed = await familyRef.get();
  return { recoveryCode: String(refreshed.data()?.parentRecoveryCode ?? recoveryCode) };
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
  const imageDataUrl = String(request.data?.imageDataUrl ?? '');
  const profile = await db.collection('users').doc(uid).get();
  if (!profile.exists || profile.data()?.familyId !== familyId || profile.data()?.role !== 'child') {
    throw new HttpsError('permission-denied', 'Only the linked child can submit this check.');
  }
  if (!imageDataUrl.startsWith('data:image/')) {
    throw new HttpsError('invalid-argument', 'A valid image is required.');
  }
  const checkRef = db.collection('families').doc(familyId).collection('checks').doc(checkId);
  const fallbackResult: Partial<AnalysisResult> = {
    status: 'uncertain',
    reason: 'analysis_unavailable',
  };
  let result: Partial<AnalysisResult> = fallbackResult;
  try {
    result = await analyzeWithGemini(imageDataUrl, {
      model: geminiModel,
      getAccessToken: () => geminiAuth.getAccessToken(),
    });
  } catch (error) {
    console.error('AI analysis failed, returning fallback result', error);
  }
  const analysisUpdate = {
    capturedAt,
    status: result.status ?? 'uncertain',
    analysisSource: result.reason === 'analysis_unavailable' ? 'fallback' : 'ai',
    ...(result.confidence !== undefined ? { confidence: result.confidence } : {}),
    ...(result.imageQuality !== undefined ? { imageQuality: result.imageQuality } : {}),
    ...(result.reason ? { reason: result.reason } : {}),
  };
  const response = await db.runTransaction(async (transaction) => {
    const check = await transaction.get(checkRef);
    const checkData = check.data();
    if (!check.exists || !checkData || !isFreshCheckSubmission(checkData, capturedAt)) {
      throw new HttpsError('failed-precondition', 'This check is expired, completed, or invalid.');
    }
    transaction.update(checkRef, analysisUpdate);
    transaction.update(db.collection('families').doc(familyId), {
      activeCheckId: FieldValue.delete(),
      activeCheckExpiresAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { id: check.id, ...checkData, ...analysisUpdate };
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
