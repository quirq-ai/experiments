"use client"

import { useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart, X, ArrowUpIcon, Bookmark, HelpCircle, MoveUpIcon } from "lucide-react"

interface SwipeableFeedProps {
  brandData: {
    url: string
    logo?: string
    tagline: string
    brandValues: string[]
    businessOverview?: string
    colors: Array<{ hex: string }>
    images?: string[]
    feed?: Array<{
      postId: string
      postType: "twitter" | "instagram"
      question: string
      answer: string
    }>
  }
  isMobile?: boolean
}

interface Tweet {
  id: number
  type: "tweet"
  author: string
  handle: string
  avatar: string
  content: string
  timestamp: string
  likes: number
  retweets: number
  replies: number
  isQuoteTweet?: boolean
  quoteText?: string
}

interface InstagramPost {
  id: number
  type: "instagram"
  username: string
  avatar: string
  postImage?: string
  caption: string
  likes: number
  comments: number
  timestamp: string
  isLogoPost?: boolean
  isMediaPost?: boolean
  isWordCloud?: boolean
  isOnboarding?: boolean
  onboardingText?: string
  isAnswerPost?: boolean
  answerText?: string
}

interface TutorialCard {
  id: number
  type: "tutorial"
  title: string
  description: string
  icon: "left" | "right" | "up" | "info"
}

type FeedItem = Tweet | InstagramPost | TutorialCard

