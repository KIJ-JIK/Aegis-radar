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
  const targetUrl = options.targetUrl || process.env.TARGET_URL || 'https://github.com/advisories';

  console.log(`\n=============================================================`);
  console.log(`🛡️  AEGIS SELF-HEALING RADAR — PIPELINE EXECUTION STARTED`);
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log(`🌐 Target: ${targetUrl}`);
  console.log(`=============================================================\n`);

  // Step 1: Execute Scraper Agent
  const scraperRes = await runScraperAgent(null, targetUrl);
  if (!scraperRes.success) {
    console.error(`[Pipeline] ❌ Scraper failed. Attempting self-heal...`);
    // Trigger self-heal even on scraper failure
    const healRes = await runHealthMonitor([], targetUrl);
    if (healRes.healTriggered && healRes.healResult?.success) {
      console.log(`[Pipeline] 🩹 Self-heal recovered data!`);
      const dataset = healRes.validRecords || [];
      const insightRes = await runInsightAgent(dataset);
      const notifyRes = await runNotifierAgent(insightRes.insightResult);
      return { success: true, scrapedCount: dataset.length, health: healRes, insight: insightRes.insightResult, notifier: notifyRes };
    }
    return { success: false, step: 'scraper', error: scraperRes.error };
  }

  let dataset = scraperRes.data;

  // Option to trigger staged demo break for hackathon demo
  if (options.stagedDemoBreak) {
    console.log(`\n[Pipeline] 🧪 Demo Mode: Triggering staged self-heal...`);
    const healRes = await triggerStagedHealTest(targetUrl);
    if (healRes.healTriggered && healRes.healResult?.success) {
      dataset = healRes.validRecords || dataset;
    }
  } else {
    // Step 2: Run Health Monitor & Self-Healing Loop
    const monitorRes = await runHealthMonitor(dataset, targetUrl);
    if (!monitorRes.healthy && monitorRes.healTriggered && monitorRes.healResult?.success) {
      console.log(`[Pipeline] 🩹 Self-heal recovered better data!`);
      dataset = monitorRes.validRecords || dataset;
    } else if (!monitorRes.healthy) {
      // Use only the valid records from the original scrape
      dataset = monitorRes.validRecords || dataset;
    }
  }

  // Step 3: Run Insight Agent (Diffing + Gemini AI Summarizer)
  const insightRes = await runInsightAgent(dataset);

  // Step 4: Run Notifier Agent (Discord Webhook Alerts)
  const notifyRes = await runNotifierAgent(insightRes.insightResult);

  console.log(`\n=============================================================`);
  console.log(`✅ PIPELINE EXECUTION COMPLETED SUCCESSFULLY`);
  console.log(`📊 Summary: ${dataset.length} total | ${insightRes.newNotices.length} new | Notified: ${notifyRes.notified}`);
  console.log(`=============================================================\n`);

  return {
    success: true,
    scrapedCount: dataset.length,
    newNoticesCount: insightRes.newNotices.length,
    health: { healthy: true },
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
