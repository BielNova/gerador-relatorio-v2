interface EmptyStateProps {
  title: string
  copy: string
}

export function EmptyState({ title, copy }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <h3 className="empty-title">{title}</h3>
      <p className="empty-copy">{copy}</p>
    </section>
  )
}
