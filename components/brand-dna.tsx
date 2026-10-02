"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronRight, Compass, ExternalLink, Film, Globe2, Grid2X2, Layers3, Loader2, Search, Sparkles, SwatchBook, Volume2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { BrandMedia } from "@/components/brand-media"
import { SocialFeed } from "@/components/social-feed"
import { brandAccent, brandDomain, brandImages, brandName, type BrandData, type Feedback } from "@/lib/brand-types"

type View = "feed" | "media" | "about" | "saved"
interface Props { data: BrandData; onAnalyze: (url: string) => Promise<void>; loading: boolean; error: string }
const NAV = [{ id: "feed", label: "The feed", icon: Compass }, { id: "media", label: "Media library", icon: Film }, { id: "about", label: "Brand profile", icon: Layers3 }, { id: "saved", label: "Saved", icon: Bookmark }] as const
const EXAMPLES = [{ domain: "vercel.com", name: "Vercel", note: "For the builders", color: "#a4b9ee" }, { domain: "stripe.com", name: "Stripe", note: "A world of possibility", color: "#b1a0ff" }, { domain: "github.com", name: "GitHub", note: "Better, together", color: "#b4d2ac" }, { domain: "apple.com", name: "Apple", note: "Designed to inspire", color: "#e0c4bb" }]

