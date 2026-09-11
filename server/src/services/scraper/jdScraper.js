const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Normalizes and extracts clean readable text from HTML markup
 * @param {string} html - Raw HTML document or fragment
 * @returns {{ text: string, title: string }} Clean extracted text and document title
 */
const extractCleanText = (html) => {
  if (!html || typeof html !== 'string') {
    return { text: '', title: '' };
  }

  const $ = cheerio.load(html);

  // 1. Extract page title before removing head/meta
  const title = ($('title').first().text() || $('h1').first().text() || '').trim();

  // 2. Remove script, style, navigation, footer, forms, and other non-content elements
  $(
    'script, style, noscript, nav, footer, header, svg, iframe, form, button, select, input, textarea'
  ).remove();

  // 3. Preserve structural breaks across block elements
  $('br').replaceWith('\n');
  $('p, div, li, h1, h2, h3, h4, h5, h6, tr, article, section, blockquote').each(
    (_, element) => {
      $(element).after('\n');
    }
  );

  // 4. Target the most relevant container or fallback to body/root
  const mainContent =
    $('main, article, [role="main"], #job-description, .job-description').first();
  const targetElement = mainContent.length > 0 ? mainContent : $('body');
  const rawExtracted = targetElement.length > 0 ? targetElement.text() : $.text();

  // 5. Clean whitespace and normalize line breaks
  const cleanedLines = rawExtracted
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ') // Non-breaking space
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, index, arr) => {
      // Keep empty line only if previous line was not empty (preserve single blank paragraph spacing)
      if (line.length === 0) {
        return index > 0 && arr[index - 1].length > 0;
      }
      return true;
    });

  const text = cleanedLines.join('\n').trim();

  return {
    text,
    title,
  };
};

/**
 * Fetches HTML from a remote URL, strips tags, and returns clean text
 * @param {string} url - Target URL of the job posting
 * @param {object} [options={}] - Custom axios request options
 * @returns {Promise<{ rawText: string, title: string, url: string }>}
 */
const scrapeJobDescription = async (url, options = {}) => {
  if (!url || typeof url !== 'string') {
    throw new Error('Valid URL is required for scraping');
  }

  const trimmedUrl = url.trim();
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error('URL must start with http:// or https://');
  }

  try {
    const response = await axios.get(trimmedUrl, {
      timeout: options.timeout || 10000,
      maxContentLength: options.maxContentLength || 10 * 1024 * 1024, // 10 MB limit
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ApplyForgeBot/1.0',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(options.headers || {}),
      },
      ...options,
    });

    const { text, title } = extractCleanText(response.data);

    return {
      rawText: text,
      title,
      url: trimmedUrl,
    };
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Failed to fetch URL: HTTP ${error.response.status} (${error.response.statusText || 'Error'})`
      );
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out while fetching job posting URL');
    }
    throw new Error(`Scraper request failed: ${error.message}`);
  }
};

module.exports = {
  scrapeJobDescription,
  extractCleanText,
};
