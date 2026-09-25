/**
 * ApplyForge Chrome Extension - Background Service Worker (MV3)
 * Handles tab monitoring, badge updates, storage configuration,
 * JWT authentication, and Apply wizard API integration.
 */

const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:5000',
  frontendUrl: 'http://localhost:5173',
  apiToken: '',
  user: null,
};

/**
 * Helper to get extension configuration from Chrome storage
 * @returns {Promise<{ serverUrl: string, frontendUrl: string, apiToken: string, user: object|null }>}
 */
async function getConfig() {
  if (typeof chrome !== 'undefined') {
    if (chrome.storage?.sync) {
      try {
        const stored = await chrome.storage.sync.get(DEFAULT_CONFIG);
        return { ...DEFAULT_CONFIG, ...stored };
      } catch {
        // Fall back to local storage
      }
    }
    if (chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get(DEFAULT_CONFIG);
        return { ...DEFAULT_CONFIG, ...stored };
      } catch {
        return DEFAULT_CONFIG;
      }
    }
  }
  return DEFAULT_CONFIG;
}

/**
 * Helper to save extension configuration to Chrome storage
 * @param {object} newConfig
 * @returns {Promise<boolean>}
 */
async function saveConfig(newConfig) {
  if (typeof chrome !== 'undefined') {
    if (chrome.storage?.sync) {
      try {
        await chrome.storage.sync.set(newConfig);
        return true;
      } catch {
        // Fall back to local
      }
    }
    if (chrome.storage?.local) {
      try {
        await chrome.storage.local.set(newConfig);
        return true;
      } catch {
        return false;
      }
    }
  }
  return false;
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
    (lower.includes('naukri.com') && lower.includes('-jobs')) ||
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
 * Verifies JWT authentication token against the ApplyForge backend
 * @param {string} token
 * @param {string} [serverUrl]
 * @returns {Promise<{ authenticated: boolean, user?: object, error?: string }>}
 */
async function verifyAuthToken(token, serverUrl = DEFAULT_CONFIG.serverUrl) {
  if (!token) {
    return { authenticated: false, error: 'No token provided' };
  }

  try {
    const endpoint = `${serverUrl.replace(/\/+$/, '')}/api/auth/me`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return {
        authenticated: false,
        status: response.status,
        error: 'Invalid or expired JWT token',
      };
    }

    const data = await response.json();
    return {
      authenticated: true,
      user: data.user || data,
    };
  } catch (err) {
    return {
      authenticated: false,
      error: `Network error verifying token: ${err.message}`,
    };
  }
}

/**
 * Authenticates user credentials with ApplyForge and stores JWT in extension storage
 * @param {string} email
 * @param {string} password
 * @param {string} [serverUrl]
 * @returns {Promise<{ success: boolean, token?: string, user?: object, error?: string }>}
 */
async function loginWithCredentials(email, password, serverUrl = DEFAULT_CONFIG.serverUrl) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  try {
    const endpoint = `${serverUrl.replace(/\/+$/, '')}/api/auth/login`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `Login failed with status ${response.status}`,
      };
    }

    const token = data.token || data.accessToken;
    const user = data.user || null;

    if (token) {
      await saveConfig({ apiToken: token, user });
    }

    return {
      success: true,
      token,
      user,
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error logging in: ${err.message}`,
    };
  }
}

/**
 * Posts extracted job data to ApplyForge backend server with JWT authentication,
 * and formats redirect URL to the Apply wizard.
 *
 * @param {object} job
 * @param {object} [options={}]
 * @param {boolean} [options.redirect=true]
 * @returns {Promise<{ success: boolean, data?: object, createdId?: string, redirectUrl?: string, error?: string, requiresAuth?: boolean }>}
 */
async function sendJobToApplyForge(job, options = {}) {
  try {
    const config = await getConfig();

    // Check if ApplyForge JWT is present in extension storage
    if (!config.apiToken) {
      return {
        success: false,
        requiresAuth: true,
        error: 'Authentication required: please log in or save your ApplyForge JWT in extension settings.',
      };
    }

    const endpoint = `${config.serverUrl.replace(/\/+$/, '')}/api/jd`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiToken}`,
    };

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

    if (response.status === 401) {
      return {
        success: false,
        requiresAuth: true,
        error: 'ApplyForge session has expired or JWT token is invalid. Please sign in again.',
      };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || errorData.error || `Server responded with status ${response.status}`,
      };
    }

    const data = await response.json();
    const createdId =
      data.jobDescription?._id ||
      data.jobDescription?.id ||
      data._id ||
      data.id ||
      data.data?._id ||
      data.data?.id ||
      '';

    const frontendUrl = (config.frontendUrl || 'http://localhost:5173').replace(/\/+$/, '');
    const redirectUrl = createdId ? `${frontendUrl}/apply?jdId=${createdId}` : `${frontendUrl}/apply`;

    // Automatically redirect browser tab to Apply wizard with pre-filled JD if requested
    if (options.redirect !== false && typeof chrome !== 'undefined' && chrome.tabs?.create) {
      try {
        chrome.tabs.create({ url: redirectUrl });
      } catch (tabErr) {
        console.warn('Failed to open Apply wizard tab:', tabErr);
      }
    }

    return {
      success: true,
      data,
      createdId,
      redirectUrl,
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
      const existing = await chrome.storage.sync.get(DEFAULT_CONFIG);
      await chrome.storage.sync.set({ ...DEFAULT_CONFIG, ...existing });
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

    // Save job and redirect to Apply wizard
    if (request.action === 'SAVE_JOB') {
      sendJobToApplyForge(request.job, { redirect: request.redirect ?? true }).then((result) => {
        sendResponse(result);
      });
      return true; // Keep channel open for async response
    }

    if (request.action === 'GET_CONFIG') {
      getConfig().then((cfg) => sendResponse({ success: true, config: cfg }));
      return true;
    }

    if (request.action === 'SAVE_CONFIG') {
      if (request.config) {
        saveConfig(request.config).then(() => {
          sendResponse({ success: true });
        });
        return true;
      }
    }

    // Verify current or provided JWT token
    if (request.action === 'VERIFY_AUTH') {
      const token = request.token;
      getConfig().then((cfg) => {
        const tokenToVerify = token || cfg.apiToken;
        const server = cfg.serverUrl || DEFAULT_CONFIG.serverUrl;
        verifyAuthToken(tokenToVerify, server).then((result) => {
          if (result.authenticated && result.user) {
            saveConfig({ user: result.user });
          }
          sendResponse(result);
        });
      });
      return true;
    }

    // Email + Password login
    if (request.action === 'LOGIN') {
      getConfig().then((cfg) => {
        const server = cfg.serverUrl || DEFAULT_CONFIG.serverUrl;
        loginWithCredentials(request.email, request.password, server).then((result) => {
          sendResponse(result);
        });
      });
      return true;
    }

    // Logout / Disconnect
    if (request.action === 'LOGOUT') {
      saveConfig({ apiToken: '', user: null }).then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    // Open Apply wizard URL in a tab
    if (request.action === 'REDIRECT_TO_APPLY') {
      if (request.url && chrome.tabs?.create) {
        chrome.tabs.create({ url: request.url });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No URL provided' });
      }
      return true;
    }

    if (request.action === 'GET_ACTIVE_JOB') {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (!tab?.id) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        chrome.tabs.sendMessage(tab.id, { action: 'CAPTURE_JD' }, (res) => {
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
  saveConfig,
  isSupportedJobUrl,
  updateTabBadge,
  verifyAuthToken,
  loginWithCredentials,
  sendJobToApplyForge,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportsObj;
}
