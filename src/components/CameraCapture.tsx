import { useEffect, useRef, useState } from 'react';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { camera, checkmark, refresh } from 'ionicons/icons';
import type { MessageKey } from '../services/i18n';

interface CameraCaptureProps {
  t: (key: MessageKey) => string;
  busy: boolean;
  submitError?: string;
  onSubmit: (capturedAt: Date, imageDataUrl: string) => Promise<void>;
}

export function CameraCapture({ t, busy, submitError, onSubmit }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const [preview, setPreview] = useState<string>();
  const [capturedAt, setCapturedAt] = useState<Date>();
  const [error, setError] = useState<string>();
  const [opening, setOpening] = useState(false);

  useEffect(() => () => stopCamera(), []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
  };

  const openCamera = async () => {
    setError(undefined);
    setOpening(true);
    setPreview(undefined);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError(t('requestCamera'));
    } finally {
      setOpening(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const canvas = document.createElement('canvas');
    const maxSide = 960;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const timestamp = new Date();
    setCapturedAt(timestamp);
    setPreview(canvas.toDataURL('image/jpeg', 0.72));
    stopCamera();
  };

  return (
    <div className="camera-flow">
      <div className="camera-viewport">
        {preview ? (
          <img className="camera-preview" src={preview} alt="Fresh camera capture" />
        ) : (
          <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
        )}
        {!preview && (
          <div className="mouth-guide" aria-hidden="true">
            <span>{t('centerMouth')}</span>
            <div className="mouth-oval" />
          </div>
        )}
      </div>

      <div className="camera-hints">
        <span>☀️ {t('goodLight')}</span>
        <span>🙂 {t('mouthOpen')}</span>
        <span>◎ {t('stayStill')}</span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {!streamRef.current && !preview && (
        <IonButton expand="block" color="light" disabled={opening} onClick={openCamera}>
          {opening ? <IonSpinner name="crescent" /> : <IonIcon icon={camera} slot="start" />}
          {t('openCamera')}
        </IonButton>
      )}

      {streamRef.current && !preview && (
        <button className="shutter" type="button" onClick={capture} aria-label={t('usePhoto')}>
          <span />
        </button>
      )}

      {preview && capturedAt && (
        <div className="camera-actions">
          <IonButton fill="outline" color="light" disabled={busy} onClick={openCamera}>
            <IonIcon icon={refresh} slot="start" />{t('retake')}
          </IonButton>
          <IonButton disabled={busy} onClick={() => void onSubmit(capturedAt, preview)}>
            {busy ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmark} slot="start" />}
            {busy ? t('analyzing') : t('usePhoto')}
          </IonButton>
        </div>
      )}
      {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}
      <small className="camera-only">{t('cameraOnly')}</small>
    </div>
  );
}
