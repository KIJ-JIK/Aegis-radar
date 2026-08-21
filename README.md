# Aegis — Self-Healing Notification Radar 🛡️

> **Hackathon Entry:** Into the Scrape-Verse (WeMakeDevs × Bright Data)  
> **Format:** Solo Project Entry  
> **Built with:** Bright Data Scraper Studio (`@brightdata/cli`), Google Gemini AI, Node.js, Next.js, and GitHub Actions.

---

## 📌 Project Overview

**Aegis** is an autonomous, self-healing public intelligence radar designed to watch long-tail public notification pages, public cloud/tech releases, state exam & recruitment portals, and institutional notice boards. 

Traditional web scrapers break silently whenever a target website updates its HTML markup, renames CSS classes, or restructures DOM trees. **Aegis solves this using Bright Data Scraper Studio**: the moment a site layout redesign breaks selector extraction, Aegis detects the schema degradation, triggers Bright Data's AI self-healing repair loop (`bdata scraper heal`), updates its collector selectors in-place, and continues dispatching structured notices to Discord/Telegram without requiring developer intervention.

---

## 🎯 Centrality of Bright Data Scraper Studio

Bright Data Scraper Studio forms the backbone of data extraction and self-healing across the entire Aegis pipeline:

1. **Custom Scraper Creation (`bdata scraper create`)**:  
   Rather than hardcoding fragile BeautifulSoup/Selenium scripts, Aegis registers a custom AI-driven scraper targeting public release portals outside Bright Data's 800+ prebuilt library.
2. **Structured Execution (`bdata scraper run`)**:  
   Runs the collector via `@brightdata/cli`, outputting normalized JSON matching the schema (`title`, `link`, `date`, `category`, `summary`, `reference_id`).
3. **Automated AI Self-Healing (`bdata scraper heal`)**:  
   When `health-monitor.js` detects missing mandatory schema fields or null values caused by target site redesigns, it invokes:
   ```bash
   npx @brightdata/cli scraper heal <COLLECTOR_ID> "Target site layout changed. Re-index DOM and extract title, link, date, category."
   ```
4. **Collector Approval (`bdata scraper approve`)**:  
   Locks in the newly healed selector mappings so subsequent automated runs execute with 100% extraction fidelity.

---

## 🏗️ Architecture

```
 ┌───────────────────────────────────────────────────────────┐
 │               GitHub Actions Cron (Scheduled)             │
 └─────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
 ┌───────────────────────────────────────────────────────────┐
 │                   1. Scraper Agent                        │
 │  Executes `bdata scraper run <COLLECTOR_ID> <URL>`        │
 └─────────────────────────────┬─────────────────────────────┘
                               │ Raw Scraped JSON
                               ▼
 ┌───────────────────────────────────────────────────────────┐
 │                 2. Health Monitor Agent                   │
 │  Validates schema & detects missing fields                │
 │  Layout Break -> `bdata scraper heal` + `approve`         │
 │  Logs repair history to data/heal-logs.json               │
 └─────────────────────────────┬─────────────────────────────┘
                               │ Clean Compliant Dataset
                               ▼
 ┌───────────────────────────────────────────────────────────┐
 │                   3. Insight Agent                        │
 │  Diffs state store + calls Gemini AI for summaries        │
 └─────────────────────────────┬─────────────────────────────┘
                               │ Rich Alert Payload
                               ▼
        ┌──────────────────────┴──────────────────────┐
        ▼                                             ▼
 ┌──────────────────────────┐             ┌──────────────────────────┐
 │    4. Notifier Agent     │             │ 5. Next.js 14 Dashboard  │
 │  Discord / Telegram      │             │ • Collector Health       │
 │  Webhook Alerts          │             │ • Self-Heal Timeline     │
 └──────────────────────────┘             │ • Live Notice Radar      │
                                          └──────────────────────────┘
```

---

## ⚡ Quick Start & Setup

### Prerequisites
- Node.js v18+ & npm
- Bright Data Account ($50 credit promo code: `wemakedevs`)

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/aegis-radar.git
cd aegis-radar

# Install root dependencies
npm install

# Install dashboard dependencies
cd dashboard && npm install && cd ..
```

### 2. Environment Variables Configuration
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```
Key variables:
- `BRIGHTDATA_API_KEY`: Your Bright Data API key
- `BRIGHTDATA_COLLECTOR_ID`: Scraper Studio Collector ID
- `GEMINI_API_KEY`: Google Gemini AI API key for summaries
- `DISCORD_WEBHOOK_URL`: Discord channel webhook URL for alerts

### 3. Authenticate Bright Data CLI
```bash
npx @brightdata/cli login
```

### 4. Run the Pipeline
```bash
# Run standard pipeline
npm start

# Run staged break-and-heal simulation (for demo testing)
node agents/pipeline.js --demo-heal
```

### 5. Launch Dashboard
```bash
npm run dev:dashboard
# Open http://localhost:3000 in your browser
```

---

## 🧪 Staged Self-Healing Demonstration

To verify or record the self-healing functionality:
1. Open the Next.js Dashboard at `http://localhost:3000`.
2. Click the orange **"Simulate Site Layout Redesign (Self-Heal Demo)"** button.
3. Observe:
   - The health monitor catches the intentional schema anomaly.
   - Bright Data Scraper Studio triggers `bdata scraper heal`.
   - A new repair entry appears instantly in the **Self-Heal Timeline** log showing updated DOM selectors.

---

## 🎬 2-Minute Demo Video Script Outline

1. **The Problem (0:00 - 0:25)**:  
   Explain how public notice portals silently change HTML layouts, breaking traditional scrapers and causing users to miss deadlines.
2. **Bright Data Scraper Studio Integration (0:25 - 0:50)**:  
   Show the Aegis dashboard, active collector metrics, and explain `bdata scraper run` extraction.
3. **The Live Break & Self-Heal Event (0:50 - 1:30)**:  
   Click the "Simulate Site Layout Redesign" button. Show the terminal/UI log output of `bdata scraper heal` repairing the selectors on the fly.
4. **Insight & Notifier Output (1:30 - 2:00)**:  
   Show the Gemini AI summary and the delivered Discord alert embed.

---

## 🤖 Disclosure Note

*Built with AI assistance using Google Antigravity.* All multi-agent architecture decisions, selector validation logic, state storage engines, and self-healing workflow scripts were co-designed and verified under human guidance.
