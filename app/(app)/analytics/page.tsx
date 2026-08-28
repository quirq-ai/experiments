"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "@/components/icons";
import {
  Card,
  ErrorBanner,
  PageHeader,
  SignalBadge,
  TimeRange,
} from "@/components/ui";
import { SIGNAL_TYPES } from "@/lib/data";
import { useWorkspace } from "@/lib/store";

export default function AnalyticsPage() {
  const { campaigns, sequencedLeadIds } = useWorkspace();
  const [range, setRange] = useState("All time");

  const sequencedCount = useMemo(() => {
    let n = sequencedLeadIds.size;
    for (const c of campaigns) {
      for (const l of c.leads) {
        if (l.status === "sequenced" && !sequencedLeadIds.has(l.id)) n += 1;
      }
    }
    return n;
  }, [campaigns, sequencedLeadIds]);

  return (
    <div className="mx-auto max-w-[980px] px-8 py-7">
      <PageHeader
        title="Analytics"
        subtitle="See how your campaigns are performing"
      />

      <ErrorBanner>
        No Smartlead cold email campaign is mapped for this workspace.
      </ErrorBanner>

      <Card className="mt-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[15px] font-semibold">Performance</div>
            <div className="mt-0.5 text-[12.5px] text-ink-faint">
              Each campaign&apos;s performance by day
            </div>
          </div>
          <TimeRange value={range} onChange={setRange} />
        </div>
        <div className="mt-4 h-[150px] rounded-xl border border-dashed border-hairline">
          {sequencedCount === 0 ? (
            <div className="flex h-full items-center justify-center text-[13px] text-ink-faint">
              No campaign send data yet.
            </div>
          ) : (
            <div className="flex h-full items-end gap-[6px] p-4">
              {Array.from({ length: 28 }, (_, i) => (
                <div
                  key={i}
                  className="bar-grow flex-1 rounded-t bg-pill-dark/80"
                  style={{
                    height: `${((i * 37) % 60) + 10}%`,
                    animationDelay: `${i * 20}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <h2 className="mb-3 mt-7 text-[15px] font-semibold">Campaigns</h2>

      <Card>
        {campaigns.length === 0 ? (
          <div className="px-5 py-5 text-[13.5px] italic text-ink-faint">
            No campaigns have been created yet.
          </div>
        ) : (
          campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="flex items-center justify-between gap-4 border-b border-hairline-soft px-5 py-4 transition-colors last:border-0 hover:bg-[#fcfcfa]"
            >
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium">
                  {c.name}
                </div>
                <div className="mt-0.5 text-[12px] text-ink-faint">
                  {c.leads.length} leads · created {c.createdAt}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <SignalBadge
                  type={c.signalType}
                  dot={SIGNAL_TYPES.find((s) => s.name === c.signalType)?.dot}
                />
                <ChevronDownIcon
                  size={14}
                  className="-rotate-90 text-ink-faint"
                />
              </div>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
