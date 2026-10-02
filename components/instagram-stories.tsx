"use client"

import type React from "react"

import { useState } from "react"
import { Play, X } from "lucide-react"

interface StoryItem {
  type: "image" | "component"
  url?: string
  component?: React.ReactNode
}

interface InstagramStoriesProps {
  brandData: {
    url: string
    images: string[]
    tagline: string
    logo?: string
    colors?: Array<{ hex: string; name?: string }>
    brandValues?: string[]
    businessOverview?: string
    brandAesthetic?: string
    brandToneOfVoice?: string
    brand_theme?: string
    industry?: string
  }
}

const getBrandName = (url: string) => {
  const domain = url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
  return domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1)
}

export function InstagramStories({ brandData }: InstagramStoriesProps) {
  const [selectedStory, setSelectedStory] = useState<number | null>(null)
  const [currentItem, setCurrentItem] = useState(0)
  const [viewedStories, setViewedStories] = useState<Set<number>>(new Set())

  const bgColor = brandData.colors?.[0]?.hex || "#1a1a1a"
  const accentColor = brandData.colors?.[2]?.hex || "#66bb6a"
  const textColor = brandData.colors?.[1]?.hex || "#ffffff"
  const secondaryTextColor = brandData.colors?.[3]?.hex || "#d4d4d8"

  const industryWords = brandData.industry?.split(",").map((word) => word.trim()) || []

  const stories = [
    {
      id: 0,
      name: "Business",
      thumbnail: brandData.images[0] || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80",
      items: [
        {
          type: "component" as const,
          component: (
            <div className="h-full p-8 flex flex-col justify-center" style={{ backgroundColor: bgColor }}>
              <div className="space-y-6">
                <h2 className="text-3xl font-bold mb-4" style={{ color: accentColor }}>
                  Business Overview
                </h2>
                <p className="text-lg leading-relaxed text-balance" style={{ color: textColor }}>
                  {brandData.businessOverview ||
                    "An innovative platform focused on delivering exceptional value through cutting-edge solutions."}
                </p>
              </div>
            </div>
          ),
        },
        {
          type: "component" as const,
          component: (
            <div className="h-full p-8 flex flex-col justify-center" style={{ backgroundColor: bgColor }}>
              <div className="space-y-6">
                <h2 className="text-3xl font-bold mb-4" style={{ color: accentColor }}>
                  Brand Tone & Voice
                </h2>
                <p className="text-lg leading-relaxed text-balance" style={{ color: textColor }}>
                  {brandData.brandToneOfVoice || "Professional, clear, and approachable communication."}
                </p>
              </div>
            </div>
          ),
        },
        {
          type: "component" as const,
          component: (
            <div
              className="h-full p-8 flex flex-col items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${bgColor} 0%, ${brandData.colors?.[3]?.hex || "#2a2a2a"} 100%)`,
              }}
            >
              <h2 className="text-2xl font-bold mb-8" style={{ color: accentColor }}>
                Industry
              </h2>
              <div className="flex flex-wrap gap-4 items-center justify-center max-w-md">
                {industryWords.map((word, idx) => {
                  const sizes = ["text-3xl", "text-4xl", "text-2xl", "text-5xl", "text-3xl", "text-2xl"]
                  const rotations = [
                    "rotate-[-8deg]",
                    "rotate-[5deg]",
                    "rotate-[-3deg]",
                    "rotate-[7deg]",
                    "rotate-[-5deg]",
                    "rotate-[3deg]",
                  ]
                  const colors = brandData.colors || []

                  return (
                    <span
                      key={idx}
                      className={`font-bold ${sizes[idx % sizes.length]} ${rotations[idx % rotations.length]} transition-transform hover:scale-110`}
                      style={{ color: colors[idx % colors.length]?.hex || textColor }}
                    >
                      {word}
                    </span>
                  )
                })}
              </div>
            </div>
          ),
        },
      ],
    },
    {
      id: 1,
      name: "Colors & Aesthetics",
      thumbnail: brandData.images[1] || "https://images.unsplash.com/photo-1557683316-973673baf926?w=400&q=80",
      items: [
        {
          type: "component" as const,
          component: (
            <div className="h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-black p-8 flex flex-col justify-between">
              <div className="space-y-6">
                <h2 className="text-3xl font-bold mb-4" style={{ color: accentColor }}>
                  Brand Colors
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {brandData.colors?.slice(0, 4).map((color, idx) => (
                    <div key={idx} className="space-y-3">
                      <div
                        className="h-24 rounded-xl border-2 border-white/20 shadow-xl"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div className="text-center">
                        <p className="text-sm" style={{ color: textColor }}>
                          {color.name || "Color"}
                        </p>
                        <p className="text-xs font-mono" style={{ color: secondaryTextColor }}>
                          {color.hex}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-neutral-800">
                <h3 className="text-sm mb-2 uppercase tracking-wider" style={{ color: accentColor }}>
                  Aesthetic
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: textColor }}>
                  {brandData.brandAesthetic || "Modern, clean design with attention to detail."}
                </p>
              </div>
            </div>
          ),
        },
        {
          type: "component" as const,
          component: (
            <div className="h-full p-8 flex flex-col justify-center" style={{ backgroundColor: bgColor }}>
              <div className="space-y-6">
                <h2 className="text-3xl font-bold mb-4" style={{ color: accentColor }}>
                  Brand Theme
                </h2>
                <p className="text-lg leading-relaxed text-balance" style={{ color: textColor }}>
                  {brandData.brand_theme || "Modern, professional"}
                </p>
              </div>
            </div>
          ),
        },
      ],
    },
    {
      id: 2,
      name: "Tones & Values",
      thumbnail: brandData.images[2] || "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80",
      items: [
        {
          type: "component" as const,
          component: (
            <div className="h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-black p-8 flex flex-col justify-center">
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold mb-4" style={{ color: accentColor }}>
                    Brand Values
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {brandData.brandValues?.map((value, idx) => (
                      <span
                        key={idx}
                        className="px-4 py-2 rounded-full text-sm border"
                        style={{
                          backgroundColor: `${accentColor}20`,
                          borderColor: `${accentColor}30`,
                          color: accentColor,
                        }}
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-8 border-t border-neutral-800">
                  <h3 className="text-sm mb-3 uppercase tracking-wider" style={{ color: accentColor }}>
                    Tone of Voice
                  </h3>
                  <p className="leading-relaxed" style={{ color: textColor }}>
                    {brandData.brandToneOfVoice || "Professional, clear, and approachable communication."}
                  </p>
                </div>
              </div>
            </div>
          ),
        },
        {
          type: "image" as const,
          url: brandData.images[2] || "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
        },
      ],
    },
  ]

  const openStory = (storyIndex: number) => {
    setSelectedStory(storyIndex)
    setCurrentItem(0)
  }

  const closeStory = () => {
    setSelectedStory(null)
    setCurrentItem(0)
  }

  const nextItem = () => {
    if (selectedStory === null) return
    const currentStory = stories[selectedStory]
    if (currentItem < currentStory.items.length - 1) {
      setCurrentItem(currentItem + 1)
    } else if (selectedStory < stories.length - 1) {
      setViewedStories((prev) => new Set(prev).add(selectedStory))
      setSelectedStory(selectedStory + 1)
      setCurrentItem(0)
    } else {
      setViewedStories((prev) => new Set(prev).add(selectedStory))
      closeStory()
    }
  }

  const prevItem = () => {
    if (selectedStory === null) return
    if (currentItem > 0) {
      setCurrentItem(currentItem - 1)
    } else if (selectedStory > 0) {
      setSelectedStory(selectedStory - 1)
      const prevStory = stories[selectedStory - 1]
      setCurrentItem(prevStory.items.length - 1)
    }
  }

  return (
    <>
      {/* Stories Row */}
      <div className="flex gap-6 justify-center items-start overflow-x-auto pb-4 px-4">
        {stories.map((story, idx) => (
          <button
            key={story.id}
            onClick={() => openStory(idx)}
            className="group flex-shrink-0 flex flex-col items-center gap-2"
          >
            <div className="relative">
              <div
                className={`w-20 h-20 rounded-full p-[3px] ${
                  viewedStories.has(idx)
                    ? "bg-neutral-700"
                    : "bg-gradient-to-tr from-emerald-500 via-green-500 to-teal-500"
                }`}
              >
                <div className="w-full h-full rounded-full bg-neutral-950 p-[3px]">
                  <img
                    src={story.thumbnail || "/placeholder.svg"}
                    alt={story.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
              <div className="absolute inset-0 rounded-full bg-neutral-950/0 group-hover:bg-neutral-950/20 transition-colors flex items-center justify-center">
                <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className="text-neutral-400 text-xs font-medium max-w-[80px] text-center leading-tight">
              {story.name}
            </span>
          </button>
        ))}
      </div>

      {/* Story Viewer Modal */}
      {selectedStory !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          <div className="relative w-full max-w-md h-[600px]">
            {/* Progress Bars */}
            <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
              {stories[selectedStory].items.map((_, idx) => (
                <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-white transition-all duration-300 ${
                      idx === currentItem ? "w-full" : idx < currentItem ? "w-full" : "w-0"
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Close Button */}
            <button
              onClick={closeStory}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center hover:bg-neutral-800/50 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Story Content */}
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-neutral-900">
              {stories[selectedStory].items[currentItem].type === "image" ? (
                <img
                  src={stories[selectedStory].items[currentItem].url || "/placeholder.svg"}
                  alt={`${stories[selectedStory].name} - ${currentItem + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full">{stories[selectedStory].items[currentItem].component}</div>
              )}

              {/* Navigation Areas */}
              <div className="absolute inset-0 flex">
                <button onClick={prevItem} className="flex-1 cursor-pointer" aria-label="Previous" />
                <button onClick={nextItem} className="flex-1 cursor-pointer" aria-label="Next" />
              </div>

              {/* Brand Info Overlay */}
              <div className="absolute top-16 left-4 right-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-900/80 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  {brandData.logo ? (
                    <img src={brandData.logo || "/placeholder.svg"} alt="Logo" className="w-6 h-6 object-contain" />
                  ) : (
                    <span className="text-emerald-500 font-mono text-sm">{"><"}</span>
                  )}
                </div>
                <span className="text-white font-semibold text-sm truncate">{getBrandName(brandData.url)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
