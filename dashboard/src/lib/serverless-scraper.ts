import * as cheerio from 'cheerio';
import zlib from 'zlib';
import https from 'https';
import http from 'http';

export interface ScrapedNotice {
  title: string;
  link: string;
  date: string;
  category: string;
  summary?: string;
  reference_id?: string;
  source_url?: string;
  scraped_at?: string;
  raw_html?: string;
  raw_lines?: number;
  raw_bytes?: number;
  open_graph?: Record<string, any>;
  meta_tags?: Record<string, string>;
  json_ld?: any[];
  waf_info?: {
    detected: boolean;
    provider?: string;
    reason?: string;
    recommendation?: string;
    statusCode?: number;
  };
  full_markdown?: string;
  content_sections?: Array<{ heading: string; content: string; level?: number }>;
  session_tables?: Array<{ headers: string[]; rows: Array<Array<{ text: string; link?: string }>>; rowCount?: number }>;
  session_stats?: Record<string, any>;
}

export interface ScrapeSessionResult {
  url: string;
  scrapedAt: string;
  pageTitle: string;
  metaDescription?: string;
  source: string;
  notices: ScrapedNotice[];
  rawHtml: string;
  rawHtmlLines: number;
  rawHtmlBytes: number;
  openGraph: Record<string, any>;
  metaTags: Record<string, string>;
  jsonLd: any[];
  wafInfo: {
    detected: boolean;
    provider?: string;
    reason?: string;
    recommendation?: string;
    statusCode?: number;
  };
  fullMarkdown: string;
  contentSections: Array<{ heading: string; content: string; level?: number }>;
  tables: Array<{ headers: string[]; rows: Array<Array<{ text: string; link?: string }>>; rowCount?: number }>;
  stats: Record<string, any>;
}

export function normalizeTargetUrl(inputUrl: string): string {
  let url = (inputUrl || '').trim();
  if (!url) return 'https://aws.amazon.com/new/';
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

function detectAntiBotProtection(html: string, statusCode = 200, headers: Record<string, any> = {}) {
  const lowerHtml = (html || '').toLowerCase();
  const serverHeader = (headers['server'] || '').toLowerCase();

  if (
    lowerHtml.includes('token.awswaf.com') ||
    lowerHtml.includes('awswafintegration') ||
    lowerHtml.includes('window.awswafcookiedomainlist') ||
    (lowerHtml.includes('challenge-container') && lowerHtml.includes('awswaf'))
  ) {
    return {
      detected: true,
      provider: 'AWS WAF Bot Management',
      reason: 'Target site presented an AWS WAF challenge.',
      recommendation: 'Captured DOM state with available structured metadata.',
      statusCode: statusCode || 202
    };
  }

  if (
    lowerHtml.includes('challenges.cloudflare.com') ||
    lowerHtml.includes('cf-browser-verification') ||
    (lowerHtml.includes('just a moment...') && serverHeader.includes('cloudflare'))
  ) {
    return {
      detected: true,
      provider: 'Cloudflare Turnstile',
      reason: 'Cloudflare verification challenge detected.',
      recommendation: 'Captured Cloudflare clearance state.',
      statusCode: statusCode || 403
    };
  }

  if (lowerHtml.includes('akam/13/pixel') || (lowerHtml.includes('access denied') && lowerHtml.includes('akamai'))) {
    return {
      detected: true,
      provider: 'Akamai Bot Manager',
      reason: 'Akamai Edge sensor detected.',
      recommendation: 'Extracted available DOM payload.',
      statusCode: statusCode || 403
    };
  }

  return {
    detected: false,
    provider: 'Direct HTML / Serverless Stream',
    reason: 'Clean HTML response received.',
    recommendation: 'None needed.',
    statusCode: statusCode || 200
  };
}

export function fetchLiveHtml(targetUrl: string, redirectCount = 0, cookieJar = ''): Promise<{ html: string; statusCode: number; headers: Record<string, any>; wafInfo: any }> {
  return new Promise((resolve) => {
    try {
      const sanitizedUrl = normalizeTargetUrl(targetUrl);

      if (redirectCount > 5) {
        resolve({ html: '', statusCode: 310, headers: {}, wafInfo: { detected: false, provider: 'Too Many Redirects' } });
        return;
      }

      const parsedUrl = new URL(sanitizedUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: (parsedUrl.pathname || '/') + (parsedUrl.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Ch-Ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Upgrade-Insecure-Requests': '1',
          ...(cookieJar ? { 'Cookie': cookieJar } : {})
        },
        timeout: 9000
      };

      if (isHttps) {
        options.rejectUnauthorized = false;
      }

      const req = client.request(options, (res) => {
        let currentCookies = cookieJar;
        if (res.headers['set-cookie']) {
          const newCookies = res.headers['set-cookie'].map((c: string) => c.split(';')[0]).join('; ');
          currentCookies = cookieJar ? `${cookieJar}; ${newCookies}` : newCookies;
        }

        if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            redirectUrl = parsedUrl.origin + redirectUrl;
          } else if (!redirectUrl.startsWith('http')) {
            try { redirectUrl = new URL(redirectUrl, sanitizedUrl).href; } catch { redirectUrl = sanitizedUrl; }
          }
          return fetchLiveHtml(redirectUrl, redirectCount + 1, currentCookies).then(resolve);
        }

        const encoding = res.headers['content-encoding'];
        let stream: any = res;
        if (encoding === 'gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        } else if (encoding === 'br') {
          stream = res.pipe(zlib.createBrotliDecompress());
        }

        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        stream.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          const html = rawBuffer.toString('utf-8');
          const wafInfo = detectAntiBotProtection(html, res.statusCode || 200, res.headers);
          resolve({
            html,
            statusCode: res.statusCode || 200,
            headers: res.headers,
            wafInfo
          });
        });

        stream.on('error', () => {
          resolve({ html: '', statusCode: res.statusCode || 500, headers: res.headers, wafInfo: null });
        });
      });

      req.on('error', () => {
        resolve({ html: '', statusCode: 0, headers: {}, wafInfo: null });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ html: '', statusCode: 408, headers: {}, wafInfo: null });
      });

      req.end();
    } catch {
      resolve({ html: '', statusCode: 0, headers: {}, wafInfo: null });
    }
  });
}

