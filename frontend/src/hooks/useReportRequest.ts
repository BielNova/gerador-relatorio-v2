import { useEffect, useEffectEvent, useRef, useState } from 'react'

interface QueryState<T> {
  data: T | null
  error: string | null
  isLoading: boolean
}

export function useReportRequest<T>(
  company: string | null,
  fetcher: (company: string) => Promise<T>,
): QueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const requestIdRef = useRef(0)

  const loadReport = useEffectEvent(async (nextCompany: string) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetcher(nextCompany)
      if (requestId === requestIdRef.current) {
        setData(response)
      }
    } catch (nextError) {
      if (requestId === requestIdRef.current) {
        setData(null)
        setError(nextError instanceof Error ? nextError.message : 'Erro ao carregar relatório.')
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  })

  useEffect(() => {
    if (!company) {
      setData(null)
      setError(null)
      setIsLoading(false)
      return
    }

    void loadReport(company)
  }, [company])

  return { data, error, isLoading }
}
