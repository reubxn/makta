"""Shared helper for calling the Claude API from the data scripts.

The key comes from the environment (or .env) as ANTHROPIC_API_KEY and is never written anywhere.
Returns None from `client()` if no key is available, so callers can fall back.
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:  # dotenv is optional
    pass

MODEL = os.environ.get("MODEL", "claude-sonnet-5-5")


def client():
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        return None
    import anthropic

    return anthropic.Anthropic(api_key=key)
