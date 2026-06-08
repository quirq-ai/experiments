"""
Vercel Sandbox Deployer — Python Edition

A FastAPI app that lets you write code in a browser editor
and deploy it to ephemeral Vercel Sandbox MicroVMs.

Uses a Node.js bridge script to interact with the @vercel/sandbox SDK.
"""

import asyncio
import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="Vercel Sandbox Deployer")

BRIDGE_DIR = Path(__file__).parent / "bridge"
BRIDGE_SCRIPT = BRIDGE_DIR / "sandbox_runner.mjs"


class DeployRequest(BaseModel):
    code: str
    language: str  # "node" or "python"
    port: str | None = None


class DeployResponse(BaseModel):
    sandboxId: str | None = None
    status: str
    output: str
    url: str | None = None
    exitCode: int | None = None
    error: str | None = None


@app.post("/api/sandbox", response_model=DeployResponse)
async def deploy_to_sandbox(req: DeployRequest):
    """
    Create a Vercel Sandbox, write the user's code to it,
    install dependencies, and run it.
    """
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")

    if req.language not in ("node", "python"):
        raise HTTPException(status_code=400, detail="Language must be 'node' or 'python'")

    # Build the JSON payload for the Node.js bridge
    payload = json.dumps({
        "code": req.code,
        "language": req.language,
        "port": req.port or "",
    })

    try:
        proc = await asyncio.create_subprocess_exec(
            "node", str(BRIDGE_SCRIPT), payload,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(BRIDGE_DIR),
            env={
                **os.environ,
                "NODE_NO_WARNINGS": "1",
            },
        )

        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=120,  # 2 minutes max
        )

        stdout_text = stdout.decode().strip()
        stderr_text = stderr.decode().strip()

        if not stdout_text:
            return DeployResponse(
                status="error",
                output=stderr_text or "No output from sandbox runner",
            )

        # The bridge outputs JSON on the last line of stdout
        lines = stdout_text.split("\n")
        result_line = lines[-1]

        try:
            result = json.loads(result_line)
            return DeployResponse(**result)
        except json.JSONDecodeError:
            return DeployResponse(
                status="error",
                output=f"Unexpected output:\n{stdout_text}\n{stderr_text}",
            )

    except asyncio.TimeoutError:
        return DeployResponse(
            status="error",
            output="Sandbox creation timed out after 120 seconds",
        )
    except FileNotFoundError:
        return DeployResponse(
            status="error",
            output=(
                "Node.js not found. Make sure Node.js is installed and "
                "you've run 'npm install' in the bridge/ directory."
            ),
        )
    except Exception as e:
        return DeployResponse(
            status="error",
            output=str(e),
        )


# Serve the frontend
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index():
    return FileResponse("static/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
