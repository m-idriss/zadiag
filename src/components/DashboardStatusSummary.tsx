export interface DashboardStatusItem {
  label: string;
  value: number;
  tone?: 'default' | 'attention';
}

export function DashboardStatusSummary({ label, items }: { label: string; items: DashboardStatusItem[] }) {
  return (
    <section className="card dashboard-status-summary" aria-label={label}>
      {items.map((item) => (
        <div className={item.tone === 'attention' && item.value > 0 ? 'attention' : undefined} key={item.label}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </section>
  );
}
