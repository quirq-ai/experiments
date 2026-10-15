import type React from "react";
import { MermaidBlock } from "@/features/wiki/components/mermaid-block";

/*
  Renders the markdown subset wiki docs are written in (docs/DESIGN.md,
  Prose recipe): ## and ### headings, bullet and numbered lists, ``` code
  fences (a ```mermaid fence renders as a diagram via MermaidBlock),
  paragraphs, and inline `code` / `**bold**`. Hand-rolled on purpose to
  keep the parser tiny; swap for a real markdown library if docs outgrow
  this.
*/

function inline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={i} className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-xs text-foreground">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

const isHeading = (l: string) => /^#{1,6}\s/.test(l);
const isBullet = (l: string) => /^[-*]\s/.test(l);
const isNumbered = (l: string) => /^\d+\.\s/.test(l);
const isFence = (l: string) => l.startsWith("```");
const isSpecial = (l: string) =>
  isHeading(l) || isBullet(l) || isNumbered(l) || isFence(l) || l.trim() === "";

export function DocMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isFence(line)) {
      const lang = line.slice(3).trim().toLowerCase();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !isFence(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        lang === "mermaid" ? (
          <MermaidBlock key={blocks.length} code={code.join("\n")} />
        ) : (
          <pre
            key={blocks.length}
            className="mb-4 overflow-x-auto rounded-md border bg-white/[0.03] p-3 font-mono text-xs leading-relaxed text-foreground/90"
          >
            {code.join("\n")}
          </pre>
        )
      );
      continue;
    }

    if (isHeading(line)) {
      // ## is the top level (text-lg), ### the second (text-base), deeper
      // levels and a lone # fold into the nearest supported size.
      const level = line.match(/^#+/)?.[0].length ?? 2;
      const text = line.replace(/^#{1,6}\s/, "");
      blocks.push(
        level <= 2 ? (
          <h2 key={blocks.length} className="mt-8 mb-2 text-lg font-semibold text-foreground first:mt-0">
            {inline(text)}
          </h2>
        ) : level === 3 ? (
          <h3 key={blocks.length} className="mt-7 mb-2 text-base font-semibold text-foreground first:mt-0">
            {inline(text)}
          </h3>
        ) : (
          <h4 key={blocks.length} className="mt-5 mb-1.5 text-sm font-semibold text-foreground first:mt-0">
            {inline(text)}
          </h4>
        )
      );
      i += 1;
      continue;
    }

    if (isBullet(line) || isNumbered(line)) {
      const numbered = isNumbered(line);
      const start = numbered ? Number(line.match(/^(\d+)\./)?.[1] ?? "1") : 1;
      const items: string[] = [];
      while (i < lines.length && (numbered ? isNumbered(lines[i]) : isBullet(lines[i]))) {
        items.push(lines[i].replace(numbered ? /^\d+\.\s/ : /^[-*]\s/, ""));
        i += 1;
      }
      const cls = "mb-4 space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90 marker:text-faint";
      blocks.push(
        numbered ? (
          <ol key={blocks.length} start={start} className={`list-decimal ${cls}`}>
            {items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ol>
        ) : (
          <ul key={blocks.length} className={`list-disc ${cls}`}>
            {items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        )
      );
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (i < lines.length && !isSpecial(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={blocks.length} className="mb-4 text-sm leading-relaxed text-foreground/90">
        {inline(para.join(" "))}
      </p>
    );
  }

  return <div>{blocks}</div>;
}
