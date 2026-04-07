from __future__ import annotations

from decimal import Decimal


def decode_mixed_text(value: bytes) -> str:
    for encoding in ("utf-8", "cp1252", "latin-1"):
        try:
            return value.decode(encoding)
        except UnicodeDecodeError:
            continue
    return value.decode("latin-1", errors="replace")


def normalize_text(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        text = decode_mixed_text(value).strip()
        return text or None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    text = str(value).strip()
    return text or None


def normalize_decimal(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (float, int)):
        return float(value)
    return float(str(value))

