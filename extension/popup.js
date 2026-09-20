/**
 * ApplyForge Chrome Extension - Popup Controller
 */

let activeDetectedJob = null;
let currentConfig = {
  serverUrl: 'http://localhost:5000',
  apiToken: '',
};

// UI Elements
const statusBanner = document.getElementById('status-banner');
const statusText = document.getElementById('status-text');
const jobCard = document.getElementById('job-card');
const emptyState = document.getElementById('empty-state');
const settingsPanel = document.getElementById('settings-panel');

const jobTitleEl = document.getElementById('job-title');
const jobCompanyEl = document.getElementById('job-company');
const jobLocationEl = document.getElementById('job-location');
const jobSourceEl = document.getElementById('job-source');
const jobDescSnippetEl = document.getElementById('job-desc-snippet');
const jobDescCountEl = document.getElementById('job-desc-count');

const importBtn = document.getElementById('import-btn');
const rescanBtn = document.getElementById('rescan-btn');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const serverUrlInput = document.getElementById('server-url-input');
const apiTokenInput = document.getElementById('api-token-input');
const openDashboardLink = document.getElementById('open-dashboard-link');

/**
 * Updates the status banner styling and text
 */
function setStatus(text, type = 'loading') {
  statusText.textContent = text;
  statusBanner.className = `status-banner status-${type}`;
}

/**
 * Populates UI with detected job data
 */
function renderJobCard(job) {
  if (!job || !job.detected) {
    jobCard.classList.add('hidden');
    emptyState.classList.remove('hidden');
    setStatus('No job description detected on this tab', 'warning');
    return;
  }

  activeDetectedJob = job;
  emptyState.classList.add('hidden');
  jobCard.classList.remove('hidden');

  jobTitleEl.textContent = job.title || 'Untitled Role';
  jobCompanyEl.textContent = job.company ? `🏢 ${job.company}` : '🏢 Company Not Specified';
  jobLocationEl.textContent = job.location ? `📍 ${job.location}` : '📍 Location Not Specified';
  jobSourceEl.textContent = job.platform || 'Job Board';

  const desc = (job.description || '').trim();
  jobDescSnippetEl.textContent = desc || 'No job description text extracted.';
  jobDescCountEl.textContent = `${desc.length.toLocaleString()} characters`;

  setStatus(`Job detected on ${job.platform || 'page'}!`, 'success');
  importBtn.disabled = false;
  importBtn.textContent = '⚡ Import to ApplyForge';
}

/**
 * Queries active browser tab to detect job details
 */
async function scanActiveTab() {
  setStatus('Scanning page for job posting...', 'loading');

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

    chrome.tabs.sendMessage(tab.id, { action: 'DETECT_JOB' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script may not be injected on this page (e.g. chrome:// or unsupported host)
        jobCard.classList.add('hidden');
        emptyState.classList.remove('hidden');
        setStatus('Cannot scan this page (open a job posting on LinkedIn or Naukri)', 'warning');
      } else if (response && response.job && response.job.detected) {
        renderJobCard(response.job);
      } else {
        jobCard.classList.add('hidden');
        emptyState.classList.remove('hidden');
        setStatus('No job posting detected on current page', 'warning');
      }
    });
  } catch (err) {
    setStatus(`Scan failed: ${err.message}`, 'warning');
  }
}

/**
 * Initializes configuration settings
 */
async function loadConfig() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: 'GET_CONFIG' }, (res) => {
      if (res && res.config) {
        currentConfig = res.config;
        serverUrlInput.value = currentConfig.serverUrl || 'http://localhost:5000';
        apiTokenInput.value = currentConfig.apiToken || '';
      }
    });
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  scanActiveTab();

  // Import button action
  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      if (!activeDetectedJob) return;

      importBtn.disabled = true;
      importBtn.textContent = 'Importing to ApplyForge...';
      setStatus('Sending job to ApplyForge backend...', 'loading');

      chrome.runtime.sendMessage(
        { action: 'SAVE_JOB', job: activeDetectedJob },
        (res) => {
          if (res && res.success) {
            importBtn.textContent = '✓ Imported Successfully!';
            setStatus('Job successfully saved to ApplyForge!', 'success');
          } else {
            importBtn.disabled = false;
            importBtn.textContent = 'Retry Import';
            setStatus(res?.error || 'Failed to import job description', 'warning');
          }
        }
      );
    });
  }

  // Rescan button
  if (rescanBtn) {
    rescanBtn.addEventListener('click', scanActiveTab);
  }

  // Settings toggle
  if (settingsToggleBtn) {
    settingsToggleBtn.addEventListener('click', () => {
      settingsPanel.classList.toggle('hidden');
    });
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsPanel.classList.add('hidden');
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const newConfig = {
        serverUrl: serverUrlInput.value.trim() || 'http://localhost:5000',
        apiToken: apiTokenInput.value.trim(),
      };

      chrome.runtime.sendMessage(
        { action: 'SAVE_CONFIG', config: newConfig },
        (res) => {
          if (res && res.success) {
            currentConfig = newConfig;
            settingsPanel.classList.add('hidden');
            setStatus('Settings saved successfully', 'success');
          }
        }
      );
    });
  }

  // Dashboard link
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
