from __future__ import annotations

import csv
from decimal import Decimal
from pathlib import Path
from typing import Iterable, Sequence

import psycopg


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"
SQL_DIR = BASE_DIR / "sql"
REPORTS_DIR = BASE_DIR / "reports"


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value
    return values


def decode_text(value: bytes) -> str:
    for encoding in ("utf-8", "cp1252", "latin-1"):
        try:
            return value.decode(encoding)
        except UnicodeDecodeError:
            continue
    return value.decode("latin-1", errors="replace")


def normalize(value: object) -> object:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return decode_text(value).strip()
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    return value


def fetch_rows(conn: psycopg.Connection, sql_path: Path) -> tuple[list[str], list[list[object]]]:
    query = sql_path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(query)
        headers = [decode_text(col.name) if isinstance(col.name, bytes) else str(col.name) for col in cur.description]
        rows = [[normalize(value) for value in row] for row in cur.fetchall()]
    return headers, rows


def write_csv(path: Path, headers: Sequence[str], rows: Iterable[Sequence[object]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as fp:
        writer = csv.writer(fp, delimiter=";")
        writer.writerow(headers)
        writer.writerows(rows)


def main() -> None:
    env = load_env(ENV_PATH)
    database_url = env["DATABASE_URL"]

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    report_specs = [
        (
            SQL_DIR / "arquimedes_relatorio_produtos_acabados.sql",
            REPORTS_DIR / "arquimedes_relatorio_produtos_acabados.csv",
        ),
        (
            SQL_DIR / "arquimedes_relatorio_ncm_aliquotas.sql",
            REPORTS_DIR / "arquimedes_relatorio_ncm_aliquotas.csv",
        ),
    ]

    with psycopg.connect(database_url) as conn:
        for sql_path, output_path in report_specs:
            headers, rows = fetch_rows(conn, sql_path)
            write_csv(output_path, headers, rows)
            print(f"{output_path.name}: {len(rows)} linhas")


if __name__ == "__main__":
    main()
