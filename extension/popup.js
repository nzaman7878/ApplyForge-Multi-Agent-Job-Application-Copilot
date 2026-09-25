/**
 * ApplyForge Chrome Extension - Popup Controller (Phase 107)
 * Handles JD capture, selection toggle, live word/char metrics,
 * JWT authentication, and sending to ApplyForge with automatic Apply wizard redirection.
 */

let activeDetectedJob = null;
let currentFullJd = '';
let currentSelectedJd = '';
let activeTabMode = 'full'; // 'full' | 'selection'

let currentConfig = {
  serverUrl: 'http://localhost:5000',
  frontendUrl: 'http://localhost:5173',
  apiToken: '',
  user: null,
};

// Safe element getter for browser and Node.js testing environments
const getEl = (id) => (typeof document !== 'undefined' && document.getElementById ? document.getElementById(id) : null);

// Authentication Bar Elements
const authStatusBar = getEl('auth-status-bar');
const authIndicatorDot = getEl('auth-indicator-dot');
const authUserLabel = getEl('auth-user-label');
const authActionBtn = getEl('auth-action-btn');

// Status & Card Elements
const statusBanner = getEl('status-banner');
const statusText = getEl('status-text');
const jobCard = getEl('job-card');
const emptyState = getEl('empty-state');
const settingsPanel = getEl('settings-panel');

// Job fields
const jobTitleInput = getEl('job-title-input');
const jobCompanyInput = getEl('job-company-input');
const jobLocationInput = getEl('job-location-input');
const jobSourceEl = getEl('job-source');

// Captured JD section
const tabFullJd = getEl('tab-full-jd');
const tabSelectionJd = getEl('tab-selection-jd');
const jobWordCountEl = getEl('job-word-count');
const jobCharCountEl = getEl('job-char-count');
const jobDescTextarea = getEl('job-desc-textarea');

// Action buttons
const highlightOnPageBtn = getEl('highlight-on-page-btn');
const copyJdBtn = getEl('copy-jd-btn');
const captureSelectionBtn = getEl('capture-selection-btn');
const sendToApplyforgeBtn = getEl('send-to-applyforge-btn');
const importBtnFallback = getEl('import-btn'); // For backwards compatibility
const sentSuccessCard = getEl('sent-success-card');
const sentSuccessMessage = getEl('sent-success-message');
const viewInApplyforgeLink = getEl('view-in-applyforge-link');

const rescanHeaderBtn = getEl('rescan-header-btn');
const rescanBtn = getEl('rescan-btn');
const captureHighlightEmptyBtn = getEl('capture-highlight-empty-btn');

// Settings & Auth elements
const settingsToggleBtn = getEl('settings-toggle-btn');
const closeSettingsXBtn = getEl('close-settings-x-btn');
const closeSettingsBtn = getEl('close-settings-btn');
const saveSettingsBtn = getEl('save-settings-btn');
const testConnectionBtn = getEl('test-connection-btn');

const loginEmailInput = getEl('login-email-input');
const loginPasswordInput = getEl('login-password-input');
const loginSubmitBtn = getEl('login-submit-btn');
const loginStatusMsg = getEl('login-status-msg');
const authSignoutBtn = getEl('auth-signout-btn');

const apiTokenInput = getEl('api-token-input');
const verifyTokenBtn = getEl('verify-token-btn');
const syncTabTokenBtn = getEl('sync-tab-token-btn');

const serverUrlInput = getEl('server-url-input');
const frontendUrlInput = getEl('frontend-url-input');
const openDashboardLink = getEl('open-dashboard-link');

/**
 * Calculates word count from text string
 * @param {string} text
 * @returns {number}
 */
