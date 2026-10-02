"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, Bookmark, Check, ChevronLeft, ChevronRight, Expand, Layers, X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { type BrandData, brandAccent, brandDomain, brandImages, brandName } from "@/lib/brand-types"
import "./brand-media.css"

type Category = "imagery" | "product" | "inspiration"
type Filter = "all" | Category
type MediaItem = { src: string; index: number; title: string; category: Category }
type MediaView = { kind: "collection" } | { kind: "image"; index: number } | null

const CATEGORIES: Category[] = ["imagery", "product", "inspiration"]
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "imagery", label: "Imagery" },
  { value: "product", label: "Product" },
  { value: "inspiration", label: "Inspiration" },
]
const CATEGORY_LABELS: Record<Category, string> = { imagery: "Brand imagery", product: "Product world", inspiration: "Visual inspiration" }

function imageTitle(src: string) {
  return src.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/-/g, " ").replace(/^./, c => c.toUpperCase()) || "Visual reference"
}

function MediaShelf({ title, subtitle, items, onSelect, ranked = false }: {
  title: string
  subtitle: string
  items: MediaItem[]
  onSelect: (index: number) => void
  ranked?: boolean
}) {
  const rail = useRef<HTMLDivElement>(null)

  function move(direction: number) {
    if (rail.current) rail.current.scrollBy({ left: direction * rail.current.clientWidth * 0.8, behavior: "smooth" })
  }

  return (
    <section className="media-shelf" aria-label={title}>
      <div className="media-shelf-heading">
        <div><h3>{title}</h3><p>{subtitle}</p></div>
        <div className="media-rail-controls">
          <button className="media-icon-button" type="button" aria-label={`Scroll ${title} left`} onClick={() => move(-1)}><ChevronLeft size={17} /></button>
          <button className="media-icon-button" type="button" aria-label={`Scroll ${title} right`} onClick={() => move(1)}><ChevronRight size={17} /></button>
        </div>
      </div>
      <div ref={rail} className={`media-rail${ranked ? " media-rail-ranked" : ""}`}>
        {items.map((item, position) => (
          <button key={item.src} className={`media-card${ranked ? " media-card-ranked" : ""}`} type="button" onClick={() => onSelect(item.index)} aria-label={`Open ${item.title}`}>
            {ranked ? <span className="media-rank" aria-hidden="true">{String(position + 1).padStart(2, "0")}</span> : null}
            <div className="media-card-art">
              <img src={item.src} alt={item.title} loading="lazy" />
              <span className="media-card-category">{CATEGORY_LABELS[item.category]}</span>
              <span className="media-card-expand" aria-hidden="true"><Expand size={18} /></span>
              <div className="media-card-gradient" />
              <span className="media-card-title">{item.title}</span>
            </div>
            <span className="media-card-caption"><span>Visual reference</span><span>View <ArrowRight size={13} /></span></span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function BrandMedia({ data }: { data: BrandData }) {
  const name = brandName(data)
  const domain = brandDomain(data)
  const images = brandImages(data)
  const items: MediaItem[] = images.map((src, index) => ({ src, index, title: imageTitle(src), category: CATEGORIES[index % CATEGORIES.length] }))
  const [filter, setFilter] = useState<Filter>("all")
  const [view, setView] = useState<MediaView>(null)
  const [saved, setSaved] = useState(false)
  const savedKey = `brand-dna:media-saved:${domain}`
  const filteredItems = filter === "all" ? items : items.filter(item => item.category === filter)
  const selected = view?.kind === "image" ? items[view.index] : undefined
  const style = { "--media-brand-accent": brandAccent(data) } as CSSProperties

  useEffect(() => {
    try { setSaved(localStorage.getItem(savedKey) === "true") } catch { setSaved(false) }
  }, [savedKey])

  function toggleSaved() {
    const next = !saved
    setSaved(next)
    try { localStorage.setItem(savedKey, String(next)) } catch { /* The saved state remains available for this visit. */ }
  }

  function stepImage(direction: number) {
    setView(current => current?.kind === "image" ? { kind: "image", index: (current.index + direction + items.length) % items.length } : current)
  }

  return (
    <div className="media-world" style={style}>
      <div className="media-page-heading">
        <div><span className="media-eyebrow">THE BRAND, IN PICTURES</span><h2>Visual world<span>.</span></h2></div>
        <div className="media-library-count"><Layers size={15} /><span>{images.length} visual references</span></div>
      </div>

      <section className="media-hero" aria-label={`${name} featured visual collection`}>
        <img className="media-hero-image" src="/brand-cover.jpg" alt="" />
        <div className="media-hero-shade" />
        <div className="media-hero-content">
          <span className="media-featured-label"><span />FEATURED COLLECTION</span>
          <h3>Every frame.<br /><span>A feeling.</span></h3>
          <p>A closer look at {name}&apos;s visual world.<br className="media-desktop-break" /> The details that make a brand feel like itself.</p>
          <div className="media-hero-actions">
            <button className="media-primary-button" type="button" onClick={() => setView({ kind: "collection" })}><Layers size={17} />View collection<ArrowRight size={17} /></button>
            <button className="media-secondary-button" type="button" onClick={toggleSaved} aria-pressed={saved}>{saved ? <Check size={17} /> : <Bookmark size={17} />}{saved ? "Saved" : "Save collection"}</button>
          </div>
          <div className="media-hero-meta"><span>{images.length} images</span><span className="media-meta-dot" /><span>Curated references</span><span className="media-meta-dot" /><span>{domain}</span></div>
        </div>
        <button className="media-hero-preview" type="button" onClick={() => setView({ kind: "image", index: 0 })} aria-label="Open featured visual reference">
          <span>01 / {String(images.length).padStart(2, "0")}</span><Expand size={15} />
        </button>
        <div className="media-hero-footer"><span>THE {name.toLowerCase()} COLLECTION</span><ArrowDown size={15} /></div>
      </section>

      <div className="media-browse-bar">
        <div className="media-filters" role="group" aria-label="Filter visual references">
          {FILTERS.map(item => <button key={item.value} type="button" className={`media-filter${filter === item.value ? " media-filter-active" : ""}`} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}
        </div>
        <span className="media-browse-note">A little inspiration goes a long way.</span>
      </div>

      <MediaShelf title={filter === "all" ? "The visual language" : CATEGORY_LABELS[filter]} subtitle={filter === "all" ? "A collection of moments, moods, and details." : `${filteredItems.length} references to explore in full detail.`} items={filteredItems} onSelect={index => setView({ kind: "image", index })} />

      {filter === "all" ? <MediaShelf title="Look a little closer" subtitle="The product, the process, the possibilities." items={[...items.slice(2), ...items.slice(0, 2)]} onSelect={index => setView({ kind: "image", index })} ranked /> : null}

      <section className="media-collection-banner">
        <div className="media-collection-collage" aria-hidden="true">{images.slice(0, 3).map((src, index) => <img key={src} src={src} alt="" loading="lazy" style={{ "--media-stack-index": index } as CSSProperties} />)}</div>
        <div className="media-collection-copy"><span className="media-eyebrow">KEEP THE INSPIRATION CLOSE</span><h3>Your next idea starts here.</h3><p>One collection. A whole world of possibilities.</p></div>
        <button className="media-secondary-button" type="button" onClick={toggleSaved} aria-pressed={saved}>{saved ? <Check size={17} /> : <Bookmark size={17} />}{saved ? "In your collection" : "Save collection"}</button>
      </section>

      <p className="media-save-status" role="status">{saved ? `${name}'s visual collection is saved in this browser.` : ""}</p>

      <Dialog open={view !== null} onOpenChange={open => { if (!open) setView(null) }}>
        <DialogContent className="media-dialog" showCloseButton={false} onKeyDown={event => {
          if (view?.kind !== "image") return
          if (event.key === "ArrowLeft") { event.preventDefault(); stepImage(-1) }
          if (event.key === "ArrowRight") { event.preventDefault(); stepImage(1) }
        }}>
          <div className="media-dialog-header">
            <div><span className="media-eyebrow">{name} / VISUAL WORLD</span><DialogTitle className="media-dialog-title">{selected ? selected.title : `${name}: the visual collection`}</DialogTitle><DialogDescription className="media-dialog-description">{selected ? `${CATEGORY_LABELS[selected.category]} · Reference ${selected.index + 1} of ${items.length}. Use the arrow keys to browse.` : "Curated visual references for exploring the brand's look and feel."}</DialogDescription></div>
            <DialogClose asChild><button type="button" className="media-icon-button media-close-button" aria-label="Close visual collection"><X size={19} /></button></DialogClose>
          </div>
          {selected ? <>
            <div className="media-lightbox-stage">
              <img src={selected.src} alt={selected.title} />
              <button type="button" className="media-lightbox-arrow media-lightbox-previous" aria-label="Previous image" onClick={() => stepImage(-1)}><ChevronLeft size={22} /></button>
              <button type="button" className="media-lightbox-arrow media-lightbox-next" aria-label="Next image" onClick={() => stepImage(1)}><ChevronRight size={22} /></button>
            </div>
            <div className="media-lightbox-footer"><button type="button" className="media-text-button" onClick={() => setView({ kind: "collection" })}><ArrowLeft size={15} />All references</button><span>{String(selected.index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span><button type="button" className="media-text-button" onClick={toggleSaved}>{saved ? <Check size={15} /> : <Bookmark size={15} />}{saved ? "Collection saved" : "Save collection"}</button></div>
          </> : <>
            <div className="media-dialog-collection">{items.map(item => <button key={item.src} type="button" className="media-dialog-tile" onClick={() => setView({ kind: "image", index: item.index })}><img src={item.src} alt={item.title} loading="lazy" /><span>{item.title}<Expand size={14} /></span></button>)}</div>
            <div className="media-lightbox-footer"><span>{items.length} curated references</span><button type="button" className="media-text-button" onClick={toggleSaved}>{saved ? <Check size={15} /> : <Bookmark size={15} />}{saved ? "Collection saved" : "Save collection"}</button></div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
