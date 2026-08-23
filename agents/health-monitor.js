const fs = require('fs');
const path = require('path');
require('dotenv').config();

const HEAL_LOGS_PATH = path.join(__dirname, '../data/heal-logs.json');
const SCHEMA_PATH = path.join(__dirname, '../scraper/schema.json');

/**
 * Ensures data directory exists
 */
function ensureDataDir() {
  const dir = path.dirname(HEAL_LOGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(HEAL_LOGS_PATH)) {
    fs.writeFileSync(HEAL_LOGS_PATH, JSON.stringify([], null, 2));
  }
}

/**
 * Reads existing heal logs
 */
function getHealLogs() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(HEAL_LOGS_PATH, 'utf-8'));
}

/**
 * Append a heal event entry to log file
 */
function recordHealEvent(event) {
  const logs = getHealLogs();
  logs.unshift(event); // recent first
  // Cap at 50 heal events
  if (logs.length > 50) logs.length = 50;
  fs.writeFileSync(HEAL_LOGS_PATH, JSON.stringify(logs, null, 2));
  console.log(`[HealthMonitor] 📝 Logged heal event: ID=${event.id} | Status=${event.status}`);
}

/**
 * Validates dataset quality against expected schema
 * Checks that required fields are present and non-empty
 * @param {Array<object>} records 
 * @returns {object} validation result with isValid, issues, stats
 */
function validateScrapedDataset(records) {
  const issues = [];
  
  if (!Array.isArray(records) || records.length === 0) {
    return {
      isValid: false,
      issues: ['Empty or non-array scraped response received'],
      invalidCount: 0,
      totalCount: 0,
      failureRate: 1.0,
      validRecords: []
    };
  }

  let invalidCount = 0;
  const validRecords = [];

  records.forEach((rec, idx) => {
    const missing = [];
    if (!rec.title || typeof rec.title !== 'string' || rec.title.trim().length === 0) missing.push('title');
    if (!rec.link || typeof rec.link !== 'string' || !rec.link.startsWith('http')) missing.push('link');
    if (!rec.date) missing.push('date');
    if (!rec.category) missing.push('category');

    if (missing.length > 0) {
      invalidCount++;
      issues.push(`Item #${idx + 1} missing required fields: [${missing.join(', ')}]`);
    } else {
      validRecords.push(rec);
    }
  });

  const failureRate = invalidCount / records.length;
  // Allow up to 20% invalid records
  const isValid = failureRate <= 0.2;

  return {
    isValid,
    issues,
    invalidCount,
    totalCount: records.length,
    failureRate,
    validRecords
  };
}

/**
 * Real self-healing: re-scrapes with a different extraction strategy
 * instead of faking a heal event.
 * 
 * Strategy escalation:
 * 1. Default Cheerio extraction failed → try with relaxed filters
 * 2. Relaxed filters failed → try extracting just text content
 * 3. All failed → log failure honestly
 */
