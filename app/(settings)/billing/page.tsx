"use client";

import Link from "next/link";
import { Card, PageHeader, PillButton } from "@/components/ui";
import { useWorkspace } from "@/lib/store";

export default function BillingPage() {
  const { credits } = useWorkspace();

  return (
    <div className="mx-auto max-w-[900px] px-8 py-7">
      <PageHeader title="Billing" subtitle="Your plan, credits, and invoices." />

      <Card>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-[13.5px] font-medium">Current plan</div>
            <div className="text-[12px] text-ink-faint">
              Free · renews never
            </div>
          </div>
          <span className="rounded-full bg-chip px-3 py-1 text-[12px] font-medium">
            Free
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-hairline-soft px-5 py-4">
          <div>
            <div className="text-[13.5px] font-medium">Credits</div>
            <div className="text-[12px] text-ink-faint">Monthly allowance</div>
          </div>
          <span className="text-[13.5px] font-medium">{credits} credits</span>
        </div>
        <div className="flex items-center justify-between border-t border-hairline-soft px-5 py-4">
          <div>
            <div className="text-[13.5px] font-medium">Upgrade</div>
            <div className="text-[12px] text-ink-faint">
              Unlock more credits and channels
            </div>
          </div>
          <Link href="/#pricing">
            <PillButton>Choose a plan</PillButton>
          </Link>
        </div>
      </Card>

      <div className="mt-6">
        <div className="mb-2 text-[12.5px] text-ink-faint">Invoices</div>
        <Card className="px-5 py-6 text-[13px] italic text-ink-faint">
          No invoices yet.
        </Card>
      </div>
    </div>
  );
}
