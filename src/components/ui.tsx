import type { ButtonHTMLAttributes, CSSProperties, ReactElement, ReactNode } from 'react';
import { AppIcon, type AppIconName } from './Icon';

const joinClassNames = (...names: Array<string | undefined | false>) =>
  names.filter(Boolean).join(' ');

type IconSlot = AppIconName | ReactElement;

function IconTile({
  icon,
  className,
}: {
  icon: IconSlot;
  className?: string;
}) {
  return (
    <span className={joinClassNames('settings-row-icon', className)} aria-hidden="true">
      {typeof icon === 'string' ? <AppIcon name={icon} /> : icon}
    </span>
  );
}

export function ListRow({
  icon,
  title,
  detail,
  children,
  trailing,
  className,
  iconClassName,
  style,
  as: Component = 'div',
  variant = 'settings',
}: {
  icon?: IconSlot;
  title: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  iconClassName?: string;
  style?: CSSProperties;
  as?: 'div' | 'section' | 'article';
  variant?: 'settings' | 'bare';
}) {
  return (
    <Component className={joinClassNames(variant === 'settings' && 'settings-row', className)} style={style}>
      {icon !== undefined ? <IconTile icon={icon} className={iconClassName} /> : null}
      <div className="settings-row-copy">
        <strong>{title}</strong>
        {detail !== undefined ? <small>{detail}</small> : null}
        {children}
      </div>
      {trailing}
    </Component>
  );
}

export function SegmentedControl<T extends string | number>({
  ariaLabel,
  options,
  value,
  onChange,
  className,
}: {
  ariaLabel: string;
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={joinClassNames('settings-locale-toggle', className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          type="button"
          className={option.value === value ? 'active' : ''}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          key={String(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ActionButton({
  children,
  className,
  fill = 'solid',
  tone = 'primary',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  fill?: 'solid' | 'outline';
  tone?: 'primary' | 'light' | 'danger';
}) {
  return (
    <button
      type={type}
      className={joinClassNames(
        'action-button',
        fill === 'outline' && 'fill-outline',
        tone !== 'primary' && `tone-${tone}`,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  detail,
  className,
  children,
}: {
  icon: IconSlot;
  title: ReactNode;
  detail?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={joinClassNames('card', 'parent-empty-history-card', className)}>
      <IconTile icon={icon} />
      <div>
        <h2>{title}</h2>
        {detail !== undefined ? <p>{detail}</p> : null}
        {children}
      </div>
    </section>
  );
}
