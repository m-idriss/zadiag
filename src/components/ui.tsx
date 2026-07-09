import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { AppIcon, type AppIconName } from './Icon';

const joinClassNames = (...names: Array<string | undefined | false>) =>
  names.filter(Boolean).join(' ');

type IconSlot = AppIconName | ReactElement;

export function Card({
  as: Component = 'section',
  className,
  children,
  style,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article';
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <Component className={joinClassNames('card', className)} style={style} {...props}>{children}</Component>;
}

export function Section({
  className,
  title,
  titleId,
  count,
  children,
}: {
  className?: string;
  title?: ReactNode;
  titleId?: string;
  count?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={className} aria-labelledby={titleId}>
      {title ? (
        <div className="section-heading">
          <h2 id={titleId}>{title}</h2>
          {count !== undefined ? <span>{count}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function IconTile({
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

export function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={joinClassNames('settings-switch', checked && 'active')}
      aria-pressed={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden="true" />
    </button>
  );
}

export function ActionButton({
  block = true,
  children,
  className,
  fill = 'solid',
  tone = 'primary',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  block?: boolean;
  fill?: 'solid' | 'outline';
  tone?: 'primary' | 'light' | 'navy' | 'danger';
}) {
  return (
    <button
      type={type}
      className={joinClassNames('action-button', block && 'block', `fill-${fill}`, `tone-${tone}`, className)}
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
    <Card className={joinClassNames('parent-empty-history-card', className)}>
      <IconTile icon={icon} />
      <div>
        <h2>{title}</h2>
        {detail !== undefined ? <p>{detail}</p> : null}
        {children}
      </div>
    </Card>
  );
}
