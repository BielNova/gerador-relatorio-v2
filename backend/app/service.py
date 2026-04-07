from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, timedelta
from unicodedata import combining, normalize

import psycopg
from psycopg import sql

from .business_areas import BUSINESS_AREAS, COMPANY_HEALTH_TABLES
from .config import settings
from .encodings import normalize_decimal, normalize_text
from .models import (
    BusinessAreaSummary,
    BusinessAreaTableMetric,
    CompanyOption,
    CompanyOverviewResponse,
    CompanyOverviewSummary,
    FinanceAlert,
    FinanceAmountMetric,
    FinanceCashSummary,
    FinanceCategoryMetric,
    FinanceDashboardResponse,
    FinanceDreEvolutionPoint,
    FinanceDreSummary,
    FinanceFlowMetric,
    FinanceIndicatorsSummary,
    FinancePayablesSummary,
    FinanceProjectionPoint,
    FinanceReceivableFilters,
    FinanceReceivableRow,
    FinanceReceivableSummary,
    FinanceReceivablesResponse,
    FinanceReceivablesDashboardSummary,
    FinanceTopDebtor,
    FiscalDashboardGroupIssue,
    FiscalDashboardResponse,
    FiscalDashboardSummary,
    NcmTaxRateResponse,
    NcmTaxRateRow,
    NcmTaxRateSummary,
    ProductsFinishedResponse,
    ProductsFinishedRow,
    ProductsFinishedSummary,
)


class InvalidCompanyError(ValueError):
    pass


