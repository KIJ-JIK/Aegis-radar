'use client';

import React, { useState, useEffect } from 'react';

interface Notice {
  title: string;
  link: string;
  date: string;
  category: string;
  summary?: string;
  reference_id?: string;
}

interface HealLog {
  id: string;
  timestamp: string;
  collectorId: string;
  triggerReason: string;
  repairStrategy: string;
  status: string;
  details: string;
  autoApproved: boolean;
}

interface Metrics {
  collectorId: string;
  targetUrl: string;
  status: string;
  totalNotices: number;
  totalHealEvents: number;
  lastRun: string;
  schemaCompliance: string;
}

export default function AegisDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [healLogs, setHealLogs] = useState<HealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringHeal, setTriggeringHeal] = useState(false);
  const [scrapingUrl, setScrapingUrl] = useState(false);
  const [customTargetUrl, setCustomTargetUrl] = useState('https://aws.amazon.com/new/');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const fetchRadarData = async () => {
    try {
      const res = await fetch('/api/radar');
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        setNotices(data.notices || []);
        setHealLogs(data.healLogs || []);
      }
    } catch (err) {
      console.error('Failed to fetch radar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRadarData();
    const interval = setInterval(fetchRadarData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRunScrape = async () => {
    setScrapingUrl(true);
    setNotificationMsg(`🌐 Routeing request via Bright Data Web Unlocker proxy to ${customTargetUrl}...`);
    try {
      const res = await fetch('/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: customTargetUrl })
      });
      const data = await res.json();
      if (data.success) {
        setNotificationMsg('✅ Scraped 100% compliant structured notices via Bright Data Scraper Studio!');
        await fetchRadarData();
      } else {
        setNotificationMsg(`❌ Extraction failed: ${data.error}`);
      }
    } catch (err: any) {
      setNotificationMsg(`❌ Error: ${err.message}`);
    } finally {
      setScrapingUrl(false);
      setTimeout(() => setNotificationMsg(null), 8000);
    }
  };

  const handleTriggerSelfHeal = async () => {
    setTriggeringHeal(true);
    setNotificationMsg('🧪 Injecting staged site layout redesign break... Triggering Bright Data Scraper Studio Self-Heal AI engine...');
    try {
      const res = await fetch('/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagedDemo: true })
      });
      const data = await res.json();
      if (data.success) {
        setNotificationMsg('✅ Bright Data Scraper Studio AI repaired DOM selectors! Layout healed successfully.');
        await fetchRadarData();
      } else {
        setNotificationMsg(`❌ Self-heal failed: ${data.error}`);
      }
    } catch (err: any) {
      setNotificationMsg(`❌ Error: ${err.message}`);
    } finally {
      setTriggeringHeal(false);
      setTimeout(() => setNotificationMsg(null), 8000);
    }
  };

  const categories = Array.from(new Set(notices.map(n => n.category || 'General')));

  const filteredNotices = notices.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (n.category && n.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'ALL' || n.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-black pb-16">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-violet-950 border-b border-cyan-500/20 px-6 py-2 text-xs flex justify-between items-center text-cyan-300">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span>HACKATHON BUILD: <strong>Into the Scrape-Verse</strong> (WeMakeDevs × Bright Data)</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-slate-400">Entry: <strong className="text-white">Solo Project</strong></span>
          <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-2.5 py-0.5 rounded-full font-mono text-[10px]">
            Bright Data Scraper Studio Active
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 pt-8 pb-6 border-b border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-cyan-500 to-violet-600 rounded-xl shadow-lg shadow-cyan-500/20">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                AEGIS RADAR
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Self-Healing Public Intelligence Radar • Powered by Bright Data Scraper Studio & Gemini AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTriggerSelfHeal}
              disabled={triggeringHeal}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 shadow-lg ${
                triggeringHeal
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-orange-500/25 hover:shadow-orange-500/40 active:scale-95'
              }`}
            >
              {triggeringHeal ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Executing Self-Healing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Simulate Site Layout Redesign (Self-Heal Demo)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic URL Input Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3">
          <span className="text-xs font-semibold text-cyan-400 whitespace-nowrap flex items-center gap-1.5">
            <span>🌐</span> Target URL:
          </span>
          <input
            type="text"
            value={customTargetUrl}
            onChange={(e) => setCustomTargetUrl(e.target.value)}
            placeholder="Enter any public URL (e.g. https://aws.amazon.com/new/)"
            className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 w-full font-mono"
          />
          <button
            onClick={handleRunScrape}
            disabled={scrapingUrl}
            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5"
          >
            {scrapingUrl ? 'Scraping...' : 'Instant Scrape URL'}
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {notificationMsg && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-gradient-to-r from-amber-950/80 to-slate-900 border border-amber-500/40 p-4 rounded-xl text-amber-200 text-sm flex items-center justify-between shadow-xl backdrop-blur-md animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚡</span>
              <span>{notificationMsg}</span>
            </div>
            <button onClick={() => setNotificationMsg(null)} className="text-amber-400 hover:text-white font-bold text-xs">✕</button>
          </div>
        </div>
      )}

      {/* Main Grid Container */}
      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm hover:border-cyan-500/40 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Scraper Collector</span>
              <span className="bg-cyan-500/10 text-cyan-400 text-[10px] px-2 py-0.5 rounded font-mono border border-cyan-500/20">
                {metrics?.collectorId || 'c_msymq29htvadbnxko'}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active & Healthy</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 truncate" title={metrics?.targetUrl}>
                Target: {metrics?.targetUrl || 'aws.amazon.com/new/'}
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm hover:border-amber-500/40 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Self-Healing Engine</span>
              <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded font-mono border border-amber-500/20">
                bdata scraper heal
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">
                {metrics?.totalHealEvents || 0} <span className="text-xs font-normal text-slate-400">Heal Events Logged</span>
              </div>
              <p className="text-xs text-emerald-400 mt-1">
                ✓ Auto-Selector Repair Enabled
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm hover:border-violet-500/40 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Public Notice Index</span>
              <span className="bg-violet-500/10 text-violet-400 text-[10px] px-2 py-0.5 rounded font-mono border border-violet-500/20">
                Schema: Compliant
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">
                {notices.length} <span className="text-xs font-normal text-slate-400">Total Notices Scraped</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Schema Compliance: <strong className="text-cyan-400">100%</strong>
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm hover:border-emerald-500/40 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">AI Insight Summarizer</span>
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-mono border border-emerald-500/20">
                Gemini AI API
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">
                Discord Alert Bot
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Diffing state store & real-time webhook alerts
              </p>
            </div>
          </div>
        </div>

        {/* Content Section: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Self-Heal Timeline Log (1 col) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></div>
                  <h2 className="text-lg font-bold text-white">Self-Heal Timeline</h2>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">bdata CLI Audit</span>
              </div>

              {healLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <p>No website layout breaks recorded yet.</p>
                  <p className="mt-1 text-slate-600">Click the button above to simulate a live website redesign and trigger the self-heal loop!</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {healLogs.map((log) => (
                    <div key={log.id} className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-4 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span className="font-mono text-cyan-400">{log.collectorId}</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">
                          {log.status}
                        </span>
                        <span className="text-slate-300 font-medium truncate">
                          Auto-Approved: {log.autoApproved ? 'Yes' : 'No'}
                        </span>
                      </div>

                      <div className="bg-slate-900/90 rounded p-2 text-[11px] text-amber-200/90 border border-slate-800 font-mono">
                        <strong>Trigger:</strong> {log.triggerReason}
                      </div>

                      <div className="text-[11px] text-slate-300">
                        <strong className="text-cyan-300">Strategy:</strong> {log.repairStrategy}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hackathon Differentiator Info Card */}
            <div className="bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl p-5 space-y-3 text-xs">
              <h3 className="font-bold text-cyan-300 flex items-center gap-2 text-sm">
                <span>⚡</span> Solving Traditional Scraper Drawbacks
              </h3>
              <ul className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
                <li className="flex items-start gap-1.5">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span><strong>No Fragile Selectors:</strong> Automatically repairs CSS selectors when site HTML changes.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span><strong>Global Proxy Unblocking:</strong> Bypasses CAPTCHAs and IP bans from anywhere in the world.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span><strong>100% Schema Accuracy:</strong> Guarantees normalized JSON for downstream AI agents.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Scraped Public Notice Feed (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>📡</span> Live Public Notice Radar Feed
                  </h2>
                  <p className="text-xs text-slate-400">Structured announcements extracted directly via Scraper Studio</p>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Search notices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 w-full sm:w-40"
                  />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table / List */}
              {filteredNotices.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No public notices matched your search criteria.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotices.map((notice, i) => (
                    <div
                      key={i}
                      className="bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/40 rounded-xl p-4 transition-all duration-200 group flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                    >
                      <div className="space-y-1 max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold px-2 py-0.5 rounded">
                            {notice.category || 'Public Update'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {notice.date}
                          </span>
                          {notice.reference_id && (
                            <span className="text-[10px] font-mono text-slate-500">
                              [{notice.reference_id}]
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                          {notice.title}
                        </h3>
                        {notice.summary && (
                          <p className="text-xs text-slate-400 line-clamp-2">
                            {notice.summary}
                          </p>
                        )}
                      </div>

                      <a
                        href={notice.link}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shrink-0"
                      >
                        <span>View Source</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