async function performRealSelfHeal(targetUrl, originalResult, healReason) {
  const { runScraperAgent } = require('./scraper-agent');
  const timestamp = new Date().toISOString();
  const eventId = `heal_${Date.now()}`;

  console.log(`[HealthMonitor] 🩹 REAL Self-Healing triggered for: ${targetUrl}`);
  console.log(`[HealthMonitor] 💡 Reason: ${healReason}`);

  // Record the diagnosis
  const beforeStats = {
    totalNotices: originalResult?.length || 0,
    validNotices: originalResult?.filter(r => r.title && r.link)?.length || 0,
    invalidNotices: originalResult?.filter(r => !r.title || !r.link)?.length || 0
  };

  // Strategy 1: Re-scrape with the same engine (maybe transient failure)
  console.log(`[HealthMonitor] 🔄 Heal Strategy 1: Re-scraping ${targetUrl}...`);
  try {
    const retryResult = await runScraperAgent(null, targetUrl);
    if (retryResult.success && retryResult.data && retryResult.data.length > 0) {
      const validation = validateScrapedDataset(retryResult.data);
      if (validation.isValid) {
        const afterStats = {
          totalNotices: retryResult.data.length,
          validNotices: validation.validRecords.length,
          invalidNotices: validation.invalidCount
        };

        const logEntry = {
          id: eventId,
          timestamp,
          targetUrl: targetUrl || 'unknown',
          triggerReason: healReason,
          repairStrategy: 'Re-scrape with Cheerio (retry)',
          status: 'HEALED_VERIFIED',
          beforeStats,
          afterStats,
          details: `Re-scrape succeeded: ${afterStats.validNotices} valid notices extracted (was ${beforeStats.validNotices})`,
          autoApproved: true
        };
        recordHealEvent(logEntry);
        return { success: true, healedData: retryResult.data, logEntry, strategy: 'retry' };
      }
    }
  } catch (e) {
    console.warn(`[HealthMonitor] Strategy 1 failed: ${e.message}`);
  }

  // Strategy 2: Re-scrape with relaxed parsing (extract any links)
  console.log(`[HealthMonitor] 🔄 Heal Strategy 2: Relaxed link extraction...`);
  try {
    const { fetchLiveHtml } = require('./scraper-agent');
    const fetchRes = await fetchLiveHtml(targetUrl);
    const html = typeof fetchRes === 'object' && fetchRes !== null ? fetchRes.html : fetchRes;
    if (html) {
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const hostname = new URL(targetUrl).hostname;
      const origin = new URL(targetUrl).origin;
      const emergencyNotices = [];

      // Extract every link with text > 10 chars
      $('a[href]').each((i, el) => {
        if (emergencyNotices.length >= 15) return;
        let href = $(el).attr('href') || '';
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.length < 10 || href.startsWith('#') || href.startsWith('javascript:')) return;
        if (href.startsWith('/')) href = origin + href;
        if (!href.startsWith('http')) return;
        if (emergencyNotices.some(n => n.link === href)) return;

        emergencyNotices.push({
          title: text.substring(0, 200),
          link: href,
          date: new Date().toISOString().split('T')[0],
          category: 'General',
          summary: `Emergency extraction from ${hostname}`,
          source_url: targetUrl,
          reference_id: `HEAL-${Buffer.from(href).toString('base64').substring(0, 12)}`
        });
      });

      if (emergencyNotices.length > 0) {
        const afterStats = {
          totalNotices: emergencyNotices.length,
          validNotices: emergencyNotices.length,
          invalidNotices: 0
        };

        const logEntry = {
          id: eventId,
          timestamp,
          targetUrl: targetUrl || 'unknown',
          triggerReason: healReason,
          repairStrategy: 'Relaxed link extraction (emergency fallback)',
          status: 'HEALED_PARTIAL',
          beforeStats,
          afterStats,
          details: `Emergency extraction found ${emergencyNotices.length} links (reduced quality, basic structure)`,
          autoApproved: true
        };
        recordHealEvent(logEntry);
        return { success: true, healedData: emergencyNotices, logEntry, strategy: 'relaxed' };
      }
    }
  } catch (e) {
    console.warn(`[HealthMonitor] Strategy 2 failed: ${e.message}`);
  }

  // Strategy 3: All strategies failed — log honest failure
  console.error(`[HealthMonitor] ❌ All heal strategies exhausted. Logging failure.`);
  const logEntry = {
    id: eventId,
    timestamp,
    targetUrl: targetUrl || 'unknown',
    triggerReason: healReason,
    repairStrategy: 'All strategies failed (retry + relaxed extraction)',
    status: 'HEAL_FAILED',
    beforeStats,
    afterStats: { totalNotices: 0, validNotices: 0 },
    details: 'Could not extract valid data. Site may require JavaScript rendering or has anti-bot protection.',
    autoApproved: false
  };
  recordHealEvent(logEntry);
  return { success: false, logEntry, strategy: 'none' };
}

/**
 * Main Health Monitor runner
 * @param {Array} records - The scraped dataset to validate
 * @param {string} [targetUrl] - The URL that was scraped
 */
async function runHealthMonitor(records, targetUrl) {
  console.log(`[HealthMonitor] 🔍 Inspecting dataset health (${records ? records.length : 0} items)...`);
  const val = validateScrapedDataset(records);

  if (val.isValid) {
    console.log(`[HealthMonitor] ✅ Scraped data is HEALTHY (${val.validRecords.length}/${val.totalCount} valid).`);
    return { healthy: true, issues: [], validRecords: val.validRecords };
  }

  console.warn(`[HealthMonitor] ⚠️ DATA QUALITY ISSUE! (${val.invalidCount}/${val.totalCount} records failed validation)`);
  const healReason = `Data quality below threshold: ${val.invalidCount}/${val.totalCount} records invalid. Issues: ${val.issues.slice(0, 3).join('; ')}`;

  // Only attempt self-heal if we have a target URL
  if (targetUrl) {
    const healRes = await performRealSelfHeal(targetUrl, records, healReason);
    return {
      healthy: false,
      healTriggered: true,
      healResult: healRes,
      validRecords: healRes.success ? healRes.healedData : val.validRecords
    };
  }

  // No URL to re-scrape — just filter out bad records
  console.log(`[HealthMonitor] ℹ️ No target URL for re-scrape. Filtering invalid records.`);
  return {
    healthy: false,
    healTriggered: false,
    issues: val.issues,
    validRecords: val.validRecords
  };
}

/**
 * Staged demo: simulates a broken dataset and triggers real self-heal
 */
async function triggerStagedHealTest(targetUrl) {
  console.log(`[HealthMonitor] 🧪 STAGED DEMO: Simulating broken data and triggering real heal...`);
  const brokenData = [
    { title: '', link: null, date: null, category: null },
    { title: 'Broken record', link: 'not-a-url' }
  ];
  return runHealthMonitor(brokenData, targetUrl || process.env.TARGET_URL || 'https://github.com/advisories');
}

if (require.main === module) {
  const records = [
    { title: 'Test', link: 'https://example.com', date: '2026-08-22', category: 'Test' }
  ];
  runHealthMonitor(records);
}

module.exports = {
  runHealthMonitor,
  validateScrapedDataset,
  performRealSelfHeal,
  triggerStagedHealTest,
  getHealLogs
};
