import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { AppState, MonitoringPlan, RoutineAssignment, RoutineCategory, RoutineValidationMode, ScheduleGroup, VerificationEvent } from '../domain/models';
import { groupsFromLegacyPlan, nextPlannedWindow, summarizeWeekdaysShort } from '../domain/monitoringPlan';
import { formatMessage, type MessageKey } from '../services/i18n';
import { languageTag } from '../services/locale';
import { AppIcon, routineIconName } from '../components/Icon';
import { DisclosureToggle } from '../components/DisclosureToggle';
import { ParticipantSelector } from '../components/ParticipantSelector';
import { presentRoutine } from '../domain/routinePresentation';
import { assignableRoutineTemplates, marketplaceFromTemplates, presentRoutineTemplate } from '../domain/routineMarketplace';
import { withResolvedEventStatuses } from '../domain/adherence';
import { routineContentChanges, selectRoutineVersionTarget, type PublishedRoutineVersion, type RoutineCatalogEntry, type RoutineContentChange, type RoutineDraft } from '../domain/routineDraft';
import { readUiStorageJson, readUiStorageString, removeUiStorageItem, writeUiStorageString } from '../services/uiStorage';
import { routineContentEditTargetKey, type RoutineContentEditTarget } from './routineContentEditTarget';

const RoutineDetailScreen = lazy(() => import('./RoutineDetailScreen').then((module) => ({ default: module.RoutineDetailScreen })));
const RoutineDraftEditorScreen = lazy(() => import('./RoutineDraftEditorScreen').then((module) => ({ default: module.RoutineDraftEditorScreen })));

type RequestStatus = 'idle' | 'sent' | 'active' | 'error';
const routineChangeLabelKeys: Record<RoutineContentChange, MessageKey> = {
  identity: 'routineChangeIdentity', instructions: 'routineChangeInstructions', appearance: 'routineChangeAppearance',
  proof: 'routineChangeProof', analysis: 'routineChangeAnalysis', translations: 'routineChangeTranslations',
};
interface RequestRetryState {
  attempts: number;
  retryAt: number;
}

const ROUTINES_CATALOG_OPEN_KEY = 'zadiag.routines.catalogOpen';
const ROUTINES_SELECTED_ASSIGNMENT_KEY = 'zadiag.routines.selectedAssignment';
const ROUTINES_EXPANDED_SCHEDULES_KEY = 'zadiag.routines.expandedSchedules';

const readStoredBoolean = (key: string) => {
  const value = readUiStorageString(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const readStoredStringSet = (key: string) => {
  return readUiStorageJson(key, new Set<string>(), (parsed) =>
    new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []));
};

const routineCompletionRatesById = (events: VerificationEvent[]) => {
  const stats = new Map<string, { completed: number; successful: number }>();
  events.forEach((event) => {
    if (event.status === 'pending' || event.status === 'analyzing') return;
    const current = stats.get(event.routineId) ?? { completed: 0, successful: 0 };
    current.completed += 1;
    if (event.status === 'detected') current.successful += 1;
    stats.set(event.routineId, current);
  });
  return new Map([...stats].map(([routineId, item]) => [
    routineId,
    item.completed ? item.successful / item.completed : 0,
  ]));
};

const activePendingEventsByRoutineId = (events: VerificationEvent[], now: number) => {
  const byRoutineId = new Map<string, VerificationEvent>();
  events.forEach((event) => {
    if (event.status !== 'pending' || Date.parse(event.expiresAt) <= now) return;
    const current = byRoutineId.get(event.routineId);
    if (!current || Date.parse(event.expiresAt) < Date.parse(current.expiresAt)) {
      byRoutineId.set(event.routineId, event);
    }
  });
  return byRoutineId;
};

const responseWindowSummary = (expiryMinutes: number, t: (key: MessageKey) => string) =>
  expiryMinutes > 0
    ? <><b>{expiryMinutes}</b> {t('minutesRespond')}</>
    : <>{t('fullWindowRespond')}</>;

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const nextLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return next;
};

const formatRoutineTime = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);

const routineCategoryKey = (category: RoutineCategory): MessageKey => {
  switch (category) {
    case 'dental': return 'routineCategoryDental';
    case 'wellness': return 'routineCategoryWellness';
    case 'medication': return 'routineCategoryMedication';
    case 'activity': return 'routineCategoryActivity';
    case 'custom': return 'routineCategoryCustom';
  }
};

const routineValidationModeKey = (mode: RoutineValidationMode): MessageKey =>
  mode === 'auto' ? 'validationAuto' : 'validationAi';

const routineWindowLabel = (
  start: Date,
  end: Date,
  now: Date,
  locale: string,
  t: (key: MessageKey) => string,
) => {
  const windowLabel = `${formatRoutineTime(start, locale)}–${formatRoutineTime(end, locale)}`;
  if (sameLocalDay(start, now)) return windowLabel;
  if (sameLocalDay(start, nextLocalDay(now))) return `${t('tomorrow')} · ${windowLabel}`;
  return `${new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(start)} · ${windowLabel}`;
};

