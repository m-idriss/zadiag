import { useEffect, useState } from 'react';

const DASHBOARD_CLOCK_INTERVAL_MS = 30_000;

export const useCurrentTime = () => {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), DASHBOARD_CLOCK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return now;
};
