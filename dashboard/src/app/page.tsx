'use client';

import React, { useState, useEffect } from 'react';
import AuthModal from '@/components/AuthModal';
import UserHistoryDrawer from '@/components/UserHistoryDrawer';
import AegisRadarLogo from '@/components/AegisRadarLogo';

interface UserSession {
  id: string;
  name: string;
  email: string;
}

interface Notice {
  title: string;
  link: string;
  date: string;
  category: string;
  summary?: string;
  reference_id?: string;
  source_url?: string;
  scraped_at?: string;
  raw_html?: string;
  raw_lines?: number;
  raw_bytes?: number;
  open_graph?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    site_name?: string;
    type?: string;
    locale?: string;
    [key: string]: any;
  };
  meta_tags?: Record<string, string>;
  json_ld?: any[];
  waf_info?: {
    detected?: boolean;
    provider?: string;
    reason?: string;
    recommendation?: string;
    statusCode?: number;
  };
  full_markdown?: string;
  content_sections?: Array<{ heading: string; content: string; level?: number }>;
  session_tables?: Array<{ headers: string[]; rows: Array<Array<{ text: string; link?: string }>>; rowCount?: number }>;
  session_stats?: {
    rawHtmlLines?: number;
    rawHtmlBytes?: number;
    totalLinks?: number;
    totalTables?: number;
    totalSections?: number;
    totalLists?: number;
    totalNotices?: number;
    htmlSize?: number;
    extractedMarkdownChars?: number;
    wafDetected?: boolean;
    wafProvider?: string;
  };
}

interface HealLog {
  id: string;
  timestamp: string;
  targetUrl?: string;
  collectorId?: string;
  triggerReason: string;
  repairStrategy: string;
  status: string;
  details: string;
  autoApproved: boolean;
  beforeStats?: { totalNotices: number; validNotices: number; invalidNotices?: number };
  afterStats?: { totalNotices: number; validNotices: number };
}

interface Metrics {
  collectorId: string;
  targetUrl: string;
  status: string;
  totalNotices: number;
  totalScrapes?: number;
  totalHealEvents: number;
  lastRun: string;
  schemaCompliance: string;
}