function categorizeContent(targetUrl: string, text: string): string {
  const lower = (text || '').toLowerCase();
  const lowerUrl = (targetUrl || '').toLowerCase();

  if (lower.includes('security') || lower.includes('patch') || lower.includes('vulnerability') || lower.includes('cve') || lower.includes('cwe') || lower.includes('advisory')) return 'Security';
  if (lower.includes('ai') || lower.includes('llm') || lower.includes('gemini') || lower.includes('gpt') || lower.includes('model') || lower.includes('claude') || lower.includes('deepseek')) return 'Artificial Intelligence';
  if (lower.includes('compute') || lower.includes('ec2') || lower.includes('server') || lower.includes('cluster') || lower.includes('kubernetes') || lower.includes('cloud')) return 'Cloud & Infra';
  if (lower.includes('storage') || lower.includes('s3') || lower.includes('database') || lower.includes('dynamodb') || lower.includes('sql') || lower.includes('mongo')) return 'Storage & DB';
  if (lower.includes('analytics') || lower.includes('data') || lower.includes('metrics') || lower.includes('graph')) return 'Analytics';
  if (lower.includes('code') || lower.includes('repo') || lower.includes('commit') || lower.includes('branch') || lower.includes('git') || lower.includes('developer') || lower.includes('build')) return 'Engineering';
  if (lower.includes('fashion') || lower.includes('style') || lower.includes('dress') || lower.includes('wear')) return 'Fashion & Style';
  if (lower.includes('food') || lower.includes('recipe') || lower.includes('dinner') || lower.includes('meal')) return 'Food & Dining';
  if (lower.includes('art') || lower.includes('design') || lower.includes('decor') || lower.includes('photo') || lower.includes('creative')) return 'Design & Art';
  if (lower.includes('news') || lower.includes('post') || lower.includes('update') || lower.includes('release')) return 'Announcement';
  if (lowerUrl.includes('github')) return 'Engineering';
  if (lowerUrl.includes('youtube')) return 'Media & Video';
  if (lowerUrl.includes('news.ycombinator.com') || lowerUrl.includes('techcrunch')) return 'Tech News';
  if (lowerUrl.includes('pinterest.com')) return 'Discovery';

  return 'General Update';
}

