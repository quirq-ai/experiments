"use client";

import { ReactNode, useState } from "react";
import { useParams } from "next/navigation";
import {
  BackIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  ExternalIcon,
} from "@/components/icons";
import { Avatar, Card, CountChip, PillButton, SignalBadge } from "@/components/ui";
import { Campaign, Lead, SequenceStep, SIGNAL_TYPES } from "@/lib/data";
import { useWorkspace } from "@/lib/store";

function dotFor(type: string) {
  return SIGNAL_TYPES.find((s) => s.name === type)?.dot;
}

function genericSequence(lead: Lead): SequenceStep[] {
  const first = lead.contacts[0]?.name.split(" ")[0] ?? "there";
  const signal = lead.signal.type.toLowerCase();
  return [
    {
      channel: "Email",
      day: 0,
      subject: `noticed the ${signal} news at ${lead.company}`,
      body: `Hi ${first}, saw that ${lead.company} just showed a "${signal}" signal. Teams at this stage usually hit the same wall we solve. Worth a quick look?`,
    },
    {
      channel: "LinkedIn",
      day: 2,
      body: `Hey ${first}, sent you a note over email about what usually follows a ${signal} moment. Would love your take.`,
    },
    {
      channel: "Email",
      day: 5,
      subject: "one quick idea",
      body: `One idea for ${lead.company}: we could sketch what this would look like for your team in under a week. Happy to share a short walkthrough.`,
    },
  ];
}

function Checkbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={checked ? "Deselect" : "Select"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
        checked
          ? "border-pill-dark bg-pill-dark text-white"
          : "border-hairline bg-card hover:border-ink-faint"
      }`}
    >
      {checked && <CheckIcon size={10} />}
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex px-5 py-[9px]">
      <div className="w-[130px] shrink-0 pt-[1px] text-[12.5px] text-ink-faint">
        {label}
      </div>
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">
        {children}
      </div>
    </div>
  );
}

function LinkValue({ text }: { text: string }) {
  return (
    <span className="inline-flex max-w-full cursor-pointer items-center gap-1 underline-offset-2 hover:underline">
      <span className="truncate">{text}</span>
      <ExternalIcon size={11} className="shrink-0 text-ink-faint" />
    </span>
  );
}

function Dash() {
  return <span className="text-ink-faint">-</span>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 mt-7 text-[12.5px] text-ink-faint">{children}</div>;
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const { campaigns, loaded, sequencedLeadIds, markSequenced, getMoreLeads } =
    useWorkspace();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [tab, setTab] = useState<"action" | "sequenced">("action");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [fetchingLeads, setFetchingLeads] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campaign = campaigns.find((c) => c.id === params.id);

  if (!campaign && !loaded) {
    return <div className="min-h-[70vh]" />;
  }

  if (!campaign) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <div className="text-[14px] font-medium">Campaign not found</div>
        <div className="mt-1 text-[13px] text-ink-soft">
          It may have been removed, or the link is stale.
        </div>
      </div>
    );
  }

  const allLeads = campaign.leads;
  const isSequenced = (lead: Lead) =>
    lead.status === "sequenced" || sequencedLeadIds.has(lead.id);
  const actionLeads = allLeads.filter((l) => !isSequenced(l));
  const sequencedLeads = allLeads.filter(isSequenced);
  const visibleLeads = tab === "action" ? actionLeads : sequencedLeads;
  const allChecked =
    visibleLeads.length > 0 && visibleLeads.every((l) => checked.has(l.id));

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) visibleLeads.forEach((l) => next.delete(l.id));
      else visibleLeads.forEach((l) => next.add(l.id));
      return next;
    });
  }

  async function fetchMoreLeads() {
    if (fetchingLeads) return;
    setFetchingLeads(true);
    setError(null);
    try {
      await getMoreLeads(campaign!.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get more leads");
    } finally {
      setFetchingLeads(false);
    }
  }

  async function applyLeadSequence(leadId: string) {
    if (applying) return;
    setApplying(true);
    setError(null);
    try {
      await markSequenced(leadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply sequence");
    } finally {
      setApplying(false);
    }
  }

  if (selectedLead) {
    const lead =
      allLeads.find((l) => l.id === selectedLead.id) ?? selectedLead;
    const contact = lead.contacts[0];
    const sequenced = lead.sequence !== undefined || sequencedLeadIds.has(lead.id);
    const steps = lead.sequence ?? genericSequence(lead);

    return (
      <div className="pb-4">
        <div className="px-5 pt-4">
          <div className="relative flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedLead(null)}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-chip"
            >
              <BackIcon size={14} />
              All leads
            </button>
            <span className="pointer-events-none absolute left-1/2 top-1/2 hidden max-w-[220px] min-[1080px]:block -translate-x-1/2 -translate-y-1/2 truncate text-[13.5px] font-semibold">
              {campaign.name}
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setSelectedLead(null)}
              className="rounded-full p-2 text-ink-soft transition-colors hover:bg-chip"
            >
              <CloseIcon size={15} />
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-[760px] px-6 pb-16">
          <div className="mt-4 flex items-center gap-3.5">
            <Avatar
              char={lead.logoChar}
              bg={lead.logoBg}
              size={46}
              rounded="rounded-2xl"
              fontSize={19}
            />
            <div className="min-w-0">
              <div className="truncate text-[19px] font-semibold">
                {lead.company}
              </div>
              <div className="text-[12.5px] text-ink-faint">{lead.tagline}</div>
            </div>
          </div>

          <SectionLabel>Company</SectionLabel>
          <Card className="divide-y divide-hairline-soft">
            <Row label="Website">
              <LinkValue text={lead.website} />
            </Row>
            <Row label="LinkedIn">
              {lead.linkedin ? <LinkValue text={lead.linkedin} /> : <Dash />}
            </Row>
            <Row label="Employees">{lead.employees}</Row>
            <Row label="Location">{lead.location}</Row>
            <Row label="About">{lead.about}</Row>
            <div className="px-5 py-2 text-[11.5px] text-ink-faint">
              Also collected during the run
            </div>
            <Row label="Company Keywords">{lead.keywords}</Row>
            {lead.evidence.map((entry) => (
              <div key={entry.label} className="divide-y divide-hairline-soft">
                <Row label={entry.label}>{entry.value}</Row>
                {entry.url && (
                  <Row label={`${entry.label} url`}>
                    <LinkValue text={entry.url} />
                  </Row>
                )}
              </div>
            ))}
            {lead.funding && <Row label="Funding amount">{lead.funding}</Row>}
          </Card>

          <SectionLabel>Contacts</SectionLabel>
          <Card className="divide-y divide-hairline-soft">
            <Row label="Name">{contact?.name ?? <Dash />}</Row>
            <Row label="Title">{contact?.title ?? <Dash />}</Row>
            <Row label="Email">{contact?.email ?? <Dash />}</Row>
            <Row label="Phone">{contact?.phone ?? <Dash />}</Row>
            <Row label="LinkedIn">
              {contact?.linkedin ? <LinkValue text={contact.linkedin} /> : <Dash />}
            </Row>
          </Card>

          <SectionLabel>Signal</SectionLabel>
          <Card className="divide-y divide-hairline-soft">
            <Row label="Type">
              <SignalBadge type={lead.signal.type} dot={dotFor(lead.signal.type)} />
            </Row>
            <Row label="Detected">{lead.signal.detected}</Row>
            <Row label="Source">
              <LinkValue text={lead.signal.source} />
            </Row>
            <Row label="Evidence">{lead.signal.evidence}</Row>
            <div className="px-5 py-2">
              <span className="inline-flex cursor-pointer items-center gap-1 text-[12.5px] text-ink-soft underline-offset-2 hover:underline">
                Read more
                <ExternalIcon size={11} className="text-ink-faint" />
              </span>
            </div>
            <Row label="Verdict">{lead.verdict}</Row>
          </Card>

          <SectionLabel>Sequence</SectionLabel>
          {sequenced ? (
            <Card>
              {steps.map((step, i) => (
                <div
                  key={i}
                  className="border-b border-hairline-soft px-5 py-4 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-chip px-2.5 py-0.5 text-[11.5px] font-medium">
                      {step.channel}
                    </span>
                    <span className="text-[12px] text-ink-faint">
                      Day {step.day}
                    </span>
                  </div>
                  {step.subject && (
                    <div className="mt-2 text-[13px] font-medium">
                      {step.subject}
                    </div>
                  )}
                  <div className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                    {step.body}
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="px-5 py-8 text-center">
              <div className="text-[14px] font-medium">
                You need to set up your sequence
              </div>
              <div className="mx-auto mt-1 max-w-[340px] text-[13px] text-ink-soft">
                Apply the campaign's sequence to draft this lead's emails, then
                edit them here.
              </div>
              <div className="mt-4">
                <PillButton
                  onClick={() => applyLeadSequence(lead.id)}
                  disabled={applying}
                >
                  {applying ? "Drafting with your agent…" : "Apply sequence"}
                </PillButton>
              </div>
              {error && (
                <div className="mx-auto mt-3 max-w-[340px] text-[12px] text-danger">
                  {error}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="px-5 pt-4">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-1">
            <CountChip
              label="Actions needed"
              count={actionLeads.length}
              active={tab === "action"}
              onClick={() => setTab("action")}
            />
            <CountChip
              label="Sequenced"
              count={sequencedLeads.length}
              active={tab === "sequenced"}
              onClick={() => setTab("sequenced")}
            />
          </div>
          <span className="pointer-events-none absolute left-1/2 top-1/2 hidden max-w-[220px] min-[1080px]:block -translate-x-1/2 -translate-y-1/2 truncate text-[13.5px] font-semibold">
            {campaign.name}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open campaign"
              className="rounded-full p-2 text-ink-soft transition-colors hover:bg-chip"
            >
              <ExternalIcon size={15} />
            </button>
            <PillButton variant="outline">Schedule</PillButton>
            <PillButton onClick={fetchMoreLeads} disabled={fetchingLeads}>
              {fetchingLeads ? "Sourcing…" : "Get more leads"}
            </PillButton>
          </div>
        </div>
      </div>

      <div className="px-5">
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-ink-soft transition-colors hover:text-ink"
        >
          Date added (newest)
          <ChevronDownIcon size={13} />
        </button>

        <div className="mt-2 flex items-center gap-2.5 px-2">
          <Checkbox checked={allChecked} onToggle={toggleAll} />
          <span className="text-[13px] text-ink-soft">Select all</span>
        </div>

        <div className="mt-1">
          {visibleLeads.length === 0 && (
            <div className="py-16 text-center text-[13px] text-ink-faint">
              {tab === "action"
                ? "No leads need action right now."
                : "No sequenced leads yet."}
            </div>
          )}
          {visibleLeads.map((lead) => (
            <div
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-hairline-soft"
            >
              <Checkbox
                checked={checked.has(lead.id)}
                onToggle={() => toggleChecked(lead.id)}
              />
              <Avatar
                char={lead.logoChar}
                bg={lead.logoBg}
                size={40}
                rounded="rounded-xl"
                fontSize={16}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold leading-tight">
                  {lead.company}
                </div>
                <div className="truncate text-[12.5px] text-ink-faint">
                  {lead.contacts[0]?.name} · {lead.contacts[0]?.title}
                </div>
              </div>
              <div className="shrink-0">
                <SignalBadge
                  type={lead.signal.type}
                  dot={dotFor(lead.signal.type)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