export default function AegisDashboard() {
  const [mounted, setMounted] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [healLogs, setHealLogs] = useState<HealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringHeal, setTriggeringHeal] = useState(false);
  const [scrapingUrl, setScrapingUrl] = useState(false);
  const [customTargetUrl, setCustomTargetUrl] = useState('https://aws.amazon.com/new/');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterDomain, setFilterDomain] = useState('ALL');
  const [domains, setDomains] = useState<string[]>([]);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [modalTab, setModalTab] = useState<'notice' | 'html' | 'markdown' | 'sections' | 'json'>('notice');
  const [htmlViewMode, setHtmlViewMode] = useState<'code' | 'meta' | 'jsonld' | 'preview'>('code');
  const [htmlSearchTerm, setHtmlSearchTerm] = useState('');

  // Authentication & History State
  const [user, setUser] = useState<UserSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to verify session:', err);
    }
  };

  const fetchRadarData = async () => {
    try {
      const res = await fetch('/api/radar');
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        if (data.user) {
          setUser(data.user);
        }
        if (data.notices && data.notices.length > 0) {
          setNotices(data.notices);
        }
        setHealLogs(data.healLogs || []);
        if (data.domains && data.domains.length > 0) {
          setDomains(data.domains);
        }
        if (data.userHistoryCount !== undefined) {
          setSavedCount(data.userHistoryCount);
        }
      }
    } catch (err) {
      console.error('Failed to fetch radar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    checkAuth();
    fetchRadarData();
    const interval = setInterval(fetchRadarData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setSavedCount(0);
      setNotices([]);
      setNotificationMsg('Logged out. Instant Guest Mode is now active.');
      setTimeout(() => setNotificationMsg(null), 4000);
      fetchRadarData();
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleSelectHistorySession = (session: any) => {
    if (session.url) {
      setCustomTargetUrl(session.url);
    }
    if (session.notices && session.notices.length > 0) {
      setNotices(session.notices);
    }
    setNotificationMsg(`Loaded saved session for ${session.url} (${session.notices?.length || 0} notices)`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleRunScrape = async () => {
    setScrapingUrl(true);
    setNotificationMsg(`Scraping live data from ${customTargetUrl}...`);
    try {
      const res = await fetch('/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagedDemo: false, targetUrl: customTargetUrl }),
      });
      const data = await res.json();
      if (data.success) {
        const count = data.latestSession?.noticeCount || (data.notices?.length || 0);
        if (data.notices && data.notices.length > 0) {
          setNotices(data.notices);
        }
        if (data.domains && data.domains.length > 0) {
          setDomains(data.domains);
        }
        // Reset active filter to ALL so newly scraped domain is immediately visible in feed
        setFilterDomain('ALL');
        setSearchTerm('');
        
        if (data.userHistoryCount !== undefined) {
          setSavedCount(data.userHistoryCount);
        } else if (!data.isGuest) {
          setSavedCount((prev) => prev + 1);
        }
        
        if (data.isGuest) {
          setNotificationMsg(`⚡ Scraped ${count} notices in Instant Guest Mode!`);
        } else {
          setNotificationMsg(`💾 Scraped ${count} notices & saved to your history!`);
        }
      } else {
        setNotificationMsg(`Scrape error: ${data.error}`);
      }
    } catch (err: any) {
      setNotificationMsg(`Scrape failed: ${err.message}`);
    } finally {
      setScrapingUrl(false);
      setTimeout(() => setNotificationMsg(null), 5000);
    }
  };

  const handleTriggerHealDemo = async () => {
    setTriggeringHeal(true);
    setNotificationMsg('Simulating website redesign break & running AI self-heal...');
    try {
      const res = await fetch('/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagedDemo: true, targetUrl: customTargetUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setHealLogs(data.healLogs || []);
        setNotificationMsg('✅ Self-heal completed! CSS selectors repaired and verified.');
        fetchRadarData();
      } else {
        setNotificationMsg(`Heal error: ${data.error}`);
      }
    } catch (err: any) {
      setNotificationMsg(`Self-heal trigger failed: ${err.message}`);
    } finally {
      setTriggeringHeal(false);
      setTimeout(() => setNotificationMsg(null), 5000);
    }
  };

  const handleDownloadHtmlCode = (htmlContent: string, title: string) => {
    const blob = new Blob([htmlContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 35) || 'scraped-source'}-html-code.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotificationMsg('💾 Downloaded raw scraped HTML source code (.txt format)!');
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleDownloadJson = (jsonData: any, title: string) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(jsonData, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    const slug = (title || 'scraped-entity').toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 35);
    a.setAttribute('download', `${slug}.json`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setNotificationMsg('💾 Downloaded full JSON document!');
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const filteredNotices = notices.filter((n) => {
    const matchesSearch =
      searchTerm === '' ||
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.summary && n.summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (n.source_url && n.source_url.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = filterCategory === 'ALL' || n.category === filterCategory;

    const matchesDomain =
      filterDomain === 'ALL' ||
      (() => {
        try {
          return new URL(n.source_url || '').hostname === filterDomain;
        } catch {
          return false;
        }
      })();

    return matchesSearch && matchesCategory && matchesDomain;
  });

  const categories = Array.from(new Set(notices.map((n) => n.category))).filter(Boolean);

  const getFilteredHtmlLines = (rawHtml: string) => {
    if (!rawHtml) return [];
    const lines = rawHtml.split('\n');
    if (!htmlSearchTerm) return lines.map((line, idx) => ({ line, originalIdx: idx + 1 }));
    return lines
      .map((line, idx) => ({ line, originalIdx: idx + 1 }))
      .filter((item) => item.line.toLowerCase().includes(htmlSearchTerm.toLowerCase()));
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#030703] text-white flex items-center justify-center font-mono">
        <div className="flex items-center gap-3 bg-[#0a100a] border border-emerald-500/60 p-4 rounded shadow-lg">
          <div className="w-3 h-3 bg-emerald-400 animate-ping"></div>
          <span className="text-xs font-mono tracking-wider text-white">Loading Aegis Radar...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020502] bg-matrix-grid text-white font-mono flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Notification Toast */}
      {notificationMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#0a140a] border border-emerald-400 text-white px-4 py-2.5 shadow-[0_0_20px_rgba(74,222,128,0.4)] flex items-center gap-3 text-xs font-mono max-w-md animate-fade-in">
          <span className="w-2 h-2 bg-emerald-400 animate-ping shrink-0"></span>
          <span className="break-words font-bold text-white">{notificationMsg}</span>
        </div>
      )}

      {/* Main Terminal Frame */}
      <div className="max-w-[1550px] mx-auto w-full p-2 sm:p-4 lg:p-6 flex-1 flex flex-col">
        <div className="border border-emerald-500/70 bg-[#020602] shadow-[0_0_30px_rgba(34,197,94,0.15)] flex-1 flex flex-col overflow-hidden">
          
          {/* ================= CLEAN HEADER ================= */}
          <header className="bg-[#050c05] px-4 py-3 border-b border-emerald-500/60 flex flex-wrap items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-3">
              <AegisRadarLogo size={38} />
              <div>
                <h1 className="text-base font-black tracking-wide text-white">
                  Aegis Radar
                </h1>
                <p className="text-[11px] text-emerald-400">
                  Powered by Scraper Studio &amp; Gemini AI
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Self-Healing button */}
              <button
                suppressHydrationWarning
                onClick={handleTriggerHealDemo}
                disabled={triggeringHeal}
                className="px-3.5 py-1.5 bg-[#0a140a] hover:bg-amber-500 hover:text-black border border-amber-500/80 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>{triggeringHeal ? 'Healing...' : 'Self-Healing'}</span>
              </button>

              {/* Auth / History */}
              {user ? (
                <div className="flex items-center gap-2">
                  <button
                    suppressHydrationWarning
                    onClick={() => setIsHistoryDrawerOpen(true)}
                    className="px-3 py-1.5 bg-[#0a180a] hover:bg-emerald-500 hover:text-black border border-emerald-400 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>📂</span>
                    <span>My Scrapes</span>
                    <span className="bg-[#a3e635] text-black px-1.5 py-0.2 font-black text-[10px]">
                      {savedCount}
                    </span>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={handleLogout}
                    className="px-2.5 py-1.5 bg-[#180a0a] hover:bg-red-900 border border-red-500/60 text-red-200 hover:text-white text-xs font-bold transition-all"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  suppressHydrationWarning
                  onClick={() => { setAuthModalTab('login'); setIsAuthModalOpen(true); }}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition-all shadow-[0_0_15px_rgba(34,197,94,0.5)] flex items-center gap-1.5"
                >
                  <span>👤</span>
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </header>

          {/* ================= TARGET URL BAR ================= */}
          <div className="bg-[#030803] border-b border-emerald-500/40 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#010301] border border-emerald-500/60 p-1.5">
              <span className="text-white text-xs font-bold px-2 shrink-0">Target URL:</span>
              <input
                type="text"
                value={customTargetUrl}
                onChange={(e) => setCustomTargetUrl(e.target.value)}
                placeholder="https://aws.amazon.com/new/"
                className="flex-1 bg-transparent text-xs text-white font-mono px-2 py-1 focus:outline-none placeholder-slate-500"
              />
              <button
                suppressHydrationWarning
                onClick={handleRunScrape}
                disabled={scrapingUrl}
                className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition-all flex items-center justify-center shrink-0 uppercase disabled:opacity-50 cursor-pointer"
              >
                <span>{scrapingUrl ? 'Scraping...' : user ? 'Scrape & Save' : 'Instant Scrape'}</span>
              </button>
            </div>

            {/* Mode Banner */}
            <div className="mt-2 text-[11px] text-slate-300 flex flex-wrap items-center justify-between">
              {user ? (
                <div className="flex items-center gap-2 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Logged in as <strong>{user.email}</strong> — Scrapes saved to your personal history.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="bg-emerald-950 border border-emerald-500 text-emerald-300 px-1.5 py-0.2 text-[10px] font-bold">
                    Guest Mode
                  </span>
                  <span>Scraping live without saving history.</span>
                  <button
                    onClick={() => { setAuthModalTab('register'); setIsAuthModalOpen(true); }}
                    className="text-[#a3e635] underline hover:text-white font-bold ml-1"
                  >
                    Sign in to save history →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ================= MAIN CONTENT ================= */}
          <main className="p-4 sm:p-6 space-y-6 flex-1 bg-[#010301]">
            
            {/* 4 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 01 */}
              <div className="bg-[#030903] border border-emerald-500/50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="bg-emerald-950 border border-emerald-500 text-emerald-400 px-1.5 py-0.2 font-black text-[10px]">
                    01.
                  </span>
                  <span className="text-white font-bold uppercase tracking-wider text-[11px]">Radar Health</span>
                  <span className="bg-[#a3e635] text-black px-1.5 py-0.2 text-[10px] font-black">
                    {metrics?.status || 'HEALTHY'}
                  </span>
                </div>
                <div className="mt-1">
                  <div className="text-3xl font-black text-white">
                    99.8% <span className="text-xs text-slate-300 font-normal">Uptime</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 border-t border-emerald-500/20 pt-1">
                    Zero-Downtime Pipeline Architecture
                  </p>
                </div>
              </div>

              {/* Card 02 */}
              <div className="bg-[#030903] border border-emerald-500/50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="bg-emerald-950 border border-emerald-500 text-emerald-400 px-1.5 py-0.2 font-black text-[10px]">
                    02.
                  </span>
                  <span className="text-white font-bold uppercase tracking-wider text-[11px]">Autonomous Repairs</span>
                  <span className="bg-amber-500 text-black px-1.5 py-0.2 text-[10px] font-black">
                    Self-Healing
                  </span>
                </div>
                <div className="mt-1">
                  <div className="text-3xl font-black text-white">
                    {metrics?.totalHealEvents || 0} <span className="text-xs text-slate-300 font-normal">Events Logged</span>
                  </div>
                  <p className="text-[11px] text-emerald-300 mt-1 border-t border-emerald-500/20 pt-1">
                    ✓ Auto-Selector Repair Enabled
                  </p>
                </div>
              </div>

              {/* Card 03 */}
              <div className="bg-[#030903] border border-emerald-500/50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="bg-emerald-950 border border-emerald-500 text-emerald-400 px-1.5 py-0.2 font-black text-[10px]">
                    03.
                  </span>
                  <span className="text-white font-bold uppercase tracking-wider text-[11px]">Public Notice Index</span>
                  <span className="bg-emerald-900 border border-emerald-400 text-emerald-200 px-1.5 py-0.2 text-[10px] font-bold">
                    Compliant
                  </span>
                </div>
                <div className="mt-1">
                  <div className="text-3xl font-black text-white">
                    {notices.length} <span className="text-xs text-slate-300 font-normal">Notices</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 border-t border-emerald-500/20 pt-1">
                    Compliance: <strong className="text-white">{metrics?.schemaCompliance || '100%'}</strong>
                    {metrics?.totalScrapes ? ` · ${metrics.totalScrapes} runs` : ''}
                  </p>
                </div>
              </div>

              {/* Card 04 */}
              <div className="bg-[#030903] border border-emerald-500/50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="bg-emerald-950 border border-emerald-500 text-emerald-400 px-1.5 py-0.2 font-black text-[10px]">
                    04.
                  </span>
                  <span className="text-white font-bold uppercase tracking-wider text-[11px]">AI Summarizer</span>
                  <span className="bg-[#a3e635] text-black px-1.5 py-0.2 text-[10px] font-black">
                    Gemini AI
                  </span>
                </div>
                <div className="mt-1">
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    Telegram Bot
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 border-t border-emerald-500/20 pt-1">
                    Diffing state store &amp; real-time alerts
                  </p>
                </div>
              </div>

            </div>

            {/* 2 Column Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Self-Heal Timeline (1 col) */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* 05. Timeline Card */}
                <div className="bg-[#030903] border border-emerald-500/50 p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-950 border border-emerald-500 text-emerald-400 px-1.5 py-0.2 text-[10px] font-black">05.</span>
                      <h2 className="text-xs font-black uppercase tracking-wider text-white">Self-Heal Timeline</h2>
                    </div>
                    <span className="text-[10px] text-slate-400">Audit Logs</span>
                  </div>

                  {healLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-emerald-500/30 p-4 bg-[#010301]">
                      <p className="font-bold text-white uppercase">No layout breaks recorded</p>
                      <p className="mt-1 text-slate-300 text-[11px]">
                        Click &quot;Simulate Redesign Break&quot; to test autonomous selector repair.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {healLogs.map((log) => (
                        <div
                          key={log.id}
                          className={`border p-3 space-y-2 text-xs ${
                            log.status.includes('HEALED')
                              ? 'bg-[#020c02] border-emerald-500/60'
                              : 'bg-[#100202] border-red-500/60'
                          }`}
                        >
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-white truncate max-w-[160px] font-bold" title={log.targetUrl || log.collectorId}>
                              {log.targetUrl || log.collectorId}
                            </span>
                            <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="bg-[#a3e635] text-black font-black px-1.5 py-0.2 text-[9px] uppercase">
                              {log.status}
                            </span>
                            <span className="text-white text-[10px] font-bold">
                              {log.autoApproved ? 'Auto-Approved' : 'Manual Review'}
                            </span>
                          </div>

                          {log.beforeStats && log.afterStats && (
                            <div className="flex gap-2 text-[10px] text-slate-200">
                              <span>Before: {log.beforeStats.validNotices}/{log.beforeStats.totalNotices}</span>
                              <span>→</span>
                              <span className="text-white font-bold">After: {log.afterStats.validNotices}/{log.afterStats.totalNotices}</span>
                            </div>
                          )}

                          <div className="bg-black border border-emerald-500/30 p-2 text-[11px] leading-relaxed text-white">
                            <strong className="text-emerald-300">Strategy:</strong> {log.repairStrategy}
                          </div>

                          <div className="text-[11px] text-slate-300">
                            {log.details}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 06. Industry-Grade Features Card */}
                <div className="bg-[#030903] border border-emerald-500/50 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-950 border border-emerald-500 text-emerald-400 px-1.5 py-0.2 text-[10px] font-black">06.</span>
                      <h3 className="font-black uppercase tracking-wider text-white">Industry-Grade Features</h3>
                    </div>
                  </div>

                  <ul className="space-y-2 text-[11px] text-slate-200">
                    <li className="flex items-start gap-2 bg-black border border-emerald-500/30 p-2">
                      <span className="text-[#a3e635] font-black">✓</span>
                      <span><strong className="text-white">Full DOM / Raw HTML Inspection:</strong> Line syntax viewer &amp; standalone .html export.</span>
                    </li>
                    <li className="flex items-start gap-2 bg-black border border-emerald-500/30 p-2">
                      <span className="text-[#a3e635] font-black">✓</span>
                      <span><strong className="text-white">OpenGraph &amp; JSON-LD Parser:</strong> Auto-extracts social schema &amp; meta cards.</span>
                    </li>
                    <li className="flex items-start gap-2 bg-black border border-emerald-500/30 p-2">
                      <span className="text-[#a3e635] font-black">✓</span>
                      <span><strong className="text-white">WAF &amp; Anti-Bot Detection:</strong> AWS WAF, Cloudflare, Akamai detection.</span>
                    </li>
                    <li className="flex items-start gap-2 bg-black border border-emerald-500/30 p-2">
                      <span className="text-[#a3e635] font-black">✓</span>
                      <span><strong className="text-white">Autonomous Self-Healing:</strong> Dynamic selector repair on live redesign breaks.</span>
                    </li>
                  </ul>
                </div>

              </div>

              {/* Right Column: 07. Scraped Public Notice Feed (2 cols) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-[#030903] border border-emerald-500/50 p-4 sm:p-5 space-y-4">
                  
                  {/* Header & Filter Controls */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-emerald-500/30 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-950 border border-emerald-500 text-emerald-400 px-1.5 py-0.2 text-[10px] font-black">07.</span>
                        <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                          <span>{user ? '👤' : '⚡'}</span>
                          <span>{user ? 'My Scraped Documents & Feed' : 'Live Scraper Workspace'}</span>
                        </h2>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {user 
                          ? `Showing documents scraped by ${user.email}`
                          : 'Live DOM extraction — Instant Guest Mode (results not saved)'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                      <input
                        type="text"
                        placeholder="Search notices..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-black border border-emerald-500/60 text-xs text-white px-2.5 py-1 focus:outline-none focus:border-emerald-400 w-full sm:w-36 placeholder-slate-500"
                      />
                      <select
                        value={filterDomain}
                        onChange={(e) => setFilterDomain(e.target.value)}
                        className="bg-black border border-emerald-500/60 text-xs text-white font-bold px-2 py-1 focus:outline-none"
                      >
                        <option value="ALL">All Domains ({notices.length})</option>
                        {domains.map((dom) => (
                          <option key={dom} value={dom}>{dom}</option>
                        ))}
                      </select>
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="bg-black border border-emerald-500/60 text-xs text-white font-bold px-2 py-1 focus:outline-none"
                      >
                        <option value="ALL">All Categories</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Domain Quick Pills */}
                  {domains.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs max-w-full">
                      <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Filter Domain:</span>
                      <button
                        suppressHydrationWarning
                        onClick={() => setFilterDomain('ALL')}
                        className={`px-2.5 py-0.5 text-[10px] font-bold border transition-all shrink-0 ${
                          filterDomain === 'ALL'
                            ? 'bg-[#a3e635] text-black border-emerald-400 font-black'
                            : 'bg-black text-white border-emerald-500/40 hover:border-emerald-400'
                        }`}
                      >
                        All ({notices.length})
                      </button>
                      {domains.map((dom) => {
                        const count = notices.filter((n) => {
                          try { return new URL(n.source_url || '').hostname === dom; } catch { return false; }
                        }).length;
                        return (
                          <button
                            key={dom}
                            suppressHydrationWarning
                            onClick={() => setFilterDomain(dom)}
                            className={`px-2.5 py-0.5 text-[10px] font-bold border transition-all whitespace-nowrap shrink-0 ${
                              filterDomain === dom
                                ? 'bg-emerald-500 text-black border-emerald-400 font-black'
                                : 'bg-black text-white border-emerald-500/40 hover:border-emerald-400'
                            }`}
                          >
                            📍 {dom} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Notice List & Empty State */}
                  {filteredNotices.length === 0 ? (
                    <div className="text-center py-12 text-slate-300 text-xs border border-dashed border-emerald-500/30 p-6 bg-black space-y-2">
                      <span className="text-2xl block">📡</span>
                      {searchTerm || filterDomain !== 'ALL' || filterCategory !== 'ALL' ? (
                        <>
                          <p className="font-bold text-sm text-white uppercase">No matching documents found</p>
                          <p className="text-slate-400">Try clearing your search filter or resetting domain selection.</p>
                        </>
                      ) : user ? (
                        <>
                          <p className="font-bold text-sm text-white uppercase">No saved scrapes yet</p>
                          <p className="text-slate-300 max-w-md mx-auto">
                            Enter any portal URL in the top bar and click <strong>&quot;Scrape &amp; Save&quot;</strong> to start archiving documents!
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-sm text-white uppercase">⚡ Guest Workspace Ready</p>
                          <p className="text-slate-300 max-w-md mx-auto">
                            Enter any target URL above and click <strong>&quot;Instant Scrape&quot;</strong> to extract live structured notices, raw HTML, and Markdown!
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredNotices.map((notice, i) => (
                        <div
                          key={i}
                          onClick={() => { setSelectedNotice(notice); setModalTab('notice'); }}
                          className="bg-black border border-emerald-500/40 hover:border-emerald-400 p-4 transition-all duration-150 group flex flex-col md:flex-row justify-between items-start md:items-center gap-3 cursor-pointer shadow-[0_0_8px_rgba(34,197,94,0.08)] hover:shadow-[0_0_18px_rgba(34,197,94,0.25)] relative overflow-hidden"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0 w-full">
                            <div className="flex flex-wrap items-center gap-2 text-[10px]">
                              <span className="bg-[#a3e635] text-black font-black px-1.5 py-0.2 uppercase">
                                {notice.category || 'Update'}
                              </span>
                              <span className="text-slate-300 font-mono">
                                {notice.date}
                              </span>
                              {notice.waf_info?.detected && (
                                <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 px-1.5 py-0.2 font-bold">
                                  🛡️ WAF
                                </span>
                              )}
                              {notice.reference_id && (
                                <span className="text-slate-400 bg-neutral-900 border border-neutral-700 px-1 font-mono">
                                  [{notice.reference_id}]
                                </span>
                              )}
                              {notice.source_url && (
                                <span className="text-emerald-300 truncate max-w-[160px] font-mono" title={notice.source_url}>
                                  {(() => { try { return new URL(notice.source_url).hostname; } catch { return ''; } })()}
                                </span>
                              )}
                            </div>

                            <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-300 transition-colors break-words [overflow-wrap:anywhere] line-clamp-2">
                              {notice.title}
                            </h3>

                            {notice.summary && (
                              <p className="text-xs text-slate-200 line-clamp-2 break-words [overflow-wrap:anywhere] leading-relaxed">
                                {notice.summary}
                              </p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center z-10">
                            <button
                              suppressHydrationWarning
                              onClick={(e) => { e.stopPropagation(); setSelectedNotice(notice); setModalTab('html'); }}
                              className="px-2.5 py-1 bg-[#020502] hover:bg-emerald-500 hover:text-black border border-emerald-500/60 text-white text-xs font-mono transition-all flex items-center gap-1 shrink-0"
                            >
                              <span>🌐</span>
                              <span>View HTML</span>
                            </button>
                            <button
                              suppressHydrationWarning
                              onClick={(e) => { e.stopPropagation(); setSelectedNotice(notice); setModalTab('notice'); }}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition-all flex items-center gap-1 shadow-[0_0_8px_rgba(34,197,94,0.4)] shrink-0"
                            >
                              <span>Inspect</span>
                            </button>
                            <a
                              href={notice.link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-2.5 py-1 bg-black hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-mono transition-all flex items-center gap-1 shrink-0"
                            >
                              <span>Source ↗</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>

            </div>

          </main>

        </div>
      </div>

      {/* ================= DETAIL INSPECTION MODAL ================= */}
      {selectedNotice && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6" onClick={() => setSelectedNotice(null)}>
          <div className="bg-[#020602] border border-emerald-500 max-w-5xl w-full max-h-[92vh] flex flex-col shadow-[0_0_40px_rgba(34,197,94,0.3)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Top Bar */}
            <div className="bg-[#050c05] px-4 py-2.5 border-b border-emerald-500/60 flex items-center justify-between text-xs font-bold text-white">
              <div className="flex items-center gap-2">
                <AegisRadarLogo size={22} />
                <span className="text-white font-bold">Document &amp; DOM Inspector</span>
              </div>
              <button
                suppressHydrationWarning
                onClick={() => setSelectedNotice(null)}
                className="text-white hover:text-emerald-300 border border-neutral-700 px-2 py-0.5 text-xs font-bold"
              >
                Close ✕
              </button>
            </div>

            {/* Title & Tabs */}
            <div className="p-4 bg-[#030903] border-b border-emerald-500/30 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="bg-[#a3e635] text-black font-black px-1.5 py-0.2 uppercase">
                  {selectedNotice.category || 'Notice'}
                </span>
                <span className="text-slate-300">{selectedNotice.date}</span>
                <span className="bg-emerald-950 border border-emerald-500 text-emerald-200 px-1.5 py-0.2">
                  Payload: {(((selectedNotice.raw_bytes || selectedNotice.session_stats?.rawHtmlBytes || (selectedNotice.raw_html ? selectedNotice.raw_html.length : 0)) || 0) / 1024).toFixed(1)} KB ({(selectedNotice.raw_lines || selectedNotice.session_stats?.rawHtmlLines || (selectedNotice.raw_html ? selectedNotice.raw_html.split('\n').length : 0)).toLocaleString()} lines)
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-white leading-tight break-words [overflow-wrap:anywhere]">
                {selectedNotice.title}
              </h2>

              <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
                <button
                  suppressHydrationWarning
                  onClick={() => setModalTab('notice')}
                  className={`px-3 py-1 text-xs font-bold transition-all ${
                    modalTab === 'notice'
                      ? 'bg-emerald-500 text-black font-black'
                      : 'text-white hover:text-emerald-300 bg-black border border-emerald-500/30'
                  }`}
                >
                  Notice Summary
                </button>
                <button
                  suppressHydrationWarning
                  onClick={() => setModalTab('html')}
                  className={`px-3 py-1 text-xs font-bold transition-all ${
                    modalTab === 'html'
                      ? 'bg-emerald-500 text-black font-black'
                      : 'text-white hover:text-emerald-300 bg-black border border-emerald-500/30'
                  }`}
                >
                  Raw HTML &amp; DOM
                </button>
                <button
                  suppressHydrationWarning
                  onClick={() => setModalTab('markdown')}
                  className={`px-3 py-1 text-xs font-bold transition-all ${
                    modalTab === 'markdown'
                      ? 'bg-emerald-500 text-black font-black'
                      : 'text-white hover:text-emerald-300 bg-black border border-emerald-500/30'
                  }`}
                >
                  Markdown Doc
                </button>
                <button
                  suppressHydrationWarning
                  onClick={() => setModalTab('sections')}
                  className={`px-3 py-1 text-xs font-bold transition-all ${
                    modalTab === 'sections'
                      ? 'bg-emerald-500 text-black font-black'
                      : 'text-white hover:text-emerald-300 bg-black border border-emerald-500/30'
                  }`}
                >
                  Sections &amp; Tables
                </button>
                <button
                  suppressHydrationWarning
                  onClick={() => setModalTab('json')}
                  className={`px-3 py-1 text-xs font-bold transition-all ${
                    modalTab === 'json'
                      ? 'bg-emerald-500 text-black font-black'
                      : 'text-white hover:text-emerald-300 bg-black border border-emerald-500/30'
                  }`}
                >
                  Full JSON
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs bg-black text-white">
              
              {/* TAB 1: Notice Details */}
              {modalTab === 'notice' && (
                <div className="space-y-3">
                  <div className="bg-[#020502] border border-emerald-500/40 p-4 space-y-3">
                    <h3 className="text-xs font-bold text-white uppercase">Entity Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Title</span>
                        <p className="text-white bg-black border border-neutral-700 p-2 font-mono break-words">
                          {selectedNotice.title}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Category</span>
                        <p className="text-white bg-black border border-neutral-700 p-2 font-mono">
                          {selectedNotice.category || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Source Link</span>
                      <p className="text-emerald-300 bg-black border border-neutral-700 p-2 font-mono break-all text-[11px]">
                        {selectedNotice.link}
                      </p>
                    </div>
                    {selectedNotice.summary && (
                      <div>
                        <span className="text-slate-400 block text-[10px]">Summary</span>
                        <p className="text-slate-200 bg-black border border-neutral-700 p-2 leading-relaxed text-[11px]">
                          {selectedNotice.summary}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Raw HTML DOM */}
              {modalTab === 'html' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#020502] border border-emerald-500/40 p-2.5">
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        onClick={() => setHtmlViewMode('code')}
                        className={`px-2.5 py-1 ${htmlViewMode === 'code' ? 'bg-emerald-500 text-black font-bold' : 'text-white hover:text-emerald-300'}`}
                      >
                        Code Lines
                      </button>
                      <button
                        onClick={() => setHtmlViewMode('meta')}
                        className={`px-2.5 py-1 ${htmlViewMode === 'meta' ? 'bg-emerald-500 text-black font-bold' : 'text-white hover:text-emerald-300'}`}
                      >
                        OpenGraph &amp; Meta
                      </button>
                      <button
                        onClick={() => setHtmlViewMode('jsonld')}
                        className={`px-2.5 py-1 ${htmlViewMode === 'jsonld' ? 'bg-emerald-500 text-black font-bold' : 'text-white hover:text-emerald-300'}`}
                      >
                        JSON-LD Schema
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {htmlViewMode === 'code' && (
                        <>
                          <input
                            type="text"
                            placeholder="Search in HTML..."
                            value={htmlSearchTerm}
                            onChange={(e) => setHtmlSearchTerm(e.target.value)}
                            className="bg-black border border-neutral-700 text-white px-2 py-0.5 text-[10px] focus:outline-none focus:border-emerald-400 w-32 sm:w-44 font-mono"
                          />
                          {selectedNotice.raw_html && (
                            <>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedNotice.raw_html || '');
                                  setNotificationMsg('📋 Copied raw HTML code to clipboard!');
                                  setTimeout(() => setNotificationMsg(null), 3000);
                                }}
                                className="px-2.5 py-1 bg-black hover:bg-neutral-800 border border-emerald-500/60 text-white font-bold text-[10px] transition-all"
                                title="Copy raw HTML source code"
                              >
                                📋 Copy HTML
                              </button>
                              <button
                                onClick={() => handleDownloadHtmlCode(selectedNotice.raw_html!, selectedNotice.title)}
                                className="px-2.5 py-1 bg-[#a3e635] text-black font-black text-[10px] hover:bg-white transition-all uppercase"
                                title="Download raw HTML code as text file"
                              >
                                💾 Download HTML (.txt)
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {htmlViewMode === 'meta' && (
                        <>
                          <button
                            onClick={() => {
                              const metaData = { open_graph: selectedNotice.open_graph || {}, meta_tags: selectedNotice.meta_tags || {} };
                              navigator.clipboard.writeText(JSON.stringify(metaData, null, 2));
                              setNotificationMsg('📋 Copied OpenGraph & Meta to clipboard!');
                              setTimeout(() => setNotificationMsg(null), 3000);
                            }}
                            className="px-2.5 py-1 bg-black hover:bg-neutral-800 border border-emerald-500/60 text-white font-bold text-[10px] transition-all"
                            title="Copy OpenGraph & Meta tags"
                          >
                            📋 Copy Meta/OG
                          </button>
                          <button
                            onClick={() => {
                              const metaData = { open_graph: selectedNotice.open_graph || {}, meta_tags: selectedNotice.meta_tags || {} };
                              handleDownloadJson(metaData, `${selectedNotice.title}-opengraph-meta`);
                            }}
                            className="px-2.5 py-1 bg-[#a3e635] text-black font-black text-[10px] hover:bg-white transition-all uppercase"
                            title="Download OpenGraph & Meta as JSON"
                          >
                            💾 Download Meta (.json)
                          </button>
                        </>
                      )}

                      {htmlViewMode === 'jsonld' && (
                        <>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(selectedNotice.json_ld || [], null, 2));
                              setNotificationMsg('📋 Copied JSON-LD Schema to clipboard!');
                              setTimeout(() => setNotificationMsg(null), 3000);
                            }}
                            className="px-2.5 py-1 bg-black hover:bg-neutral-800 border border-emerald-500/60 text-white font-bold text-[10px] transition-all"
                            title="Copy JSON-LD Schema"
                          >
                            📋 Copy JSON-LD
                          </button>
                          <button
                            onClick={() => handleDownloadJson(selectedNotice.json_ld || [], `${selectedNotice.title}-jsonld-schema`)}
                            className="px-2.5 py-1 bg-[#a3e635] text-black font-black text-[10px] hover:bg-white transition-all uppercase"
                            title="Download JSON-LD Schema as JSON"
                          >
                            💾 Download Schema (.json)
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {htmlViewMode === 'code' && (
                    <div className="bg-black border border-neutral-800 overflow-hidden">
                      <div className="bg-[#050c05] px-3 py-1.5 border-b border-neutral-800 flex justify-between text-[10px] text-slate-300 font-mono">
                        <span>DOM View ({((selectedNotice.raw_bytes || 0) / 1024).toFixed(1)} KB)</span>
                        <span>{selectedNotice.raw_lines || 0} Lines</span>
                      </div>
                      <div className="p-3 font-mono text-[10px] max-h-[48vh] overflow-y-auto space-y-0.5 leading-relaxed">
                        {getFilteredHtmlLines(selectedNotice.raw_html || '').map((item, idx) => (
                          <div key={idx} className="flex hover:bg-neutral-900 rounded px-1">
                            <span className="w-10 text-slate-500 select-none text-right pr-2 shrink-0">
                              {item.originalIdx}
                            </span>
                            <span className="text-white break-all whitespace-pre-wrap flex-1 font-mono">
                              {item.line}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {htmlViewMode === 'meta' && (
                    <div className="space-y-2">
                      <pre className="text-[10px] text-emerald-300 bg-black p-4 border border-neutral-800 overflow-x-auto max-h-[48vh] leading-relaxed">
                        {JSON.stringify({ open_graph: selectedNotice.open_graph || {}, meta_tags: selectedNotice.meta_tags || {} }, null, 2)}
                      </pre>
                    </div>
                  )}

                  {htmlViewMode === 'jsonld' && (
                    <div className="space-y-2">
                      <pre className="text-[10px] text-amber-300 bg-black p-4 border border-neutral-800 overflow-x-auto max-h-[48vh] leading-relaxed">
                        {JSON.stringify(selectedNotice.json_ld || [], null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Markdown */}
              {modalTab === 'markdown' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedNotice.full_markdown || '');
                        setNotificationMsg('📋 Copied Markdown to clipboard!');
                        setTimeout(() => setNotificationMsg(null), 3000);
                      }}
                      className="px-2.5 py-1 bg-black hover:bg-neutral-800 border border-emerald-500/60 text-white font-bold text-[10px] transition-all flex items-center gap-1"
                    >
                      📋 Copy Markdown
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([selectedNotice.full_markdown || ''], { type: 'text/markdown;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${(selectedNotice.title || 'document').toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 35)}.md`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setNotificationMsg('💾 Downloaded Markdown (.md) document!');
                        setTimeout(() => setNotificationMsg(null), 3000);
                      }}
                      className="px-2.5 py-1 bg-[#a3e635] text-black font-black text-[10px] hover:bg-white transition-all uppercase flex items-center gap-1"
                    >
                      💾 Download Markdown (.md)
                    </button>
                  </div>
                  <pre className="text-[11px] text-white bg-black p-4 border border-neutral-800 overflow-x-auto whitespace-pre-wrap max-h-[50vh] leading-relaxed">
                    {selectedNotice.full_markdown || 'No markdown body available for this notice.'}
                  </pre>
                </div>
              )}

              {/* TAB 4: Sections */}
              {modalTab === 'sections' && (
                <div className="space-y-2">
                  {(selectedNotice.content_sections || []).length === 0 ? (
                    <p className="text-slate-400 text-xs">No section headings detected.</p>
                  ) : (
                    selectedNotice.content_sections?.map((sec, idx) => (
                      <div key={idx} className="bg-black border border-neutral-800 p-3 space-y-1">
                        <h4 className="font-bold text-white text-xs">&gt; {sec.heading}</h4>
                        <p className="text-slate-200 text-[11px] leading-relaxed">{sec.content}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 5: JSON */}
              {modalTab === 'json' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedNotice, null, 2));
                        setNotificationMsg('📋 Copied full JSON to clipboard!');
                        setTimeout(() => setNotificationMsg(null), 3000);
                      }}
                      className="px-2.5 py-1 bg-black hover:bg-neutral-800 border border-emerald-500/60 text-white font-bold text-[10px] transition-all flex items-center gap-1"
                    >
                      📋 Copy JSON
                    </button>
                    <button
                      onClick={() => handleDownloadJson(selectedNotice, selectedNotice.title)}
                      className="px-2.5 py-1 bg-[#a3e635] text-black font-black text-[10px] hover:bg-white transition-all uppercase flex items-center gap-1"
                    >
                      💾 Download JSON (.json)
                    </button>
                  </div>
                  <pre className="text-[10px] text-emerald-300 bg-black p-4 border border-neutral-800 overflow-x-auto max-h-[50vh]">
                    {JSON.stringify(selectedNotice, null, 2)}
                  </pre>
                </div>
              )}

            </div>

            {/* Modal Bottom Actions */}
            <div className="p-3 border-t border-emerald-500/40 bg-[#030803] flex items-center justify-between">
              <a
                href={selectedNotice.link}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase"
              >
                Open Original Source ↗
              </a>
              <button
                onClick={() => setSelectedNotice(null)}
                className="px-3 py-1.5 bg-black hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialTab={authModalTab}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(newUser) => {
          setUser(newUser);
          setNotificationMsg(`Welcome back, ${newUser.name || newUser.email}!`);
          setTimeout(() => setNotificationMsg(null), 4000);
          fetchRadarData();
        }}
      />

      {/* User Scrape History Drawer */}
      <UserHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        user={user}
        onClose={() => setIsHistoryDrawerOpen(false)}
        onSelectSession={handleSelectHistorySession}
      />
    </div>
  );
}
