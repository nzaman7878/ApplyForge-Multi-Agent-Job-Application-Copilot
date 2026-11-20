# Changelog

All notable changes to the **ApplyForge** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-11-20

### 🚀 Epic K: Stretch Features & Intelligent Extensions (Phases 101–110)

#### Added
- **URL-to-JD Live Web Scraper (Phases 101–102)**:
  - Implemented `jdScraper.js` supporting direct job description scraping from LinkedIn, Greenhouse, Lever, Naukri, Indeed, and generic web postings via `axios` and `cheerio`.
  - Added anti-bot mitigation with randomized realistic user-agent rotation and clean DOM text extraction.
  - Added `POST /api/jds/from-url` endpoint to parse and persist scraped job listings into MongoDB.
  - Integrated "Import from URL" tab in `JDPasteForm` on the frontend with live scraping progress states, domain badge recognition, and pre-submission editable form fields.
  - **Commits**: `feat(server): implement URL-to-JD scraper for major job boards`, `feat(client): add URL scraping tab to JD input form`.

- **Voice Learning & Personalization Pipeline (Phases 103–104)**:
  - Created `editCollector.js` service to compute character and word-level diffs from user edits during human-in-the-loop reviews, automatically storing revisions in `application.userEdits`.
  - Added `POST /api/applications/:id/edits`, `GET /api/applications/:id/edits`, and `GET /api/applications/voice/profile` to aggregate candidate vocabulary preferences and phrasing signals.
  - Built personalization injection pipeline in `resumeTailoringNode.js`: queries the candidate's last 10 approved edits and injects them as few-shot "style examples" into the Gemini system prompt to preserve authentic candidate voice across tailoring runs.
  - **Commits**: `feat(server): implement user edit history collection for voice learning`, `feat(server): inject user edit history into tailoring agent for voice learning`.

- **Chrome Browser Extension (Manifest V3) (Phases 105–107)**:
  - Scaffolded Chrome MV3 extension in `extension/` with service worker, popup UI, content scripts, and required permissions (`tabs`, `storage`, `activeTab`).
  - Implemented smart content scripts for automated job posting detection on LinkedIn and Naukri, with raw JD text extraction and on-page element highlighting.
  - Developed popup interface with character/word counters, "Full JD" vs "Selected Text" capture tabs, and one-click "Send to ApplyForge" action.
  - Integrated JWT authentication and tab token harvesting (`⚡ Sync from Tab`) with automatic redirection to the Apply wizard (`/apply?jdId=...`) with imported JD requirements pre-filled.
  - **Commits**: `feat(extension): scaffold Chrome extension with MV3 manifest`, `feat(extension): implement JD capture from job board pages`, `feat(extension): integrate extension with ApplyForge API and auth`.

- **Intelligent Follow-Up Email Draft Agent & UI (Phases 108–109)**:
  - Engineered `followUpNode.js` multi-strategy email drafting agent node and standalone `generateFollowUpEmail` helper.
  - Designed elapsed-days and status adaptation matrix:
    - `<= 7 days`: `early_courtesy_check` (enthusiastic check-in confirming receipt, 7-day wait window).
    - `8–14 days`: `standard_status_inquiry` (polite check-in reiterating technical fit, 5-day wait window).
    - `> 14 days`: `graceful_re_engagement` (respectful inquiry on search timeline, 10-day wait window).
    - `interviewing`: `post_interview_reinforcement` (thank-you follow-up reinforcing discussed technical priorities).
  - Added `POST /api/applications/:id/draft-followup` endpoint with validation, tenant ownership verification, and automatic MongoDB persistence in `application.followUpEmail` and `application.followUpDrafts`.
  - Built `FollowUpDraftModal.jsx` accessible modal component featuring real-time editable subject and body fields, strategy badges, recommended send timing, collapsible AI fine-tuning directives (recipient, tone, notes, days override), one-click clipboard copy (full email, subject, body), manual edit persistence, and "Mark Followed-Up" lifecycle action.
  - Wired follow-up drafting across the Tracker dashboard (Due Banner, Kanban cards, Sortable Table) and Application Dossier view.
  - **Commits**: `feat(server): add follow-up email drafting agent`, `feat(client): add follow-up email draft modal`.

- **Comprehensive Documentation & Changelog (Phase 110)**:
  - Updated `README.md` with full Epic K stretch architecture diagrams, API references, feature guides, and metric-driven resume bullets.
  - Added `CHANGELOG.md` with complete version history across all 110 implementation phases.
  - **Commit**: `docs: update README with stretch features and add CHANGELOG`.

---

## [1.1.0] - 2026-09-24

### 🛡️ Production Hardening, Security, Performance & CI/CD (Phases 91–100)

