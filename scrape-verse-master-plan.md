# Into the Scrape-Verse — Master Plan & Antigravity Build Prompt

**Team:** BITHEADS (or solo) · **Hackathon:** Into the Scrape-Verse (WeMakeDevs × Bright Data) · **Window:** Aug 17–23, 2026 · **Today:** Aug 18 — 5 build days left

---

## 1. Hackathon Cheat-Sheet (know this cold before you build)

**What it is:** Build a *self-healing* web scraper using **Bright Data Scraper Studio**, then turn the structured data into a real product. The differentiator the judges want to see: your scraper breaks when a site changes, and it repairs itself instead of you rewriting selectors by hand.

**Dates:** Aug 17 (brief live) → Aug 23 (submission deadline: repo + README + demo video + structured output, filed).

**Format:** Solo or team of up to 4. Online from anywhere, optional in-person meetup Aug 22 in SF.

**Prizes ($15,000 total):**
| Track | Prize | Judged on |
|---|---|---|
| Web-Slinger (Grand Prize) | NVIDIA DGX Spark ($5,000) | Best overall use of Bright Data |
| Suit-Up | iPad × every team member | Best UI |
| Spider-Sense | Keychron keyboard × every team member | Cleanest code |
| Daily Bugle | Samsung Galaxy Watch | Best LinkedIn post (must tag @WeMakeDevs, LinkedIn only) |
| Raffle | Iron Man MK5 Helmet | Automatic on registration — no build required |
| Top teams | $2,500 Bright Data credits (split) | — |

Every project you submit is auto-considered for the Grand Prize + both Suit-Up and Spider-Sense — you don't pick a lane.

**Judging criteria (equal weight):** potential impact · creativity/innovation · technical excellence · centrality of Scraper Studio · reliability/self-healing · presentation quality.

---

## 2. The 18 Rules — and how this plan stays inside every one of them

1. Online or SF in-person — you're building online. ✅
2. Solo or team ≤4, one team each — confirm team roster once, don't split BITHEADS across two entries.
3. **Must use Bright Data Scraper Studio** to create and run a custom scraper — this is the spine of the whole plan below. ✅ non-negotiable.
4. Theme is open-ended (app, automation, research tool, pipeline, AI product, anything). ✅
5. **A prebuilt scraper from Bright Data's library does NOT qualify.** Your target site must be one their 800+ library doesn't already cover — Section 4 picks a genuinely long-tail target for this reason.
6. **Public data only.** No login walls, paywalls, personal data. Section 4 targets are chosen to be fully public.
7. Real coding/design starts *after* the hackathon opened (Aug 17) — you're clear, it's Aug 18. Planning/notes beforehand were always fine.
8. Frameworks, open-source libs, public APIs, templates are all fair game — only the original work done *during* the week is judged.
9. Submission must include: **public repo, clear README, example structured output, demo video, and a clear explanation of how Scraper Studio was used.** Section 6 builds this in as a deliverable, not an afterthought.
10. **AI coding assistants (including Antigravity) are allowed but must be disclosed.** The prompt in Section 7 tells the agent to leave a visible "Built with AI assistance" note and to keep you, the human, in the loop at every phase — because of rule 11 below.
11. **You must be able to explain the scraper, the architecture, and every technical decision.** The Antigravity prompt is written to checkpoint with you and explain itself as it goes, not to dump a black box.
12. A project that's 100% AI-generated with no real understanding from you can be **rejected outright.** This is the most important rule to internalize — you drive, Antigravity assists.
13. iPad/Keychron go to every team member on a winning team; DGX Spark goes to the team as a whole; Daily Bugle goes to whoever wrote the post.
14. Raffle is automatic from registration, drawn after submissions close — register once, done.
15. IP from the hackathon belongs to you/your team — agree internally now if it's a team of >1.
16–18. Be respectful, no plagiarism/manipulation, follow the WeMakeDevs Code of Conduct — standard conduct, not a technical constraint.

