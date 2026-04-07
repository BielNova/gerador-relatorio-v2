from __future__ import annotations

from collections import Counter
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


def normalize_identifier(value: object) -> str:
    if isinstance(value, bytes):
        return value.decode("ascii", errors="ignore")
    return str(value)
