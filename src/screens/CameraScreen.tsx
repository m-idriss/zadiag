import type { MessageKey } from '../services/i18n';
import { CameraCapture } from '../components/CameraCapture';
import { AppIcon } from '../components/Icon';

export function CameraScreen({
  busy,
  back,
  submit,
  submitError,
  t,
}: {
  busy: boolean;
  back: () => void;
  submit: (capturedAt: Date, imageDataUrl: string) => Promise<void>;
  submitError?: string;
  t: (key: MessageKey) => string;
}) {
  return (
    <main className="camera-page">
      <header><button type="button" className="back-button light" onClick={back} aria-label={t('back')}><AppIcon name="chevron-back" /></button><h1>{t('guidedPhoto')}</h1></header>
      <CameraCapture busy={busy} submitError={submitError} onSubmit={submit} t={t} />
    </main>
  );
}