function calculateWordCount(text) {
  if (!text || typeof text !== 'string') return 0;
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

/**
 * Updates the status banner styling and text
 * @param {string} text
 * @param {'loading'|'success'|'warning'|'error'} type
 */
function setStatus(text, type = 'loading') {
  if (statusText) statusText.textContent = text;
  if (statusBanner) {
    statusBanner.className = `status-banner status-${type}`;
  }
}

/**
 * Updates the Authentication Status bar UI
 * @param {object|null} user
 * @param {string} token
 */
function updateAuthUI(user, token) {
  const hasToken = !!(token && token.trim());

  if (authStatusBar) {
    if (hasToken) {
      authStatusBar.className = 'auth-bar auth-authenticated';
    } else {
      authStatusBar.className = 'auth-bar auth-unauthenticated';
    }
  }

  if (authIndicatorDot) {
    authIndicatorDot.className = hasToken ? 'auth-dot dot-online' : 'auth-dot dot-offline';
  }

  if (authUserLabel) {
    if (hasToken) {
      const email = user?.email || user?.name;
      authUserLabel.textContent = email ? `Connected: ${email}` : 'Connected to ApplyForge';
    } else {
      authUserLabel.textContent = 'Not logged in to ApplyForge';
    }
  }

  if (authActionBtn) {
    authActionBtn.textContent = hasToken ? 'Account' : 'Sign In';
  }

  if (authSignoutBtn) {
    if (hasToken) {
      authSignoutBtn.classList.remove('hidden');
    } else {
      authSignoutBtn.classList.add('hidden');
    }
  }
}

/**
 * Updates word count and character count indicators
 * @param {string} text
 */
function updateMetrics(text) {
  const chars = (text || '').length;
  const words = calculateWordCount(text);

  if (jobWordCountEl) {
    jobWordCountEl.textContent = `${words.toLocaleString()} words`;
  }
  if (jobCharCountEl) {
    jobCharCountEl.textContent = `${chars.toLocaleString()} chars`;
  }
}

/**
 * Switch between Full JD and Selected Text view
 * @param {'full'|'selection'} mode
 */
function switchTabMode(mode) {
  activeTabMode = mode;
  if (mode === 'full') {
    tabFullJd?.classList.add('active');
    tabSelectionJd?.classList.remove('active');
    if (jobDescTextarea) {
      jobDescTextarea.value = currentFullJd;
    }
    updateMetrics(currentFullJd);
  } else {
    tabSelectionJd?.classList.add('active');
    tabFullJd?.classList.remove('active');
    if (jobDescTextarea) {
      jobDescTextarea.value = currentSelectedJd;
    }
    updateMetrics(currentSelectedJd);
  }
}

/**
 * Populates UI with detected job data
 * @param {object} job
 */
function renderJobCard(job) {
  if (!job || !job.detected) {
    jobCard?.classList.add('hidden');
    emptyState?.classList.remove('hidden');
    sentSuccessCard?.classList.add('hidden');
    setStatus('No job description detected on this tab', 'warning');
    return;
  }

  activeDetectedJob = job;
  emptyState?.classList.add('hidden');
  jobCard?.classList.remove('hidden');
  sentSuccessCard?.classList.add('hidden');

  // Populate metadata fields
  if (jobTitleInput) jobTitleInput.value = job.title || 'Untitled Role';
  if (jobCompanyInput) jobCompanyInput.value = job.company || 'Company Not Specified';
  if (jobLocationInput) jobLocationInput.value = job.location || 'Location Not Specified';
  if (jobSourceEl) jobSourceEl.textContent = job.platform || 'Job Board';

  // Store texts
  currentFullJd = (job.fullDescription || job.description || '').trim();
  currentSelectedJd = (job.selectedText || '').trim();

  // Handle selected text tab visibility
  if (currentSelectedJd.length > 0) {
    tabSelectionJd?.classList.remove('hidden');
    captureSelectionBtn?.classList.remove('hidden');
    if (job.hasSelection) {
      switchTabMode('selection');
    } else {
      switchTabMode('full');
    }
  } else {
    tabSelectionJd?.classList.add('hidden');
    captureSelectionBtn?.classList.add('hidden');
    switchTabMode('full');
  }

  setStatus(`Job captured from ${job.platform || 'page'}!`, 'success');

  const mainBtn = sendToApplyforgeBtn || importBtnFallback;
  if (mainBtn) {
    mainBtn.disabled = false;
    mainBtn.textContent = '⚡ Send to ApplyForge';
  }
}

/**
 * Queries active browser tab to capture job details
 * @param {boolean} [useSelectionOnly=false]
 */
async function scanActiveTab(useSelectionOnly = false) {
  setStatus(useSelectionOnly ? 'Capturing selected text...' : 'Scanning page for job posting...', 'loading');

  if (typeof chrome === 'undefined' || !chrome.tabs) {
    setStatus('Extension APIs unavailable in this environment', 'warning');
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      setStatus('Could not identify active tab', 'warning');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'CAPTURE_JD', useSelection: useSelectionOnly }, (response) => {
      if (chrome.runtime.lastError) {
        jobCard?.classList.add('hidden');
        emptyState?.classList.remove('hidden');
        setStatus('Cannot scan this page (open a job posting on LinkedIn or Naukri)', 'warning');
      } else if (response && response.job && response.job.detected) {
        renderJobCard(response.job);
      } else {
        jobCard?.classList.add('hidden');
        emptyState?.classList.remove('hidden');
        setStatus('No job posting or highlighted text detected on current page', 'warning');
      }
    });
  } catch (err) {
    setStatus(`Capture failed: ${err.message}`, 'warning');
  }
}

