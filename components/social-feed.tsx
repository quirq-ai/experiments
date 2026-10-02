"use client"

import { useId, useState, type CSSProperties } from "react"
import {
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCircle2,
  CircleHelp,
  Globe2,
  Heart,
  ImageIcon,
  Send,
  Sparkles,
  ThumbsUp,
  WandSparkles,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { type BrandData, type Feedback, brandAccent, brandDomain, brandImages, brandName } from "@/lib/brand-types"
import "./social-feed.css"

type FeedFilter = "all" | "insights" | "visuals"
type FeedPost = NonNullable<BrandData["feed"]>[number]

interface SocialFeedProps {
  data: BrandData
  savedIds: string[]
  onToggleSave: (id: string) => void
  feedback: Record<string, Feedback>
  onFeedback: (id: string, value: Feedback) => void
  savedOnly?: boolean
  onOpenMedia: () => void
}

interface SourceDetail {
  title: string
  answer: string
  visual?: boolean
}

const feedbackOptions = [
  { value: "accurate", label: "Feels right", icon: ThumbsUp },
  { value: "needs-work", label: "Needs work", icon: WandSparkles },
  { value: "unsure", label: "Not sure", icon: CircleHelp },
] as const

function BrandAvatar({ data, size = "normal" }: { data: BrandData; size?: "normal" | "small" }) {
  return (
    <span className={`social-avatar social-avatar-${size}`}>
      {data.logo ? <img src={data.logo} alt={`${brandName(data)} logo`} /> : <Globe2 aria-hidden="true" size={18} strokeWidth={1.7} />}
    </span>
  )
}

function PostAuthor({ data, kind }: { data: BrandData; kind: string }) {
  return (
    <div className="social-author">
      <BrandAvatar data={data} />
      <div className="social-author-copy">
        <div className="social-author-name">{brandName(data)} <CheckCircle2 size={14} aria-label="Demo brand profile" className="social-author-check" /></div>
        <div className="social-author-subtitle">{kind}<span aria-hidden="true">·</span>Demo profile</div>
      </div>
    </div>
  )
}

export function SocialFeed({ data, savedIds, onToggleSave, feedback, onFeedback, savedOnly = false, onOpenMedia }: SocialFeedProps) {
  const [filter, setFilter] = useState<FeedFilter>("all")
  const [likedIds, setLikedIds] = useState<string[]>([])
  const [copyStatus, setCopyStatus] = useState<{ id: string; success: boolean } | null>(null)
  const [sourceDetail, setSourceDetail] = useState<SourceDetail | null>(null)
  const feedId = useId()
  const name = brandName(data)
  const domain = brandDomain(data)
  const images = brandImages(data)
  const posts = data.feed ?? []
  const displayedPosts = filter !== "visuals" ? posts.filter(post => !savedOnly || savedIds.includes(post.postId)) : []
  const showVisual = filter !== "insights" && (!savedOnly || savedIds.includes("visual-journal"))
  const isEmpty = !showVisual && displayedPosts.length === 0
  const style = { "--social-brand-accent": brandAccent(data) } as CSSProperties

  function toggleLike(id: string) {
    setLikedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  async function sharePost(id: string, title: string, content: string) {
    try {
      await navigator.clipboard.writeText(`${name}\n${title}\n\n${content}\n\n${data.url}`)
      setCopyStatus({ id, success: true })
    } catch {
      setCopyStatus({ id, success: false })
    }
  }

  function renderActions(id: string, title: string, content: string) {
    const liked = likedIds.includes(id)
    const saved = savedIds.includes(id)
    const copied = copyStatus?.id === id
    return (
      <div className="social-actions">
        <div className="social-actions-left">
          <button type="button" className={`social-icon-action ${liked ? "social-action-liked" : ""}`} aria-label={`${liked ? "Unlike" : "Like"} ${title}`} aria-pressed={liked} onClick={() => toggleLike(id)}>
            <Heart size={19} strokeWidth={1.65} fill={liked ? "currentColor" : "none"} /><span>{liked ? "Liked" : "Like"}</span>
          </button>
          <button type="button" className="social-icon-action" aria-label={`Copy ${title} to clipboard`} onClick={() => sharePost(id, title, content)}>
            {copied && copyStatus.success ? <Check size={19} strokeWidth={1.65} /> : <Send size={18} strokeWidth={1.65} />}<span>{copied ? copyStatus.success ? "Copied" : "Try again" : "Share"}</span>
          </button>
        </div>
        <button type="button" className={`social-icon-action social-save-action ${saved ? "social-action-saved" : ""}`} aria-label={`${saved ? "Unsave" : "Save"} ${title}`} aria-pressed={saved} onClick={() => onToggleSave(id)}>
          <Bookmark size={19} strokeWidth={1.65} fill={saved ? "currentColor" : "none"} /><span>{saved ? "Saved" : "Save"}</span>
        </button>
        {copied ? <span className="social-sr-only" role="status">{copyStatus.success ? "Post copied to clipboard." : "Clipboard unavailable. Please try again."}</span> : null}
      </div>
    )
  }

  function renderFeedback(post: FeedPost) {
    const chosen = feedback[post.postId]
    return (
      <div className="social-feedback">
        <span className="social-feedback-prompt">Does this feel like you?</span>
        <div className="social-feedback-options" aria-label={`Review: ${post.question}`}>
          {feedbackOptions.map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" className={`social-feedback-button ${chosen === value ? "social-feedback-selected" : ""}`} aria-pressed={chosen === value} onClick={() => onFeedback(post.postId, value)}>
              <Icon size={13} strokeWidth={1.7} /><span>{label}</span>
            </button>
          ))}
        </div>
        {chosen ? <span className="social-sr-only" role="status">Review marked as {feedbackOptions.find(option => option.value === chosen)?.label}.</span> : null}
      </div>
    )
  }

  return (
    <section className="social-feed" style={style} aria-label={savedOnly ? "Saved brand posts" : "Brand feed"}>
      <div className="social-feed-toolbar">
        <div className="social-filter-tabs" role="tablist" aria-label="Feed type" onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
          event.preventDefault()
          const filters: FeedFilter[] = ["all", "insights", "visuals"]
          const activeIndex = filters.indexOf(filter)
          const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? 2 : (activeIndex + (event.key === "ArrowRight" ? 1 : 2)) % 3
          setFilter(filters[nextIndex])
          event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[nextIndex]?.focus()
        }}>
          {([
            { value: "all", label: savedOnly ? "All saved" : "For you" },
            { value: "insights", label: "Insights" },
            { value: "visuals", label: "Visuals" },
          ] as const).map(tab => (
            <button key={tab.value} id={`${feedId}-${tab.value}`} type="button" role="tab" aria-controls={`${feedId}-panel`} aria-selected={filter === tab.value} tabIndex={filter === tab.value ? 0 : -1} className={`social-filter-tab ${filter === tab.value ? "social-filter-active" : ""}`} onClick={() => setFilter(tab.value)}>{tab.label}</button>
          ))}
        </div>
        <span className="social-feed-toolbar-note"><span className="social-live-dot" />{savedOnly ? `${savedIds.length} saved` : "Your brand, in focus"}</span>
      </div>

      <div className="social-post-list" id={`${feedId}-panel`} role="tabpanel" aria-labelledby={`${feedId}-${filter}`}>
        {isEmpty ? (
          <div className="social-empty">
            <span className="social-empty-icon"><Bookmark size={25} strokeWidth={1.4} /></span>
            <h3>{savedOnly ? "Keep what speaks to you." : "A little room for inspiration."}</h3>
            <p>{savedOnly ? "Save a post from your feed and it will be waiting here." : "No posts in this view yet. Explore your other feed tabs."}</p>
          </div>
        ) : null}

        {showVisual ? (
          <article className="social-post social-visual-post">
            <header className="social-post-header">
              <PostAuthor data={data} kind="Visual journal" />
              <button type="button" className="social-source-pill" onClick={() => setSourceDetail({ title: "The visual journal", answer: data.brandAesthetic || data.tagline, visual: true })}><ImageIcon size={12} />Concept references</button>
            </header>
            <button type="button" className="social-visual-art" onClick={onOpenMedia} aria-label={`Explore ${name}'s media collection`}>
              <img src={images[0]} alt={`Visual reference for ${name}`} className="social-visual-image" />
              <span className="social-visual-shade" />
              <span className="social-visual-top"><span>THE VISUAL JOURNAL</span><span className="social-visual-edition">01 / {String(images.length).padStart(2, "0")}</span></span>
              <span className="social-visual-title">{data.tagline}</span>
              <span className="social-visual-bottom"><span>{domain}<span className="social-visual-bottom-dot"> / </span>Visual identity</span><span className="social-image-open"><ArrowUpRight size={20} strokeWidth={1.5} /></span></span>
            </button>
            <div className="social-visual-caption"><span className="social-visual-caption-label">A LOOK INSIDE</span><p>{data.brandAesthetic || `Explore the colors, typography, and visual references behind ${name}.`}</p></div>
            {renderActions("visual-journal", "The visual journal", data.brandAesthetic || data.tagline)}
          </article>
        ) : null}

        {displayedPosts.map((post, index) => {
          const layout = index % 3 === 1 ? "editorial" : index % 3 === 2 ? "minimal" : "feature"
          return (
            <article className={`social-post social-insight-post social-post-${layout}`} key={post.postId}>
              <header className="social-post-header">
                <PostAuthor data={data} kind={layout === "editorial" ? "A closer look" : "Brand perspective"} />
                <button type="button" className="social-source-pill" onClick={() => setSourceDetail({ title: post.question, answer: post.answer })}><Sparkles size={12} />Demo insight</button>
              </header>
              <div className="social-insight-content">
                <div className="social-insight-text">
                  <div className="social-insight-eyebrow"><span className="social-insight-number">{String(posts.findIndex(item => item.postId === post.postId) + 1).padStart(2, "0")}</span><span>BRAND CONVERSATIONS</span></div>
                  <h3>{post.question}</h3>
                  <p className="social-insight-answer">{post.answer}</p>
                </div>
                {layout === "editorial" ? <button type="button" className="social-editorial-image" onClick={onOpenMedia} aria-label="Open the media collection"><img src={images[(index + 1) % images.length]} alt={`${name} visual reference`} loading="lazy" /><span className="social-editorial-image-arrow"><ArrowUpRight size={18} /></span></button> : null}
              </div>
              {renderFeedback(post)}
              {renderActions(post.postId, post.question, post.answer)}
            </article>
          )
        })}

        {!savedOnly && filter !== "insights" && !isEmpty ? (
          <button type="button" className="social-media-invitation" onClick={onOpenMedia}>
            <span className="social-media-invitation-icon"><ImageIcon size={20} strokeWidth={1.5} /></span><span className="social-media-invitation-copy"><strong>A world beyond the feed.</strong><span>Explore your brand&apos;s visual collection</span></span><span className="social-media-invitation-arrow"><ArrowUpRight size={21} strokeWidth={1.5} /></span>
          </button>
        ) : null}
      </div>

      <Dialog open={sourceDetail !== null} onOpenChange={open => { if (!open) setSourceDetail(null) }}>
        <DialogContent className="social-source-dialog">
          <span className="social-dialog-eyebrow"><Globe2 size={14} />{domain}</span>
          <DialogTitle className="social-dialog-title">{sourceDetail?.title}</DialogTitle>
          <DialogDescription className="social-dialog-description">{sourceDetail?.visual ? "The images in this prototype are concept references, paired with the current demo aesthetic. They are not verified assets collected from this website." : "This answer comes from the prototype’s demo profile. It has not been verified against the live website. Your review helps shape the brand profile."}</DialogDescription>
          <p className="social-dialog-answer">{sourceDetail?.answer}</p>
          <a className="social-dialog-source" href={data.url} target="_blank" rel="noopener noreferrer">Visit {domain}<ArrowUpRight size={16} /></a>
        </DialogContent>
      </Dialog>
    </section>
  )
}
