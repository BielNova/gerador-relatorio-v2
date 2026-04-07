interface MetricCardProps {
  label: string
  value: string | number
  note?: string
  tone?: 'default' | 'accent' | 'secondary' | 'danger'
}

export function MetricCard({
  label,
  value,
  note,
  tone = 'default',
}: MetricCardProps) {
  return (
    <article className="metric-card" data-tone={tone}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {note ? <p className="metric-note">{note}</p> : null}
    </article>
  )
}
