'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen">
      <section className="min-h-[90vh] flex flex-col items-center justify-center px-4 relative">
        <div className="text-center max-w-3xl">
          <div className="text-7xl mb-6 text-[var(--gold)]">&#9835;</div>
          <h1 className="text-5xl md:text-6xl font-bold text-[var(--midnight)] mb-4" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Welcome to Luminarts
          </h1>
          <p className="text-lg text-[var(--slate)] mb-2">Grant Discovery Platform for</p>
          <p className="text-2xl text-[var(--midnight)] font-medium mb-8" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Friday Morning Music Club
          </p>
          <p className="text-lg text-[var(--slate-dark)] mb-10 leading-relaxed max-w-2xl mx-auto">
            Your comprehensive toolkit for finding, analyzing, and managing grant opportunities for classical music and performing arts organizations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/search" className="btn-primary text-lg px-8 py-4 inline-flex items-center justify-center space-x-2">
              <span>&#9834;</span><span>Explore Grants</span>
            </Link>
            <Link href="/analyze" className="btn-secondary text-lg px-8 py-4 inline-flex items-center justify-center space-x-2">
              <span>&#10022;</span><span>Analyze Foundation Links</span>
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-8 text-center max-w-xl mx-auto">
            <div><div className="text-4xl font-bold text-[var(--gold)]">65+</div><div className="text-sm text-[var(--slate)]">Curated Grants</div></div>
            <div><div className="text-4xl font-bold text-[var(--gold)]">AI</div><div className="text-sm text-[var(--slate)]">Grant Analysis</div></div>
            <div><div className="text-4xl font-bold text-[var(--gold)]">Excel</div><div className="text-sm text-[var(--slate)]">Export Ready</div></div>
          </div>
        </div>
        <div className="absolute bottom-8 animate-bounce text-[var(--slate)]">
          <p className="text-sm mb-2">Discover more</p><span className="text-2xl">&#8595;</span>
        </div>
      </section>

      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-5xl text-[var(--gold)] mb-6">&#9834;</div>
              <h2 className="text-4xl font-bold text-[var(--midnight)] mb-4" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Advanced Grant Discovery</h2>
              <p className="text-lg text-[var(--slate-dark)] mb-6 leading-relaxed">
                Browse our curated database of <strong>65+ grant opportunities</strong> specifically selected for classical music and performing arts organizations. Filter by deadline, award amount, location, arts discipline, and funding type.
              </p>
              <ul className="space-y-3 text-[var(--slate-dark)] mb-8">
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Smart deadline filtering with preparation window calculator</span></li>
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Dual-handle budget slider for precise award range filtering</span></li>
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Filter by Classical Music, Performing Arts, Music Education</span></li>
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Expandable grant cards with complete eligibility details</span></li>
              </ul>
              <Link href="/search" className="btn-primary text-lg px-8 py-3 inline-flex items-center space-x-2"><span>Search the Database</span><span>&#8594;</span></Link>
            </div>
            <div className="bg-[var(--background-alt)] rounded-2xl p-8 border border-[var(--card-border)]">
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-[var(--card-border)]"><div className="text-sm font-medium text-[var(--midnight)]">National Endowment for the Arts</div><div className="text-xs text-[var(--slate)]">$10,000 - $100,000 | Washington, DC</div></div>
                <div className="bg-white rounded-lg p-4 border border-[var(--card-border)]"><div className="text-sm font-medium text-[var(--midnight)]">Chamber Music America</div><div className="text-xs text-[var(--slate)]">$5,000 - $20,000 | New York, NY</div></div>
                <div className="bg-white rounded-lg p-4 border border-[var(--card-border)]"><div className="text-sm font-medium text-[var(--midnight)]">Aaron Copland Fund for Music</div><div className="text-xs text-[var(--slate)]">$1,000 - $20,000 | New York, NY</div></div>
                <div className="text-center text-sm text-[var(--slate)] mt-4">+ 62 more grants</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-[var(--background-alt)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 bg-white rounded-2xl p-8 border border-[var(--card-border)]">
              <div className="space-y-4">
                <div className="bg-[var(--background)] rounded-lg p-4"><div className="text-xs text-[var(--slate)] mb-2">Paste foundation URLs:</div><div className="text-sm text-[var(--midnight)] font-mono">https://mellon.org/grants</div><div className="text-sm text-[var(--midnight)] font-mono">https://kresge.org/arts</div></div>
                <div className="flex items-center justify-center py-4"><div className="text-[var(--gold)] text-2xl animate-pulse">&#10022; Analyzing...</div></div>
                <div className="bg-[var(--background)] rounded-lg p-4 border-l-4 border-[var(--gold)]"><div className="text-sm font-medium text-[var(--midnight)]">Extracted Grant Data</div><div className="text-xs text-[var(--slate)] mt-1">Organization, Budget, Deadline, Eligibility, Overview</div></div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="text-5xl text-[var(--gold)] mb-6">&#10022;</div>
              <h2 className="text-4xl font-bold text-[var(--midnight)] mb-4" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>AI-Powered Grant Analysis</h2>
              <p className="text-lg text-[var(--slate-dark)] mb-6 leading-relaxed">
                Found a foundation website but struggling to extract the key details? Paste any grant foundation URL and let our <strong>Claude AI</strong> automatically extract organization name, budget ranges, deadlines, eligibility requirements, and a comprehensive summary.
              </p>
              <ul className="space-y-3 text-[var(--slate-dark)] mb-8">
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Analyze multiple URLs at once - batch process your research</span></li>
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Intelligent extraction of grant requirements and deadlines</span></li>
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Auto-generates formatted grant cards matching our database</span></li>
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Save analyzed grants directly to your collection</span></li>
              </ul>
              <Link href="/analyze" className="btn-primary text-lg px-8 py-3 inline-flex items-center space-x-2"><span>Try the AI Analyzer</span><span>&#8594;</span></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-5xl text-[var(--gold)] mb-6">&#128196;</div>
              <h2 className="text-4xl font-bold text-[var(--midnight)] mb-4" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Save, Organize and Export</h2>
              <p className="text-lg text-[var(--slate-dark)] mb-6 leading-relaxed">
                Build your personalized grant pipeline. Save grants from both the curated database and your AI-analyzed discoveries into a unified collection. When ready, export everything to a <strong>professionally formatted Excel spreadsheet</strong> for your board, grant writing team, or records.
              </p>
              <ul className="space-y-3 text-[var(--slate-dark)] mb-8">
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>One-click save with the heart icon on any grant card</span></li>
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Persistent storage - your saved grants are always there</span></li>
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Export to .xlsx with all details: budget, deadline, eligibility</span></li>
                <li className="flex items-center space-x-3"><span className="text-[var(--gold)]">&#10003;</span><span>Share the spreadsheet with your team or board</span></li>
              </ul>
              <Link href="/saved" className="btn-primary text-lg px-8 py-3 inline-flex items-center space-x-2"><span>View Saved Grants</span><span>&#8594;</span></Link>
            </div>
            <div className="bg-[var(--background-alt)] rounded-2xl p-8 border border-[var(--card-border)]">
              <div className="bg-white rounded-lg p-6 border border-[var(--card-border)] mb-4">
                <div className="flex items-center justify-between mb-4"><div className="text-lg font-medium text-[var(--midnight)]">Your Saved Grants</div><div className="text-[var(--gold)]">&#9829; 12</div></div>
                <div className="space-y-2 text-sm text-[var(--slate)]"><div>NEA Grants for Arts Projects</div><div>Chamber Music America Commissioning</div><div>Mellon Foundation Operating Support</div><div className="text-[var(--slate-light)]">+ 9 more</div></div>
              </div>
              <div className="btn-primary w-full text-center py-3">&#128196; Export to Excel</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-[var(--midnight)] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Ready to Discover Your Next Grant?</h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">Stop spending hours searching through foundation websites. Start with our curated database of 65+ grants or analyze any foundation URL with AI.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/search" className="bg-[var(--gold)] text-[var(--midnight-dark)] font-medium text-lg px-8 py-4 rounded-lg inline-flex items-center justify-center space-x-2 hover:bg-[var(--gold-light)]"><span>&#9834;</span><span>Search 65+ Grants</span></Link>
            <Link href="/analyze" className="bg-white/10 text-white font-medium text-lg px-8 py-4 rounded-lg inline-flex items-center justify-center space-x-2 hover:bg-white/20 border border-white/20"><span>&#10022;</span><span>Analyze Foundation Links</span></Link>
          </div>
        </div>
      </section>

      <footer className="py-8 px-4 bg-[var(--midnight-dark)] text-white/60 text-center text-sm">
        <p>Luminarts - Grant Discovery Platform for Friday Morning Music Club</p>
      </footer>
    </div>
  );
}
