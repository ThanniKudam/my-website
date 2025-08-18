import { Header } from "@/components/header"

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-4xl mx-auto px-8 py-16">
        <div className="space-y-8">
          <h1 className="text-4xl font-light hacktron-text">Contact</h1>

          <div className="space-y-6 text-gray-800 leading-relaxed">
            <p>
              For security research collaboration, vulnerability disclosure, or general inquiries related to Windows
              security research.
            </p>

            <div className="space-y-4">
              <div className="border border-gray-300 p-6">
                <h3 className="text-lg font-medium mb-3">Security Research</h3>
                <p className="text-sm text-gray-600 mb-4">
                  For collaboration on security research projects or vulnerability coordination.
                </p>
                <div className="reversed-text inline-block">research@zerodaylab.dev</div>
              </div>

              <div className="border border-gray-300 p-6">
                <h3 className="text-lg font-medium mb-3">Vulnerability Disclosure</h3>
                <p className="text-sm text-gray-600 mb-4">For responsible disclosure of security vulnerabilities.</p>
                <div className="reversed-text inline-block">disclosure@zerodaylab.dev</div>
              </div>
            </div>

            <div className="mt-12 p-6 bg-gray-50 border">
              <h3 className="text-lg font-medium mb-3">PGP Key</h3>
              <p className="text-sm text-gray-600 mb-4">
                For encrypted communications regarding sensitive security matters.
              </p>
              <code className="text-xs bg-white p-2 border block">
                4096R/ABCD1234 2024-01-01
                <br />
                Fingerprint: 1234 5678 9ABC DEF0 1234 5678 9ABC DEF0 1234 5678
              </code>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
