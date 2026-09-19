const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Realistic browser User-Agent pool for anti-bot evasion
 */
const USER_AGENTS = [
  // Chrome on Windows 11 / 10
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  // Safari on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
  // Firefox on Windows & Linux
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
  // Microsoft Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  // Chrome on Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

/**
 * Select a random User-Agent from the rotation pool
 * @returns {string}
 */
const getRandomUserAgent = () => {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index];
};

/**
 * Generate authentic browser request headers
 * @param {string} [customUserAgent]
 * @returns {object}
 */
const getBrowserHeaders = (customUserAgent) => {
  const userAgent = customUserAgent || getRandomUserAgent();
  const isMac = userAgent.includes('Macintosh');
  const isLinux = userAgent.includes('Linux');
  const platform = isMac ? '"macOS"' : isLinux ? '"Linux"' : '"Windows"';

  return {
    'User-Agent': userAgent,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': platform,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
};

/**
 * Cleans extracted text by stripping excess spaces, empty lines, and non-printable chars
 * @param {string} raw
 * @returns {string}
 */
const cleanExtractedLines = (raw) => {
  if (!raw || typeof raw !== 'string') return '';

  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ') // non-breaking space
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, index, arr) => {
      if (line.length === 0) {
        return index > 0 && arr[index - 1].length > 0;
      }
      return true;
    })
    .join('\n')
    .trim();
};

/**
 * Strip scripts, styles, forms, and unwanted UI chrome from Cheerio instance
 * @param {object} $
 */
const stripUnwantedElements = ($) => {
  $(
    'script:not([type="application/ld+json"]), style, noscript, nav, footer, header, svg, iframe, form, button, select, input, textarea, .cookie-banner, .advertisement, [aria-hidden="true"]'
  ).remove();

  $('br').replaceWith('\n');
  $('p, div, li, h1, h2, h3, h4, h5, h6, tr, article, section, blockquote').each(
    (_, element) => {
      $(element).after('\n');
    }
  );
  $('span, a, b, strong, em, td, th').each((_, element) => {
    $(element).after(' ');
  });
};

/**
 * Detect job board from URL
 * @param {string} url
 * @returns {'linkedin' | 'greenhouse' | 'naukri' | 'generic'}
 */
const detectJobBoard = (url = '') => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('greenhouse.io')) return 'greenhouse';
  if (lowerUrl.includes('linkedin.com')) return 'linkedin';
  if (lowerUrl.includes('naukri.com')) return 'naukri';
  return 'generic';
};

/**
 * Extract company name from URL structure (e.g. boards.greenhouse.io/company-name/jobs/123)
 * @param {string} url
 * @returns {string}
 */
const deriveCompanyFromUrl = (url = '') => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('greenhouse.io')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] && parts[0] !== 'embed' && parts[0] !== 'jobs') {
        return parts[0].replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }
  } catch (_e) {
    // Ignore URL parse error
  }
  return '';
};

/**
 * Parser for Greenhouse job postings (boards.greenhouse.io)
 * @param {object} $ - Cheerio instance
 * @param {string} url
 * @returns {{ roleTitle: string, company: string, location: string, rawText: string }}
 */
const parseGreenhouseJob = ($, url) => {
  const roleTitle =
    $('h1.app-title').first().text().trim() ||
    $('h1.job-name').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('title').first().text().replace(/[-|].*$/, '').trim();

  let company =
    $('.company-name').first().text().trim() ||
    $('meta[property="og:site_name"]').attr('content') ||
    $('span.company-name').first().text().trim() ||
    deriveCompanyFromUrl(url);

  company = company.replace(/^[Aa]t\s+/, '').trim();

  const location =
    $('.location').first().text().trim() ||
    $('.body--metadata').first().text().trim() ||
    '';

  const contentEl =
    $('#content').length > 0
      ? $('#content')
      : $('#app-body').length > 0
        ? $('#app-body')
        : $('.content').length > 0
          ? $('.content')
          : $('main, article, [role="main"]');

  const rawText = cleanExtractedLines(contentEl.text() || $.text());

  return {
    roleTitle,
    company,
    location,
    rawText,
    board: 'greenhouse',
  };
};

