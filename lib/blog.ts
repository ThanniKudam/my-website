import fs from "fs"
import path from "path"
import matter from "gray-matter"

const postsDirectory = path.join(process.cwd(), "content")

export interface BlogPost {
  slug: string
  title: string
  date: string            // keeps original display string
  excerpt: string
  tags: string[]
  author: string
  readTime: string
  content: string
}

function parseFrontmatterDate(input: unknown): number {
  // Supports "DD-MM-YYYY" or "DD/MM/YYYY" and ISO-like strings
  if (!input || typeof input !== "string") return 0
  const s = input.trim()

  // DD-MM-YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2]) - 1
    const y = Number(m[3])
    const dt = new Date(y, mo, d)
    return isNaN(dt.getTime()) ? 0 : dt.getTime()
  }

  // Fallback to Date parser (handles YYYY-MM-DD etc.)
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? 0 : dt.getTime()
}

export function getAllPosts(): BlogPost[] {
  try {
    if (!fs.existsSync(postsDirectory)) return []

    const fileNames = fs.readdirSync(postsDirectory)

    const posts = fileNames
      .filter((fileName) => fileName.endsWith(".md"))
      .map((fileName) => {
        const slug = fileName.replace(/\.md$/, "")
        const fullPath = path.join(postsDirectory, fileName)
        const fileContents = fs.readFileSync(fullPath, "utf8")
        const { data, content } = matter(fileContents)

        return {
          slug,
          title: data.title || "Untitled",
          // keep original date string for display
          date: typeof data.date === "string" ? data.date : "",
          excerpt: data.excerpt || "",
          tags: Array.isArray(data.tags) ? data.tags : [],
          author: data.author || "WaterBucket",
          readTime: data.readTime || "5 min read",
          content,
          // internal sort key only
          _sortKey: parseFrontmatterDate(data.date),
        } as BlogPost & { _sortKey: number }
      })

    // Newest first
    const sorted = posts.sort((a, b) => b._sortKey - a._sortKey)
    // strip the internal field
    return sorted.map(({ _sortKey, ...p }) => p)
  } catch (error) {
    console.error("Error reading posts:", error)
    return []
  }
}

export function getPostBySlug(slug: string): BlogPost | null {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.md`)
    if (!fs.existsSync(fullPath)) return null

    const fileContents = fs.readFileSync(fullPath, "utf8")
    const { data, content } = matter(fileContents)

    return {
      slug,
      title: data.title || "Untitled",
      date: typeof data.date === "string" ? data.date : "",
      excerpt: data.excerpt || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      author: data.author || "WaterBucket",
      readTime: data.readTime || "5 min read",
      content,
    }
  } catch (error) {
    console.error("Error reading post:", error)
    return null
  }
}

