from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT_DIR / ".env"
ALLOWED_SCHEMAS = ("emp0001", "emp0002", "emp0003", "emp0004")


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value
    return values


@dataclass(frozen=True)
class Settings:
    database_url: str
    allowed_schemas: tuple[str, ...]
    groq_api_key: str | None
    groq_model: str


def get_settings() -> Settings:
    env = load_env(ENV_PATH)
    database_url = env.get("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL não encontrado no arquivo .env da raiz do projeto.")
    groq_api_key = env.get("GROQ_API_KEY", "").strip() or None
    groq_model = env.get("GROQ_MODEL", "").strip() or "llama-3.1-8b-instant"
    return Settings(
        database_url=database_url,
        allowed_schemas=ALLOWED_SCHEMAS,
        groq_api_key=groq_api_key,
        groq_model=groq_model,
    )


settings = get_settings()
