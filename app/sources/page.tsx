import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { SiteFooter } from "@/components/site-footer";
import { InputPanel } from "@/components/sources/input-panel";
import { PathTools } from "@/components/sources/path-tools";
import { RemoteControls } from "@/components/sources/remote-controls";
import { ThisTabRow } from "@/components/sources/this-tab";
import { TopBar } from "@/components/top-bar";
import { historyLabel, sessionIds } from "@/lib/activity";
import { getLocalIndex } from "@/lib/data";
import { remoteStatus } from "@/lib/db/remote-sync";
import { dbStatus } from "@/lib/db/status";
import { count } from "@/components/wiki/article/lead";
import { bytes, num, plural, timeAgo } from "@/lib/format";
import { wikiHref } from "@/lib/links";
import { DEMO } from "@/lib/mode";
import { sourceInfo, type GeneratedItem } from "@/lib/source-storage";

// Sources, the setup page: what Innernet reads, what it makes from it, and where the copy
// is kept, in the order data flows. Set like the History page, its sibling: an eyebrow,
// the title, a serif lead and a few figures, then three numbered sections drawn with type
// and hairlines, and notes in the margin. Rendered here, on the server, with the small
// controls (components/sources/*) as the only script.

export const metadata: Metadata = {
  title: "Sources",
  description: "What Innernet reads, what it makes from it, and where it keeps the copy.",
};

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/wiki", label: "Innerpedia" },
  { href: "/activity", label: "History" },
  { href: wikiHref("Special:Statistics"), label: "Statistics" },
];

const AURORA_MASK = "radial-gradient(ellipse min(620px, 100vw) 300px at 18% 0%, #000 10%, transparent 100%)";
const label = "text-[11px] font-medium uppercase tracking-[0.12em] text-muted";
const fine = "text-[12.5px] leading-[1.55] text-muted";
const code = "mt-2.5 overflow-x-auto rounded-[10px] border border-line bg-bg-sunk px-3.5 py-3 font-mono text-[11.5px] leading-[1.75] text-ink-2";
const row = "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[124px_minmax(0,1fr)_minmax(0,auto)_76px]";

