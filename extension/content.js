/**
 * ApplyForge Chrome Extension - Content Script
 * Detects and extracts structured job descriptions on LinkedIn, Naukri, Greenhouse, and Lever.
 */

(function () {
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
        // Ignore invalid selector syntax in test environments
      }
    }
    return null;
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
          // Strip HTML tags from description if needed
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
    const description = cleanText(descEl?.textContent || '');

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
    const description = cleanText(descEl?.textContent || '');

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
    // Greenhouse selectors
    const ghTitle = queryAny(doc, ['.app-title', '#header h1', 'h1.app-title']);
    const ghCompany = queryAny(doc, ['.company-name', '#header .company-name']);
    const ghDesc = queryAny(doc, ['#content', '#main-content', '.content-body']);

    // Lever selectors
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
        description: cleanText(ghDesc?.textContent || ''),
        url: getCurrentUrl(),
        source: 'greenhouse.io',
      };
    }

    if (leverTitle || leverDesc) {
      return {
        detected: true,
        platform: 'lever',
        title: cleanText(leverTitle?.textContent || ''),
        company: cleanText(leverCompany?.getAttribute?.('alt') || leverCompany?.textContent || ''),
        location: cleanText(doc.querySelector('.posting-categories .location')?.textContent || ''),
        description: cleanText(leverDesc?.textContent || ''),
        url: getCurrentUrl(),
        source: 'lever.co',
      };
    }

    return null;
  }

  /**
   * Master extraction function identifying current host and executing appropriate detector
   * @param {Document} doc
   * @returns {object} Extracted job details or detected: false
   */
  function detectJob(doc = typeof document !== 'undefined' ? document : null) {
    if (!doc) {
      return { detected: false, message: 'Document object not available' };
    }

    const host = (typeof window !== 'undefined' ? window.location?.hostname : '') || '';

    // 1. LinkedIn
    if (host.includes('linkedin.com')) {
      const liJob = detectLinkedInJob(doc);
      if (liJob) return liJob;
    }

    // 2. Naukri
    if (host.includes('naukri.com')) {
      const naukriJob = detectNaukriJob(doc);
      if (naukriJob) return naukriJob;
    }

    // 3. Greenhouse or Lever
    if (host.includes('greenhouse.io') || host.includes('lever.co')) {
      const ghJob = detectGreenhouseOrLever(doc);
      if (ghJob) return ghJob;
    }

    // 4. Try JSON-LD on any page
    const jsonLdJob = detectJsonLdJob(doc);
    if (jsonLdJob) return jsonLdJob;

    // 5. Try all heuristics as fallback
    const fallbackLi = detectLinkedInJob(doc);
    if (fallbackLi) return fallbackLi;

    const fallbackNaukri = detectNaukriJob(doc);
    if (fallbackNaukri) return fallbackNaukri;

    const fallbackGh = detectGreenhouseOrLever(doc);
    if (fallbackGh) return fallbackGh;

    return {
      detected: false,
      url: getCurrentUrl(),
      message: 'No job description pattern detected on this page.',
    };
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
          <span class="applyforge-badge-title">ApplyForge Detected</span>
          <span class="applyforge-badge-role">${job.title ? job.title.slice(0, 24) + (job.title.length > 24 ? '...' : '') : 'Job Posting'}</span>
        </div>
        <button id="applyforge-badge-action-btn" class="applyforge-badge-btn" title="Send to ApplyForge">
          Tailor Resume
        </button>
        <button id="applyforge-badge-close-btn" class="applyforge-badge-close" title="Dismiss">&times;</button>
      </div>
    `;

    document.body.appendChild(badge);

    // Attach click handlers
    const actionBtn = badge.querySelector('#applyforge-badge-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          actionBtn.textContent = 'Sending...';
          chrome.runtime.sendMessage(
            { action: 'SAVE_JOB', job },
            (response) => {
              if (response && response.success) {
                actionBtn.textContent = '✓ Saved!';
                setTimeout(() => {
                  badge.remove();
                }, 2000);
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

    // Listen for runtime messages from background service worker or popup
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'DETECT_JOB') {
          const currentJob = detectJob(document);
          sendResponse({ success: true, job: currentJob });
        } else if (request.action === 'PING') {
          sendResponse({ status: 'ok', domain: window.location.hostname });
        }
        return true;
      });
    }
  }

  // Export for unit tests
  const exportsObj = {
    cleanText,
    detectJob,
    detectLinkedInJob,
    detectNaukriJob,
    detectGreenhouseOrLever,
    detectJsonLdJob,
    injectApplyForgeBadge,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})();
