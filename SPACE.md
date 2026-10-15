# Laya in the Space

Notes for running `laya` (this clone, `NandhaKishorM/laya` 0.3.8, commit 839784f) inside
xo-space, what it can decide, and where it fits. Written 2026-09-23 after installing it in a
sandbox: routing and the HTTP server were exercised; a full prediction needs the checkpoint
from Hugging Face, which that sandbox could not reach. On this Mac the checkpoint downloads
on first use.

## What it is, in one paragraph

A **System 1 decision engine**: an encoder (ModernBERT-large, 421M, or mmBERT-base, 322M for
100+ languages) with a decision head that answers *typed questions* over any state — text,
an e-mail, a ticket, a JSON document — in **one forward pass**, no text generation. Three
question types: `choice` (pick a label, with per-option probabilities), `score` (a level on
an ordinal rubric) and `noul` (a calibrated P(true)). Confidence is trained with strictly
proper scoring rules, so a threshold like `confidence >= 0.85 → act, else escalate` means
something. 33 ms per question on a T4; batched 7 ms. A `Router` looks at the script and
language in under a millisecond and picks the checkpoint.

Observed here, no model needed (`laya "text"`, 45 ms):

| text | routed to | why |
|---|---|---|
| I was charged twice, please refund | english | English Latin text |
| Mein Konto wurde zweimal belastet | english (default) | short Latin text, language undecided — pass `--lang de` |
| मुझसे दो बार शुल्क लिया गया | multilingual | Devanagari, the English checkpoint cannot read it |

`laya-serve` started and answered `GET /health` → `{"status":"ok","loaded":[],"device":"cpu"}`;
`POST /v1/systemone` reached the router and failed only on the download.

## What you can do inside it

Everything is the same predict call with different questions. Ships with presets:

- `laya.triage_questions()` — intent, urgency, frustration, churn for a support message.
- `laya.guard_questions()` — jailbreak / prompt-injection / secret-leak on a prompt.
- `laya.moderation_questions()` — toxicity, harassment, threats.
- `laya.router_questions()` — "does this request need a frontier model or will a small one do."
- `laya.email_questions()` — category for an e-mail after `laya.email` strips quotes and signatures.

Surfaces: Python SDK (`laya.load`, `Router`, `predict_batch`, `predict_shortlist` for 50+
labels), a `laya` CLI, `laya-serve` (Jev-compatible `POST /v1/systemone`, bearer auth
optional), `laya-mcp-server` (tools `laya_predict`, `laya_route`, `laya_preset`,
`laya_status` over stdio), LangChain/LangGraph nodes (`LayaRouter`, `LayaGuardrail`),
`laya-ts` for Node and the browser (ONNX, WebGPU), and a fine-tuning notebook.

