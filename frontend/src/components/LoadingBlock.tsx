interface LoadingBlockProps {
  title?: string
  copy?: string
}

export function LoadingBlock({
  title = 'Carregando dados',
  copy = 'Consultando o Postgres ao vivo para montar o relatório.',
}: LoadingBlockProps) {
  return (
    <section className="loading-state">
      <h3 className="loading-title">{title}</h3>
      <p className="loading-copy">{copy}</p>
    </section>
  )
}
