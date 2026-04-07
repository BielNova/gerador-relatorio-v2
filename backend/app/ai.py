from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlencode

import httpx

from .config import settings
from .models import ReportAssistantResponse
from .service import FiscalReportService


ALLOWED_INTENTS = {
    "products_missing_ncm",
    "products_by_group",
    "products_by_ncm",
    "ncm_variations",
    "ncm_tax_rates",
    "tax_rate_filter",
}

PRODUCT_COLUMNS = ["Código", "Descrição", "Grupo", "NCM", "ICMS", "IPI", "PIS", "COFINS"]
NCM_COLUMNS = ["NCM", "ICMS", "IPI", "PIS", "COFINS"]
RATE_FIELDS = {
    "icms": "icmsRate",
    "ipi": "ipiRate",
    "pis": "pisRate",
    "cofins": "cofinsRate",
}


class MissingGroqKeyError(RuntimeError):
    pass


class UnsupportedIntentError(ValueError):
    pass


@dataclass(frozen=True)
class AssistantIntent:
    intent: str
    params: dict[str, Any] = field(default_factory=dict)


class GroqIntentClassifier:
    def classify(self, question: str) -> AssistantIntent:
        if not settings.groq_api_key:
            raise MissingGroqKeyError("GROQ_API_KEY não configurada para usar a IA.")

        payload = {
            "model": settings.groq_model,
            "temperature": 0,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Voce classifica pedidos de relatorios fiscais. "
                        "Responda apenas JSON valido no formato "
                        '{"intent":"...","params":{...}}. '
                        "Intents permitidas: products_missing_ncm, products_by_group, "
                        "products_by_ncm, ncm_variations, ncm_tax_rates, tax_rate_filter. "
                        "Parametros aceitos: group, ncm, rateField, zeroOnly, minRate, maxRate. "
                        "rateField deve ser icms, ipi, pis ou cofins. "
                        "Se o pedido nao couber nas intents, use unsupported."
                    ),
                },
                {"role": "user", "content": question},
            ],
            "response_format": {"type": "json_object"},
        }

        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=20,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        decoded = json.loads(content)
        return AssistantIntent(
            intent=str(decoded.get("intent", "unsupported")),
            params=decoded.get("params") if isinstance(decoded.get("params"), dict) else {},
        )


