export type EvidenceRow = {
  label: string;
  value: string;
  url?: string;
};

export type Contact = {
  name: string;
  title: string;
  email?: string;
  phone?: string;
  linkedin?: string;
};

export type LeadSignal = {
  type: string;
  detected: string;
  source: string;
  sourceUrl: string;
  evidence: string;
};

export type SequenceStep = {
  channel: "Email" | "LinkedIn" | "Instagram";
  day: number;
  subject?: string;
  body: string;
};

export type Lead = {
  id: string;
  company: string;
  tagline: string;
  logoChar: string;
  logoBg: string;
  website: string;
  linkedin?: string;
  employees: number;
  location: string;
  about: string;
  keywords: string;
  evidence: EvidenceRow[];
  funding?: string;
  contacts: Contact[];
  signal: LeadSignal;
  verdict: string;
  status: "action" | "sequenced";
  sequence?: SequenceStep[];
};

export type WatchedAccount = {
  id: string;
  name: string;
  domain: string;
  signals: string[];
};

export type Campaign = {
  id: string;
  name: string;
  signalType: string;
  createdAt: string;
  leads: Lead[];
};

export const SIGNAL_TYPES = [
  { name: "Raised funding", dot: "#34d399" },
  { name: "Hiring for a role", dot: "#f4536e" },
  { name: "Social engagement with competitor", dot: "#8b5cf6" },
  { name: "Solving problem themselves", dot: "#f59042" },
  { name: "New exec hire", dot: "#38bdf8" },
  { name: "Product launch", dot: "#facc15" },
  { name: "Tech stack change", dot: "#a3e635" },
];

export const SUGGESTIONS = [
  {
    dot: "#8b5cf6",
    title: "Social engagement with competitor",
    detail: "GTM leaders reacting to Mantiks or LoneScale's job-intent content",
  },
  {
    dot: "#f59042",
    title: "Solving problem themselves",
    detail:
      "RevOps practitioners duct-taping LinkedIn Jobs, Clay, and Apollo into prospect feeds",
  },
  {
    dot: "#f4536e",
    title: "Hiring for a role",
    detail:
      "Teams adding GTM workflow owners around Clay, Apollo, and buying signals",
  },
];

