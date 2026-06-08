"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";

const CodeEditor = dynamic(() => import("./editor"), { ssr: false });

const TEMPLATES: Record<string, { code: string; language: string; port: string }> = {
  "Hello World (Node)": {
    language: "node",
    port: "",
    code: `console.log("Hello from Vercel Sandbox!");
console.log("Node.js version:", process.version);
console.log("Platform:", process.platform);
console.log("Architecture:", process.arch);
console.log("");
console.log("This code is running inside an isolated Firecracker MicroVM.");`,
  },
  "HTTP Server (Node)": {
    language: "node",
    port: "3000",
    code: `const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(\`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: system-ui, sans-serif;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; margin: 0;
          background: #0a0a0b; color: #e4e4e7;
        }
        .card {
          text-align: center; padding: 48px;
          border: 1px solid #2a2a2e; border-radius: 16px;
          background: #141416;
        }
        h1 { font-size: 32px; margin-bottom: 8px; }
        p { color: #71717a; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Running in a Vercel Sandbox</h1>
        <p>This server was deployed to an ephemeral MicroVM.</p>
        <p>Request: \${req.method} \${req.url}</p>
      </div>
    </body>
    </html>
  \`);
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});`,
  },
  "Express API (Node)": {
    language: "node",
    port: "3000",
    code: `const express = require("express");
const app = express();

app.use(express.json());

const todos = [
  { id: 1, text: "Learn Vercel Sandbox", done: true },
  { id: 2, text: "Build something cool", done: false },
];

app.get("/", (req, res) => {
  res.json({
    message: "Todo API running in Vercel Sandbox",
    endpoints: {
      "GET /todos": "List all todos",
      "POST /todos": "Create a todo { text: string }",
    },
  });
});

app.get("/todos", (req, res) => res.json(todos));

app.post("/todos", (req, res) => {
  const todo = {
    id: todos.length + 1,
    text: req.body.text || "New todo",
    done: false,
  };
  todos.push(todo);
  res.status(201).json(todo);
});

app.listen(3000, () => console.log("Express API on port 3000"));`,
  },
  "Hello World (Python)": {
    language: "python",
    port: "",
    code: `import sys
import platform

print("Hello from Vercel Sandbox!")
print(f"Python version: {sys.version}")
print(f"Platform: {platform.platform()}")
print(f"Machine: {platform.machine()}")
print()
print("This code is running inside an isolated Firecracker MicroVM.")`,
  },
  "HTTP Server (Python)": {
    language: "python",
    port: "8000",
    code: `from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from datetime import datetime

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        response = {
            "message": "Python server running in Vercel Sandbox",
            "path": self.path,
            "time": datetime.now().isoformat(),
        }
        self.wfile.write(json.dumps(response, indent=2).encode())

    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]}")

server = HTTPServer(("0.0.0.0", 8000), Handler)
print("Python HTTP server running on port 8000")
server.serve_forever()`,
  },
};

type DeployResult = {
  sandboxId?: string;
  status: string;
  output: string;
  url?: string;
  exitCode?: number;
  error?: string;
};

export default function Home() {
  const [language, setLanguage] = useState("node");
  const [code, setCode] = useState(TEMPLATES["Hello World (Node)"].code);
  const [port, setPort] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<DeployResult | null>(null);

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    setResult(null);

    try {
      const res = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, port: port || undefined }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        status: "error",
        output: err instanceof Error ? err.message : "Deployment failed",
      });
    } finally {
      setDeploying(false);
    }
  }, [code, language, port]);

  const loadTemplate = (name: string) => {
    const t = TEMPLATES[name];
    setLanguage(t.language);
    setCode(t.code);
    setPort(t.port);
    setResult(null);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span>Sandbox</span> Deployer
        </h1>
        <p>Write code and deploy it to an ephemeral Vercel Sandbox MicroVM</p>
      </header>

      {/* Templates */}
      <div className="templates">
        {Object.keys(TEMPLATES).map((name) => (
          <button
            key={name}
            className="template-btn"
            onClick={() => loadTemplate(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="controls">
        <div className="select-wrapper">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="node">Node.js 22</option>
            <option value="python">Python 3.13</option>
          </select>
        </div>

        <div className="port-input">
          <label>Port:</label>
          <input
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="None"
          />
        </div>

        <button
          className="deploy-btn"
          onClick={handleDeploy}
          disabled={deploying || !code.trim()}
        >
          {deploying && <span className="spinner" />}
          {deploying ? "Deploying..." : "Deploy to Sandbox"}
        </button>
      </div>

      {/* Code Editor */}
      <div className="editor-container">
        <CodeEditor
          code={code}
          language={language}
          onChange={setCode}
        />
      </div>

      {/* Output */}
      <div className="output-section">
        <div className="output-header">
          <h3>Output</h3>
          {result && (
            <span className={`status-badge ${result.status}`}>
              {result.status}
            </span>
          )}
        </div>
        <div className="output-body">
          {deploying ? (
            <p className="placeholder">
              Creating sandbox and running your code...
            </p>
          ) : result ? (
            <>
              {result.sandboxId && (
                <pre style={{ color: "#71717a", marginBottom: 8 }}>
                  Sandbox ID: {result.sandboxId}
                </pre>
              )}
              <pre>{result.output || result.error}</pre>
              {result.url && (
                <div className="sandbox-url">
                  <a href={result.url} target="_blank" rel="noopener noreferrer">
                    {result.url}
                  </a>
                </div>
              )}
            </>
          ) : (
            <p className="placeholder">
              Deploy your code to see the output here
            </p>
          )}
        </div>
      </div>

      <div className="info-box">
        <strong>How it works:</strong> Your code runs inside an isolated
        Firecracker MicroVM powered by Vercel Sandbox. Scripts run and return
        output. If you specify a port, a server is started and you get a live
        URL. Sandboxes are ephemeral and auto-terminate after 5 minutes.
      </div>
    </div>
  );
}
