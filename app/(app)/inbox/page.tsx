"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import {
  Avatar,
  Card,
  ErrorBanner,
  PageHeader,
  StatCard,
  TimeRange,
} from "@/components/ui";
import { Lead } from "@/lib/data";
import { useWorkspace } from "@/lib/store";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
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

function Checkbox() {
  return (
    <input
      type="checkbox"
      className="h-[15px] w-[15px] shrink-0 rounded border border-hairline accent-pill-dark"
    />
  );
}

export default function InboxPage() {
  const { campaigns, sequencedLeadIds } = useWorkspace();
  const [autoPilot, setAutoPilot] = useState(false);
  const [range, setRange] = useState("All time");

  const sequencedLeads = useMemo(() => {
    const leads: Lead[] = [];
    for (const c of campaigns) {
      for (const l of c.leads) {
        if (l.status === "sequenced" || sequencedLeadIds.has(l.id)) {
          leads.push(l);
        }
      }
    }
    return leads;
  }, [campaigns, sequencedLeadIds]);

  const contacted = sequencedLeads.length;

  return (
    <div className="mx-auto max-w-[980px] px-8 py-7">
      <PageHeader title="Inbox" subtitle="Track and manage your campaign" />

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Toggle on={autoPilot} onClick={() => setAutoPilot((v) => !v)} />
          <span className="text-[13px] text-ink-faint">Auto-pilot</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink"
          >
            All campaigns
            <ChevronDownIcon size={13} />
          </button>
          <TimeRange value={range} onChange={setRange} />
        </div>
      </div>

      <ErrorBanner>
        No Smartlead cold email campaign is mapped for this workspace.
      </ErrorBanner>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <StatCard label="Total contacted" value={contacted} />
        <StatCard label="Opened" value={0} pct="0.0%" />
        <StatCard label="Total replies" value={0} pct="0.0%" />
        <StatCard label="Bounced" value={0} pct="0.0%" />
      </div>

      <Card className="mt-4">
        <div className="flex items-center gap-3 border-b border-hairline-soft px-4 py-3">
          <Checkbox />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink"
          >
            All statuses
            <ChevronDownIcon size={13} />
          </button>
        </div>
        {contacted === 0 ? (
          <div className="px-4 py-6 text-[13.5px] italic text-ink-faint">
            No campaign activity yet.
          </div>
        ) : (
          sequencedLeads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center justify-between border-b border-hairline-soft px-4 py-3 last:border-0"
            >
              <div className="flex items-center gap-3">
                <Checkbox />
                <Avatar
                  char={lead.logoChar}
                  bg={lead.logoBg}
                  size={30}
                  rounded="rounded-lg"
                />
                <span className="text-[13.5px] font-medium">
                  {lead.contacts[0]?.name ?? lead.company}
                </span>
                <span className="text-[12.5px] text-ink-faint">
                  {lead.company}
                </span>
              </div>
              <span className="rounded-full bg-chip px-2.5 py-0.5 text-[11.5px]">
                Scheduled
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