export default function BrandDNA({ data, onAnalyze, loading, error }: Props) {
  const [view, setView] = useState<View>("feed")
  const [query, setQuery] = useState("")
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({})
  const [story, setStory] = useState<number | null>(null)
  const [toast, setToast] = useState("")
  const name = brandName(data)
  const domain = brandDomain(data)
  const images = brandImages(data)
  const stories = [
    { title: "The story", icon: Globe2, eyebrow: "01 / THE BIG PICTURE", headline: "A purpose. A point of view.", text: data.businessOverview || data.tagline },
    { title: "The aesthetic", icon: SwatchBook, eyebrow: "02 / THE VISUAL LANGUAGE", headline: "You know it when you see it.", text: data.brandAesthetic || "Explore the colors and typography that shape this brand." },
    { title: "The voice", icon: Volume2, eyebrow: "03 / THE WAY IT SOUNDS", headline: "Every word has a feeling.", text: data.brandToneOfVoice || data.tagline },
    { title: "The values", icon: Sparkles, eyebrow: "04 / WHAT IT STANDS FOR", headline: "The ideas at the heart of it.", text: data.brandValues.join(". ") + "." },
  ]

  function toggleSave(id: string) { setSavedIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]) }
  async function copyColor(hex: string) {
    try { await navigator.clipboard.writeText(hex); setToast(`${hex} copied to clipboard`) }
    catch { setToast(`Color: ${hex}`) }
  }
  function navigate(next: View) { setView(next); window.scrollTo({ top: 0, behavior: "instant" }) }
  const currentStory = story === null ? null : stories[story]

  return (
    <div className="dna-app">
      <header className="dna-header">
        <button className="dna-wordmark" onClick={() => navigate("feed")} aria-label="Brand DNA home">brand<span>dna</span><span className="dna-wordmark-dot" aria-hidden /> </button>
        <form className="dna-search" onSubmit={event => { event.preventDefault(); if (query.trim()) void onAnalyze(query) }}>
          <Search size={17} aria-hidden />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Explore a website…" aria-label="Website to explore" disabled={loading} />
          <button type="submit" aria-label="Explore website" disabled={loading || !query.trim()}>{loading ? <Loader2 size={16} className="dna-spin" /> : <ArrowRight size={16} />}</button>
        </form>
        <div className="dna-header-meta"><span className="dna-live-dot" />Demo workspace <span className="dna-header-divider" /><span className="dna-header-avatar"><Globe2 size={17} /></span></div>
      </header>
      {error && <div className="dna-error" role="alert">{error}</div>}
      {loading && <div className="dna-loading" role="status"><Loader2 size={15} className="dna-spin" />Opening a new brand world…</div>}
      <div className={`dna-layout ${view === "media" ? "dna-layout--cinema" : ""}`}>
        <aside className="dna-sidebar">
          <div className="dna-sidebar-brand"><BrandAvatar data={data} /><div><strong>{name}</strong><span>{domain}</span></div><span className="dna-brand-status"><Check size={11} /></span></div>
          <p className="dna-nav-label">YOUR BRAND WORLD</p>
          <nav aria-label="Main navigation">{NAV.map(({ id, label, icon: Icon }) => <button key={id} className={`dna-nav-item ${view === id ? "is-active" : ""}`} onClick={() => navigate(id)} aria-current={view === id ? "page" : undefined}><Icon size={20} strokeWidth={1.6} /><span>{label}</span>{id === "saved" && savedIds.length > 0 ? <span className="dna-nav-count">{savedIds.length}</span> : view === id ? <span className="dna-nav-dot" /> : null}</button>)}</nav>
          <div className="dna-sidebar-divider" />
          <p className="dna-nav-label">WORLDS TO EXPLORE</p>
          <div className="dna-worlds">{EXAMPLES.filter(item => item.domain !== domain).slice(0, 3).map(item => <button key={item.domain} className="dna-world" onClick={() => void onAnalyze(item.domain)} disabled={loading}><span className="dna-world-avatar" style={{ backgroundColor: item.color }}><Globe2 size={17} /></span><span><strong>{item.name}</strong><small>{item.note}</small></span><ChevronRight size={14} /></button>)}</div>
          <div className="dna-sidebar-note"><span className="dna-mini-label">A LITTLE CURIOSITY GOES A LONG WAY</span><p>Behind every brand,<br />there’s a whole world.</p><button onClick={() => navigate("about")}>Take a closer look <ArrowRight size={14} /></button></div>
          <div className="dna-sidebar-footer">Made for a different point of view.<br /><span>Brand DNA · Demo edition</span></div>
        </aside>

        <main id="content" className={`dna-main ${view === "media" ? "dna-main--media" : ""}`}>
          {view === "media" ? <BrandMedia data={data} /> : view === "about" ? <BrandProfile data={data} onCopyColor={copyColor} onOpenMedia={() => navigate("media")} /> : <>
            <div className="dna-page-heading"><div><p className="dna-eyebrow">{view === "saved" ? "YOUR PERSONAL COLLECTION" : "THE BRAND JOURNAL"}</p><h1>{view === "saved" ? "Worth keeping." : "A brand. A whole world."}</h1></div><span className="dna-page-tag"><span />{view === "saved" ? `${savedIds.length} saved` : "A fresh perspective"}</span></div>
            {view === "feed" && <>
              <section className="dna-cover" aria-label={`${name} brand introduction`}>
                <img src="/brand-cover.jpg" alt="Abstract flowing glass sculpture with peach light" className="dna-cover-art" />
                <div className="dna-cover-shade" /><div className="dna-cover-content"><span className="dna-cover-kicker"><span />IN FOCUS</span><h2>The world<br />of <em>{name}.</em></h2><p>{data.tagline}</p><button onClick={() => navigate("about")}>Meet the brand <ArrowRight size={15} /></button></div>
                <span className="dna-cover-index">01 — BRAND SPOTLIGHT</span>
              </section>
              <div className="dna-profile-strip"><BrandAvatar data={data} /><div><strong>{name} <span className="dna-verified"><Check size={10} /></span></strong><span>@{domain.split(".")[0]} · {data.industry?.split(",")[0] || "A brand worth exploring"}</span></div><a href={data.url} target="_blank" rel="noreferrer">Visit website <ExternalLink size={13} /></a></div>
              <section className="dna-stories" aria-label="Brand highlights">{stories.map(({ title, icon: Icon }, index) => <button className="dna-story" key={title} onClick={() => setStory(index)}><span className={`dna-story-ring dna-story-ring--${index}`}><span className="dna-story-image"><img src={images[index]} alt="" /><Icon size={23} /></span></span><span>{title}</span></button>)}<button className="dna-story dna-story--library" onClick={() => navigate("media")}><span className="dna-story-ring"><span className="dna-story-image"><Grid2X2 size={24} /></span></span><span>Visual world</span></button></section>
            </>}
            <SocialFeed data={data} savedIds={savedIds} onToggleSave={toggleSave} feedback={feedback} onFeedback={(id, value) => setFeedback(previous => ({ ...previous, [id]: value }))} savedOnly={view === "saved"} onOpenMedia={() => navigate("media")} />
          </>}
        </main>

        {view !== "media" && <aside className="dna-right-rail">
          <section className="dna-essentials"><div className="dna-rail-heading"><h2>Brand essentials</h2><SwatchBook size={16} /></div><p>The details that make it feel like {name}.</p><div className="dna-palette">{data.colors.slice(0, 5).map(color => <button key={color.hex} onClick={() => void copyColor(color.hex)} aria-label={`Copy ${color.name || "color"} ${color.hex}`} title={color.hex} style={{ backgroundColor: color.hex }} />)}</div><div className="dna-palette-caption"><span>The signature palette</span><span>↗</span></div><div className="dna-rail-divider" /><div className="dna-font-label">THE TYPE</div>{data.fonts.slice(0, 2).map((font) => <div className="dna-font" key={`${font.type}-${font.name}`}><span className="dna-font-sample" style={{ fontFamily: `${font.name}, sans-serif` }}>Aa</span><div><strong>{font.name}</strong><small>{font.type} typeface</small></div></div>)}<button className="dna-rail-link" onClick={() => navigate("about")}>Explore the identity <ArrowRight size={14} /></button></section>
          <section className="dna-voice"><span className="dna-quote-mark">“</span><span className="dna-mini-label">THE WAY IT SOUNDS</span><h2>A voice of<br />its own.</h2><p>{data.brandToneOfVoice}</p><div className="dna-tags">{data.brandValues.slice(0, 3).map(value => <span key={value}>{value}</span>)}</div></section>
          <section className="dna-rail-media"><div><span className="dna-mini-label">THERE’S MORE TO SEE</span><h2>Enter the<br />visual world.</h2><button onClick={() => navigate("media")}>Explore media <ArrowRight size={14} /></button></div><img src={images[2]} alt="Brand visual reference" /></section>
          <div className="dna-rail-footer">A space for discovery, not assumptions.<br /><span>Profiles shown here are curated demos.</span></div>
        </aside>}
      </div>

      <nav className="dna-mobile-nav" aria-label="Mobile navigation">{NAV.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "is-active" : ""} onClick={() => navigate(id)} aria-current={view === id ? "page" : undefined}><Icon size={20} /><span>{label === "The feed" ? "Feed" : label === "Media library" ? "Media" : label === "Brand profile" ? "Profile" : label}</span></button>)}</nav>
      {toast && <div className="dna-toast" role="status"><Check size={15} />{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}>×</button></div>}

      <Dialog open={story !== null} onOpenChange={open => { if (!open) setStory(null) }}><DialogContent className="dna-story-dialog" onKeyDown={event => { if (event.key === "ArrowRight" && story !== null) setStory((story + 1) % stories.length); if (event.key === "ArrowLeft" && story !== null) setStory((story - 1 + stories.length) % stories.length) }}>
        {currentStory && <><div className="dna-story-progress">{stories.map((item, index) => <button key={item.title} aria-label={`Read ${item.title}`} className={index === story ? "is-active" : ""} onClick={() => setStory(index)} />)}</div><div className="dna-story-dialog-brand"><BrandAvatar data={data} /><span>{name}</span><small>Brand highlights</small></div><div className="dna-story-dialog-art" style={{ backgroundImage: `url(${images[story ?? 0]})` }} /><div className="dna-story-dialog-copy"><span className="dna-mini-label">{currentStory.eyebrow}</span><DialogTitle>{currentStory.headline}</DialogTitle><DialogDescription>{currentStory.text}</DialogDescription>{story === 1 && <div className="dna-story-colors">{data.colors.map(color => <span key={color.hex} style={{ backgroundColor: color.hex }} title={color.hex} />)}</div>}{story === 3 && <div className="dna-tags">{data.brandValues.map(value => <span key={value}>{value}</span>)}</div>}</div><div className="dna-story-dialog-footer"><button onClick={() => setStory(((story ?? 0) - 1 + stories.length) % stories.length)} aria-label="Previous highlight"><ArrowLeft size={19} /></button><span>{(story ?? 0) + 1} / {stories.length}</span><button onClick={() => setStory(((story ?? 0) + 1) % stories.length)} aria-label="Next highlight"><ArrowRight size={19} /></button></div></>}
      </DialogContent></Dialog>
    </div>
  )
}