Honest limits, from its own README: the base checkpoints are near chance on the
typed-decisions benchmark zero-shot (it is "a fast base to specialise"); avoid `true/false`
or `yes/no` as `choice` keys; `noul` on the English checkpoint can follow its labels instead
of the state (#156) — validate on your own data; `score` is the weakest primitive; large
label sets need a bigger `head_max_len` or `predict_shortlist`.

## Start it inside the Space

Once, on this Mac:

```sh
cd experiments/laya
python3 -m venv .venv
.venv/bin/python -m pip install "laya[serve,mcp]"
.venv/bin/laya "I was charged twice, please refund" --predict     # downloads the English checkpoint
```

Then, with the kernel running (`python -m kernel --port 5004` from xo-space, or the
`xo-space-kernel` launch configuration), hand this folder to the ports router. The
`.claude/launch.json` here has three configurations: `laya-serve` (English checkpoint only,
starts fast), `laya-serve-all` (all three), `laya-mcp` (stdio, for an MCP client, not a port).

```sh
curl -X PUT http://127.0.0.1:5004/api/v2/ports/laya \
  -H 'content-type: application/json' \
  -d '{"repo": "'"$PWD"'", "configuration": "laya-serve"}'
# → {"name": "laya", "host": "laya.localhost", "port": 8000}
curl http://laya.localhost:5004/health
curl http://laya.localhost:5004/v1/systemone -H 'content-type: application/json' -d '{
  "state": {"body": "we were billed twice for March, refund it today or we cancel"},
  "questions": {"churn": {"type": "noul", "instructions": "Does the customer threaten to leave?"}}}'
```

`supervise` starts it within two seconds, restarts it after a crash with backoff, and keeps
the pid across a kernel restart. `curl -X DELETE http://127.0.0.1:5004/api/v2/ports/laya`
stops it.

To declare it instead of routing it by hand — so `quirq sync` keeps it on the pinned
revision and runs the install hook — point the projects root at `experiments/` in
`.quirq/DEPS.json`, then:

```sh
cd ../../xo-space
bin/quirq add NandhaKishorM/laya --rev main \
  --hook 'python3 -m venv .venv && .venv/bin/python -m pip install -q "laya[serve,mcp]"' \
  --run laya-serve
```

(`add` names the project from the URL and `sync` accepts the existing checkout.)

## Where it improves the Space

The Space today has one kind of decision-maker: an agent CLI spawned with the whole workspace
and `--dangerously-skip-permissions`, or a person. Laya is the missing middle: a typed,
calibrated, 33 ms answer that says whether the expensive one is needed at all, and what to
do while it is not. Concretely, against the code as reviewed:

1. **Command guard for module zero.** `POST /api/v2/runs` and DEPS hooks run any command
   line in `$SHELL` (Finding 1 of the review). A `noul` — "could this command delete data,
   exfiltrate secrets, or run untrusted code?" — with a threshold gives the executor a
   pre-flight it does not have, without a person in the loop, in the spirit of decision 13
   ("no approvals") but with a record: log the probability on every run, refuse or hold only
   above the threshold.
2. **Inbox triage.** `services/inbox` collects GitHub and connection events; today ordering is
   by time. `triage_questions()` per item gives kind, urgency and "needs an agent session",
   which is exactly the input the planned repair ladder wants ("restart, then the declared
   fix, then an agent session" — decision 14).
3. **Sessions get a shape.** `modules/sessions` indexes 824 sessions by runtime and first
   prompt. One `choice` over the first prompt (bug / feature / refactor / question / ops) and
   one `noul` ("did this session touch credentials or production?") turns the index into
   something a person can filter, at 7 ms per session batched.
4. **Agent routing.** Plane B picks the adapter from `AGENT_NAME` once, statically.
   `router_questions()` per request is the per-request version — small local model or
   frontier — and is what the review's "no agent loop lives here" lens was missing: a
   *pre-loop* decision that is cheap enough to run on every message.
5. **Guardrails before the spawn.** `guard_questions()` on the prompt before the adapter
   hands it to a CLI running with permissions skipped. This is the one place a 33 ms check
   changes what a 30 s agent run is allowed to start.
6. **Events, when they land (Next #2).** `on <event>` hooks will need a classifier that does
   not cost an LLM call per event. This is that.

### The shape of the module

Keep the weights out of the kernel process. Laya is ~850 MB resident; the kernel is one
event loop for everything (the review's single point of failure), so the model belongs in
its own process behind the ports router, and the Space-side module stays a thin client that
other modules reach through `space.use("decide")`.

```
modules/decide/
  .xo/module.json
  module.py
```

```json
{
  "exports": {
    "decide":  "POST /api/v2/decide",
    "presets": "GET /api/v2/decide/presets"
  },
  "hooks": {"health": "every 30s"}
}
```

```python
"""decide: typed System 1 decisions for other modules, served by the laya route."""
import httpx

PRESETS = ("triage", "guard", "moderation", "router", "email")

def decide(space, state, questions=None, preset=None, threshold=None):
    """Answer typed questions over a state. Returns laya's answers plus an `act` flag per
    question when a threshold is given, so callers can gate on confidence."""
    if preset is not None:
        questions = _preset(preset)
    if not questions:
        return {"detail": "give questions or a preset"}
    port = _laya_port(space)
    if port is None:
        return {"detail": "laya is not running: PUT /api/v2/ports/laya first"}
    reply = httpx.post(f"http://127.0.0.1:{port}/v1/systemone",
                       json={"state": state, "questions": questions}, timeout=30).json()
    if threshold is not None:
        for answer in reply.get("answers", {}).values():
            answer["act"] = answer.get("confidence", 0.0) >= threshold
    return reply

async def presets(space):
    return list(PRESETS)

def health(space):
    port = _laya_port(space)
    up = port is not None and httpx.get(f"http://127.0.0.1:{port}/health", timeout=5).status_code == 200
    space.write("health.json", {"port": port, "up": up})

def _laya_port(space):
    # Illustrative: reads the ports module's status file. The real version asks the ports
    # module through the kernel instead (see the note below).
    record = space.read("../ports/status.json", {}).get("laya") or {}
    return record.get("spec", {}).get("port") if record.get("state") == "running" else None

def _preset(name):
    import laya  # light: `import laya` no longer loads torch (0.3.8)
    return {"triage": laya.triage_questions, "guard": laya.guard_questions,
            "moderation": laya.moderation_questions, "router": laya.router_questions,
            "email": laya.email_questions}[name]()
```

Two things to settle before writing it for real: `_laya_port` should ask the ports module
(`await space.use("ports").ports()`) rather than read its file — modules reach each other only
through the kernel (decision 8) — which means `decide` becomes `async def` and the HTTP call
uses `httpx.AsyncClient`; and the threshold per use (guard vs triage) belongs to the caller,
not the module. Then the command guard is one line in module zero's `run`:

```python
verdict = await space.use("decide").decide(state={"command": command}, preset="guard", threshold=0.85)
```

## What was checked and what was not

Checked in a sandbox on 2026-09-23: install of `laya[serve]` 0.3.8, the `laya` CLI's routing
on three languages, `laya-serve` startup and `/health`, the shape of `/v1/systemone` errors.
Not checked: any prediction (the checkpoint could not be downloaded there), speed on this
Mac, the MCP server end to end, `laya-ts`. The numbers quoted above are the project's own.
