import { AppIcon } from './Icon';

export function DisclosureToggle({ expanded, showLabel, hideLabel, onToggle }: {
  expanded: boolean;
  showLabel: string;
  hideLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="card-disclosure-toggle"
      aria-label={expanded ? hideLabel : showLabel}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <AppIcon name="chevron-down" className={expanded ? 'expanded' : undefined} />
    </button>
  );
}
