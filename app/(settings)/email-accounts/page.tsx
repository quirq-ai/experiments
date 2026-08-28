"use client";

import { Card, PageHeader, PillButton } from "@/components/ui";

const COLUMNS = [
  "Email",
  "Provider",
  "Source",
  "Status",
  "Health",
  "Daily capacity",
  "Reputation score",
];

export default function EmailAccountsPage() {
  return (
    <div className="mx-auto max-w-[900px] px-8 py-7">
      <PageHeader
        title="Email accounts"
        subtitle="Inboxes sending for this campaign"
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.6fr_0.9fr_0.9fr_0.8fr_0.8fr_1fr_1.1fr] gap-2 border-b border-hairline bg-[#f6f5f2] px-4 py-2.5 text-[12px] font-medium text-ink-soft">
          {COLUMNS.map((c) => (
            <span key={c} className="truncate">
              {c}
            </span>
          ))}
        </div>
        <div className="px-4 py-5 text-[13px] text-ink-faint">
          No email accounts found. Connect an inbox or provision a workspace
          email account.
        </div>
      </Card>

      <div className="mt-4 flex gap-2">
        <PillButton>Connect inbox</PillButton>
        <PillButton variant="outline">Buy inboxes</PillButton>
      </div>
    </div>
  );
}
