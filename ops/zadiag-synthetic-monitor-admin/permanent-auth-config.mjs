const settingPattern = /^([A-Z0-9_]+)=(.*)$/;

export const withPermanentMonitorAuth = (environment, { email, password, probeUrl }) => {
  const replacements = new Map([
    ['ZADIAG_MONITOR_AUTH_EMAIL', email],
    ['ZADIAG_MONITOR_AUTH_PASSWORD', password],
    ['ZADIAG_MONITOR_PROBE_URL', probeUrl],
  ]);
  const seen = new Set();
  const lines = environment.trimEnd().split('\n').map((line) => {
    const match = settingPattern.exec(line);
    if (!match || !replacements.has(match[1])) return line;
    seen.add(match[1]);
    return `${match[1]}=${replacements.get(match[1])}`;
  });
  replacements.forEach((value, key) => {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  });
  return `${lines.join('\n')}\n`;
};