export const CAMPAIGNS: Campaign[] = [
  {
    id: "marketing-agency-raised-funding",
    name: "Marketing agency · Raised funding",
    signalType: "Raised funding",
    createdAt: "2026-08-12",
    leads: [
      {
        id: "lumenreach",
        company: "lumenreach",
        tagline: "Marketing agency / SEO",
        logoChar: "l",
        logoBg: "#141b33",
        website: "lumenreach.io",
        employees: 18,
        location: "San Francisco, United States",
        about:
          "AI-native agency for organic search combining SEO agents with dedicated experts and full-service support.",
        keywords: "SEO, organic search, AI-native agency",
        evidence: [
          {
            label: "Evidence company fit",
            value:
              "lumenreach is an AI-native SEO agency that combines a proven methodology with SEO agents and dedicated experts through full-service support.",
            url: "lumenreach.io/company",
          },
          {
            label: "Evidence geography",
            value:
              "lumenreach is headquartered in San Francisco, United States.",
            url: "linkedin.com/company/lumenreach",
          },
          {
            label: "Founder role evidence",
            value: "Maya Ferrant is CEO and Co-Founder of lumenreach.",
            url: "linkedin.com/in/mayaferrant",
          },
        ],
        funding: "$15m Series A; $21m total raised",
        contacts: [
          {
            name: "Maya Ferrant",
            title: "CEO and Co-Founder",
            linkedin: "linkedin.com/in/mayaferrant",
          },
        ],
        signal: {
          type: "Raised funding",
          detected: "Aug 14",
          source: "pressloop.com/…ai-native-agency-for-seo",
          sourceUrl: "#",
          evidence:
            "Lumenreach raises $15M to build an AI-native agency for SEO. The Series A was led by Crestline Ventures, with Beacon Capital participating. The round brings total funding to $21m and will go toward hiring, product development, and go-to-market expansion.",
        },
        verdict:
          "lumenreach is an AI-native SEO and organic-search marketing agency, and its CEO and Co-Founder is Maya Ferrant. It announced a $15M Series A on August 14, 2026, which falls within the 45-day window.",
        status: "action",
      },
      {
        id: "brightloop",
        company: "Brightloop",
        tagline: "Marketing agency / Paid social",
        logoChar: "B",
        logoBg: "#3b2f63",
        website: "brightloop.agency",
        employees: 42,
        location: "Austin, United States",
        about:
          "Performance agency running paid social for DTC brands, with creative testing pods and weekly growth sprints.",
        keywords: "paid social, DTC, creative testing",
        evidence: [
          {
            label: "Evidence company fit",
            value:
              "Brightloop positions itself as a performance marketing agency for DTC brands with in-house creative pods.",
            url: "brightloop.agency/about",
          },
        ],
        funding: "$6m seed",
        contacts: [
          {
            name: "Dario Venn",
            title: "Founder",
            linkedin: "linkedin.com/in/dariovenn",
          },
        ],
        signal: {
          type: "Raised funding",
          detected: "Aug 09",
          source: "fundwire.co/…brightloop-seed",
          sourceUrl: "#",
          evidence:
            "Brightloop closes a $6M seed round to scale its creative testing platform for DTC advertisers, led by Homestead Ventures.",
        },
        verdict:
          "Brightloop is a paid-social marketing agency and announced a $6M seed on August 9, 2026, inside the 45-day window. Founder Dario Venn is the buying decision maker.",
        status: "sequenced",
        sequence: [
          {
            channel: "Email",
            day: 0,
            subject: "congrats on the seed, Dario",
            body: "Saw the Homestead round. When agencies scale creative testing pods, reporting sprawl usually follows. We help teams like Brightloop keep client reporting automated. Worth a look?",
          },
          {
            channel: "LinkedIn",
            day: 2,
            body: "Hey Dario, sent you a note over email about post-raise reporting sprawl. Would love your take.",
          },
          {
            channel: "Email",
            day: 5,
            subject: "one idea for the new pods",
            body: "One idea: wire each creative pod's spend data into a single weekly digest for clients. Happy to sketch how that would look for Brightloop.",
          },
        ],
      },
    ],
  },
  {
    id: "b2b-saas-raised-funding",
    name: "B2B SaaS · Raised funding",
    signalType: "Raised funding",
    createdAt: "2026-08-18",
    leads: [
      {
        id: "stackline",
        company: "Stackline HQ",
        tagline: "B2B SaaS / RevOps",
        logoChar: "S",
        logoBg: "#0f3d33",
        website: "stacklinehq.com",
        employees: 64,
        location: "Toronto, Canada",
        about:
          "Revenue operations platform unifying CRM hygiene, routing, and pipeline inspection for B2B sales teams.",
        keywords: "RevOps, CRM, pipeline",
        evidence: [
          {
            label: "Evidence company fit",
            value:
              "Stackline HQ sells a RevOps platform to B2B sales teams, matching the B2B SaaS ICP.",
            url: "stacklinehq.com",
          },
        ],
        funding: "$24m Series B",
        contacts: [
          {
            name: "Priya Nandal",
            title: "VP Revenue Operations",
            linkedin: "linkedin.com/in/priyanandal",
          },
        ],
        signal: {
          type: "Raised funding",
          detected: "Aug 20",
          source: "sequoianews.net/…stackline-series-b",
          sourceUrl: "#",
          evidence:
            "Stackline HQ announces a $24M Series B to expand its pipeline inspection suite into the enterprise segment.",
        },
        verdict:
          "Stackline HQ is a B2B SaaS company that raised a $24M Series B on August 20, 2026. Priya Nandal owns revenue tooling decisions.",
        status: "action",
      },
    ],
  },
  {
    id: "north-america-agentic-workflow",
    name: "North America Agentic Workflow B2B Hiring LLM Engineers",
    signalType: "Hiring for a role",
    createdAt: "2026-08-24",
    leads: [
      {
        id: "veltra",
        company: "Veltra Labs",
        tagline: "B2B SaaS / Agentic workflows",
        logoChar: "V",
        logoBg: "#432818",
        website: "veltralabs.ai",
        employees: 29,
        location: "New York, United States",
        about:
          "Agentic workflow builder that lets ops teams compose LLM agents into auditable business processes.",
        keywords: "agentic workflows, LLM, automation",
        evidence: [
          {
            label: "Evidence company fit",
            value:
              "Veltra Labs builds agentic workflow tooling for B2B ops teams in North America.",
            url: "veltralabs.ai",
          },
        ],
        contacts: [
          {
            name: "Jonah Reyes",
            title: "Head of Engineering",
            linkedin: "linkedin.com/in/jonahreyes",
          },
        ],
        signal: {
          type: "Hiring for a role",
          detected: "Aug 25",
          source: "jobs.veltralabs.ai/llm-engineer",
          sourceUrl: "#",
          evidence:
            "Veltra Labs posted three LLM Engineer openings in the last two weeks, citing rapid growth in agent workloads and evaluation infrastructure.",
        },
        verdict:
          "Veltra Labs is actively hiring LLM engineers in North America, indicating budget and urgency around agentic infrastructure. Jonah Reyes leads the hiring team.",
        status: "action",
      },
    ],
  },
];

