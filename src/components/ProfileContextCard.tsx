import { peopleOutline } from 'ionicons/icons';
import type { CSSProperties } from 'react';
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
  profileColor?: string;
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
  profileColor,
}: ProfileContextCardProps) {
  const classes = `profile-context-card${profileColor ? ' has-profile-color' : ''}${className ? ` ${className}` : ''}`;
  const style = profileColor ? { '--profile-color': profileColor } as CSSProperties : undefined;
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

  if (as === 'summary') return <summary className={classes} style={style} aria-label={actionLabel}>{content}</summary>;
  if (as === 'div') return <div className={classes} style={style}>{content}</div>;
  return <button type="button" className={classes} style={style} aria-label={actionLabel} aria-expanded={expanded} onClick={onClick}>{content}</button>;
}
