import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { bytes, longDate, num, plural, timeAgo } from "@/lib/format";
import type { AgentFile, AgentInfo, AgentSession } from "@/lib/types";
import { count } from "./lead";
import { Figure, MonthBars, shortDate } from "./history";
import { Sub } from "./parts";

// An agent's own sections: the instructions and memory it reads, shown the way a README
// is, then its sessions and activity, told from file names, sizes and dates alone.

/** Front matter ("---\ndescription: ...\n---") split from the body, as plain key/value pairs. */
function frontMatter(text: string): { meta: Record<string, string>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv && kv[2].trim()) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: text.slice(m[0].length) };
}

/** Markdown as a README is drawn: no raw HTML, no images, outside links in a new tab,
 * relative links inert, headings set below the file's own. */
function Body({ markdown }: { markdown: string }) {
  const heading = (level: number) =>
    function Heading({ children }: { children?: React.ReactNode }) {
      const Tag = `h${Math.min(6, level + 3)}` as "h4" | "h5" | "h6";
      return <Tag>{children}</Tag>;
    };
  return (
    <div className="prose-wiki">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: heading(1),
          h2: heading(2),
          h3: heading(3),
          h4: heading(3),
          h5: heading(3),
          h6: heading(3),
          img: () => null,
          a: ({ href, children }) =>
            href && /^https?:\/\//i.test(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}

const fileName = (p: string) => p.split("/").pop() ?? p;
const folderOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");

function InstructionFile({ file, open }: { file: AgentFile; open: boolean }) {
  const { meta, body } = frontMatter(file.text);
  const about = meta.description || meta.name || null;
  return (
    <details open={open} className="group border-t border-line first:border-t-0">
      <summary className="flex cursor-pointer list-none items-baseline gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
        <svg aria-hidden width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 translate-y-px text-muted transition-transform group-open:rotate-90">
          <path d="m9 6 6 6-6 6" />
        </svg>
        <span className="min-w-0 flex-1 font-mono text-[13px] text-ink [overflow-wrap:anywhere]">
          <span className="text-muted">{folderOf(file.path)}</span>
          {fileName(file.path)}
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-muted">
          {plural(file.words, "word")}
          {file.modified && <span className="max-sm:hidden"> · {timeAgo(file.modified)}</span>}
        </span>
      </summary>
      <div className="pb-6 pl-6">
        {about && <p className="mb-4 font-serif text-[16px] italic leading-snug text-ink-2">{about}</p>}
        {(meta.globs || meta.alwaysapply) && (
          <p className="mb-4 font-mono text-[11.5px] text-muted">
            {meta.globs && <>applies to {meta.globs}</>}
            {meta.globs && meta.alwaysapply && " · "}
            {meta.alwaysapply && <>always applied: {meta.alwaysapply}</>}
          </p>
        )}
        <Body markdown={body} />
      </div>
    </details>
  );
}

export function AgentInstructions({ agent }: { agent: AgentInfo }) {
  const files = agent.instructions;
  const memory = files.filter((f) => /(^|\/)(memory|memories|agent-memory)\//i.test(f.path)).length;
  const told = files.length - memory;
  const parts = [told && `${count(told)} ${told === 1 ? "file" : "files"} of instructions`, memory && `${count(memory)} of memory`].filter(Boolean);
  return (
    <>
      <p className="prose-wiki">
        {agent.tool} keeps {parts.join(" and ")} here. Each is shown as it was written, trimmed to its first few thousand characters, with anything that looked like a
        credential taken out.
      </p>
      <div className="mt-5 rounded-xl border border-line bg-surface px-4 sm:px-5">
        {files.map((f, i) => (
          <InstructionFile key={f.path} file={f} open={i === 0} />
        ))}
      </div>
    </>
  );
}

/** A session file as a short line: its folder, its name with a long id cut short. */
function SessionName({ path }: { path: string }) {
  const name = fileName(path);
  const short = name.replace(/^([0-9a-z]{8})[0-9a-z-]{12,}/i, "$1…");
  return (
    <span className="min-w-0 truncate font-mono text-[12.5px]" title={path}>
      <span className="text-muted">{folderOf(path)}</span>
      <span className="text-ink">{short}</span>
    </span>
  );
}

function FileList({ items }: { items: AgentSession[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((s) => (
        <li key={s.path} className="flex items-baseline gap-3 py-2">
          <SessionName path={s.path} />
          <span className="ml-auto shrink-0 text-[12px] tabular-nums text-muted">
            {s.bytes > 0 && <>{bytes(s.bytes)} · </>}
            <time dateTime={s.date}>{s.date ? longDate(s.date) : "undated"}</time>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AgentSessions({ agent }: { agent: AgentInfo }) {
  const s = agent.sessions;
  const a = agent.activity;
  const activeMonths = a.monthly.filter((m) => m.count > 0).length;
  return (
    <>
      {s && (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
            <Figure value={num(s.count)} label={s.count === 1 ? "Session" : "Sessions"} />
            <Figure value={s.bytes > 0 ? bytes(s.bytes) : "None"} label="Transcripts" />
            <Figure value={shortDate(s.first)} label="First session" />
            <Figure value={shortDate(s.last)} label="Latest session" />
          </div>
          {s.monthly.filter((m) => m.count > 0).length >= 2 && (
            <Sub label="Sessions" className="mt-10">
              <MonthBars
                months={s.monthly}
                per="Sessions per month, by when each was last written"
                noun="session"
                note={s.first && s.monthly[0] && s.first.slice(0, 7) < s.monthly[0].month ? "Earlier sessions fall outside the chart." : null}
              />
            </Sub>
          )}
          <Sub label="Recent sessions" aside={s.count > s.recent.length ? `the ${count(s.recent.length)} newest of ${num(s.count)}` : undefined} className="mt-10">
            <FileList items={s.recent} />
          </Sub>
        </>
      )}

      <Sub label="Activity" className={s ? "mt-10" : ""}>
        <p className="prose-wiki">
          {a.files === 0
            ? "The folder holds no files of its own yet."
            : `Its ${plural(a.files, "file")} ${a.files === 1 ? "was" : "were"} last written ${a.last ? timeAgo(a.last) : "at an unknown time"}${
                a.recent ? `, ${a.recent === a.files ? (a.files === 1 ? "and that" : "all of them") : count(a.recent)} within the 30 days before Innerpedia last looked` : ", none of them within the 30 days before Innerpedia last looked"
              }.`}
        </p>
        {activeMonths >= 2 && (
          <div className="mt-5">
            <MonthBars months={a.monthly} per="Files by the month they were last written" noun="file" />
          </div>
        )}
      </Sub>

      {a.logs.length > 0 && (
        <Sub label="Activity logs" className="mt-10">
          <FileList items={a.logs} />
        </Sub>
      )}

      <p className="mt-8 text-[12.5px] leading-relaxed text-muted">
        Innerpedia knows {s ? "these sessions and logs" : "this activity"} by file names, sizes and dates alone. It never opens a session or a log.
      </p>
    </>
  );
}
