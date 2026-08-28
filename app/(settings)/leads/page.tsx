"use client";

import { Avatar, Card, PageHeader, SignalBadge } from "@/components/ui";
import { SIGNAL_TYPES } from "@/lib/data";
import { useWorkspace } from "@/lib/store";

export default function LeadsPage() {
  const { campaigns } = useWorkspace();
  const leads = campaigns.flatMap((c) => c.leads);

  return (
    <div className="mx-auto max-w-[900px] px-8 py-7">
      <PageHeader
        title="Leads"
        subtitle="Every lead your agents have sourced across campaigns."
      />

      <Card className="divide-y divide-hairline-soft">
        {leads.length === 0 ? (
          <div className="px-5 py-6 text-[13.5px] italic text-ink-faint">
            No leads sourced yet.
          </div>
        ) : (
          leads.map((lead) => {
            const contact = lead.contacts[0];
            const dot = SIGNAL_TYPES.find(
              (s) => s.name === lead.signal.type
            )?.dot;
            return (
              <div
                key={lead.id}
                className="flex items-center gap-3 px-5 py-3.5"
              >
                <Avatar
                  char={lead.logoChar}
                  bg={lead.logoBg}
                  size={34}
                  rounded="rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">
                    {lead.company}
                  </div>
                  <div className="truncate text-[12px] text-ink-faint">
                    {contact
                      ? `${contact.name} · ${contact.title} · ${lead.location}`
                      : lead.location}
                  </div>
                </div>
                <SignalBadge type={lead.signal.type} dot={dot} />
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
