"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpIcon, PlusIcon, PromptIcon } from "@/components/icons";
import { Dot } from "@/components/ui";
import { SUGGESTIONS } from "@/lib/data";
import { useWorkspace } from "@/lib/store";

const RUN_STEPS = [
  "Reading your ICP and business context…",
  "Scanning funding wires, job boards, and social feeds…",
  "Qualifying companies against the signal…",
  "Enriching contacts and drafting evidence…",
];

export default function DispatchPage() {
  const router = useRouter();
  const { dispatch: dispatchRun, claude } = useWorkspace();
  const [contact, setContact] = useState("");
  const [company, setCompany] = useState("");
  const [signal, setSignal] = useState("");
  const [promptMode, setPromptMode] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(
    () => () => timers.current.forEach(clearInterval),
    []
  );

  const canDispatch = promptMode
    ? prompt.trim().length > 0
    : [contact, company, signal].some((v) => v.trim().length > 0);

  async function dispatch() {
    if (!canDispatch || running) return;
    setRunning(true);
    setError(null);
    setStepIndex(0);
    const ticker = setInterval(
      () => setStepIndex((i) => Math.min(i + 1, RUN_STEPS.length - 1)),
      2200
    );
    timers.current.push(ticker);
    try {
      const { campaignId } = await dispatchRun({
        contact,
        company,
        signal,
        prompt: promptMode ? prompt : "",
      });
      clearInterval(ticker);
      router.push(`/campaigns/${campaignId}`);
    } catch (err) {
      clearInterval(ticker);
      setRunning(false);
      setError(err instanceof Error ? err.message : "Dispatch failed");
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-[640px] -mt-10">
        <div className="mb-16 flex justify-center">
          <span className="orb relative inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-pill-dark shadow-[0_6px_16px_rgba(28,25,23,0.25)]">
            <span className="h-[9px] w-[9px] rounded-full bg-white" />
          </span>
        </div>

        <h1 className="mb-7 text-center text-[22px] font-semibold tracking-tight">
          {running ? "Dispatching your agent…" : "Who should we go after?"}
        </h1>

        {running ? (
          <div className="rise-in mx-auto max-w-[420px] text-center">
            <div className="text-[13.5px] text-ink-soft">
              {RUN_STEPS[stepIndex]}
            </div>
            <div className="mx-auto mt-5 h-[3px] w-full overflow-hidden rounded-full bg-chip">
              <div
                className="h-full rounded-full bg-pill-dark transition-all duration-700"
                style={{
                  width: `${((stepIndex + 1) / RUN_STEPS.length) * 100}%`,
                }}
              />
            </div>
            <div className="mt-4 text-[12px] text-ink-faint">
              {claude.connected === false
                ? "Claude Code unavailable, using the built-in generator"
                : "Running on your Claude Code subscription"}
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-[22px] border border-hairline bg-card shadow-[0_10px_30px_rgba(28,25,23,0.05)]">
              {!promptMode ? (
                <div className="flex items-center gap-0 px-2 py-2.5">
                  <button
                    type="button"
                    aria-label="Add a list or files"
                    className="ml-1.5 mr-1 rounded-full p-1.5 text-ink-soft hover:bg-chip"
                  >
                    <PlusIcon size={15} />
                  </button>
                  {[
                    {
                      label: "Contact",
                      ph: "Add buyer titles",
                      value: contact,
                      set: setContact,
                    },
                    {
                      label: "Company",
                      ph: "Add company types",
                      value: company,
                      set: setCompany,
                    },
                    {
                      label: "Signal",
                      ph: "Add a trigger",
                      value: signal,
                      set: setSignal,
                    },
                  ].map((f, i) => (
                    <label
                      key={f.label}
                      className={`min-w-0 flex-1 cursor-text px-3 ${
                        i > 0 ? "border-l border-hairline" : ""
                      }`}
                    >
                      <span className="block text-[12px] font-medium text-ink">
                        {f.label}
                      </span>
                      <input
                        value={f.value}
                        onChange={(e) => f.set(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && dispatch()}
                        placeholder={f.ph}
                        className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    aria-label="Dispatch"
                    onClick={dispatch}
                    disabled={!canDispatch}
                    className={`mr-1 rounded-full p-2 transition-colors ${
                      canDispatch
                        ? "bg-pill-dark text-white hover:bg-black"
                        : "bg-chip text-ink-faint"
                    }`}
                  >
                    <ArrowUpIcon size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-2 px-4 py-3">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        dispatch();
                      }
                    }}
                    rows={2}
                    placeholder="Find me B2B SaaS companies that just raised a Series A…"
                    className="w-full resize-none bg-transparent text-[13.5px] outline-none placeholder:text-ink-faint"
                  />
                  <button
                    type="button"
                    aria-label="Dispatch"
                    onClick={dispatch}
                    disabled={!canDispatch}
                    className={`rounded-full p-2 transition-colors ${
                      canDispatch
                        ? "bg-pill-dark text-white hover:bg-black"
                        : "bg-chip text-ink-faint"
                    }`}
                  >
                    <ArrowUpIcon size={14} />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setPromptMode((v) => !v)}
                className="flex w-full items-center gap-2.5 rounded-b-[22px] border-t border-hairline-soft bg-[#f6f5f2] px-4 py-3 text-[13px] text-ink-soft transition-colors hover:text-ink"
              >
                <PromptIcon size={15} />
                {promptMode
                  ? "Use structured targeting instead"
                  : "Write a prompt instead"}
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-danger-bg px-4 py-2.5 text-[12.5px] text-danger">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-4">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => {
                    setPromptMode(false);
                    setSignal(s.title);
                    setContact(
                      s.title === "Hiring for a role"
                        ? "GTM workflow owner"
                        : "GTM leader"
                    );
                    setCompany("B2B SaaS");
                  }}
                  className="group flex min-w-0 items-center gap-3 text-left"
                >
                  <Dot color={s.dot} size={9} />
                  <span className="truncate text-[13.5px]">
                    <span className="font-semibold text-ink">
                      {s.title}:
                    </span>{" "}
                    <span className="text-ink-soft group-hover:text-ink">
                      {s.detail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
