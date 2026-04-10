from __future__ import annotations

from datetime import date
from io import BytesIO

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .ai import MissingGroqKeyError, ReportAssistantService, UnsupportedIntentError
from .excel import build_workbook
from .models import (
    CompanyOption,
    CompanyOverviewResponse,
    FinanceDashboardResponse,
    FinanceReceivablesResponse,
    FiscalDashboardResponse,
    NcmTaxRateResponse,
    ProductsFinishedResponse,
    ReportAssistantRequest,
    ReportAssistantResponse,
)
from .service import FiscalReportService, InvalidCompanyError


app = FastAPI(
    title="Arquimedes BI API",
    version="0.1.0",
    description="API interna para dashboards multi-area e relatorios assistidos do Arquimedes.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = FiscalReportService()
assistant_service = ReportAssistantService(service)


@app.get("/api/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/companies", response_model=list[CompanyOption])
def list_companies() -> list[CompanyOption]:
    return service.list_companies()


@app.get("/api/dashboard/overview", response_model=CompanyOverviewResponse)
def company_overview(
    company: str = Query(..., description="Schema da empresa, como emp0001.")
) -> CompanyOverviewResponse:
    try:
        return service.get_company_overview(company)
    except InvalidCompanyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/dashboard/fiscal", response_model=FiscalDashboardResponse)
def fiscal_dashboard(
    company: str = Query(..., description="Schema da empresa, como emp0001.")
) -> FiscalDashboardResponse:
    try:
        return service.get_fiscal_dashboard(company)
    except InvalidCompanyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/finance/dashboard", response_model=FinanceDashboardResponse)
def finance_dashboard(
    company: str = Query(..., description="Schema da empresa, como emp0001."),
    referenceDate: date | None = Query(None, description="Data de referencia em YYYY-MM-DD."),
    period: str = Query(
        "month",
        description="Janela de observacao: month=30 dias, quarter=90 dias, year=365 dias.",
    ),
) -> FinanceDashboardResponse:
    try:
        return service.get_finance_dashboard(
            company,
            reference_date=referenceDate,
            period_mode=period,
        )
    except InvalidCompanyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/reports/products-finished", response_model=ProductsFinishedResponse)
def products_finished_report(
    company: str = Query(..., description="Schema da empresa, como emp0001.")
) -> ProductsFinishedResponse:
    try:
        return service.get_products_finished_report(company)
    except InvalidCompanyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/reports/ncm-tax-rates", response_model=NcmTaxRateResponse)
def ncm_tax_rates_report(
    company: str = Query(..., description="Schema da empresa, como emp0001.")
) -> NcmTaxRateResponse:
    try:
        return service.get_ncm_tax_rates_report(company)
    except InvalidCompanyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/finance/receivables", response_model=FinanceReceivablesResponse)
def finance_receivables_report(
    company: str = Query(..., description="Schema da empresa, como emp0001."),
    search: str = Query("", description="Busca por boleto, titulo, contrato, cliente ou documento."),
    onlyOverdue: bool = Query(False, description="Listar apenas boletos vencidos em aberto."),
    dueEnd: date | None = Query(None, description="Data final de vencimento em YYYY-MM-DD."),
    referenceDate: date | None = Query(None, description="Data de referencia em YYYY-MM-DD."),
) -> FinanceReceivablesResponse:
    try:
        return service.get_finance_receivables_report(
            company=company,
            search=search,
            only_overdue=onlyOverdue,
            due_end=dueEnd,
            reference_date=referenceDate,
        )
    except InvalidCompanyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/ai/report-assistant", response_model=ReportAssistantResponse)
def report_assistant(request: ReportAssistantRequest) -> ReportAssistantResponse:
    try:
        return assistant_service.run(request.company, request.question)
    except InvalidCompanyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except MissingGroqKeyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except UnsupportedIntentError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/reports/products-finished/export.xlsx")
def export_products_finished_report(
    company: str = Query(..., description="Schema da empresa, como emp0001."),
    search: str = Query("", description="Busca por codigo, descricao, grupo ou NCM."),
    group: str = Query("", description="Grupo selecionado no filtro."),
    onlyMissingNcm: bool = Query(False, description="Exportar apenas produtos sem NCM."),
) -> StreamingResponse:
    try:
        rows = service.get_filtered_products_finished_rows(
            company=company,
            search=search,
            group=group,
            only_missing_ncm=onlyMissingNcm,
        )
    except InvalidCompanyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    workbook = build_workbook(
        sheet_name="Produtos Acabados",
        headers=(
            "Codigo Produto Acabado",
            "Descricao Produto Acabado",
            "Grupo",
            "NCM",
            "Aliquota ICMS",
            "Aliquota IPI",
            "Aliquota PIS",
            "Aliquota COFINS",
        ),
        rows=(
            (
                row.code,
                row.description,
                row.group or "",
                row.ncm or "",
                row.icmsRate,
                row.ipiRate,
                row.pisRate,
                row.cofinsRate,
            )
            for row in rows
        ),
    )
    return excel_response(workbook, f"arquimedes-produtos-acabados-{company}.xlsx")


@app.get("/api/reports/ncm-tax-rates/export.xlsx")
def export_ncm_tax_rates_report(
    company: str = Query(..., description="Schema da empresa, como emp0001."),
    search: str = Query("", description="Busca por NCM."),
    onlyVariation: bool = Query(False, description="Exportar apenas NCMs com variacao."),
) -> StreamingResponse:
    try:
        rows = service.get_filtered_ncm_tax_rate_rows(
            company=company,
            search=search,
            only_variation=onlyVariation,
        )
    except InvalidCompanyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    workbook = build_workbook(
        sheet_name="NCM e Aliquotas",
        headers=("NCM", "Aliquota ICMS", "Aliquota IPI", "Aliquota PIS", "Aliquota COFINS"),
        rows=(
            (
                row.ncm,
                row.icmsRate,
                row.ipiRate,
                row.pisRate,
                row.cofinsRate,
            )
            for row in rows
        ),
    )
    return excel_response(workbook, f"arquimedes-ncm-aliquotas-{company}.xlsx")


@app.get("/api/finance/receivables/export.xlsx")
def export_finance_receivables_report(
    company: str = Query(..., description="Schema da empresa, como emp0001."),
    search: str = Query("", description="Busca por boleto, titulo, contrato, cliente ou documento."),
    onlyOverdue: bool = Query(False, description="Exportar apenas boletos vencidos em aberto."),
    dueEnd: date | None = Query(None, description="Data final de vencimento em YYYY-MM-DD."),
    referenceDate: date | None = Query(None, description="Data de referencia em YYYY-MM-DD."),
) -> StreamingResponse:
    try:
        report = service.get_finance_receivables_report(
            company=company,
            search=search,
            only_overdue=onlyOverdue,
            due_end=dueEnd,
            reference_date=referenceDate,
        )
    except InvalidCompanyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    workbook = build_workbook(
        sheet_name="Contas a Receber",
        headers=(
            "Boleto",
            "Titulo",
            "Contrato",
            "Parcela",
            "Codigo Pessoa",
            "Cliente",
            "Forma de Recebimento",
            "Vencimento",
            "Valor",
            "Dias Vencidos",
            "Nosso Numero",
            "Status",
        ),
        rows=(
            (
                row.boletoCode,
                row.titleCode or "",
                row.contract or "",
                row.installment or "",
                row.personCode,
                row.personName,
                row.paymentMethod or "",
                row.dueDate.isoformat() if row.dueDate else "",
                row.amount,
                row.daysOverdue,
                row.bankDocument or "",
                row.statusLabel,
            )
            for row in report.rows
        ),
    )
    return excel_response(workbook, f"arquimedes-contas-a-receber-{company}.xlsx")


def excel_response(workbook: BytesIO, filename: str) -> StreamingResponse:
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    return StreamingResponse(
        workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
