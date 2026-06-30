import { useMemo, useState } from 'react';
import { IonApp } from '@ionic/react';
import type { Role, VerificationEvent } from './domain/models';
import { DemoRepository } from './services/demoRepository';
import { translate, type MessageKey } from './services/i18n';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LinkScreen } from './screens/LinkScreen';
import { ParentDashboard } from './screens/ParentDashboard';
import { ChildDashboard } from './screens/ChildDashboard';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CameraScreen } from './screens/CameraScreen';
import { ResultScreen } from './screens/ResultScreen';
import { BottomNav, type Tab } from './components/BottomNav';

type Route = 'welcome' | 'link' | 'app' | 'camera' | 'result';

export function App() {
  const repository = useMemo(() => new DemoRepository(), []);
  const [state, setState] = useState(repository.snapshot());
  const [route, setRoute] = useState<Route>(state.role ? (state.family.linked ? 'app' : 'link') : 'welcome');
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerificationEvent>();
  const t = (key: MessageKey) => translate(state.locale, key);

  const sync = () => setState(repository.snapshot());
  const selectRole = (role: Role) => {
    repository.selectRole(role);
    sync();
    setRoute('link');
  };

  const submit = async (capturedAt: Date) => {
    const session = repository.activeSession();
    if (!session) return;
    setBusy(true);
    try {
      const event = await repository.submitCapture(session.sessionId, capturedAt);
      sync();
      setResult(event);
      setRoute('result');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    repository.reset();
    sync();
    setRoute('welcome');
    setTab('home');
  };

  let content: React.ReactNode;
  if (route === 'welcome') {
    content = (
      <WelcomeScreen
        locale={state.locale}
        setLocale={(locale) => { repository.setLocale(locale); sync(); }}
        chooseRole={selectRole}
        t={t}
      />
    );
  } else if (route === 'link' && state.role) {
    content = (
      <LinkScreen
        role={state.role}
        code={state.family.linkingCode}
        childName={state.family.childName}
        back={() => setRoute('welcome')}
        onParentLink={(name) => { repository.linkParent(name); sync(); setRoute('app'); }}
        onChildLink={(code) => { repository.linkChild(code); sync(); setRoute('app'); }}
        t={t}
      />
    );
  } else if (route === 'camera') {
    content = <CameraScreen busy={busy} back={() => setRoute('app')} submit={submit} t={t} />;
  } else if (route === 'result' && result) {
    content = <ResultScreen event={result} done={() => { setResult(undefined); setRoute('app'); }} t={t} />;
  } else {
    const role = state.role ?? 'child';
    const screen = tab === 'history'
      ? <HistoryScreen events={state.events} t={t} />
      : tab === 'settings'
        ? <SettingsScreen reset={reset} t={t} />
        : role === 'parent'
          ? <ParentDashboard state={state} t={t} />
          : <ChildDashboard state={state} active={repository.activeSession()} start={() => setRoute('camera')} t={t} />;
    content = <div className="app-shell">{screen}<BottomNav tab={tab} role={role} onChange={setTab} t={t} /></div>;
  }

  return <IonApp>{content}</IonApp>;
}
