import { useState, type FormEvent } from 'react';
import type { MembershipRole, ParticipantAccess } from '../domain/models';
import type { MessageKey } from '../services/i18n';

type InviteRole = Exclude<MembershipRole, 'owner'>;

export function RelationshipManager({ access, activeParticipantId, onSelect, onCreate, onInvite, onAccept, t }: {
  access: ParticipantAccess[] | undefined;
  activeParticipantId?: string;
  onSelect?: (participantId: string) => Promise<void>;
  onCreate?: (displayName: string, selfManaged: boolean) => Promise<string>;
  onInvite?: (participantId: string, role: InviteRole) => Promise<{ code: string; expiresAt: string }>;
  onAccept?: (code: string) => Promise<string>;
  t: (key: MessageKey) => string;
}) {
  const [name, setName] = useState('');
  const [selfManaged, setSelfManaged] = useState(false);
  const [inviteRole, setInviteRole] = useState<InviteRole>('caregiver');
  const [joinCode, setJoinCode] = useState('');
  const [invitationCode, setInvitationCode] = useState<string>();
  const [busy, setBusy] = useState<'create' | 'invite' | 'accept'>();
  const [error, setError] = useState(false);
  const activeAccess = (access ?? []).filter((entry) => entry.membership.status === 'active');

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    setError(false);
    setBusy(kind);
    try { await action(); }
    catch (caught) { console.error(caught); setError(true); }
    finally { setBusy(undefined); }
  };
  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!onCreate || !name.trim()) return;
    void run('create', async () => {
      await onCreate(name.trim(), selfManaged);
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
        <p>{t('relationshipManagerHint')}</p>
        <div className="relationship-access-list">
          {activeAccess.map((entry) => (
            <button
              type="button"
              className={entry.participant.id === activeParticipantId ? 'active' : undefined}
              key={entry.participant.id}
              disabled={!onSelect}
              onClick={() => { void onSelect?.(entry.participant.id); }}
            >
              <span><strong>{entry.participant.displayName}</strong><small>{t(`relationshipRole${entry.membership.role[0].toUpperCase()}${entry.membership.role.slice(1)}` as MessageKey)}</small></span>
              {entry.participant.selfManaged ? <small>{t('relationshipSelfManaged')}</small> : null}
            </button>
          ))}
        </div>

        {onCreate ? (
          <form className="relationship-form" onSubmit={create}>
            <h3>{t('relationshipCreateTitle')}</h3>
            <input aria-label={t('relationshipNameLabel')} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder={t('relationshipNameLabel')} />
            <label className="relationship-checkbox"><input type="checkbox" checked={selfManaged} onChange={(event) => setSelfManaged(event.target.checked)} />{t('relationshipSelfManagedLabel')}</label>
            <button type="submit" disabled={busy === 'create' || !name.trim()}>{busy === 'create' ? t('relationshipWorking') : t('relationshipCreateAction')}</button>
          </form>
        ) : null}

        {onInvite && activeParticipantId ? (
          <div className="relationship-form">
            <h3>{t('relationshipInviteTitle')}</h3>
            <select aria-label={t('relationshipInviteRole')} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as InviteRole)}>
              <option value="caregiver">{t('relationshipRoleCaregiver')}</option>
              <option value="participant">{t('relationshipRoleParticipant')}</option>
              <option value="viewer">{t('relationshipRoleViewer')}</option>
            </select>
            <button type="button" disabled={busy === 'invite'} onClick={() => { void run('invite', async () => {
              const invitation = await onInvite(activeParticipantId, inviteRole);
              setInvitationCode(invitation.code);
            }); }}>{busy === 'invite' ? t('relationshipWorking') : t('relationshipInviteAction')}</button>
            {invitationCode ? <output className="relationship-invitation-code">{t('relationshipInvitationCode')}: <strong>{invitationCode}</strong></output> : null}
          </div>
        ) : null}

        {onAccept ? (
          <form className="relationship-form" onSubmit={accept}>
            <h3>{t('relationshipJoinTitle')}</h3>
            <input aria-label={t('relationshipJoinCode')} value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ZI-123456" />
            <button type="submit" disabled={busy === 'accept' || !joinCode.trim()}>{busy === 'accept' ? t('relationshipWorking') : t('relationshipJoinAction')}</button>
          </form>
        ) : null}
        {error ? <small className="settings-action-error">{t('relationshipActionError')}</small> : null}
      </div>
    </section>
  );
}

