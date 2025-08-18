import Link from "next/link"
import { Calendar, Clock, ArrowRight, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function FeaturedPost() {
  return (
    <section className="space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-6xl font-bold font-mono glow-text text-primary">Windows 0-Day Research</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Exploring the depths of Windows security vulnerabilities and exploitation techniques
        </p>
      </div>

      <Card className="glow-border bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-all duration-300">
        <CardContent className="p-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-primary" />
                <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                  Featured Research
                </Badge>
              </div>

              <h2 className="text-3xl font-bold text-foreground">
                CVE-2024-1337: Critical Windows Kernel Vulnerability
              </h2>

              <p className="text-muted-foreground leading-relaxed">
                Deep analysis of a newly discovered privilege escalation vulnerability in the Windows kernel. This
                research covers the vulnerability discovery process, exploitation techniques, and defensive measures.
              </p>

              <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>January 15, 2024</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>12 min read</span>
                </div>
              </div>

              <Button asChild className="group">
                <Link href="/post/cve-2024-1337">
                  Read Full Analysis
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>

            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg border border-primary/30 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Shield className="h-16 w-16 text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground font-mono">Vulnerability Analysis</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
