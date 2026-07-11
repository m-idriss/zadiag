import { useState, type FormEvent } from 'react';
import { chevronDownOutline, peopleOutline } from 'ionicons/icons';
import type { MembershipRole, ParticipantAccess, ParticipantMember } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { SvgIcon } from './SvgIcon';

type InviteRole = Exclude<MembershipRole, 'owner'>;

export function RelationshipManager({ access, activeParticipantId, onSelect, onCreate, onInvite, onAccept, onLeave, onRemoveMember, onDeleteParticipant, onCreateRecovery, onRecover, t }: {
  access: ParticipantAccess[] | undefined;
  activeParticipantId?: string;
  onSelect?: (participantId: string) => Promise<void>;
  onCreate?: (displayName: string, selfManaged: boolean) => Promise<string>;
  onInvite?: (participantId: string, role: InviteRole) => Promise<{ code: string; expiresAt: string }>;
  onAccept?: (code: string) => Promise<string>;
  onLeave?: (participantId: string) => Promise<void>;
  onRemoveMember?: (participantId: string, targetUid: string) => Promise<ParticipantMember[]>;
  onDeleteParticipant?: (participantId: string) => Promise<void>;
  onCreateRecovery?: (participantId: string) => Promise<{ recoveryCode: string; expiresAt: string }>;
  onRecover?: (code: string) => Promise<{ participantId: string; recoveryCode?: string; expiresAt?: string }>;
  t: (key: MessageKey) => string;
}) {
  const [name, setName] = useState('');
  const [selfManaged, setSelfManaged] = useState(false);
  const [inviteRole, setInviteRole] = useState<InviteRole>('caregiver');
  const [joinCode, setJoinCode] = useState('');
  const [invitationCode, setInvitationCode] = useState<string>();
  const [recoveryCode, setRecoveryCode] = useState<string>();
  const [recoverCode, setRecoverCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'invite' | 'accept' | 'recovery' | 'remove' | 'delete'>();
  const [removingUid, setRemovingUid] = useState<string>();
  const [error, setError] = useState<MessageKey>();
  const [open, setOpen] = useState(false);
  const activeAccess = (access ?? []).filter((entry) => entry.membership.status === 'active');
  const selectedAccess = activeAccess.find((entry) => entry.participant.id === activeParticipantId) ?? activeAccess[0];
  const selectedParticipantId = selectedAccess?.participant.id;
  const isOwner = selectedAccess?.membership.role === 'owner';
  const removableMembers = selectedAccess?.members?.filter((member) => !member.isCurrentUser && member.status === 'active') ?? [];
  const canLeaveSelectedAccess = !isOwner || (selectedAccess?.members?.filter((member) => member.role === 'owner' && member.status === 'active').length ?? 0) > 1;
  const selectedRoleKey = selectedAccess
    ? `relationshipRole${selectedAccess.membership.role[0].toUpperCase()}${selectedAccess.membership.role.slice(1)}` as MessageKey
    : undefined;

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>, errorKey?: (error: unknown) => MessageKey) => {
    setError(undefined);
    setBusy(kind);
    try { await action(); }
    catch (caught) { console.error(caught); setError(errorKey?.(caught) ?? 'relationshipActionError'); }
    finally { setBusy(undefined); }
  };
  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!onCreate || !name.trim()) return;
    void run('create', async () => {
      const participantId = await onCreate(name.trim(), selfManaged);
      if (!selfManaged && onInvite) {
        const invitation = await onInvite(participantId, 'participant');
        setInvitationCode(invitation.code);
        setInviteRole('participant');
      }
      setName('');
      setSelfManaged(false);
    });
  };
  const accept = (event: FormEvent) => {
    event.preventDefault();
    if (!onAccept || !joinCode.trim()) return;
    void run('accept', async () => {
      await onAccept(joinCode.trim());
      setJoinCode('');
    });
  };

  return (
    <section className="settings-section relationship-manager" aria-labelledby="relationship-manager-heading">
      <h2 id="relationship-manager-heading">{t('relationshipManagerTitle')}</h2>
      <div className="card relationship-manager-card">
        <button type="button" className="relationship-manager-toggle" aria-expanded={open} onClick={() => { setError(undefined); setOpen((current) => !current); }}>
          <span className="relationship-manager-icon" aria-hidden="true"><SvgIcon icon={peopleOutline} /></span>
          <span className="relationship-manager-summary">
            <strong>{selectedAccess?.participant.displayName ?? t('relationshipManagerTitle')}</strong>
            <small>{selectedRoleKey ? t(selectedRoleKey) : t('relationshipManagerHint')}</small>
          </span>
          <span className="relationship-manager-action">{t('relationshipManageAction')}<SvgIcon className={open ? 'expanded' : undefined} icon={chevronDownOutline} /></span>
        </button>
        {open ? <div className="relationship-manager-body">
        <p>{t('relationshipManagerHint')}</p>
        <div className="relationship-access-list">
          {activeAccess.map((entry) => (
            <button
              type="button"
              className={entry.participant.id === activeParticipantId ? 'active' : undefined}
              key={entry.participant.id}
              disabled={!onSelect}
              onClick={() => { setError(undefined); void onSelect?.(entry.participant.id); }}
            >
              <span><strong>{entry.participant.displayName}</strong><small>{t(`relationshipRole${entry.membership.role[0].toUpperCase()}${entry.membership.role.slice(1)}` as MessageKey)}</small></span>
              {entry.participant.selfManaged ? <small>{t('relationshipSelfManaged')}</small> : null}
            </button>
          ))}
        </div>

        {isOwner && selectedParticipantId ? (
          <section className="relationship-team" aria-labelledby="relationship-team-title">
            <div className="relationship-subsection-heading">
              <h3 id="relationship-team-title">{t('relationshipTeamTitle')}</h3>
              <small>{t('relationshipTeamHint')}</small>
            </div>
            {removableMembers.length ? (
              <div className="relationship-member-list">
                {removableMembers.map((member) => {
                  const roleKey = `relationshipRole${member.role[0].toUpperCase()}${member.role.slice(1)}` as MessageKey;
                  return (
                    <div className="relationship-member-row" key={member.uid}>
                      <span><strong>{t(roleKey)}</strong><small>{t('relationshipMemberAccess')}</small></span>
                      {onRemoveMember ? <button type="button" disabled={Boolean(busy)} onClick={() => {
                        if (!window.confirm(t('relationshipRemoveMemberConfirm'))) return;
                        setRemovingUid(member.uid);
                        void run('remove', () => onRemoveMember(selectedParticipantId, member.uid).then(() => undefined))
                          .finally(() => setRemovingUid(undefined));
                      }}>{busy === 'remove' && removingUid === member.uid ? t('relationshipWorking') : t('relationshipRemoveMemberAction')}</button> : null}
                    </div>
                  );
                })}
              </div>
            ) : <p className="relationship-team-empty">{t('relationshipTeamEmpty')}</p>}
          </section>
        ) : null}

        {onCreate ? (
          <details className="relationship-tool">
            <summary>{t('relationshipCreateTitle')}</summary>
          <form className="relationship-form" onSubmit={create}>
            <p>{t('relationshipCreateHint')}</p>
            <input aria-label={t('relationshipNameLabel')} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder={t('relationshipNameLabel')} />
            <label className="relationship-checkbox"><input type="checkbox" checked={selfManaged} onChange={(event) => setSelfManaged(event.target.checked)} />{t('relationshipSelfManagedLabel')}</label>
            <button type="submit" disabled={busy === 'create' || !name.trim()}>{busy === 'create' ? t('relationshipWorking') : t('relationshipCreateAction')}</button>
          </form>
          </details>
        ) : null}
        {invitationCode && !selectedParticipantId ? <output className="relationship-invitation-code">{t('relationshipInvitationCode')}: <strong>{invitationCode}</strong><small>{t('relationshipInvitationNextStep')}</small></output> : null}

        {onInvite && selectedParticipantId && isOwner ? (
          <details className="relationship-tool">
            <summary>{t('relationshipInviteTitle')}</summary>
          <div className="relationship-form">
            <p>{t('relationshipInviteHint')}</p>
            <select aria-label={t('relationshipInviteRole')} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as InviteRole)}>
              <option value="caregiver">{t('relationshipRoleCaregiver')}</option>
              <option value="participant">{t('relationshipInviteParticipantOption')}</option>
              <option value="viewer">{t('relationshipRoleViewer')}</option>
            </select>
            <button type="button" disabled={busy === 'invite'} onClick={() => { void run('invite', async () => {
              const invitation = await onInvite(selectedParticipantId, inviteRole);
              setInvitationCode(invitation.code);
            }); }}>{busy === 'invite' ? t('relationshipWorking') : t('relationshipInviteAction')}</button>
            {invitationCode ? <output className="relationship-invitation-code">{t('relationshipInvitationCode')}: <strong>{invitationCode}</strong><small>{t('relationshipInvitationNextStep')}</small></output> : null}
          </div>
          </details>
        ) : null}

        {onAccept ? (
          <details className="relationship-tool">
            <summary>{t('relationshipJoinTitle')}</summary>
          <form className="relationship-form" onSubmit={accept}>
            <input aria-label={t('relationshipJoinCode')} value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ZI-123456" />
            <button type="submit" disabled={busy === 'accept' || !joinCode.trim()}>{busy === 'accept' ? t('relationshipWorking') : t('relationshipJoinAction')}</button>
          </form>
          </details>
        ) : null}
        {(onCreateRecovery && selectedParticipantId) || onRecover ? (
          <details className="relationship-tool relationship-recovery-tool">
            <summary>{t('relationshipRecoveryOptionsTitle')}</summary>
        {onCreateRecovery && selectedParticipantId ? (
          <div className="relationship-form">
            <h3>{t('relationshipRecoveryTitle')}</h3>
            <button type="button" disabled={busy === 'recovery'} onClick={() => { void run('recovery', async () => {
              const recovery = await onCreateRecovery(selectedParticipantId);
              setRecoveryCode(recovery.recoveryCode);
            }); }}>{t('relationshipRecoveryCreate')}</button>
            {recoveryCode ? <output className="relationship-invitation-code">{t('relationshipRecoveryCode')}: <strong>{recoveryCode}</strong></output> : null}
          </div>
        ) : null}
        {onRecover ? (
          <form className="relationship-form" onSubmit={(event) => {
            event.preventDefault();
            if (!recoverCode.trim()) return;
            void run('recovery', async () => {
              const recovered = await onRecover(recoverCode);
              setRecoverCode('');
              if (recovered.recoveryCode) setRecoveryCode(recovered.recoveryCode);
            });
          }}>
            <h3>{t('relationshipRecoverTitle')}</h3>
            <input aria-label={t('relationshipRecoveryCode')} value={recoverCode} onChange={(event) => setRecoverCode(event.target.value.toUpperCase())} placeholder="PR-2345-6789-ABCD" />
            <button type="submit" disabled={busy === 'recovery' || !recoverCode.trim()}>{t('relationshipRecoverAction')}</button>
          </form>
        ) : null}
          </details>
        ) : null}
        {onLeave && selectedParticipantId && canLeaveSelectedAccess ? (
          <div className="relationship-leave-zone">
          <h3>{t('relationshipPersonalAccessTitle')}</h3>
          <button className="relationship-leave-button" type="button" disabled={Boolean(busy)} onClick={() => {
            if (!window.confirm(t('relationshipLeaveConfirm'))) return;
            void run('accept', async () => {
              await onLeave(selectedParticipantId);
              setOpen(false);
            }, (caught) => {
              const candidate = caught as { code?: unknown; message?: unknown };
              const detail = `${String(candidate?.code ?? '')} ${String(candidate?.message ?? '')}`.toLowerCase();
              return detail.includes('failed-precondition') || detail.includes('last owner') || detail.includes('last_owner')
                ? 'relationshipLeaveLastOwnerError'
                : 'relationshipActionError';
            });
          }}>{t('relationshipLeaveAction')}</button>
          {isOwner ? <small>{t('relationshipLeaveOwnerHint')}</small> : null}
          </div>
        ) : null}
        {isOwner && selectedParticipantId && onDeleteParticipant ? (
          <div className="relationship-delete-zone">
            <h3>{t('relationshipDeleteProfileTitle')}</h3>
            <p>{t('relationshipDeleteProfileHint')}</p>
            <button type="button" disabled={Boolean(busy)} onClick={() => {
              const confirmation = t('relationshipDeleteProfileConfirm').replace('{name}', selectedAccess?.participant.displayName ?? '');
              if (!window.confirm(confirmation)) return;
              void run('delete', async () => {
                await onDeleteParticipant(selectedParticipantId);
                setOpen(false);
              });
            }}>{busy === 'delete' ? t('relationshipWorking') : t('relationshipDeleteProfileAction')}</button>
          </div>
        ) : null}
        {error ? <small className="settings-action-error" role="alert">{t(error)}</small> : null}
        </div> : null}
      </div>
    </section>
  );
}