/**
 * Requests content script on active tab to highlight the captured JD element
 */
async function highlightOnPage() {
  if (typeof chrome === 'undefined' || !chrome.tabs) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { action: 'HIGHLIGHT_JD' }, (res) => {
      if (chrome.runtime.lastError) {
        setStatus('Could not highlight element on page', 'warning');
      } else if (res && res.success) {
        if (highlightOnPageBtn) {
          const originalText = highlightOnPageBtn.textContent;
          highlightOnPageBtn.textContent = '✓ Highlighted!';
          setTimeout(() => {
            highlightOnPageBtn.textContent = originalText;
          }, 1500);
        }
      }
    });
  } catch (err) {
    console.error('Highlight failed:', err);
  }
}

/**
 * Copies captured JD textarea text to clipboard
 */
async function copyJdText() {
  const text = jobDescTextarea?.value || '';
  if (!text) return;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      jobDescTextarea.select();
      document.execCommand('copy');
    }

    if (copyJdBtn) {
      const originalText = copyJdBtn.textContent;
      copyJdBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyJdBtn.textContent = originalText;
      }, 1500);
    }
  } catch (err) {
    console.error('Failed to copy text:', err);
  }
}

/**
 * Sends the captured JD payload to ApplyForge backend and automatically
 * redirects to the Apply wizard with the created JD pre-filled.
 */
async function handleSendToApplyForge() {
  const desc = jobDescTextarea?.value.trim() || '';
  if (!desc) {
    setStatus('Please ensure the job description text is not empty', 'warning');
    return;
  }

  // Check if JWT token exists
  if (!currentConfig.apiToken) {
    setStatus('Authentication required: please sign in with your ApplyForge account or enter a JWT token in settings.', 'warning');
    settingsPanel?.classList.remove('hidden');
    return;
  }

  const title = jobTitleInput?.value.trim() || activeDetectedJob?.title || 'Untitled Role';
  const company = jobCompanyInput?.value.trim() || activeDetectedJob?.company || 'Company Not Specified';
  const location = jobLocationInput?.value.trim() || activeDetectedJob?.location || '';

  const mainBtn = sendToApplyforgeBtn || importBtnFallback;
  if (mainBtn) {
    mainBtn.disabled = true;
    mainBtn.textContent = 'Sending to ApplyForge...';
  }
  setStatus('Sending job description to ApplyForge API...', 'loading');

  const payload = {
    ...activeDetectedJob,
    title,
    company,
    location,
    description: desc,
    rawText: desc,
    url: activeDetectedJob?.url || '',
    source: 'extension',
  };

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: 'SAVE_JOB', job: payload, redirect: true }, (res) => {
      if (res && res.success) {
        if (mainBtn) {
          mainBtn.textContent = '✓ Sent! Redirecting...';
          mainBtn.disabled = false;
        }
        setStatus('Job sent to ApplyForge! Redirected to Apply wizard.', 'success');

        // Show success card with direct link
        if (sentSuccessCard) {
          sentSuccessCard.classList.remove('hidden');
        }
        if (sentSuccessMessage) {
          sentSuccessMessage.textContent = 'Saved to ApplyForge. Opening the Apply Wizard with your JD pre-filled...';
        }

        const frontendUrl = (currentConfig.frontendUrl || 'http://localhost:5173').replace(/\/+$/, '');
        const createdId = res.createdId || res.data?.jobDescription?._id || res.data?._id || res.data?.data?._id || '';
        const targetUrl = res.redirectUrl || (createdId ? `${frontendUrl}/apply?jdId=${createdId}` : `${frontendUrl}/apply`);

        if (viewInApplyforgeLink) {
          viewInApplyforgeLink.href = targetUrl;
          viewInApplyforgeLink.textContent = 'Open in Apply Wizard ↗';
        }
      } else {
        if (mainBtn) {
          mainBtn.disabled = false;
          mainBtn.textContent = '⚡ Send to ApplyForge';
        }

        if (res?.requiresAuth) {
          setStatus(res.error || 'Authentication required: please sign in.', 'warning');
          settingsPanel?.classList.remove('hidden');
        } else {
          setStatus(res?.error || 'Failed to send job description', 'warning');
        }
      }
    });
  } else {
    // Non-chrome test simulation
    setStatus('Simulation: Job captured and sent to ApplyForge', 'success');
  }
}