#### Added
- **Automated Test Suites (Phases 91–94)**:
  - Added Jest unit tests for PDF parser, DOCX parser, and heuristic section extractor with 100% boundary coverage.
  - Added unit tests for LangGraph agent nodes (`parserNode`, `resumeTailoringNode`, `atsKeywordNode`, `coverLetterNode`, `fitScoringNode`) with mocked LLM fallbacks.
  - Added Supertest integration test suites for core REST APIs (`auth.test.js`, `resumeUpload.test.js`, `pipeline.test.js`, `application.test.js`) against in-memory MongoDB.
  - Added Vitest + React Testing Library component test suites for client review cockpit and tracker boards.
  - **Commits**: `test(server): add unit tests for parser services`, `test(server): add unit tests for agent nodes with mocked LLM`, `test(server): add integration tests for core API endpoints`, `test(client): add component tests for review and tracker UI`.

- **Performance Optimization & Code Splitting (Phase 95)**:
  - Added Express `compression` middleware (Gzip/Brotli) reducing JSON payload transfer sizes by up to 70%.
  - Added in-memory API response caching middleware for static and read-heavy endpoints.
  - Configured route-level code splitting via `React.lazy` and manual Rollup vendor chunks (`vendor-react`, `vendor-redux`, `vendor-ui`, `vendor-charts`, `vendor-dnd`, `vendor-icons`), reducing initial JS bundle size from 1.2MB to lightweight chunks with sub-second production builds (695ms).
  - **Commit**: `perf: add compression, code splitting, and Lighthouse optimizations`.

- **Security Hardening (Phase 96)**:
  - Integrated `helmet` with strict Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, and frame-ancestors protection.
  - Enforced CORS origin whitelisting with wildcard subdomain support for trusted deployment origins.
  - Added global API rate limiting (100 req/15 min) and strict auth rate limiting (5 req/15 min).
  - Implemented binary file upload sanitization checking magic byte signatures (`%PDF-`, `PK\x03\x04`) to prevent file extension spoofing and arbitrary code execution.
  - **Commit**: `security: add CSP headers, rate limiting, and upload sanitization`.

- **CI/CD Pipeline & Production Containerization (Phases 97–99)**:
  - Multi-stage production `server/Dockerfile` using `node:20-alpine`, non-root execution (`USER node`), and built-in healthchecks.
  - GitHub Actions CI/CD workflow (`ci.yml`) running linting, backend tests, and frontend build on every push and PR.
  - Vercel SPA routing configuration (`vercel.json`) and cloud deployment blueprints (`render.yaml`, `railway.json`).
  - Full production environment verification and cross-service smoke testing.
  - **Commits**: `chore: add production Dockerfile and CI/CD workflow`, `chore: add Vercel deployment config for frontend`, `fix: production deployment fixes and environment-specific corrections`.

---

## [1.0.0] - 2026-09-15

### 📊 Analytics & Performance Intelligence Dashboard (Phases 81–90)

#### Added
- **Analytics Aggregation API (`/api/analytics`)**:
  - `GET /api/analytics/summary`: Real-time calculation of key performance indicators (`totalApplied`, `totalActive`, `totalInterviews`, `totalOffers`, `responseRate`, `avgFitScore`).
  - `GET /api/analytics/timeline`: 12-week rolling application velocity buckets for trend forecasting.
  - `GET /api/analytics/score-vs-response`: Correlation analysis between ATS fit score tiers and interview callback rates.
- **Interactive Recharts Visualization Suite**:
  - `TimelineChart.jsx`: Smooth area chart plotting weekly application submissions over 12 weeks.
  - `StatusDonut.jsx`: Multi-segment donut chart visualizing application distribution across 7 stages.
  - `ScoreVsResponseBar.jsx`: Grouped bar chart comparing callback rates across Low (0-40), Moderate (41-70), and High (71-100) match tiers.
  - `StatCard.jsx`: Glassmorphic KPI cards with animated count-up transitions and month-over-month trend badges.
  - `RecentApplications.jsx`: Live activity stream of recently tracked applications with one-click navigation.
  - `EmptyState.jsx`: Brand-styled SVG illustrations for initial onboarding.
- **Automated Dashboard Demo Seeder**:
  - `scripts/seed-dashboard.js`: Generates 24 realistic applications across 12 weeks for instant dashboard demonstrations.
- **Commits**: `feat(server): add analytics aggregation endpoints`, `feat(client): assemble Dashboard page with charts and stat cards`, `feat: complete analytics dashboard and update README`.

---

## [0.3.0] - 2026-09-14

### 🗂️ Application Tracker & Personal Job Search CRM (Phases 71–80)

#### Added
- **Application CRM Data Model & CRUD API (`/api/applications`)**:
  - Mongoose `Application` schema with status lifecycle tracking, audit timeline (`statusHistory`), tailored assets, fit scores, and follow-up reminders.
  - Filtering by stage (`wishlist`, `applied`, `interviewing`, `rejected`, `offer`), search by company/role, and cursor pagination.
  - Transition validation middleware guaranteeing valid stage lifecycles and logging timestamps.
- **Kanban Board with Drag-and-Drop Interaction**:
  - Built with `@dnd-kit/core` and `@dnd-kit/sortable` featuring smooth drag overlays and 5px pointer activation constraints.
  - 5 distinct stage columns (`Drafted`, `Applied`, `Interviewing`, `Rejected`, `Offer`) with color-coded badges and card counters.
