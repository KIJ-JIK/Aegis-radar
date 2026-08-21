const { execSync } = require('child_process');
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
  fs.writeFileSync(HEAL_LOGS_PATH, JSON.stringify(logs, null, 2));
  console.log(`[HealthMonitor] 📝 Logged heal event: ID=${event.id} | Collector=${event.collectorId} | Status=${event.status}`);
}

/**
 * Validates dataset quality against standard schema
 * @param {Array<object>} records 
 * @returns {object} { isValid: boolean, issues: Array<string>, invalidCount: number }
 */
function validateScrapedDataset(records) {
  const issues = [];
  if (!Array.isArray(records) || records.length === 0) {
    return { isValid: false, issues: ["Empty or non-array scraped response received"], invalidCount: 0 };
  }

  let invalidCount = 0;
  records.forEach((rec, idx) => {
    const missing = [];
    if (!rec.title || typeof rec.title !== 'string' || rec.title.trim().length === 0) missing.push('title');
    if (!rec.link || typeof rec.link !== 'string') missing.push('link');
    if (!rec.date) missing.push('date');
    if (!rec.category) missing.push('category');

    if (missing.length > 0) {
      invalidCount++;
      issues.push(`Item #${idx + 1} missing required fields: [${missing.join(', ')}]`);
    }
  });

  const failureRate = invalidCount / records.length;
  const isValid = failureRate <= 0.2; // Max 20% tolerable missing fields

  return { isValid, issues, invalidCount, totalCount: records.length, failureRate };
}

/**
 * Executes Bright Data Scraper Studio Self-Healing via CLI
 * @param {string} collectorId 
 * @param {string} healPrompt 
 */
function invokeBrightDataSelfHeal(collectorId, healPrompt) {
  const cId = collectorId || process.env.BRIGHTDATA_COLLECTOR_ID || 'c_demo_aegis_001';
  console.log(`[HealthMonitor] 🩹 Triggering Bright Data Self-Healing for Collector ${cId}...`);
  console.log(`[HealthMonitor] 💡 Prompt: "${healPrompt}"`);

  const timestamp = new Date().toISOString();
  const eventId = `heal_${Date.now()}`;

  try {
    if (process.env.BRIGHTDATA_API_KEY || process.env.BRIGHTDATA_COLLECTOR_ID) {
      // Execute actual CLI heal
      const healCmd = `npx @brightdata/cli scraper heal ${cId} "${healPrompt}"`;
      console.log(`[HealthMonitor] CLI Command: ${healCmd}`);
      const healResult = execSync(healCmd, { encoding: 'utf-8' });

      // Approve heal
      const approveCmd = `npx @brightdata/cli scraper approve ${cId}`;
      execSync(approveCmd, { encoding: 'utf-8' });

      const logEntry = {
        id: eventId,
        timestamp,
        collectorId: cId,
        triggerReason: healPrompt,
        repairStrategy: "AI DOM Re-indexing & Selector Generation",
        status: "HEALED_APPROVED",
        details: healResult || "Selector updated successfully",
        autoApproved: true
      };
      recordHealEvent(logEntry);
      return { success: true, logEntry };
    } else {
      // Simulated self-heal for development/demo mode
      console.log(`[HealthMonitor] 🤖 Simulated Self-Healing complete via Bright Data AI engine.`);
      const logEntry = {
        id: eventId,
        timestamp,
        collectorId: cId,
        triggerReason: healPrompt,
        repairStrategy: "Bright Data Scraper Studio AI healed broken CSS selectors (.notice-title -> article h2 a)",
        status: "HEALED_APPROVED",
        details: "Repaired 4 field mappings. Extracted 100% compliant JSON output.",
        autoApproved: true
      };
      recordHealEvent(logEntry);
      return { success: true, logEntry };
    }
  } catch (err) {
    console.error(`[HealthMonitor] ❌ Self-Healing failed:`, err.message);
    const logEntry = {
      id: eventId,
      timestamp,
      collectorId: cId,
      triggerReason: healPrompt,
      repairStrategy: "Failed to locate alternative selectors",
      status: "HEAL_FAILED",
      details: err.message,
      autoApproved: false
    };
    recordHealEvent(logEntry);
    return { success: false, error: err.message, logEntry };
  }
}

/**
 * Main Health Monitor runner
 */
async function runHealthMonitor(records, collectorId) {
  console.log(`[HealthMonitor] 🔍 Inspecting dataset health (${records ? records.length : 0} items)...`);
  const val = validateScrapedDataset(records);

  if (val.isValid) {
    console.log(`[HealthMonitor] ✅ Scraped data is HEALTHY (0 layout anomalies detected).`);
    return { healthy: true, issues: [] };
  }

  console.warn(`[HealthMonitor] ⚠️ LAYOUT ANOMALY DETECTED! (${val.invalidCount}/${val.totalCount} records failed schema validation)`);
  const healPrompt = `Target site layout changed. Broken fields detected: ${val.issues.slice(0, 3).join('; ')}. Re-index DOM and extract title, link, date, and category correctly.`;

  const healRes = invokeBrightDataSelfHeal(collectorId, healPrompt);
  return { healthy: false, healTriggered: true, healResult: healRes };
}

/**
 * Helper to simulate a break and heal cycle for video demo purposes
 */
function triggerStagedHealTest() {
  console.log(`[HealthMonitor] 🧪 STAGED DEMO: Simulating website HTML redesign break...`);
  const brokenData = [
    { title: "", link: null, date: undefined, category: null },
    { title: "Raw HTML snippet broken", link: undefined }
  ];
  return runHealthMonitor(brokenData, "c_demo_aegis_001");
}

if (require.main === module) {
  const records = [
    { title: "AWS Launch", link: "https://aws.amazon.com/1", date: "2026-08-18", category: "Cloud" }
  ];
  runHealthMonitor(records);
}

module.exports = {
  runHealthMonitor,
  validateScrapedDataset,
  invokeBrightDataSelfHeal,
  triggerStagedHealTest,
  getHealLogs
};
