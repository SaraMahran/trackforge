interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  colorClass?: string;
}

export default function StatCard({ label, value, sub, colorClass = "text-foreground" }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
