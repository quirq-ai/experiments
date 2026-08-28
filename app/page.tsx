"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/logo";
import {
  ArrowUpIcon,
  CheckIcon,
  DispatchIcon,
  WatcherIcon,
  InboxIcon,
  AnalyticsIcon,
  CampaignsIcon,
} from "@/components/icons";
import { Card, Dot, PillButton } from "@/components/ui";
import { PLANS } from "@/lib/data";

const TYPED_PROMPTS = [
  "Find me B2B SaaS founders who just raised a seed round",
  "Find me marketing agencies hiring SEO leads",
  "Find me Shopify stores replatforming their checkout",
];

function useTyping() {
  const [text, setText] = useState("");
  useEffect(() => {
    let prompt = 0;
    let i = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = TYPED_PROMPTS[prompt];
      if (!deleting) {
        i++;
        setText(full.slice(0, i));
        if (i === full.length) {
          deleting = true;
          timer = setTimeout(tick, 1800);
          return;
        }
        timer = setTimeout(tick, 42);
      } else {
        i -= 3;
        if (i <= 0) {
          i = 0;
          deleting = false;
          prompt = (prompt + 1) % TYPED_PROMPTS.length;
          timer = setTimeout(tick, 400);
        } else {
          timer = setTimeout(tick, 18);
        }
        setText(full.slice(0, Math.max(0, i)));
      }
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, []);
  return text;
}

function DarkLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full bg-pill-dark px-4 py-[7px] text-[13px] font-medium text-white transition-colors hover:bg-black"
    >
      {children}
    </Link>
  );
}

function OutlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-hairline bg-card px-4 py-[7px] text-[13px] font-medium text-ink shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-colors hover:border-ink-faint"
    >
      {children}
    </Link>
  );
}

