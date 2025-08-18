import { Header } from "@/components/header"

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center px-8">
        <div className="text-center space-y-8 max-w-2xl">
          <div className="space-y-4">
            <div className="reversed-text text-xs">Pretending to be a Vulnerability Researcher</div>
            <div className="reversed-text text-xs">ALL THINGS WINDOWS!</div>
          </div>

          <div className="space-y-3 text-xs text-white font-mono">
            <p>Just another Security Researcher deeply interested in Windows Internals,</p>
            <p>Active Directory Security, Malware Development, RootKits,</p>
            <p>Reverse engineering, Exploit Development & Red Teaming.</p>
          </div>

          <div className="space-y-2 text-xs text-white font-mono">
            <p>Known by aliases "WaterBucket" and "ThanniKudam" on CTF platforms.</p>
            <p>Discord: thannikudam</p>
          </div>

          <div className="flex justify-center space-x-6 text-xs">
            <a
              href="https://twitter.com/DharaniSanjaiy"
              target="_blank"
              rel="noopener noreferrer"
              className="reversed-text hover:opacity-70 transition-opacity"
            >
              TWITTER
            </a>
            <a
              href="https://github.com/Dharani-sanjaiy"
              target="_blank"
              rel="noopener noreferrer"
              className="reversed-text hover:opacity-70 transition-opacity"
            >
              GITHUB
            </a>
            <a
              href="https://www.linkedin.com/in/dharani-sanjaiy-/"
              target="_blank"
              rel="noopener noreferrer"
              className="reversed-text hover:opacity-70 transition-opacity"
            >
              LINKEDIN
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
