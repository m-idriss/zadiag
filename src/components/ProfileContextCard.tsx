import { peopleOutline } from 'ionicons/icons';
import { SvgIcon } from './SvgIcon';

type ProfileContextCardProps = {
  title: string;
  subtitle?: string;
  actionIcon?: string;
  actionLabel?: string;
  expanded?: boolean;
  leadingIcon?: string;
  as?: 'button' | 'summary' | 'div';
  className?: string;
  onClick?: () => void;
};

export function ProfileContextCard({
  title,
  subtitle,
  actionIcon,
  actionLabel,
  expanded,
  leadingIcon = peopleOutline,
  as = 'button',
  className,
  onClick,
}: ProfileContextCardProps) {
  const classes = `profile-context-card${className ? ` ${className}` : ''}`;
  const content = <>
    <span className="profile-context-icon" aria-hidden="true"><SvgIcon icon={leadingIcon} /></span>
    <span className="profile-context-summary">
      <strong>{title}</strong>
      {subtitle ? <small>{subtitle}</small> : null}
    </span>
    {actionIcon && actionLabel ? (
      <span className={`profile-context-action${expanded ? ' expanded' : ''}`} aria-hidden="true">
        <SvgIcon icon={actionIcon} />
      </span>
    ) : null}
  </>;

  if (as === 'summary') return <summary className={classes} aria-label={actionLabel}>{content}</summary>;
  if (as === 'div') return <div className={classes}>{content}</div>;
  return <button type="button" className={classes} aria-label={actionLabel} aria-expanded={expanded} onClick={onClick}>{content}</button>;
}
