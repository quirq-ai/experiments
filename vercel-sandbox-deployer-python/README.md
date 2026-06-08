# Vercel Sandbox Deployer — Python Edition

A Python (FastAPI) app that lets you write code in a browser editor and deploy it to ephemeral [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) MicroVMs.

## What it does

- **Browser code editor** (CodeMirror) with Node.js and Python syntax highlighting
- **One-click deploy** to isolated Firecracker MicroVMs
- **Script mode**: runs code and returns stdout/stderr
- **Server mode**: specify a port to get a live HTTPS URL
- **Auto-installs packages**: detects imports and installs dependencies inside the sandbox
- **5 starter templates** included

## Architecture

```
Browser (CodeMirror) → FastAPI (Python) → Node.js bridge → @vercel/sandbox SDK → MicroVM
```

Since the `@vercel/sandbox` SDK is TypeScript-only, the Python backend calls a small Node.js bridge script via subprocess. The bridge uses the official SDK to create sandboxes, write files, and run commands.

## Setup

### Prerequisites

- Python 3.11+
- Node.js 22+
- A Vercel account with a project

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Install the Node.js bridge

```bash
cd bridge && npm install && cd ..
```

### 3. Set environment variables

Copy `.env.example` to `.env` and fill in your Vercel credentials:

```bash
cp .env.example .env
```

Or set them as environment variables:

```bash
export VERCEL_TOKEN=<your token from vercel.com/account/tokens>
export VERCEL_TEAM_ID=<your team ID>
export VERCEL_PROJECT_ID=<your project ID>
```

### 4. Run

```bash
python app.py
```

Open [http://localhost:8000](http://localhost:8000).

## Project structure

```
├── app.py                        # FastAPI backend
├── requirements.txt              # Python dependencies
├── static/
│   └── index.html                # Frontend (CodeMirror editor + deploy UI)
├── bridge/
│   ├── package.json              # Node.js bridge dependencies
│   └── sandbox_runner.mjs        # Bridge script using @vercel/sandbox SDK
├── .env.example
└── .gitignore
```

## Resources

- [@vercel/sandbox on npm](https://www.npmjs.com/package/@vercel/sandbox)
- [Vercel Sandbox docs](https://vercel.com/docs/vercel-sandbox)
- [Sandbox SDK reference](https://vercel.com/docs/vercel-sandbox/sdk-reference)
