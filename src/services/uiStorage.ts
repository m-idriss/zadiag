export const readUiStorageString = (key: string) => {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
};

export const writeUiStorageString = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // UI state persistence is a convenience; core app flows should keep working.
  }
};

export const removeUiStorageItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // UI state persistence is a convenience; core app flows should keep working.
  }
};

export const readUiStorageJson = <T>(
  key: string,
  fallback: T,
  normalize?: (value: unknown) => T,
) => {
  const raw = readUiStorageString(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalize ? normalize(parsed) : parsed as T;
  } catch {
    return fallback;
  }
};
