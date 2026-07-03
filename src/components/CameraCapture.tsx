import { useEffect, useRef, useState } from 'react';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { camera, checkmark, refresh } from 'ionicons/icons';
import type { MessageKey } from '../services/i18n';
import { hasSeenCameraGuidance, markCameraGuidanceSeen } from '../services/cameraPreferences';

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
  const [localCheckError, setLocalCheckError] = useState<string>();
  const [localCheckWarning, setLocalCheckWarning] = useState<string>();
  const [opening, setOpening] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState | 'unknown'>('unknown');
  const [cameraGuidanceSeen, setCameraGuidanceSeen] = useState(hasSeenCameraGuidance());
  const autoOpenedRef = useRef(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
  };

  const openCamera = async () => {
    autoOpenedRef.current = true;
    setError(undefined);
    setLocalCheckError(undefined);
    setLocalCheckWarning(undefined);
    setOpening(true);
    setPreview(undefined);
    setCapturedAt(undefined);
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
      setPermissionState('granted');
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      if (denied) setPermissionState('denied');
      setError(denied ? t('cameraPermissionDenied') : t('requestCamera'));
    } finally {
      setOpening(false);
    }
  };

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    let alive = true;
    const permissionApi = navigator.permissions;
    if (!permissionApi?.query) return () => { alive = false; };
    let statusRef: PermissionStatus | undefined;
    const updateFromStatus = (state: PermissionState) => {
      if (!alive) return;
      setPermissionState(state);
      if (state === 'denied') setError(t('cameraPermissionDenied'));
      if (state === 'granted' && cameraGuidanceSeen && !autoOpenedRef.current && !preview && !streamRef.current) {
        void openCamera();
      }
    };
    permissionApi.query({ name: 'camera' as PermissionName }).then((status) => {
      statusRef = status;
      updateFromStatus(status.state);
      status.onchange = () => updateFromStatus(status.state);
    }).catch(() => {
      setPermissionState('unknown');
    });
    return () => {
      alive = false;
      if (statusRef) statusRef.onchange = null;
    };
  }, [cameraGuidanceSeen, preview, t]);

  const startCamera = async () => {
    if (!cameraGuidanceSeen) {
      markCameraGuidanceSeen();
      setCameraGuidanceSeen(true);
    }
    await openCamera();
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
    setLocalCheckError(undefined);
    setLocalCheckWarning(undefined);
    setPreview(canvas.toDataURL('image/jpeg', 0.72));
    stopCamera();
  };

  const analyzePreview = async (dataUrl: string): Promise<{ message: string; blocked: boolean } | null> => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();

    const width = 320;
    const height = Math.max(1, Math.round((image.height / image.width) * width));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);

    const pixels = context.getImageData(0, 0, width, height).data;
    let luminanceSum = 0;
    let luminanceSquaredSum = 0;
    let edgeSum = 0;
    let edgeSamples = 0;
    let skinLike = 0;
    let skinSamples = 0;
    const centerMarginX = Math.round(width * 0.22);
    const centerMarginY = Math.round(height * 0.18);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
        luminanceSum += luminance;
        luminanceSquaredSum += luminance * luminance;

        if (x > 0 && y > 0) {
          const leftIndex = (y * width + (x - 1)) * 4;
          const topIndex = (((y - 1) * width) + x) * 4;
          const leftLum = (0.299 * pixels[leftIndex]) + (0.587 * pixels[leftIndex + 1]) + (0.114 * pixels[leftIndex + 2]);
          const topLum = (0.299 * pixels[topIndex]) + (0.587 * pixels[topIndex + 1]) + (0.114 * pixels[topIndex + 2]);
          edgeSum += Math.abs(luminance - leftLum) + Math.abs(luminance - topLum);
          edgeSamples += 2;
        }

        if (x >= centerMarginX && x <= width - centerMarginX && y >= centerMarginY && y <= height - centerMarginY) {
          const yValue = luminance;
          const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
          const isSkin = yValue > 60 && yValue < 235 && cb > 77 && cb < 135 && cr > 135 && cr < 180;
          skinSamples += 1;
          if (isSkin) skinLike += 1;
        }
      }
    }

    const totalSamples = width * height;
    const brightness = luminanceSum / totalSamples;
    const variance = Math.max(0, (luminanceSquaredSum / totalSamples) - (brightness * brightness));
    const contrast = Math.sqrt(variance);
    const edgeStrength = edgeSamples === 0 ? 0 : edgeSum / edgeSamples;
    const skinRatio = skinSamples === 0 ? 0 : skinLike / skinSamples;

    try {
      type FaceDetectorInstance = { detect: (input: HTMLImageElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>> };
      type FaceDetectorCtor = new () => FaceDetectorInstance;
      const faceDetectorCtor = typeof globalThis !== 'undefined' && 'FaceDetector' in globalThis
        ? (globalThis as typeof globalThis & { FaceDetector?: FaceDetectorCtor }).FaceDetector
        : undefined;
      const faceDetector = faceDetectorCtor ? new faceDetectorCtor() : undefined;
      if (faceDetector) {
        const faces = await faceDetector.detect(image);
        const largestFace = faces.reduce((largest, face) => {
          const area = face.boundingBox.width * face.boundingBox.height;
          return Math.max(largest, area);
        }, 0);
        const faceRatio = largestFace / (width * height);
        if (faces.length === 0 || faceRatio < 0.06) return { message: t('localPhotoCheckFaceMissing'), blocked: true };
      }
    } catch {
      // fall back to heuristics below
    }

    if (brightness < 52) return { message: t('localPhotoCheckTooDark'), blocked: true };
    if (brightness > 218) return { message: t('localPhotoCheckTooBright'), blocked: true };
    if (contrast < 22 || edgeStrength < 6) return { message: t('localPhotoCheckTooBlurry'), blocked: false };
    if (skinRatio < 0.05) return { message: t('localPhotoCheckFaceMissing'), blocked: true };
    return null;
  };

  const submitPreview = async () => {
    if (!preview || !capturedAt) return;
    setError(undefined);
    setLocalCheckError(undefined);
    setLocalCheckWarning(undefined);
    const localError = await analyzePreview(preview);
    if (localError?.blocked) {
      setLocalCheckError(localError.message);
      return;
    }
    if (localError?.message) setLocalCheckWarning(localError.message);
    await onSubmit(capturedAt, preview);
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

      {!preview && !streamRef.current && !cameraGuidanceSeen ? (
        <section className="card camera-intro" aria-labelledby="camera-intro-title">
          <h2 id="camera-intro-title">{t('cameraGuideTitle')}</h2>
          <p>{t('cameraGuideBody')}</p>
          <IonButton expand="block" disabled={opening} onClick={() => { void startCamera(); }}>
            {opening ? <IonSpinner name="crescent" /> : <IonIcon icon={camera} slot="start" />}
            {t('cameraGuideAction')}
          </IonButton>
        </section>
      ) : null}

      <div className="camera-hints">
        <span>☀️ {t('goodLight')}</span>
        <span>🙂 {t('mouthOpen')}</span>
        <span>◎ {t('stayStill')}</span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {!streamRef.current && !preview && cameraGuidanceSeen && (
        <IonButton expand="block" color="light" disabled={opening} onClick={openCamera}>
          {opening ? <IonSpinner name="crescent" /> : <IonIcon icon={camera} slot="start" />}
          {permissionState === 'denied' ? t('openCameraSettings') : t('openCamera')}
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
          <IonButton disabled={busy} onClick={() => void submitPreview()}>
            {busy ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmark} slot="start" />}
            {busy ? t('analyzing') : t('usePhoto')}
          </IonButton>
        </div>
      )}
      {localCheckError ? <p className="form-error" role="alert">{localCheckError}</p> : null}
      {localCheckWarning ? <p className="form-warning" role="status">{localCheckWarning}</p> : null}
      {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}
      <small className="camera-only">{t('cameraOnly')}</small>
    </div>
  );
}