/**
 * Parser for LinkedIn job postings (linkedin.com/jobs)
 * @param {object} $ - Cheerio instance
 * @returns {{ roleTitle: string, company: string, location: string, rawText: string }}
 */
const parseLinkedInJob = ($) => {
  const roleTitle =
    $('h1.top-card-layout__title').first().text().trim() ||
    $('h1.job-details-jobs-unified-top-card__job-title').first().text().trim() ||
    $('h1.topcard__title').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.replace(/\|.*$/, '').trim() ||
    $('h1').first().text().trim();

  const company =
    $('a.topcard__org-name-link').first().text().trim() ||
    $('.job-details-jobs-unified-top-card__company-name').first().text().trim() ||
    $('span.topcard__flavor:first-child').first().text().trim() ||
    $('meta[property="og:description"]')
      .attr('content')
      ?.match(/at\s+([^.]+)/i)?.[1]
      ?.trim() ||
    '';

  const location =
    $('.topcard__flavor--bullet').first().text().trim() ||
    $('.job-details-jobs-unified-top-card__primary-description-container').first().text().trim() ||
    $('span.topcard__flavor--bullet').first().text().trim() ||
    '';

  const contentEl =
    $('.show-more-less-html__markup').length > 0
      ? $('.show-more-less-html__markup')
      : $('.description__text').length > 0
        ? $('.description__text')
        : $('#job-details').length > 0
          ? $('#job-details')
          : $('.jobs-description__content').length > 0
            ? $('.jobs-description__content')
            : $('main, article');

  // Strip UI artifacts specific to LinkedIn public job views
  contentEl.find('.show-more-less-html__button, button, .jobs-box__sub-title, .report-job, [class*="report"]').remove();
  $('.report-job, [class*="report"]').remove();

  let rawText = cleanExtractedLines(contentEl.text() || $.text());

  // Clean redundant boilerplate lines
  rawText = rawText
    .replace(/^About the job\s*/i, '')
    .replace(/Show more\s*$/i, '')
    .replace(/Show less\s*$/i, '')
    .replace(/Report this job\s*$/i, '')
    .trim();

  return {
    roleTitle,
    company,
    location,
    rawText,
    board: 'linkedin',
  };
};

/**
 * Parser for Naukri job postings (naukri.com)
 * @param {object} $ - Cheerio instance
 * @returns {{ roleTitle: string, company: string, location: string, rawText: string }}
 */
const parseNaukriJob = ($) => {
  const roleTitle =
    $('[class*="styles_jd-header-title"]').first().text().trim() ||
    $('h1.styles_jd-header-title__rZwM1').first().text().trim() ||
    $('h1.jd-header-title').first().text().trim() ||
    $('h1.title').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.replace(/\|.*$/, '').trim() ||
    $('h1').first().text().trim();

  const company =
    $('[class*="styles_jd-header-comp-name"] a').first().text().trim() ||
    $('[class*="styles_jd-header-comp-name"]').first().text().trim() ||
    $('.styles_jd-header-comp-name__MvqAI a').first().text().trim() ||
    $('.styles_jd-header-comp-name__MvqAI').first().text().trim() ||
    $('.comp-name').first().text().trim() ||
    $('meta[name="twitter:description"]')
      .attr('content')
      ?.match(/at\s+([^.]+)/i)?.[1]
      ?.trim() ||
    '';

  const location =
    $('[class*="styles_jhc__loc"]').first().text().trim() ||
    $('.styles_jhc__loc___O0JW').first().text().trim() ||
    $('.loc').first().text().trim() ||
    '';

  const contentEl =
    $('[class*="styles_job-desc-container"]').length > 0
      ? $('[class*="styles_job-desc-container"]')
      : $('.styles_job-desc-container__txpYf').length > 0
        ? $('.styles_job-desc-container__txpYf')
        : $('.dang-inner-html').length > 0
          ? $('.dang-inner-html')
          : $('.job-desc').length > 0
            ? $('.job-desc')
            : $('section.job-desc, main, article');

  // Strip recruiter contact boxes and disclaimers
  contentEl.find('.recruiter-details, .disclaimer, [class*="styles_jdc__bottom-details"]').remove();

  let rawText = cleanExtractedLines(contentEl.text() || $.text());
  rawText = rawText
    .replace(/Recruiter details:.*$/im, '')
    .replace(/Beware of fraudulent job offers.*$/im, '')
    .trim();

  return {
    roleTitle,
    company,
    location,
    rawText,
    board: 'naukri',
  };
};