/**
 * Performs Email & Password login from the extension popup
 */
async function handlePopupLogin() {
  const email = (loginEmailInput?.value || '').trim();
  const password = loginPasswordInput?.value || '';

  if (!email || !password) {
    if (loginStatusMsg) {
      loginStatusMsg.className = 'login-feedback error';
      loginStatusMsg.textContent = 'Please enter both email and password.';
      loginStatusMsg.classList.remove('hidden');
    }
    return;
  }

  if (loginSubmitBtn) {
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Signing in...';
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: 'LOGIN', email, password }, (res) => {
      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = 'Sign In to ApplyForge';
      }

      if (res && res.success) {
        currentConfig.apiToken = res.token;
        currentConfig.user = res.user;
        if (apiTokenInput) apiTokenInput.value = res.token;

        updateAuthUI(res.user, res.token);

        if (loginStatusMsg) {
          loginStatusMsg.className = 'login-feedback success';
          loginStatusMsg.textContent = `✓ Signed in as ${res.user?.email || 'user'}`;
          loginStatusMsg.classList.remove('hidden');
        }
        setStatus('Successfully signed in to ApplyForge!', 'success');

        setTimeout(() => {
          loginStatusMsg?.classList.add('hidden');
          settingsPanel?.classList.add('hidden');
        }, 1500);
      } else {
        if (loginStatusMsg) {
          loginStatusMsg.className = 'login-feedback error';
          loginStatusMsg.textContent = res?.error || 'Login failed. Please check your credentials.';
          loginStatusMsg.classList.remove('hidden');
        }
      }
    });
  }
}

/**
 * Attempts to automatically sync auth token from open ApplyForge tabs
 */
async function handleSyncTokenFromTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    setStatus('Cannot inspect tabs in this environment', 'warning');
    return;
  }

  syncTabTokenBtn && (syncTabTokenBtn.textContent = 'Syncing...');

  try {
    const tabs = await chrome.tabs.query({});
    const applyForgeTab = tabs.find(
      (t) => t.url && (t.url.includes('localhost:5173') || t.url.includes('localhost:5000') || t.url.includes('applyforge'))
    );

    if (!applyForgeTab || !applyForgeTab.id) {
      if (loginStatusMsg) {
        loginStatusMsg.className = 'login-feedback error';
        loginStatusMsg.textContent = 'No active ApplyForge tab found. Please sign in to ApplyForge in your browser.';
        loginStatusMsg.classList.remove('hidden');
      }
      syncTabTokenBtn && (syncTabTokenBtn.textContent = '⚡ Sync from Tab');
      return;
    }

    if (chrome.scripting?.executeScript) {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: applyForgeTab.id },
        func: () => {
          const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
          let user = null;
          try {
            user = JSON.parse(localStorage.getItem('user'));
          } catch {}
          return { token, user };
        },
      });

      if (result?.result?.token) {
        const { token, user } = result.result;
        currentConfig.apiToken = token;
        currentConfig.user = user;
        if (apiTokenInput) apiTokenInput.value = token;

        chrome.runtime.sendMessage({ action: 'SAVE_CONFIG', config: { apiToken: token, user } });
        updateAuthUI(user, token);

        if (loginStatusMsg) {
          loginStatusMsg.className = 'login-feedback success';
          loginStatusMsg.textContent = '✓ Successfully synced token from ApplyForge web tab!';
          loginStatusMsg.classList.remove('hidden');
        }
        setStatus('Synced auth credentials from browser tab!', 'success');
      } else {
        if (loginStatusMsg) {
          loginStatusMsg.className = 'login-feedback error';
          loginStatusMsg.textContent = 'No active login session found on the ApplyForge tab.';
          loginStatusMsg.classList.remove('hidden');
        }
      }
    }
  } catch (err) {
    if (loginStatusMsg) {
      loginStatusMsg.className = 'login-feedback error';
      loginStatusMsg.textContent = `Sync failed: ${err.message}`;
      loginStatusMsg.classList.remove('hidden');
    }
  } finally {
    syncTabTokenBtn && (syncTabTokenBtn.textContent = '⚡ Sync from Tab');
  }
}

