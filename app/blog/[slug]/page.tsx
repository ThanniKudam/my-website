import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { getPostBySlug } from "@/lib/blog"
import { notFound } from "next/navigation"

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug)

  if (!post) {
    notFound()
  }

  return (
    <div className="min-h-screen text-white font-mono">
      {/* Hero Section (unchanged style, matches your site) */}
      <div className="border border-gray-600 mx-4 mt-8 mb-8">
        <div className="p-8 text-center">
          <h1 className="text-sm tracking-wide mb-4">{post.title}</h1>
          <div className="flex justify-center gap-4 text-xs text-gray-400 mb-4">
            <span>{post.author}</span>
            <span>•</span>
            <span>{post.date}</span>
            <span>•</span>
            <span>{post.readTime}</span>
          </div>
          <div className="flex justify-center gap-2">
            {post.tags.map((tag: string) => (
              <span key={tag} className="border border-gray-600 px-2 py-1 text-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content (no TL;DR sidebar; centered; 1.5 line spacing) */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-lg font-bold mt-8 mb-4 text-white font-mono">
                  {children}
                </h1>
              ),
              h2: ({ children }) => {
                const id = children?.toString().toLowerCase().replace(/\s+/g, "-") || ""
                return (
                  <h2 id={id} className="text-base font-bold mt-6 mb-3 text-white font-mono">
                    {children}
                  </h2>
                )
              },
              h3: ({ children }) => (
                <h3 className="text-sm font-bold mt-4 mb-2 text-white font-mono">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="mb-3 text-gray-300 text-xs leading-relaxed font-mono">
                  {children}
                </p>
              ),
              li: ({ children }) => (
                <li className="ml-4 mb-1 text-gray-300 text-xs leading-relaxed font-mono">
                  {children}
                </li>
              ),
              ul: ({ children }) => (
                <ul className="mb-4 text-gray-300 text-xs leading-relaxed font-mono">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-4 text-gray-300 text-xs leading-relaxed font-mono list-decimal ml-6">
                  {children}
                </ol>
              ),
              strong: ({ children }) => <strong className="text-white font-mono">{children}</strong>,
              em: ({ children }) => <em className="text-gray-200 font-mono">{children}</em>,
              code: ({ children, className }) => {
                const isInline = !className
                if (isInline) {
                  return (
                    <code className="bg-gray-800 px-1 py-0.5 rounded text-xs text-white font-mono border border-gray-600">
                      {children}
                    </code>
                  )
                }
                return <code className="text-white font-mono text-xs block">{children}</code>
              },
              pre: ({ children }) => (
                <pre className="bg-black border border-gray-600 p-4 overflow-x-auto text-xs font-mono mb-4">
                  <code className="text-white">{children}</code>
                </pre>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-gray-600 pl-4 my-4 text-gray-300 text-xs font-mono italic">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <table className="w-full border-collapse border border-gray-600 my-4 text-xs font-mono">
                  {children}
                </table>
              ),
              th: ({ children }) => (
                <th className="border border-gray-600 px-3 py-2 bg-gray-800 text-white font-mono text-left">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-gray-600 px-3 py-2 text-gray-300 font-mono">{children}</td>
              ),
              hr: () => <hr className="border-gray-600 my-6" />,
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

