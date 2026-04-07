import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import type { ProductsFinishedRow } from './types'

function buildProductsRows() {
  const rows: ProductsFinishedRow[] = Array.from({ length: 293 }, (_, index) => ({
    code: `SEM-NCM-${index + 1}`,
    description: `Produto pendente ${index + 1}`,
    group: 'PENDENCIAS',
    ncm: null,
    icmsRate: null,
    ipiRate: null,
    pisRate: null,
    cofinsRate: null,
  }))

  rows.push({
    code: '01010004',
    description: 'AMACIANTE ABRAÇO',
    group: 'AMACIANTES',
    ncm: '38099190',
    icmsRate: 20.5,
    ipiRate: 0,
    pisRate: 1.65,
    cofinsRate: 7.6,
  })

  return rows
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function mockApi() {
  const productsRows = buildProductsRows()

  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://localhost')
    const company = url.searchParams.get('company')

    if (url.pathname === '/api/companies') {
      return jsonResponse([
        { id: 'emp0001', label: 'Empresa 0001', hasData: true },
        { id: 'emp0002', label: 'Empresa 0002', hasData: true },
        { id: 'emp0003', label: 'Empresa 0003', hasData: true },
        { id: 'emp0004', label: 'Empresa 0004', hasData: true },
      ])
    }

    if (url.pathname === '/api/dashboard/overview' && company === 'emp0001') {
      return jsonResponse({
        company,
        summary: {
          areaCount: 11,
          activeAreaCount: 8,
          totalRows: 4567,
        },
        areas: [
          {
            id: 'comercial',
            label: 'Comercial',
            description: 'Clientes, pedidos e faturamento.',
            tableCount: 5,
            totalRows: 1800,
            hasData: true,
            entryPath: null,
            tables: [
              { name: 'CVCLIFOR', rows: 100 },
              { name: 'CVPEDIDO', rows: 700 },
            ],
          },
          {
            id: 'financeiro',
            label: 'Financeiro',
            description: 'Titulos, boletos e pagamentos.',
            tableCount: 5,
            totalRows: 1400,
            hasData: true,
            entryPath: null,
            tables: [
              { name: 'FNTITUL', rows: 1000 },
              { name: 'FNBOLETO', rows: 400 },
            ],
          },
          {
            id: 'estoque',
            label: 'Estoque e Produto',
            description: 'Produtos e movimentos de estoque.',
            tableCount: 5,
            totalRows: 900,
            hasData: true,
            entryPath: '/products',
            tables: [{ name: 'ESPROD', rows: 900 }],
          },
          {
            id: 'fiscal',
            label: 'Fiscal',
            description: 'NCM e aliquotas.',
            tableCount: 5,
            totalRows: 467,
            hasData: true,
            entryPath: '/ncm-tax-rates',
            tables: [{ name: 'ESCLASSF', rows: 467 }],
          },
          {
            id: 'rh_folha',
            label: 'RH e Folha',
            description: 'Funcionarios e folha.',
            tableCount: 5,
            totalRows: 0,
            hasData: false,
            entryPath: null,
            tables: [{ name: 'FPFUNC', rows: 0 }],
          },
        ],
      })
    }

    if (url.pathname === '/api/dashboard/overview') {
      return jsonResponse({
        company,
        summary: {
          areaCount: 11,
          activeAreaCount: 0,
          totalRows: 0,
        },
        areas: [],
      })
    }

    if (url.pathname === '/api/dashboard/fiscal' && company === 'emp0001') {
      return jsonResponse({
        company,
        summary: {
          totalProducts: 294,
          missingNcmProducts: 293,
          distinctNcms: 2,
          ncmVariationCount: 1,
          duplicateNcmRows: 1,
          productsWithAnyZeroRate: 1,
          zeroIcmsProducts: 0,
          zeroIpiProducts: 1,
          zeroPisProducts: 0,
          zeroCofinsProducts: 0,
        },
        groupIssues: [
          {
            group: 'PENDENCIAS',
            totalRows: 293,
            missingNcmRows: 293,
            zeroRateRows: 0,
            issueRows: 293,
          },
        ],
      })
    }

    if (url.pathname === '/api/dashboard/fiscal') {
      return jsonResponse({
        company,
        summary: {
          totalProducts: 0,
          missingNcmProducts: 0,
          distinctNcms: 0,
          ncmVariationCount: 0,
          duplicateNcmRows: 0,
          productsWithAnyZeroRate: 0,
          zeroIcmsProducts: 0,
          zeroIpiProducts: 0,
          zeroPisProducts: 0,
          zeroCofinsProducts: 0,
        },
        groupIssues: [],
      })
    }

    if (url.pathname === '/api/ai/report-assistant') {
      return jsonResponse({
        company: 'emp0001',
        intent: 'products_missing_ncm',
        answer: 'Encontrei 293 produtos acabados sem NCM.',
        columns: ['Código', 'Descrição', 'Grupo', 'NCM', 'ICMS', 'IPI', 'PIS', 'COFINS'],
        rows: [
          {
            Código: 'SEM-NCM-1',
            Descrição: 'Produto pendente 1',
            Grupo: 'PENDENCIAS',
            NCM: '',
            ICMS: null,
            IPI: null,
            PIS: null,
            COFINS: null,
          },
        ],
        totalRows: 293,
        exportUrl: '/api/reports/products-finished/export.xlsx?company=emp0001&onlyMissingNcm=true',
      })
    }

    if (url.pathname === '/api/reports/products-finished' && company === 'emp0001') {
      return jsonResponse({
        company,
        summary: {
          totalRows: 294,
          missingNcmRows: 293,
          groupCount: 2,
        },
        rows: productsRows,
      })
    }

    if (url.pathname === '/api/reports/products-finished') {
      return jsonResponse({
        company,
        summary: {
          totalRows: 0,
          missingNcmRows: 0,
          groupCount: 0,
        },
        rows: [],
      })
    }

    if (url.pathname === '/api/reports/ncm-tax-rates' && company === 'emp0001') {
      return jsonResponse({
        company,
        summary: {
          totalRows: 3,
          distinctNcms: 2,
          duplicateNcmRows: 1,
        },
        rows: [
          {
            ncm: '38099190',
            icmsRate: 18,
            ipiRate: 0,
            pisRate: 1.65,
            cofinsRate: 7.6,
          },
          {
            ncm: '38099190',
            icmsRate: 12,
            ipiRate: 0,
            pisRate: 1.65,
            cofinsRate: 7.6,
          },
          {
            ncm: '22030000',
            icmsRate: 4,
            ipiRate: 5,
            pisRate: 1.65,
            cofinsRate: 7.6,
          },
        ],
      })
    }

    if (url.pathname === '/api/reports/ncm-tax-rates') {
      return jsonResponse({
        company,
        summary: {
          totalRows: 0,
          distinctNcms: 0,
          duplicateNcmRows: 0,
        },
        rows: [],
      })
    }

    return new Response('not found', { status: 404 })
  })
}

