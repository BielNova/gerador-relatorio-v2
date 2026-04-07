from __future__ import annotations

from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from backend.app.ai import AssistantIntent
from backend.app.encodings import decode_mixed_text
from backend.app.main import app, assistant_service


client = TestClient(app)


def test_decode_mixed_text_handles_cp1252_and_utf8() -> None:
    assert decode_mixed_text(b"ESCRIT\xd3RIO") == "ESCRITÓRIO"
    assert decode_mixed_text("CAMINHÃO".encode("utf-8")) == "CAMINHÃO"


def test_companies_endpoint_lists_allowed_schemas() -> None:
    response = client.get("/api/companies")
    assert response.status_code == 200

    payload = response.json()
    assert [item["id"] for item in payload] == ["emp0001", "emp0002", "emp0003", "emp0004"]
    assert payload[0]["hasData"] is True
    assert all(item["hasData"] for item in payload)


def test_invalid_company_is_rejected() -> None:
    response = client.get("/api/reports/products-finished", params={"company": "public"})
    assert response.status_code == 400
    assert "Empresa inválida" in response.json()["detail"]


def test_company_overview_separates_business_areas() -> None:
    response = client.get("/api/dashboard/overview", params={"company": "emp0001"})
    assert response.status_code == 200

    payload = response.json()
    areas = {area["id"]: area for area in payload["areas"]}

    assert payload["summary"]["areaCount"] == 11
    assert payload["summary"]["activeAreaCount"] >= 8
    assert areas["comercial"]["label"] == "Comercial"
    assert areas["comercial"]["totalRows"] == 4076536
    assert areas["financeiro"]["totalRows"] == 1201127
    assert areas["producao"]["totalRows"] == 3289232
    assert areas["fiscal"]["entryPath"] == "/ncm-tax-rates"
    assert areas["estoque"]["entryPath"] == "/products"


def test_company_overview_rejects_invalid_company() -> None:
    response = client.get("/api/dashboard/overview", params={"company": "public"})

    assert response.status_code == 400


def test_products_finished_report_matches_current_database_snapshot() -> None:
    response = client.get("/api/reports/products-finished", params={"company": "emp0001"})
    assert response.status_code == 200

    payload = response.json()
    assert payload["company"] == "emp0001"
    assert payload["summary"] == {
        "totalRows": 3390,
        "missingNcmRows": 293,
        "groupCount": 21,
    }
    assert payload["rows"][0] == {
        "code": "01010004",
        "description": "AMACIANTE ABRAÇO",
        "group": "AMACIANTES",
        "ncm": "38099190",
        "icmsRate": 20.5,
        "ipiRate": 0.0,
        "pisRate": 1.65,
        "cofinsRate": 7.6,
    }


def test_products_finished_report_returns_empty_state_for_company_without_data() -> None:
    response = client.get("/api/reports/products-finished", params={"company": "emp0002"})
    assert response.status_code == 200

    payload = response.json()
    assert payload["summary"] == {
        "totalRows": 0,
        "missingNcmRows": 0,
        "groupCount": 0,
    }
    assert payload["rows"] == []


def test_ncm_tax_rates_report_matches_current_database_snapshot() -> None:
    response = client.get("/api/reports/ncm-tax-rates", params={"company": "emp0001"})
    assert response.status_code == 200

    payload = response.json()
    assert payload["company"] == "emp0001"
    assert payload["summary"] == {
        "totalRows": 1197,
        "distinctNcms": 684,
        "duplicateNcmRows": 513,
    }
    assert payload["rows"][0] == {
        "ncm": "00000000",
        "icmsRate": 0.0,
        "ipiRate": 0.0,
        "pisRate": 1.65,
        "cofinsRate": 7.6,
    }


def test_ncm_tax_rates_report_returns_empty_state_for_company_without_data() -> None:
    response = client.get("/api/reports/ncm-tax-rates", params={"company": "emp0002"})
    assert response.status_code == 200

    payload = response.json()
    assert payload["summary"] == {
        "totalRows": 0,
        "distinctNcms": 0,
        "duplicateNcmRows": 0,
    }
    assert payload["rows"] == []


