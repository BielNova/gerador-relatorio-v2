from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class CompanyOption(BaseModel):
    id: str
    label: str
    hasData: bool


class BusinessAreaTableMetric(BaseModel):
    name: str
    rows: int


class BusinessAreaSummary(BaseModel):
    id: str
    label: str
    description: str
    tableCount: int
    totalRows: int
    hasData: bool
    entryPath: str | None
    tables: list[BusinessAreaTableMetric]


class CompanyOverviewSummary(BaseModel):
    areaCount: int
    activeAreaCount: int
    totalRows: int


class CompanyOverviewResponse(BaseModel):
    company: str
    summary: CompanyOverviewSummary
    areas: list[BusinessAreaSummary]


class ProductsFinishedRow(BaseModel):
    code: str
    description: str
    group: str | None
    ncm: str | None
    icmsRate: float | None
    ipiRate: float | None
    pisRate: float | None
    cofinsRate: float | None


class ProductsFinishedSummary(BaseModel):
    totalRows: int
    missingNcmRows: int
    groupCount: int


class ProductsFinishedResponse(BaseModel):
    company: str
    summary: ProductsFinishedSummary
    rows: list[ProductsFinishedRow]


class NcmTaxRateRow(BaseModel):
    ncm: str
    icmsRate: float | None
    ipiRate: float | None
    pisRate: float | None
    cofinsRate: float | None


class NcmTaxRateSummary(BaseModel):
    totalRows: int
    distinctNcms: int
    duplicateNcmRows: int


class NcmTaxRateResponse(BaseModel):
    company: str
    summary: NcmTaxRateSummary
    rows: list[NcmTaxRateRow]


class FiscalDashboardSummary(BaseModel):
    totalProducts: int
    missingNcmProducts: int
    distinctNcms: int
    ncmVariationCount: int
    duplicateNcmRows: int
    productsWithAnyZeroRate: int
    zeroIcmsProducts: int
    zeroIpiProducts: int
    zeroPisProducts: int
    zeroCofinsProducts: int


class FiscalDashboardGroupIssue(BaseModel):
    group: str
    totalRows: int
    missingNcmRows: int
    zeroRateRows: int
    issueRows: int


class FiscalDashboardResponse(BaseModel):
    company: str
    summary: FiscalDashboardSummary
    groupIssues: list[FiscalDashboardGroupIssue]


class ReportAssistantRequest(BaseModel):
    company: str
    question: str


class ReportAssistantResponse(BaseModel):
    company: str
    intent: str
    answer: str
    columns: list[str]
    rows: list[dict[str, Any]]
    totalRows: int
    exportUrl: str | None
