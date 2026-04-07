import { Link } from 'react-router-dom'

import { fetchCompanyOverview, fetchFiscalDashboard } from '../api'
import { EmptyState } from '../components/EmptyState'
import { LoadingBlock } from '../components/LoadingBlock'
import { MetricCard } from '../components/MetricCard'
import { useCompanyContext } from '../context/CompanyContext'
import { useReportRequest } from '../hooks/useReportRequest'
import { formatInteger } from '../utils'

export function DashboardPage() {
  const { selectedCompany } = useCompanyContext()
  const overviewRequest = useReportRequest(selectedCompany, fetchCompanyOverview)
  const fiscalRequest = useReportRequest(selectedCompany, fetchFiscalDashboard)
  const overview = overviewRequest.data
  const fiscal = fiscalRequest.data
  const maxAreaRows = Math.max(...(overview?.areas.map((area) => area.totalRows) ?? [0]), 1)
  const maxIssueRows = Math.max(...(fiscal?.groupIssues.map((item) => item.issueRows) ?? [0]), 1)

  return (
    <section className="dashboard-stack">
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Dashboard BI</h2>
            <p className="panel-copy">
              Visao geral separada por areas do Arquimedes. Fiscal continua detalhado porque
              ja virou relatorio operacional, mas Comercial, Financeiro, Estoque, Producao,
              RH, Contabil e demais dominios agora aparecem no lugar certo.
            </p>
          </div>
          <span className="badge">Empresa: {selectedCompany ?? '-'}</span>
        </header>

        {overviewRequest.isLoading ? <LoadingBlock title="Carregando areas da empresa" /> : null}
        {overviewRequest.error ? (
          <section className="error-state">
            <h3 className="error-title">Falha ao carregar as areas</h3>
            <p className="error-copy">{overviewRequest.error}</p>
          </section>
        ) : null}

        {!overviewRequest.isLoading && !overviewRequest.error && overview ? (
          <>
            <div className="metrics-grid">
              <MetricCard label="Areas mapeadas" value={overview.summary.areaCount} tone="accent" />
              <MetricCard label="Areas com dados" value={overview.summary.activeAreaCount} />
              <MetricCard
                label="Linhas rastreadas"
                value={overview.summary.totalRows}
                tone="secondary"
                note="Soma das tabelas-chave por dominio."
              />
              <MetricCard
                label="Modulo fiscal"
                value={fiscal?.summary.totalProducts ?? 0}
                tone="danger"
                note="Produtos acabados com leitura fiscal detalhada."
              />
            </div>

            <div className="area-grid area-grid-wide">
              {overview.areas.map((area) => (
                <article
                  key={area.id}
                  className={`area-card ${area.id === 'fiscal' ? 'active' : ''} ${
                    area.hasData ? 'has-data' : 'is-empty'
                  }`}
                >
                  <span className="area-label">{area.label}</span>
                  <strong>{formatInteger(area.totalRows)} linhas</strong>
                  <p>{area.description}</p>
                  <div className="bar-track area-bar">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${area.totalRows > 0 ? Math.max(6, (area.totalRows / maxAreaRows) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <small>
                    {formatInteger(area.tableCount)} tabelas: {area.tables.map((table) => table.name).join(', ')}
                  </small>
                  {area.entryPath ? (
                    <Link className="area-entry-link" to={area.entryPath}>
                      Abrir modulo
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {fiscalRequest.isLoading ? <LoadingBlock title="Carregando detalhe fiscal" /> : null}
      {fiscalRequest.error ? (
        <section className="error-state">
          <h3 className="error-title">Falha ao carregar o fiscal</h3>
          <p className="error-copy">{fiscalRequest.error}</p>
        </section>
      ) : null}

      {!fiscalRequest.isLoading && !fiscalRequest.error && fiscal?.summary.totalProducts === 0 ? (
        <EmptyState
          title="Nenhum indicador fiscal disponivel"
          copy="A empresa selecionada ainda nao possui produtos acabados para montar o detalhe fiscal."
        />
      ) : null}

      {!fiscalRequest.isLoading && !fiscalRequest.error && fiscal && fiscal.summary.totalProducts > 0 ? (
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">Fiscal em foco</h2>
              <p className="panel-copy">
                Primeiro modulo detalhado: pendencias de NCM, divergencias fiscais e aliquotas
                para priorizar revisao cadastral.
              </p>
            </div>
            <div className="report-meta">
              <Link className="action-link" to="/products?missingNcm=1">
                Ver produtos sem NCM
              </Link>
              <Link className="action-link" to="/ncm-tax-rates?variation=1">
                Ver NCMs com variacao
              </Link>
            </div>
          </header>

          <div className="metrics-grid">
            <MetricCard
              label="Produtos acabados"
              value={fiscal.summary.totalProducts}
              tone="accent"
            />
            <MetricCard
              label="Produtos sem NCM"
              value={fiscal.summary.missingNcmProducts}
              tone={fiscal.summary.missingNcmProducts ? 'danger' : 'default'}
            />
            <MetricCard
              label="NCMs com variacao"
              value={fiscal.summary.ncmVariationCount}
              tone={fiscal.summary.ncmVariationCount ? 'danger' : 'default'}
              note={`${formatInteger(fiscal.summary.duplicateNcmRows)} linhas repetidas por NCM.`}
            />
            <MetricCard
              label="Produtos com aliquota 0"
              value={fiscal.summary.productsWithAnyZeroRate}
              tone={fiscal.summary.productsWithAnyZeroRate ? 'secondary' : 'default'}
            />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="ICMS 0" value={fiscal.summary.zeroIcmsProducts} />
            <MetricCard label="IPI 0" value={fiscal.summary.zeroIpiProducts} />
            <MetricCard label="PIS 0" value={fiscal.summary.zeroPisProducts} />
            <MetricCard label="COFINS 0" value={fiscal.summary.zeroCofinsProducts} />
          </div>

          <div className="insight-grid">
            <article className="insight-card">
              <h3>Grupos com mais pendencias fiscais</h3>
              <div className="ranking-list">
                {fiscal.groupIssues.map((item) => (
                  <Link
                    key={item.group}
                    className="ranking-row"
                    to={`/products?group=${encodeURIComponent(item.group)}`}
                  >
                    <span>{item.group}</span>
                    <strong>{formatInteger(item.issueRows)}</strong>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${Math.max(6, (item.issueRows / maxIssueRows) * 100)}%` }}
                      />
                    </div>
                    <small>
                      {formatInteger(item.missingNcmRows)} sem NCM,{' '}
                      {formatInteger(item.zeroRateRows)} com aliquota 0
                    </small>
                  </Link>
                ))}
              </div>
            </article>

            <article className="insight-card accent">
              <h3>Frentes ativas</h3>
              <p>
                Financeiro e Fiscal ja possuem modulos detalhados. As proximas areas podem
                entrar no mesmo padrao: Comercial, Estoque, Producao, RH ou Contabil.
              </p>
              <Link className="action-link" to="/ai-reports">
                Abrir Relatorios com IA
              </Link>
            </article>
          </div>
        </section>
      ) : null}
    </section>
  )
}
