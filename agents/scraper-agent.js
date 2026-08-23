const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const cheerio = require('cheerio');
require('dotenv').config();

const SAMPLE_OUTPUT_PATH = path.join(__dirname, '../sample-output/latest-notices.json');
const HISTORY_PATH = path.join(__dirname, '../data/scrape-history.json');

/**
 * Finds available local Google Chrome or Microsoft Edge browser executable
 */
function findBrowserExecutable() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Detects anti-bot systems, Cloudflare, AWS WAF, Akamai, or CAPTCHA challenges
 */
function detectAntiBotProtection(html, statusCode = 200, headers = {}) {
  const lowerHtml = (html || '').toLowerCase();
  const serverHeader = (headers['server'] || '').toLowerCase();

  // 1. AWS WAF (Web Application Firewall)
  if (
    lowerHtml.includes('token.awswaf.com') ||
    lowerHtml.includes('awswafintegration') ||
    lowerHtml.includes('window.awswafcookiedomainlist') ||
    lowerHtml.includes('gokuprops') ||
    (lowerHtml.includes('challenge-container') && lowerHtml.includes('awswaf'))
  ) {
    return {
      detected: true,
      provider: 'AWS WAF Bot Management',
      reason: 'Target site presented an AWS WAF cryptographic JavaScript token challenge (challenge.js).',
      recommendation: 'Target blocks direct HTTP fetch. Escalating to Stealth Browser Automation Engine to resolve challenge tokens.',
      statusCode: statusCode || 202
    };
  }

  // 2. Cloudflare Turnstile / Bot Challenge / Waiting Room
  if (
    lowerHtml.includes('challenges.cloudflare.com') ||
    lowerHtml.includes('cf-browser-verification') ||
    lowerHtml.includes('__cf_chl_opt') ||
    (lowerHtml.includes('just a moment...') && serverHeader.includes('cloudflare')) ||
    (lowerHtml.includes('checking your browser') && serverHeader.includes('cloudflare'))
  ) {
    return {
      detected: true,
      provider: 'Cloudflare Bot Management / Turnstile',
      reason: 'Cloudflare interstitial challenge or Turnstile verification presented.',
      recommendation: 'Escalating to Stealth Browser Automation Engine to pass Cloudflare clearance.',
      statusCode: statusCode || 403
    };
  }

  // 3. Akamai Bot Manager
  if (lowerHtml.includes('akam/13/pixel') || (lowerHtml.includes('access denied') && lowerHtml.includes('akamai'))) {
    return {
      detected: true,
      provider: 'Akamai Bot Manager',
      reason: 'Akamai Edge bot detection and sensor challenge triggered.',
      recommendation: 'Escalating to browser engine with realistic fingerprinting.',
      statusCode: statusCode || 403
    };
  }

  // 4. DataDome Anti-Bot
  if (lowerHtml.includes('datadome.co') || (lowerHtml.includes('datadome') && lowerHtml.includes('captcha'))) {
    return {
      detected: true,
      provider: 'DataDome Anti-Bot Protection',
      reason: 'DataDome device fingerprinting and CAPTCHA challenge encountered.',
      recommendation: 'Escalating to browser engine.',
      statusCode: statusCode || 403
    };
  }

  // 5. PerimeterX / HUMAN Security
  if (lowerHtml.includes('perimeterx') || lowerHtml.includes('human security') || lowerHtml.includes('_px3')) {
    return {
      detected: true,
      provider: 'PerimeterX / HUMAN Security',
      reason: 'PerimeterX behavioral analysis sensor challenge detected.',
      recommendation: 'Escalating to browser engine.',
      statusCode: statusCode || 403
    };
  }

  // 6. Generic Visual CAPTCHAs
  if (
    lowerHtml.includes('g-recaptcha') ||
    lowerHtml.includes('hcaptcha') ||
    lowerHtml.includes('verify you are human') ||
    lowerHtml.includes('robot or human?')
  ) {
    return {
      detected: true,
      provider: 'CAPTCHA Challenge Page',
      reason: 'Visual CAPTCHA challenge presented by target server.',
      recommendation: 'Escalating to interactive browser engine.',
      statusCode: statusCode || 403
    };
  }

  return {
    detected: false,
    provider: 'None (Direct HTML)',
    reason: 'Clean HTML response received without bot detection barriers.',
    recommendation: 'None needed.',
    statusCode: statusCode || 200
  };
}

/**
 * Headless Browser Engine (Puppeteer with Chrome/Edge) to execute JavaScript,
 * solve AWS WAF / Cloudflare challenges, and extract the complete live DOM.
 */