/** A section head like the field guide's: a roman numeral, the title, a word at the right. */
function Section({ id, mark, title, aside, children }: { id: string; mark: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 pt-16">
      <div className="flex items-baseline gap-4 border-b border-line-strong pb-2.5">
        <span className="w-8 shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-faint">{mark}</span>
        <h2 id={`${id}-title`} className="min-w-0 flex-1 font-display text-[30px] leading-[1.12] tracking-[-0.01em] text-ink sm:text-[34px]">
          {title}
        </h2>
        {aside && <span className="hidden shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted sm:inline">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ n, label: what }: { n: number; label: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-1.5 text-[12.5px] text-muted">{what}</dt>
      <dd className="font-display text-[44px] leading-none tracking-[-0.01em] text-ink tabular-nums">{num(n)}</dd>
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span aria-hidden className={`mt-[7px] size-[7px] shrink-0 rounded-full ${on ? "bg-good" : "border border-line-strong"}`} />;
}

/** One generated item: what it is, where it is, how big and how fresh, and its tools. */
function GeneratedRow({ item }: { item: GeneratedItem }) {
  const facts = !item.exists ? "not made yet" : [item.bytes != null && `${item.more ? "at least " : ""}${bytes(item.bytes)}`, item.modified && timeAgo(item.modified)].filter(Boolean).join(" · ");
  return (
    <li className={row}>
      <span className="text-[14px] text-ink">{item.label}</span>
      <span className="order-3 col-span-2 min-w-0 truncate font-mono text-[12.5px] text-ink-2 sm:order-none sm:col-span-1" title={item.path}>
        {item.path}
      </span>
      <span className="order-4 col-span-2 whitespace-nowrap text-[12.5px] tabular-nums text-muted sm:order-none sm:col-span-1 sm:text-right">
        {facts}
        {item.id === "history" && item.detail && item.exists ? ` · ${item.detail}` : ""}
      </span>
      {item.exists ? (
        <span className="flex justify-end">
          <PathTools id={item.id} label={item.label.toLowerCase()} path={item.path} />
        </span>
      ) : (
        <span />
      )}
    </li>
  );
}

export default async function SourcesPage() {
  if (DEMO) notFound();

  const info = sourceInfo(null);
  const local = getLocalIndex();
  const [db, remote] = await Promise.all([dbStatus(), remoteStatus()]);
  const sessions = sessionIds().length;
  const folders = local.missing ? 0 : local.index.meta.counts.pages;
  const generated = info.generated.filter((g) => g.kind !== "browser" && g.id !== "database");
  const history = historyLabel();
  const last = remote.last;

  return (
    <div className="flex min-h-[calc(100dvh-var(--demo-bar,0px))] flex-col">
      <TopBar />
      <main id="content" tabIndex={-1} className="relative isolate flex-1 overflow-x-clip focus:outline-none">
        <div className="aurora" aria-hidden style={{ maskImage: AURORA_MASK, WebkitMaskImage: AURORA_MASK, opacity: "calc(var(--aurora-opacity) * 0.7)" }}>
          <span />
          <span />
          <span />
        </div>

        <div className="relative mx-auto max-w-[1240px] px-4 pb-24 pt-12 sm:px-6 sm:pt-16 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16 xl:gap-24">
          <div className="min-w-0 max-w-[780px]">
            <header>
              <p className="rise text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Your setup</p>
              <h1 className="rise mt-3 font-display text-[52px] leading-[0.98] tracking-[-0.02em] text-ink sm:text-[64px]" style={{ animationDelay: "40ms" }}>
                Sources
              </h1>
              <p className="rise mt-4 max-w-[580px] font-serif text-[18px] leading-[1.6] text-ink-2 sm:text-[19px]" style={{ animationDelay: "80ms" }}>
                Innernet reads the folders and repositories you choose, makes an index and a history from them, and keeps a copy in a database on this machine
                {remote.connected ? (
                  <>
                    {" "}and in <span className="whitespace-nowrap">{remote.label}</span>
                  </>
                ) : null}
                .
              </p>
              <dl className="rise mt-9 flex flex-wrap gap-x-10 gap-y-6" style={{ animationDelay: "120ms" }}>
                <Stat n={folders} label={folders === 1 ? "folder indexed" : "folders indexed"} />
                <Stat n={info.remote.repositories.length} label={info.remote.repositories.length === 1 ? "repository" : "repositories"} />
                <Stat n={sessions} label={sessions === 1 ? "session of history" : "sessions of history"} />
              </dl>
            </header>

            <Section id="input" mark="I" title="Input" aside={[info.selection.local && "folders", info.selection.remote && "GitHub"].filter(Boolean).join(" + ")}>
              <InputPanel
                selection={info.selection}
                repositories={info.remote.repositories}
                legacyAccount={info.remote.legacyAccount}
                local={{
                  roots: info.local.roots,
                  depth: info.local.maxDepth == null ? null : count(info.local.maxDepth),
                  error: info.local.error ?? null,
                  facts: local.missing ? "Not indexed yet: Sync now builds it." : `${plural(folders, "folder")}, indexed ${timeAgo(local.index.meta.generatedAt)}.`,
                }}
                remote={{
                  error: info.remote.error ?? null,
                  facts: !info.remote.repositories.length
                    ? null
                    : info.remote.generatedAt
                      ? `${plural(info.remote.pages ?? 0, "page")}, synced ${timeAgo(info.remote.generatedAt)}.`
                      : "Not synced yet: Sync now brings them in.",
                }}
              />
            </Section>

            <Section id="generated" mark="II" title="Generated data" aside={`${generated.length + 1} items`}>
              <p className={`mt-4 ${fine}`}>Made from the input. Paths are relative to the app, or to your home folder.</p>
              <ul className="mt-2 divide-y divide-line border-b border-line">
                {generated.map((item) => (
                  <Fragment key={item.id}>
                    <GeneratedRow item={item} />
                    {item.id === "history" && <ThisTabRow historyDir={history} className={row} />}
                  </Fragment>
                ))}
              </ul>
              <p className={`mt-3 ${fine}`}>
                In this browser: this tab&apos;s session and trail, in <span className="font-mono text-[11.5px] text-ink-2">sessionStorage</span>, and the theme, in{" "}
                <span className="font-mono text-[11.5px] text-ink-2">localStorage</span>.
              </p>
            </Section>

            <Section id="storage" mark="III" title="Storage" aside={remote.connected ? "two copies" : "one copy"}>
              <p className={`mt-4 ${fine}`}>Where the copy of the index and history is kept. The files above stay the record.</p>

              <div className="flex gap-4 border-b border-line py-6">
                <Dot on={db.state === "ready"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-[15px] font-medium text-ink">This machine</h3>
                    <span className="font-mono text-[12.5px] text-ink-2">{db.label}</span>
                  </div>
                  <p className={`mt-1.5 ${fine}`}>
                    {db.state === "ready"
                      ? [
                          db.index?.pages != null && plural(db.index.pages, "page"),
                          db.activity && plural(db.activity.lines, "history line"),
                          db.bytes ? bytes(db.bytes) : null,
                          db.index?.storedAt && `stored ${timeAgo(db.index.storedAt)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Empty so far."
                      : db.note}
                  </p>
                  <p className={`mt-1 ${fine}`}>PGlite, inside this server. Always in use; nothing in it leaves this machine on its own.</p>
                </div>
              </div>

              <div className="flex gap-4 border-b border-line py-6">
                <Dot on={remote.connected && !!last?.ok} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-[15px] font-medium text-ink">Remote</h3>
                    <span className="font-mono text-[12.5px] text-ink-2">{remote.configured ? remote.label : "none set up"}</span>
                  </div>
                  <p className={`mt-1.5 ${remote.connected && last && !last.ok ? "text-[13px] text-ink" : fine}`}>
                    {!remote.configured ? (
                      <>
                        Put a Postgres URL in <span className="font-mono text-[11.5px] text-ink-2">~/.innernet/remote.json</span> to connect one; the README says how.
                      </>
                    ) : !remote.connected ? (
                      "Connect it to keep a second copy in step both ways: what this machine makes goes up, and history from your other machines comes down."
                    ) : remote.syncing ? (
                      "Syncing now."
                    ) : !last ? (
                      "Connected. The first sync runs in a moment."
                    ) : last.ok ? (
                      `Synced ${timeAgo(last.at)}: it holds ${plural(last.pages ?? 0, "page")} and ${plural(last.lines ?? 0, "history line")}${last.down ? `, and sent ${plural(last.down, "line")} down` : ""}.`
                    ) : (
                      `The last sync, ${timeAgo(last.at)}, did not finish: ${last.error}`
                    )}
                  </p>
                  {remote.configured && <RemoteControls connected={remote.connected} label={remote.label} />}
                </div>
              </div>
            </Section>
          </div>

          <aside aria-label="About these settings" className="mt-16 space-y-10 border-t border-line pt-10 lg:mt-[10px] lg:border-t-0 lg:pt-0">
            <section aria-labelledby="settings-files">
              <h2 id="settings-files" className={label}>
                Where the settings live
              </h2>
              <dl className="mt-3 space-y-2.5 text-[13px] leading-[1.5]">
                {[
                  ["innernet.config.json", "the folders, and how deep"],
                  ["data/sources.json", "what is switched on, and the repositories"],
                  ["~/.innernet/remote.json", "the remote database's address, a secret"],
                  ["~/.innernet/storage.json", "whether it is connected"],
                ].map(([file, what]) => (
                  <div key={file}>
                    <dt className="font-mono text-[12px] text-ink">{file}</dt>
                    <dd className="text-muted">{what}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="terminal">
              <h2 id="terminal" className={label}>
                From a terminal
              </h2>
              <pre className={code}>
                {"pnpm index"}
                <span className="text-faint">{"            the folders"}</span>
                {"\npnpm index:demo"}
                <span className="text-faint">{"       the demo"}</span>
                {"\npnpm db:status --remote"}
                {"\npnpm db:load --remote"}
                <span className="text-faint">{"  a new machine"}</span>
              </pre>
            </section>

            <section aria-labelledby="leaves">
              <h2 id="leaves" className={label}>
                What leaves this machine
              </h2>
              <p className="mt-3 font-serif text-[16px] leading-[1.6] text-ink-2">
                A GitHub sync only downloads, anonymously, the public repositories you list. Your index and history go out only while the remote is connected, and only
                to it; disconnecting stops that, and what it holds stays there until you delete it.
              </p>
            </section>
          </aside>
        </div>
      </main>
      <SiteFooter links={LINKS} />
    </div>
  );
}
