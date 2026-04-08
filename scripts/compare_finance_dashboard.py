from __future__ import annotations

import argparse
import json
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


EXTERNAL_BASE = "https://fabrica.valencaquimica.com.br/dashboards/api/financeiro"
PERIOD_MAP = {"mes": "month", "trimestre": "quarter", "ano": "year"}


def fetch_json(url: str) -> dict[str, Any]:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "ArquimedesBI/1.0"})
    with urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def brl(value: object) -> str:
    if value is None:
        return "-"
    number = float(value)
    return f"R$ {number:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def row(label: str, local: object, external: object) -> str:
    return f"{label:<32} {brl(local):>18} {brl(external):>18}"


def build_url(base: str, params: dict[str, str]) -> str:
    return f"{base}?{urlencode(params)}"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compara o dashboard financeiro local com a API externa da fabrica."
    )
    parser.add_argument("--company", default="emp0001", help="Schema local, como emp0001.")
    parser.add_argument("--external-company", default="0001", help="Empresa no dashboard externo.")
    parser.add_argument("--periodo", default="mes", choices=("mes", "trimestre", "ano"))
    parser.add_argument("--reference-date", default="", help="Data local em YYYY-MM-DD.")
    parser.add_argument("--local-base", default="http://127.0.0.1:8000/api/finance/dashboard")
    args = parser.parse_args()

    local_params = {"company": args.company, "period": PERIOD_MAP[args.periodo]}
    if args.reference_date:
        local_params["referenceDate"] = args.reference_date

    external_params = {"periodo": args.periodo, "empresa": args.external_company}
    local = fetch_json(build_url(args.local_base, local_params))
    external = fetch_json(build_url(EXTERNAL_BASE, external_params))
    external_kpis = external.get("kpis", {})

    print("Comparacao Financeira")
    print(f"Local:    {build_url(args.local_base, local_params)}")
    print(f"Externo:  {build_url(EXTERNAL_BASE, external_params)}")
    print()
    print(f"{'Metrica':<32} {'Local':>18} {'Externo':>18}")
    print("-" * 70)
    print(row("Saldo bancario", local["cash"]["currentCash"], external_kpis.get("saldo")))
    print(row("Pagar bruto aberto", local["audit"]["payables"]["rawOpen"]["amount"], external_kpis.get("pagar")))
    print(row("Pagar ano corrente", local["audit"]["payables"]["currentYearOpen"]["amount"], external_kpis.get("pagar")))
    print(row("Receber bruto aberto", local["audit"]["receivables"]["rawOpen"]["amount"], external_kpis.get("receber")))
    print(row("Inadimplencia total", local["audit"]["receivables"]["overdueTotal"]["amount"], external_kpis.get("inadimp")))
    print(row("Resultado liquido DRE", local["dre"]["netProfit"], external_kpis.get("resultado")))
    print()
    print("DRE local:", local["audit"]["dre"])
    print("Observacao local:", local["audit"]["externalComparison"]["note"])


if __name__ == "__main__":
    main()