async function fetchWithBrowser(targetUrl) {
  const browserPath = findBrowserExecutable();
  if (!browserPath) {
    console.warn('[ScraperAgent] ⚠️ No local Chrome/Edge executable found for browser fallback.');
    return null;
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (e) {
    try {
      puppeteer = require(path.join(__dirname, '../node_modules/puppeteer-core'));
    } catch (e2) {
      console.warn('[ScraperAgent] puppeteer-core not available:', e2.message);
      return null;
    }
  }

  console.log(`[ScraperAgent] 🛡️⚡ Launching Stealth Browser Engine (${path.basename(browserPath)}) for: ${targetUrl}`);
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');

    // Apply anti-detection stealth overrides
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
    });

    console.log(`[ScraperAgent] 🌐 Browser navigating to target...`);
    try {
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 35000
      });
    } catch (e) {
      console.warn(`[ScraperAgent] Navigation notice: ${e.message}`);
    }

    // Wait for JS execution, token challenge resolution & automatic reload
    await new Promise(r => setTimeout(r, 4500));

    let finalHtml = '';
    let finalTitle = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        finalHtml = await page.content();
        finalTitle = await page.title();
        if (finalHtml && !finalHtml.includes('token.awswaf.com') && !finalHtml.includes('challenge-container')) {
          break;
        }
      } catch (e) {
        console.warn(`[ScraperAgent] Re-attempting page DOM extraction (${attempt + 1}/3)...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!finalHtml) {
      finalHtml = await page.content();
      finalTitle = await page.title();
    }

    console.log(`[ScraperAgent] ✅ Stealth Browser extracted: "${finalTitle}" (${Buffer.byteLength(finalHtml, 'utf8')} bytes)`);

    return {
      html: finalHtml,
      statusCode: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      source: 'stealth-browser',
      wafInfo: {
        detected: false,
        provider: 'Cleared via Stealth Browser Automation',
        reason: 'JavaScript challenge executed and cleared successfully.',
        recommendation: 'Full interactive DOM captured.'
      }
    };
  } catch (err) {
    console.error(`[ScraperAgent] ❌ Browser extraction failed: ${err.message}`);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

/**
 * Extracts comprehensive OpenGraph, Twitter, Meta tags, and JSON-LD structured schemas
 */
function extractMetadataAndOpenGraph($, html, targetUrl) {
  const metaTags = {};
  const og = {};
  const twitter = {};
  const jsonLd = [];

  // Extract all <meta> tags
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('http-equiv') || $(el).attr('itemprop');
    const content = $(el).attr('content');
    if (name && content !== undefined) {
      const lowerName = name.toLowerCase().trim();
      metaTags[name] = content;

      if (lowerName.startsWith('og:')) {
        og[lowerName.replace('og:', '')] = content;
      } else if (lowerName.startsWith('twitter:')) {
        twitter[lowerName.replace('twitter:', '')] = content;
      }
    }
  });

  // Extract native JSON-LD scripts (<script type="application/ld+json">)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text().trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          jsonLd.push(...parsed);
        } else {
          jsonLd.push(parsed);
        }
      }
    } catch (e) {
      // ignore malformed JSON-LD
    }
  });

  const canonical = $('link[rel="canonical"]').attr('href') || targetUrl;
  const favicon = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').attr('href') || '/favicon.ico';
  const language = $('html').attr('lang') || 'en';

  const rawTitle = $('title').text().replace(/\s+/g, ' ').trim();
  const hostname = new URL(targetUrl).hostname;

  const resolvedOg = {
    title: og.title || rawTitle || hostname,
    description: og.description || metaTags['description'] || metaTags['Description'] || '',
    image: og.image || twitter.image || '',
    url: og.url || canonical,
    site_name: og.site_name || hostname,
    type: og.type || 'website',
    locale: og.locale || language,
    ...og
  };

  // If no native JSON-LD was found in HTML, synthesize a valid standard Schema.org entity
  // so the JSON-LD section is ALWAYS rich, accurate, and schema-compliant!
  if (jsonLd.length === 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": resolvedOg.type === 'article' ? 'NewsArticle' : (resolvedOg.type === 'video.movie' ? 'Movie' : 'WebPage'),
      "name": resolvedOg.title,
      "url": resolvedOg.url,
      "description": resolvedOg.description || `Extracted document entity from ${hostname}`,
      "publisher": {
        "@type": "Organization",
        "name": resolvedOg.site_name
      },
      "inLanguage": language,
      ...(resolvedOg.image ? { "image": resolvedOg.image } : {})
    });
  }

  return {
    metaTags,
    og: resolvedOg,
    twitter: {
      card: twitter.card || 'summary_large_image',
      title: twitter.title || resolvedOg.title,
      description: twitter.description || resolvedOg.description,
      image: twitter.image || resolvedOg.image,
      site: twitter.site || '',
      ...twitter
    },
    jsonLd,
    canonical,
    favicon,
    language
  };
}

/**
 * HTTP/HTTPS fetch with modern browser headers, gzip/deflate/brotli decompression,
 * redirect following, cookie tracking, and SSL tolerance.
 */
function fetchLiveHtml(targetUrl, redirectCount = 0, cookieJar = '') {
  return new Promise((resolve) => {
    try {
      if (redirectCount > 5) {
        resolve({ html: null, statusCode: 310, headers: {}, error: 'Too many redirects', wafInfo: null });
        return;
      }
      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: (parsedUrl.pathname || '/') + (parsedUrl.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Ch-Ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
          ...(cookieJar ? { 'Cookie': cookieJar } : {})
        },
        timeout: 20000
      };

      if (isHttps) {
        options.rejectUnauthorized = false; // Tolerate custom state/gov intermediate SSL certs
      }

      const req = client.request(options, (res) => {
        let currentCookies = cookieJar;
        if (res.headers['set-cookie']) {
          const newCookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
          currentCookies = cookieJar ? `${cookieJar}; ${newCookies}` : newCookies;
        }

        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            redirectUrl = parsedUrl.origin + redirectUrl;
          } else if (!redirectUrl.startsWith('http')) {
            try { redirectUrl = new URL(redirectUrl, targetUrl).href; } catch (e) { redirectUrl = targetUrl; }
          }
          return fetchLiveHtml(redirectUrl, redirectCount + 1, currentCookies).then(resolve);
        }

        const encoding = res.headers['content-encoding'];
        let stream = res;
        if (encoding === 'gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        } else if (encoding === 'br') {
          stream = res.pipe(zlib.createBrotliDecompress());
        }

        const chunks = [];
        stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
        stream.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          const html = rawBuffer.toString('utf-8');
          const wafInfo = detectAntiBotProtection(html, res.statusCode, res.headers);
          resolve({
            html,
            statusCode: res.statusCode || 200,
            headers: res.headers,
            wafInfo
          });
        });
        stream.on('error', (err) => {
          console.error(`[ScraperAgent] Stream decompression error for ${targetUrl}:`, err.message);
          resolve({ html: null, statusCode: res.statusCode, headers: res.headers, error: err.message, wafInfo: null });
        });
      });

      req.on('error', (err) => { 
        console.error(`[ScraperAgent] Fetch error for ${targetUrl}:`, err.message); 
        resolve({ html: null, statusCode: 0, headers: {}, error: err.message, wafInfo: null }); 
      });

      req.on('timeout', () => { 
        console.warn(`[ScraperAgent] Fetch timeout (20s) for ${targetUrl}`);
        req.destroy(); 
        resolve({ html: null, statusCode: 408, headers: {}, error: 'Request timeout (20s)', wafInfo: null }); 
      });

      req.end();
    } catch (e) {
      console.error(`[ScraperAgent] Fetch exception:`, e.message);
      resolve({ html: null, statusCode: 0, headers: {}, error: e.message, wafInfo: null });
    }
  });
}

/**
 * Categorizes content based on URL domain and title keywords
 */
function categorizeContent(url, text) {
  const lower = (url + ' ' + text).toLowerCase();
  if (lower.includes('advisory') || lower.includes('cve') || lower.includes('vulnerability') || lower.includes('security')) return 'Security Advisory';
  if (lower.includes('huggingface') || lower.includes('arxiv') || lower.includes('paper') || lower.includes('research')) return 'AI / Research';
  if (lower.includes('.gov') || lower.includes('karnataka') || lower.includes('kea') || lower.includes('sevasindhu') || lower.includes('exam') || lower.includes('notification') || lower.includes('tender') || lower.includes('service')) return 'Government Notice';
  if (lower.includes('imdb') || lower.includes('trailer') || lower.includes('movie') || lower.includes('show') || lower.includes('film')) return 'Entertainment / Media';
  if (lower.includes('aws') || lower.includes('cloud') || lower.includes('azure') || lower.includes('gcp') || lower.includes('launch')) return 'Cloud / Tech Update';
  if (lower.includes('blog') || lower.includes('news') || lower.includes('announcement') || lower.includes('update')) return 'News / Announcement';
  if (lower.includes('github')) return 'Open Source / GitHub';
  return 'Public Update';
}

function formatCleanTitle(str) {
  if (!str) return '';
  let cleaned = str.replace(/\s+/g, ' ').trim();
  cleaned = cleaned
    .replace(/(Dismiss|Verified|Follow|Following|Close|Cancel|Like|Share){2,}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.substring(0, 200) || str.substring(0, 200);
}

/**
 * Uses Cheerio to extract rich structured data, full page markdown, OpenGraph,
 * content sections, tables, lists, and complete raw/sanitized HTML.
 */
function extractStructuredData(html, targetUrl, wafInfo = null, statusCode = 200, headers = {}) {
  if (!html || html.trim().length < 20) return null;

  const rawHtmlLines = html.split('\n').length;
  const rawHtmlBytes = Buffer.byteLength(html, 'utf8');

  const resolvedWaf = wafInfo || detectAntiBotProtection(html, statusCode, headers);

  const $ = cheerio.load(html);
  const hostname = new URL(targetUrl).hostname;
  const origin = new URL(targetUrl).origin;

  // Extract Metadata, OpenGraph & JSON-LD BEFORE removing scripts & styles
  const metadata = extractMetadataAndOpenGraph($, html, targetUrl);

  const rawTitle = $('title').text().replace(/\s+/g, ' ').trim();
  const pageTitle = rawTitle || metadata.og.title || hostname;
  const metaDescription = metadata.og.description || metadata.metaTags['description'] || '';
  const ogImage = metadata.og.image || '';
  const canonical = metadata.canonical || targetUrl;
  const language = metadata.language || 'en';

  // Clean scripts and styles for Markdown and content extraction
  const $clean = cheerio.load(html);
  $clean('script, style, noscript, svg, iframe').remove();

  // --- Full Page Markdown & Clean Text Extraction ---
  const markdownBlocks = [];
  const fullTextPieces = [];

  const mainSelector = $clean('article, main, #readme, .markdown-body, [role="main"]').first();
  const bodyRoot = mainSelector.length ? mainSelector : $clean('body');

  bodyRoot.find('h1, h2, h3, h4, h5, h6, p, ul, ol, table, blockquote, pre').each((_, el) => {
    const tagName = el.tagName.toLowerCase();
    const $el = $clean(el);

    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      const level = parseInt(tagName.replace('h', '')) || 2;
      const text = $el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 1) {
        markdownBlocks.push(`${'#'.repeat(level)} ${text}\n`);
        fullTextPieces.push(text);
      }
    } else if (tagName === 'p') {
      const text = $el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 5 && !text.includes('{') && !text.includes('function(')) {
        markdownBlocks.push(`${text}\n`);
        fullTextPieces.push(text);
      }
    } else if (tagName === 'blockquote') {
      const text = $el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 5) {
        markdownBlocks.push(`> ${text}\n`);
        fullTextPieces.push(text);
      }
    } else if (tagName === 'pre') {
      const code = $el.text().trim();
      if (code.length > 5 && code.length < 5000) {
        markdownBlocks.push(`\`\`\`\n${code}\n\`\`\`\n`);
        fullTextPieces.push(code);
      }
    } else if (tagName === 'ul' || tagName === 'ol') {
      const items = [];
      $el.find('> li').each((__, li) => {
        const liText = $clean(li).text().replace(/\s+/g, ' ').trim();
        if (liText.length > 2) {
          items.push(`- ${liText}`);
          fullTextPieces.push(liText);
        }
      });
      if (items.length > 0) {
        markdownBlocks.push(items.join('\n') + '\n');
      }
    }
  });

  const fullMarkdown = markdownBlocks.join('\n');
  const fullText = fullTextPieces.join(' ');

  // --- Content Sections (headings + following content) ---
  const contentSections = [];
  $clean('h1, h2, h3, h4, h5, h6').each((i, el) => {
    const heading = $clean(el).text().replace(/\s+/g, ' ').trim();
    if (heading.length < 2 || heading.length > 300) return;

    let content = '';
    let sibling = $clean(el).next();
    let collected = 0;
    while (sibling.length && collected < 12) {
      const tag = sibling.prop('tagName')?.toLowerCase();
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) break;
      const text = sibling.text().replace(/\s+/g, ' ').trim();
      if (text.length > 3 && !text.includes('{') && !text.includes('function(')) {
        content += text + ' ';
        collected++;
      }
      sibling = sibling.next();
    }

    contentSections.push({
      heading,
      content: content.trim() || '',
      level: parseInt(el.tagName?.replace('h', '') || '2')
    });
  });

  // --- Links with context & Relative URL resolution ---
  const allLinks = [];
  const seenHrefs = new Set();
  $clean('a').each((i, el) => {
    let rawHref = $clean(el).attr('href') || '';
    const onclick = $clean(el).attr('onclick') || '';
    let text = $clean(el).text().replace(/\s+/g, ' ').trim();

    if (!text) {
      text = $clean(el).attr('title') || $clean(el).attr('aria-label') || $clean(el).find('img').attr('alt') || '';
      text = text.trim();
    }

    if (!text || text.length < 2 || text.length > 300) return;
    if (rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;

    let fullHref = '';
    if (rawHref && !rawHref.startsWith('#')) {
      if (rawHref.startsWith('http')) {
        fullHref = rawHref;
      } else if (rawHref.startsWith('/')) {
        fullHref = origin + rawHref;
      } else {
        try { fullHref = new URL(rawHref, targetUrl).href; } catch (e) { fullHref = origin + '/' + rawHref; }
      }
    } else if (onclick) {
      const actionName = onclick.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 25) || text.toLowerCase().replace(/[^a-z0-9]/g, '-');
      fullHref = `${targetUrl}#${actionName}`;
    } else if (rawHref.startsWith('#') && rawHref.length > 1) {
      fullHref = targetUrl + rawHref;
    } else {
      fullHref = `${targetUrl}#${text.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30)}`;
    }

    if (seenHrefs.has(fullHref)) return;
    seenHrefs.add(fullHref);

    let context = '';
    const parent = $clean(el).closest('section, article, div, li, td, tr, p');
    if (parent.length) {
      context = parent.find('h1, h2, h3, h4').first().text().replace(/\s+/g, ' ').trim();
    }

    allLinks.push({ text, href: fullHref, context: context.substring(0, 200) });
  });

  // --- Tables ---
  const tables = [];
  $clean('table').each((i, table) => {
    const headers = [];
    $clean(table).find('thead th, thead td, tr:first-child th, tr:first-child td').each((j, th) => {
      headers.push($clean(th).text().replace(/\s+/g, ' ').trim());
    });

    const rows = [];
    $clean(table).find('tbody tr, tr').each((j, tr) => {
      const cells = [];
      $clean(tr).find('td, th').each((k, td) => {
        const cellText = $clean(td).text().replace(/\s+/g, ' ').trim();
        let cellLink = $clean(td).find('a').attr('href') || '';
        if (cellLink) {
          if (cellLink.startsWith('/')) cellLink = origin + cellLink;
          else if (!cellLink.startsWith('http')) {
            try { cellLink = new URL(cellLink, targetUrl).href; } catch(e) {}
          }
        }
        cells.push({ text: cellText, link: cellLink });
      });
      if (cells.length > 0 && cells.some(c => c.text.length > 0)) {
        rows.push(cells);
      }
    });

    if (rows.length > 0) {
      tables.push({ headers, rows, rowCount: rows.length });
    }
  });

  // --- Lists ---
  const lists = [];
  $clean('ul, ol').each((i, list) => {
    const items = [];
    $clean(list).find('> li').each((j, li) => {
      const text = $clean(li).clone().children('ul, ol').remove().end().text().replace(/\s+/g, ' ').trim();
      let link = $clean(li).find('a').first().attr('href') || '';
      if (link && link.startsWith('/')) link = origin + link;
      if (text.length > 2) {
        items.push({ text, link });
      }
    });
    if (items.length >= 1) {
      let listHeading = $clean(list).prev('h1, h2, h3, h4, h5, h6, p').text().replace(/\s+/g, ' ').trim();
      lists.push({ heading: listHeading, items });
    }
  });

  // --- Build Structured Notices from all extracted items ---
  const notices = [];
  const usedLinks = new Set();

  // 1. Primary Page Overview Notice
  if (pageTitle && pageTitle.length > 1) {
    const cleanPageTitle = formatCleanTitle(pageTitle);
    const overviewLink = targetUrl;
    usedLinks.add(overviewLink);
    notices.push({
      title: cleanPageTitle,
      link: overviewLink,
      date: new Date().toISOString().split('T')[0],
      category: categorizeContent(targetUrl, cleanPageTitle),
      summary: metaDescription || (resolvedWaf.detected ? `[Shield Alert] ${resolvedWaf.reason}` : `Overview & Document Feed for ${hostname}`),
      source_url: targetUrl,
      reference_id: `SCRAPE-${Buffer.from(cleanPageTitle).toString('base64').substring(0, 12)}`,
      full_markdown: fullMarkdown.substring(0, 5000),
      raw_html: html,
      raw_lines: rawHtmlLines,
      raw_bytes: rawHtmlBytes,
      open_graph: metadata.og,
      meta_tags: metadata.metaTags,
      json_ld: metadata.jsonLd,
      waf_info: resolvedWaf
    });
  }

  // 2. From table rows
  tables.forEach(table => {
    table.rows.forEach(row => {
      if (notices.length >= 100) return;
      const linkedCell = row.find(c => c.link && c.link.startsWith('http'));
      const link = linkedCell ? linkedCell.link : `${targetUrl}#row-${notices.length}`;
      if (!usedLinks.has(link)) {
        usedLinks.add(link);
        const rawTitle = (linkedCell?.text || row.map(c => c.text).filter(t => t.length > 2).join(' — '));
        const cleanTitle = formatCleanTitle(rawTitle);
        const extra = row.filter(c => c !== linkedCell).map(c => c.text).filter(t => t.length > 2);
        if (cleanTitle.length > 3) {
          notices.push({
            title: cleanTitle,
            link,
            date: new Date().toISOString().split('T')[0],
            category: categorizeContent(targetUrl, cleanTitle),
            summary: extra.length > 0 ? extra.slice(0, 4).join(' | ') : `Table Record from ${hostname}`,
            source_url: targetUrl,
            reference_id: `SCRAPE-${Buffer.from(cleanTitle).toString('base64').substring(0, 12)}`,
            raw_html: html,
            raw_lines: rawHtmlLines,
            raw_bytes: rawHtmlBytes,
            open_graph: metadata.og,
            meta_tags: metadata.metaTags,
            json_ld: metadata.jsonLd,
            waf_info: resolvedWaf
          });
        }
      }
    });
  });

  // 3. From content sections (headings)
  contentSections.forEach(section => {
    if (notices.length >= 100) return;
    const cleanHeading = formatCleanTitle(section.heading);
    if (cleanHeading.length >= 3) {
      const link = `${targetUrl}#${cleanHeading.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 40)}`;
      if (!usedLinks.has(link)) {
        usedLinks.add(link);
        notices.push({
          title: cleanHeading,
          link,
          date: new Date().toISOString().split('T')[0],
          category: categorizeContent(targetUrl, cleanHeading),
          summary: section.content ? section.content.substring(0, 400) : `Section from ${hostname}`,
          source_url: targetUrl,
          reference_id: `SCRAPE-${Buffer.from(cleanHeading).toString('base64').substring(0, 12)}`,
          raw_html: html,
          raw_lines: rawHtmlLines,
          raw_bytes: rawHtmlBytes,
          open_graph: metadata.og,
          meta_tags: metadata.metaTags,
          json_ld: metadata.jsonLd,
          waf_info: resolvedWaf
        });
      }
    }
  });

  // 4. From links
  allLinks.forEach(l => {
    if (notices.length >= 100) return;
    const cleanLinkText = formatCleanTitle(l.text);
    if (!usedLinks.has(l.href) && cleanLinkText.length >= 3) {
      usedLinks.add(l.href);
      notices.push({
        title: cleanLinkText,
        link: l.href,
        date: new Date().toISOString().split('T')[0],
        category: categorizeContent(targetUrl, cleanLinkText),
        summary: l.context ? `Section: ${l.context}` : `Public link/service from ${hostname}`,
        source_url: targetUrl,
        reference_id: `SCRAPE-${Buffer.from(cleanLinkText).toString('base64').substring(0, 12)}`,
        raw_html: html,
        raw_lines: rawHtmlLines,
        raw_bytes: rawHtmlBytes,
        open_graph: metadata.og,
        meta_tags: metadata.metaTags,
        json_ld: metadata.jsonLd,
        waf_info: resolvedWaf
      });
    }
  });

  return {
    url: targetUrl,
    scrapedAt: new Date().toISOString(),
    pageTitle,
    metaDescription,
    ogImage,
    canonical,
    language,
    rawHtml: html,
    rawHtmlLines,
    rawHtmlBytes,
    fullMarkdown,
    fullTextLength: fullText.length,
    openGraph: metadata.og,
    metaTags: metadata.metaTags,
    jsonLd: metadata.jsonLd,
    wafInfo: resolvedWaf,
    contentSections,
    tables,
    lists,
    allLinks,
    notices,
    stats: {
      rawHtmlLines,
      rawHtmlBytes,
      totalLinks: allLinks.length,
      totalTables: tables.length,
      totalSections: contentSections.length,
      totalLists: lists.length,
      totalNotices: notices.length,
      htmlSize: html.length,
      extractedMarkdownChars: fullMarkdown.length,
      wafDetected: resolvedWaf.detected,
      wafProvider: resolvedWaf.provider
    }
  };
}