/**
 * Initializes configuration settings and checks auth status
 */
async function loadConfig() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: 'GET_CONFIG' }, (res) => {
      if (res && res.config) {
        currentConfig = { ...currentConfig, ...res.config };
        if (serverUrlInput) serverUrlInput.value = currentConfig.serverUrl || 'http://localhost:5000';
        if (frontendUrlInput) frontendUrlInput.value = currentConfig.frontendUrl || 'http://localhost:5173';
        if (apiTokenInput) apiTokenInput.value = currentConfig.apiToken || '';

        updateAuthUI(currentConfig.user, currentConfig.apiToken);

        // Verify token in background if present
        if (currentConfig.apiToken) {
          chrome.runtime.sendMessage({ action: 'VERIFY_AUTH' }, (authRes) => {
            if (authRes && authRes.authenticated) {
              currentConfig.user = authRes.user || currentConfig.user;
              updateAuthUI(currentConfig.user, currentConfig.apiToken);
            }
          });
        }
      }
    });
  }
}

// Event Listeners initialization
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    scanActiveTab();

    // Live metrics update when user edits JD in textarea
    if (jobDescTextarea) {
      jobDescTextarea.addEventListener('input', () => {
        updateMetrics(jobDescTextarea.value);
        if (activeTabMode === 'full') {
          currentFullJd = jobDescTextarea.value;
        } else {
          currentSelectedJd = jobDescTextarea.value;
        }
      });
    }

    // Tab switcher
    if (tabFullJd) {
      tabFullJd.addEventListener('click', () => switchTabMode('full'));
    }
    if (tabSelectionJd) {
      tabSelectionJd.addEventListener('click', () => switchTabMode('selection'));
    }

    // Text tool buttons
    if (highlightOnPageBtn) {
      highlightOnPageBtn.addEventListener('click', highlightOnPage);
    }
    if (copyJdBtn) {
      copyJdBtn.addEventListener('click', copyJdText);
    }
    if (captureSelectionBtn) {
      captureSelectionBtn.addEventListener('click', () => switchTabMode('selection'));
    }

    // Primary Action: Send to ApplyForge
    if (sendToApplyforgeBtn) {
      sendToApplyforgeBtn.addEventListener('click', handleSendToApplyForge);
    }
    if (importBtnFallback) {
      importBtnFallback.addEventListener('click', handleSendToApplyForge);
    }

    // Auth Bar action button
    if (authActionBtn) {
      authActionBtn.addEventListener('click', () => {
        settingsPanel?.classList.toggle('hidden');
      });
    }

    // Login submit
    if (loginSubmitBtn) {
      loginSubmitBtn.addEventListener('click', handlePopupLogin);
    }

    // Sync token from tab
    if (syncTabTokenBtn) {
      syncTabTokenBtn.addEventListener('click', handleSyncTokenFromTab);
    }

    // Sign out button
    if (authSignoutBtn) {
      authSignoutBtn.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'LOGOUT' }, () => {
            currentConfig.apiToken = '';
            currentConfig.user = null;
            if (apiTokenInput) apiTokenInput.value = '';
            updateAuthUI(null, '');
            setStatus('Logged out of ApplyForge', 'warning');
          });
        }
      });
    }

    // Verify token button
    if (verifyTokenBtn) {
      verifyTokenBtn.addEventListener('click', () => {
        const token = (apiTokenInput?.value || '').trim();
        if (!token) {
          setStatus('Please enter a JWT token to verify', 'warning');
          return;
        }
        verifyTokenBtn.textContent = 'Verifying...';
        chrome.runtime.sendMessage({ action: 'VERIFY_AUTH', token }, (res) => {
          verifyTokenBtn.textContent = 'Verify Token';
          if (res && res.authenticated) {
            currentConfig.apiToken = token;
            currentConfig.user = res.user;
            chrome.runtime.sendMessage({ action: 'SAVE_CONFIG', config: { apiToken: token, user: res.user } });
            updateAuthUI(res.user, token);
            setStatus(`Token verified! Connected as ${res.user?.email || 'user'}`, 'success');
          } else {
            setStatus('Token verification failed: invalid or expired', 'warning');
          }
        });
      });
    }

    // Rescan actions
    if (rescanHeaderBtn) {
      rescanHeaderBtn.addEventListener('click', () => scanActiveTab(false));
    }
    if (rescanBtn) {
      rescanBtn.addEventListener('click', () => scanActiveTab(false));
    }
    if (captureHighlightEmptyBtn) {
      captureHighlightEmptyBtn.addEventListener('click', () => scanActiveTab(true));
    }

    // Settings Panel toggle & close
    if (settingsToggleBtn) {
      settingsToggleBtn.addEventListener('click', () => {
        settingsPanel?.classList.toggle('hidden');
      });
    }
    if (closeSettingsXBtn) {
      closeSettingsXBtn.addEventListener('click', () => {
        settingsPanel?.classList.add('hidden');
      });
    }
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', () => {
        settingsPanel?.classList.add('hidden');
      });
    }

    // Save Settings
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        const newConfig = {
          serverUrl: (serverUrlInput?.value || '').trim() || 'http://localhost:5000',
          frontendUrl: (frontendUrlInput?.value || '').trim() || 'http://localhost:5173',
          apiToken: (apiTokenInput?.value || '').trim(),
        };

        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'SAVE_CONFIG', config: newConfig }, (res) => {
            if (res && res.success) {
              currentConfig = { ...currentConfig, ...newConfig };
              updateAuthUI(currentConfig.user, newConfig.apiToken);
              settingsPanel?.classList.add('hidden');
              setStatus('Settings saved successfully', 'success');
            }
          });
        }
      });
    }

    // Test Connection
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener('click', async () => {
        const serverUrl = (serverUrlInput?.value || 'http://localhost:5000').trim().replace(/\/+$/, '');
        testConnectionBtn.textContent = 'Testing...';
        try {
          const resp = await fetch(`${serverUrl}/health`).catch(() => null);
          if (resp && resp.ok) {
            testConnectionBtn.textContent = '✓ Connected!';
            setStatus('ApplyForge API server is online and reachable!', 'success');
          } else {
            testConnectionBtn.textContent = '✗ Unreachable';
            setStatus('ApplyForge server returned non-200 or could not connect', 'warning');
          }
        } catch (e) {
          testConnectionBtn.textContent = '✗ Error';
          setStatus(`Connection failed: ${e.message}`, 'warning');
        }
        setTimeout(() => {
          if (testConnectionBtn) testConnectionBtn.textContent = 'Test Connection';
        }, 3000);
      });
    }

    // Open Dashboard link
    if (openDashboardLink) {
      openDashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        const dashboardUrl = currentConfig.frontendUrl || 'http://localhost:5173';

        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
          chrome.tabs.create({ url: dashboardUrl });
        } else {
          window.open(dashboardUrl, '_blank');
        }
      });
    }
  });
}

// Universal export for unit tests
const exportsObj = {
  calculateWordCount,
  setStatus,
  updateMetrics,
  updateAuthUI,
  switchTabMode,
  renderJobCard,
  scanActiveTab,
  highlightOnPage,
  copyJdText,
  handleSendToApplyForge,
  handlePopupLogin,
  handleSyncTokenFromTab,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportsObj;
}
