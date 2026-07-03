const STORAGE_KEY = 'zadiag.camera-guidance.v1';

export const hasSeenCameraGuidance = () => localStorage.getItem(STORAGE_KEY) === 'seen';

export const markCameraGuidanceSeen = () => {
  localStorage.setItem(STORAGE_KEY, 'seen');
};

export const resetCameraGuidance = () => {
  localStorage.removeItem(STORAGE_KEY);
};