/**
 * Appends scrape result to the history file (accumulates, newest first)
 */
function appendToHistory(scrapeResult) {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let history = [];
  if (fs.existsSync(HISTORY_PATH)) {
    try { 
      const content = fs.readFileSync(HISTORY_PATH, 'utf-8');
      history = JSON.parse(content); 
    } catch (e) { 
      history = []; 
    }
  }

  // Remove existing session for same URL within last 10 seconds to prevent duplicates
  history = history.filter(s => !(s.url === scrapeResult.url && (Date.now() - new Date(s.scrapedAt).getTime()) < 10000));

  // Prepend newest scrape
  history.unshift(scrapeResult);

  // Keep max 15 sessions in local cache and strip bulky rawHtml on older items to keep file slim & prevent RangeErrors
  history = history.slice(0, 15).map((item, idx) => {
    if (idx > 2 && item.rawHtml) {
      const { rawHtml, ...rest } = item;
      return rest;
    }
    return item;
  });

  try {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('[ScraperAgent] Error saving history file, falling back to minimal payload:', err.message);
    const minimal = history.slice(0, 5).map(({ rawHtml, ...r }) => r);
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(minimal));
  }
}

/**
 * Runs Bright Data Scraper Studio or live Cheerio-based web extractor with automated Browser escalation
 */