class FiscalReportService:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url or settings.database_url
        self.allowed_schemas = settings.allowed_schemas

    def validate_company(self, company: str) -> str:
        if company not in self.allowed_schemas:
            raise InvalidCompanyError("Empresa inválida. Use um schema permitido.")
        return company

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(self.database_url)

    def list_companies(self) -> list[CompanyOption]:
        companies: list[CompanyOption] = []
        with self._connect() as conn:
            with conn.cursor() as cur:
                for company in self.allowed_schemas:
                    schema_tables = self._get_schema_tables(cur, company)
                    count = self._sum_table_counts(cur, company, COMPANY_HEALTH_TABLES, schema_tables)
                    suffix = company[-4:]
                    companies.append(
                        CompanyOption(
                            id=company,
                            label=f"Empresa {suffix}",
                            hasData=count > 0,
                        )
                    )
        return companies

    def get_company_overview(self, company: str) -> CompanyOverviewResponse:
        schema = self.validate_company(company)
        areas: list[BusinessAreaSummary] = []

        with self._connect() as conn:
            with conn.cursor() as cur:
                schema_tables = self._get_schema_tables(cur, schema)

                for area in BUSINESS_AREAS:
                    tables: list[BusinessAreaTableMetric] = []
                    for table_name in area.tables:
                        rows = self._count_table_rows(cur, schema, table_name, schema_tables)
                        tables.append(BusinessAreaTableMetric(name=table_name.upper(), rows=rows))

                    total_rows = sum(table.rows for table in tables)
                    areas.append(
                        BusinessAreaSummary(
                            id=area.id,
                            label=area.label,
                            description=area.description,
                            tableCount=len(tables),
                            totalRows=total_rows,
                            hasData=total_rows > 0,
                            entryPath=area.entryPath,
                            tables=tables,
                        )
                    )

        return CompanyOverviewResponse(
            company=schema,
            summary=CompanyOverviewSummary(
                areaCount=len(areas),
                activeAreaCount=sum(1 for area in areas if area.hasData),
                totalRows=sum(area.totalRows for area in areas),
            ),
            areas=areas,
        )

    def _get_schema_tables(self, cur: psycopg.Cursor, schema: str) -> set[str]:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_type IN ('BASE TABLE', 'VIEW')
            """,
            (schema,),
        )
        return {normalize_identifier(row[0]) for row in cur.fetchall()}

    def _count_table_rows(
        self,
        cur: psycopg.Cursor,
        schema: str,
        table_name: str,
        schema_tables: set[str],
    ) -> int:
        if table_name not in schema_tables:
            return 0

        cur.execute(
            sql.SQL("SELECT COUNT(*) FROM {}.{}").format(
                sql.Identifier(schema),
                sql.Identifier(table_name),
            )
        )
        return int(cur.fetchone()[0])

    def _sum_table_counts(
        self,
        cur: psycopg.Cursor,
        schema: str,
        table_names: tuple[str, ...],
        schema_tables: set[str],
    ) -> int:
        return sum(
            self._count_table_rows(cur, schema, table_name, schema_tables)
            for table_name in table_names
        )

    def get_finance_dashboard(self, company: str) -> FinanceDashboardResponse:
        schema = self.validate_company(company)
        today = date.today()
        month_start = date(today.year, today.month, 1)

        with self._connect() as conn:
            with conn.cursor() as cur:
                cash_date, current_cash = self._get_finance_cash_snapshot(cur, schema, today)
                payables = self._get_finance_payables_summary(cur, schema, today)
                receivables = self._get_finance_receivables_dashboard_summary(cur, schema, today)
                cash_flow = self._get_finance_cash_flow(cur, schema, today, month_start)
                projections = self._get_finance_projections(cur, schema, today, current_cash)
                dre = self._get_finance_dre_summary(cur, schema, today)
                paid_ticket_rows = self._count_paid_receivables_for_month(
                    cur,
                    schema,
                    date(dre.year, dre.month, 1),
                )
                top_debtors = build_top_debtors(
                    self._get_finance_receivable_rows(
                        cur=cur,
                        schema=schema,
                        today=today,
                        due_end=today,
                        only_overdue=True,
                    )
                )

        committed_cash = round(
            payables.overdue.amount + payables.dueToday.amount + payables.next30Days.amount,
            2,
        )
        available_cash = round(current_cash - committed_cash, 2)
        consolidated_balance = round(
            current_cash + receivables.open.amount - payables.open.amount,
            2,
        )
        indicators = self._build_finance_indicators(dre, paid_ticket_rows)
        alerts = self._build_finance_alerts(
            payables=payables,
            dre=dre,
            projections=projections,
        )

        return FinanceDashboardResponse(
            company=schema,
            referenceDate=today,
            cash=FinanceCashSummary(
                sourceDate=cash_date,
                currentCash=current_cash,
                consolidatedBalance=consolidated_balance,
                availableCash=available_cash,
                committedCash=committed_cash,
            ),
            cashFlow=cash_flow,
            projections=projections,
            payables=payables,
            receivables=receivables,
            dre=dre,
            indicators=indicators,
            topDebtors=top_debtors,
            alerts=alerts,
            dataQualityNotes=[
                "Caixa e projecao usam FNFCLANC.FL_SALDO e entradas/saidas do fluxo de caixa.",
                "Contas a pagar em aberto usam FNTITUL.TI_TIPO = 'P' e TI_PAGTO vazio.",
                "Contas a receber em aberto usam FNBOLETO.BO_PG_ST = 1.",
                "DRE usa FNDRE; se o mes atual estiver zerado, o dashboard usa o ultimo mes com movimento.",
                "Custos sao uma classificacao inicial: grupos DRE com 'OPERACIONAIS' entram como custo; os demais grupos de saida entram como despesa.",
            ],
        )

    def _get_finance_cash_snapshot(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
    ) -> tuple[date | None, float]:
        cur.execute(
            sql.SQL(
                """
                SELECT fl_data, fl_saldo
                FROM {}.fnfclanc
                WHERE fl_data <= %s
                ORDER BY fl_data DESC
                LIMIT 1
                """
            ).format(sql.Identifier(schema)),
            (today,),
        )
        row = cur.fetchone()
        if row is None:
            return None, 0.0
        source_date, balance = row
        return source_date, as_money(balance)

    def _get_finance_payables_summary(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
    ) -> FinancePayablesSummary:
        next_7 = today + timedelta(days=7)
        next_15 = today + timedelta(days=15)
        next_30 = today + timedelta(days=30)

        cur.execute(
            sql.SQL(
                """
                SELECT
                  COUNT(*) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                  ) AS open_rows,
                  COALESCE(SUM(t.ti_valor) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                  ), 0) AS open_amount,
                  COUNT(*) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                      AND t.ti_vcto < %s
                  ) AS overdue_rows,
                  COALESCE(SUM(t.ti_valor) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                      AND t.ti_vcto < %s
                  ), 0) AS overdue_amount,
                  COUNT(*) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                      AND t.ti_vcto = %s
                  ) AS due_today_rows,
                  COALESCE(SUM(t.ti_valor) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                      AND t.ti_vcto = %s
                  ), 0) AS due_today_amount,
                  COUNT(*) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                      AND t.ti_vcto > %s AND t.ti_vcto <= %s
                  ) AS next_7_rows,
                  COALESCE(SUM(t.ti_valor) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                      AND t.ti_vcto > %s AND t.ti_vcto <= %s
                  ), 0) AS next_7_amount,
                  COUNT(*) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                      AND t.ti_vcto > %s AND t.ti_vcto <= %s
                  ) AS next_15_rows,
                  COALESCE(SUM(t.ti_valor) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                      AND t.ti_vcto > %s AND t.ti_vcto <= %s
                  ), 0) AS next_15_amount,
                  COUNT(*) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                      AND t.ti_vcto > %s AND t.ti_vcto <= %s
                  ) AS next_30_rows,
                  COALESCE(SUM(t.ti_valor) FILTER (
                    WHERE t.ti_tipo = 'P' AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                      AND t.ti_vcto > %s AND t.ti_vcto <= %s
                  ), 0) AS next_30_amount
                FROM {}.fntitul AS t
                """
            ).format(sql.Identifier(schema)),
            (
                today,
                today,
                today,
                today,
                today,
                next_7,
                today,
                next_7,
                today,
                next_15,
                today,
                next_15,
                today,
                next_30,
                today,
                next_30,
            ),
        )
        (
            open_rows,
            open_amount,
            overdue_rows,
            overdue_amount,
            due_today_rows,
            due_today_amount,
            next_7_rows,
            next_7_amount,
            next_15_rows,
            next_15_amount,
            next_30_rows,
            next_30_amount,
        ) = cur.fetchone()

        return FinancePayablesSummary(
            open=FinanceAmountMetric(rows=int(open_rows), amount=as_money(open_amount)),
            overdue=FinanceAmountMetric(rows=int(overdue_rows), amount=as_money(overdue_amount)),
            dueToday=FinanceAmountMetric(rows=int(due_today_rows), amount=as_money(due_today_amount)),
            next7Days=FinanceAmountMetric(rows=int(next_7_rows), amount=as_money(next_7_amount)),
            next15Days=FinanceAmountMetric(rows=int(next_15_rows), amount=as_money(next_15_amount)),
            next30Days=FinanceAmountMetric(rows=int(next_30_rows), amount=as_money(next_30_amount)),
            byCategory=self._get_finance_payables_by_category(cur, schema, today, next_30),
        )

    def _get_finance_payables_by_category(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
        due_end: date,
    ) -> list[FinanceCategoryMetric]:
        cur.execute(
            sql.SQL(
                """
                SELECT
                  NULLIF(TRIM(g.gp_descr), '') AS category,
                  COALESCE(SUM(t.ti_valor), 0) AS amount
                FROM {}.fntitul AS t
                LEFT JOIN {}.fnpagam AS p
                  ON p.tg_codigo = t.ti_pagam
                LEFT JOIN {}.fngpagam AS g
                  ON g.gp_codigo = p.tg_gpagam
                WHERE t.ti_tipo = 'P'
                  AND TRIM(COALESCE(t.ti_pagto, '')) = ''
                  AND (t.ti_vcto < %s OR (t.ti_vcto >= %s AND t.ti_vcto <= %s))
                GROUP BY g.gp_descr
                ORDER BY amount DESC
                LIMIT 10
                """
            ).format(
                sql.Identifier(schema),
                sql.Identifier(schema),
                sql.Identifier(schema),
            ),
            (today, today, due_end),
        )
        rows = [(normalize_text(category) or "Sem categoria", as_money(amount)) for category, amount in cur.fetchall()]
        total = sum(amount for _, amount in rows)
        return [
            FinanceCategoryMetric(
                category=category,
                amount=amount,
                sharePercent=percentage(amount, total) or 0,
            )
            for category, amount in rows
        ]

    def _get_finance_receivables_dashboard_summary(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
    ) -> FinanceReceivablesDashboardSummary:
        next_7 = today + timedelta(days=7)
        next_15 = today + timedelta(days=15)
        next_30 = today + timedelta(days=30)
        cur.execute(
            sql.SQL(
                """
                SELECT
                  COUNT(*) FILTER (WHERE b.bo_pg_st = 1) AS open_rows,
                  COALESCE(SUM(b.bo_valor) FILTER (WHERE b.bo_pg_st = 1), 0) AS open_amount,
                  COUNT(*) FILTER (WHERE b.bo_pg_st = 1 AND b.bo_vcto < %s) AS overdue_rows,
                  COALESCE(SUM(b.bo_valor) FILTER (WHERE b.bo_pg_st = 1 AND b.bo_vcto < %s), 0) AS overdue_amount,
                  COUNT(*) FILTER (WHERE b.bo_pg_dt = %s) AS received_today_rows,
                  COALESCE(SUM(b.bo_pg_vlr) FILTER (WHERE b.bo_pg_dt = %s), 0) AS received_today_amount,
                  COUNT(*) FILTER (WHERE b.bo_pg_st = 1 AND b.bo_vcto > %s AND b.bo_vcto <= %s) AS expected_7_rows,
                  COALESCE(SUM(b.bo_valor) FILTER (WHERE b.bo_pg_st = 1 AND b.bo_vcto > %s AND b.bo_vcto <= %s), 0) AS expected_7_amount,
                  COUNT(*) FILTER (WHERE b.bo_pg_st = 1 AND b.bo_vcto > %s AND b.bo_vcto <= %s) AS expected_15_rows,
                  COALESCE(SUM(b.bo_valor) FILTER (WHERE b.bo_pg_st = 1 AND b.bo_vcto > %s AND b.bo_vcto <= %s), 0) AS expected_15_amount,
                  COUNT(*) FILTER (WHERE b.bo_pg_st = 1 AND b.bo_vcto > %s AND b.bo_vcto <= %s) AS expected_30_rows,
                  COALESCE(SUM(b.bo_valor) FILTER (WHERE b.bo_pg_st = 1 AND b.bo_vcto > %s AND b.bo_vcto <= %s), 0) AS expected_30_amount
                FROM {}.fnboleto AS b
                """
            ).format(sql.Identifier(schema)),
            (
                today,
                today,
                today,
                today,
                today,
                next_7,
                today,
                next_7,
                today,
                next_15,
                today,
                next_15,
                today,
                next_30,
                today,
                next_30,
            ),
        )
        (
            open_rows,
            open_amount,
            overdue_rows,
            overdue_amount,
            received_today_rows,
            received_today_amount,
            expected_7_rows,
            expected_7_amount,
            expected_15_rows,
            expected_15_amount,
            expected_30_rows,
            expected_30_amount,
        ) = cur.fetchone()
        return FinanceReceivablesDashboardSummary(
            open=FinanceAmountMetric(rows=int(open_rows), amount=as_money(open_amount)),
            overdue=FinanceAmountMetric(rows=int(overdue_rows), amount=as_money(overdue_amount)),
            receivedToday=FinanceAmountMetric(
                rows=int(received_today_rows),
                amount=as_money(received_today_amount),
            ),
            expected7Days=FinanceAmountMetric(rows=int(expected_7_rows), amount=as_money(expected_7_amount)),
            expected15Days=FinanceAmountMetric(rows=int(expected_15_rows), amount=as_money(expected_15_amount)),
            expected30Days=FinanceAmountMetric(rows=int(expected_30_rows), amount=as_money(expected_30_amount)),
        )

    def _get_finance_cash_flow(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
        month_start: date,
    ) -> list[FinanceFlowMetric]:
        return [
            self._get_finance_cash_flow_metric(cur, schema, "Hoje", today, today),
            self._get_finance_cash_flow_metric(
                cur,
                schema,
                "Proximos 7 dias",
                today,
                today + timedelta(days=7),
            ),
            self._get_finance_cash_flow_metric(cur, schema, "Mes atual", month_start, today),
        ]

    def _get_finance_cash_flow_metric(
        self,
        cur: psycopg.Cursor,
        schema: str,
        label: str,
        start_date: date,
        end_date: date,
    ) -> FinanceFlowMetric:
        cur.execute(
            sql.SQL(
                """
                SELECT
                  COALESCE(SUM(COALESCE(fl_pv_entr, 0) + COALESCE(fl_er_entr, 0)), 0) AS inflow,
                  COALESCE(SUM(COALESCE(fl_pv_said, 0) + COALESCE(fl_sr_said, 0)), 0) AS outflow
                FROM {}.fnfclanc
                WHERE fl_data BETWEEN %s AND %s
                """
            ).format(sql.Identifier(schema)),
            (start_date, end_date),
        )
        inflow, outflow = cur.fetchone()
        inflow_value = as_money(inflow)
        outflow_value = as_money(outflow)
        return FinanceFlowMetric(
            label=label,
            startDate=start_date,
            endDate=end_date,
            inflow=inflow_value,
            outflow=outflow_value,
            net=round(inflow_value - outflow_value, 2),
        )

    def _get_finance_projections(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
        current_cash: float,
    ) -> list[FinanceProjectionPoint]:
        projections: list[FinanceProjectionPoint] = []
        for days in (7, 15, 30):
            target = today + timedelta(days=days)
            projected_balance = self._get_finance_projected_balance(
                cur,
                schema,
                target,
                current_cash,
            )
            expected_receivables = self._get_expected_receivables_amount(cur, schema, today, target)
            expected_payables = self._get_expected_payables_amount(cur, schema, today, target)
            projections.append(
                FinanceProjectionPoint(
                    days=days,
                    date=target,
                    projectedBalance=projected_balance,
                    expectedReceivables=expected_receivables,
                    expectedPayables=expected_payables,
                    projectedResult=round(expected_receivables - expected_payables, 2),
                )
            )
        return projections

    def _get_finance_projected_balance(
        self,
        cur: psycopg.Cursor,
        schema: str,
        target: date,
        fallback: float,
    ) -> float:
        cur.execute(
            sql.SQL(
                """
                SELECT fl_saldo
                FROM {}.fnfclanc
                WHERE fl_data <= %s
                ORDER BY fl_data DESC
                LIMIT 1
                """
            ).format(sql.Identifier(schema)),
            (target,),
        )
        row = cur.fetchone()
        if row is None:
            return fallback
        return as_money(row[0])

    def _get_expected_receivables_amount(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
        target: date,
    ) -> float:
        cur.execute(
            sql.SQL(
                """
                SELECT COALESCE(SUM(bo_valor), 0)
                FROM {}.fnboleto
                WHERE bo_pg_st = 1
                  AND bo_vcto > %s
                  AND bo_vcto <= %s
                """
            ).format(sql.Identifier(schema)),
            (today, target),
        )
        return as_money(cur.fetchone()[0])

    def _get_expected_payables_amount(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
        target: date,
    ) -> float:
        cur.execute(
            sql.SQL(
                """
                SELECT COALESCE(SUM(ti_valor), 0)
                FROM {}.fntitul
                WHERE ti_tipo = 'P'
                  AND TRIM(COALESCE(ti_pagto, '')) = ''
                  AND ti_vcto > %s
                  AND ti_vcto <= %s
                """
            ).format(sql.Identifier(schema)),
            (today, target),
        )
        return as_money(cur.fetchone()[0])

    def _get_finance_dre_summary(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
    ) -> FinanceDreSummary:
        cur.execute(
            sql.SQL(
                """
                SELECT
                  dr_ano,
                  dr_tipo,
                  NULLIF(TRIM(dr_grupo), '') AS category,
                  NULLIF(TRIM(dr_descr), '') AS description,
                  dr_tot01, dr_tot02, dr_tot03, dr_tot04, dr_tot05, dr_tot06,
                  dr_tot07, dr_tot08, dr_tot09, dr_tot10, dr_tot11, dr_tot12
                FROM {}.fndre
                ORDER BY dr_ano
                """
            ).format(sql.Identifier(schema))
        )

        month_data: dict[tuple[int, int], dict[str, object]] = defaultdict(make_dre_month_bucket)
        for row in cur.fetchall():
            year_value, kind_value, category_value, description_value, *totals = row
            year = int(year_value)
            kind = normalize_text(kind_value) or ""
            category = normalize_text(category_value) or normalize_text(description_value) or "Sem categoria"

            for month, total in enumerate(totals, start=1):
                amount = as_money(total)
                if amount == 0:
                    continue

                bucket = month_data[(year, month)]
                if kind == "E":
                    bucket["revenue"] = float(bucket["revenue"]) + amount
                    dict_add(bucket["revenueCategories"], category, amount)
                    continue

                if kind == "S":
                    expense_amount = abs(amount)
                    bucket["expensesTotal"] = float(bucket["expensesTotal"]) + expense_amount
                    if is_cost_category(category):
                        bucket["costs"] = float(bucket["costs"]) + expense_amount
                    else:
                        bucket["expenses"] = float(bucket["expenses"]) + expense_amount
                    dict_add(bucket["expenseCategories"], category, expense_amount)

        cutoff = (today.year, today.month)
        active_months = [
            key
            for key, values in month_data.items()
            if key <= cutoff
            and (float(values["revenue"]) != 0 or float(values["expensesTotal"]) != 0)
        ]
        reference_key = max(active_months) if active_months else cutoff
        reference = month_data[reference_key]
        previous_key = previous_month_key(reference_key)
        previous = month_data[previous_key]

        revenue = round(float(reference["revenue"]), 2)
        costs = round(float(reference["costs"]), 2)
        expenses = round(float(reference["expenses"]), 2)
        expenses_total = round(float(reference["expensesTotal"]), 2)
        gross_profit = round(revenue - costs, 2)
        net_profit = round(revenue - expenses_total, 2)
        previous_revenue = round(float(previous["revenue"]), 2)
        previous_expenses = round(float(previous["expensesTotal"]), 2)

        return FinanceDreSummary(
            year=reference_key[0],
            month=reference_key[1],
            isFallbackMonth=reference_key != cutoff,
            revenueTotal=revenue,
            costs=costs,
            expenses=expenses,
            grossProfit=gross_profit,
            netProfit=net_profit,
            revenuePreviousMonth=previous_revenue,
            expensesPreviousMonth=previous_expenses,
            revenueChangePercent=percentage_change(revenue, previous_revenue),
            expensesChangePercent=percentage_change(expenses_total, previous_expenses),
            expenseCategories=build_category_metrics(reference["expenseCategories"], expenses_total),
            revenueCategories=build_category_metrics(reference["revenueCategories"], revenue),
            revenueEvolution=build_dre_evolution(month_data, reference_key),
        )

    def _count_paid_receivables_for_month(
        self,
        cur: psycopg.Cursor,
        schema: str,
        month_start: date,
    ) -> int:
        month_end = next_month_start(month_start) - timedelta(days=1)
        cur.execute(
            sql.SQL(
                """
                SELECT COUNT(*)
                FROM {}.fnboleto
                WHERE bo_pg_dt BETWEEN %s AND %s
                """
            ).format(sql.Identifier(schema)),
            (month_start, month_end),
        )
        return int(cur.fetchone()[0])

    def _build_finance_indicators(
        self,
        dre: FinanceDreSummary,
        paid_ticket_rows: int,
    ) -> FinanceIndicatorsSummary:
        average_ticket = (
            round(dre.revenueTotal / paid_ticket_rows, 2)
            if paid_ticket_rows > 0 and dre.revenueTotal
            else None
        )
        fixed_cost = sum(
            category.amount
            for category in dre.expenseCategories
            if "FIXAS" in normalize_search(category.category).upper()
            or "PESSOAL" in normalize_search(category.category).upper()
        )
        gross_margin = dre.grossProfit / dre.revenueTotal if dre.revenueTotal else 0
        break_even = round(fixed_cost / gross_margin, 2) if gross_margin > 0 else None
        profitability = percentage(dre.netProfit, dre.revenueTotal)
        return FinanceIndicatorsSummary(
            averageTicket=average_ticket,
            fixedMonthlyCost=round(fixed_cost, 2),
            breakEvenPoint=break_even,
            profitabilityPercent=profitability,
        )

    def _build_finance_alerts(
        self,
        payables: FinancePayablesSummary,
        dre: FinanceDreSummary,
        projections: list[FinanceProjectionPoint],
    ) -> list[FinanceAlert]:
        alerts: list[FinanceAlert] = []
        if payables.overdue.rows > 0:
            alerts.append(
                FinanceAlert(
                    level="danger",
                    title="Contas vencidas",
                    detail=f"{payables.overdue.rows} contas a pagar vencidas.",
                    amount=payables.overdue.amount,
                )
            )

        negative_projection = next(
            (projection for projection in projections if projection.projectedBalance < 0),
            None,
        )
        if negative_projection:
            alerts.append(
                FinanceAlert(
                    level="danger",
                    title="Falta de caixa prevista",
                    detail=f"Saldo projetado negativo em {negative_projection.days} dias.",
                    amount=negative_projection.projectedBalance,
                )
            )

        if dre.revenueChangePercent is not None and dre.revenueChangePercent <= -10:
            alerts.append(
                FinanceAlert(
                    level="warning",
                    title="Queda de receita",
                    detail="Receita abaixo do mes anterior no DRE de referencia.",
                    amount=dre.revenueChangePercent,
                )
            )

        if dre.expensesChangePercent is not None and dre.expensesChangePercent >= 10:
            alerts.append(
                FinanceAlert(
                    level="warning",
                    title="Aumento de despesas",
                    detail="Despesas acima do mes anterior no DRE de referencia.",
                    amount=dre.expensesChangePercent,
                )
            )

        if not alerts:
            alerts.append(
                FinanceAlert(
                    level="info",
                    title="Sem alertas criticos",
                    detail="Nenhuma regra automatica encontrou risco imediato.",
                )
            )
        return alerts

    def get_finance_receivables_report(
        self,
        company: str,
        search: str = "",
        only_overdue: bool = False,
        due_end: date | None = None,
    ) -> FinanceReceivablesResponse:
        schema = self.validate_company(company)
        today = date.today()
        effective_due_end = due_end or today + timedelta(days=30)
        month_start = date(today.year, today.month, 1)

        with self._connect() as conn:
            with conn.cursor() as cur:
                summary = self._get_finance_receivables_summary(
                    cur=cur,
                    schema=schema,
                    today=today,
                    due_next_end=today + timedelta(days=30),
                    month_start=month_start,
                )
                rows = self._get_finance_receivable_rows(
                    cur=cur,
                    schema=schema,
                    today=today,
                    due_end=effective_due_end,
                    only_overdue=only_overdue,
                )

        query = normalize_search(search)
        filtered_rows = [
            row
            for row in rows
            if not query
            or any(
                query in normalize_search(value)
                for value in (
                    row.boletoCode,
                    row.titleCode or "",
                    row.contract or "",
                    row.installment or "",
                    row.personCode,
                    row.personName,
                    row.paymentMethod or "",
                    row.bankDocument or "",
                )
            )
        ]

        filtered_amount = sum(row.amount for row in filtered_rows)
        summary.filteredRows = len(filtered_rows)
        summary.filteredAmount = round(filtered_amount, 2)

        return FinanceReceivablesResponse(
            company=schema,
            filters=FinanceReceivableFilters(
                search=search,
                onlyOverdue=only_overdue,
                dueEnd=effective_due_end,
            ),
            summary=summary,
            topDebtors=build_top_debtors(filtered_rows),
            rows=filtered_rows,
        )

    def _get_finance_receivables_summary(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
        due_next_end: date,
        month_start: date,
    ) -> FinanceReceivableSummary:
        cur.execute(
            sql.SQL(
                """
                SELECT
                  COUNT(*) FILTER (WHERE b.bo_pg_st = 1) AS total_open_rows,
                  COALESCE(SUM(b.bo_valor) FILTER (WHERE b.bo_pg_st = 1), 0) AS total_open_amount,
                  COUNT(*) FILTER (WHERE b.bo_pg_st = 1 AND b.bo_vcto < %s) AS overdue_rows,
                  COALESCE(SUM(b.bo_valor) FILTER (WHERE b.bo_pg_st = 1 AND b.bo_vcto < %s), 0) AS overdue_amount,
                  COUNT(*) FILTER (
                    WHERE b.bo_pg_st = 1 AND b.bo_vcto BETWEEN %s AND %s
                  ) AS due_next_rows,
                  COALESCE(SUM(b.bo_valor) FILTER (
                    WHERE b.bo_pg_st = 1 AND b.bo_vcto BETWEEN %s AND %s
                  ), 0) AS due_next_amount,
                  COUNT(*) FILTER (WHERE b.bo_pg_dt BETWEEN %s AND %s) AS received_month_rows,
                  COALESCE(SUM(b.bo_pg_vlr) FILTER (WHERE b.bo_pg_dt BETWEEN %s AND %s), 0) AS received_month_amount
                FROM {}.fnboleto AS b
                """
            ).format(sql.Identifier(schema)),
            (
                today,
                today,
                today,
                due_next_end,
                today,
                due_next_end,
                month_start,
                today,
                month_start,
                today,
            ),
        )
        (
            total_open_rows,
            total_open_amount,
            overdue_rows,
            overdue_amount,
            due_next_rows,
            due_next_amount,
            received_month_rows,
            received_month_amount,
        ) = cur.fetchone()

        return FinanceReceivableSummary(
            totalOpenRows=int(total_open_rows),
            totalOpenAmount=normalize_decimal(total_open_amount) or 0,
            overdueRows=int(overdue_rows),
            overdueAmount=normalize_decimal(overdue_amount) or 0,
            dueNextRows=int(due_next_rows),
            dueNextAmount=normalize_decimal(due_next_amount) or 0,
            receivedMonthRows=int(received_month_rows),
            receivedMonthAmount=normalize_decimal(received_month_amount) or 0,
            filteredRows=0,
            filteredAmount=0,
        )

    def _get_finance_receivable_rows(
        self,
        cur: psycopg.Cursor,
        schema: str,
        today: date,
        due_end: date,
        only_overdue: bool,
    ) -> list[FinanceReceivableRow]:
        cur.execute(
            sql.SQL(
                """
                SELECT
                  TRIM(b.bo_codigo) AS boleto_code,
                  NULLIF(TRIM(t.ti_titul), '') AS title_code,
                  NULLIF(TRIM(t.ti_contr), '') AS contract,
                  NULLIF(TRIM(t.ti_parc), '') AS installment,
                  TRIM(b.bo_pess) AS person_code,
                  NULLIF(TRIM(p.pe_nome), '') AS person_name,
                  NULLIF(TRIM(r.ct_descr), '') AS payment_method,
                  b.bo_vcto AS due_date,
                  b.bo_valor AS amount,
                  NULLIF(TRIM(b.bo_bco_nr), '') AS bank_document,
                  b.bo_pg_st AS status_code
                FROM {}.fnboleto AS b
                LEFT JOIN {}.fntitul AS t
                  ON t.ti_boleto = b.bo_codigo
                LEFT JOIN {}.stpess AS p
                  ON p.pe_codigo = b.bo_pess
                LEFT JOIN {}.fnreceb AS r
                  ON r.ct_codigo = t.ti_receb
                WHERE b.bo_pg_st = 1
                  AND b.bo_vcto <= %s
                  AND (%s = FALSE OR b.bo_vcto < %s)
                ORDER BY b.bo_vcto ASC, TRIM(COALESCE(p.pe_nome, '')), TRIM(b.bo_codigo)
                """
            ).format(
                sql.Identifier(schema),
                sql.Identifier(schema),
                sql.Identifier(schema),
                sql.Identifier(schema),
            ),
            (due_end, only_overdue, today),
        )

        rows: list[FinanceReceivableRow] = []
        for (
            boleto_code,
            title_code,
            contract,
            installment,
            person_code,
            person_name,
            payment_method,
            due_date,
            amount,
            bank_document,
            status_code,
        ) in cur.fetchall():
            status = int(status_code or 0)
            rows.append(
                FinanceReceivableRow(
                    boletoCode=normalize_text(boleto_code) or "",
                    titleCode=normalize_text(title_code),
                    contract=normalize_text(contract),
                    installment=normalize_text(installment),
                    personCode=normalize_text(person_code) or "",
                    personName=normalize_text(person_name) or "Sem pessoa",
                    paymentMethod=normalize_text(payment_method),
                    dueDate=due_date,
                    amount=normalize_decimal(amount) or 0,
                    daysOverdue=max((today - due_date).days, 0) if due_date else 0,
                    bankDocument=normalize_text(bank_document),
                    statusCode=status,
                    statusLabel=finance_status_label(status),
                )
            )
        return rows

    def get_products_finished_report(self, company: str) -> ProductsFinishedResponse:
        schema = self.validate_company(company)
        rows: list[ProductsFinishedRow] = []

        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL(
                        """
                        SELECT
                          TRIM(p.pr_codigo) AS code,
                          TRIM(p.pr_descr) AS description,
                          NULLIF(TRIM(g.gr_descr), '') AS product_group,
                          NULLIF(TRIM(c.cl_cl_fisc), '') AS ncm,
                          c.cl_icms AS icms_rate,
                          c.cl_ipi AS ipi_rate,
                          c.cl_pis AS pis_rate,
                          c.cl_cofins AS cofins_rate
                        FROM {}.esprod AS p
                        LEFT JOIN {}.esgrupo AS g
                          ON g.gr_codigo = p.pr_grupo
                        LEFT JOIN {}.esclassf AS c
                          ON c.cl_codigo = p.pr_classf
                        WHERE p.pr_tipo = 1
                          AND COALESCE(p.pr_inativ, FALSE) = FALSE
                          AND p.pr_it_prd = TRUE
                          AND TRIM(p.pr_codigo) <> ''
                        ORDER BY
                          TRIM(COALESCE(g.gr_descr, '')),
                          TRIM(p.pr_descr),
                          TRIM(p.pr_codigo)
                        """
                    ).format(
                        sql.Identifier(schema),
                        sql.Identifier(schema),
                        sql.Identifier(schema),
                    )
                )

                for code, description, group, ncm, icms_rate, ipi_rate, pis_rate, cofins_rate in cur.fetchall():
                    rows.append(
                        ProductsFinishedRow(
                            code=normalize_text(code) or "",
                            description=normalize_text(description) or "",
                            group=normalize_text(group),
                            ncm=normalize_text(ncm),
                            icmsRate=normalize_decimal(icms_rate),
                            ipiRate=normalize_decimal(ipi_rate),
                            pisRate=normalize_decimal(pis_rate),
                            cofinsRate=normalize_decimal(cofins_rate),
                        )
                    )

        group_count = len({row.group for row in rows if row.group})
        missing_ncm_rows = sum(1 for row in rows if row.ncm is None)

        return ProductsFinishedResponse(
            company=schema,
            summary=ProductsFinishedSummary(
                totalRows=len(rows),
                missingNcmRows=missing_ncm_rows,
                groupCount=group_count,
            ),
            rows=rows,
        )

    def get_filtered_products_finished_rows(
        self,
        company: str,
        search: str = "",
        group: str = "",
        only_missing_ncm: bool = False,
    ) -> list[ProductsFinishedRow]:
        report = self.get_products_finished_report(company)
        query = normalize_search(search)

        return [
            row
            for row in report.rows
            if (not group or row.group == group)
            and (not only_missing_ncm or not row.ncm)
            and (
                not query
                or any(
                    query in normalize_search(value)
                    for value in (row.code, row.description, row.group or "", row.ncm or "")
                )
            )
        ]

    def get_fiscal_dashboard(self, company: str) -> FiscalDashboardResponse:
        products_report = self.get_products_finished_report(company)
        ncm_report = self.get_ncm_tax_rates_report(company)
        ncm_variations = Counter(row.ncm for row in ncm_report.rows)

        group_issues: dict[str, dict[str, int]] = {}
        zero_icms = zero_ipi = zero_pis = zero_cofins = 0
        any_zero = 0

        for row in products_report.rows:
            group = row.group or "Sem grupo"
            bucket = group_issues.setdefault(
                group,
                {
                    "totalRows": 0,
                    "missingNcmRows": 0,
                    "zeroRateRows": 0,
                    "issueRows": 0,
                },
            )
            bucket["totalRows"] += 1

            missing_ncm = row.ncm is None
            zero_rates = [
                row.icmsRate == 0,
                row.ipiRate == 0,
                row.pisRate == 0,
                row.cofinsRate == 0,
            ]
            has_zero_rate = any(zero_rates)

            if missing_ncm:
                bucket["missingNcmRows"] += 1
            if has_zero_rate:
                bucket["zeroRateRows"] += 1
                any_zero += 1
            if missing_ncm or has_zero_rate:
                bucket["issueRows"] += 1

            zero_icms += int(row.icmsRate == 0)
            zero_ipi += int(row.ipiRate == 0)
            zero_pis += int(row.pisRate == 0)
            zero_cofins += int(row.cofinsRate == 0)

        ranked_groups = sorted(
            (
                FiscalDashboardGroupIssue(group=group, **values)
                for group, values in group_issues.items()
                if values["issueRows"] > 0
            ),
            key=lambda item: (item.issueRows, item.missingNcmRows, item.zeroRateRows),
            reverse=True,
        )[:10]

        return FiscalDashboardResponse(
            company=products_report.company,
            summary=FiscalDashboardSummary(
                totalProducts=products_report.summary.totalRows,
                missingNcmProducts=products_report.summary.missingNcmRows,
                distinctNcms=ncm_report.summary.distinctNcms,
                ncmVariationCount=sum(1 for count in ncm_variations.values() if count > 1),
                duplicateNcmRows=ncm_report.summary.duplicateNcmRows,
                productsWithAnyZeroRate=any_zero,
                zeroIcmsProducts=zero_icms,
                zeroIpiProducts=zero_ipi,
                zeroPisProducts=zero_pis,
                zeroCofinsProducts=zero_cofins,
            ),
            groupIssues=ranked_groups,
        )

    def get_ncm_tax_rates_report(self, company: str) -> NcmTaxRateResponse:
        schema = self.validate_company(company)
        rows: list[NcmTaxRateRow] = []

        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL(
                        """
                        SELECT DISTINCT
                          TRIM(c.cl_cl_fisc) AS ncm,
                          c.cl_icms AS icms_rate,
                          c.cl_ipi AS ipi_rate,
                          c.cl_pis AS pis_rate,
                          c.cl_cofins AS cofins_rate
                        FROM {}.esclassf AS c
                        WHERE TRIM(c.cl_codigo) <> ''
                          AND TRIM(COALESCE(c.cl_cl_fisc, '')) <> ''
                        ORDER BY
                          TRIM(c.cl_cl_fisc),
                          c.cl_icms,
                          c.cl_ipi,
                          c.cl_pis,
                          c.cl_cofins
                        """
                    ).format(sql.Identifier(schema))
                )

                for ncm, icms_rate, ipi_rate, pis_rate, cofins_rate in cur.fetchall():
                    rows.append(
                        NcmTaxRateRow(
                            ncm=normalize_text(ncm) or "",
                            icmsRate=normalize_decimal(icms_rate),
                            ipiRate=normalize_decimal(ipi_rate),
                            pisRate=normalize_decimal(pis_rate),
                            cofinsRate=normalize_decimal(cofins_rate),
                        )
                    )

        ncm_counter = Counter(row.ncm for row in rows)
        distinct_ncms = len(ncm_counter)

        return NcmTaxRateResponse(
            company=schema,
            summary=NcmTaxRateSummary(
                totalRows=len(rows),
                distinctNcms=distinct_ncms,
                duplicateNcmRows=len(rows) - distinct_ncms,
            ),
            rows=rows,
        )

    def get_filtered_ncm_tax_rate_rows(
        self,
        company: str,
        search: str = "",
        only_variation: bool = False,
    ) -> list[NcmTaxRateRow]:
        report = self.get_ncm_tax_rates_report(company)
        variations = Counter(row.ncm for row in report.rows)
        query = normalize_search(search)

        return [
            row
            for row in report.rows
            if (not only_variation or variations[row.ncm] > 1)
            and (not query or query in normalize_search(row.ncm))
        ]


def normalize_search(value: str | None) -> str:
    decomposed = normalize("NFD", value or "")
    without_accents = "".join(char for char in decomposed if not combining(char))
    return without_accents.lower().strip()


def as_money(value: object) -> float:
    return round(normalize_decimal(value) or 0, 2)


def percentage(value: float, total: float) -> float | None:
    if total == 0:
        return None
    return round((value / total) * 100, 2)


def percentage_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round(((current - previous) / abs(previous)) * 100, 2)


def next_month_start(month_start: date) -> date:
    if month_start.month == 12:
        return date(month_start.year + 1, 1, 1)
    return date(month_start.year, month_start.month + 1, 1)


def previous_month_key(key: tuple[int, int]) -> tuple[int, int]:
    year, month = key
    if month == 1:
        return year - 1, 12
    return year, month - 1


def shift_month_key(key: tuple[int, int], offset: int) -> tuple[int, int]:
    year, month = key
    absolute = year * 12 + (month - 1) + offset
    return absolute // 12, absolute % 12 + 1


def make_dre_month_bucket() -> dict[str, object]:
    return {
        "revenue": 0.0,
        "costs": 0.0,
        "expenses": 0.0,
        "expensesTotal": 0.0,
        "expenseCategories": defaultdict(float),
        "revenueCategories": defaultdict(float),
    }


def dict_add(target: object, key: str, amount: float) -> None:
    if isinstance(target, dict):
        target[key] = float(target.get(key, 0.0)) + amount


def is_cost_category(category: str) -> bool:
    normalized = normalize_search(category).upper()
    return any(
        marker in normalized
        for marker in (
            "OPERACIONAIS",
            "MATERIA",
            "PRODUCAO",
            "FORNECEDORES",
        )
    )


def build_category_metrics(
    categories_value: object,
    total: float,
) -> list[FinanceCategoryMetric]:
    categories = categories_value if isinstance(categories_value, dict) else {}
    rows = sorted(
        ((category, as_money(amount)) for category, amount in categories.items()),
        key=lambda item: item[1],
        reverse=True,
    )[:10]
    return [
        FinanceCategoryMetric(
            category=category,
            amount=amount,
            sharePercent=percentage(amount, total) or 0,
        )
        for category, amount in rows
    ]


def build_dre_evolution(
    month_data: dict[tuple[int, int], dict[str, object]],
    reference_key: tuple[int, int],
) -> list[FinanceDreEvolutionPoint]:
    points: list[FinanceDreEvolutionPoint] = []
    for offset in range(-11, 1):
        key = shift_month_key(reference_key, offset)
        values = month_data[key]
        revenue = as_money(values["revenue"])
        expenses = as_money(values["expensesTotal"])
        points.append(
            FinanceDreEvolutionPoint(
                year=key[0],
                month=key[1],
                revenue=revenue,
                expenses=expenses,
                netProfit=round(revenue - expenses, 2),
            )
        )
    return points


def build_top_debtors(rows: list[FinanceReceivableRow]) -> list[FinanceTopDebtor]:
    buckets: dict[str, dict[str, float | int | str]] = defaultdict(
        lambda: {
            "personName": "Sem pessoa",
            "overdueRows": 0,
            "overdueAmount": 0.0,
        }
    )
    for row in rows:
        if row.daysOverdue <= 0:
            continue

        bucket = buckets[row.personCode]
        bucket["personName"] = row.personName
        bucket["overdueRows"] = int(bucket["overdueRows"]) + 1
        bucket["overdueAmount"] = float(bucket["overdueAmount"]) + row.amount

    ranked = sorted(
        buckets.items(),
        key=lambda item: (float(item[1]["overdueAmount"]), int(item[1]["overdueRows"])),
        reverse=True,
    )
    return [
        FinanceTopDebtor(
            personCode=person_code,
            personName=str(values["personName"]),
            overdueRows=int(values["overdueRows"]),
            overdueAmount=round(float(values["overdueAmount"]), 2),
        )
        for person_code, values in ranked[:10]
    ]


def finance_status_label(value: int) -> str:
    if value == 1:
        return "Em aberto"
    if value == 2:
        return "Pago"
    if value == 3:
        return "Baixado"
    if value == 4:
        return "Liquidado"
    if value == 7:
        return "Ajustado"
    return f"Status {value}"


def normalize_identifier(value: object) -> str:
    if isinstance(value, bytes):
        return value.decode("ascii", errors="ignore")
    return str(value)
