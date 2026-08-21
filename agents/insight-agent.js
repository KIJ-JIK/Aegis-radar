const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const STATE_FILE_PATH = path.join(__dirname, '../data/state.json');

function ensureStateFile() {
  const dir = path.dirname(STATE_FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STATE_FILE_PATH)) {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify({ seenIds: [], lastRun: null }, null, 2));
  }
}

function getStoredState() {
  ensureStateFile();
  return JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf-8'));
}

function updateStoredState(seenIds) {
  ensureStateFile();
  const state = getStoredState();
  const updatedSet = Array.from(new Set([...state.seenIds, ...seenIds]));
  fs.writeFileSync(
    STATE_FILE_PATH,
    JSON.stringify({ seenIds: updatedSet, lastRun: new Date().toISOString() }, null, 2)
  );
}

/**
 * Diffs incoming scraped dataset against historical state
 */
function findNewNotices(dataset) {
  const state = getStoredState();
  const seenSet = new Set(state.seenIds);

  const newItems = dataset.filter((item) => {
    const id = item.reference_id || item.link || item.title;
    return !seenSet.has(id);
  });

  return newItems;
}

/**
 * Generates an executive summary of new notifications using Google Gemini AI
 * @param {Array<object>} newNotices 
 */
async function generateGeminiSummary(newNotices) {
  if (!newNotices || newNotices.length === 0) {
    return {
      hasUpdates: false,
      summary: "No new public notifications detected in this cycle.",
      urgency: "LOW"
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log(`[InsightAgent] ℹ️ GEMINI_API_KEY not found in environment. Using standard formatted text summary.`);
    const lines = newNotices.map(
      (n) => `• [${n.category || 'Notice'}] ${n.title} (${n.date || 'Today'}): ${n.link}`
    );
    return {
      hasUpdates: true,
      summary: `📢 **Aegis Radar Alert: ${newNotices.length} New Updates**\n\n` + lines.join('\n'),
      urgency: "MEDIUM",
      noticeCount: newNotices.length
    };
  }

  console.log(`[InsightAgent] 🤖 Requesting AI summary from Google Gemini API...`);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are Aegis AI, an automated public intelligence radar assistant. 
Summarize the following ${newNotices.length} newly scraped public notices into a concise, professional alert for Discord/Telegram notifications.
Format your output with:
1. An overall Urgency Level (HIGH, MEDIUM, or LOW).
2. Key Highlights in bullet points.
3. Brief call-to-action for users.

Notices Data:
${JSON.stringify(newNotices, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const aiText = response.text || "New public notices detected.";

    return {
      hasUpdates: true,
      summary: aiText,
      urgency: aiText.includes('HIGH') ? 'HIGH' : 'MEDIUM',
      noticeCount: newNotices.length
    };
  } catch (err) {
    console.error(`[InsightAgent] ❌ Gemini API call failed:`, err.message);
    const lines = newNotices.map((n) => `• ${n.title} - ${n.link}`);
    return {
      hasUpdates: true,
      summary: `📢 **Aegis Radar Alert: ${newNotices.length} New Notices**\n\n` + lines.join('\n'),
      urgency: "MEDIUM",
      noticeCount: newNotices.length
    };
  }
}

/**
 * Main Insight Agent runner
 */
async function runInsightAgent(scrapedDataset) {
  console.log(`[InsightAgent] 🧠 Diffing scraped dataset against state store...`);
  const newNotices = findNewNotices(scrapedDataset);

  console.log(`[InsightAgent] 📊 Found ${newNotices.length} new notices out of ${scrapedDataset.length} total items.`);

  const insightResult = await generateGeminiSummary(newNotices);

  // Update state with newly seen IDs
  const newIds = newNotices.map((n) => n.reference_id || n.link || n.title);
  if (newIds.length > 0) {
    updateStoredState(newIds);
  }

  return { newNotices, insightResult };
}

if (require.main === module) {
  const sample = [
    { title: "Test Announcement", link: "https://example.com/test", date: "2026-08-18", category: "General" }
  ];
  runInsightAgent(sample);
}

module.exports = {
  runInsightAgent,
  findNewNotices,
  generateGeminiSummary
};