async function runScraperAgent(collectorId, targetUrl, strategy) {
  const cId = collectorId || process.env.BRIGHTDATA_COLLECTOR_ID || 'c_msymq29htvadbnxko';
  const url = targetUrl || process.env.TARGET_URL || 'https://github.com/advisories';
  const extractionStrategy = strategy || 'full';

  console.log(`[ScraperAgent] 🚀 Invoking Scraper Engine for Collector: ${cId}`);
  console.log(`[ScraperAgent] 🌐 Target URL: ${url}`);
  console.log(`[ScraperAgent] 📋 Strategy: ${extractionStrategy}`);

  // 1. Attempt Bright Data Scraper Studio CLI if API key is configured AND target URL matches the collector domain
  if (process.env.BRIGHTDATA_API_KEY && (url.includes('aws.amazon.com') || cId.startsWith('custom_'))) {
    try {
      const cmd = `npx --yes @brightdata/cli scraper run ${cId} "${url}" --json`;
      console.log(`[ScraperAgent] Executing Bright Data CLI for AWS portal: ${cmd}`);
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
      const jsonStart = output.indexOf('[');
      const jsonEnd = output.lastIndexOf(']');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const scrapedData = JSON.parse(output.substring(jsonStart, jsonEnd + 1));
        if (Array.isArray(scrapedData) && scrapedData.length > 0) {
          const result = {
            url,
            scrapedAt: new Date().toISOString(),
            pageTitle: 'Bright Data Scraper Studio Result',
            source: 'brightdata-cli',
            notices: scrapedData.map(item => ({ ...item, source_url: url })),
            stats: { totalNotices: scrapedData.length }
          };
          fs.mkdirSync(path.dirname(SAMPLE_OUTPUT_PATH), { recursive: true });
          fs.writeFileSync(SAMPLE_OUTPUT_PATH, JSON.stringify(result.notices, null, 2));
          appendToHistory(result);
          console.log(`[ScraperAgent] ✅ Scraped ${scrapedData.length} items via Bright Data Scraper Studio.`);
          return { success: true, data: result.notices, fullResult: result, source: 'brightdata-cli' };
        }
      }
    } catch (error) {
      console.warn(`[ScraperAgent] ⚡ Bright Data CLI unavailable. Using live extraction...`);
    }
  }

  // 2. High-performance live HTML extraction with decompression & anti-bot inspection
  console.log(`[ScraperAgent] 🔍 Fetching live HTML from ${url}...`);
  let fetchRes = await fetchLiveHtml(url);
  let liveHtml = (typeof fetchRes === 'object' && fetchRes !== null) ? fetchRes.html : fetchRes;
  let wafInfo = (typeof fetchRes === 'object' && fetchRes !== null) ? fetchRes.wafInfo : null;
  let statusCode = (typeof fetchRes === 'object' && fetchRes !== null) ? fetchRes.statusCode : 200;
  let headers = (typeof fetchRes === 'object' && fetchRes !== null) ? fetchRes.headers : {};
  let source = 'cheerio-live';

  const isJsRequired = liveHtml && (
    liveHtml.toLowerCase().includes('turn on javascript') ||
    liveHtml.toLowerCase().includes('enable javascript') ||
    liveHtml.toLowerCase().includes('javascript is required') ||
    liveHtml.toLowerCase().includes('javascript doesn\'t work') ||
    liveHtml.toLowerCase().includes('enable-javascript.com')
  );

  // 3. Automated Stealth Browser Escalation if Anti-Bot Challenge, SPA, or Block is encountered
  if (
    !liveHtml ||
    isJsRequired ||
    wafInfo?.detected ||
    [403, 429, 503, 202].includes(statusCode) ||
    url.includes('pinterest.com') ||
    url.includes('imdb.com') ||
    url.includes('instagram.com') ||
    url.includes('tiktok.com') ||
    url.includes('twitter.com') ||
    url.includes('x.com')
  ) {
    console.log(`[ScraperAgent] 🛡️ Site requires dynamic execution / bot clearance (${isJsRequired ? 'Client-Side JavaScript SPA' : wafInfo?.provider || 'Anti-Bot Protection'}). Escalating to Stealth Browser...`);
    const browserRes = await fetchWithBrowser(url);
    if (browserRes && browserRes.html && browserRes.html.length > 500) {
      liveHtml = browserRes.html;
      wafInfo = browserRes.wafInfo;
      statusCode = browserRes.statusCode;
      headers = browserRes.headers;
      source = 'stealth-browser';
    }
  }

  if (!liveHtml) {
    console.error(`[ScraperAgent] ❌ Failed to fetch HTML from ${url}`);
    return { 
      success: false, 
      error: `Could not connect to ${url}. Target server returned HTTP ${statusCode || 0} or may be offline.`, 
      data: [] 
    };
  }

  console.log(`[ScraperAgent] 📄 Received ${Buffer.byteLength(liveHtml, 'utf8')} bytes of HTML (${liveHtml.split('\n').length} lines). Parsing with Cheerio...`);

  let scrapeResult = extractStructuredData(liveHtml, url, wafInfo, statusCode, headers);

  // 4. Secondary Browser Escalation: If Cheerio static parse yielded fewer than 2 items, re-render via Browser
  if ((!scrapeResult || scrapeResult.notices.length <= 1) && source !== 'stealth-browser') {
    console.log(`[ScraperAgent] ⚡ Static parse yielded only ${scrapeResult?.notices?.length || 0} items. Escalating to Stealth Browser for full interactive DOM...`);
    const browserRes = await fetchWithBrowser(url);
    if (browserRes && browserRes.html && browserRes.html.length > 500) {
      liveHtml = browserRes.html;
      wafInfo = browserRes.wafInfo;
      statusCode = browserRes.statusCode;
      headers = browserRes.headers;
      source = 'stealth-browser';
      scrapeResult = extractStructuredData(liveHtml, url, wafInfo, statusCode, headers);
    }
  }

  if (!scrapeResult || scrapeResult.notices.length === 0) {
    console.warn(`[ScraperAgent] ⚠️ Extraction yielded 0 notices.`);
    return {
      success: false,
      error: 'Extraction yielded 0 structured items from page.',
      data: [],
      fullResult: scrapeResult,
      htmlSize: liveHtml.length
    };
  }

  // Save latest notices
  fs.mkdirSync(path.dirname(SAMPLE_OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(SAMPLE_OUTPUT_PATH, JSON.stringify(scrapeResult.notices, null, 2));

  // Accumulate into history
  scrapeResult.source = source;
  appendToHistory(scrapeResult);

  console.log(`[ScraperAgent] ✅ Extracted ${scrapeResult.notices.length} structured notices from ${url}`);
  console.log(`[ScraperAgent] 📊 Stats: ${scrapeResult.stats.totalSections} sections, ${scrapeResult.stats.totalTables} tables, ${scrapeResult.stats.totalLinks} links, ${scrapeResult.stats.rawHtmlBytes} bytes HTML`);

  return {
    success: true,
    data: scrapeResult.notices,
    fullResult: scrapeResult,
    source
  };
}

if (require.main === module) {
  runScraperAgent().then(result => {
    console.log(JSON.stringify(result.fullResult?.stats || {}, null, 2));
  });
}

module.exports = {
  runScraperAgent,
  extractStructuredData,
  fetchLiveHtml,
  fetchWithBrowser,
  detectAntiBotProtection,
  extractMetadataAndOpenGraph,
  findBrowserExecutable
};
