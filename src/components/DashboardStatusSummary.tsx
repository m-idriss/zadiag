export interface DashboardStatusItem {
  id: string;
  label: string;
  value: number;
  tone?: 'default' | 'attention';
}

export function DashboardStatusSummary({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: DashboardStatusItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="card dashboard-status-summary" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          className={`${item.tone === 'attention' && item.value > 0 ? 'attention ' : ''}${selectedId === item.id ? 'selected' : ''}`.trim() || undefined}
          aria-pressed={selectedId === item.id}
          key={item.id}
          onClick={() => onSelect(item.id)}
        >
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </button>
      ))}
    </section>
  );
}
