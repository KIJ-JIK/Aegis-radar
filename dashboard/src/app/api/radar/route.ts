import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getAuthUserFromRequest } from '@/lib/auth';
import { saveUserScrapeSession, getUserScrapeHistory, UserScrapeRecord } from '@/lib/db';

const ROOT_DIR = path.join(process.cwd(), '..');
const NOTICES_PATH = path.join(ROOT_DIR, 'sample-output/latest-notices.json');
const HEAL_LOGS_PATH = path.join(ROOT_DIR, 'data/heal-logs.json');
const STATE_PATH = path.join(ROOT_DIR, 'data/state.json');

function safeReadJSON(filePath: string, fallback: any) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

/**
 * GET: Returns data strictly scoped to the authenticated user.
 * - Logged-in users receive ONLY their personal saved scrapes and notices from MongoDB.
 * - Guests receive an empty/clean initial state (zero cross-user data leakage).
 */
export async function GET(req: Request) {
  const authUser = await getAuthUserFromRequest(req);
  const healLogs: any[] = safeReadJSON(HEAL_LOGS_PATH, []);
  const state = safeReadJSON(STATE_PATH, { seenIds: [], lastRun: new Date().toISOString() });

  let userNotices: any[] = [];
  let userDomains: string[] = [];
  let userHistoryCount = 0;
  let userSessions: any[] = [];

  if (authUser) {
    // 1. Authenticated User Mode: Fetch exclusively from this user's MongoDB history
    const userHistory: UserScrapeRecord[] = await getUserScrapeHistory(authUser.id);
    userHistoryCount = userHistory.length;

    const seenLinks = new Set<string>();

    userHistory.forEach((session) => {
      if (session.notices && Array.isArray(session.notices)) {
        session.notices.forEach((notice: any) => {
          if (notice.link && !seenLinks.has(notice.link)) {
            seenLinks.add(notice.link);
            userNotices.push({
              ...notice,
              source_url: session.url || notice.source_url || 'unknown',
              scraped_at: session.scrapedAt || notice.date,
              raw_html: notice.raw_html || session.rawHtml || '',
              raw_lines: notice.raw_lines || session.rawHtmlLines || 0,
              raw_bytes: notice.raw_bytes || session.rawHtmlBytes || 0,
              open_graph: notice.open_graph || session.openGraph || {},
              meta_tags: notice.meta_tags || session.metaTags || {},
              json_ld: notice.json_ld || session.jsonLd || [],
              waf_info: notice.waf_info || session.wafInfo || {},
              full_markdown: notice.full_markdown || session.fullMarkdown || '',
              content_sections: notice.content_sections || session.contentSections || [],
              session_tables: notice.session_tables || session.tables || [],
              session_stats: session.stats || notice.session_stats || {}
            });
          }
        });
      }
    });

    userNotices.sort((a, b) => new Date(b.scraped_at || 0).getTime() - new Date(a.scraped_at || 0).getTime());

    userDomains = Array.from(
      new Set(
        userNotices.map((n: any) => {
          try { return new URL(n.source_url).hostname; } catch { return 'Other'; }
        }).filter(Boolean)
      )
    );

    userSessions = userHistory.slice(0, 20).map((session) => ({
      id: session.id,
      url: session.url,
      scrapedAt: session.scrapedAt,
      pageTitle: session.pageTitle,
      source: session.source,
      noticeCount: session.notices?.length || 0,
      stats: session.stats,
      rawHtml: session.rawHtml || '',
      openGraph: session.openGraph || {},
      wafInfo: session.wafInfo || {},
      fullMarkdown: session.fullMarkdown,
      contentSections: session.contentSections,
      tables: session.tables
    }));
  }

  const metrics = {
    collectorId: process.env.BRIGHTDATA_COLLECTOR_ID || 'c_msymq29htvadbnxko',
    targetUrl: process.env.TARGET_URL || 'https://aws.amazon.com/new/',
    status: healLogs.length > 0 && healLogs[0]?.status?.includes('HEALED') ? 'SELF_HEALED_ACTIVE' : 'HEALTHY_ACTIVE',
    totalNotices: userNotices.length,
    totalScrapes: userHistoryCount,
    totalHealEvents: healLogs.length,
    lastRun: state.lastRun || new Date().toISOString(),
    schemaCompliance: userNotices.length > 0 
      ? Math.round((userNotices.filter((n: any) => n.title && n.link && n.date && n.category).length / userNotices.length) * 100) + '%' 
      : '100%'
  };

  return NextResponse.json({
    success: true,
    user: authUser,
    isGuest: !authUser,
    userHistoryCount,
    metrics,
    notices: userNotices,
    domains: userDomains,
    healLogs,
    scrapeSessions: userSessions
  });
}

/**
 * POST: Trigger a live scrape or self-heal demo.
 * - Authenticated users have their scrape saved into their personal MongoDB history.
 * - Guests receive the live scraped result in memory for ephemeral viewing (never saved).
 */