def test_ncm_tax_rates_export_downloads_xlsx() -> None:
    response = client.get(
        "/api/reports/ncm-tax-rates/export.xlsx",
        params={"company": "emp0001", "search": "38099190"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert 'filename="arquimedes-ncm-aliquotas-emp0001.xlsx"' in response.headers[
        "content-disposition"
    ]
    assert response.content.startswith(b"PK")


def test_products_finished_export_includes_tax_rates_with_products() -> None:
    response = client.get(
        "/api/reports/products-finished/export.xlsx",
        params={"company": "emp0001", "search": "01010004"},
    )

    assert response.status_code == 200
    workbook = load_workbook(BytesIO(response.content), read_only=True)
    worksheet = workbook.active
    headers = [cell.value for cell in next(worksheet.iter_rows(max_row=1))]
    first_row = [cell.value for cell in next(worksheet.iter_rows(min_row=2, max_row=2))]

    assert headers == [
        "Codigo Produto Acabado",
        "Descricao Produto Acabado",
        "Grupo",
        "NCM",
        "Aliquota ICMS",
        "Aliquota IPI",
        "Aliquota PIS",
        "Aliquota COFINS",
    ]
    assert first_row[0] == "01010004"
    assert str(first_row[1]).startswith("AMACIANTE ABRA")
    assert first_row[2:] == ["AMACIANTES", "38099190", 20.5, 0, 1.65, 7.6]


def test_fiscal_dashboard_matches_current_database_snapshot() -> None:
    response = client.get("/api/dashboard/fiscal", params={"company": "emp0001"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == {
        "totalProducts": 3390,
        "missingNcmProducts": 293,
        "distinctNcms": 684,
        "ncmVariationCount": 286,
        "duplicateNcmRows": 513,
        "productsWithAnyZeroRate": 971,
        "zeroIcmsProducts": 308,
        "zeroIpiProducts": 677,
        "zeroPisProducts": 293,
        "zeroCofinsProducts": 293,
    }
    assert payload["groupIssues"][0]["group"] == "DESCONTINUALIZADOS"


def test_fiscal_dashboard_rejects_invalid_company() -> None:
    response = client.get("/api/dashboard/fiscal", params={"company": "public"})

    assert response.status_code == 400


def test_report_assistant_runs_allowed_intent_with_mocked_classifier() -> None:
    original_classifier = assistant_service.classifier
    assistant_service.classifier = StaticClassifier(
        AssistantIntent(intent="products_by_ncm", params={"ncm": "38099190"})
    )
    try:
        response = client.post(
            "/api/ai/report-assistant",
            json={"company": "emp0001", "question": "produtos do NCM 38099190"},
        )
    finally:
        assistant_service.classifier = original_classifier

    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == "products_by_ncm"
    assert payload["totalRows"] > 0
    assert payload["columns"][2:] == ["Grupo", "NCM", "ICMS", "IPI", "PIS", "COFINS"]
    assert payload["columns"][0].startswith("C")
    assert payload["columns"][1].startswith("Descri")
    assert "export.xlsx" in payload["exportUrl"]


def test_report_assistant_rejects_unsupported_intent() -> None:
    original_classifier = assistant_service.classifier
    assistant_service.classifier = StaticClassifier(AssistantIntent(intent="unsupported", params={}))
    try:
        response = client.post(
            "/api/ai/report-assistant",
            json={"company": "emp0001", "question": "faÃ§a qualquer SQL"},
        )
    finally:
        assistant_service.classifier = original_classifier

    assert response.status_code == 422


def test_report_assistant_rejects_invalid_company_before_ai() -> None:
    response = client.post(
        "/api/ai/report-assistant",
        json={"company": "public", "question": "produtos sem NCM"},
    )

    assert response.status_code == 400


class StaticClassifier:
    def __init__(self, intent: AssistantIntent) -> None:
        self.intent = intent

    def classify(self, question: str) -> AssistantIntent:
        return self.intent