- **Application Card & Table Views**:
  - `ApplicationCard.jsx`: Dynamic company brand avatars, fit score badges, days since applied counter, and quick action hover toolbar.
  - `ApplicationTable.jsx`: High-density sortable table view with user view preference persisted in `localStorage`.
- **Automated Follow-Up Reminder System**:
  - `GET /api/applications/follow-ups/due`: Real-time query surfacing applications where `nextFollowUpAt <= now`.
  - `FollowUpBanner.jsx`: Urgent amber pulsing radar beacon at the top of the tracker with inline "Mark Followed Up" and Snooze (+1d, +3d, +7d) dropdowns.
- **Application CRM Dossier (`/applications/:id`)**:
  - Full detail page with 5 inspection tabs (`Tailored Bullets`, `Cover Letter`, `ATS Analysis`, `Role Fit`, `Status & Timeline`).
  - Vertical glowing `StatusTimeline.jsx` audit trail displaying chronological stage history with exact timestamps.
  - One-click application package export (.txt bundle).
- **Commits**: `feat(server): add Application mongoose model with full CRM fields`, `feat(client): build Kanban application tracker with drag-and-drop`, `feat: complete application tracker CRM and update README`.

---

## [0.2.0] - 2026-09-13

### 🤖 Multi-Agent LangGraph Copilot & Review Cockpit (Phases 41–70)

#### Added
- **LangGraph Multi-Agent Architecture**:
  - Directed Acyclic Graph (DAG) state machine orchestrating 5 specialized agents with Google Gemini 2.5 Flash:
    1. `Parser Agent Node`: Normalizes resume and JD data structures.
    2. `Resume Tailoring Agent Node`: Generates bullet revisions with zero fabrication and authentic voice preservation.
    3. `ATS Keyword Agent Node`: Computes weighted keyword matching (`required`: 3, `preferred`: 2, `bonus`: 1).
    4. `Cover Letter Agent Node`: Generates targeted, cliché-free cover letters weaving candidate accomplishments.
    5. `Fit Scoring Agent Node`: Synthesizes 60% quantitative ATS overlap with 40% qualitative seniority evaluation.
- **Human-in-the-Loop Review Cockpit (Apply Step 3)**:
  - LangGraph checkpoint pause (`interruptBefore: ['__human_interrupt__']`) at `status: 'awaiting_review'`.
  - `BulletsEditor.jsx`: Side-by-side original vs. tailored bullet comparison with inline editing and accept/reject controls.
  - `CoverLetterEditor.jsx`: Full-text editor with word/character counts, reading time estimates, and AI regeneration modal.
  - `ATSReport.jsx`: Circular SVG match progress ring with matched vs. missing keyword tags and section badges.
  - `FitScore.jsx`: 260° radial gauge with tier classification (`Strong`, `Moderate`, `Stretch`) and actionable gap analysis.
  - Candidate decision loopback: Approve (`POST /api/pipeline/:runId/approve`) to save to CRM or Request Edits (`POST /api/pipeline/:runId/edit`) to re-prompt tailoring agents with candidate notes.
- **Commits**: `feat(server): assemble LangGraph pipeline with parallel agent execution`, `feat(client): assemble Step 3 Review checkpoint with all four panels`, `feat: complete human-in-the-loop review flow and update README`.

---

## [0.1.0] - 2026-09-09

### 🏗️ Monorepo Bootstrap, Full-Stack Auth & Ingestion (Phases 1–40)

#### Added
- **Monorepo Architecture & Tooling**:
  - Root monorepo workspace managing `client/` and `server/`.
  - Shared ESLint and Prettier formatting configurations.
  - Docker Compose provisioning local MongoDB instance with persistent volume.
  - Concurrent development runner (`npm run dev`).
- **Secure Full-Stack Authentication**:
  - Express backend with MongoDB User model and bcrypt password hashing.
  - JWT token architecture with short-lived access tokens and persistent refresh token rotation.
  - Rate-limited auth endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/logout`).
  - React 19 SPA frontend with React Router, `AuthContext`, and Axios interceptors for automatic token refresh.
  - Dark-mode Login and Register pages with React Hook Form and Zod schema validation.
- **Document Ingestion & Parsing**:
  - Multer multipart file upload middleware supporting PDF and DOCX files up to 5MB.
  - Cloudinary asset integration with secure cloud storage and URL persistence.
  - Regex-based heuristic section extractor parsing Contact, Summary, Experience, Education, Skills, and Certifications.
  - Interactive `ResumeUploader.jsx` with drag-and-drop animations and `ResumePreview.jsx` with structured section cards.
  - Job description text ingestion API (`/api/jds`) with requirement classifier identifying required skills, experience levels, and nice-to-haves.
  - Redux Toolkit `applySlice` managing the 5-step application wizard workflow.
- **Commits**: `first commit` through `feat: complete auth flow E2E and update README`.

---
