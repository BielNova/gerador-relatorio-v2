import { useState, type FormEvent } from 'react'

import { askReportAssistant, toApiHref } from '../api'
import { EmptyState } from '../components/EmptyState'
import { LoadingBlock } from '../components/LoadingBlock'
import { useCompanyContext } from '../context/CompanyContext'
import type { ReportAssistantResponse } from '../types'
import { formatDecimal } from '../utils'

const quickPrompts = [
  'Liste produtos sem NCM',
  'Mostre NCMs com variação de alíquotas',
  'Produtos do grupo ESSENCIA PURA',
  'Alíquotas do NCM 38099190',
  'Liste NCMs com IPI zero',
]

export function ReportAssistantPage() {
  const { selectedCompany } = useCompanyContext()
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<ReportAssistantResponse | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedCompany || !question.trim()) {
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const response = await askReportAssistant(selectedCompany, question.trim())
      setResult(response)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Falha ao consultar a IA.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Relatórios com IA</h2>
          <p className="panel-copy">
            IA assistida: ela interpreta o pedido, mas o backend só executa relatórios
            fiscais permitidos e filtros determinísticos.
          </p>
        </div>
        <span className="badge">Sem SQL livre</span>
      </header>

      <form className="ai-form" onSubmit={handleSubmit}>
        <div className="field-stack">
          <label htmlFor="ai-question">Pedido do relatório</label>
          <textarea
            id="ai-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ex.: liste produtos sem NCM por grupo"
            rows={4}
          />
        </div>
        <button type="submit" className="action-button" disabled={isLoading}>
          Gerar prévia
        </button>
      </form>

      <div className="prompt-row">
        {quickPrompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingBlock title="Consultando IA" copy="Classificando o pedido com segurança." /> : null}
      {error ? (
        <section className="error-state">
          <h3 className="error-title">Não foi possível gerar o relatório</h3>
          <p className="error-copy">{error}</p>
        </section>
      ) : null}

      {!isLoading && !error && !result ? (
        <EmptyState
          title="Faça uma pergunta fiscal"
          copy="Use um prompt rápido ou descreva uma lista baseada em produtos, NCMs e alíquotas."
        />
      ) : null}

      {result ? (
        <section className="assistant-result">
          <div className="assistant-summary">
            <div>
              <span className="eyebrow">Intent: {result.intent}</span>
              <h3>{result.answer}</h3>
              <p>Prévia de até 50 linhas. Total encontrado: {formatDecimal(result.totalRows)}.</p>
            </div>
            {result.exportUrl ? (
              <a className="action-link" href={toApiHref(result.exportUrl)}>
                Exportar Excel
              </a>
            ) : null}
          </div>

          <div className="table-wrap">
            <div className="table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    {result.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={`${result.intent}-${index}`}>
                      {result.columns.map((column) => (
                        <td key={column}>{formatCell(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  )
}

function formatCell(value: string | number | null): string {
  if (typeof value === 'number') {
    return formatDecimal(value)
  }
  return value ?? ''
}
