/**
 * ApplyForge Chrome Extension - Popup Controller (Phase 106)
 * Handles JD capture, selection toggle, live word/char metrics, highlighting,
 * and sending to ApplyForge backend.
 */

let activeDetectedJob = null;
let currentFullJd = '';
let currentSelectedJd = '';
let activeTabMode = 'full'; // 'full' | 'selection'

let currentConfig = {
  serverUrl: 'http://localhost:5000',
  apiToken: '',
};

// Safe element getter for browser and Node.js testing environments
const getEl = (id) => (typeof document !== 'undefined' && document.getElementById ? document.getElementById(id) : null);

// UI Elements
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
const importBtnFallback = getEl('import-btn'); // For backwards compatibility if queried
const sentSuccessCard = getEl('sent-success-card');
const viewInApplyforgeLink = getEl('view-in-applyforge-link');

const rescanHeaderBtn = getEl('rescan-header-btn');
const rescanBtn = getEl('rescan-btn');
const captureHighlightEmptyBtn = getEl('capture-highlight-empty-btn');

// Settings elements
const settingsToggleBtn = getEl('settings-toggle-btn');
const saveSettingsBtn = getEl('save-settings-btn');
const testConnectionBtn = getEl('test-connection-btn');
const closeSettingsBtn = getEl('close-settings-btn');
const serverUrlInput = getEl('server-url-input');
const apiTokenInput = getEl('api-token-input');
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
    // If job was detected by selection, activate selection tab
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
        // Content script might not be injected yet
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
      // Fallback
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
 * Sends the captured and edited JD payload to ApplyForge backend
 */
async function handleSendToApplyForge() {
  const desc = jobDescTextarea?.value.trim() || '';
  if (!desc) {
    setStatus('Please ensure the job description text is not empty', 'warning');
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
  setStatus('Sending job description to ApplyForge backend...', 'loading');

  const payload = {
    ...activeDetectedJob,
    title,
    company,
    location,
    description: desc,
    rawText: desc,
    url: activeDetectedJob?.url || '',
    source: activeDetectedJob?.platform || 'extension',
  };

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: 'SAVE_JOB', job: payload }, (res) => {
      if (res && res.success) {
        if (mainBtn) {
          mainBtn.textContent = '✓ Sent to ApplyForge!';
          mainBtn.disabled = false;
        }
        setStatus('Job successfully captured & sent to ApplyForge!', 'success');

        // Show success card with direct link
        if (sentSuccessCard) {
          sentSuccessCard.classList.remove('hidden');
        }
        if (viewInApplyforgeLink) {
          const baseUrl = currentConfig.serverUrl.includes('localhost')
            ? 'http://localhost:5173'
            : currentConfig.serverUrl;
          const createdId = res.data?.jobDescription?._id || res.data?._id || res.data?.data?._id || '';
          viewInApplyforgeLink.href = createdId
            ? `${baseUrl}/tailor?jdId=${createdId}`
            : `${baseUrl}/applications`;
        }
      } else {
        if (mainBtn) {
          mainBtn.disabled = false;
          mainBtn.textContent = '⚡ Retry Send to ApplyForge';
        }
        setStatus(res?.error || 'Failed to send job description', 'warning');
      }
    });
  } else {
    // Non-chrome mock response for testing
    setStatus('Simulation: Job captured and sent to ApplyForge', 'success');
  }
}

/**
 * Initializes configuration settings from chrome.storage
 */
async function loadConfig() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: 'GET_CONFIG' }, (res) => {
      if (res && res.config) {
        currentConfig = res.config;
        if (serverUrlInput) serverUrlInput.value = currentConfig.serverUrl || 'http://localhost:5000';
        if (apiTokenInput) apiTokenInput.value = currentConfig.apiToken || '';
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

  // Settings Panel events
  if (settingsToggleBtn) {
    settingsToggleBtn.addEventListener('click', () => {
      settingsPanel?.classList.toggle('hidden');
    });
  }
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsPanel?.classList.add('hidden');
    });
  }
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const newConfig = {
        serverUrl: (serverUrlInput?.value || '').trim() || 'http://localhost:5000',
        apiToken: (apiTokenInput?.value || '').trim(),
      };

      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'SAVE_CONFIG', config: newConfig }, (res) => {
          if (res && res.success) {
            currentConfig = newConfig;
            settingsPanel?.classList.add('hidden');
            setStatus('Settings saved successfully', 'success');
          }
        });
      }
    });
  }
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', async () => {
      const serverUrl = (serverUrlInput?.value || 'http://localhost:5000').trim().replace(/\/+$/, '');
      testConnectionBtn.textContent = 'Testing...';
      try {
        const resp = await fetch(`${serverUrl}/health`).catch(() => null);
        if (resp && resp.ok) {
          testConnectionBtn.textContent = '✓ Connected!';
          setStatus('ApplyForge server is online and reachable!', 'success');
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
      const dashboardUrl = currentConfig.serverUrl.includes('localhost')
        ? 'http://localhost:5173'
        : currentConfig.serverUrl;

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
  switchTabMode,
  renderJobCard,
  scanActiveTab,
  highlightOnPage,
  copyJdText,
  handleSendToApplyForge,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportsObj;
}
