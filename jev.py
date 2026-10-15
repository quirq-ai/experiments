"""Shared helpers for the examples: find a route to Jev, build a client, print answers."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import NamedTuple

from typesafe_sdk import Answer, SystemOneResponse, TypeSafeClient

HERE = Path(__file__).resolve().parent

# Jev charges for input tokens only: $42 per billion ($0.042 per million). Output is free.
PRICE_PER_INPUT_TOKEN = 42 / 1_000_000_000


class Route(NamedTuple):
    env: str  # environment variable that holds the key
    label: str
    base_url: str | None  # None: SDK default, https://api.typesafe.ai
    model: str | None  # None: SDK default, jev-latest


# Three ways to reach Jev. The first one whose key is set wins.
ROUTES = [
    Route("TYPESAFE_API_KEY", "TypeSafe", None, None),
    Route("AI_GATEWAY_API_KEY", "Vercel AI Gateway", "https://ai-gateway.vercel.sh/typesafe", "typesafe-ai/jev"),
    Route("OPENROUTER_API_KEY", "OpenRouter", "https://openrouter.ai/api", "~typesafe/jev-latest"),
]

NO_KEY_HELP = """No Jev API key found.

Copy .env.example to .env and set one of:
  TYPESAFE_API_KEY     from https://console.typesafe.ai/keys
  AI_GATEWAY_API_KEY   Vercel AI Gateway
  OPENROUTER_API_KEY   OpenRouter"""


def load_env(path: Path = HERE / ".env") -> None:
    """Copy KEY=value lines from .env into os.environ. Variables that are already set win."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        key, sep, value = line.partition("=")
        key = key.strip().removeprefix("export ").strip()
        value = value.strip().strip("\"'")
        if sep and key and value and not key.startswith("#"):
            os.environ.setdefault(key, value)


def find_route() -> Route | None:
    load_env()
    return next((route for route in ROUTES if os.environ.get(route.env)), None)


def client_for(route: Route) -> TypeSafeClient:
    return TypeSafeClient(api_key=os.environ[route.env], base_url=route.base_url, model=route.model)


def client() -> TypeSafeClient:
    """A Jev client for whichever key is configured. Exits with setup help if there is none."""
    route = find_route()
    if route is None:
        raise SystemExit(NO_KEY_HELP)
    return client_for(route)


# Printing ----------------------------------------------------------------

BAR_WIDTH = 24


def bar(p: float) -> str:
    filled = round(p * BAR_WIDTH)
    return "█" * filled + "░" * (BAR_WIDTH - filled)


def text(value: object) -> str:
    """Criteria can be strings or structured JSON. Print either on one line."""
    return value if isinstance(value, str) else json.dumps(value)


def show(response: SystemOneResponse, ms: float | None = None) -> None:
    """Print every answer with a bar per probability, then model, latency, tokens and cost."""
    for qid, a in response.answers.items():
        if a.type == "noul":
            print(f"{qid}   Noul -> P(yes) = {a.noul:.2f}")
            print(f"    {bar(a.noul)} {a.noul:.2f}")
        elif a.type == "choice":
            print(f"{qid}   Choice -> {a.choice}   (confidence {a.confidence:.2f})")
            width = max(map(len, a.probabilities))
            for option, p in sorted(a.probabilities.items(), key=lambda item: -item[1]):
                print(f"    {option:<{width}}  {bar(p)} {p:.2f}")
        elif a.type == "score":
            top = len(a.legend) - 1
            nearest = text(a.legend[round(a.score)])
            print(f'{qid}   Score -> {a.score:.2f} on a 0 to {top} scale, nearest "{nearest}"   (confidence {a.confidence:.2f})')
            labels = {level: text(label)[:32] for level, label in a.legend.items()}
            width = max(map(len, labels.values()))
            for level in sorted(labels):
                p = a.probabilities.get(level, 0.0)
                print(f"    {level}  {labels[level]:<{width}}  {bar(p)} {p:.2f}")
        print()
    print(footer(response, ms))


def brief(a: Answer) -> str:
    """One answer on one line."""
    if a.type == "noul":
        return f"{a.noul:.2f}"
    if a.type == "choice":
        return f"{a.choice} (confidence {a.confidence:.2f})"
    return f"{a.score:.2f} of {len(a.legend) - 1} (confidence {a.confidence:.2f})"


def footer(response: SystemOneResponse, ms: float | None = None) -> str:
    parts = [response.model]
    if ms is not None:
        parts.append(f"{ms:,.0f} ms")
    usage = response.usage
    if usage.input_tokens:
        dollars = usage.input_tokens * PRICE_PER_INPUT_TOKEN
        parts.append(f"{usage.input_tokens:,} in / {usage.output_tokens or 0:,} out tokens")
        parts.append(f"${dollars:.7f} at list price (~{1 / dollars:,.0f} calls per $1)")
    return " · ".join(parts)
