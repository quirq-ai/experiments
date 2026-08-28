"use client";

import { useState } from "react";
import { Card, PageHeader } from "@/components/ui";

const ROWS = [
  {
    label: "Send email sequences",
    desc: "Agents may send approved sequences automatically",
    initial: true,
  },
  {
    label: "Send LinkedIn messages",
    desc: "Requires a connected LinkedIn account",
    initial: false,
  },
  {
    label: "Spend credits on enrichment",
    desc: "Enrich leads without confirmation up to 50 credits",
    initial: true,
  },
  {
    label: "Auto-kill losing campaigns",
    desc: "Pause campaigns with reply rates under 0.5%",
    initial: false,
  },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors ${
        on ? "bg-pill-dark" : "bg-chip"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow-[0_1px_2px_rgba(28,25,23,0.2)] transition-all ${
          on ? "left-[16px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

export default function PermissionsPage() {
  const [states, setStates] = useState<boolean[]>(ROWS.map((r) => r.initial));

  function toggle(i: number) {
    setStates((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  return (
    <div className="mx-auto max-w-[900px] px-8 py-7">
      <PageHeader
        title="Permissions"
        subtitle="What your agents are allowed to do without asking."
      />

      <Card className="divide-y divide-hairline-soft">
        {ROWS.map((r, i) => (
          <div
            key={r.label}
            className="flex items-center justify-between px-5 py-4"
          >
            <div>
              <div className="text-[13.5px] font-medium">{r.label}</div>
              <div className="text-[12px] text-ink-faint">{r.desc}</div>
            </div>
            <Toggle on={states[i]} onToggle={() => toggle(i)} />
          </div>
        ))}
      </Card>
    </div>
  );
}
