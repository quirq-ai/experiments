"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHeader, PillButton } from "@/components/ui";
import { CloseIcon } from "@/components/icons";
import { useWorkspace } from "@/lib/store";

const inputClass =
  "w-full rounded-lg border border-hairline bg-card px-3 py-2 text-[13px] outline-none focus:border-ink-faint placeholder:text-ink-faint";

type SaveStatus = "idle" | "saving" | "saved";

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

function useSectionSave(save: (patch: Record<string, unknown>) => Promise<void>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  async function run(patch: Record<string, unknown>, onSuccess: () => void) {
    setStatus("saving");
    setError(null);
    try {
      await save(patch);
      onSuccess();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }
  return { status, error, run };
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 mb-2 text-[12.5px] text-ink-faint first:mt-0">
      {children}
    </div>
  );
}

function SettingRow({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-6 border-b border-hairline-soft px-5 py-4 last:border-0">
      <div className="w-[240px] shrink-0">
        <div className="text-[13.5px] font-medium">{title}</div>
        <div className="mt-0.5 text-[12px] text-ink-faint">{desc}</div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
        selected
          ? "border-ink-faint bg-chip"
          : "border-hairline bg-card hover:border-ink-faint"
      }`}
    >
      {label}
    </button>
  );
}

function AddChips({
  items,
  placeholder,
  onAdd,
  onRemove,
}: {
  items: string[];
  placeholder: string;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => (
        <span
          key={it}
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-chip px-3 py-1.5 text-[12.5px] font-medium"
        >
          {it}
          <button
            type="button"
            aria-label={`Remove ${it}`}
            onClick={() => onRemove(it)}
            className="text-ink-faint hover:text-ink"
          >
            <CloseIcon size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            e.preventDefault();
            onAdd(draft.trim());
            setDraft("");
          }
        }}
        placeholder={placeholder}
        className="w-[160px] rounded-full border border-dashed border-hairline bg-card px-3.5 py-1.5 text-[12.5px] font-medium outline-none placeholder:text-ink-faint focus:border-ink-faint"
      />
    </div>
  );
}

function SaveButton({
  dirty,
  status,
  error,
  onSave,
}: {
  dirty: boolean;
  status: SaveStatus;
  error: string | null;
  onSave: () => void;
}) {
  return (
    <div className="mt-3">
      <div className="flex justify-end">
        <PillButton
          className={dirty ? "" : "bg-[#a3a09b] hover:bg-[#a3a09b]"}
          onClick={onSave}
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save"}
        </PillButton>
      </div>
      {error ? (
        <div className="mt-1.5 text-right text-[12px] text-danger">{error}</div>
      ) : null}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { loaded, profile, saveProfile } = useWorkspace();
  const initialized = useRef(false);

  const [name, setName] = useState("Quirq");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [businessModel, setBusinessModel] = useState<string[]>([]);
  const [stage, setStage] = useState("");
  const [localServices, setLocalServices] = useState("");
  const [proofPoints, setProofPoints] = useState<string[]>([]);
  const [identityDirty, setIdentityDirty] = useState(false);

  const [channel, setChannel] = useState("Email");
  const [email, setEmail] = useState("suraj@example.com");
  const [phone, setPhone] = useState("");
  const [contactDirty, setContactDirty] = useState(false);

  const [buyerTitles, setBuyerTitles] = useState<string[]>([]);
  const [companyTypes, setCompanyTypes] = useState<string[]>([]);
  const [companySize, setCompanySize] = useState("");
  const [geography, setGeography] = useState("");
  const [icpNotes, setIcpNotes] = useState("");
  const [icpDirty, setIcpDirty] = useState(false);

  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorsDirty, setCompetitorsDirty] = useState(false);

  const identitySave = useSectionSave(saveProfile);
  const contactSave = useSectionSave(saveProfile);
  const icpSave = useSectionSave(saveProfile);
  const competitorsSave = useSectionSave(saveProfile);

  useEffect(() => {
    if (!loaded || initialized.current) return;
    initialized.current = true;
    setName(asString(profile.name, "Quirq"));
    setWebsite(asString(profile.website));
    setLocation(asString(profile.location));
    setDescription(asString(profile.description));
    setCategories(asStrings(profile.categories));
    setBusinessModel(asStrings(profile.businessModel));
    setStage(asString(profile.stage));
    setLocalServices(asString(profile.localServices));
    setProofPoints(asStrings(profile.proofPoints));
    setChannel(asString(profile.channel, "Email"));
    setEmail(asString(profile.email, "suraj@example.com"));
    setPhone(asString(profile.phone));
    setBuyerTitles(asStrings(profile.buyerTitles));
    setCompanyTypes(asStrings(profile.companyTypes));
    setCompanySize(asString(profile.companySize));
    setGeography(asString(profile.geography));
    setIcpNotes(asString(profile.icpNotes));
    setCompetitors(asStrings(profile.competitors));
  }, [loaded, profile]);

  function toggleModel(m: string) {
    setBusinessModel((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
    setIdentityDirty(true);
  }

  function saveIdentity() {
    if (!identityDirty || identitySave.status === "saving") return;
    void identitySave.run(
      {
        name,
        website,
        location,
        description,
        categories,
        businessModel,
        stage,
        localServices,
        proofPoints,
      },
      () => setIdentityDirty(false)
    );
  }

  function saveContact() {
    if (!contactDirty || contactSave.status === "saving") return;
    void contactSave.run({ channel, email, phone }, () =>
      setContactDirty(false)
    );
  }

  function saveIcp() {
    if (!icpDirty || icpSave.status === "saving") return;
    void icpSave.run(
      { buyerTitles, companyTypes, companySize, geography, icpNotes },
      () => setIcpDirty(false)
    );
  }

  function saveCompetitors() {
    if (!competitorsDirty || competitorsSave.status === "saving") return;
    void competitorsSave.run({ competitors }, () => setCompetitorsDirty(false));
  }

  return (
    <div className="mx-auto max-w-[820px] px-8 py-7">
      <PageHeader
        title="Profile"
        subtitle="Your business facts, contact details, and account."
      />

      <SectionLabel>Identity</SectionLabel>
      <Card>
        <SettingRow
          title="Name"
          desc="The name your agents use for your business"
        >
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setIdentityDirty(true);
            }}
            className={inputClass}
          />
        </SettingRow>
        <SettingRow
          title="Website"
          desc="The public URL your agents use for business context"
        >
          <input
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              setIdentityDirty(true);
            }}
            placeholder="https://example.com"
            className={inputClass}
          />
        </SettingRow>
        <SettingRow title="Location" desc="Where the business is based">
          <input
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setIdentityDirty(true);
            }}
            placeholder="Austin, TX (or Remote)"
            className={inputClass}
          />
        </SettingRow>
        <SettingRow title="Description" desc="What you do and for whom">
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setIdentityDirty(true);
            }}
            rows={3}
            placeholder="One or two sentences on what the business does and for whom."
            className={`${inputClass} resize-none`}
          />
        </SettingRow>
        <SettingRow title="Categories" desc="Industries or verticals">
          <AddChips
            items={categories}
            placeholder="+ Add category"
            onAdd={(v) => {
              setCategories((prev) =>
                prev.includes(v) ? prev : [...prev, v]
              );
              setIdentityDirty(true);
            }}
            onRemove={(v) => {
              setCategories((prev) => prev.filter((x) => x !== v));
              setIdentityDirty(true);
            }}
          />
        </SettingRow>
        <SettingRow
          title="Business model"
          desc="How the business makes money"
        >
          <div className="flex flex-wrap gap-2">
            {["Ecommerce", "SaaS", "Service", "Content", "Not sure yet"].map(
              (m) => (
                <Choice
                  key={m}
                  label={m}
                  selected={businessModel.includes(m)}
                  onClick={() => toggleModel(m)}
                />
              )
            )}
          </div>
        </SettingRow>
        <SettingRow title="Stage" desc="Where the business is today">
          <div className="flex flex-wrap gap-2">
            {["Idea", "Pre-launch", "Launched", "Making revenue"].map((s) => (
              <Choice
                key={s}
                label={s}
                selected={stage === s}
                onClick={() => {
                  setStage(s);
                  setIdentityDirty(true);
                }}
              />
            ))}
          </div>
        </SettingRow>
        <SettingRow
          title="Local services business"
          desc="Serves customers in a physical area"
        >
          <div className="flex flex-wrap gap-2">
            {["Yes", "No"].map((s) => (
              <Choice
                key={s}
                label={s}
                selected={localServices === s}
                onClick={() => {
                  setLocalServices(s);
                  setIdentityDirty(true);
                }}
              />
            ))}
          </div>
        </SettingRow>
        <SettingRow
          title="Proof points"
          desc="Concrete results your product delivered; used in outreach copy"
        >
          <AddChips
            items={proofPoints}
            placeholder="+ Add proof point"
            onAdd={(v) => {
              setProofPoints((prev) =>
                prev.includes(v) ? prev : [...prev, v]
              );
              setIdentityDirty(true);
            }}
            onRemove={(v) => {
              setProofPoints((prev) => prev.filter((x) => x !== v));
              setIdentityDirty(true);
            }}
          />
        </SettingRow>
      </Card>
      <SaveButton
        dirty={identityDirty}
        status={identitySave.status}
        error={identitySave.error}
        onSave={saveIdentity}
      />

      <SectionLabel>Primary mode of contact</SectionLabel>
      <Card>
        <SettingRow
          title="Channel"
          desc="How your strategist reaches you for decisions, milestones, and critical issues"
        >
          <div className="flex flex-wrap gap-2">
            {["Email", "iMessage"].map((c) => (
              <Choice
                key={c}
                label={c}
                selected={channel === c}
                onClick={() => {
                  setChannel(c);
                  setContactDirty(true);
                }}
              />
            ))}
          </div>
        </SettingRow>
        <SettingRow title="Email" desc="The address on your account">
          <input
            value={email}
            readOnly
            className={inputClass}
          />
        </SettingRow>
        <SettingRow
          title="Phone number"
          desc="The iPhone your strategist texts over iMessage"
        >
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setContactDirty(true);
            }}
            placeholder="+1 555 000 1234"
            className={inputClass}
          />
          <p className="mt-1.5 text-[12px] text-ink-faint">
            Connect your iPhone to text with your strategist.
          </p>
        </SettingRow>
      </Card>
      <SaveButton
        dirty={contactDirty}
        status={contactSave.status}
        error={contactSave.error}
        onSave={saveContact}
      />

      <SectionLabel>Ideal Customer Profile</SectionLabel>
      <Card>
        <SettingRow
          title="Buyer titles"
          desc="Job titles of the people who buy"
        >
          <AddChips
            items={buyerTitles}
            placeholder="+ Add title"
            onAdd={(v) => {
              setBuyerTitles((prev) =>
                prev.includes(v) ? prev : [...prev, v]
              );
              setIcpDirty(true);
            }}
            onRemove={(v) => {
              setBuyerTitles((prev) => prev.filter((x) => x !== v));
              setIcpDirty(true);
            }}
          />
        </SettingRow>
        <SettingRow
          title="Company types"
          desc="Kinds of companies that buy"
        >
          <AddChips
            items={companyTypes}
            placeholder="+ Add type"
            onAdd={(v) => {
              setCompanyTypes((prev) =>
                prev.includes(v) ? prev : [...prev, v]
              );
              setIcpDirty(true);
            }}
            onRemove={(v) => {
              setCompanyTypes((prev) => prev.filter((x) => x !== v));
              setIcpDirty(true);
            }}
          />
        </SettingRow>
        <SettingRow
          title="Company size"
          desc="Typical employee-count band"
        >
          <input
            value={companySize}
            onChange={(e) => {
              setCompanySize(e.target.value);
              setIcpDirty(true);
            }}
            placeholder="11 to 50"
            className={inputClass}
          />
        </SettingRow>
        <SettingRow title="Geography" desc="Where your customers are">
          <input
            value={geography}
            onChange={(e) => {
              setGeography(e.target.value);
              setIcpDirty(true);
            }}
            placeholder="North America"
            className={inputClass}
          />
        </SettingRow>
        <SettingRow title="Notes" desc="Budget, tooling, triggers to buy">
          <textarea
            value={icpNotes}
            onChange={(e) => {
              setIcpNotes(e.target.value);
              setIcpDirty(true);
            }}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </SettingRow>
      </Card>
      <SaveButton
        dirty={icpDirty}
        status={icpSave.status}
        error={icpSave.error}
        onSave={saveIcp}
      />

      <SectionLabel>Competitors</SectionLabel>
      <Card>
        <SettingRow title="Competitors" desc="Who you're up against">
          <AddChips
            items={competitors}
            placeholder="+ Add competitor"
            onAdd={(v) => {
              setCompetitors((prev) =>
                prev.includes(v) ? prev : [...prev, v]
              );
              setCompetitorsDirty(true);
            }}
            onRemove={(v) => {
              setCompetitors((prev) => prev.filter((x) => x !== v));
              setCompetitorsDirty(true);
            }}
          />
        </SettingRow>
      </Card>
      <SaveButton
        dirty={competitorsDirty}
        status={competitorsSave.status}
        error={competitorsSave.error}
        onSave={saveCompetitors}
      />

      <SectionLabel>Account</SectionLabel>
      <Card>
        <SettingRow title="Sign out" desc="End this session on this device">
          <div className="flex justify-end">
            <PillButton variant="outline" onClick={() => router.push("/login")}>
              Sign out
            </PillButton>
          </div>
        </SettingRow>
        <SettingRow
          title="Delete account"
          desc="Permanently delete your account, workspaces, and associated data"
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {}}
              className="rounded-full border border-[#e5b8b1] bg-card px-4 py-[7px] text-[13px] font-medium text-danger transition-colors hover:bg-danger-bg"
            >
              Delete account
            </button>
          </div>
        </SettingRow>
      </Card>
    </div>
  );
}
