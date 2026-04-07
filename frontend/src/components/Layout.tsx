import { NavLink, Outlet } from 'react-router-dom'

import { useCompanyContext } from '../context/CompanyContext'
import { LoadingBlock } from './LoadingBlock'

function getNavClassName({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link active' : 'nav-link'
}

export function Layout() {
  const {
    companies,
    selectedCompany,
    selectedCompanyInfo,
    isLoading,
    error,
    setSelectedCompany,
  } = useCompanyContext()

  if (isLoading) {
    return (
      <div className="app-shell">
        <div className="shell-main">
          <LoadingBlock
            title="Carregando empresas"
            copy="Montando o painel BI inicial do Arquimedes."
          />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-shell">
        <div className="shell-main">
          <section className="error-state">
            <h3 className="error-title">Falha ao iniciar o aplicativo</h3>
            <p className="error-copy">{error}</p>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="shell-header-inner">
          <div className="brand-row">
            <div className="brand-copy">
              <span className="eyebrow">Arquimedes BI</span>
              <h1 className="brand-title">BI operacional separado por areas.</h1>
              <p className="brand-subtitle">
                Dashboard geral, modulos por dominio da empresa e relatorios seguros com IA
                em cima de dados permitidos. Fiscal e o primeiro modulo detalhado.
              </p>
            </div>

            <aside className="brand-stat">
              <span className="brand-stat-label">Fonte de dados</span>
              <strong className="brand-stat-value">Postgres ao vivo</strong>
              <p className="brand-stat-note">
                {selectedCompanyInfo?.hasData
                  ? `${selectedCompanyInfo.label} com dados mapeados.`
                  : `${selectedCompanyInfo?.label ?? 'Empresa'} sem dados nas tabelas-chave.`}
              </p>
            </aside>
          </div>

          <div className="toolbar">
            <nav className="nav-tabs" aria-label="Modulos do BI">
              <NavLink to="/dashboard" className={getNavClassName}>
                Dashboard
              </NavLink>
              <NavLink to="/products" className={getNavClassName}>
                Produtos Acabados
              </NavLink>
              <NavLink to="/ncm-tax-rates" className={getNavClassName}>
                NCM e Aliquotas
              </NavLink>
              <NavLink to="/ai-reports" className={getNavClassName}>
                Relatorios com IA
              </NavLink>
            </nav>

            <div className="toolbar-controls">
              <div className="field-stack">
                <label htmlFor="company-select">Empresa</label>
                <select
                  id="company-select"
                  value={selectedCompany ?? ''}
                  onChange={(event) => setSelectedCompany(event.target.value)}
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  )
}