function BrandAvatar({ data }: { data: BrandData }) {
  return <span className="dna-avatar" style={{ color: brandAccent(data) }}>{data.logo ? <img src={data.logo} alt={`${brandName(data)} approved logo`} /> : <Globe2 size={23} strokeWidth={1.5} aria-hidden />}</span>
}

function BrandProfile({ data, onCopyColor, onOpenMedia }: { data: BrandData; onCopyColor: (hex: string) => Promise<void>; onOpenMedia: () => void }) {
  return <div className="dna-about"><div className="dna-page-heading"><div><p className="dna-eyebrow">THE IDENTITY, UP CLOSE</p><h1>Get to know {brandName(data)}.</h1></div></div><div className="dna-about-intro"><BrandAvatar data={data} /><span className="dna-mini-label">THE BIG IDEA</span><h2>{data.tagline}</h2><p>{data.businessOverview}</p><a href={data.url} target="_blank" rel="noreferrer">{brandDomain(data)} <ExternalLink size={14} /></a></div><div className="dna-about-section"><span className="dna-mini-label">01 / VISUAL IDENTITY</span><h2>Color, with character.</h2><p>{data.brandAesthetic}</p><div className="dna-about-palette">{data.colors.map(color => <button key={color.hex} onClick={() => void onCopyColor(color.hex)} aria-label={`Copy ${color.hex}`}><span style={{ backgroundColor: color.hex }} /><strong>{color.name || "Signature color"}</strong><small>{color.hex}</small></button>)}</div></div><div className="dna-about-section"><span className="dna-mini-label">02 / TYPOGRAPHY</span><h2>Letters set the tone.</h2><div className="dna-about-fonts">{data.fonts.map(font => <div key={`${font.type}-${font.name}`}><span className="dna-font-label">{font.type}</span><span className="dna-about-font-preview" style={{ fontFamily: `${font.name}, sans-serif` }}>Aa Bb Cc</span><strong>{font.name}</strong></div>)}</div></div><div className="dna-about-section"><span className="dna-mini-label">03 / PERSONALITY</span><h2>A voice. A set of values.</h2><p>{data.brandToneOfVoice}</p><div className="dna-tags">{data.brandValues.map(value => <span key={value}>{value}</span>)}</div></div><button className="dna-about-media" onClick={onOpenMedia}><Film size={24} /><span>See the identity come to life<small>Explore the media library</small></span><ArrowRight size={22} /></button></div>
}
