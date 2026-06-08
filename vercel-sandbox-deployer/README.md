# Vercel Sandbox Deployer

Write code in a browser editor and deploy it instantly to an ephemeral [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) MicroVM.

![Node.js 22 & Python 3.13](https://img.shields.io/badge/runtimes-Node.js_22_%7C_Python_3.13-blue)

## What it does

- **Code editor** with syntax highlighting (CodeMirror) for Node.js and Python
- **One-click deploy** to an isolated Firecracker MicroVM via the `@vercel/sandbox` SDK
- **Script mode**: runs your code and streams back stdout/stderr
- **Server mode**: specify a port to get a live HTTPS URL to your running server
- **Auto-installs packages**: detects `require()`/`import` statements and installs dependencies inside the sandbox
- **Built-in templates**: Hello World, HTTP server, Express API, and more

## Setup

### 1. Prerequisites

- Node.js 22+
- A Vercel account (Hobby plan works — includes 5 free CPU hours/month)
- A Vercel project linked to your team

### 2. Install dependencies

```bash
npm install
```

### 3. Link to Vercel & pull environment

```bash
npx vercel link        # follow prompts to select your team & project
npx vercel env pull    # pulls VERCEL_TOKEN (dev OIDC) into .env.local
```

**Or** set credentials manually — copy `.env.local.example` to `.env.local` and fill in:

```
VERCEL_TOKEN=<your token from vercel.com/account/tokens>
VERCEL_TEAM_ID=<your team ID>
VERCEL_PROJECT_ID=<your project ID>
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start deploying code to sandboxes.

## How it works

1. You write code in the browser editor and click **Deploy to Sandbox**
2. The Next.js API route calls `Sandbox.create()` from `@vercel/sandbox`
3. Your code is written into the MicroVM with `sandbox.writeFiles()`
4. Any third-party packages are auto-detected and installed
5. The code runs via `sandbox.runCommand()`
6. For scripts: stdout/stderr is captured and returned
7. For servers: the sandbox opens a port and returns a live HTTPS URL via `sandbox.domain(port)`

Sandboxes are ephemeral and auto-terminate after 5 minutes.

## Project structure

```
├── app/
│   ├── api/sandbox/route.ts   # API route — creates & manages sandboxes
│   ├── editor.tsx              # CodeMirror editor component
│   ├── globals.css             # Styling
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main UI with templates & deploy controls
├── .env.local.example          # Environment variable template
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Resources

- [@vercel/sandbox on npm](https://www.npmjs.com/package/@vercel/sandbox)
- [Vercel Sandbox docs](https://vercel.com/docs/vercel-sandbox)
- [Sandbox SDK reference](https://vercel.com/docs/vercel-sandbox/sdk-reference)
- [GitHub: vercel/sandbox](https://github.com/vercel/sandbox)
