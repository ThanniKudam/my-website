"use client"

import Link from "next/link"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 w-full py-6 px-8 z-50">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-light hacktron-text">
          WaterBucket
        </Link>

        <nav className="flex items-center space-x-8">
          <Link
            href="/about"
            className="text-sm uppercase tracking-wide hacktron-text hover:opacity-70 transition-opacity"
          >
            ABOUT
          </Link>
          <Link
            href="/blog"
            className="text-sm uppercase tracking-wide hacktron-text hover:opacity-70 transition-opacity"
          >
            BLOG
          </Link>
        </nav>
      </div>
    </header>
  )
}