export function RoutinesScreen({
  state,
  start,
  edit,
  requestCheck,
  getProofImageUrl,
  reviewCheck,
  onAssignRoutine,
  onDeleteRoutine,
  onRetryRoutines,
  online = true,
  onListRoutineDrafts,
  onDeleteRoutineDraft,
  onCreateRoutineDraft,
  onForkRoutineAssignmentDraft,
  onUpdateRoutineDraft,
  onAssignRoutineDraft,
  onPublishRoutineDraft,
  onListPublishedRoutineVersions,
  onUpgradeRoutineAssignment,
  onSearchRoutineCatalog,
  onInstallCatalogRoutine,
  onSharePublishedRoutine,
  onResolveSharedRoutine,
  onExportRoutinePackage,
  onImportRoutinePackage,
  onRevokeSharedRoutine,
  onSelectParticipant,
  onSaveMonitoringPlan,
  savingRoutineId,
  focusedEventId,
  onFocusedEventConsumed,
  t,
}: {
  state: AppState;
  start?: () => void;
  edit?: boolean;
  requestCheck?: (routineId: string) => Promise<void>;
  getProofImageUrl?: (eventId: string) => Promise<string>;
  reviewCheck?: (eventId: string, decision: 'detected' | 'not_detected') => Promise<void>;
  onAssignRoutine?: (routineId: string) => Promise<void>;
  onDeleteRoutine?: (routineId: string) => Promise<void>;
  onRetryRoutines?: () => Promise<void>;
  online?: boolean;
  onListRoutineDrafts?: (participantId: string) => Promise<RoutineDraft[]>;
  onDeleteRoutineDraft?: (participantId: string, draftId: string, expectedRevision: number) => Promise<void>;
  onCreateRoutineDraft?: (participantId: string, routinePackage: RoutineDraft['package']) => Promise<RoutineDraft>;
  onForkRoutineAssignmentDraft?: (participantId: string, routineId: string, locale: AppState['locale']) => Promise<RoutineDraft>;
  onUpdateRoutineDraft?: (participantId: string, draftId: string, expectedRevision: number, routinePackage: RoutineDraft['package']) => Promise<RoutineDraft>;
  onAssignRoutineDraft?: (participantId: string, draftId: string, expectedRevision: number) => Promise<void>;
  onPublishRoutineDraft?: (participantId: string, draftId: string, expectedRevision: number) => Promise<unknown>;
  onListPublishedRoutineVersions?: (participantId: string) => Promise<Array<PublishedRoutineVersion & { routineId: string }>>;
  onUpgradeRoutineAssignment?: (participantId: string, routineId: string, targetVersion: number) => Promise<void>;
  onSearchRoutineCatalog?: (query: string) => Promise<RoutineCatalogEntry[]>;
  onInstallCatalogRoutine?: (participantId: string, entryId: string, shareCode?: string) => Promise<void>;
  onSharePublishedRoutine?: (participantId: string, routineId: string, version: number, visibility: 'listed' | 'unlisted') => Promise<{ entryId: string; shareCode: string }>;
  onResolveSharedRoutine?: (shareCode: string) => Promise<RoutineCatalogEntry>;
  onExportRoutinePackage?: (participantId: string, draftId: string) => Promise<{ content: string; mimeType: string; fileName: string }>;
  onImportRoutinePackage?: (participantId: string, content: string, mimeType: string, conflict: 'reject' | 'copy') => Promise<RoutineDraft>;
  onRevokeSharedRoutine?: (entryId: string) => Promise<void>;
  onSelectParticipant?: (participantId: string) => void;
  onSaveMonitoringPlan?: (routineId: string, plan: MonitoringPlan, validationMode?: RoutineValidationMode) => Promise<void>;
  savingRoutineId?: string;
  focusedEventId?: string;
  onFocusedEventConsumed?: () => void;
  t: (key: MessageKey) => string;
}) {
  const focusedEvent = state.events.find((event) => event.id === focusedEventId);
  const focusedAssignment = state.routineAssignments.find((assignment) => assignment.routineId === focusedEvent?.routineId);
  const [selectedId, setSelectedId] = useState<string | undefined>(() => focusedAssignment?.id ?? readUiStorageString(ROUTINES_SELECTED_ASSIGNMENT_KEY));
  const [requestingRoutineId, setRequestingRoutineId] = useState<string>();
  const [requestStatuses, setRequestStatuses] = useState<Record<string, RequestStatus>>({});
  const [requestRetries, setRequestRetries] = useState<Record<string, RequestRetryState>>({});
  const [retryTick, setRetryTick] = useState(Date.now());
  const [retryingRoutines, setRetryingRoutines] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(() =>
    Boolean(state.role === 'parent' && onAssignRoutine && !state.routineAssignments.length)
    || (readStoredBoolean(ROUTINES_CATALOG_OPEN_KEY) ?? false));
  const [assigningRoutineId, setAssigningRoutineId] = useState<string>();
  const [assignError, setAssignError] = useState(false);
  const [catalogSection, setCatalogSection] = useState<'builtins' | 'drafts' | 'community'>('builtins');
  const [deletingRoutineId, setDeletingRoutineId] = useState<string>();
  const [deleteErrorRoutineId, setDeleteErrorRoutineId] = useState<string>();
  const [routineDrafts, setRoutineDrafts] = useState<RoutineDraft[]>([]);
  const [draftsStatus, setDraftsStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [draftReloadSequence, setDraftReloadSequence] = useState(0);
  const [openDraftId, setOpenDraftId] = useState<string>();
  const [deletingDraftId, setDeletingDraftId] = useState<string>();
  const [draftDeleteErrorId, setDraftDeleteErrorId] = useState<string>();
  const [editingDraftId, setEditingDraftId] = useState<string | 'new'>();
  const [editingDraftTarget, setEditingDraftTarget] = useState<RoutineContentEditTarget>();
  const [forkingRoutineId, setForkingRoutineId] = useState<string>();
  const [assigningDraftId, setAssigningDraftId] = useState<string>();
  const [draftAssignErrorId, setDraftAssignErrorId] = useState<string>();
  const [publishingDraftId, setPublishingDraftId] = useState<string>();
  const [reviewingPublishDraftId, setReviewingPublishDraftId] = useState<string>();
  const [publishedVersions, setPublishedVersions] = useState<Array<PublishedRoutineVersion & { routineId: string }>>([]);
  const [expandedVersionHistoryIds, setExpandedVersionHistoryIds] = useState<Set<string>>(new Set());
  const [upgradingRoutineId, setUpgradingRoutineId] = useState<string>();
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogEntries, setCatalogEntries] = useState<RoutineCatalogEntry[]>([]);
  const [remoteCatalogStatus, setRemoteCatalogStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [installingEntryId, setInstallingEntryId] = useState<string>();
  const [routineShare, setRoutineShare] = useState<{ entryId: string; shareCode: string }>();
  const [sharedRoutineCode, setSharedRoutineCode] = useState('');
  const [privateShareCodes, setPrivateShareCodes] = useState<Record<string, string>>({});
  const [detailInitialTab, setDetailInitialTab] = useState<'overview' | 'plan' | 'tracking' | undefined>(() => focusedEventId ? 'tracking' : undefined);
  const [expandedScheduleIds, setExpandedScheduleIds] = useState<Set<string>>(() => readStoredStringSet(ROUTINES_EXPANDED_SCHEDULES_KEY));
  const selected = state.routineAssignments.find((assignment) => assignment.id === selectedId);
  const canManageRoutines = state.role === 'parent' && Boolean(edit);
  const canAssignRoutine = state.role === 'parent' && Boolean(onAssignRoutine);
  const catalogHasTabs = Boolean(onSearchRoutineCatalog || onListRoutineDrafts);
  const activeParticipantAccess = state.participantAccess?.find((entry) => entry.participant.id === state.activeParticipantId)
    ?? state.participantAccess?.find((entry) => entry.membership.status === 'active');
  const now = Date.now();
  const nowDate = new Date(now);
  const marketplace = useMemo(() => marketplaceFromTemplates(), []);
  const resolvedEvents = useMemo(() => withResolvedEventStatuses(state.events), [state.events]);
  const completionRatesByRoutineId = useMemo(() => routineCompletionRatesById(resolvedEvents), [resolvedEvents]);
  const activePendingByRoutineId = useMemo(() => activePendingEventsByRoutineId(state.events, now), [now, state.events]);
  const retryDelayForAttempt = (attempt: number) => Math.min(30_000, 2 ** Math.max(0, attempt - 1) * 2_000);
  const openDetails = (assignmentId: string, initialTab?: 'overview' | 'plan') => {
    setDetailInitialTab(initialTab);
    setSelectedId(assignmentId);
  };
  const openDraftEditor = (draftId: string | 'new', target?: RoutineContentEditTarget) => {
    setEditingDraftTarget(target);
    setEditingDraftId(draftId);
  };
  const closeDraftEditor = () => {
    setEditingDraftId(undefined);
    setEditingDraftTarget(undefined);
  };
  const forkAssignedRoutine = async (assignment: RoutineAssignment, target?: RoutineContentEditTarget) => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!participantId || !onForkRoutineAssignmentDraft || forkingRoutineId) return;
    setForkingRoutineId(assignment.routineId);
    try {
      const draft = await onForkRoutineAssignmentDraft(participantId, assignment.routineId, state.locale);
      setRoutineDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)]);
      openDraftEditor(draft.id, target);
    } finally {
      setForkingRoutineId(undefined);
    }
  };
  const backToList = () => {
    setDetailInitialTab(undefined);
    setSelectedId(undefined);
  };

  useEffect(() => {
    if (!Object.keys(requestRetries).length) return undefined;
    const timer = window.setInterval(() => setRetryTick(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [requestRetries]);

  useEffect(() => {
    if (selectedId && !selected) {
      removeUiStorageItem(ROUTINES_SELECTED_ASSIGNMENT_KEY);
      setSelectedId(undefined);
    }
  }, [selected, selectedId]);

  useEffect(() => {
    if (selectedId) writeUiStorageString(ROUTINES_SELECTED_ASSIGNMENT_KEY, selectedId);
    else removeUiStorageItem(ROUTINES_SELECTED_ASSIGNMENT_KEY);
  }, [selectedId]);

  useEffect(() => {
    writeUiStorageString(ROUTINES_CATALOG_OPEN_KEY, String(catalogOpen));
  }, [catalogOpen]);

  useEffect(() => {
    writeUiStorageString(ROUTINES_EXPANDED_SCHEDULES_KEY, JSON.stringify([...expandedScheduleIds]));
  }, [expandedScheduleIds]);

  useEffect(() => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!catalogOpen || catalogSection !== 'drafts' || !canAssignRoutine || !participantId || !onListRoutineDrafts || !online) return undefined;
    let cancelled = false;
    setDraftsStatus('loading');
    void onListRoutineDrafts(participantId).then((drafts) => {
      if (cancelled) return;
      setRoutineDrafts(drafts);
      setDraftsStatus('loaded');
    }).catch((error) => {
      console.error(error);
      if (!cancelled) setDraftsStatus('error');
    });
    return () => { cancelled = true; };
  }, [activeParticipantAccess?.participant.id, canAssignRoutine, catalogOpen, catalogSection, draftReloadSequence, onListRoutineDrafts, online]);

  useEffect(() => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!catalogOpen || catalogSection !== 'drafts' || !participantId || !online || !onListPublishedRoutineVersions) return;
    let cancelled = false;
    void onListPublishedRoutineVersions(participantId).then((versions) => { if (!cancelled) setPublishedVersions(versions); }).catch(console.error);
    return () => { cancelled = true; };
  }, [activeParticipantAccess?.participant.id, catalogOpen, catalogSection, onListPublishedRoutineVersions, online, publishingDraftId]);
  useEffect(() => {
    if (!catalogOpen || catalogSection !== 'community' || !online || !onSearchRoutineCatalog) return;
    let cancelled = false;
    setRemoteCatalogStatus('loading');
    const timeout = window.setTimeout(() => { void onSearchRoutineCatalog(catalogQuery).then((entries) => { if (!cancelled) { setCatalogEntries(entries); setRemoteCatalogStatus('loaded'); } }).catch(() => { if (!cancelled) setRemoteCatalogStatus('error'); }); }, 250);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [catalogOpen, catalogQuery, catalogSection, onSearchRoutineCatalog, online]);

  if (editingDraftId) {
    const participantId = activeParticipantAccess?.participant.id;
    const draft = routineDrafts.find((item) => item.id === editingDraftId);
    const saveDraft = async (routinePackage: RoutineDraft['package']) => {
      if (!participantId) throw new Error('participant_unavailable');
      const saved = draft
        ? await onUpdateRoutineDraft?.(participantId, draft.id, draft.revision, routinePackage)
        : await onCreateRoutineDraft?.(participantId, routinePackage);
      if (!saved) throw new Error('draft_persistence_unavailable');
      setRoutineDrafts((current) => draft ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setEditingDraftId(saved.id);
      return saved;
    };
    return <Suspense fallback={<div className="content-screen routines-state" role="status"><p>{t('loadingRoutineDetails')}</p></div>}><RoutineDraftEditorScreen key={`${draft?.id ?? 'new'}-${routineContentEditTargetKey(editingDraftTarget)}`} draft={draft} target={editingDraftTarget} locale={state.locale} online={online} save={saveDraft} cancel={closeDraftEditor} reload={() => { closeDraftEditor(); setDraftReloadSequence((value) => value + 1); }} t={t} /></Suspense>;
  }

  if (selected) return <Suspense fallback={<div className="content-screen routines-state" role="status"><p>{t('loadingRoutineDetails')}</p></div>}><RoutineDetailScreen key={`${selected.id}-${detailInitialTab ?? 'default'}`} assignment={selected} state={state} back={backToList} start={start} edit={canManageRoutines} initialTab={detailInitialTab} initialEventId={focusedEventId} onInitialEventConsumed={onFocusedEventConsumed} getProofImageUrl={getProofImageUrl} reviewCheck={canManageRoutines ? reviewCheck : undefined} requestCheck={canManageRoutines ? requestCheck : undefined} onSaveMonitoringPlan={canManageRoutines && onSaveMonitoringPlan ? (plan, validationMode) => onSaveMonitoringPlan(selected.routineId, plan, validationMode) : undefined} onForkContent={canManageRoutines && onForkRoutineAssignmentDraft ? (target) => forkAssignedRoutine(selected, target) : undefined} forkingContent={forkingRoutineId === selected.routineId} routinePlanBusy={savingRoutineId === selected.routineId} t={t} /></Suspense>;

  const setRequestStatus = (routineId: string, status: RequestStatus) => {
    setRequestStatuses((current) => ({ ...current, [routineId]: status }));
  };

  const requestNow = async (routineId: string) => {
    if (!requestCheck) return;
    setRequestingRoutineId(routineId);
    setRequestStatus(routineId, 'idle');
    try {
      await requestCheck(routineId);
      setRequestStatus(routineId, 'sent');
      setRequestRetries((current) => {
        const next = { ...current };
        delete next[routineId];
        return next;
      });
    } catch (error) {
      setRequestStatus(routineId, String(error).includes('active_check_exists') ? 'active' : 'error');
      if (!String(error).includes('active_check_exists')) {
        setRequestRetries((current) => {
          const attempts = (current[routineId]?.attempts ?? 0) + 1;
          return { ...current, [routineId]: { attempts, retryAt: Date.now() + retryDelayForAttempt(attempts) } };
        });
      }
    } finally {
      setRequestingRoutineId(undefined);
    }
  };
  const retryRoutines = async () => {
    if (!onRetryRoutines) return;
    setRetryingRoutines(true);
    try {
      await onRetryRoutines();
    } catch (error) {
      console.error(error);
    } finally {
      setRetryingRoutines(false);
    }
  };

  const assignedRoutineIds = new Set(state.routineAssignments.map((assignment) => assignment.routineId));
  const assignableTemplates = assignableRoutineTemplates(marketplace, [...assignedRoutineIds]);
  const assignRoutine = async (routineId: string) => {
    if (!canAssignRoutine || !onAssignRoutine || assignedRoutineIds.has(routineId)) return;
    setAssigningRoutineId(routineId);
    setAssignError(false);
    try {
      await onAssignRoutine(routineId);
      setCatalogOpen(false);
    } catch (error) {
      console.error(error);
      setAssignError(true);
    } finally {
      setAssigningRoutineId(undefined);
    }
  };
  const deleteDraft = async (draft: RoutineDraft, routineName: string) => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!participantId || !onDeleteRoutineDraft || deletingDraftId) return;
    if (!window.confirm(formatMessage(t('routineLibraryDeleteConfirm'), { routine: routineName }))) return;
    setDeletingDraftId(draft.id);
    setDraftDeleteErrorId(undefined);
    try {
      await onDeleteRoutineDraft(participantId, draft.id, draft.revision);
      setRoutineDrafts((current) => current.filter((item) => item.id !== draft.id));
      if (openDraftId === draft.id) setOpenDraftId(undefined);
    } catch (error) {
      console.error(error);
      setDraftDeleteErrorId(draft.id);
    } finally {
      setDeletingDraftId(undefined);
    }
  };
  const assignDraft = async (draft: RoutineDraft) => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!participantId || !onAssignRoutineDraft || draft.validation.status !== 'valid' || draft.state !== 'active') return;
    setAssigningDraftId(draft.id);
    setDraftAssignErrorId(undefined);
    try {
      await onAssignRoutineDraft(participantId, draft.id, draft.revision);
      setCatalogOpen(false);
    } catch (error) {
      console.error(error);
      setDraftAssignErrorId(draft.id);
    } finally { setAssigningDraftId(undefined); }
  };
  const publishDraft = async (draft: RoutineDraft) => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!participantId || !onPublishRoutineDraft || draft.validation.status !== 'valid') return;
    setPublishingDraftId(draft.id);
    try {
      await onPublishRoutineDraft(participantId, draft.id, draft.revision);
      setRoutineDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, state: 'archived', revision: item.revision + 1 } : item));
      setReviewingPublishDraftId(undefined);
    } finally { setPublishingDraftId(undefined); }
  };
  const upgradeAssignment = async (assignment: RoutineAssignment, target: PublishedRoutineVersion & { routineId: string }) => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!participantId || !onUpgradeRoutineAssignment) return;
    const current = presentRoutine(assignment.routine, state.locale);
    const next = presentRoutine(target.package.routine, state.locale);
    if (!window.confirm(formatMessage(t('routineUpgradeConfirm'), { current: current.name, next: next.name, version: target.version }))) return;
    setUpgradingRoutineId(assignment.routineId);
    try { await onUpgradeRoutineAssignment(participantId, assignment.routineId, target.version); }
    finally { setUpgradingRoutineId(undefined); }
  };
  const installCatalogEntry = async (entry: RoutineCatalogEntry) => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!participantId || !onInstallCatalogRoutine) return;
    setInstallingEntryId(entry.id);
    try { await onInstallCatalogRoutine(participantId, entry.id, privateShareCodes[entry.id]); setCatalogOpen(false); }
    finally { setInstallingEntryId(undefined); }
  };
  const shareVersion = async (version: PublishedRoutineVersion & { routineId: string }, visibility: 'listed' | 'unlisted') => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!participantId || !onSharePublishedRoutine) return;
    const result = await onSharePublishedRoutine(participantId, version.routineId, version.version, visibility);
    setRoutineShare(result);
  };
  const resolveShared = async () => {
    if (!onResolveSharedRoutine || !sharedRoutineCode.trim()) return;
    try {
      const entry = await onResolveSharedRoutine(sharedRoutineCode);
      setPrivateShareCodes((current) => ({ ...current, [entry.id]: sharedRoutineCode.trim() }));
      setCatalogEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
    } catch (error) {
      console.error(error);
      setRemoteCatalogStatus('error');
    }
  };
  const exportDraft = async (draftId: string) => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!participantId || !onExportRoutinePackage) return;
    const exported = await onExportRoutinePackage(participantId, draftId);
    const url = URL.createObjectURL(new Blob([exported.content], { type: exported.mimeType }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = exported.fileName; anchor.click(); URL.revokeObjectURL(url);
  };
  const importPackage = async (file: File) => {
    const participantId = activeParticipantAccess?.participant.id;
    if (!participantId || !onImportRoutinePackage) return;
    const content = await file.text();
    try { await onImportRoutinePackage(participantId, content, file.type, 'reject'); }
    catch (error) { if ((error as { code?: string }).code !== 'functions/already-exists' || !window.confirm(t('routineImportConflict'))) throw error; await onImportRoutinePackage(participantId, content, file.type, 'copy'); }
    setDraftReloadSequence((value) => value + 1);
  };
  const deleteRoutine = async (assignment: RoutineAssignment, routineName: string) => {
    if (!canManageRoutines || !onDeleteRoutine || deletingRoutineId) return;
    if (state.routineAssignments.length <= 1) {
      setDeleteErrorRoutineId(assignment.routineId);
      return;
    }
    const routineEvents = state.events.filter((event) => event.routineId === assignment.routineId);
    const activeChecks = routineEvents.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now()).length;
    const confirmation = formatMessage(t('confirmDeleteRoutine'), {
      routine: routineName,
      checks: routineEvents.length,
      activeChecks,
    });
    if (!window.confirm(confirmation)) return;
    setDeletingRoutineId(assignment.routineId);
    setDeleteErrorRoutineId(undefined);
    try {
      await onDeleteRoutine(assignment.routineId);
    } catch (error) {
      console.error(error);
      setDeleteErrorRoutineId(assignment.routineId);
    } finally {
      setDeletingRoutineId(undefined);
    }
  };
  const toggleSchedule = (assignmentId: string) => {
    setExpandedScheduleIds((current) => {
      const next = new Set(current);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  };

  if (state.routinesLoaded === false) return <div className="content-screen routines-state" role="status"><p>{t('loadingRoutines')}</p></div>;
  if (state.routinesError) return (
    <div className="content-screen routines-state" role="alert">
      <p>{t('routinesLoadError')}</p>
      {onRetryRoutines ? (
        <button type="button" className="primary-action-button routines-retry-button" aria-busy={retryingRoutines} disabled={retryingRoutines} onClick={() => { void retryRoutines(); }}>
          {retryingRoutines ? <span className="button-spinner" aria-hidden="true" /> : null}
          {retryingRoutines ? t('retrying') : t('retryNow')}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className={`content-screen routines-screen${canAssignRoutine ? ' routines-screen-can-assign' : ''}`}>
      <div className="routines-top">
        <header className="screen-header routines-top-heading">
          <div><h1>{t('myRoutines')}</h1></div>
        </header>
      <ParticipantSelector
        access={state.participantAccess}
        activeParticipantId={state.activeParticipantId}
        label={t('followedPerson')}
        title={activeParticipantAccess?.participant.displayName ?? state.family.childName}
        actionLabel={t('relationshipSwitchAction')}
        onSelect={onSelectParticipant}
      />
      {canAssignRoutine ? createPortal(
        <div className="routine-add-switcher" data-swipe-navigation="ignore">
        <button
          type="button"
          className="primary-action-button routines-add-dock-button"
          aria-expanded={catalogOpen}
          onClick={() => setCatalogOpen((open) => !open)}
        >
          <AppIcon name="add" />
          {t('addRoutine')}
        </button>
      {catalogOpen && (
        <section className={`card routine-catalog-card routine-catalog-popover${catalogHasTabs ? ' has-tabs' : ''}`} aria-labelledby="routine-catalog-title">
          <div className="routine-catalog-heading">
            <div>
              <small>{t('routineCatalogEyebrow')}</small>
              <h2 id="routine-catalog-title">{t('chooseRoutine')}</h2>
            </div>
            <button type="button" className="routine-catalog-close" onClick={() => setCatalogOpen(false)} aria-label={t('close')}><AppIcon name="close" /></button>
          </div>
          {catalogHasTabs ? <div className="routine-catalog-tabs" role="tablist" aria-label={t('chooseRoutine')}>
            <button id="routine-catalog-builtins-tab" type="button" role="tab" aria-selected={catalogSection === 'builtins'} aria-controls="routine-catalog-builtins-panel" onClick={() => setCatalogSection('builtins')}>{t('routineLibraryBuiltins')}</button>
            {onListRoutineDrafts ? <button id="routine-catalog-drafts-tab" type="button" role="tab" aria-selected={catalogSection === 'drafts'} aria-controls="routine-catalog-drafts-panel" onClick={() => setCatalogSection('drafts')}>{t('routineLibraryDrafts')}</button> : null}
            {onSearchRoutineCatalog ? <button id="routine-catalog-community-tab" type="button" role="tab" aria-selected={catalogSection === 'community'} aria-controls="routine-catalog-community-panel" onClick={() => setCatalogSection('community')}>{t('routineInternalCatalog')}</button> : null}
          </div> : null}
          <div className="routine-catalog-list">
            {catalogSection === 'drafts' && onListRoutineDrafts ? (
              <section id="routine-catalog-drafts-panel" className="routine-library-group" role="tabpanel" aria-labelledby="routine-catalog-drafts-tab">
                <div className="routine-library-group-heading"><h3 id="routine-library-drafts-title">{t('routineLibraryDrafts')}</h3><div>{onImportRoutinePackage ? <label className="routine-import-button">{t('routineImport')}<input type="file" accept="application/vnd.zadiag.routine+json,.zadiag-routine" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importPackage(file); event.target.value = ''; }} /></label> : null}{onCreateRoutineDraft ? <button type="button" onClick={() => openDraftEditor('new')}>{t('routineDraftNew')}</button> : null}</div></div>
                {!online ? <p className="routine-library-state" role="status">{t('routineLibraryDraftsOffline')}</p> : null}
                {online && draftsStatus === 'loading' ? <p className="routine-library-state" role="status">{t('routineLibraryLoadingDrafts')}</p> : null}
                {online && draftsStatus === 'error' ? (
                  <div className="routine-library-state" role="alert">
                    <p>{t('routineLibraryDraftsError')}</p>
                    <button type="button" onClick={() => setDraftReloadSequence((value) => value + 1)}>{t('retryNow')}</button>
                  </div>
                ) : null}
                {online && draftsStatus === 'loaded' && !routineDrafts.length ? <p className="routine-library-state">{t('routineLibraryNoDrafts')}</p> : null}
                {routineDrafts.map((draft) => {
                  const visual = presentRoutine(draft.package.routine, state.locale);
                  const expanded = openDraftId === draft.id;
                  const statusKey: MessageKey = draft.state === 'archived'
                    ? 'routineLibraryArchived'
                    : draft.validation.status === 'valid'
                      ? 'routineLibraryDraft'
                      : draft.validation.status === 'incomplete'
                        ? 'routineLibraryIncomplete'
                        : 'routineLibraryInvalid';
                  const sourceAssignment = draft.forkedFrom ? state.routineAssignments.find((assignment) => assignment.routineId === draft.forkedFrom?.routineId) : undefined;
                  const changes = sourceAssignment ? routineContentChanges(sourceAssignment.routine, draft.package.routine) : [];
                  const reviewingPublication = reviewingPublishDraftId === draft.id;
                  return (
                    <article className="routine-library-draft" key={draft.id} style={visual.style}>
                      <div className="routine-library-draft-heading">
                        <span className="settings-row-icon routine-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
                        <div>
                          <span className="routine-library-badge">{t(statusKey)}</span>
                          <h4>{visual.name}</h4>
                        </div>
                        <div className="routine-library-draft-actions">
                          {onUpdateRoutineDraft && draft.state === 'active' ? <button type="button" onClick={() => openDraftEditor(draft.id)}>{t('routineDraftResume')}</button> : <button type="button" aria-expanded={expanded} onClick={() => setOpenDraftId(expanded ? undefined : draft.id)}>{expanded ? t('routineLibraryCloseDraft') : t('routineLibraryOpenDraft')}</button>}
                          <button type="button" disabled={deletingDraftId === draft.id} onClick={() => { void deleteDraft(draft, visual.name); }} aria-label={formatMessage(t('routineLibraryDeleteDraft'), { routine: visual.name })}>
                            <AppIcon name="close" />
                          </button>
                          {onExportRoutinePackage ? <button type="button" onClick={() => { void exportDraft(draft.id); }}>{t('routineExport')}</button> : null}
                        </div>
                      </div>
                      {expanded ? (
                        <div className="routine-library-draft-detail">
                          <p>{visual.description}</p>
                          <small>{formatMessage(t('routineLibraryRevision'), { revision: draft.revision })} · {formatMessage(t('routineLibraryIssues'), { count: draft.validation.issues.length })}</small>
                          <div className="routine-draft-preview-grid" aria-label={t('routineDraftPreview')}>
                            {(['routineDraftResponsiblePreview', 'routineDraftParticipantPreview'] as MessageKey[]).map((roleKey) => <article key={roleKey}><small>{t(roleKey)}</small><h5>{visual.name}</h5><p>{visual.instructions}</p><b>{visual.proofExample}</b></article>)}
                          </div>
                          {onAssignRoutineDraft ? <button type="button" className="routine-draft-assign" disabled={draft.validation.status !== 'valid' || draft.state !== 'active' || assigningDraftId === draft.id} onClick={() => { void assignDraft(draft); }}>{assigningDraftId === draft.id ? t('routineDraftAssigning') : t('routineDraftAssign')}</button> : null}
                          {reviewingPublication ? <section className="routine-publish-review" aria-label={t('routinePublishReviewTitle')}><h5>{formatMessage(t('routinePublishReviewVersion'), { version: draft.package.version })}</h5>{changes.length ? <ul>{changes.map((change) => <li key={change}>{t(routineChangeLabelKeys[change])}</li>)}</ul> : <p>{t(sourceAssignment ? 'routinePublishNoChanges' : 'routinePublishNewRoutine')}</p>}<p>{t('routinePublishImmutableNotice')}</p><div><button type="button" onClick={() => setReviewingPublishDraftId(undefined)}>{t('cancel')}</button><button type="button" className="routine-draft-publish" disabled={!changes.length && Boolean(sourceAssignment) || publishingDraftId === draft.id} onClick={() => { void publishDraft(draft); }}>{publishingDraftId === draft.id ? t('routineDraftPublishing') : t('routinePublishConfirm')}</button></div></section> : null}
                          {onPublishRoutineDraft && !reviewingPublication ? <button type="button" className="routine-draft-publish" disabled={draft.validation.status !== 'valid' || draft.state !== 'active' || publishingDraftId === draft.id} onClick={() => setReviewingPublishDraftId(draft.id)}>{t('routineDraftPublish')}</button> : null}
                        </div>
                      ) : null}
                      {draftAssignErrorId === draft.id ? <p className="request-feedback error" role="alert">{t('routineDraftAssignError')}</p> : null}
                      {draftDeleteErrorId === draft.id ? <p className="request-feedback error" role="alert">{t('routineLibraryDeleteError')}</p> : null}
                    </article>
                  );
                })}
              </section>
            ) : null}
            {catalogSection === 'drafts' && state.routineAssignments.map((assignment) => {
              const currentVersion = assignment.sourceVersion ?? 0;
              const target = selectRoutineVersionTarget(publishedVersions, assignment.routineId, currentVersion);
              if (!target) return null;
              const current = presentRoutine(assignment.routine, state.locale);
              const next = presentRoutine(target.package.routine, state.locale);
              const changes = routineContentChanges(assignment.routine, target.package.routine);
              const rollback = target.version < currentVersion;
              return <section className="routine-upgrade-card" key={`upgrade-${assignment.id}`}><small>{t(rollback ? 'routineRollbackAvailable' : 'routineUpgradeAvailable')}</small><h3>{current.name} → {next.name}</h3><p>{formatMessage(t('routineUpgradeVersionTransition'), { current: currentVersion, next: target.version })}</p><ul>{changes.map((change) => <li key={change}>{t(routineChangeLabelKeys[change])}</li>)}</ul>{changes.includes('analysis') ? <p className="routine-upgrade-warning" role="note">{t('routineUpgradeAnalysisWarning')}</p> : null}<p>{t(rollback ? 'routineRollbackHistoryNotice' : 'routineUpgradeHistoryNotice')}</p><button type="button" disabled={upgradingRoutineId === assignment.routineId} onClick={() => { void upgradeAssignment(assignment, target); }}>{upgradingRoutineId === assignment.routineId ? t('routineUpgrading') : formatMessage(t(rollback ? 'routineRollbackTo' : 'routineUpgradeTo'), { version: target.version })}</button></section>;
            })}
            {catalogSection === 'drafts' && state.routineAssignments.map((assignment) => {
              const expanded = expandedVersionHistoryIds.has(assignment.id);
              const currentVersion = assignment.sourceVersion ?? 0;
              const versions = publishedVersions.filter((version) => version.routineId === assignment.routineId).sort((a, b) => b.version - a.version);
              const currentPublished = versions.find((version) => version.version === currentVersion);
              const currentOrigin = currentPublished?.origin ?? (assignment.sourceCatalogEntryId ? 'community' : assignment.sourceDraftId ? 'private' : 'builtin');
              const currentVersionLabel = currentVersion ? formatMessage(t('routineVersionNumber'), { version: currentVersion }) : t('routineVersionBuiltinShort');
              const originLabels: Record<'builtin' | 'private' | 'community', MessageKey> = { builtin: 'routineVersionBuiltin', private: 'routineVersionPrivate', community: 'routineVersionCommunity' };
              const visual = presentRoutine(assignment.routine, state.locale);
              return <section className="routine-version-history" key={`history-${assignment.id}`}><header><div><small>{t('routineVersionHistory')}</small><h3>{visual.name}</h3><p>{formatMessage(t('routineVersionCurrent'), { version: currentVersionLabel })} · {t(originLabels[currentOrigin])}</p></div><DisclosureToggle expanded={expanded} showLabel={t('routineVersionShowHistory')} hideLabel={t('routineVersionHideHistory')} onToggle={() => setExpandedVersionHistoryIds((current) => { const next = new Set(current); if (expanded) next.delete(assignment.id); else next.add(assignment.id); return next; })} /></header>{expanded ? <div className="routine-version-list"><article className="current"><b>{currentVersionLabel}</b><span>{t('routineVersionApplied')}</span><small>{currentPublished?.authorName ?? t('routineVersionSystemAuthor')} · {new Intl.DateTimeFormat(languageTag(state.locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(assignment.contentUpdatedAt ?? currentPublished?.publishedAt ?? assignment.assignedAt))}</small></article>{versions.filter((version) => version.version !== currentVersion).map((version) => <article key={version.version}><b>{formatMessage(t('routineVersionNumber'), { version: version.version })}</b><span>{t(originLabels[version.origin ?? 'private'])}</span><small>{version.authorName ?? t('routineVersionSystemAuthor')} · {new Intl.DateTimeFormat(languageTag(state.locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(version.publishedAt))}</small></article>)}</div> : null}</section>;
            })}
            {catalogSection === 'community' && onSearchRoutineCatalog ? <section id="routine-catalog-community-panel" className="routine-remote-catalog" role="tabpanel" aria-labelledby="routine-catalog-community-tab"><h3>{t('routineInternalCatalog')}</h3><label><span>{t('search')}</span><input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder={t('routineCatalogSearchPlaceholder')} /></label>{onResolveSharedRoutine ? <div className="routine-share-code"><input aria-label={t('routineShareCode')} value={sharedRoutineCode} onChange={(event) => setSharedRoutineCode(event.target.value)} placeholder={t('routineShareCodePlaceholder')} /><button type="button" onClick={() => { void resolveShared(); }}>{t('routineShareCodeOpen')}</button></div> : null}{remoteCatalogStatus === 'loading' ? <p role="status">{t('routineCatalogSearching')}</p> : null}{remoteCatalogStatus === 'error' ? <p role="alert">{t('routineCatalogUnavailable')}</p> : null}{catalogEntries.map((entry) => { const visual = presentRoutine(entry.package.routine, state.locale); return <article key={entry.id}><div><small>{entry.authorName} · v{entry.version} · {entry.package.availableLocales.join(', ').toUpperCase()} · {new Intl.DateTimeFormat(state.locale, { dateStyle: 'medium' }).format(new Date(entry.sharedAt))}</small><h4>{visual.name}</h4><p>{visual.description}</p></div><button type="button" disabled={installingEntryId === entry.id || assignedRoutineIds.has(entry.routineId)} onClick={() => { void installCatalogEntry(entry); }}>{assignedRoutineIds.has(entry.routineId) ? t('routineAlreadyAdded') : installingEntryId === entry.id ? t('routineInstalling') : t('routineInstall')}</button></article>; })}</section> : null}
            {catalogSection === 'drafts' && onSharePublishedRoutine && publishedVersions.length ? <section className="routine-share-versions"><h3>{t('routineShareTitle')}</h3>{publishedVersions.map((version) => <div key={`${version.routineId}-${version.version}`}><span>{presentRoutine(version.package.routine, state.locale).name} · v{version.version}</span><button type="button" onClick={() => { void shareVersion(version, 'listed'); }}>{t('routineShareListed')}</button><button type="button" onClick={() => { void shareVersion(version, 'unlisted'); }}>{t('routineShareUnlisted')}</button></div>)}{routineShare ? <div className="routine-share-result"><code>{routineShare.shareCode}</code>{onRevokeSharedRoutine ? <button type="button" onClick={() => { void onRevokeSharedRoutine(routineShare.entryId).then(() => setRoutineShare(undefined)); }}>{t('routineShareRevoke')}</button> : null}</div> : null}</section> : null}
            {catalogSection === 'builtins' ? <section id="routine-catalog-builtins-panel" className="routine-library-group" role={catalogHasTabs ? 'tabpanel' : undefined} aria-labelledby={catalogHasTabs ? 'routine-catalog-builtins-tab' : 'routine-library-builtins-title'}>
            <h3 id="routine-library-builtins-title" className="routine-library-section-title">{t('routineLibraryBuiltins')}</h3>
            {marketplace.templates.map((template) => {
              const visual = presentRoutineTemplate(template, state.locale);
              const routineId = template.routine.id;
              const assigned = assignedRoutineIds.has(routineId);
              const assigning = assigningRoutineId === routineId;
              return (
                <article className="routine-catalog-item" style={visual.style} key={template.id} aria-labelledby={`routine-catalog-${routineId}`}>
                  <span className="settings-row-icon routine-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
                  <div className="routine-catalog-item-content">
                    <div className="routine-catalog-meta" aria-label={`${t(routineCategoryKey(visual.category))} · ${t(routineValidationModeKey(visual.recommendedValidationMode))}`}>
                      <span>{t('routineLibraryBuiltin')}</span>
                      <span>{t(routineCategoryKey(visual.category))}</span>
                      <span>{t('routineCatalogValidationMode')}: {t(routineValidationModeKey(visual.recommendedValidationMode))}</span>
                    </div>
                    <h3 id={`routine-catalog-${routineId}`}>{visual.name}</h3>
                    <p>{visual.description}</p>
                    <p className="routine-catalog-proof"><b>{t('routineCatalogProofExample')}:</b> {visual.proofExample}</p>
                  </div>
                  <button type="button" className="routine-catalog-add" disabled={assigned || assigning} onClick={() => { void assignRoutine(routineId); }}>
                    {assigned ? t('routineAlreadyAdded') : assigning ? t('addingRoutine') : t('add')}
                  </button>
                </article>
              );
            })}</section> : null}
          </div>
          {catalogSection === 'builtins' && !assignableTemplates.length && <p className="request-feedback">{t('allMarketplaceRoutinesAdded')}</p>}
          {assignError && <p role="alert" className="request-feedback error">{t('routineAddError')}</p>}
        </section>
      )}
        </div>,
        document.body,
      ) : null}
      </div>
      <section className="settings-section routines-list-section" aria-labelledby="routines-list-title">
        <h2 id="routines-list-title">{t('routines')}</h2>
        <div className="routine-list">
          {state.routineAssignments.map((assignment) => {
            const next = activePendingByRoutineId.get(assignment.routineId);
            const rate = completionRatesByRoutineId.get(assignment.routineId) ?? 0;
            const visual = presentRoutine(assignment.routine, state.locale);
            const locale = languageTag(state.locale);
            const planned = next ? undefined : nextPlannedWindow(assignment.plan, nowDate);
            const nextLabel = next
              ? `${t('before')} ${formatRoutineTime(new Date(next.expiresAt), locale)}`
              : planned
                ? routineWindowLabel(planned.start, planned.end, nowDate, locale, t)
                : t('noPendingTask');
            const groups = groupsFromLegacyPlan(assignment.plan);
            const planScheduleGroups = groups.map((group, groupIndex) => ({
              id: group.id,
              label: `${groups.length > 1 ? `${groupIndex + 1} · ` : ''}${summarizeWeekdaysShort(group.weekdays, t)}`,
              windows: group.windows.map((window) => ({
                id: `${group.id}_${window.id}`,
                label: `${window.start}–${window.end}`,
              })),
            }));
            const requestStatus = requestStatuses[assignment.routineId] ?? 'idle';
            const retryState = requestRetries[assignment.routineId];
            const retryInSeconds = retryState ? Math.max(0, Math.ceil((retryState.retryAt - retryTick) / 1000)) : 0;
            const retryBlocked = Boolean(retryState && retryInSeconds > 0);
            const requesting = requestingRoutineId === assignment.routineId;
            const scheduleExpanded = expandedScheduleIds.has(assignment.id);
            const deletingLastRoutine = state.routineAssignments.length <= 1;
            return (
              <section className="card routine-card routine-plan-list-card" style={visual.style} key={assignment.id}>
                <div className="routine-list-card-title">
                  <div className="routine-card-heading">
                    <span className="settings-row-icon routine-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
                    <div><h2>{visual.name}</h2><p><b>{assignment.plan.checksPerDay}</b> {t('checksDay')} · {responseWindowSummary(assignment.plan.expiryMinutes, t)}</p></div>
                  </div>
                  <b className="routine-rate">{Math.round(rate * 100)}%</b>
                  <DisclosureToggle
                    expanded={scheduleExpanded}
                    showLabel={t('showSchedule')}
                    hideLabel={t('hideSchedule')}
                    onToggle={() => toggleSchedule(assignment.id)}
                  />
                </div>
                <div className="routine-progress-row">
                  <div className="routine-progress-track"><span style={{ '--routine-progress': `${Math.round(rate * 100)}%` } as CSSProperties} /></div>
                </div>
                <p className="routine-next-inline"><span>{t('nextCheck')}</span><strong>{nextLabel}</strong></p>
                {scheduleExpanded && (
                  <div className="routine-expanded-panel">
                    <p className="routine-instructions">{visual.instructions}</p>
                    <div className="routine-schedule-groups">
                      {planScheduleGroups.map((group) => (
                        <div className="chips routine-schedule-chips" key={group.id}>
                          {group.label && <span className="routine-schedule-period-chip">{group.label}</span>}
                          {group.windows.map((chip) => <span key={chip.id}><i aria-hidden="true"><AppIcon name="time" /></i>{chip.label}</span>)}
                        </div>
                      ))}
                    </div>
                    <div className="routine-card-actions">
                      {canManageRoutines && requestCheck && (
                        <button type="button" className="request-check routine-list-request" aria-busy={requesting} disabled={requesting || retryBlocked} onClick={() => { void requestNow(assignment.routineId); }}>
                          {requesting ? <span className="button-spinner" aria-hidden="true" /> : null}
                          {requesting ? t('requestingCheck') : next ? t('requestCheckAgain') : t('requestCheckNow')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="routine-list-detail-button"
                        aria-label={t('details')}
                        onClick={() => openDetails(assignment.id)}
                      >
                        <AppIcon name="settings" />
                      </button>
                      {canManageRoutines && onDeleteRoutine && (
                        <button
                          type="button"
                          className="routine-list-delete-button"
                          aria-label={formatMessage(t('deleteRoutine'), { routine: visual.name })}
                          disabled={deletingRoutineId === assignment.routineId || deletingLastRoutine}
                          onClick={() => { void deleteRoutine(assignment, visual.name); }}
                        >
                          <AppIcon name="close" />
                        </button>
                      )}
                    </div>
                    {canManageRoutines && onDeleteRoutine && deletingLastRoutine ? <p className="request-feedback">{t('routineDeleteLastGuard')}</p> : null}
                    {canManageRoutines && requestCheck && (
                      <>
                        {next && <p role="status" className="request-feedback">{t('requestCheckActive')}</p>}
                        {requestStatus === 'sent' && <p role="status" aria-live="polite" className="request-feedback success">{t('requestCheckSent')}</p>}
                        {requestStatus === 'active' && !next && <p role="status" aria-live="polite" className="request-feedback">{t('requestCheckActive')}</p>}
                        {requestStatus === 'error' && (
                          <p role="status" aria-live="polite" className="request-feedback error">
                            {retryBlocked
                              ? `${t('requestCheckError')} ${formatMessage(t('retryInSeconds'), { seconds: retryInSeconds })}`
                              : t('requestCheckError')}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {deleteErrorRoutineId === assignment.routineId && <p role="alert" className="request-feedback error">{t('routineDeleteError')}</p>}
              </section>
            );
          })}
          {!state.routineAssignments.length && !catalogOpen && (
            <section className="card routines-empty-card">
              <h2>{t('noRoutines')}</h2>
              <p>{canAssignRoutine ? t('noRoutinesAddHint') : t('noRoutinesWaitHint')}</p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