export async function POST(req: Request) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const stagedDemo = body.stagedDemo || false;
    const customUrl = body.targetUrl || process.env.TARGET_URL || 'https://aws.amazon.com/new/';

    console.log(`API Radar POST: user=${authUser?.email || 'GUEST'}, stagedDemo=${stagedDemo}, url=${customUrl}`);
    
    const flag = stagedDemo ? ' --demo-heal' : '';
    const cmd = `node agents/pipeline.js${flag}`;
    
    let output = '';
    try {
      output = execSync(cmd, { 
        cwd: ROOT_DIR, 
        encoding: 'utf-8', 
        timeout: 35000,
        env: { ...process.env, TARGET_URL: customUrl }
      });
    } catch (e: any) {
      output = e.stdout || e.message;
      console.error('Pipeline execution error:', e.message);
    }

    // Read the latest scrape session generated by the agent
    const historyPath = path.join(ROOT_DIR, 'data/scrape-history.json');
    const tempHistory: any[] = safeReadJSON(historyPath, []);
    const latestSession = tempHistory.length > 0 ? tempHistory[0] : null;

    const sessionNotices: any[] = [];
    if (latestSession && latestSession.notices && Array.isArray(latestSession.notices)) {
      latestSession.notices.forEach((notice: any) => {
        sessionNotices.push({
          ...notice,
          source_url: customUrl,
          scraped_at: latestSession.scrapedAt || new Date().toISOString(),
          raw_html: latestSession.rawHtml || '',
          raw_lines: latestSession.rawHtmlLines || latestSession.stats?.rawHtmlLines || 0,
          raw_bytes: latestSession.rawHtmlBytes || latestSession.stats?.rawHtmlBytes || 0,
          open_graph: latestSession.openGraph || {},
          meta_tags: latestSession.metaTags || {},
          json_ld: latestSession.jsonLd || [],
          waf_info: latestSession.wafInfo || {},
          full_markdown: latestSession.fullMarkdown || '',
          content_sections: latestSession.contentSections || [],
          session_tables: latestSession.tables || [],
          session_stats: latestSession.stats || {}
        });
      });
    }

    let savedRecord = null;
    let userAllNotices: any[] = sessionNotices;
    let userDomains: string[] = [];

    if (authUser && latestSession) {
      // 1. Save to this user's MongoDB history
      try {
        savedRecord = await saveUserScrapeSession(authUser.id, {
          url: customUrl,
          pageTitle: latestSession.pageTitle || 'Scraped Document Feed',
          scrapedAt: new Date().toISOString(),
          source: latestSession.source || 'aegis-scraper',
          notices: sessionNotices,
          stats: latestSession.stats || {},
          rawHtml: latestSession.rawHtml || '',
          rawHtmlLines: latestSession.rawHtmlLines || 0,
          rawHtmlBytes: latestSession.rawHtmlBytes || 0,
          openGraph: latestSession.openGraph || {},
          metaTags: latestSession.metaTags || {},
          jsonLd: latestSession.jsonLd || [],
          wafInfo: latestSession.wafInfo || {},
          fullMarkdown: latestSession.fullMarkdown || '',
          contentSections: latestSession.contentSections || [],
          tables: latestSession.tables || []
        });
        console.log(`[API Radar] 💾 Saved session to MongoDB for user ${authUser.email}`);

        // Fetch updated user notices list
        const updatedHistory = await getUserScrapeHistory(authUser.id);
        const seenLinks = new Set<string>();
        const accumulated: any[] = [];
        updatedHistory.forEach(h => {
          (h.notices || []).forEach(n => {
            if (n.link && !seenLinks.has(n.link)) {
              seenLinks.add(n.link);
              accumulated.push(n);
            }
          });
        });
        userAllNotices = accumulated;
      } catch (saveErr: any) {
        console.error('[API Radar] Error saving user history record:', saveErr);
      }
    }

    userDomains = Array.from(
      new Set(
        userAllNotices.map((n: any) => {
          try { return new URL(n.source_url).hostname; } catch { return 'Other'; }
        }).filter(Boolean)
      )
    );

    const healLogs = safeReadJSON(HEAL_LOGS_PATH, []);

    return NextResponse.json({
      success: true,
      isGuest: !authUser,
      savedToHistory: !!savedRecord,
      user: authUser,
      message: stagedDemo 
        ? 'Self-healing demo triggered! Check heal logs for results.' 
        : `Scraped ${sessionNotices.length} items from ${customUrl} (${authUser ? 'Saved to Your Personal History' : 'Instant Guest Mode — Ephemeral'})`,
      output: output.substring(0, 2000),
      notices: userAllNotices,
      domains: userDomains,
      healLogs,
      latestSession: latestSession ? {
        url: customUrl,
        pageTitle: latestSession.pageTitle,
        noticeCount: sessionNotices.length,
        stats: latestSession.stats,
        rawHtml: latestSession.rawHtml,
        openGraph: latestSession.openGraph,
        wafInfo: latestSession.wafInfo
      } : null
    });
  } catch (error: any) {
    console.error('API Radar execution failed:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
