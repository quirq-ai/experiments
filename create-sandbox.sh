#!/usr/bin/env bash
#
# Create an agent sandbox on Nirvana Cloud.
# Docs: https://docs.nirvanalabs.io/cloud/compute/agent-sandboxes/how-to/create-sandbox
#
# Usage:
#   export OPEN_SANDBOX_API_KEY=your_key
#   ./create-sandbox.sh                 # ephemeral python sandbox
#   ./create-sandbox.sh --persistent    # persistent (50Gi) sandbox
#
# Override the defaults with env vars:
#   IMAGE_URI, CPU, MEMORY, ENTRYPOINT (JSON array), STORAGE_SIZE
#
set -euo pipefail

# --- Config --------------------------------------------------------------
API_ENDPOINT="${API_ENDPOINT:-https://api.170.23.67.211.nip.io}"
GATEWAY_ENDPOINT="${GATEWAY_ENDPOINT:-https://gw.170.23.67.211.nip.io}"

IMAGE_URI="${IMAGE_URI:-python:3.12-slim}"
CPU="${CPU:-1}"
MEMORY="${MEMORY:-1Gi}"
ENTRYPOINT="${ENTRYPOINT:-[\"/bin/sh\", \"-c\", \"python3 -m http.server 8000\"]}"
STORAGE_SIZE="${STORAGE_SIZE:-50Gi}"

# --- Preconditions -------------------------------------------------------
if [[ -z "${OPEN_SANDBOX_API_KEY:-}" ]]; then
  echo "error: set OPEN_SANDBOX_API_KEY in your environment" >&2
  exit 1
fi

# --- Build request body --------------------------------------------------
if [[ "${1:-}" == "--persistent" ]]; then
  read -r -d '' BODY <<EOF || true
{
  "image": { "uri": "${IMAGE_URI}" },
  "entrypoint": ${ENTRYPOINT},
  "resourceLimits": { "cpu": "${CPU}", "memory": "${MEMORY}" },
  "extensions": {
    "persistence": "true",
    "storageClass": "local-path",
    "storageSize": "${STORAGE_SIZE}"
  }
}
EOF
else
  read -r -d '' BODY <<EOF || true
{
  "image": { "uri": "${IMAGE_URI}" },
  "entrypoint": ${ENTRYPOINT},
  "resourceLimits": { "cpu": "${CPU}", "memory": "${MEMORY}" }
}
EOF
fi

# --- Send request --------------------------------------------------------
echo "POST ${API_ENDPOINT}/sandboxes" >&2
echo "$BODY" >&2

curl -sS -X POST "${API_ENDPOINT}/sandboxes" \
  -H "Content-Type: application/json" \
  -H "OPEN-SANDBOX-API-KEY: ${OPEN_SANDBOX_API_KEY}" \
  -d "${BODY}" \
  -w '\n--- HTTP %{http_code} ---\n'
