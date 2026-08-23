'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AegisRadarLogo from '@/components/AegisRadarLogo';

interface UserScrapeRecord {
  id: string;
  userId: string;
  url: string;
  pageTitle: string;
  scrapedAt: string;
  source: string;
  notices: any[];
  stats?: any;
  rawHtml?: string;
  rawHtmlLines?: number;
  rawHtmlBytes?: number;
  openGraph?: any;
  metaTags?: any;
  jsonLd?: any[];
  wafInfo?: any;
  fullMarkdown?: string;
  contentSections?: any[];
  tables?: any[];
}

interface UserHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string; email: string } | null;
  onSelectSession: (session: UserScrapeRecord) => void;
}

export default function UserHistoryDrawer({
  isOpen,
  onClose,
  user,
  onSelectSession
}: UserHistoryDrawerProps) {
  const [history, setHistory] = useState<UserScrapeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/history');
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load user history:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      fetchHistory();
    }
  }, [isOpen, user, fetchHistory]);

  if (!isOpen) return null;

  const handleDelete = async (e: React.MouseEvent, recordId: string) => {
    e.stopPropagation();
    setDeletingId(recordId);
    try {
      const res = await fetch(`/api/user/history?id=${recordId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setHistory((prev) => prev.filter((h) => h.id !== recordId));
      }
    } catch (err) {
      console.error('Failed to delete history item:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete all saved scrape records?')) return;
    try {
      const res = await fetch('/api/user/history?clearAll=true', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setHistory([]);
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const handleDownloadSession = (e: React.MouseEvent, record: UserScrapeRecord) => {
    e.stopPropagation();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(record, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    const domain = (() => {
      try { return new URL(record.url).hostname.replace(/[^a-z0-9]/gi, '-'); } catch { return 'scraped-session'; }
    })();
    a.setAttribute('download', `scrape-${domain}-${new Date(record.scrapedAt).getTime()}.json`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredHistory = history.filter((h) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      h.url.toLowerCase().includes(term) ||
      (h.pageTitle && h.pageTitle.toLowerCase().includes(term))
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex justify-end font-mono"
      onClick={onClose}
    >
      <div
        className="bg-[#030803] border-l border-emerald-500 w-full max-w-xl h-full flex flex-col shadow-[0_0_40px_rgba(34,197,94,0.2)] overflow-hidden relative text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-emerald-500/40 bg-[#050c05] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AegisRadarLogo size={32} />
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wide">My Saved Scrapes</h2>
              <p className="text-[11px] text-slate-300">
                {user ? `${user.email} · ${history.length} saved sessions` : 'Saved History'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white border border-neutral-700 hover:border-neutral-500 px-2.5 py-1 text-xs font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3.5 sm:p-4 border-b border-emerald-500/30 bg-black flex items-center gap-2">
          <input
            type="text"
            placeholder="Search saved scrapes by URL or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-[#050a05] border border-emerald-500/50 px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-400"
          />
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-500 text-red-200 text-xs font-mono transition-all shrink-0 uppercase"
              title="Clear all saved history"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-white gap-3">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent animate-spin"></div>
              <span className="text-xs uppercase font-mono">Loading saved sessions...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs space-y-2 border border-dashed border-emerald-500/30 p-6 bg-black">
              <span className="text-3xl block">📡</span>
              <p className="font-bold text-sm text-white uppercase">No saved scrapes found</p>
              <p className="text-slate-400 max-w-xs mx-auto text-[11px]">
                {searchTerm
                  ? 'No saved documents matched your search filter.'
                  : 'Every scrape you run while logged in is saved to MongoDB Atlas!'}
              </p>
            </div>
          ) : (
            filteredHistory.map((item, index) => {
              const domain = (() => {
                try { return new URL(item.url).hostname; } catch { return 'unknown'; }
              })();
              const noticeCount = item.notices?.length || item.stats?.totalNotices || 0;
              const dateStr = new Date(item.scrapedAt).toLocaleString();

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectSession(item);
                    onClose();
                  }}
                  className="bg-black border border-emerald-500/40 hover:border-emerald-400 p-4 space-y-2.5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-emerald-950 border border-emerald-500 text-emerald-300 px-1.5 py-0.2 font-mono text-[9px]">
                        [{String(index + 1).padStart(2, '0')}]
                      </span>
                      <span className="bg-[#a3e635] text-black px-2 py-0.5 font-bold">
                        📍 {domain}
                      </span>
                      {item.wafInfo?.detected && (
                        <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 px-1.5 py-0.5 font-bold">
                          🛡️ WAF
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 font-mono text-[10px]">{dateStr}</span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                    {item.pageTitle || item.url}
                  </h3>

                  <p className="text-[11px] text-emerald-300 truncate font-mono" title={item.url}>
                    {item.url}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-[11px]">
                    <div className="flex items-center gap-3 text-slate-300 font-mono text-[10px]">
                      <span>📄 <strong>{noticeCount}</strong> notices</span>
                      {item.rawHtmlBytes ? (
                        <span>💾 {(item.rawHtmlBytes / 1024).toFixed(1)} KB</span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDownloadSession(e, item)}
                        className="px-2 py-0.5 bg-neutral-900 hover:bg-emerald-500 hover:text-black text-white border border-neutral-700 font-mono text-[10px] transition-all"
                        title="Download session JSON"
                      >
                        JSON
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, item.id)}
                        disabled={deletingId === item.id}
                        className="px-2 py-0.5 bg-red-950/60 hover:bg-red-900 text-red-200 border border-red-500/60 font-mono text-[10px] transition-all disabled:opacity-50"
                        title="Delete session"
                      >
                        {deletingId === item.id ? '...' : 'Delete'}
                      </button>
                      <span className="text-emerald-400 group-hover:text-white group-hover:translate-x-0.5 transition-transform text-xs font-bold">
                        Inspect →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-emerald-500/30 bg-black text-[11px] text-slate-300 flex items-center justify-between">
          <span>💡 Click any session to reload its full DOM into the radar.</span>
        </div>
      </div>
    </div>
  );
}
