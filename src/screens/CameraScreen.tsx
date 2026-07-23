import type { MessageKey } from '../services/i18n';
import { CameraCapture } from '../components/CameraCapture';
import { AppIcon } from '../components/Icon';
import type { VerificationEvent } from '../domain/models';
import { PhotoChecklistSummary } from '../components/PhotoChecklistSummary';

export function CameraScreen({
  busy,
  event,
  back,
  submit,
  submitError,
  t,
}: {
  busy: boolean;
  event?: VerificationEvent;
  back: () => void;
  submit: (capturedAt: Date, imageDataUrl: string) => Promise<void>;
  submitError?: string;
  t: (key: MessageKey) => string;
}) {
  const checklist = event?.challenge?.response.kind === 'photo_checklist'
    ? event.challenge.response
    : undefined;
  return (
    <main className="camera-page">
      <header><button type="button" className="back-button light" onClick={back} aria-label={t('back')}><AppIcon name="chevron-back" /></button><h1>{t('guidedPhoto')}</h1></header>
      {checklist ? (
        <div className="camera-checklist-preview">
          <p>{checklist.prompt}</p>
          <PhotoChecklistSummary criteria={checklist.criteria} title={t('photoChecklistBeforeCapture')} t={t} />
          <small>{t('photoChecklistOnePhotoHint')}</small>
        </div>
      ) : null}
      <CameraCapture busy={busy} submitError={submitError} onSubmit={submit} t={t} />
    </main>
  );
}
