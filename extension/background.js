/**
 * ApplyForge Chrome Extension - Background Service Worker (MV3)
 * Handles tab monitoring, badge updates, storage configuration, and API synchronization.
 */

const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:5000',
  apiToken: '',
};

/**
 * Helper to get extension configuration from Chrome storage
 * @returns {Promise<{ serverUrl: string, apiToken: string }>}
 */
async function getConfig() {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    try {
      const stored = await chrome.storage.sync.get(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG, ...stored };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

/**
 * Helper to check if a URL belongs to a supported job board
 * @param {string} url
 * @returns {boolean}
 */
function isSupportedJobUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('linkedin.com/jobs') ||
    lower.includes('linkedin.com/job-postings') ||
    lower.includes('naukri.com/job-listings') ||
    lower.includes('naukri.com') && lower.includes('-jobs') ||
    lower.includes('boards.greenhouse.io') ||
    lower.includes('jobs.lever.co')
  );
}

/**
 * Updates extension action badge for a specific tab
 * @param {number} tabId
 * @param {boolean} isJobPage
 */
function updateTabBadge(tabId, isJobPage) {
  if (typeof chrome === 'undefined' || !chrome.action) return;

  if (isJobPage) {
    chrome.action.setBadgeText({ text: 'JD', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#4f46e5', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

/**
 * Posts extracted job data to ApplyForge backend server
 * @param {object} job
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
async function sendJobToApplyForge(job) {
  try {
    const config = await getConfig();
    const endpoint = `${config.serverUrl.replace(/\/+$/, '')}/api/jd`;

    const headers = {
      'Content-Type': 'application/json',
    };

    if (config.apiToken) {
      headers['Authorization'] = `Bearer ${config.apiToken}`;
    }

    const payload = {
      company: job.company || 'Detected Company',
      roleTitle: job.title || 'Detected Role',
      rawText: job.description || `${job.title || 'Job'} at ${job.company || 'Company'}`,
      source: 'extension',
    };

    if (job.url && typeof job.url === 'string' && (job.url.startsWith('http://') || job.url.startsWith('https://'))) {
      payload.sourceUrl = job.url;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `Server responded with status ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error connecting to ApplyForge: ${err.message}`,
    };
  }
}

// Runtime lifecycle events in browser environment
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // 1. Extension Installed / Updated
  chrome.runtime.onInstalled?.addListener(async (details) => {
    console.log('[ApplyForge Service Worker] Installed:', details.reason);
    if (chrome.storage?.sync) {
      await chrome.storage.sync.set(DEFAULT_CONFIG);
    }
  });

  // 2. Tab Navigation / URL change
  chrome.tabs?.onUpdated?.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab?.url) {
      const isJob = isSupportedJobUrl(tab.url);
      updateTabBadge(tabId, isJob);
    }
  });

  // 3. Message dispatcher
  chrome.runtime.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.action === 'JOB_DETECTED_ON_PAGE') {
      if (sender?.tab?.id) {
        updateTabBadge(sender.tab.id, true);
      }
      sendResponse({ received: true });
      return true;
    }

    if (request.action === 'SAVE_JOB') {
      sendJobToApplyForge(request.job).then((result) => {
        sendResponse(result);
      });
      return true; // Keep channel open for async response
    }

    if (request.action === 'GET_CONFIG') {
      getConfig().then((cfg) => sendResponse({ success: true, config: cfg }));
      return true;
    }

    if (request.action === 'SAVE_CONFIG') {
      if (chrome.storage?.sync && request.config) {
        chrome.storage.sync.set(request.config).then(() => {
          sendResponse({ success: true });
        });
        return true;
      }
    }

    if (request.action === 'GET_ACTIVE_JOB') {
      // Query active tab and request detection from content script
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (!tab?.id) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        chrome.tabs.sendMessage(tab.id, { action: 'DETECT_JOB' }, (res) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(res || { success: false, error: 'No response from page' });
          }
        });
      });
      return true;
    }

    return true;
  });
}

// Universal export for unit tests
const exportsObj = {
  DEFAULT_CONFIG,
  getConfig,
  isSupportedJobUrl,
  updateTabBadge,
  sendJobToApplyForge,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportsObj;
}