function formatCleanTitle(text: string): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').replace(/[|•\t\r\n]/g, ' ').trim().substring(0, 180);
}

export function extractStructuredDataServerless(html: string, targetUrl: string, wafInfo?: any): ScrapeSessionResult {
  const sanitizedUrl = normalizeTargetUrl(targetUrl);
  const $ = cheerio.load(html || '');
  const urlObj = new URL(sanitizedUrl);
  const origin = urlObj.origin;
  const hostname = urlObj.hostname;

  const rawHtmlLines = html ? html.split('\n').length : 0;
  const rawHtmlBytes = html ? Buffer.byteLength(html, 'utf8') : 0;

  // Metadata Extraction
  const metaTags: Record<string, string> = {};
  const og: Record<string, any> = {};
  const jsonLd: any[] = [];

  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('http-equiv');
    const content = $(el).attr('content');
    if (name && content !== undefined) {
      metaTags[name] = content;
      const lowerName = name.toLowerCase().trim();
      if (lowerName.startsWith('og:')) og[lowerName.replace('og:', '')] = content;
      if (lowerName.startsWith('twitter:')) og[lowerName.replace('twitter:', '')] = content;
    }
  });

  // Parse JSON-LD structured schemas
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text().trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) jsonLd.push(...parsed);
        else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) jsonLd.push(...parsed['@graph']);
        else jsonLd.push(parsed);
      }
    } catch {}
  });

  const pageTitle = $('title').text().replace(/\s+/g, ' ').trim() || og.title || metaTags['title'] || hostname;
  const metaDescription = og.description || metaTags['description'] || metaTags['Description'] || '';

  const resolvedOg = {
    title: og.title || pageTitle,
    description: metaDescription,
    image: og.image || '',
    url: og.url || sanitizedUrl,
    site_name: og.site_name || hostname,
    ...og
  };

  if (jsonLd.length === 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": resolvedOg.title,
      "url": sanitizedUrl,
      "description": resolvedOg.description || `Extracted entity from ${hostname}`
    });
  }

  // Clean scripts for body text
  const $clean = cheerio.load(html || '');
  $clean('script, style, noscript, svg, iframe').remove();

  // Full Markdown
  const markdownBlocks: string[] = [];
  $clean('h1, h2, h3, h4, h5, h6, p, ul, ol, table, blockquote, article').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const $el = $clean(el);
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (!text) return;

    if (tag.startsWith('h')) {
      const lvl = parseInt(tag.replace('h', '')) || 2;
      markdownBlocks.push(`${'#'.repeat(lvl)} ${text}\n`);
    } else if (tag === 'p' && text.length > 5) {
      markdownBlocks.push(`${text}\n`);
    } else if (tag === 'blockquote') {
      markdownBlocks.push(`> ${text}\n`);
    }
  });

  const fullMarkdown = markdownBlocks.join('\n');

  // Content Sections
  const contentSections: Array<{ heading: string; content: string; level?: number }> = [];
  $clean('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const heading = $clean(el).text().replace(/\s+/g, ' ').trim();
    if (heading.length < 2 || heading.length > 250) return;

    let content = '';
    let sibling = $clean(el).next();
    let count = 0;
    while (sibling.length && count < 8) {
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(sibling.prop('tagName')?.toLowerCase() || '')) break;
      const text = sibling.text().replace(/\s+/g, ' ').trim();
      if (text.length > 3) {
        content += text + ' ';
        count++;
      }
      sibling = sibling.next();
    }

    contentSections.push({
      heading: formatCleanTitle(heading),
      content: content.trim(),
      level: parseInt(el.tagName?.replace('h', '') || '2')
    });
  });

  // Tables
  const tables: Array<{ headers: string[]; rows: Array<Array<{ text: string; link?: string }>>; rowCount?: number }> = [];
  $clean('table').each((_, table) => {
    const headers: string[] = [];
    $clean(table).find('thead th, thead td, tr:first-child th, tr:first-child td').each((_, th) => {
      headers.push($clean(th).text().replace(/\s+/g, ' ').trim());
    });

    const rows: Array<Array<{ text: string; link?: string }>> = [];
    $clean(table).find('tbody tr, tr').each((_, tr) => {
      const cells: Array<{ text: string; link?: string }> = [];
      $clean(tr).find('td, th').each((_, td) => {
        const text = $clean(td).text().replace(/\s+/g, ' ').trim();
        let link = $clean(td).find('a').attr('href') || '';
        if (link && link.startsWith('/')) link = origin + link;
        cells.push({ text, link });
      });
      if (cells.length > 0 && cells.some(c => c.text.length > 0)) {
        rows.push(cells);
      }
    });

    if (rows.length > 0) {
      tables.push({ headers, rows, rowCount: rows.length });
    }
  });

  // Links
  const allLinks: Array<{ text: string; href: string }> = [];
  const seenHrefs = new Set<string>();
  $clean('a').each((_, el) => {
    let href = $clean(el).attr('href') || '';
    let text = $clean(el).text().replace(/\s+/g, ' ').trim();
    if (!text) text = $clean(el).attr('title') || $clean(el).attr('aria-label') || '';
    if (!text || text.length < 2 || text.length > 250) return;
    if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    if (href.startsWith('/')) href = origin + href;
    else if (!href.startsWith('http')) {
      try { href = new URL(href, sanitizedUrl).href; } catch { href = `${sanitizedUrl}#${text.toLowerCase().replace(/[^a-z0-9]/g, '-')}`; }
    }

    if (seenHrefs.has(href)) return;
    seenHrefs.add(href);
    allLinks.push({ text: formatCleanTitle(text), href });
  });

  // Paragraph & Card Entities (for sites with few headings or dynamic content)
  const paragraphBlocks: Array<{ title: string; content: string }> = [];
  $clean('article, [role="article"], .card, .post, .feed-item, p').each((_, el) => {
    const pText = $clean(el).text().replace(/\s+/g, ' ').trim();
    if (pText.length > 35 && pText.length < 500) {
      const pTitle = pText.split(/[.!?:]/)[0].trim();
      if (pTitle.length >= 5 && pTitle.length <= 120) {
        paragraphBlocks.push({
          title: formatCleanTitle(pTitle),
          content: pText
        });
      }
    }
  });

  // Build Structured Notices
  const notices: ScrapedNotice[] = [];
  const usedLinks = new Set<string>();
  const today = new Date().toISOString().split('T')[0];

  // 1. Primary Page Notice
  if (pageTitle) {
    usedLinks.add(sanitizedUrl);
    notices.push({
      title: formatCleanTitle(pageTitle),
      link: sanitizedUrl,
      date: today,
      category: categorizeContent(sanitizedUrl, pageTitle),
      summary: metaDescription || `Entity summary for ${hostname}`,
      source_url: sanitizedUrl,
      reference_id: `SCRAPE-${Buffer.from(pageTitle).toString('base64').substring(0, 10)}`,
      raw_html: html,
      raw_lines: rawHtmlLines,
      raw_bytes: rawHtmlBytes,
      open_graph: resolvedOg,
      meta_tags: metaTags,
      json_ld: jsonLd,
      waf_info: wafInfo || { detected: false },
      full_markdown: fullMarkdown.substring(0, 4000),
      content_sections: contentSections,
      session_tables: tables
    });
  }

  // 2. From Section Headings
  contentSections.forEach(sec => {
    if (notices.length >= 60) return;
    const link = `${sanitizedUrl}#${sec.heading.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 35)}`;
    if (!usedLinks.has(link) && sec.heading.length >= 3) {
      usedLinks.add(link);
      notices.push({
        title: sec.heading,
        link,
        date: today,
        category: categorizeContent(sanitizedUrl, sec.heading),
        summary: sec.content ? sec.content.substring(0, 300) : `Content section from ${hostname}`,
        source_url: sanitizedUrl,
        reference_id: `SCRAPE-${Buffer.from(sec.heading).toString('base64').substring(0, 10)}`,
        raw_html: html,
        raw_lines: rawHtmlLines,
        raw_bytes: rawHtmlBytes,
        open_graph: resolvedOg,
        meta_tags: metaTags,
        json_ld: jsonLd,
        waf_info: wafInfo || { detected: false }
      });
    }
  });

  // 3. From Table Rows
  tables.forEach(table => {
    table.rows.forEach(row => {
      if (notices.length >= 60) return;
      const linked = row.find(c => c.link && c.link.startsWith('http'));
      const link: string = (linked && linked.link) ? linked.link : `${sanitizedUrl}#row-${notices.length}`;
      if (!usedLinks.has(link)) {
        usedLinks.add(link);
        const title = formatCleanTitle(linked?.text || row.map(c => c.text).filter(t => t.length > 2).join(' — '));
        if (title.length > 3) {
          notices.push({
            title,
            link,
            date: today,
            category: categorizeContent(sanitizedUrl, title),
            summary: row.filter(c => c !== linked).map(c => c.text).join(' | ') || `Table record from ${hostname}`,
            source_url: sanitizedUrl,
            reference_id: `SCRAPE-${Buffer.from(title).toString('base64').substring(0, 10)}`,
            raw_html: html,
            raw_lines: rawHtmlLines,
            raw_bytes: rawHtmlBytes,
            open_graph: resolvedOg,
            meta_tags: metaTags,
            json_ld: jsonLd,
            waf_info: wafInfo || { detected: false }
          });
        }
      }
    });
  });

  // 4. From Links
  allLinks.forEach(l => {
    if (notices.length >= 60) return;
    if (!usedLinks.has(l.href) && l.text.length >= 3) {
      usedLinks.add(l.href);
      notices.push({
        title: l.text,
        link: l.href,
        date: today,
        category: categorizeContent(sanitizedUrl, l.text),
        summary: `Public link/resource extracted from ${hostname}`,
        source_url: sanitizedUrl,
        reference_id: `SCRAPE-${Buffer.from(l.text).toString('base64').substring(0, 10)}`,
        raw_html: html,
        raw_lines: rawHtmlLines,
        raw_bytes: rawHtmlBytes,
        open_graph: resolvedOg,
        meta_tags: metaTags,
        json_ld: jsonLd,
        waf_info: wafInfo || { detected: false }
      });
    }
  });

  // 5. From Paragraph / Card Blocks (Fallback when link/heading extraction is sparse)
  if (notices.length < 5) {
    paragraphBlocks.forEach((pb, idx) => {
      if (notices.length >= 60) return;
      const link = `${sanitizedUrl}#section-${idx + 1}`;
      if (!usedLinks.has(link)) {
        usedLinks.add(link);
        notices.push({
          title: pb.title,
          link,
          date: today,
          category: categorizeContent(sanitizedUrl, pb.title),
          summary: pb.content.substring(0, 300),
          source_url: sanitizedUrl,
          reference_id: `SCRAPE-${Buffer.from(pb.title).toString('base64').substring(0, 10)}`,
          raw_html: html,
          raw_lines: rawHtmlLines,
          raw_bytes: rawHtmlBytes,
          open_graph: resolvedOg,
          meta_tags: metaTags,
          json_ld: jsonLd,
          waf_info: wafInfo || { detected: false }
        });
      }
    });
  }

  return {
    url: sanitizedUrl,
    scrapedAt: new Date().toISOString(),
    pageTitle,
    metaDescription,
    source: 'serverless-extractor',
    notices,
    rawHtml: html,
    rawHtmlLines,
    rawHtmlBytes,
    openGraph: resolvedOg,
    metaTags,
    jsonLd,
    wafInfo: wafInfo || { detected: false },
    fullMarkdown,
    contentSections,
    tables,
    stats: {
      rawHtmlLines,
      rawHtmlBytes,
      totalLinks: allLinks.length,
      totalTables: tables.length,
      totalSections: contentSections.length,
      totalNotices: notices.length
    }
  };
}

export async function scrapeUrlServerless(targetUrl: string): Promise<ScrapeSessionResult> {
  const sanitizedUrl = normalizeTargetUrl(targetUrl);
  const fetchRes = await fetchLiveHtml(sanitizedUrl);
  return extractStructuredDataServerless(fetchRes.html, sanitizedUrl, fetchRes.wafInfo);
}
