import type { AppRepository } from './contracts';
import { DemoRepository } from './demoRepository';
import { firebaseEnabled } from './firebaseClient';
import { FirebaseRepository } from './firebaseRepository';

export const createRepository = (): AppRepository => firebaseEnabled
  ? new FirebaseRepository()
  : new DemoRepository();
