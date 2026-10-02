import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "Brand DNA · A whole world behind every brand",
  description: "Explore the colors, stories, voice, and visual world of a brand.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`dark ${geist.variable} ${mono.variable}`}><body className={geist.className}>{children}</body></html>
}