export function SwipeableFeed({ brandData, isMobile = false }: SwipeableFeedProps) {
  const getBrandName = (url: string) => {
    return url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split(".")[0]
      .replace(/^\w/, (c) => c.toUpperCase())
  }

  const brandName = getBrandName(brandData.url)
  const primaryColor = brandData.colors[0]?.hex || "#000000"
  const textColor = brandData.colors[1]?.hex || "#ffffff"

  const instagramOnboarding: InstagramPost = {
    id: 0,
    type: "instagram",
    username: brandName,
    avatar: brandData.logo || "/placeholder.svg?height=40&width=40",
    caption: brandData.businessOverview || "",
    likes: 0,
    comments: 0,
    timestamp: "now",
    isOnboarding: true,
    onboardingText: `Help answer questions about ${brandName}`,
  }

  const feedItems: FeedItem[] = [instagramOnboarding]

  if (brandData.feed) {
    brandData.feed.forEach((item, index) => {
      if (item.postType === "instagram") {
        feedItems.push({
          id: feedItems.length,
          type: "instagram",
          username: brandName,
          avatar: brandData.logo || "/placeholder.svg?height=40&width=40",
          caption: item.question,
          likes: Math.floor(Math.random() * 1000) + 100,
          comments: Math.floor(Math.random() * 100) + 10,
          timestamp: `${index + 1}h ago`,
          isAnswerPost: true,
          answerText: item.answer,
        } as InstagramPost)
      } else if (item.postType === "twitter") {
        feedItems.push({
          id: feedItems.length,
          type: "tweet",
          author: brandName,
          handle: `@${brandName.toLowerCase()}`,
          avatar: brandData.logo || "/placeholder.svg?height=40&width=40",
          content: item.question,
          timestamp: `${index + 1}h ago`,
          likes: Math.floor(Math.random() * 500) + 50,
          retweets: Math.floor(Math.random() * 200) + 20,
          replies: Math.floor(Math.random() * 50) + 5,
          isQuoteTweet: true,
          quoteText: item.answer,
        } as Tweet)
      }
    })
  }

  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (clientX: number, clientY: number) => {
    setDragStart({ x: clientX, y: clientY })
    setIsDragging(true)
  }

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!dragStart) return
    const deltaX = clientX - dragStart.x
    const deltaY = clientY - dragStart.y
    setDragOffset({ x: deltaX, y: deltaY })
  }

  const handleDragEnd = () => {
    if (!dragStart) return

    const threshold = 100

    if (dragOffset.y < -threshold && Math.abs(dragOffset.x) < threshold) {
      handleNotSure()
    } else if (Math.abs(dragOffset.x) > threshold) {
      if (dragOffset.x > 0) {
        handleCorrect()
      } else {
        handleWrong()
      }
    }

    setDragStart(null)
    setDragOffset({ x: 0, y: 0 })
    setIsDragging(false)
  }

  const handleCorrect = () => {
    if (currentIndex < feedItems.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleWrong = () => {
    if (currentIndex < feedItems.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleNotSure = () => {
    if (currentIndex < feedItems.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const rotation = dragOffset.x * 0.1
  const opacity = 1 - Math.abs(dragOffset.x) / 300 - Math.abs(dragOffset.y) / 300

  if (currentIndex >= feedItems.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="text-6xl">🎉</div>
        <h3 className="text-2xl font-semibold text-neutral-200">All caught up!</h3>
        <p className="text-neutral-400">Thanks for helping train our AI about {brandName}!</p>
        <Button onClick={() => setCurrentIndex(0)} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
          Start Over
        </Button>
      </div>
    )
  }

  const renderContent = () => {
    const currentItem = feedItems[currentIndex]

    if (!currentItem) return null

    if (currentItem.type === "instagram" && (currentItem as InstagramPost).isOnboarding) {
      const instaPost = currentItem as InstagramPost
      return (
        <div
          className={`${
            isMobile ? "w-full max-w-[400px]" : "w-[400px]"
          } bg-neutral-950 rounded-lg overflow-hidden shadow-2xl border border-neutral-800`}
          style={{ touchAction: "none" }}
        >
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 p-[2px]">
                <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center">
                  <img
                    src={instaPost.avatar || "/placeholder.svg"}
                    alt={instaPost.username}
                    className="w-8 h-8 rounded-full object-contain"
                  />
                </div>
              </div>
              <span className="font-semibold text-neutral-100">{instaPost.username}</span>
            </div>
          </div>

          <div
            className="aspect-square flex flex-col items-center justify-center p-8 md:p-12"
            style={{ backgroundColor: primaryColor }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4" style={{ color: textColor }}>
              {instaPost.onboardingText}
            </h2>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-sm text-neutral-300">
              <span className="font-semibold text-neutral-100">Question: </span> {instaPost.caption}
            </p>
          </div>
        </div>
      )
    }

    if (currentItem.type === "instagram" && (currentItem as InstagramPost).isAnswerPost) {
      const instaPost = currentItem as InstagramPost
      return (
        <div
          className={`${
            isMobile ? "w-full max-w-[400px]" : "w-[400px]"
          } bg-neutral-950 rounded-lg overflow-hidden shadow-2xl border border-neutral-800`}
          style={{ touchAction: "none" }}
        >
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 p-[2px]">
                <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center">
                  <img
                    src={instaPost.avatar || "/placeholder.svg"}
                    alt={instaPost.username}
                    className="w-8 h-8 rounded-full object-contain"
                  />
                </div>
              </div>
              <span className="font-semibold text-neutral-100">{instaPost.username}</span>
            </div>
          </div>

          <div
            className="aspect-square flex items-center justify-center p-6 md:p-12"
            style={{ backgroundColor: primaryColor }}
          >
            <p className="text-xl md:text-2xl font-medium text-center leading-relaxed" style={{ color: textColor }}>
              {instaPost.answerText}
            </p>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-sm text-neutral-300">
              <span className="font-semibold text-neutral-100">{instaPost.username}</span> {instaPost.caption}
            </p>
            <div className="flex items-center gap-4 text-neutral-400">
              <span className="text-xs">{instaPost.timestamp}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 px-4 py-3 border-t border-neutral-800">
            <Heart className="w-6 h-6 cursor-pointer hover:text-emerald-500 transition-colors" />
            <ArrowUpIcon className="w-6 h-6 cursor-pointer hover:text-emerald-500 transition-colors" />
            <Bookmark className="w-6 h-6 ml-auto cursor-pointer hover:text-emerald-500 transition-colors" />
          </div>
        </div>
      )
    }

    if (currentItem.type === "tweet" && (currentItem as Tweet).isQuoteTweet) {
      const tweet = currentItem as Tweet
      return (
        <div
          className={`${
            isMobile ? "w-full max-w-[400px]" : "w-[600px]"
          } bg-neutral-950 rounded-2xl p-4 md:p-6 shadow-2xl border border-neutral-800`}
          style={{ touchAction: "none" }}
        >
          <div className="flex items-start gap-3 mb-4">
            <img
              src={tweet.avatar || "/placeholder.svg"}
              alt={tweet.author}
              className="w-12 h-12 rounded-full object-contain bg-neutral-900 p-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-100">{tweet.author}</span>
                <span className="text-neutral-500">{tweet.handle}</span>
                <span className="text-neutral-600">·</span>
                <span className="text-neutral-500 text-sm">{tweet.timestamp}</span>
              </div>
              <p className="text-neutral-100 mt-2 text-base md:text-lg leading-relaxed">{tweet.content}</p>
            </div>
          </div>

          <div className="ml-0 md:ml-12 border border-neutral-800 rounded-xl p-4 bg-neutral-900/50">
            <div className="flex items-start gap-3">
              <img
                src={tweet.avatar || "/placeholder.svg"}
                alt={tweet.author}
                className="w-8 h-8 rounded-full object-contain bg-neutral-800 p-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-200 text-sm">{tweet.author}</span>
                  <span className="text-neutral-500 text-sm">{tweet.handle}</span>
                </div>
                <p className="text-neutral-300 mt-2 text-sm md:text-base leading-relaxed">{tweet.quoteText}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-6 mt-4 ml-0 md:ml-12 text-neutral-500 items-center flex-row text-center">
            <div className="flex items-center gap-2 cursor-pointer hover:text-emerald-500 transition-colors">
              <X className="w-5 h-5 text-foreground" />
              <span className="text-sm">{tweet.replies}</span>
            </div>
            <div className="flex items-center gap-2 cursor-pointer hover:text-emerald-500 transition-colors">
              <MoveUpIcon className="w-5 h-5" />
              <span className="text-sm">{tweet.retweets}</span>
            </div>
            <div className="flex items-center gap-2 cursor-pointer hover:text-red-500 transition-colors">
              <Heart className="w-5 h-5" />
              <span className="text-sm">{tweet.likes}</span>
            </div>
            <div className="flex items-center gap-2 cursor-pointer hover:text-emerald-500 transition-colors"></div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="w-full max-w-lg mx-auto py-4 md:py-8 px-0 md:px-0">
      <div className="text-center mb-6 px-4">
        <p className="text-sm text-neutral-400">
          Swipe <span className="text-emerald-500 font-semibold">right</span> if correct • Swipe{" "}
          <span className="text-red-500 font-semibold">left</span> if wrong • Swipe{" "}
          <span className="text-blue-500 font-semibold">up</span> if not sure
        </p>
      </div>

      <div className="relative h-[600px] md:h-[600px] flex items-center justify-center">
        {isDragging && (
          <>
            <div
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 transition-opacity"
              style={{ opacity: dragOffset.x > 50 ? 1 : 0 }}
            >
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center">
                <Heart className="w-8 h-8 md:w-12 md:h-12 text-emerald-500 fill-emerald-500" />
              </div>
            </div>
            <div
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 transition-opacity"
              style={{ opacity: dragOffset.x < -50 ? 1 : 0 }}
            >
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-red-500/20 border-4 border-red-500 flex items-center justify-center">
                <X className="w-8 h-8 md:w-12 md:h-12 text-red-500" />
              </div>
            </div>
            <div
              className="absolute left-1/2 -translate-x-1/2 top-4 md:top-8 transition-opacity"
              style={{ opacity: dragOffset.y < -50 ? 1 : 0 }}
            >
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-blue-500/20 border-4 border-blue-500 flex items-center justify-center">
                <HelpCircle className="w-8 h-8 md:w-12 md:h-12 text-blue-500" />
              </div>
            </div>
          </>
        )}

        <div
          ref={cardRef}
          className="absolute cursor-grab active:cursor-grabbing w-full px-4 md:px-0"
          style={{
            transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${rotation}deg)`,
            opacity: opacity,
            transition: isDragging ? "none" : "transform 0.3s ease, opacity 0.3s ease",
          }}
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onMouseMove={(e) => isDragging && handleDragMove(e.clientX, e.clientY)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => isDragging && handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
        >
          {renderContent()}
        </div>

        {currentIndex < feedItems.length - 1 && (
          <div
            className="absolute pointer-events-none px-4 md:px-0"
            style={{
              transform: `scale(0.95) translateY(10px)`,
              zIndex: -1,
              opacity: 0.5,
            }}
          >
            <Card className="w-full max-w-[400px] mx-auto h-[300px] bg-neutral-900 border-neutral-800" />
          </div>
        )}
      </div>

      {!isMobile && (
        <div className="flex gap-6 justify-center items-center mt-8 px-4">
          <button
            onClick={handleWrong}
            className="group flex flex-col items-center gap-3 transition-all hover:scale-110 active:scale-95"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center transition-all group-hover:bg-red-500/20 group-hover:border-red-500/60 group-hover:shadow-lg group-hover:shadow-red-500/20">
              <X className="w-7 h-7 text-red-400 group-hover:text-red-300 transition-colors" />
            </div>
            <span className="text-xs font-medium text-neutral-400 group-hover:text-red-300 transition-colors uppercase tracking-wide">
              Wrong
            </span>
          </button>

          <button
            onClick={handleNotSure}
            className="group flex flex-col items-center gap-3 transition-all hover:scale-110 active:scale-95"
          >
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center transition-all group-hover:bg-blue-500/20 group-hover:border-blue-500/60 group-hover:shadow-lg group-hover:shadow-blue-500/20">
              <HelpCircle className="w-7 h-7 text-blue-400 group-hover:text-blue-300 transition-colors" />
            </div>
            <span className="text-xs font-medium text-neutral-400 group-hover:text-blue-300 transition-colors uppercase tracking-wide">
              Not Sure
            </span>
          </button>

          <button
            onClick={handleCorrect}
            className="group flex flex-col items-center gap-3 transition-all hover:scale-110 active:scale-95"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center transition-all group-hover:bg-emerald-500/20 group-hover:border-emerald-500/60 group-hover:shadow-lg group-hover:shadow-emerald-500/20">
              <Heart className="w-7 h-7 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
            </div>
            <span className="text-xs font-medium text-neutral-400 group-hover:text-emerald-300 transition-colors uppercase tracking-wide">
              Correct
            </span>
          </button>
        </div>
      )}

      <div className="mt-6 text-center text-sm text-neutral-500">
        {currentIndex + 1} / {feedItems.length}
      </div>
    </div>
  )
}
