/**
 * ApplyForge Chrome Extension - Content Script (Phase 106)
 * Selects and captures full or user-highlighted job description text on job boards
 * (LinkedIn, Naukri, Greenhouse, Lever, Indeed, and generic portals).
 */

(function () {
  let lastCapturedJob = null;
  let lastTargetElement = null;

  /**
   * Helper to clean and normalize whitespace from text
   * @param {string} text
   * @returns {string}
   */
  function cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Helper to safely get the current window URL in browser or test environments
   * @returns {string}
   */
  function getCurrentUrl() {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.href || '';
    }
    return '';
  }

  /**
   * Helper to count words in a string
   * @param {string} text
   * @returns {number}
   */
  function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    const words = text.trim().match(/\S+/g);
    return words ? words.length : 0;
  }

  /**
   * Retrieves any text currently selected/highlighted by user on the active page
   * @returns {string}
   */
  function getSelectedText() {
    try {
      if (typeof window !== 'undefined' && window.getSelection) {
        const sel = window.getSelection();
        return sel ? sel.toString().trim() : '';
      }
    } catch {
      // Ignore in non-browser environments
    }
    return '';
  }

  /**
   * Helper to query first matching selector in a document/node
   * @param {Document|Element} root
   * @param {string[]} selectors
   * @returns {Element|null}
   */
  function queryAny(root, selectors) {
    if (!root || !selectors) return null;
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch {
        // Ignore selector syntax error
      }
    }
    return null;
  }

  /**
   * Cleans and formats raw HTML into structured text with newlines & bullets
   * @param {string} html
   * @returns {string}
   */
  function htmlToFormattedText(html) {
    if (!html || typeof html !== 'string') return '';
    let str = html;
    str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    str = str.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    str = str.replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '');
    str = str.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
    str = str.replace(/<li[^>]*>/gi, '\n• ');
    str = str.replace(/<\/(p|div|h[1-6]|tr|li)>/gi, '\n');
    str = str.replace(/<br\s*[\/]?>/gi, '\n');
    str = str.replace(/<[^>]+>/g, ' ');
    str = str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return str
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  /**
   * Formats HTML container text into clean paragraphs & bullet points
   * while stripping UI buttons, scripts, and navigation clutter.
   *
   * @param {Element} container
   * @returns {string} Clean formatted text
   */
  function extractFormattedText(container) {
    if (!container) return '';
    if (typeof container === 'string') return cleanText(container);

    // If container has innerHTML, use htmlToFormattedText
    if (container.innerHTML && typeof container.innerHTML === 'string') {
      const formatted = htmlToFormattedText(container.innerHTML);
      if (formatted) return formatted;
    }

    if (container.cloneNode && typeof container.cloneNode === 'function') {
      try {
        const clone = container.cloneNode(true);
        const toRemove = clone.querySelectorAll(
          'script, style, svg, button, .show-more-less-html__button, .artdeco-button, .jobs-description__footer-button, [aria-label*="Show more"], [aria-label*="Show less"]'
        );
        toRemove.forEach((el) => el.remove());

        const blockElements = clone.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr');
        blockElements.forEach((el) => {
          if (el.tagName && el.tagName.toLowerCase() === 'li') {
            const content = el.textContent.trim();
            if (!content.startsWith('•') && !content.startsWith('-') && !content.startsWith('*')) {
              el.textContent = `\n• ${content}`;
            } else {
              el.textContent = `\n${content}`;
            }
          } else {
            el.textContent = `${el.textContent}\n`;
          }
        });

        const raw = clone.textContent || '';
        return raw
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .join('\n')
          .trim();
      } catch {
        // Fall back to textContent
      }
    }

    return cleanText(container.textContent || '');
  }

  /**
   * Extract JSON-LD JobPosting data if present
   * @param {Document} doc
   * @returns {object|null}
   */
  function detectJsonLdJob(doc = document) {
    try {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        const content = script.textContent || '';
        if (!content.includes('JobPosting')) continue;
        const parsed = JSON.parse(content);
        const item = parsed['@type'] === 'JobPosting'
          ? parsed
          : Array.isArray(parsed['@graph'])
          ? parsed['@graph'].find((n) => n['@type'] === 'JobPosting')
          : null;

        if (item) {
          const company =
            typeof item.hiringOrganization === 'string'
              ? item.hiringOrganization
              : item.hiringOrganization?.name || '';

          const location =
            typeof item.jobLocation === 'string'
              ? item.jobLocation
              : item.jobLocation?.address?.addressLocality || '';

          const rawDesc = item.description || '';
          const textDesc = rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

          return {
            detected: true,
            platform: 'jsonld',
            title: cleanText(item.title || item.name || ''),
            company: cleanText(company),
            location: cleanText(location),
            description: textDesc,
            url: getCurrentUrl(),
            source: 'json-ld',
            element: script,
          };
        }
      }
    } catch {
      // Ignore JSON-LD parse errors
    }
    return null;
  }

  /**
   * Detect job details on LinkedIn Job pages
   * @param {Document} doc
   * @returns {object|null}
   */
  function detectLinkedInJob(doc = document) {
    const titleEl = queryAny(doc, [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1.topcard__title',
      'h1.t-24',
      '.jobs-details__main-content h1',
    ]);

    const compEl = queryAny(doc, [
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.topcard__flavor--black-link',
      '.topcard__flavor a',
      '.job-details-jobs-unified-top-card__primary-description a',
    ]);

    const locEl = queryAny(doc, [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.topcard__flavor--bullet',
      '.jobs-unified-top-card__primary-description span',
    ]);

    const descEl = queryAny(doc, [
      '#job-details',
      '.jobs-description-content__text',
      '.jobs-description__content',
      '.show-more-less-html__markup',
      '.jobs-box__html-content',
    ]);

    if (!titleEl && !descEl) {
      return null;
    }

    const title = cleanText(titleEl?.textContent || '');
    const company = cleanText(compEl?.textContent || '');
    const location = cleanText(locEl?.textContent || '');
    const description = extractFormattedText(descEl);

    if (title || description) {
      return {
        detected: true,
        platform: 'linkedin',
        title,
        company,
        location,
        description,
        url: getCurrentUrl(),
        source: 'linkedin.com',
        element: descEl || titleEl,
      };
    }

    return null;
  }

  /**
   * Detect job details on Naukri.com Job pages
   * @param {Document} doc
   * @returns {object|null}
   */
  function detectNaukriJob(doc = document) {
    const titleEl = queryAny(doc, [
      'h1.styles_jd-header-title__rZwM1',
      '.jd-header-title',
      'h1.title',
      '.heading .title',
      '.jd-container h1',
    ]);

    const compEl = queryAny(doc, [
      '.styles_jd-header-comp-name__MvqAI a',
      '.styles_jd-header-comp-name__MvqAI',
      '.jd-header-comp-name a',
      '.jd-header-comp-name',
      '.company-info .name',
      '.top-head .comp-name',
    ]);

    const locEl = queryAny(doc, [
      '.styles_jhc__location__kJZ1m',
      '.loc .location',
      '.location a',
      '.styles_jhc__exp-salary-location__4B5H2 .location',
    ]);

    const descEl = queryAny(doc, [
      '.styles_JDJOB__text__0Qk3i',
      '.job-desc-section',
      '.styles_job-description__2b39t',
      '.dang-inner-html',
      '.job-desc-section .dang-inner-html',
    ]);

    if (!titleEl && !descEl) {
      return null;
    }

    const title = cleanText(titleEl?.textContent || '');
    const company = cleanText(compEl?.textContent || '');
    const location = cleanText(locEl?.textContent || '');
    const description = extractFormattedText(descEl);

    if (title || description) {
      return {
        detected: true,
        platform: 'naukri',
        title,
        company,
        location,
        description,
        url: getCurrentUrl(),
        source: 'naukri.com',
        element: descEl || titleEl,
      };
    }

    return null;
  }

  /**
   * Detect job details on Greenhouse / Lever board pages
   * @param {Document} doc
   * @returns {object|null}
   */
  function detectGreenhouseOrLever(doc = document) {
    const ghTitle = queryAny(doc, ['.app-title', '#header h1', 'h1.app-title']);
    const ghCompany = queryAny(doc, ['.company-name', '#header .company-name']);
    const ghDesc = queryAny(doc, ['#content', '#main-content', '.content-body']);

    const leverTitle = queryAny(doc, ['.posting-headline h2', 'h2.posting-headline']);
    const leverCompany = queryAny(doc, ['.main-header-logo img[alt]', '.main-header-text']);
    const leverDesc = queryAny(doc, ['[data-qa="job-description"]', '.posting-page .section-wrapper']);

    if (ghTitle || ghDesc) {
      return {
        detected: true,
        platform: 'greenhouse',
        title: cleanText(ghTitle?.textContent || ''),
        company: cleanText(ghCompany?.textContent || ''),
        location: cleanText(doc.querySelector('.location')?.textContent || ''),
        description: extractFormattedText(ghDesc),
        url: getCurrentUrl(),
        source: 'greenhouse.io',
        element: ghDesc || ghTitle,
      };
    }

    if (leverTitle || leverDesc) {
      return {
        detected: true,
        platform: 'lever',
        title: cleanText(leverTitle?.textContent || ''),
        company: cleanText(leverCompany?.getAttribute?.('alt') || leverCompany?.textContent || ''),
        location: cleanText(doc.querySelector('.posting-categories .location')?.textContent || ''),
        description: extractFormattedText(leverDesc),
        url: getCurrentUrl(),
        source: 'lever.co',
        element: leverDesc || leverTitle,
      };
    }

    return null;
  }

  /**
   * Master extraction function identifying current host and executing appropriate detector.
   * Incorporates user text selection if available.
   *
   * @param {Document} doc
   * @param {object} [options={}] - { useSelection: boolean }
   * @returns {object} Extracted job details with word/char counters
   */
  function detectJob(doc = typeof document !== 'undefined' ? document : null, options = {}) {
    if (!doc) {
      return { detected: false, message: 'Document object not available' };
    }

    const host = (typeof window !== 'undefined' ? window.location?.hostname : '') || '';
    let result = null;

    // 1. LinkedIn
    if (host.includes('linkedin.com')) {
      result = detectLinkedInJob(doc);
    }

    // 2. Naukri
    if (!result && host.includes('naukri.com')) {
      result = detectNaukriJob(doc);
    }

    // 3. Greenhouse or Lever
    if (!result && (host.includes('greenhouse.io') || host.includes('lever.co'))) {
      result = detectGreenhouseOrLever(doc);
    }

    // 4. Try JSON-LD
    if (!result) {
      result = detectJsonLdJob(doc);
    }

    // 5. Fallback across all heuristics
    if (!result) result = detectLinkedInJob(doc);
    if (!result) result = detectNaukriJob(doc);
    if (!result) result = detectGreenhouseOrLever(doc);

    // Check user selection
    const selectedText = getSelectedText();
    const hasSelection = Boolean(selectedText && selectedText.length > 10);

    if (result && result.detected) {
      // Remember target element for visual highlight
      lastTargetElement = result.element || null;

      // If user specified useSelection or if description was empty but selection exists
      const finalDescription = options.useSelection && hasSelection
        ? selectedText
        : result.description || selectedText || '';

      const captured = {
        ...result,
        description: finalDescription,
        fullDescription: result.description || '',
        selectedText,
        hasSelection,
        charCount: finalDescription.length,
        wordCount: countWords(finalDescription),
        capturedAt: new Date().toISOString(),
      };

      // Strip DOM element reference for serialization
      delete captured.element;

      lastCapturedJob = captured;

      // Cache to chrome.storage.local if available
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ activeCapturedJob: captured }).catch(() => {});
      }

      return captured;
    }

    // If no full container detected, but user highlighted text, create a selection job
    if (hasSelection) {
      const captured = {
        detected: true,
        platform: 'selection',
        title: cleanText(doc.title || 'Selected Job Posting'),
        company: '',
        location: '',
        description: selectedText,
        fullDescription: selectedText,
        selectedText,
        hasSelection: true,
        charCount: selectedText.length,
        wordCount: countWords(selectedText),
        url: getCurrentUrl(),
        source: 'user-selection',
        capturedAt: new Date().toISOString(),
      };

      lastCapturedJob = captured;
      return captured;
    }

    return {
      detected: false,
      url: getCurrentUrl(),
      message: 'No job description pattern detected on this page.',
    };
  }

  /**
   * Highlights the captured job description element on the page with a glowing pulse outline
   * @param {Element} [element]
   */
  function highlightCapturedElement(element = lastTargetElement) {
    if (!element || typeof element.scrollIntoView !== 'function') return;

    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('applyforge-highlight-pulse');
      setTimeout(() => {
        element.classList.remove('applyforge-highlight-pulse');
      }, 3000);
    } catch {
      // Ignore DOM animation error
    }
  }

  /**
   * Injects on-page floating indicator badge if a job description is detected
   * @param {object} job
   */
  function injectApplyForgeBadge(job) {
    if (typeof document === 'undefined' || !job || !job.detected) return;
    if (document.getElementById('applyforge-floating-indicator')) return;

    const badge = document.createElement('div');
    badge.id = 'applyforge-floating-indicator';
    badge.className = 'applyforge-badge-root';
    badge.innerHTML = `
      <div class="applyforge-badge-content">
        <div class="applyforge-badge-icon">⚡</div>
        <div class="applyforge-badge-info">
          <span class="applyforge-badge-title">ApplyForge Captured</span>
          <span class="applyforge-badge-role">${job.title ? job.title.slice(0, 22) + (job.title.length > 22 ? '...' : '') : 'Job Posting'}</span>
        </div>
        <button id="applyforge-badge-action-btn" class="applyforge-badge-btn" title="Send to ApplyForge">
          Send to ApplyForge
        </button>
        <button id="applyforge-badge-close-btn" class="applyforge-badge-close" title="Dismiss">&times;</button>
      </div>
    `;

    document.body.appendChild(badge);

    const actionBtn = badge.querySelector('#applyforge-badge-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          actionBtn.textContent = 'Sending...';
          chrome.runtime.sendMessage(
            { action: 'SAVE_JOB', job },
            (response) => {
              if (response && response.success) {
                actionBtn.textContent = '✓ Sent to ApplyForge!';
                setTimeout(() => {
                  badge.remove();
                }, 2500);
              } else {
                actionBtn.textContent = 'Open Copilot';
              }
            }
          );
        }
      });
    }

    const closeBtn = badge.querySelector('#applyforge-badge-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => badge.remove());
    }
  }

  // Auto-run detection after DOM is fully ready in browser environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const initDetection = () => {
      const job = detectJob(document);
      if (job.detected) {
        injectApplyForgeBadge(job);
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'JOB_DETECTED_ON_PAGE', job });
        }
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDetection);
    } else {
      setTimeout(initDetection, 1000);
    }

    // Listen for runtime messages from popup or background service worker
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // 1. CAPTURE_JD (Phase 106 primary action)
        if (request.action === 'CAPTURE_JD' || request.action === 'DETECT_JOB') {
          const freshJob = detectJob(document, { useSelection: request.useSelection });
          sendResponse({ success: true, job: freshJob });
        }

        // 2. GET_SELECTED_TEXT
        else if (request.action === 'GET_SELECTED_TEXT') {
          const sel = getSelectedText();
          sendResponse({ success: true, selectedText: sel, hasSelection: sel.length > 0 });
        }

        // 3. HIGHLIGHT_JD
        else if (request.action === 'HIGHLIGHT_JD') {
          highlightCapturedElement();
          sendResponse({ success: true });
        }

        // 4. PING
        else if (request.action === 'PING') {
          sendResponse({ status: 'ok', domain: window.location.hostname });
        }

        return true;
      });
    }
  }

  // Export for unit tests
  const exportsObj = {
    cleanText,
    countWords,
    getSelectedText,
    extractFormattedText,
    detectJob,
    detectLinkedInJob,
    detectNaukriJob,
    detectGreenhouseOrLever,
    detectJsonLdJob,
    highlightCapturedElement,
    injectApplyForgeBadge,
    htmlToFormattedText,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})();
