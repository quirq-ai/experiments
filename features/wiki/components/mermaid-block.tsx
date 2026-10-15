"use client";

import { useEffect, useId, useState } from "react";

/*
  Renders a \`\`\`mermaid fence from a wiki doc as an SVG diagram.
  Mermaid is heavy, so it loads lazily on first use and initializes once
  with the dark theme (the app is dark only for now). While rendering,
  and if the diagram fails to parse, the raw source shows in the same
  code block style the wiki uses, so nothing is ever lost.
*/

let initialized = false;

async function renderMermaid(id: string, code: string): Promise<string> {
  const mermaid = (await import("mermaid")).default;
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      fontFamily: "inherit",
      themeVariables: { fontSize: "13px" },
    });
    initialized = true;
  }
  const { svg } = await mermaid.render(id, code);
  return svg;
}

export function MermaidBlock({ code }: { code: string }) {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = `mmd-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
    renderMermaid(id, code)
      .then((result) => {
        if (!cancelled) setSvg(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (svg) {
    return (
      <div
        className="mb-4 flex justify-center overflow-x-auto rounded-md border bg-white/[0.02] p-4 [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <pre
      className={
        failed
          ? "mb-4 overflow-x-auto rounded-md border bg-white/[0.03] p-3 font-mono text-xs leading-relaxed text-foreground/90"
          : "mb-4 animate-pulse overflow-x-auto rounded-md border bg-white/[0.02] p-3 font-mono text-xs leading-relaxed text-faint"
      }
    >
      {code}
    </pre>
  );
}
