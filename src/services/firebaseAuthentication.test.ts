import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Auth, User } from 'firebase/auth';

const signInAnonymously = vi.fn();
const signInWithEmailAndPassword = vi.fn();

vi.mock('firebase/auth', () => ({ signInAnonymously, signInWithEmailAndPassword }));

const { authenticateFirebaseUser } = await import('./firebaseAuthentication');
const auth = {} as Auth;
const user = (properties: Partial<User>) => properties as User;

afterEach(() => {
  vi.clearAllMocks();
  delete globalThis.__ZADIAG_SYNTHETIC_MONITOR_AUTH__;
});

describe('Firebase authentication', () => {
  it('keeps the existing browser identity for regular users', async () => {
    const current = user({ uid: 'anonymous-1', isAnonymous: true });
    await expect(authenticateFirebaseUser(auth, current)).resolves.toBe(current);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('creates an anonymous identity for regular users without a session', async () => {
    const created = user({ uid: 'anonymous-2', isAnonymous: true });
    signInAnonymously.mockResolvedValue({ user: created });
    await expect(authenticateFirebaseUser(auth, null)).resolves.toBe(created);
  });

  it('signs the synthetic monitor into its permanent account', async () => {
    globalThis.__ZADIAG_SYNTHETIC_MONITOR_AUTH__ = {
      email: ' NEMU-MONITOR@EXAMPLE.INVALID ',
      password: 'a-private-password',
    };
    const permanent = user({ uid: 'monitor-1', email: 'nemu-monitor@example.invalid', isAnonymous: false });
    signInWithEmailAndPassword.mockResolvedValue({ user: permanent });
    await expect(authenticateFirebaseUser(auth, user({ uid: 'rotated-anonymous', isAnonymous: true }))).resolves.toBe(permanent);
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'nemu-monitor@example.invalid', 'a-private-password');
  });

  it('rejects incomplete synthetic credentials instead of falling back to anonymous auth', async () => {
    globalThis.__ZADIAG_SYNTHETIC_MONITOR_AUTH__ = { email: 'nemu@example.invalid', password: 'short' };
    await expect(authenticateFirebaseUser(auth, null)).rejects.toThrow('synthetic_monitor_auth_invalid');
    expect(signInAnonymously).not.toHaveBeenCalled();
  });
});
