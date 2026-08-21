const { runScraperAgent } = require('./scraper-agent');
const { runHealthMonitor, triggerStagedHealTest } = require('./health-monitor');
const { runInsightAgent } = require('./insight-agent');
const { runNotifierAgent } = require('./notifier-agent');
require('dotenv').config();

/**
 * Runs the complete end-to-end Aegis pipeline
 * @param {object} [options]
 * @param {boolean} [options.stagedDemoBreak] Set true to simulate a staged break-and-heal event
 * @param {string} [options.targetUrl] Optional custom URL to scrape
 */
async function executeAegisPipeline(options = {}) {
  console.log(`\n=============================================================`);
  console.log(`🛡️  AEGIS SELF-HEALING RADAR — PIPELINE EXECUTION STARTED`);
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log(`=============================================================\n`);

  // Step 1: Execute Scraper Agent (Bright Data Scraper Studio or Live Extractor)
  const scraperRes = await runScraperAgent(null, options.targetUrl);
  if (!scraperRes.success) {
    console.error(`[Pipeline] ❌ Pipeline aborted during Scraper step.`);
    return { success: false, step: 'scraper', error: scraperRes.error };
  }

  let dataset = scraperRes.data;

  // Option to trigger staged demo break for hackathon video recording
  if (options.stagedDemoBreak) {
    console.log(`\n[Pipeline] 🧪 Demo Mode Active: Injecting staged layout anomaly...`);
    dataset = [
      { title: "", link: null, date: null, category: null },
      ...dataset
    ];
  }

  // Step 2: Run Health Monitor & Self-Healing Loop
  const monitorRes = await runHealthMonitor(dataset);
  if (!monitorRes.healthy && monitorRes.healTriggered) {
    console.log(`[Pipeline] 🩹 Bright Data Scraper Studio successfully healed layout issue! Re-running scraper...`);
    // Re-run scraper post heal
    const reScraped = await runScraperAgent(null, options.targetUrl);
    if (reScraped.success) {
      dataset = reScraped.data;
    }
  }

  // Step 3: Run Insight Agent (Diffing + Gemini AI Summarizer)
  const insightRes = await runInsightAgent(dataset);

  // Step 4: Run Notifier Agent (Discord Webhook Alerts)
  const notifyRes = await runNotifierAgent(insightRes.insightResult);

  console.log(`\n=============================================================`);
  console.log(`✅ PIPELINE EXECUTION COMPLETED SUCCESSFULLY`);
  console.log(`📊 Summary: ${insightRes.newNotices.length} new notices | Notified: ${notifyRes.notified}`);
  console.log(`=============================================================\n`);

  return {
    success: true,
    scrapedCount: dataset.length,
    newNoticesCount: insightRes.newNotices.length,
    health: monitorRes,
    insight: insightRes.insightResult,
    notifier: notifyRes
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isStaged = args.includes('--demo-heal');
  executeAegisPipeline({ stagedDemoBreak: isStaged });
}

module.exports = { executeAegisPipeline };
