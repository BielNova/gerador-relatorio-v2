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

  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
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
            entryPath: '/finance',
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
      const body =
        input instanceof Request
          ? await input.clone().json()
          : init?.body
            ? JSON.parse(String(init.body))
            : {}
      if (String(body.question ?? '').toLowerCase().includes('financeiro')) {
        return jsonResponse({
          company: 'emp0001',
          intent: 'finance_receivables_overdue',
          answer: 'Encontrei 2 boletos vencidos em aberto.',
          columns: [
            'Boleto',
            'Titulo',
            'Contrato',
            'Parcela',
            'Cliente',
            'Vencimento',
            'Valor',
            'Dias vencidos',
            'Status',
          ],
          rows: [
            {
              Boleto: '0000000191',
              Titulo: '00000007',
              Contrato: 'PV00000002',
              Parcela: '001',
              Cliente: 'CONSUMIDOR',
              Vencimento: '2011-07-01',
              Valor: 18,
              'Dias vencidos': 5300,
              Status: 'Em aberto',
            },
          ],
          totalRows: 2,
          exportUrl: '/api/finance/receivables/export.xlsx?company=emp0001&onlyOverdue=true',
        })
      }
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

    if (url.pathname === '/api/finance/dashboard' && company === 'emp0001') {
      const period = url.searchParams.get('period') ?? 'month'
      const periodLabels = {
        month: 'Ultimos 30 dias',
        quarter: 'Ultimos 90 dias',
        year: 'Ultimos 365 dias',
      } as const
      const periodStarts = {
        month: '2026-03-09',
        quarter: '2026-01-08',
        year: '2025-04-08',
      } as const
      return jsonResponse({
        company,
        referenceDate: '2026-04-07',
        period: {
          mode: period,
          label: periodLabels[period as keyof typeof periodLabels] ?? 'Ultimos 30 dias',
          startDate: periodStarts[period as keyof typeof periodStarts] ?? '2026-03-09',
          endDate: '2026-04-07',
          cashFlow: {
            label: periodLabels[period as keyof typeof periodLabels] ?? 'Ultimos 30 dias',
            startDate: periodStarts[period as keyof typeof periodStarts] ?? '2026-03-09',
            endDate: '2026-04-07',
            inflow: 267269.56,
            outflow: 364358.24,
            net: -97088.68,
          },
          payablesDue: { rows: 248, amount: 951348.84 },
          receivablesDue: { rows: 422, amount: 917650.01 },
          received: { rows: 0, amount: 0 },
        },
        cash: {
          sourceDate: '2026-03-25',
          currentCash: -346343.59,
          consolidatedBalance: -691079.33,
          availableCash: -3608076.48,
          committedCash: 3261732.89,
        },
        cashFlow: [
          {
            label: 'Hoje',
            startDate: '2026-04-07',
            endDate: '2026-04-07',
            inflow: 104373.67,
            outflow: 130183.05,
            net: -25809.38,
          },
          {
            label: 'Proximos 7 dias',
            startDate: '2026-04-07',
            endDate: '2026-04-14',
            inflow: 657696.3,
            outflow: 737906.4,
            net: -80210.1,
          },
          {
            label: 'Mes atual',
            startDate: '2026-04-01',
            endDate: '2026-04-07',
            inflow: 267269.56,
            outflow: 364358.24,
            net: -97088.68,
          },
        ],
        projections: [
          {
            days: 7,
            date: '2026-04-14',
            projectedBalance: -245017.17,
            expectedReceivables: 250000,
            expectedPayables: 706719.5,
            projectedResult: -456719.5,
          },
          {
            days: 15,
            date: '2026-04-22',
            projectedBalance: -490600.2,
            expectedReceivables: 550000,
            expectedPayables: 1549586.68,
            projectedResult: -999586.68,
          },
          {
            days: 30,
            date: '2026-05-07',
            projectedBalance: -390935.78,
            expectedReceivables: 1985076.73,
            expectedPayables: 2310384.05,
            projectedResult: -325307.32,
          },
        ],
        payables: {
          open: { rows: 2202, amount: 11051306.87 },
          overdue: { rows: 191, amount: 821165.79 },
          dueToday: { rows: 57, amount: 130183.05 },
          next7Days: { rows: 166, amount: 576536.45 },
          next15Days: { rows: 324, amount: 1419403.63 },
          next30Days: { rows: 474, amount: 2310384.05 },
          byCategory: [
            { category: 'DESPESAS OPERACIONAIS', amount: 219730.09, sharePercent: 50.5 },
          ],
        },
        receivables: {
          open: { rows: 3871, amount: 5179236.06 },
          overdue: { rows: 2064, amount: 2276509.14 },
          operationalOverdue365Days: { rows: 1014, amount: 1602140.35 },
          legacyOverdue365Plus: { rows: 1050, amount: 674368.79 },
          receivedToday: { rows: 0, amount: 0 },
          expected7Days: { rows: 120, amount: 300000 },
          expected15Days: { rows: 400, amount: 800000 },
          expected30Days: { rows: 1357, amount: 1985076.73 },
          aging: [
            { label: 'A vencer', rows: 1807, amount: 2902726.92, minDaysOverdue: null, maxDaysOverdue: 0 },
            { label: '1 a 30 dias', rows: 677, amount: 1037564.07, minDaysOverdue: 1, maxDaysOverdue: 30 },
            { label: 'Acima de 365 dias', rows: 1050, amount: 674368.79, minDaysOverdue: 366, maxDaysOverdue: null },
          ],
        },
        dre: {
          year: 2026,
          month: 2,
          isFallbackMonth: true,
          revenueTotal: 1929985.75,
          costs: 1199916.33,
          expenses: 892485.78,
          grossProfit: 730069.42,
          netProfit: -162416.36,
          revenuePreviousMonth: 2261712.71,
          expensesPreviousMonth: 2499829.29,
          revenueChangePercent: -14.66,
          expensesChangePercent: -16.3,
          expenseCategories: [
            { category: 'DESPESAS OPERACIONAIS', amount: 1188048.59, sharePercent: 56.78 },
            { category: 'DESPESAS COM PESSOAL', amount: 361739.94, sharePercent: 17.29 },
          ],
          revenueCategories: [{ category: 'VENDA', amount: 1929985.75, sharePercent: 100 }],
          revenueEvolution: [
            { year: 2025, month: 3, revenue: 0, expenses: 0, netProfit: 0 },
            { year: 2025, month: 4, revenue: 1805957.51, expenses: 2002495.64, netProfit: -196538.13 },
            { year: 2025, month: 5, revenue: 2043206.79, expenses: 2181958.27, netProfit: -138751.48 },
            { year: 2025, month: 6, revenue: 1929679.99, expenses: 2904010.06, netProfit: -974330.07 },
            { year: 2025, month: 7, revenue: 2786473.62, expenses: 2887773.34, netProfit: -101299.72 },
            { year: 2025, month: 8, revenue: 2013662.56, expenses: 2158174.66, netProfit: -144512.1 },
            { year: 2025, month: 9, revenue: 2073423.1, expenses: 2238142.64, netProfit: -164719.54 },
            { year: 2025, month: 10, revenue: 2232195.1, expenses: 3153216.47, netProfit: -921021.37 },
            { year: 2025, month: 11, revenue: 0, expenses: 0, netProfit: 0 },
            { year: 2025, month: 12, revenue: 2397285.37, expenses: 2395691.66, netProfit: 1593.71 },
            { year: 2026, month: 1, revenue: 2261712.71, expenses: 2499829.29, netProfit: -238116.58 },
            { year: 2026, month: 2, revenue: 1929985.75, expenses: 2092402.11, netProfit: -162416.36 },
          ],
        },
        indicators: {
          averageTicket: 1336.56,
          fixedMonthlyCost: 389856.56,
          breakEvenPoint: 1030611.04,
          profitabilityPercent: -8.42,
        },
        topDebtors: [
          {
            personCode: '00009363',
            personName: 'C.M.C. PRODUTOS QUIMICOS LTDA',
            overdueRows: 279,
            overdueAmount: 545244.45,
          },
        ],
        alerts: [
          {
            level: 'danger',
            title: 'Contas vencidas',
            detail: '191 contas a pagar vencidas.',
            amount: 821165.79,
          },
        ],
        dataQualityNotes: ['Saldo bancario usa FNCBMOV + FNCBLANC + FNCTBCO.'],
        audit: {
          referenceDate: '2026-04-07',
          cash: {
            source: 'FNCBMOV + FNCBLANC + FNCTBCO',
            rule: 'Soma cm_vl_entr - cm_vl_said com cl_data <= referencia e bc_situac = true.',
            accountRows: 10,
            movementRows: 90121,
            startDate: '2000-02-03',
            endDate: '2026-03-25',
            amount: -346343.59,
          },
          payables: {
            rawOpen: { rows: 2202, amount: 11051306.87, startDate: '2025-12-04', endDate: '4202-07-13' },
            operational30Days: { rows: 722, amount: 3261732.89, startDate: '2025-12-04', endDate: '2026-05-07' },
            currentYearOpen: { rows: 1109, amount: 5523971.8, startDate: '2026-02-06', endDate: '2026-12-25' },
            futureOutOfHorizon: { rows: 904, amount: 6950394.53, startDate: '2026-05-08', endDate: '2029-12-16' },
            missingDueDate: { rows: 8, amount: 208.76, startDate: null, endDate: null },
            futureAnomalies2030Plus: { rows: 568, amount: 838970.69, startDate: '2030-01-02', endDate: '4202-07-13' },
          },
          receivables: {
            rawOpen: { rows: 3871, amount: 5179236.06, startDate: '2011-07-01', endDate: '2026-12-26' },
            overdueTotal: { rows: 2064, amount: 2276509.14, startDate: '2011-07-01', endDate: '2026-04-06' },
            overdueOperational365Days: { rows: 1014, amount: 1602140.35, startDate: '2025-04-17', endDate: '2026-04-06' },
            overdueLegacy365Plus: { rows: 1050, amount: 674368.79, startDate: '2011-07-01', endDate: '2025-04-03' },
            expected30Days: { rows: 1357, amount: 1985076.73, startDate: '2026-04-08', endDate: '2026-05-07' },
          },
          dre: {
            dreReferenceMonth: '2026-02',
            dreRevenueTotal: 1929985.75,
            latestInvoiceMonthFromCVFATURA: '2026-03',
            latestInvoiceRevenueTotal: 4690700.24,
            isFallbackMonth: true,
            isStaleComparedToInvoices: true,
          },
          externalComparison: {
            referenceUrl:
              'https://fabrica.valencaquimica.com.br/dashboards/api/financeiro?periodo=mes&empresa=0001',
            runtimeDependency: false,
            note: 'Usado apenas para conferencia manual; o app nao depende desse endpoint.',
          },
        },
      })
    }

    if (url.pathname === '/api/finance/dashboard') {
      const period = url.searchParams.get('period') ?? 'month'
      const periodLabels = {
        month: 'Ultimos 30 dias',
        quarter: 'Ultimos 90 dias',
        year: 'Ultimos 365 dias',
      } as const
      const periodStarts = {
        month: '2026-03-09',
        quarter: '2026-01-08',
        year: '2025-04-08',
      } as const
      return jsonResponse({
        company,
        referenceDate: '2026-04-07',
        period: {
          mode: period,
          label: periodLabels[period as keyof typeof periodLabels] ?? 'Ultimos 30 dias',
          startDate: periodStarts[period as keyof typeof periodStarts] ?? '2026-03-09',
          endDate: '2026-04-07',
          cashFlow: {
            label: periodLabels[period as keyof typeof periodLabels] ?? 'Ultimos 30 dias',
            startDate: periodStarts[period as keyof typeof periodStarts] ?? '2026-03-09',
            endDate: '2026-04-07',
            inflow: 0,
            outflow: 0,
            net: 0,
          },
          payablesDue: { rows: 0, amount: 0 },
          receivablesDue: { rows: 0, amount: 0 },
          received: { rows: 0, amount: 0 },
        },
        cash: {
          sourceDate: null,
          currentCash: 0,
          consolidatedBalance: 0,
          availableCash: 0,
          committedCash: 0,
        },
        cashFlow: [],
        projections: [],
        payables: {
          open: { rows: 0, amount: 0 },
          overdue: { rows: 0, amount: 0 },
          dueToday: { rows: 0, amount: 0 },
          next7Days: { rows: 0, amount: 0 },
          next15Days: { rows: 0, amount: 0 },
          next30Days: { rows: 0, amount: 0 },
          byCategory: [],
        },
        receivables: {
          open: { rows: 0, amount: 0 },
          overdue: { rows: 0, amount: 0 },
          operationalOverdue365Days: { rows: 0, amount: 0 },
          legacyOverdue365Plus: { rows: 0, amount: 0 },
          receivedToday: { rows: 0, amount: 0 },
          expected7Days: { rows: 0, amount: 0 },
          expected15Days: { rows: 0, amount: 0 },
          expected30Days: { rows: 0, amount: 0 },
          aging: [],
        },
        dre: {
          year: 2026,
          month: 4,
          isFallbackMonth: false,
          revenueTotal: 0,
          costs: 0,
          expenses: 0,
          grossProfit: 0,
          netProfit: 0,
          revenuePreviousMonth: 0,
          expensesPreviousMonth: 0,
          revenueChangePercent: null,
          expensesChangePercent: null,
          expenseCategories: [],
          revenueCategories: [],
          revenueEvolution: [],
        },
        indicators: {
          averageTicket: null,
          fixedMonthlyCost: 0,
          breakEvenPoint: null,
          profitabilityPercent: null,
        },
        topDebtors: [],
        alerts: [],
        dataQualityNotes: [],
        audit: {
          referenceDate: '2026-04-07',
          cash: {
            source: 'FNCBMOV + FNCBLANC + FNCTBCO',
            rule: 'Soma cm_vl_entr - cm_vl_said com cl_data <= referencia e bc_situac = true.',
            accountRows: 0,
            movementRows: 0,
            startDate: null,
            endDate: null,
            amount: 0,
          },
          payables: {
            rawOpen: { rows: 0, amount: 0, startDate: null, endDate: null },
            operational30Days: { rows: 0, amount: 0, startDate: null, endDate: null },
            currentYearOpen: { rows: 0, amount: 0, startDate: null, endDate: null },
            futureOutOfHorizon: { rows: 0, amount: 0, startDate: null, endDate: null },
            missingDueDate: { rows: 0, amount: 0, startDate: null, endDate: null },
            futureAnomalies2030Plus: { rows: 0, amount: 0, startDate: null, endDate: null },
          },
          receivables: {
            rawOpen: { rows: 0, amount: 0, startDate: null, endDate: null },
            overdueTotal: { rows: 0, amount: 0, startDate: null, endDate: null },
            overdueOperational365Days: { rows: 0, amount: 0, startDate: null, endDate: null },
            overdueLegacy365Plus: { rows: 0, amount: 0, startDate: null, endDate: null },
            expected30Days: { rows: 0, amount: 0, startDate: null, endDate: null },
          },
          dre: {
            dreReferenceMonth: null,
            dreRevenueTotal: 0,
            latestInvoiceMonthFromCVFATURA: null,
            latestInvoiceRevenueTotal: 0,
            isFallbackMonth: false,
            isStaleComparedToInvoices: false,
          },
          externalComparison: {
            referenceUrl:
              'https://fabrica.valencaquimica.com.br/dashboards/api/financeiro?periodo=mes&empresa=0001',
            runtimeDependency: false,
            note: 'Usado apenas para conferencia manual; o app nao depende desse endpoint.',
          },
        },
      })
    }

    if (url.pathname === '/api/finance/receivables' && company === 'emp0001') {
      const onlyOverdue = url.searchParams.get('onlyOverdue') === 'true'
      return jsonResponse({
        company,
        filters: {
          search: url.searchParams.get('search') ?? '',
          onlyOverdue,
          dueEnd: url.searchParams.get('dueEnd') ?? '2026-05-07',
        },
        summary: {
          totalOpenRows: 3871,
          totalOpenAmount: 5179236.06,
          overdueRows: 2064,
          overdueAmount: 2276509.14,
          dueNextRows: 1385,
          dueNextAmount: 2013567.24,
          receivedMonthRows: 0,
          receivedMonthAmount: 0,
          filteredRows: onlyOverdue ? 2 : 3,
          filteredAmount: onlyOverdue ? 625.4 : 700.4,
        },
        topDebtors: [
          {
            personCode: '00000135',
            personName: 'JF COMERCIO E DISTRIBUICAO LTDA',
            overdueRows: 2,
            overdueAmount: 683,
          },
        ],
        rows: [
          {
            boletoCode: '0000000191',
            titleCode: '00000007',
            contract: 'PV00000002',
            installment: '001',
            personCode: '00000002',
            personName: 'CONSUMIDOR',
            paymentMethod: 'VENDA - A VISTA',
            dueDate: '2011-07-01',
            amount: 18,
            daysOverdue: 5300,
            bankDocument: null,
            statusCode: 1,
            statusLabel: 'Em aberto',
          },
          {
            boletoCode: '0000035196',
            titleCode: '00002938',
            contract: 'FT0000185A',
            installment: '001',
            personCode: '00000135',
            personName: 'JF COMERCIO E DISTRIBUICAO LTDA',
            paymentMethod: 'VENDA - 1 PARCELA',
            dueDate: '2011-08-28',
            amount: 607.4,
            daysOverdue: 5242,
            bankDocument: '000000447',
            statusCode: 1,
            statusLabel: 'Em aberto',
          },
        ],
      })
    }

    if (url.pathname === '/api/finance/receivables') {
      return jsonResponse({
        company,
        filters: {
          search: '',
          onlyOverdue: false,
          dueEnd: '2026-05-07',
        },
        summary: {
          totalOpenRows: 0,
          totalOpenAmount: 0,
          overdueRows: 0,
          overdueAmount: 0,
          dueNextRows: 0,
          dueNextAmount: 0,
          receivedMonthRows: 0,
          receivedMonthAmount: 0,
          filteredRows: 0,
          filteredAmount: 0,
        },
        topDebtors: [],
        rows: [],
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
    window.localStorage.clear()
    document.documentElement.dataset.theme = 'light'
    vi.stubGlobal('fetch', mockApi())
  })

  it('abre o dashboard geral separado por areas', async () => {
    window.history.pushState({}, '', '/dashboard')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Dashboard BI' })).toBeInTheDocument()
    expect(await screen.findByText('Fiscal em foco')).toBeInTheDocument()
    expect(await screen.findByText('Comercial')).toBeInTheDocument()
    expect((await screen.findAllByText('Financeiro')).length).toBeGreaterThan(1)
    expect(await screen.findByText('Estoque e Produto')).toBeInTheDocument()
    expect(await screen.findByText('RH e Folha')).toBeInTheDocument()
  })

  it('permite alternar entre modo claro e escuro', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Escuro' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Escuro' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('arquimedes:theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Claro' }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem('arquimedes:theme')).toBe('light')
  })

  it('abre o financeiro com contas a receber e filtra vencidos', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/finance')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Dashboard Financeiro' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Saldo bancario atual')).toBeInTheDocument()
    expect(screen.getByLabelText('Data de referencia')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ultimos 90 dias' })).toBeInTheDocument()
    expect(await screen.findByText('Observacao por periodo')).toBeInTheDocument()
    expect(await screen.findByText('Conferencia de Dados')).toBeInTheDocument()
    expect(await screen.findByText('Resultado simplificado')).toBeInTheDocument()
    expect(await screen.findByText('CONSUMIDOR')).toBeInTheDocument()
    expect(await screen.findByText('Top inadimplentes no filtro')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ultimos 365 dias' }))
    await waitFor(() => expect(window.location.search).toContain('period=year'))

    await user.click(screen.getByRole('checkbox', { name: 'Somente vencidos' }))

    expect(await screen.findByText('Exibindo 2 registros')).toBeInTheDocument()
  })

  it('gera uma prévia na tela de relatórios com IA', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/ai-reports')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Relatorios com IA' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Pedido do relatorio'), 'Liste produtos sem NCM')
    await user.click(screen.getByRole('button', { name: 'Gerar previa' }))

    expect(await screen.findByText('Encontrei 293 produtos acabados sem NCM.')).toBeInTheDocument()
    expect(await screen.findByText('SEM-NCM-1')).toBeInTheDocument()
  })

  it('gera uma previa financeira na tela de relatorios com IA', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/ai-reports')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Relatorios com IA' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Pedido do relatorio'), 'relatorio financeiro vencido')
    await user.click(screen.getByRole('button', { name: 'Gerar previa' }))

    expect(await screen.findByText('Encontrei 2 boletos vencidos em aberto.')).toBeInTheDocument()
    expect(await screen.findByText('0000000191')).toBeInTheDocument()
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
