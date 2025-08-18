'use client';

type Props = {
  sections: { id: string; label: string }[]
}

export default function Sidebar({ sections }: Props) {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="w-48 flex-shrink-0">
      <div className="sticky top-8">
        <h3 className="text-xs tracking-wide mb-4">TL;DR</h3>
        <nav className="space-y-2 text-xs text-gray-400">
          {sections.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              className="block text-left hover:text-white transition-colors cursor-pointer"
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

