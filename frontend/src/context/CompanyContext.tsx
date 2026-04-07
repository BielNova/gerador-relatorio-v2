/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type PropsWithChildren,
} from 'react'

import { fetchCompanies } from '../api'
import type { CompanyOption } from '../types'

interface CompanyContextValue {
  companies: CompanyOption[]
  selectedCompany: string | null
  selectedCompanyInfo: CompanyOption | null
  isLoading: boolean
  error: string | null
  setSelectedCompany: (company: string) => void
}

const STORAGE_KEY = 'arquimedes:selected-company'
const CompanyContext = createContext<CompanyContextValue | null>(null)

export function CompanyProvider({ children }: PropsWithChildren) {
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [selectedCompany, setSelectedCompanyState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCompanies = useEffectEvent(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const nextCompanies = await fetchCompanies()
      setCompanies(nextCompanies)

      const storedCompany = window.localStorage.getItem(STORAGE_KEY)
      const preferredCompany =
        nextCompanies.find((item) => item.id === storedCompany)?.id ?? nextCompanies[0]?.id ?? null

      setSelectedCompanyState(preferredCompany)
    } catch (nextError) {
      setCompanies([])
      setSelectedCompanyState(null)
      setError(nextError instanceof Error ? nextError.message : 'Erro ao carregar empresas.')
    } finally {
      setIsLoading(false)
    }
  })

  useEffect(() => {
    void loadCompanies()
  }, [])

  function setSelectedCompany(company: string) {
    if (!companies.some((item) => item.id === company)) {
      return
    }

    window.localStorage.setItem(STORAGE_KEY, company)
    startTransition(() => {
      setSelectedCompanyState(company)
    })
  }

  const selectedCompanyInfo =
    companies.find((item) => item.id === selectedCompany) ?? null

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompany,
        selectedCompanyInfo,
        isLoading,
        error,
        setSelectedCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompanyContext() {
  const value = useContext(CompanyContext)
  if (!value) {
    throw new Error('useCompanyContext precisa ser usado dentro de CompanyProvider.')
  }
  return value
}