describe('Arquimedes BI app', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/products')
    vi.stubGlobal('fetch', mockApi())
  })

  it('abre o dashboard geral separado por areas', async () => {
    window.history.pushState({}, '', '/dashboard')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Dashboard BI' })).toBeInTheDocument()
    expect(await screen.findByText('Fiscal em foco')).toBeInTheDocument()
    expect(await screen.findByText('Comercial')).toBeInTheDocument()
    expect(await screen.findByText('Financeiro')).toBeInTheDocument()
    expect(await screen.findByText('Estoque e Produto')).toBeInTheDocument()
    expect(await screen.findByText('RH e Folha')).toBeInTheDocument()
  })

  it('gera uma prévia na tela de relatórios com IA', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/ai-reports')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Relatórios com IA' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Pedido do relatório'), 'Liste produtos sem NCM')
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }))

    expect(await screen.findByText('Encontrei 293 produtos acabados sem NCM.')).toBeInTheDocument()
    expect(await screen.findByText('SEM-NCM-1')).toBeInTheDocument()
  })

  it('filtra produtos sem NCM e mostra estado vazio ao trocar de empresa', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Produtos Acabados' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('AMACIANTE ABRAÇO')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Somente sem NCM' }))

    expect(
      await screen.findByText('Exibindo 293 de 294 registros'),
    ).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Empresa'), 'emp0002')

    expect(
      await screen.findByText('Nenhum produto acabado disponível'),
    ).toBeInTheDocument()
  })

  it('leva o NCM clicado para a tela fiscal já filtrada', async () => {
    const user = userEvent.setup()
    render(<App />)

    const ncmButton = await screen.findByRole('button', { name: '38099190' })
    await user.click(ncmButton)

    expect(
      await screen.findByRole('heading', { name: 'NCM e Alíquotas' }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByLabelText('Buscar por NCM')).toHaveValue('38099190')
    })

    expect(screen.getByText('Exibindo 2 de 3 registros')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Somente NCM com variação' }))

    expect(screen.getByText('Exibindo 2 de 3 registros')).toBeInTheDocument()
  })
})
