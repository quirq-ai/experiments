import { getMockBrandData } from "@/lib/mock-brand-data"
import { z } from "zod"

const brandSchema = z.object({
  colors: z.array(
    z.object({
      hex: z.string(),
      name: z.string().optional(),
    }),
  ),
  fonts: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["heading", "body", "accent"]),
    }),
  ),
  tagline: z.string(),
  brandValues: z.array(z.string()),
  logo: z.string().optional(),
  images: z.array(z.string()),
})

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url) {
      return Response.json({ error: "URL is required" }, { status: 400 })
    }

    // Normalize URL
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`

    // Simulate API delay for realistic feel
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Get mock brand data
    const brandData = getMockBrandData(normalizedUrl)

    return Response.json(brandData)
  } catch (error) {
    console.error("Error analyzing brand:", error)
    return Response.json({ error: "Failed to analyze brand" }, { status: 500 })
  }
}