**One region note (not applicable to you):** Bright Data isn't accessible in Pakistan/Iran, so the hackathon excludes those two countries — irrelevant for India, just flagging that it exists in the rules.

---

## 3. The Winning Concept

### Project: **Aegis** — a self-healing notification radar for public Karnataka/India government and institutional portals

**One-liner:** A multi-agent pipeline that watches long-tail public portals (exam boards, recruitment notices, tender/notification pages) that constantly redesign without warning, uses Bright Data Scraper Studio to extract structured notices, **heals itself** the moment a page layout changes, and pushes plain-language alerts to Discord/Telegram — with a dashboard that visibly shows the scraper breaking and repairing itself.

**Why this wins on every judging axis:**
- **Potential impact:** A real, relatable problem — students and job-seekers miss deadlines because these portals silently change HTML and nobody notices until it's too late. You're a first-year CS student in Bengaluru; this is a problem you can speak to with total authenticity in the demo.
- **Creativity:** Nobody scrapes Amazon for a hackathon and wins — you're targeting the exact kind of niche, ugly, inconsistent government/institutional site Bright Data's prebuilt library doesn't cover, which is precisely what the organizers said they're looking for.
- **Technical excellence:** A multi-agent pipeline (Scraper Agent → Health Monitor → Insight Agent → Notifier) plays directly to the multi-agent architecture experience you already have from the AMD ROCm-porting project and AgentSec.
- **Centrality of Scraper Studio:** Every stage of data collection runs through `bdata` — nothing is scraped by hand-rolled BeautifulSoup/Selenium.
- **Reliability/self-healing:** This is the headline feature, not a footnote — you'll deliberately demo a break-and-heal cycle on camera.
- **Presentation:** A dashboard with a visible "self-heal timeline" (page broke at X, healed at Y, same Collector ID, zero downstream changes) is exactly the kind of visual the judges are primed to reward.

### Target site selection (this determines whether you even qualify — rule 5)

**Primary recommendation:** A Karnataka/India government notification or recruitment portal (e.g., a state exam board, a public tenders/e-procurement listing page, or a university/scholarship notice board). These sites are notorious for inconsistent, poorly maintained HTML that changes without notice — a perfect, honest self-healing story — and they are almost certainly outside Bright Data's 800+ prebuilt library, which focuses on major commercial sites.

