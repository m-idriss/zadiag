import type { MessageKey } from '../services/i18n';
import { CameraCapture } from '../components/CameraCapture';

export function CameraScreen({
  busy,
  back,
  submit,
  t,
}: {
  busy: boolean;
  back: () => void;
  submit: (capturedAt: Date, imageDataUrl: string) => Promise<void>;
  t: (key: MessageKey) => string;
}) {
  return (
    <main className="camera-page">
      <header><button className="back-button light" onClick={back}>‹</button><h1>{t('guidedPhoto')}</h1></header>
      <CameraCapture busy={busy} onSubmit={submit} t={t} />
    </main>
  );
}
