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
 * Sends a Telegram notification message via Telegram Bot API
 * @param {object} insightPayload
 */
async function sendTelegramNotification(insightPayload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { success: false, configured: false };
  }

  let summaryText = insightPayload.summary || "New public notices detected.";
  // Telegram has a 4096 character limit, truncate safely
  if (summaryText.length > 3000) {
    summaryText = summaryText.substring(0, 3000) + "\n\n...[Truncated for length]";
  }

  const formattedText = `🛡️ *Aegis Notification Radar Alert*\n\n` +
    `${summaryText}\n\n` +
    `📊 *Updates:* ${insightPayload.noticeCount || 0}\n` +
    `⚡ *Urgency:* ${insightPayload.urgency || "MEDIUM"}\n` +
    `🤖 *Engine:* Bright Data Scraper Studio + Gemini AI`;

  const payload = {
    chat_id: chatId,
    text: formattedText
  };

  return new Promise((resolve) => {
    try {
      const data = JSON.stringify(payload);
      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let respData = '';
        res.on('data', chunk => respData += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[NotifierAgent] ✅ Telegram notification delivered successfully.`);
            resolve({ success: true, status: res.statusCode });
          } else {
            console.error(`[NotifierAgent] ❌ Telegram API returned HTTP ${res.statusCode}:`, respData);
            resolve({ success: false, status: res.statusCode, error: respData });
          }
        });
      });

      req.on('error', (err) => {
        console.error(`[NotifierAgent] ❌ Telegram Request failed:`, err.message);
        resolve({ success: false, error: err.message });
      });

      req.write(data);
      req.end();
    } catch (err) {
      console.error(`[NotifierAgent] ❌ Telegram Notification error:`, err.message);
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

  let notifiedChannels = 0;
  const results = {};

  // Discord
  if (process.env.DISCORD_WEBHOOK_URL) {
    results.discord = await sendDiscordNotification(insightPayload);
    if (results.discord && results.discord.success) notifiedChannels++;
  }

  // Telegram
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    results.telegram = await sendTelegramNotification(insightPayload);
    if (results.telegram && results.telegram.success) notifiedChannels++;
  }

  // Fallback simulation if neither configured
  if (!process.env.DISCORD_WEBHOOK_URL && (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)) {
    console.log(`[NotifierAgent] ℹ️ No webhook configured. Simulating alert output:`);
    console.log(`================ AEGIS RADAR ALERT ================`);
    console.log(insightPayload.summary);
    console.log(`===================================================`);
    results.simulated = true;
    notifiedChannels++;
  }

  return { notified: notifiedChannels > 0, results };
}

if (require.main === module) {
  runNotifierAgent({
    hasUpdates: true,
    summary: "Test Notice Alert",
    urgency: "MEDIUM",
    noticeCount: 1
  });
}

module.exports = { runNotifierAgent, sendDiscordNotification, sendTelegramNotification };

