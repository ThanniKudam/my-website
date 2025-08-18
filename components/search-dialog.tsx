"use client"

import { useState } from "react"
import { Search, FileText, Calendar } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const mockResults = [
  {
    id: 1,
    title: "CVE-2024-1234: Windows Kernel Privilege Escalation",
    excerpt: "Deep dive into a critical Windows kernel vulnerability that allows local privilege escalation...",
    date: "2024-01-15",
    category: "Vulnerability Research",
  },
  {
    id: 2,
    title: "Bypassing Windows Defender with Custom Shellcode",
    excerpt: "Techniques for evading modern Windows Defender detection using polymorphic shellcode...",
    date: "2024-01-10",
    category: "Evasion Techniques",
  },
  {
    id: 3,
    title: "Fuzzing Windows APIs for 0-Day Discovery",
    excerpt: "Automated fuzzing methodologies for discovering zero-day vulnerabilities in Windows APIs...",
    date: "2024-01-05",
    category: "Research Methods",
  },
]

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState(mockResults)

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)
    if (searchQuery.trim()) {
      const filtered = mockResults.filter(
        (result) =>
          result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.excerpt.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      setResults(filtered)
    } else {
      setResults(mockResults)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-primary font-mono">Search Research</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vulnerabilities, techniques, tools..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 bg-input border-border focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-3">
            {results.map((result) => (
              <Button
                key={result.id}
                variant="ghost"
                className="w-full h-auto p-4 text-left justify-start hover:bg-muted/50 hover:border-primary/50 border border-transparent transition-all"
                onClick={() => onOpenChange(false)}
              >
                <div className="space-y-2 w-full">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-foreground line-clamp-1">{result.title}</h3>
                    <FileText className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{result.excerpt}</p>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span className="text-primary font-mono">{result.category}</span>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{result.date}</span>
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>

          {results.length === 0 && query && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No results found for "{query}"</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
