# Nirvana Agent Sandboxes, One Pager

Isolated, managed environments on Nirvana's NKS infra for autonomous agents. Instant lifecycle (create / pause / resume / delete) with optional persistent storage. Built on AMD EPYC 9354P + DDR5, OpenSandbox on custom-tuned NKS.

- **API endpoint:** `https://api.170.23.67.211.nip.io` (control plane: manage sandboxes)
- **Gateway endpoint:** `https://gw.170.23.67.211.nip.io` (data plane: reach services inside a sandbox)
- **Auth:** every API call needs header `OPEN-SANDBOX-API-KEY: YOUR_API_KEY`

## What you can do

| # | Function | Method + Path | Notes |
|---|----------|---------------|-------|
| 1 | **Create** | `POST /sandboxes` | Body: `image.uri`, `entrypoint`, `resourceLimits{cpu,memory}`, optional `extensions`. ~2.5s ephemeral, ~6-7s persistent. Returns `id`, `status`, `createdAt`. |
| 2 | **Get / status** | `GET /sandboxes/{id}` | Full object. State via `.status.state` = `Running` \| `Paused` \| `Pending`. |
| 3 | **List** | `GET /sandboxes` | `items` array + pagination. |
| 4 | **Pause** | `POST /sandboxes/{id}/pause` | Instant. Pod deleted, PVC retained, files kept. Frees compute. |
| 5 | **Resume** | `POST /sandboxes/{id}/resume` | Restarts from checkpoint. Status goes `Pending` then `Running`. |
| 6 | **Delete** | `DELETE /sandboxes/{id}` | Instant + permanent. Removes pod, services, ephemeral + persistent storage. No recovery. |
| 7 | **Get endpoint** | `GET /sandboxes/{id}/endpoints/{port}` | Returns gateway URL + the `OpenSandbox-Ingress-To` routing header for that port. |
| 8 | **Proxy** | `GET /sandboxes/{id}/proxy/{port}/{path}` | Route a request to a sandbox port through the API server (convenient, lower throughput than gateway). |
| 9 | **Logs** | `GET /sandboxes/{id}/diagnostics/logs` | Container logs. |
| 10 | **Events** | `GET /sandboxes/{id}/diagnostics/events` | Lifecycle / scheduling events. |
| 11 | **Inspect** | `GET /sandboxes/{id}/diagnostics/inspect` | Detailed pod + resource data. |

## Reaching services inside a sandbox

Two ways to hit a port running in the sandbox:

**Gateway (fast, data-plane, preferred for real traffic):**
```bash
curl -H "OpenSandbox-Ingress-To: {sandbox_id}-{port}" https://gw.170.23.67.211.nip.io/path
```

**Proxy (simple, routes through the API server):**
```bash
curl https://api.170.23.67.211.nip.io/sandboxes/{id}/proxy/8000/state.json \
  -H "OPEN-SANDBOX-API-KEY: YOUR_API_KEY"
```

Get the exact gateway URL + header for a port first:
```bash
curl https://api.170.23.67.211.nip.io/sandboxes/{id}/endpoints/8000 \
  -H "OPEN-SANDBOX-API-KEY: YOUR_API_KEY"
```

## Persistence & storage

- **Ephemeral (default):** memory-only, gone on delete. Fastest startup. Stateless / temp work.
- **Persistent:** mounts a PVC at `/workspace`, survives pause/resume. For long-running, multi-step agents.

Enable via `extensions` on create:
```json
"extensions": {
  "persistence": "true",
  "storageClass": "local-path",   // "local-path" (dev/test) | "abs" (Accelerated Block Storage, prod)
  "storageSize": "50Gi"
}
```

**Checkpointing:** on pause the pod is deleted but the PVC is retained; on resume a new pod re-mounts the same PVC. Agents write state to `/workspace` and resume from the last recorded step instead of restarting.

## Typical lifecycle

```
create ──▶ Running ──▶ pause ──▶ Paused ──▶ resume ──▶ Running ──▶ delete
   │                                                        │
   └── write checkpoints to /workspace ─────────────────────┘  (persistent only)
```

## Quick reference: minimal create

```bash
curl -X POST https://api.170.23.67.211.nip.io/sandboxes \
  -H "Content-Type: application/json" \
  -H "OPEN-SANDBOX-API-KEY: YOUR_API_KEY" \
  -d '{
    "image": {"uri": "python:3.12-slim"},
    "entrypoint": ["/bin/sh", "-c", "python3 -m http.server 8000"],
    "resourceLimits": {"cpu": "1", "memory": "1Gi"}
  }'
```

Docs: https://docs.nirvanalabs.io/cloud/compute/agent-sandboxes
