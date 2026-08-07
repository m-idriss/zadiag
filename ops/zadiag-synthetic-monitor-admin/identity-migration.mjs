export const migratedIdentityDocuments = ({
  oldMonitorId,
  newMonitorId,
  participantId,
  participant,
  membership,
  participantRef,
  monitor,
  now,
}) => {
  if (!oldMonitorId || !newMonitorId || oldMonitorId === newMonitorId) throw new Error('invalid_monitor_identity');
  if (participant?.userId !== oldMonitorId || participant?.syntheticMonitorUid !== oldMonitorId) {
    throw new Error('participant_monitor_mismatch');
  }
  if (membership?.role !== 'participant' || membership?.status !== 'active') {
    throw new Error('participant_membership_invalid');
  }
  if (participantRef?.participantId !== participantId || participantRef?.status !== 'active') {
    throw new Error('participant_reference_invalid');
  }
  if (monitor?.participantId !== participantId || monitor?.enabled !== true) {
    throw new Error('synthetic_monitor_invalid');
  }
  return {
    participant: { ...participant, userId: newMonitorId, syntheticMonitorUid: newMonitorId, updatedAt: now },
    membership: { ...membership, uid: newMonitorId, recoveredFrom: oldMonitorId, updatedAt: now },
    participantRef: { ...participantRef, participantId, recoveredFrom: oldMonitorId, updatedAt: now },
    user: { relationshipModelVersion: 2, notificationsEnabled: false, synthetic: true, updatedAt: now },
    monitor: { ...monitor, migratedFrom: oldMonitorId, updatedAt: now },
  };
};

export const replaceMonitorIdInEnvironment = (contents, oldMonitorId, newMonitorId) => {
  const lines = contents.split(/\r?\n/);
  const matches = lines.filter((line) => line.startsWith('ZADIAG_MONITOR_ID='));
  if (matches.length !== 1 || matches[0] !== `ZADIAG_MONITOR_ID=${oldMonitorId}`) {
    throw new Error('monitor_environment_mismatch');
  }
  return lines.map((line) => line === matches[0] ? `ZADIAG_MONITOR_ID=${newMonitorId}` : line).join('\n');
};