export const CONNECTOR_CATEGORIES = [
  "All",
  "Connected",
  "Marketing",
  "Sales",
  "Product",
  "Productivity",
  "Analytics",
  "Social Media",
];

export type Connector = {
  name: string;
  desc: string;
  category: string;
  badge?: string;
  iconBg: string;
  iconFg: string;
  iconChar: string;
};

export const CONNECTORS: Connector[] = [
  { name: "Stripe", desc: "Accept payments and track revenue with your Stripe account.", category: "Sales", iconBg: "#635bff", iconFg: "#fff", iconChar: "S" },
  { name: "Superwall", desc: "Track mobile app revenue from Superwall and use it as your primary revenue source.", category: "Product", iconBg: "#111", iconFg: "#fff", iconChar: "s" },
  { name: "RevenueCat", desc: "Connect RevenueCat for subscription analytics and mobile purchase context.", category: "Analytics", iconBg: "#f2545b", iconFg: "#fff", iconChar: "RC" },
  { name: "GitHub", desc: "Connect your GitHub repo for code changes and deployments.", category: "Product", iconBg: "#171515", iconFg: "#fff", iconChar: "G" },
  { name: "TikTok", desc: "Give your agent access to post short form content.", category: "Social Media", iconBg: "#000", iconFg: "#fff", iconChar: "t" },
  { name: "LinkedIn Outbound", desc: "Give your agents access to Sales Navigator, InMail, and Direct Messaging over LinkedIn.", category: "Sales", iconBg: "#0a66c2", iconFg: "#fff", iconChar: "in" },
  { name: "Instagram Outbound", desc: "Give your agents the ability to send outbound messages over Instagram.", category: "Social Media", badge: "550 credits/mo", iconBg: "#e1306c", iconFg: "#fff", iconChar: "Ig" },
  { name: "HubSpot exclusions", desc: "Exclude people already in your CRM from campaign sourcing.", category: "Sales", iconBg: "#ff7a59", iconFg: "#fff", iconChar: "H" },
  { name: "Custom Domain", desc: "Use your own domain instead of the default URL.", category: "Marketing", iconBg: "#fff", iconFg: "#111", iconChar: "◉" },
  { name: "iMessage", desc: "Connect your iPhone so your strategist can text you with decisions, milestones, and critical alerts.", category: "Productivity", iconBg: "#34c759", iconFg: "#fff", iconChar: "❯" },
  { name: "Gmail", desc: "Connect Gmail to your agents", category: "Productivity", iconBg: "#fff", iconFg: "#ea4335", iconChar: "M" },
  { name: "Composio", desc: "Available to your agents without OAuth", category: "Productivity", iconBg: "#101828", iconFg: "#fff", iconChar: "C" },
  { name: "Google Calendar", desc: "Connect Google Calendar to your agents", category: "Productivity", iconBg: "#fff", iconFg: "#4285f4", iconChar: "31" },
  { name: "Notion", desc: "Connect Notion to your agents", category: "Productivity", iconBg: "#fff", iconFg: "#111", iconChar: "N" },
  { name: "Google Sheets", desc: "Connect Google Sheets to your agents", category: "Productivity", iconBg: "#0f9d58", iconFg: "#fff", iconChar: "▦" },
  { name: "Slack", desc: "Connect Slack to your agents", category: "Productivity", iconBg: "#fff", iconFg: "#611f69", iconChar: "#" },
  { name: "Supabase", desc: "Connect Supabase to your agents", category: "Product", iconBg: "#3ecf8e", iconFg: "#fff", iconChar: "⚡" },
  { name: "Outlook", desc: "Connect Outlook to your agents", category: "Productivity", iconBg: "#0078d4", iconFg: "#fff", iconChar: "O" },
  { name: "Perplexity AI", desc: "Connect Perplexity AI to your agents", category: "Product", iconBg: "#111", iconFg: "#fff", iconChar: "P" },
  { name: "Twitter", desc: "Connect Twitter to your agents", category: "Social Media", iconBg: "#000", iconFg: "#fff", iconChar: "X" },
  { name: "Google Drive", desc: "Connect Google Drive to your agents", category: "Productivity", iconBg: "#fff", iconFg: "#fbbc04", iconChar: "▲" },
  { name: "Google Docs", desc: "Connect Google Docs to your agents", category: "Productivity", iconBg: "#4285f4", iconFg: "#fff", iconChar: "≡" },
  { name: "HubSpot", desc: "Connect HubSpot to your agents", category: "Sales", iconBg: "#ff7a59", iconFg: "#fff", iconChar: "H" },
  { name: "Linear", desc: "Connect Linear to your agents", category: "Product", iconBg: "#5e6ad2", iconFg: "#fff", iconChar: "L" },
  { name: "Airtable", desc: "Connect Airtable to your agents", category: "Productivity", iconBg: "#fff", iconFg: "#fcb400", iconChar: "A" },
  { name: "SerpApi", desc: "Connect SerpApi to your agents", category: "Marketing", iconBg: "#0b6bcb", iconFg: "#fff", iconChar: "Se" },
  { name: "Jira", desc: "Connect Jira to your agents", category: "Product", iconBg: "#0052cc", iconFg: "#fff", iconChar: "J" },
  { name: "Firecrawl", desc: "Connect Firecrawl to your agents", category: "Product", iconBg: "#ff5722", iconFg: "#fff", iconChar: "🔥" },
  { name: "YouTube", desc: "Connect YouTube to your agents", category: "Social Media", iconBg: "#ff0000", iconFg: "#fff", iconChar: "▶" },
  { name: "Bitbucket", desc: "Connect Bitbucket to your agents", category: "Product", iconBg: "#0052cc", iconFg: "#fff", iconChar: "B" },
];

