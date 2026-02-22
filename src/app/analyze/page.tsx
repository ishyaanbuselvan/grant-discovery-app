'use client';
import { useState } from 'react';
import { Grant } from '@/lib/types';
import GrantCard from '@/components/GrantCard';

interface AnalysisResult {
  grant: Grant;
  status: 'success' | 'error';
  error?: string;
}

export default function AnalyzePage() {
  const [urls, setUrls] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const analyzeUrls = async () => {
    const urlList = urls
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0 && url.startsWith('http'));

    if (urlList.length === 0) {
      alert('Please enter at least one valid URL');
      return;
    }

    setIsAnalyzing(true);
    setResults([]);
    setProgress({ current: 0, total: urlList.length });

    const newResults: AnalysisResult[] = [];

    for (let i = 0; i < urlList.length; i++) {
      const url = urlList[i];
      setProgress({ current: i + 1, total: urlList.length });

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          throw new Error('Failed to analyze URL');
        }

        const data = await response.json();
        newResults.push({ grant: data.grant, status: 'success' });
      } catch (error) {
        newResults.push({
          grant: {
            id: `error-${i}`,
            organizationName: url,
            website: url,
            budgetMin: 0,
            budgetMax: 0,
            deadline: '',
            location: '',
            artsDiscipline: 'General Arts',
            fundingType: 'Project-Based',
            funderType: 'Private Foundation',
            eligibility: '',
            overview: '',
          },
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      setResults([...newResults]);
    }

    setIsAnalyzing(false);
  };

  const successfulResults = results.filter((r) => r.status === 'success');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--midnight)] mb-2" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          AI Grant Analyzer
        </h1>
        <p className="text-[var(--slate)]">
          Paste foundation URLs to automatically extract grant information using Claude AI
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-xl border border-[var(--card-border)] p-6 mb-8">
        <label className="block text-sm font-medium text-[var(--slate-dark)] mb-2">
          Foundation URLs (one per line)
        </label>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="https://www.arts.gov/grants&#10;https://www.nea.gov/grants&#10;https://foundation.org/funding"
          className="w-full h-40 px-4 py-3 border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] resize-none"
          disabled={isAnalyzing}
        />

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[var(--slate)]">
            {urls.split('\n').filter((l) => l.trim().startsWith('http')).length} URL(s) detected
          </p>
          <button
            onClick={analyzeUrls}
            disabled={isAnalyzing || !urls.trim()}
            className={`btn-primary px-6 py-2.5 flex items-center space-x-2 ${
              isAnalyzing ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isAnalyzing ? (
              <>
                <span className="animate-spin">⟳</span>
                <span>Analyzing ({progress.current}/{progress.total})...</span>
              </>
            ) : (
              <>
                <span>✦</span>
                <span>Analyze with AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress */}
      {isAnalyzing && (
        <div className="mb-8">
          <div className="h-2 bg-[var(--background-alt)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--gold)] transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-sm text-[var(--slate)] mt-2 text-center">
            Processing URL {progress.current} of {progress.total}...
          </p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--midnight)]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Analysis Results
            </h2>
            <p className="text-sm text-[var(--slate)]">
              {successfulResults.length} successful, {results.length - successfulResults.length} failed
            </p>
          </div>

          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index}>
                {result.status === 'success' ? (
                  <GrantCard grant={result.grant} />
                ) : (
                  <div className="grant-card p-5 border-red-200 bg-red-50">
                    <div className="flex items-start space-x-3">
                      <span className="text-red-500 text-lg">✕</span>
                      <div>
                        <p className="font-medium text-red-700">Failed to analyze</p>
                        <p className="text-sm text-red-600 break-all">{result.grant.website}</p>
                        <p className="text-sm text-red-500 mt-1">{result.error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      {results.length === 0 && !isAnalyzing && (
        <div className="text-center py-12 text-[var(--slate)]">
          <div className="text-5xl mb-4 opacity-20">✦</div>
          <h3 className="text-lg font-medium text-[var(--midnight)] mb-2">How it works</h3>
          <div className="max-w-md mx-auto text-sm space-y-2">
            <p>1. Paste one or more foundation website URLs above</p>
            <p>2. Click "Analyze with AI" to extract grant information</p>
            <p>3. Review the results and save grants you are interested in</p>
            <p>4. Export your saved grants to Excel from the Saved Grants page</p>
          </div>
        </div>
      )}
    </div>
  );
}
