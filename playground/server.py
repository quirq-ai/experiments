"""Local Jev playground at http://127.0.0.1:8472

The page in your browser only talks to this server. This server holds the API key and
is the only thing that talks to Jev, so the key never reaches the browser.

    uv run playground/server.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # import jev.py from the project root

import jev  # noqa: E402
from typesafe_sdk import TypeSafeAPIError, TypeSafeClient, TypeSafeError  # noqa: E402

HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", 8472))
PAGE = Path(__file__).with_name("index.html")

_client: TypeSafeClient | None = None  # built on first use, so a key added to .env later just works


def ask(state: object, questions: dict) -> tuple[int, dict]:
    """Send one request to Jev. Returns (http status, JSON body for the page)."""
    global _client
    if _client is None:
        route = jev.find_route()
        if route is None:
            return 400, {"error": jev.NO_KEY_HELP}
        _client = jev.client_for(route)

    started = time.perf_counter()
    try:
        result = _client.system_one(state, questions)
    except TypeSafeAPIError as error:  # Jev answered with an error status (401, 422, 429, ...)
        return 502, {"error": str(error), "status": error.status}
    except TypeSafeError as error:  # the SDK rejected the request before sending it
        return 400, {"error": str(error)}
    latency_ms = (time.perf_counter() - started) * 1000

    http = result.raw_http_response
    tokens = result.usage.input_tokens
    return 200, {
        "request": json.loads(http.request.content),  # exactly what went over the wire
        "response": http.json(),
        "latency_ms": round(latency_ms),
        "cost_usd": tokens * jev.PRICE_PER_INPUT_TOKEN if tokens else None,
        "request_id": http.headers.get("x-typesafe-request-id"),  # gateways may not send it
    }


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/":
            self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
        elif self.path == "/api/config":
            route = jev.find_route()
            self._json(200, {"route": route.label if route else None})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        # JSON only, and only for a localhost Host header: another site open in your
        # browser can't send this request, so it can't spend your key.
        host = self.headers.get("Host", "").rsplit(":", 1)[0]
        if (
            self.path != "/api/ask"
            or self.headers.get("Content-Type") != "application/json"
            or host not in ("127.0.0.1", "localhost")
        ):
            return self._json(404, {"error": "not found"})
        try:
            payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            state, questions = payload["state"], payload["questions"]
        except (ValueError, KeyError, TypeError) as error:
            return self._json(400, {"error": f"Bad request: {error}"})
        if not isinstance(questions, dict) or not questions:
            return self._json(400, {"error": "questions must be a non-empty JSON object"})
        self._json(*ask(state, questions))

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, data: dict) -> None:
        self._send(status, json.dumps(data).encode(), "application/json")


if __name__ == "__main__":
    route = jev.find_route()
    print(f"Jev playground on http://{HOST}:{PORT}", flush=True)
    print(f"route: {route.label if route else 'no API key yet (see .env.example)'}", flush=True)
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
