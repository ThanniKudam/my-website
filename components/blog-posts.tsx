import Link from "next/link"
import { Calendar, Clock, ArrowRight, Bug, Shield, Zap, Code } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const posts = [
  {
    id: 1,
    title: "Advanced Windows Heap Exploitation Techniques",
    excerpt:
      "Exploring modern heap exploitation methods in Windows 10/11, including heap feng shui and advanced spraying techniques.",
    date: "2024-01-12",
    readTime: "15 min",
    category: "Exploitation",
    icon: Bug,
    slug: "advanced-heap-exploitation",
  },
  {
    id: 2,
    title: "Bypassing Windows Defender Real-Time Protection",
    excerpt:
      "Comprehensive guide to evading Windows Defender using various techniques including AMSI bypass and process hollowing.",
    date: "2024-01-08",
    readTime: "10 min",
    category: "Evasion",
    icon: Shield,
    slug: "bypassing-windows-defender",
  },
  {
    id: 3,
    title: "Kernel Driver Exploitation: From Bug to SYSTEM",
    excerpt:
      "Step-by-step walkthrough of exploiting a vulnerable kernel driver to achieve SYSTEM privileges on Windows.",
    date: "2024-01-05",
    readTime: "20 min",
    category: "Kernel Exploitation",
    icon: Zap,
    slug: "kernel-driver-exploitation",
  },
  {
    id: 4,
    title: "Building Custom Shellcode for Windows x64",
    excerpt: "Creating position-independent shellcode for Windows x64 architecture with advanced evasion techniques.",
    date: "2024-01-02",
    readTime: "18 min",
    category: "Shellcode Development",
    icon: Code,
    slug: "custom-shellcode-windows-x64",
  },
  {
    id: 5,
    title: "Windows API Hooking and DLL Injection",
    excerpt: "Deep dive into API hooking techniques and DLL injection methods for security research and analysis.",
    date: "2023-12-28",
    readTime: "12 min",
    category: "Research Methods",
    icon: Bug,
    slug: "api-hooking-dll-injection",
  },
  {
    id: 6,
    title: "Fuzzing Windows Services for 0-Day Discovery",
    excerpt: "Automated fuzzing methodologies for discovering zero-day vulnerabilities in Windows system services.",
    date: "2023-12-25",
    readTime: "16 min",
    category: "Vulnerability Research",
    icon: Shield,
    slug: "fuzzing-windows-services",
  },
]

export function BlogPosts() {
  return (
    <section className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold font-mono text-primary mb-4">Latest Research</h2>
        <p className="text-muted-foreground">Recent findings and techniques in Windows security research</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => {
          const IconComponent = post.icon
          return (
            <Card
              key={post.id}
              className="group hover:glow-border bg-card/30 backdrop-blur-sm border-border hover:border-primary/50 transition-all duration-300 cursor-pointer"
            >
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <IconComponent className="h-6 w-6 text-primary" />
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {post.category}
                  </Badge>
                </div>
                <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {post.title}
                </h3>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">{post.excerpt}</p>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{post.date}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{post.readTime}</span>
                    </div>
                  </div>
                </div>

                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="w-full group/btn hover:bg-primary/10 hover:text-primary"
                >
                  <Link href={`/post/${post.slug}`}>
                    Read More
                    <ArrowRight className="ml-2 h-3 w-3 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="text-center">
        <Button asChild variant="outline" size="lg" className="border-primary/30 hover:border-primary bg-transparent">
          <Link href="/research">
            View All Research
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