**Backups if the primary target turns out to be hard to reach (rate-limited, JS-heavy, or awkward) or you want an easier build:**
- **B. Regional/niche D2C e-commerce brand** (a smaller Indian D2C brand's own site, not Amazon/Flipkart) — price/stock intelligence use case, matches project idea "Price and inventory intelligence."
- **C. A niche AI/dev-tool docs site or changelog page** — matches the "Docs → RAG" and "Competitive intel" project ideas, and plays even more directly to your AI/ML interest if you'd rather build a "chat with these docs" style product than a notification radar.

**Day-1 action:** Antigravity validates the chosen target's `robots.txt` and confirms no login/paywall before anything else is built (baked into the prompt in Section 7).

---

## 4. Architecture

```
                     ┌───────────────────────────┐
                     │      Scraper Agent         │
                     │  bdata scraper create/run   │
                     │  (Bright Data Scraper Studio│
                     │   Discovery + PDP scrapers) │
                     └─────────────┬──────────────┘
                                   │ structured JSON (Collector ID c_*)
                                   ▼
                     ┌───────────────────────────┐
                     │   Health Monitor Agent     │
                     │  validates output, detects  │
                     │  empty/missing fields →     │
                     │  bdata scraper heal / approve│
                     │  logs every heal event      │
                     └─────────────┬──────────────┘
                                   │ clean structured data + heal log
                                   ▼
                     ┌───────────────────────────┐
                     │     Insight Agent          │
                     │  diffs today vs last run,   │
                     │  summarizes what's new in    │
                     │  plain language (Claude API) │
                     └─────────────┬──────────────┘
                                   │ alert payload
                     ┌─────────────┴──────────────┐
                     ▼                             ▼
          ┌───────────────────┐        ┌───────────────────────┐
          │  Notifier Agent    │        │   Dashboard (Next.js)  │
          │  Discord/Telegram  │        │  live data + self-heal │
          │  webhook alerts    │        │  timeline + charts     │
          └───────────────────┘        └───────────────────────┘

   Whole loop scheduled by GitHub Actions cron — runs unattended,
   heals itself if the target site changes, no human required.
```

### Tech stack
- **Scraping:** Bright Data CLI (`@brightdata/cli`) driving Scraper Studio — the mandatory core.
- **Orchestration/backend:** Node.js/Express, or Zoho Catalyst Functions + Catalyst Data Store if you want to lean on your existing Catalyst Premium access to save setup time.
- **Insight generation:** Claude API for diff summarization (if you have access via your Catalyst/Education path — otherwise any LLM API you have keys for).
- **Automation:** GitHub Actions cron job — runs the scrape → validate → heal-if-needed → alert loop on a schedule, unattended (this alone is a strong "technical excellence" and "reliability" signal).
- **Alerts:** Discord webhook (fastest to build) + optional Telegram bot.
- **Frontend:** Next.js + Tailwind — collector health panel, self-heal timeline, latest-notices table/trend chart.
- **Repo:** Public GitHub repo, structured with a top-level `README.md`, `/scraper`, `/agents`, `/dashboard`, `/.github/workflows`, and a `sample-output/` folder with real structured JSON.

---

## 5. Day-by-Day Roadmap (Aug 18 → Aug 23)

**Day 1 (today, Aug 18) — Setup & validation**
- Confirm hackathon registration is in; claim the $50 Bright Data credit (sign up → Billing → promo code `wemakedevs`, all lowercase).
- Install the CLI (`npx @brightdata/cli`), run `bdata login`.
- Pick and validate the target site (robots.txt, no login wall, confirm it's not already in Bright Data's prebuilt library).
- Run `bdata scraper create <URL> "<data you need>"` to get your first working Collector ID.
- Scaffold the GitHub repo and Antigravity workspace.

**Day 2 (Aug 19) — Scraper Agent**
- Build out Discovery + PDP scrapers for the real fields you need (title, deadline, category, link, posted date, etc.).
- Run `bdata scraper run <COLLECTOR_ID> <URL>` repeatedly, lock down the JSON schema, save real sample output.

**Day 3 (Aug 20) — Health Monitor + self-healing loop**
- Build the validator that flags empty/missing fields.
- Deliberately provoke or capture a real break, run `bdata scraper heal <COLLECTOR_ID> "<what broke>"`, then `bdata scraper approve <COLLECTOR_ID>` (or `--reject` to retry with a sharper prompt).
- Log every heal event with a timestamp — this log is your demo's best asset.
- Wire the GitHub Actions cron job.

**Day 4 (Aug 21) — Insight + Notifier agents**
- Diff today's run against the last one, summarize with Claude, push to Discord/Telegram.
- End-to-end test: cron fires → scrape → validate → (heal if needed) → summarize → alert, with zero manual steps.

**Day 5 (Aug 22) — Dashboard**
- Build the Next.js UI: collector status, self-heal timeline, latest notices, a trend view.
- Polish visuals — this is what the Suit-Up (Best UI) track judges on directly.

**Day 6 (Aug 23, deadline day) — Ship**
- Clean-code pass: comments, consistent structure, no dead code, no secrets committed (Spider-Sense track).
- Write the README (setup steps + a clear section explaining exactly how Scraper Studio is used).
- Record the demo video: show the problem → the scraper running → a real or staged self-heal → the alert → the dashboard.
- Push the public repo, file the submission form before the deadline.
- Post on LinkedIn tagging @WeMakeDevs about what you built (Daily Bugle track — separate prize, costs you five minutes).

---

## 6. Submission Checklist (maps directly to Rule 9)

- [ ] Public source-code repository
- [ ] Clear README (setup + architecture + Scraper Studio explanation)
- [ ] Example structured output (real JSON, not fabricated)
- [ ] Demo video showing the working project, including the self-heal moment
- [ ] AI-assistance disclosure (Antigravity/Claude usage noted plainly)
- [ ] No secrets/API tokens committed
- [ ] LinkedIn post tagging @WeMakeDevs (bonus track)
- [ ] Submission form filed before Aug 23 deadline

---

## 7. The Antigravity Master Prompt

Copy everything in the box below into Antigravity as your project brief. It's written so Antigravity plans and checkpoints with you rather than one-shotting a black box — which matters because you're on the hook to explain every part of this at judging.

```
PROJECT: Aegis — Self-Healing Notification Radar
CONTEXT: I'm building a submission for "Into the Scrape-Verse," a hackathon run by
WeMakeDevs with Bright Data as title sponsor, Aug 17–23, 2026. I'm a first-year CS
student, part of a small team (BITHEADS) with prior experience building multi-agent
AI systems. I am the one who must be able to explain every part of this project at
judging, so work WITH me in checkpointed phases — do not silently generate the whole
project in one shot.

═══════════════════════════════════════════
HARD CONSTRAINTS — NEVER VIOLATE THESE
═══════════════════════════════════════════
1. The scraper MUST be created and run through Bright Data Scraper Studio (via the
   `@brightdata/cli` / `bdata` commands), not hand-rolled with BeautifulSoup, Selenium,
   Playwright, or raw requests. A scraper pulled straight from Bright Data's existing
   800+ prebuilt library does NOT qualify — it must be a CUSTOM scraper I build in
   Scraper Studio for a target site that library doesn't already cover.
2. Only scrape publicly available web data. No login-gated, paywalled, personal, or
   otherwise restricted content, ever.
3. Never hardcode or fabricate "sample" scraped data and present it as real output.
   Every JSON sample in the repo must come from an actual `bdata scraper run`.
4. Never commit API keys, tokens, or .env files to the repository.
5. At the end of each phase below, STOP and summarize in plain language what you built
   and why, so I can verify I understand it before we continue. Do not skip this.
6. Leave a visible "Built with AI assistance (Antigravity)" note in the README —
   AI-assisted builds must be disclosed per the hackathon rules, and I need to be able
   to explain the architecture and every technical decision at judging, so bias toward
   clear comments and simple, explainable code over clever one-liners.

═══════════════════════════════════════════
WHAT WE'RE BUILDING
═══════════════════════════════════════════
A multi-agent pipeline that:
(a) uses Bright Data Scraper Studio to extract structured notices/listings from a
    long-tail, frequently-redesigned public site (candidate: a Karnataka/India
    government recruitment, exam, or tender notification portal — backups: a small
    regional D2C e-commerce brand's own site, or a niche AI/dev-tool docs/changelog
    page),
(b) monitors scraper output for missing/empty fields and triggers Bright Data's
    self-healing tool (`bdata scraper heal`) when the target site's layout changes,
    logging every heal event with a timestamp,
(c) summarizes what's new since the last run in plain language,
(d) pushes that summary as an alert to Discord (and optionally Telegram),
(e) runs unattended on a schedule via GitHub Actions,
(f) is visualized in a small Next.js dashboard showing collector health, the
    self-healing timeline, and the latest structured data.

═══════════════════════════════════════════
BUILD PHASES — CHECKPOINT AFTER EACH ONE
═══════════════════════════════════════════

PHASE 0 — Target validation
- Propose the specific target site (start with the government-portal candidate).
- Check its robots.txt and confirm there's no login wall or paywall.
- Confirm in plain language why this target is NOT already covered by Bright Data's
  prebuilt scraper library (long-tail justification — this determines whether the
  whole submission even qualifies, so don't skip it).
- STOP and report back before touching any code.

PHASE 1 — Environment & Scraper Studio setup
- Set up `npx @brightdata/cli`, walk me through `bdata login`.
- Run `bdata scraper create <URL> "<data description>"` against the validated target
  to get a working Collector ID.
- Run `bdata scraper run <COLLECTOR_ID> <URL>` and show me real structured output.
- Scaffold the repo: /scraper, /agents, /dashboard, /.github/workflows, README.md,
  sample-output/.
- STOP and report back.

PHASE 2 — Scraper Agent
- Lock down the exact JSON schema for the fields I actually need (title, deadline,
  category, link, date posted, etc. — adjust to the real target site).
- Save real sample output to sample-output/.
- STOP and report back.

PHASE 3 — Health Monitor + self-healing loop
- Write a validator that flags empty/missing required fields in scraper output.
- Wire it to call `bdata scraper heal <COLLECTOR_ID> "<what broke>"` automatically
  when validation fails, then `bdata scraper approve <COLLECTOR_ID>` (or `--reject`
  to retry with a different heal prompt if the fix looks wrong).
- Log every heal attempt (timestamp, what broke, what changed, approved/rejected) to
  a simple JSON or DB log — this log is central to the demo, treat it as a first-class
  feature, not internal plumbing.
- STOP and report back, and tell me how we'll demonstrate a real or staged break-and-
  heal cycle on camera for the demo video.

PHASE 4 — Insight Agent + Notifier Agent
- Diff the current run against the previous one.
- Summarize new/changed entries in plain language (use an LLM API — ask me which key
  I have available before assuming one).
- Send that summary to a Discord webhook (ask me for the webhook URL, don't invent
  one, and never commit it — read it from an environment variable).
- STOP and report back.

PHASE 5 — Automation
- Write a GitHub Actions workflow that runs the full pipeline (scrape → validate →
  heal-if-needed → summarize → alert) on a schedule, entirely unattended.
- STOP and report back with how to verify it ran correctly.

PHASE 6 — Dashboard
- Build a small Next.js + Tailwind dashboard: collector status, self-heal timeline,
  latest structured entries, a simple trend view.
- Keep it clean and legible over feature-heavy — this is judged on "Best UI."
- STOP and report back.

PHASE 7 — Ship
- Do a clean-code pass: comments, consistent naming, no dead code, no secrets in the
  repo, sensible folder structure (judged directly on "Best Clean Code").
- Write the README: what this is, the problem it solves, setup instructions, the
  architecture, and — explicitly and clearly — how Bright Data Scraper Studio is used
  at each stage (this exact explanation is a required submission item).
- Give me a demo-video script/outline: state the problem → show the scraper running →
  show a real or staged self-heal event and the log entry it produced → show the alert
  → show the dashboard. Keep it tight.
- Remind me, at the very end, to: file the hackathon submission form before the
  Aug 23 deadline, and post about the build on LinkedIn tagging @WeMakeDevs.

Work through these phases in order. Ask me before making any assumption that affects
what data we collect, what site we target, or what third-party service credentials
we use. Explain your reasoning as you go — I need to be able to defend every decision
in this project to the judges.
```

---

## 8. Last few things worth doing right now

- If you haven't already, register at the hackathon form and claim the `wemakedevs` credit code in Bright Data billing (lowercase) — free money for the build.
- Bright Data publishes ready-made prompts for coding agents at `docs.brightdata.com/datasets/scraper-studio/coding-agent-prompts` — worth a quick skim before Phase 1, since Antigravity may benefit from the exact CLI syntax they recommend.
- If the government-portal target turns out to be awkward to scrape (heavy JS rendering, aggressive rate limiting), don't burn a full day on it — pivot to backup B or C from Section 3 on Day 1 itself. A working, less-ambitious target beats a broken ambitious one every time in a 5-day build.
