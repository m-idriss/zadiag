export const coalesceInFlight = <T>(
  inFlight: Map<string, Promise<unknown>>,
  key: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const current = operation().finally(() => {
    if (inFlight.get(key) === current) inFlight.delete(key);
  });
  inFlight.set(key, current);
  return current;
};