/**
 * Generic Fallback Parser for arbitrary career pages
 * Inspects JSON-LD Schema.org JobPosting, OpenGraph tags, and semantic elements
 * @param {object} $ - Cheerio instance
 * @returns {{ roleTitle: string, company: string, location: string, rawText: string }}
 */
const parseGenericJob = ($) => {
  let roleTitle = '';
  let company = '';
  let location = '';
  let rawText = '';

  // 1. Check for Schema.org JSON-LD JobPosting metadata
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const item = Array.isArray(json)
        ? json.find((i) => i['@type'] === 'JobPosting')
        : json['@type'] === 'JobPosting'
          ? json
          : json['@graph']?.find((i) => i['@type'] === 'JobPosting');

      if (item) {
        if (!roleTitle && item.title) roleTitle = String(item.title).trim();
        if (!company && item.hiringOrganization?.name) {
          company = String(item.hiringOrganization.name).trim();
        }
        if (!location && item.jobLocation?.address) {
          const addr = item.jobLocation.address;
          location = typeof addr === 'string' ? addr : addr.addressLocality || '';
        }
        if (!rawText && item.description) {
          const desc$ = cheerio.load(item.description);
          rawText = cleanExtractedLines(desc$.text());
        }
      }
    } catch (_err) {
      // Ignore JSON parse errors in inline script tags
    }
  });

  // Remove scripts now that JSON-LD has been parsed
  $('script').remove();

  // 2. OpenGraph / Meta Tag Fallbacks
  if (!roleTitle) {
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) {
      // Common pattern: "Senior Engineer at Acme Corp" or "Acme Corp - Senior Engineer"
      const atMatch = ogTitle.match(/^(.*?)\s+at\s+(.*?)$/i);
      const dashMatch = ogTitle.match(/^(.*?)\s*[-–|:]\s*(.*?)$/);
      if (atMatch) {
        roleTitle = atMatch[1].trim();
        if (!company) company = atMatch[2].trim();
      } else if (dashMatch) {
        roleTitle = dashMatch[1].trim();
        if (!company) company = dashMatch[2].trim();
      } else {
        roleTitle = ogTitle.trim();
      }
    }
  }

  if (!roleTitle) {
    roleTitle = $('h1').first().text().trim() || $('title').first().text().trim();
  }

  if (!company) {
    company =
      $('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="author"]').attr('content') ||
      '';
  }

  // 3. Main content body extraction
  if (!rawText) {
    const mainContent = $(
      'main, article, [role="main"], #job-description, .job-description, .job-details, .description, #content'
    ).first();

    const targetElement = mainContent.length > 0 ? mainContent : $('body');
    rawText = cleanExtractedLines(targetElement.text() || $.text());
  }

  return {
    roleTitle: roleTitle || 'Target Role',
    company: company || 'Target Company',
    location,
    rawText,
    board: 'generic',
  };
};

/**
 * Normalizes and extracts clean readable text and metadata from HTML markup
 * @param {string} html - Raw HTML document or fragment
 * @param {string} [url=''] - Source URL for board-specific detection
 * @returns {{ text: string, title: string, company: string, roleTitle: string, location: string, board: string }}
 */
