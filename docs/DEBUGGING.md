# ApplyForge Debugging & Diagnostic Runbook

[← Back to Documentation Hub](README.md) • [Architecture](ARCHITECTURE.md) • [Testing Guide](TESTING.md) • [Setup Guide](SETUP.md)

---

## 1. Overview & Diagnostic Philosophy

ApplyForge operates across an asynchronous multi-agent distributed system with external LLM dependencies, binary document parsers, and web scrapers. When failures occur, the architecture prioritizes **graceful degradation** through deterministic heuristics.

This runbook outlines standard debugging procedures, diagnostic log signals, and resolution playbooks for common failure modes.

---

## 2. Fast Triage Checklist

```bash
# 1. Check API server health and uptime
curl -i http://localhost:5000/api/health

# 2. Check MongoDB connectivity
mongosh mongodb://localhost:27017/applyforge --eval "db.adminCommand('ping')"

# 3. Verify Google Gemini API credentials
node -e "const { GoogleGenerativeAI } = require('@google/generative-ai'); new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: 'gemini-2.5-flash' }); console.log('Gemini SDK Configured');"

# 4. Check client dev server status
curl -i http://localhost:5173
```

---

## 3. Gemini LLM & Agent Node Debugging

### Symptom: `API key not valid` or `ResourceExhausted (429)`
**Log Output**:
```
[FollowUpNode] LLM invocation failed, falling back to heuristic: [GoogleGenerativeAI Error]: API key not valid.
```
**Diagnosis**:
- `GEMINI_API_KEY` is empty, expired, or blocked by Google AI Studio quota limits.
- ApplyForge automatically activates its **Deterministic Fallback Engine** (`generateFollowUpHeuristic`, `generateTailoringHeuristic`, `generateFitScoreHeuristic`). The application will continue functioning with rule-based outputs.

**Resolution**:
1. Check `server/.env` and verify `GEMINI_API_KEY=AIzaSy...`.
2. Ensure no leading or trailing whitespace.
3. Test key independently:
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"contents": [{"parts":[{"text": "Hello"}]}]}'
```

---

## 4. Document Ingestion & Parser Troubleshooting

### Symptom: `Invalid file signature: magic byte validation failed`
**Diagnosis**:
- A file with extension `.pdf` or `.docx` was uploaded, but the underlying binary payload does not start with the mandatory file signature:
  - PDF must begin with `%PDF-` (`0x25 0x50 0x44 0x46`)
  - DOCX must begin with `PK\x03\x04` (`0x50 0x4B 0x03 0x04`)

**Resolution**:
- Open file in a hex editor (`xxd sample.pdf | head -n 2`). Verify the first 4 bytes match the expected signature.
- Re-export the resume directly from Microsoft Word or Google Docs using **File → Download as PDF**.

### Symptom: Empty Parsed Text in Scanned PDF
**Diagnosis**:
- The PDF contains scanned bitmap images without an embedded OCR text layer. `pdf-parse` extracts text streams, not OCR images.

**Resolution**:
- Run OCR pre-processing or export the resume as a searchable PDF.

---

## 5. Web Scraper Troubleshooting (`POST /api/jds/from-url`)

### Symptom: Scraping returns empty or generic page content
**Diagnosis**:
- The job board URL is protected by Cloudflare Turnstile or requires active session login (e.g., private LinkedIn recruiter links).

**Resolution**:
1. Inspect the URL: Ensure it is a public job posting (e.g. `linkedin.com/jobs/view/...` or `boards.greenhouse.io/...`).
2. Test scraper directly using curl to see returned HTML:
```bash
curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "https://boards.greenhouse.io/acme/jobs/12345"
```
3. Use the Chrome Extension or manual paste mode (`JDPasteForm`) as an instant alternative.

---

## 6. Chrome Extension MV3 Debugging

### Step-by-Step Extension Diagnostics:
1. Open `chrome://extensions/` in Chrome.
2. Ensure **Developer Mode** (top-right toggle) is enabled.
3. Find **ApplyForge Job Application Copilot**.
4. Click **Inspect views: service worker** to open the background DevTools console.
5. Right-click the extension popup icon in the browser toolbar and choose **Inspect** to debug `popup.js`.
6. Inspect the job board tab console to check `content.js` console messages (`[ApplyForge Content Script] ...`).

### Symptom: `Cannot read properties of undefined (reading 'jwt')`
**Resolution**:
- Click **"⚡ Sync from Tab"** in the popup while having an active ApplyForge web session open (`http://localhost:5173`). This harvests the JWT token and writes it to `chrome.storage.local`.

---

## 7. Frontend Axios Token Refresh Loops

### Symptom: Continuous `401 Unauthorized` in browser Network tab
**Diagnosis**:
- The stored `refreshToken` has expired or was revoked in MongoDB, causing the Axios response interceptor to fail during `/api/auth/refresh`.

**Resolution**:
1. Check `client/src/lib/axios.js`.
2. Clear browser local storage:
```javascript
localStorage.clear();
window.location.href = '/login';
```
3. The response interceptor automatically handles queue draining and clears invalid tokens on refresh rejection.

---

## 8. Test Execution Runbook

When debugging specific test failures, execute the isolated test file with verbose output:

```bash
# Debug specific unit test
npx --node-options="--experimental-vm-modules" jest tests/unit/followUpNode.test.js --verbose

# Debug specific integration test with in-memory Mongo logs
DEBUG=applyforge:* npx --node-options="--experimental-vm-modules" jest tests/integration/followUpDraftEndpoint.test.js

# Debug client Vitest component test
npm test -- client/src/test/FollowUpDraftModal.test.jsx --run
```

---

*ApplyForge &copy; 2026. Document revision 1.2.0.*
