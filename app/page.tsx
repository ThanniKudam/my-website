"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?()[]{}<>@#$%^&*-_+="

const scrambleChar = (target: string, progress: number) => {
  return target
    .split("")
    .map((c, i) => {
      if (i < progress) return c
      if (c === " " || c === "\n") return c
      return chars[Math.floor(Math.random() * chars.length)]
    })
    .join("")
}

export default function HomePage() {
  const [displayText, setDisplayText] = useState("")
  const quote = `தெய்வத்தான் ஆகா தெனினும் முயற்சிதன், மெய்வருத்தக் கூலி தரும்.`

  useEffect(() => {
    let progress = 0
    const interval = setInterval(() => {
      if (progress <= quote.length) {
        setDisplayText(scrambleChar(quote, progress))
        progress++
      } else clearInterval(interval)
    }, 30)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col justify-end items-center px-4 py-8">
        {/* Bottom-aligned quote with scramble animation */}
        <div className="text-white text-xs md:text-sm font-mono text-center mb-4">
          <pre className="whitespace-pre-wrap">{displayText}</pre>
        </div>
      </main>
    </div>
  )
}