const extractCleanText = (html, url = '') => {
  if (!html || typeof html !== 'string') {
    return {
      text: '',
      title: '',
      company: '',
      roleTitle: '',
      location: '',
      board: 'generic',
    };
  }

  const $ = cheerio.load(html);

  // Preserve document title before stripping head
  const docTitle = ($('title').first().text() || $('h1').first().text() || '').trim();

  // Strip navigation, scripts, styles, buttons
  stripUnwantedElements($);

  const board = detectJobBoard(url);
  let parsedResult;

  switch (board) {
    case 'greenhouse':
      parsedResult = parseGreenhouseJob($, url);
      break;
    case 'linkedin':
      parsedResult = parseLinkedInJob($, url);
      break;
    case 'naukri':
      parsedResult = parseNaukriJob($, url);
      break;
    default:
      parsedResult = parseGenericJob($, url);
  }

  // If board-specific parser extracted insufficient content (< 30 chars), fallback to generic
  if (!parsedResult.rawText || parsedResult.rawText.length < 30) {
    parsedResult = parseGenericJob($, url);
  }

  return {
    text: parsedResult.rawText,
    title: parsedResult.roleTitle || docTitle,
    company: parsedResult.company || 'Target Company',
    roleTitle: parsedResult.roleTitle || docTitle || 'Target Role',
    location: parsedResult.location || '',
    board,
  };
};

/**
 * Sleep helper for retry exponential backoff
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches HTML from a remote URL with anti-bot headers, user-agent rotation, and retries
 * @param {string} url - Target URL of the job posting
 * @param {object} [options={}] - Custom options (timeout, retries, headers, etc.)
 * @returns {Promise<{ rawText: string, title: string, company: string, roleTitle: string, location: string, board: string, url: string }>}
 */
const scrapeJobDescription = async (url, options = {}) => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('Valid URL is required for scraping (must start with http:// or https://)');
  }

  const trimmedUrl = url.trim();
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error('Scraper only supports HTTP and HTTPS URLs (must start with http:// or https://)');
  }

  const maxRetries = typeof options.retries === 'number' ? options.retries : 2;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const userAgent = getRandomUserAgent();
    const headers = {
      ...getBrowserHeaders(userAgent),
      ...(options.headers || {}),
    };

    try {
      const response = await axios.get(trimmedUrl, {
        timeout: options.timeout || 12000,
        maxContentLength: options.maxContentLength || 10 * 1024 * 1024,
        headers,
        validateStatus: (status) => status >= 200 && status < 300,
        ...options,
      });

      const extracted = extractCleanText(response.data, trimmedUrl);

      return {
        rawText: extracted.text,
        title: extracted.title,
        company: extracted.company,
        roleTitle: extracted.roleTitle,
        location: extracted.location,
        board: extracted.board,
        url: trimmedUrl,
      };
    } catch (error) {
      lastError = error;

      // Do not retry on client 4xx errors other than 403 or 429
      if (
        error.response &&
        error.response.status >= 400 &&
        error.response.status < 500 &&
        error.response.status !== 403 &&
        error.response.status !== 429
      ) {
        break;
      }

      if (attempt < maxRetries) {
        // Exponential backoff: 600ms, 1200ms...
        const backoffMs = Math.pow(2, attempt) * 600;
        await sleep(backoffMs);
      }
    }
  }

  // Format clean human-readable error message
  if (lastError.response) {
    throw new Error(
      `Failed to fetch URL: HTTP ${lastError.response.status} (${lastError.response.statusText || 'Error'})`
    );
  }
  if (lastError.code === 'ECONNABORTED') {
    throw new Error('Request timed out while fetching job posting URL');
  }
  throw new Error(`Scraper request failed: ${lastError.message}`);
};

module.exports = {
  scrapeJobDescription,
  extractCleanText,
  detectJobBoard,
  getRandomUserAgent,
  getBrowserHeaders,
  USER_AGENTS,
};
