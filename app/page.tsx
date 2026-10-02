"use client"

import { useState } from "react"
import BrandDNA from "@/components/brand-dna"
import { getMockBrandData } from "@/lib/mock-brand-data"
import type { BrandData } from "@/lib/brand-types"

export default function Home() {
  const [data, setData] = useState<BrandData>(() => getMockBrandData("https://vercel.com"))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function analyze(input: string) {
    if (loading) return
    let url: URL
    try {
      url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`)
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) throw new Error("Invalid website")
    } catch {
      setError("Enter a website, like stripe.com.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/analyze-brand", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.href }),
      })
      if (!response.ok) throw new Error("Could not load brand")
      const brand: BrandData = await response.json()
      setData(brand)
      window.scrollTo({ top: 0, behavior: "instant" })
    } catch { setError("We couldn’t load that brand. Please try again.") }
    finally { setLoading(false) }
  }

  return <BrandDNA key={data.url} data={data} onAnalyze={analyze} loading={loading} error={error} />
}
