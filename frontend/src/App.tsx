import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { Layout } from './components/Layout'
import { CompanyProvider } from './context/CompanyContext'
import { DashboardPage } from './pages/DashboardPage'
import { FinanceReceivablesPage } from './pages/FinanceReceivablesPage'
import { NcmTaxRatesPage } from './pages/NcmTaxRatesPage'
import { ProductsFinishedPage } from './pages/ProductsFinishedPage'
import { ReportAssistantPage } from './pages/ReportAssistantPage'

function App() {
  return (
    <CompanyProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/finance" element={<FinanceReceivablesPage />} />
            <Route path="/products" element={<ProductsFinishedPage />} />
            <Route path="/ncm-tax-rates" element={<NcmTaxRatesPage />} />
            <Route path="/ai-reports" element={<ReportAssistantPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CompanyProvider>
  )
}

export default App