class ReportAssistantService:
    def __init__(
        self,
        fiscal_service: FiscalReportService,
        classifier: GroqIntentClassifier | None = None,
    ) -> None:
        self.fiscal_service = fiscal_service
        self.classifier = classifier or GroqIntentClassifier()

    def run(self, company: str, question: str) -> ReportAssistantResponse:
        self.fiscal_service.validate_company(company)
        assistant_intent = self.classifier.classify(question)
        if assistant_intent.intent not in ALLOWED_INTENTS:
            raise UnsupportedIntentError("Pedido fora dos relatórios permitidos nesta versão.")

        intent = assistant_intent.intent
        params = assistant_intent.params

        if intent == "products_missing_ncm":
            rows = self.fiscal_service.get_filtered_products_finished_rows(
                company,
                only_missing_ncm=True,
            )
            return self._product_response(
                company=company,
                intent=intent,
                rows=rows,
                answer=f"Encontrei {len(rows)} produtos acabados sem NCM.",
                export_url=self._export_products_url(company, onlyMissingNcm="true"),
            )

        if intent == "products_by_group":
            group = str(params.get("group", "")).strip()
            rows = self.fiscal_service.get_filtered_products_finished_rows(company, group=group)
            return self._product_response(
                company=company,
                intent=intent,
                rows=rows,
                answer=f"Encontrei {len(rows)} produtos no grupo informado.",
                export_url=self._export_products_url(company, group=group),
            )

        if intent == "products_by_ncm":
            ncm = str(params.get("ncm", "")).strip()
            rows = self.fiscal_service.get_filtered_products_finished_rows(company, search=ncm)
            return self._product_response(
                company=company,
                intent=intent,
                rows=rows,
                answer=f"Encontrei {len(rows)} produtos ligados ao NCM informado.",
                export_url=self._export_products_url(company, search=ncm),
            )

        if intent == "ncm_variations":
            rows = self.fiscal_service.get_filtered_ncm_tax_rate_rows(
                company,
                only_variation=True,
            )
            return self._ncm_response(
                company=company,
                intent=intent,
                rows=rows,
                answer=f"Encontrei {len(rows)} linhas fiscais em NCMs com variação.",
                export_url=self._export_ncm_url(company, onlyVariation="true"),
            )

        if intent == "ncm_tax_rates":
            ncm = str(params.get("ncm", "")).strip()
            rows = self.fiscal_service.get_filtered_ncm_tax_rate_rows(company, search=ncm)
            return self._ncm_response(
                company=company,
                intent=intent,
                rows=rows,
                answer=f"Encontrei {len(rows)} combinações fiscais para a busca informada.",
                export_url=self._export_ncm_url(company, search=ncm),
            )

        rows = self._filter_tax_rate_rows(company, params)
        return self._ncm_response(
            company=company,
            intent=intent,
            rows=rows,
            answer=f"Encontrei {len(rows)} linhas fiscais no filtro de alíquota.",
            export_url=None,
        )

    def _filter_tax_rate_rows(self, company: str, params: dict[str, Any]):
        report = self.fiscal_service.get_ncm_tax_rates_report(company)
        rate_field = RATE_FIELDS.get(str(params.get("rateField", "")).lower())
        if not rate_field:
            raise UnsupportedIntentError("Filtro de alíquota sem campo permitido.")

        zero_only = bool(params.get("zeroOnly"))
        min_rate = self._optional_float(params.get("minRate"))
        max_rate = self._optional_float(params.get("maxRate"))

        def matches(row: object) -> bool:
            value = getattr(row, rate_field)
            if value is None:
                return False
            if zero_only and value != 0:
                return False
            if min_rate is not None and value < min_rate:
                return False
            if max_rate is not None and value > max_rate:
                return False
            return True

        return [row for row in report.rows if matches(row)]

    def _product_response(
        self,
        company: str,
        intent: str,
        rows: list[Any],
        answer: str,
        export_url: str | None,
    ) -> ReportAssistantResponse:
        return ReportAssistantResponse(
            company=company,
            intent=intent,
            answer=answer,
            columns=PRODUCT_COLUMNS,
            rows=[product_to_preview(row) for row in rows[:50]],
            totalRows=len(rows),
            exportUrl=export_url,
        )

    def _ncm_response(
        self,
        company: str,
        intent: str,
        rows: list[Any],
        answer: str,
        export_url: str | None,
    ) -> ReportAssistantResponse:
        return ReportAssistantResponse(
            company=company,
            intent=intent,
            answer=answer,
            columns=NCM_COLUMNS,
            rows=[ncm_to_preview(row) for row in rows[:50]],
            totalRows=len(rows),
            exportUrl=export_url,
        )

    def _export_products_url(self, company: str, **params: str) -> str:
        return build_export_url("/api/reports/products-finished/export.xlsx", company, params)

    def _export_ncm_url(self, company: str, **params: str) -> str:
        return build_export_url("/api/reports/ncm-tax-rates/export.xlsx", company, params)

    def _optional_float(self, value: Any) -> float | None:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None


def build_export_url(path: str, company: str, params: dict[str, str]) -> str:
    query_params = {"company": company}
    query_params.update({key: value for key, value in params.items() if value})
    return f"{path}?{urlencode(query_params)}"


def product_to_preview(row: Any) -> dict[str, Any]:
    return {
        "Código": row.code,
        "Descrição": row.description,
        "Grupo": row.group or "",
        "NCM": row.ncm or "",
        "ICMS": row.icmsRate,
        "IPI": row.ipiRate,
        "PIS": row.pisRate,
        "COFINS": row.cofinsRate,
    }


def ncm_to_preview(row: Any) -> dict[str, Any]:
    return {
        "NCM": row.ncm,
        "ICMS": row.icmsRate,
        "IPI": row.ipiRate,
        "PIS": row.pisRate,
        "COFINS": row.cofinsRate,
    }
