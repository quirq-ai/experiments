export interface BrandData {
  url: string
  name?: string
  logo?: string | null
  colors: Array<{ hex: string; name?: string }>
  fonts: Array<{ name: string; type: string }>
  tagline: string
  brandValues: string[]
  images: string[]
  businessOverview?: string
  brandAesthetic?: string
  brandToneOfVoice?: string
  brand_theme?: string
  industry?: string
  feed?: Array<{ postId: string; postType: "twitter" | "instagram"; question: string; answer: string }>
}

export type Feedback = "accurate" | "needs-work" | "unsure"

export function brandName(data: BrandData): string {
  if (data.name) return data.name.toLowerCase() === "quirq" ? "quirq" : data.name
  try {
    const domain = new URL(data.url).hostname.replace(/^www\./, "").split(".")[0]
    if (domain === "quirq") return "quirq"
    return domain.charAt(0).toUpperCase() + domain.slice(1)
  } catch { return "Your brand" }
}

export function brandDomain(data: BrandData): string {
  try { return new URL(data.url).hostname.replace(/^www\./, "") }
  catch { return data.url }
}

export function brandAccent(data: BrandData): string {
  return data.colors.find(c => !["#000000", "#ffffff", "#fafafa", "#f5f5f7", "#1c1c1c", "#949494"].includes(c.hex.toLowerCase()))?.hex || "#a8c4eb"
}

export function brandImages(data: BrandData): string[] {
  if (data.images.length && data.images.every(image => !image.includes("images.unsplash.com"))) return data.images
  const domain = brandDomain(data)
  if (domain.includes("apple")) return ["/silver-macbook-on-desk.png", "/iphone-product.jpg", "/minimal-design.png", "/premium-tech.jpg", "/mobile-app-mockup.png", "/technology-innovation.jpg"]
  if (domain.includes("stripe")) return ["/global-payments.jpg", "/financial-dashboard.png", "/credit-card-terminal.jpg", "/payment-processing.png", "/commerce-platform.jpg", "/business-analytics-concept.png"]
  if (domain.includes("github")) return ["/code-collaboration.png", "/code-editor-dark-theme.png", "/open-source.jpg", "/team-collaboration.png", "/git-repository.jpg", "/pull-request.jpg"]
  if (domain.includes("vercel")) return ["/web-development-concept.png", "/deployment-pipeline.jpg", "/sleek-interface.jpg", "/cloud-infrastructure.png", "/developer-workflow.jpg", "/modern-website.png"]
  return ["/technology-innovation.jpg", "/tech-abstract.jpg", "/premium-tech.jpg", "/dashboard-analytics.png", "/minimal-design.png", "/team-collaboration.png"]
}
