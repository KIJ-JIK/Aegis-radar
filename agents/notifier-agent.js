const https = require('https');
const { URL } = require('url');
require('dotenv').config();

/**
 * Sends a Discord rich embed message via webhook
 * @param {object} insightPayload 
 */
async function sendDiscordNotification(insightPayload) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[NotifierAgent] ℹ️ DISCORD_WEBHOOK_URL not configured. Simulating Discord webhook dispatch:`);
    console.log(`================ DISCORD ALERT ================`);
    console.log(insightPayload.summary);
    console.log(`===============================================`);
    return { success: true, simulated: true };
  }

  console.log(`[NotifierAgent] 📡 Dispatching notification to Discord Webhook...`);

  const color = insightPayload.urgency === 'HIGH' ? 0xE74C3C : 0xF39C12; // Red or Orange

  const payload = {
    username: "Aegis Radar Bot",
    avatar_url: "https://raw.githubusercontent.com/feathericons/feather/master/icons/shield.svg",
    embeds: [
      {
        title: "🛡️ Aegis Radar Update — New Notices Detected",
        description: insightPayload.summary,
        color: color,
        fields: [
          { name: "New Updates", value: `${insightPayload.noticeCount || 0}`, inline: true },
          { name: "Urgency", value: insightPayload.urgency || "MEDIUM", inline: true },
          { name: "Engine", value: "Bright Data Scraper Studio + Gemini AI", inline: true }
        ],
        footer: {
          text: "Aegis Self-Healing Notification Radar • Hackathon Submission"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(webhookUrl);
      const data = JSON.stringify(payload);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[NotifierAgent] ✅ Discord notification delivered successfully (HTTP ${res.statusCode}).`);
          resolve({ success: true, status: res.statusCode });
        } else {
          console.error(`[NotifierAgent] ❌ Discord webhook returned HTTP ${res.statusCode}`);
          resolve({ success: false, status: res.statusCode });
        }
      });

      req.on('error', (err) => {
        console.error(`[NotifierAgent] ❌ HTTP Request failed:`, err.message);
        resolve({ success: false, error: err.message });
      });

      req.write(data);
      req.end();
    } catch (err) {
      console.error(`[NotifierAgent] ❌ Invalid Webhook URL:`, err.message);
      resolve({ success: false, error: err.message });
    }
  });
}

/**
 * Main Notifier Agent runner
 */
async function runNotifierAgent(insightPayload) {
  if (!insightPayload || !insightPayload.hasUpdates) {
    console.log(`[NotifierAgent] 😴 No new updates to notify.`);
    return { notified: false };
  }

  const result = await sendDiscordNotification(insightPayload);
  return { notified: true, discordResult: result };
}

if (require.main === module) {
  runNotifierAgent({
    hasUpdates: true,
    summary: "Test Notice Alert",
    urgency: "MEDIUM",
    noticeCount: 1
  });
}

module.exports = { runNotifierAgent, sendDiscordNotification };