export const PLANS = [
  {
    name: "Starter",
    price: 59,
    blurb: "Great for individuals looking to start a business.",
    cta: "Get Starter",
    popular: false,
    creditTiers: [
      { credits: "4,200", price: 59 },
      { credits: "6,300", price: 89 },
      { credits: "9,100", price: 129 },
    ],
    features: [
      "Pay as you go",
      "Unlimited AI Intent Signals",
      "Multichannel sequences",
      "2 email warmups",
      "LinkedIn connection",
      "Fully enriched lead data",
    ],
  },
  {
    name: "Pro",
    price: 209,
    blurb: "Great for businesses that want to grow.",
    cta: "Get Pro",
    popular: true,
    creditTiers: [
      { credits: "14,700", price: 209 },
      { credits: "21,000", price: 299 },
      { credits: "28,000", price: 399 },
      { credits: "35,000", price: 499 },
    ],
    features: [
      "Pay as you go",
      "Unlimited AI Intent Signals",
      "Multichannel sequences",
      "10 email warmups",
      "LinkedIn connection",
      "Fully enriched lead data",
      "3rd party connectors",
    ],
  },
  {
    name: "Scale",
    price: 599,
    blurb: "Great for businesses that want to scale aggressively.",
    cta: "Get Scale",
    popular: false,
    creditTiers: [
      { credits: "42,000", price: 599 },
      { credits: "70,000", price: 999 },
      { credits: "105,000", price: 1499 },
      { credits: "140,000", price: 1999 },
    ],
    features: [
      "Pay as you go",
      "Unlimited AI Intent Signals",
      "Multichannel sequences",
      "Unlimited email warmups",
      "LinkedIn connection",
      "Fully enriched lead data",
      "3rd party connectors",
      "Dedicated Slack support",
    ],
  },
];

export const USER = {
  name: "Suraj",
  plan: "Free",
  credits: 268,
  email: "suraj@example.com",
  avatarBg: "#6d28d9",
};