function FeatureSection({
  title,
  copy,
  visual,
  flip,
}: {
  title: string;
  copy: string;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="grid items-center gap-12 py-16 md:grid-cols-2">
      <div className={flip ? "md:order-2" : ""}>
        <h2 className="max-w-[380px] text-[27px] font-semibold leading-tight tracking-tight">
          {title}
        </h2>
        <p className="mt-3 max-w-[400px] text-[14.5px] leading-relaxed text-ink-soft">
          {copy}
        </p>
      </div>
      <div className={`flex justify-center ${flip ? "md:order-1" : ""}`}>
        {visual}
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: (typeof PLANS)[number] }) {
  const [tier, setTier] = useState(0);
  return (
    <Card
      className={`relative p-6 ${plan.popular ? "border-ink shadow-[0_12px_32px_rgba(28,25,23,0.07)]" : ""}`}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-pill-dark px-3 py-1 text-[11px] font-medium text-white">
          Most popular
        </span>
      )}
      <div className="text-[15px] font-semibold">{plan.name}</div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-[15px] font-medium text-ink-soft">$</span>
        <span className="text-[34px] font-semibold leading-none tracking-tight">
          {plan.creditTiers[tier].price}
        </span>
        <span className="text-[12.5px] text-ink-faint">/mo</span>
      </div>
      <p className="mt-2 min-h-[36px] text-[12.5px] leading-snug text-ink-soft">
        {plan.blurb}
      </p>
      <Link
        href="/login"
        className="mt-4 flex w-full items-center justify-center rounded-full bg-pill-dark py-2 text-[13px] font-medium text-white transition-colors hover:bg-black"
      >
        {plan.cta}
      </Link>
      <div className="mt-5 text-[11.5px] text-ink-faint">
        Monthly credits and price
      </div>
      <select
        value={tier}
        onChange={(e) => setTier(Number(e.target.value))}
        className="mt-1.5 w-full rounded-lg border border-hairline bg-card px-3 py-2 text-[12.5px] outline-none"
      >
        {plan.creditTiers.map((t, i) => (
          <option key={t.credits} value={i}>
            {t.credits} credits, ${t.price}/mo
          </option>
        ))}
      </select>
      <div className="mt-5 text-[11.5px] text-ink-faint">
        Here&apos;s what&apos;s included:
      </div>
      <ul className="mt-2 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-[12.5px]">
            <CheckIcon size={13} className="shrink-0 text-ink-soft" />
            {f}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Landing() {
  const typed = useTyping();

  return (
    <div className="bg-canvas">
      <header className="sticky top-0 z-30 border-b border-hairline-soft bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-[54px] max-w-[1060px] items-center justify-between px-6">
          <Link href="/">
            <Wordmark size={19} />
          </Link>
          <nav className="flex items-center gap-5">
            <a href="#pricing" className="text-[13px] font-medium text-ink-soft hover:text-ink">
              Pricing
            </a>
            <a href="#demo" className="text-[13px] font-medium text-ink-soft hover:text-ink">
              Book a demo
            </a>
            <Link href="/login" className="text-[13px] font-medium text-ink-soft hover:text-ink">
              Sign in
            </Link>
            <DarkLink href="/login">Sign up</DarkLink>
          </nav>
        </div>
      </header>

      <section className="px-6 pb-10 pt-24 text-center">
        <h1 className="text-[46px] font-semibold leading-[1.15] tracking-tight">
          Find customers the moment
          <br />
          they want to buy
        </h1>
        <p className="mt-4 text-[13px] text-ink-faint">
          No credit card. Try for free.
        </p>

        <div className="relative mx-auto mt-9 min-h-[130px] max-w-[600px] rounded-[22px] border border-hairline bg-card p-5 text-left shadow-[0_10px_30px_rgba(28,25,23,0.05)]">
          <span className="text-[14px] text-ink-soft">
            {typed}
            <span className="caret ml-[1px] inline-block h-[16px] w-[1.5px] translate-y-[3px] bg-ink" />
          </span>
          <Link
            href="/login"
            aria-label="Dispatch"
            className="absolute bottom-4 right-4 rounded-full bg-pill-dark p-2 text-white transition-colors hover:bg-black"
          >
            <ArrowUpIcon size={14} />
          </Link>
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <PillButton variant="outline">Use my website</PillButton>
          <PillButton variant="outline">See another</PillButton>
        </div>

        <div id="demo" className="mt-8 flex justify-center gap-2">
          <DarkLink href="/login">Book a demo</DarkLink>
          <OutlineLink href="/login">Pick a time</OutlineLink>
        </div>
      </section>

      <div className="mx-auto mt-14 max-w-[900px] px-6">
        <div className="rounded-t-[18px] bg-[#8f8d89] px-2.5 pt-2.5">
          <div className="mb-2 flex gap-1.5 px-1">
            <span className="h-2 w-2 rounded-full bg-[#7d7b77]" />
            <span className="h-2 w-2 rounded-full bg-[#7d7b77]" />
            <span className="h-2 w-2 rounded-full bg-[#7d7b77]" />
          </div>
          <div className="pointer-events-none flex h-[360px] select-none overflow-hidden rounded-t-[10px] border border-b-0 border-hairline bg-card">
            <div className="w-[170px] shrink-0 border-r border-hairline bg-sidebar p-3">
              <Wordmark size={13} />
              <div className="mt-4 space-y-[2px]">
                {[
                  { label: "Dispatch", icon: DispatchIcon, active: true },
                  { label: "Watcher", icon: WatcherIcon },
                  { label: "Inbox", icon: InboxIcon },
                  { label: "Analytics", icon: AnalyticsIcon },
                ].map(({ label, icon: Icon, active }) => (
                  <div
                    key={label}
                    className={`flex items-center gap-2 rounded-md px-2 py-[5px] text-[11px] font-medium text-ink-soft ${active ? "bg-chip text-ink" : ""}`}
                  >
                    <Icon size={11} />
                    {label}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 px-2 text-[11px] font-medium text-ink-soft">
                <CampaignsIcon size={11} />
                Campaigns
              </div>
              <div className="mt-1 space-y-[2px] pl-6">
                <div className="truncate text-[10.5px] text-ink-soft">
                  Marketing agency · Raised…
                </div>
                <div className="truncate text-[10.5px] text-ink-soft">
                  B2B SaaS · Raised funding
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center px-8">
              <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-pill-dark">
                <span className="h-[6px] w-[6px] rounded-full bg-white" />
              </span>
              <div className="mt-5 text-[13px] font-semibold">
                Who should we go after?
              </div>
              <div className="mt-4 flex w-full max-w-[340px] items-center rounded-full border border-hairline bg-card px-3 py-2 shadow-[0_4px_14px_rgba(28,25,23,0.05)]">
                <div className="flex-1 border-r border-hairline px-2">
                  <div className="text-[8.5px] font-medium">Contact</div>
                  <div className="text-[8.5px] text-ink-faint">Buyer titles</div>
                </div>
                <div className="flex-1 border-r border-hairline px-2">
                  <div className="text-[8.5px] font-medium">Company</div>
                  <div className="text-[8.5px] text-ink-faint">Company types</div>
                </div>
                <div className="flex-1 px-2">
                  <div className="text-[8.5px] font-medium">Signal</div>
                  <div className="text-[8.5px] text-ink-faint">Add a trigger</div>
                </div>
                <span className="ml-1 inline-block h-4 w-4 rounded-full bg-pill-dark" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1060px] px-6">
        <FeatureSection
          title="Monitor the internet for buying signals"
          copy="Every day, potential customers reveal spending intents online. Autospawn turns these intents into your leads."
          visual={
            <Card className="w-full max-w-[420px] p-4">
              {[
                { dot: "#34d399", text: "Series A announced · fintech, NYC" },
                { dot: "#f4536e", text: "3 LLM engineer roles posted" },
                { dot: "#8b5cf6", text: "CTO reacting to competitor launch" },
                { dot: "#f59042", text: "Migrating off legacy CRM" },
              ].map((r) => (
                <div
                  key={r.text}
                  className="flex items-center gap-2.5 border-b border-hairline-soft py-2.5 last:border-0"
                >
                  <Dot color={r.dot} size={8} />
                  <span className="text-[12.5px] text-ink-soft">{r.text}</span>
                </div>
              ))}
            </Card>
          }
        />

        <FeatureSection
          flip
          title="Agents qualify leads in seconds"
          copy="Verify surfaced leads against your ICP and ensure the signal reveals true intent. Never contact the uninterested."
          visual={
            <Card className="w-full max-w-[420px] p-5">
              {[
                "Matches ICP: B2B SaaS, 10 to 50 seats",
                "Signal inside the 45 day window",
                "Decision maker identified",
              ].map((t) => (
                <div key={t} className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-chip">
                    <CheckIcon size={11} className="text-ink" />
                  </span>
                  <span className="text-[12.5px]">{t}</span>
                </div>
              ))}
              <div className="mt-4 rounded-xl bg-hairline-soft p-3 text-[12px] italic leading-relaxed text-ink-soft">
                Verdict: raised a $15M Series A inside the qualification window,
                and the CEO owns the buying decision. Qualified.
              </div>
            </Card>
          }
        />

        <FeatureSection
          title="Multi-channel sequencing like a human"
          copy="Contact leads with care across email, LinkedIn, and Instagram. Nurture a lasting relationship. No AI slop."
          visual={
            <Card className="w-full max-w-[420px] p-5">
              {[
                { chip: "Email", day: "Day 0", text: "congrats on the raise, saw the announcement this morning…" },
                { chip: "LinkedIn", day: "Day 2", text: "sent you a note over email, would love your take…" },
                { chip: "Email", day: "Day 5", text: "one idea for the new team you're hiring…" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="ml-2 border-l border-hairline pb-4 pl-4 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-chip px-2.5 py-0.5 text-[11.5px] font-medium">
                      {s.chip}
                    </span>
                    <span className="text-[11.5px] text-ink-faint">{s.day}</span>
                  </div>
                  <div className="mt-1.5 truncate text-[12.5px] text-ink-soft">
                    {s.text}
                  </div>
                </div>
              ))}
            </Card>
          }
        />

        <FeatureSection
          flip
          title="Outbound agents that self-improve"
          copy="Your agents learn which campaigns work and which don't. They kill the losers and scale the winners."
          visual={
            <Card className="w-full max-w-[420px] p-5">
              <div className="flex h-[120px] items-end gap-2">
                {[18, 26, 22, 34, 42, 55, 74, 92].map((h, i) => (
                  <div
                    key={i}
                    className={`bar-grow flex-1 rounded-t ${i >= 6 ? "bg-pill-dark" : "bg-chip"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11.5px] text-ink-faint">
                <span>killed</span>
                <span>scaled</span>
              </div>
            </Card>
          }
        />

        <FeatureSection
          title="Handle outbound in one place"
          copy="You no longer need Apollo & ZoomInfo for leads, Instantly for sequencing, PrimeForge for hosting, and GoDaddy for domains."
          visual={
            <Card className="w-full max-w-[420px] p-5">
              <div className="flex flex-wrap gap-2">
                {["Apollo", "ZoomInfo", "Instantly", "PrimeForge", "GoDaddy"].map(
                  (t) => (
                    <span
                      key={t}
                      className="rounded-full border border-hairline px-3 py-1 text-[12px] text-ink-faint line-through"
                    >
                      {t}
                    </span>
                  )
                )}
                <span className="rounded-full bg-pill-dark px-3 py-1 text-[12px] font-medium text-white">
                  Autospawn
                </span>
              </div>
            </Card>
          }
        />
      </div>

      <section id="pricing" className="mx-auto max-w-[1060px] px-6 py-20">
        <div className="text-center">
          <h2 className="text-[28px] font-semibold tracking-tight">
            Choose a plan
          </h2>
          <p className="mt-2 text-[13.5px] text-ink-soft">
            Start free, upgrade when the pipeline does.
          </p>
        </div>
        <div className="mt-10 grid items-start gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <PlanCard key={p.name} plan={p} />
          ))}
        </div>
        <Card className="mx-auto mt-8 flex max-w-[720px] items-center justify-between p-8">
          <div>
            <div className="text-[15px] font-semibold">Try it for free</div>
            <div className="mt-1 text-[12.5px] text-ink-soft">
              500 credits to get your first leads. No card required.
            </div>
          </div>
          <DarkLink href="/login">Start free</DarkLink>
        </Card>
      </section>

      <section className="px-6 py-24 text-center">
        <h2 className="text-[34px] font-semibold leading-tight tracking-tight">
          Find your first 50 active leads
          <br />
          in 5 minutes
        </h2>
        <p className="mt-3 text-[13.5px] text-ink-soft">
          Deploy your first agent
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <DarkLink href="/login">Start for free</DarkLink>
          <OutlineLink href="/login">Book a demo</OutlineLink>
        </div>
      </section>

      <footer className="border-t border-hairline-soft">
        <div className="mx-auto grid max-w-[1060px] gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark size={17} />
            <p className="mt-3 max-w-[220px] text-[12.5px] leading-relaxed text-ink-soft">
              Agents that find customers the moment they want to buy.
            </p>
          </div>
          {[
            {
              head: "Product",
              links: ["Pricing", "Book a demo", "Sign in", "Start for free"],
            },
            { head: "Company", links: ["About", "Careers", "Contact"] },
            { head: "Legal", links: ["Privacy", "Terms"] },
          ].map((col) => (
            <div key={col.head}>
              <div className="mb-3 text-[12px] font-medium">{col.head}</div>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link
                      href={l === "Pricing" ? "#pricing" : "/login"}
                      className="text-[12.5px] text-ink-soft hover:text-ink"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-[1060px] px-6 pb-8">
          <div className="border-t border-hairline-soft pt-6 text-[11.5px] text-ink-faint">
            © 2026 Autospawn. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
