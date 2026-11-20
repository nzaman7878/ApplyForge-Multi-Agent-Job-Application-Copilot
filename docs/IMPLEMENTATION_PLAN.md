# ApplyForge — Multi-Agent Job Application Copilot
## 110-Phase Master Implementation Plan

[← Back to Documentation Hub](README.md) • [Architecture](ARCHITECTURE.md) • [Product Requirements (PRD)](PRD.md) • [Changelog](../CHANGELOG.md)

> **Strategy**: Each phase is a single atomic commit to `main`. Every phase ends with a working, runnable codebase. Phases are grouped into **Epics** (major milestones). All 110 phases have been executed and verified in production.

---

## 📋 Epic Overview

| Epic | Phases | Focus |
|---|---|---|
| **A** | 1–10 | Project Scaffold & DevOps |
| **B** | 11–20 | Auth System (Backend) |
| **C** | 21–30 | Auth System (Frontend) |
| **D** | 31–40 | Resume Ingestion & Parsing |
| **E** | 41–50 | Job Description Ingestion |
| **F** | 51–60 | AI Agent Pipeline (Backend) |
| **G** | 61–70 | Human-in-the-Loop Checkpoint |
| **H** | 71–80 | Application Tracker CRM |
| **I** | 81–90 | Dashboard & Analytics |
| **J** | 91–100 | Polish, Testing & Deployment |
| **K** | 101–110 | Stretch Goals |

---

## Epic A — Project Scaffold & DevOps (Phases 1–10)

### Phase 1 — Monorepo root setup
- Create `package.json` at root (workspaces: `client`, `server`)
- Add `.gitignore` (node_modules, .env, dist, uploads)
- Add `README.md` detailed header with architecture diagram
- Add `CONTRIBUTING.md`
- **Commit**: `chore: initialize monorepo root with workspaces`

### Phase 2 — Backend scaffold (Express)
- `cd server && npm init`
- Install: `express cors dotenv helmet morgan`
- Create `server/src/index.js` — bare Express app, health route `GET /api/health`
- Create `server/.env.example`
- **Commit**: `feat(server): bootstrap Express server with health endpoint`

### Phase 3 — Frontend scaffold (React + Vite)
- `cd client && npm create vite@latest . -- --template react`
- Install: `react-router-dom axios`
- Clean Vite boilerplate, set up `App.jsx` with placeholder
- **Commit**: `feat(client): bootstrap React+Vite frontend`

### Phase 4 — Tailwind CSS setup
- Install Tailwind v3 + PostCSS + Autoprefixer in client
- Configure `tailwind.config.js`, `postcss.config.js`
- Add base CSS reset and font (Inter via Google Fonts)
- **Commit**: `feat(client): configure Tailwind CSS with Inter font`

### Phase 5 — Design system tokens
- Create `client/src/styles/tokens.css` — color palette, spacing, radius, shadow variables
- Establish dark/light mode CSS variables
- Create `client/src/styles/global.css`
- **Commit**: `feat(client): add design system CSS tokens and global styles`

### Phase 6 — Shared ESLint + Prettier config
- Add `.eslintrc.js` and `.prettierrc` at root
- Configure rules: no-unused-vars, consistent return, import order
- Add `lint` and `format` scripts to root `package.json`
- **Commit**: `chore: add ESLint and Prettier shared config`

### Phase 7 — Docker Compose for local dev
- `docker-compose.yml` with services: mongo, server, client
- `server/Dockerfile.dev` and `client/Dockerfile.dev`
- Add `docker:up` and `docker:down` scripts to root
- **Commit**: `chore: add Docker Compose for local development environment`

### Phase 8 — Environment config & validation
- Install `joi` in server
- Create `server/src/config/env.js` — validates all required env vars on startup
- Document every env var in `.env.example` with comments
- **Commit**: `chore(server): add environment variable validation with Joi`

### Phase 9 — MongoDB connection module
- Install `mongoose` in server
- Create `server/src/config/database.js` — connect with retry, graceful shutdown
- Wire into `server/src/index.js`
- **Commit**: `feat(server): add MongoDB connection with retry and graceful shutdown`

### Phase 10 — Concurrently dev runner + README update
- Install `concurrently` at root
- Add `dev` script: runs server + client simultaneously
- Update `README.md`: setup instructions, env vars table, how to run
- **Commit**: `chore: add concurrent dev runner and update README with setup guide`

---

## Epic B — Auth System Backend (Phases 11–20)

### Phase 11 — User model (Mongoose)
- `server/src/models/User.js`
- Fields: name, email, passwordHash, createdAt
- Pre-save hook: bcrypt hash on password change
- Static method: `findByCredentials(email, password)`
- **Commit**: `feat(server): add User mongoose model with bcrypt password hashing`

### Phase 12 — JWT utility module
- Install `jsonwebtoken`
- `server/src/utils/jwt.js` — `signToken(userId)`, `verifyToken(token)`
- Configurable expiry from env
- **Commit**: `feat(server): add JWT sign/verify utility`

### Phase 13 — Auth middleware
- `server/src/middleware/auth.js`
- Extracts Bearer token, verifies, attaches `req.user`
- Returns 401 with specific error codes: `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`
- **Commit**: `feat(server): add JWT auth middleware with descriptive error codes`

### Phase 14 — Input validation middleware
- Install `express-validator`
- `server/src/middleware/validate.js` — generic validation runner
- `server/src/validators/auth.validators.js` — register/login schemas
- **Commit**: `feat(server): add express-validator middleware and auth validators`

### Phase 15 — Register endpoint
- `POST /api/auth/register`
- Validates input, checks email uniqueness, creates user, returns JWT + user object
- **Commit**: `feat(server): implement POST /api/auth/register`

### Phase 16 — Login endpoint
- `POST /api/auth/login`
- Validates credentials, returns JWT + user object
- Rate limit login: install `express-rate-limit`
- **Commit**: `feat(server): implement POST /api/auth/login with rate limiting`

### Phase 17 — Get current user endpoint
- `GET /api/auth/me` (protected)
- Returns user without passwordHash
- **Commit**: `feat(server): implement GET /api/auth/me protected endpoint`

### Phase 18 — Refresh token flow
- Add `refreshToken` field to User model
- `POST /api/auth/refresh` — validates refresh token, returns new access token
- **Commit**: `feat(server): add refresh token endpoint`

### Phase 19 — Logout endpoint
- `POST /api/auth/logout` — clears refresh token in DB
- **Commit**: `feat(server): implement logout with refresh token invalidation`

### Phase 20 — Auth router wiring + README update
- Mount all auth routes in `server/src/routes/auth.routes.js`
- Mount at `/api/auth` in main app
- Update README: auth endpoints table
- **Commit**: `feat(server): wire auth router and document auth API`

---

## Epic C — Auth System Frontend (Phases 21–30)

### Phase 21 — React Router setup
- Install `react-router-dom`
- `client/src/router/index.jsx` — routes: `/`, `/login`, `/register`, `/dashboard`, `/apply`, `/tracker`
- Create `PublicRoute` and `PrivateRoute` guard components
- **Commit**: `feat(client): set up React Router with public/private route guards`

### Phase 22 — Auth context + Axios interceptors
- `client/src/context/AuthContext.jsx`
- Manages: user, accessToken, loading state
- `client/src/lib/axios.js` — configured Axios instance with request interceptor (attach token) and response interceptor (handle 401 → refresh)
- **Commit**: `feat(client): add AuthContext and Axios instance with token interceptors`

### Phase 23 — UI Component library base
- `client/src/components/ui/Button.jsx` — variants: primary, secondary, ghost, danger; sizes: sm, md, lg
- `client/src/components/ui/Input.jsx` — label, error state, helper text
- `client/src/components/ui/Card.jsx`
- **Commit**: `feat(client): add base UI components Button, Input, Card`

### Phase 24 — Form components with React Hook Form
- Install `react-hook-form` + `@hookform/resolvers` + `zod`
- `client/src/components/ui/FormField.jsx` — wraps Input with RHF registration
- Auth Zod schemas: `client/src/schemas/auth.schemas.js`
- **Commit**: `feat(client): integrate React Hook Form and Zod for form validation`

### Phase 25 — Register page
- `client/src/pages/Register.jsx`
- Animated form, real-time validation, API call to `/api/auth/register`
- On success: save token, redirect to dashboard
- **Commit**: `feat(client): build Register page with form validation`

### Phase 26 — Login page
- `client/src/pages/Login.jsx`
- Same pattern as Register
- "Don't have an account?" link to Register
- **Commit**: `feat(client): build Login page`

### Phase 27 — Navbar component
- `client/src/components/layout/Navbar.jsx`
- Show user name, logout button when authenticated
- Mobile-responsive hamburger menu
- **Commit**: `feat(client): add Navbar with auth state and mobile menu`

### Phase 28 — Layout wrapper + Loading spinner
- `client/src/components/layout/AppLayout.jsx` — wraps protected pages with Navbar + sidebar
- `client/src/components/ui/Spinner.jsx`
- `client/src/components/ui/PageLoader.jsx`
- **Commit**: `feat(client): add AppLayout, Spinner, and PageLoader components`

### Phase 29 — Toast notification system
- Install `react-hot-toast`
- Configure in `App.jsx`
- `client/src/hooks/useToast.js` — wrapper hook for consistent toast calls
- **Commit**: `feat(client): integrate react-hot-toast notification system`

### Phase 30 — Auth flow E2E + README update
- Smoke test: register → login → see dashboard placeholder → logout
- Update README: frontend auth flow description, screenshot placeholder
- **Commit**: `feat: complete auth flow E2E and update README`

---

## Epic D — Resume Ingestion & Parsing (Phases 31–40)

### Phase 31 — Resume model (Mongoose)
- `server/src/models/Resume.js`
- Fields: userId, originalFilename, rawText, parsedSections (contact, summary, experience, education, skills, certifications), uploadedAt
- **Commit**: `feat(server): add Resume mongoose model`

### Phase 32 — File upload middleware (Multer)
- Install `multer`
- `server/src/middleware/upload.js` — accept PDF + DOCX, 5MB limit, store in `/uploads/resumes/`
- Validate MIME type, return 400 on invalid type
- **Commit**: `feat(server): add Multer file upload middleware for PDF/DOCX`

### Phase 33 — PDF parser service
- Install `pdf-parse`
- `server/src/services/parsers/pdfParser.js` — extract text from Buffer, return cleaned string
- **Commit**: `feat(server): add PDF text extraction service`

### Phase 34 — DOCX parser service
- Install `mammoth`
- `server/src/services/parsers/docxParser.js` — extract text from Buffer
- `server/src/services/parsers/index.js` — route to correct parser by MIME type
- **Commit**: `feat(server): add DOCX text extraction service`

### Phase 35 — Resume section extractor
- `server/src/services/parsers/sectionExtractor.js`
- Heuristic regex-based extraction for sections (Contact, Summary, Experience, Education, Skills)
- Returns structured object matching Resume model `parsedSections`
- **Commit**: `feat(server): add heuristic resume section extractor`

### Phase 36 — Upload resume endpoint
- `POST /api/resumes` (protected, multipart)
- Parse file → extract sections → save to MongoDB → return resume object
- **Commit**: `feat(server): implement POST /api/resumes upload endpoint`

### Phase 37 — Get resumes endpoint
- `GET /api/resumes` — list user's resumes (id, name, uploadedAt)
- `GET /api/resumes/:id` — full resume with sections
- **Commit**: `feat(server): implement GET /api/resumes list and detail endpoints`

### Phase 38 — Delete resume endpoint
- `DELETE /api/resumes/:id` — ownership check, delete file + mongo doc
- **Commit**: `feat(server): implement DELETE /api/resumes with ownership guard`

### Phase 39 — Resume upload UI component
- `client/src/components/resume/ResumeUploader.jsx`
- Drag-and-drop + file picker
- Progress bar during upload
- Display uploaded resumes list with delete option
- **Commit**: `feat(client): add ResumeUploader component with drag-and-drop`

### Phase 40 — Resume preview component + README update
- `client/src/components/resume/ResumePreview.jsx`
- Shows parsed sections in structured layout
- Update README: resume ingestion section, supported formats
- **Commit**: `feat(client): add ResumePreview component and update README`

---

## Epic E — Job Description Ingestion (Phases 41–50)

### Phase 41 — JobDescription model (Mongoose)
- `server/src/models/JobDescription.js`
- Fields: userId, company, roleTitle, rawText, parsedRequirements (skills, experience, qualifications, niceToHave), source (paste/url), createdAt
- **Commit**: `feat(server): add JobDescription mongoose model`

### Phase 42 — JD parsing service
- `server/src/services/parsers/jdParser.js`
- Extract: required skills, experience years, qualifications, nice-to-have from raw JD text
- Use structured regex + keyword detection
- **Commit**: `feat(server): add job description section parser service`

### Phase 43 — Create JD endpoint (paste)
- `POST /api/jds` (protected)
- Accepts: `{ company, roleTitle, rawText }`
- Parses JD, saves to MongoDB
- **Commit**: `feat(server): implement POST /api/jds for pasted job descriptions`

### Phase 44 — URL-to-JD scraper service (stretch preview)
- Install `axios` + `cheerio`
- `server/src/services/scraper/jdScraper.js` — fetch URL, strip HTML, return clean text
- Stub endpoint `POST /api/jds/from-url` — respond 501 if not implemented
- **Commit**: `feat(server): add JD scraper stub and URL ingestion skeleton`

### Phase 45 — JD CRUD endpoints
- `GET /api/jds` — list user's JDs
- `GET /api/jds/:id` — full JD + parsed requirements
- `DELETE /api/jds/:id`
- **Commit**: `feat(server): implement JD list, detail, and delete endpoints`

### Phase 46 — JD paste UI component
- `client/src/components/jd/JDPasteForm.jsx`
- Large textarea for JD, company + role title inputs
- Character counter, submit button
- **Commit**: `feat(client): add JDPasteForm component`

### Phase 47 — JD requirements visualizer
- `client/src/components/jd/JDRequirementsPanel.jsx`
- Renders parsed requirements as tag lists: Required Skills, Experience, Qualifications
- **Commit**: `feat(client): add JDRequirementsPanel to display parsed JD sections`

### Phase 48 — Apply page (Step 1: inputs)
- `client/src/pages/Apply.jsx` — Step 1 of multi-step wizard
- Select or upload resume + paste JD side by side
- React Hook Form + Zod validation
- **Commit**: `feat(client): build Apply page Step 1 — resume and JD input wizard`

### Phase 49 — Step indicator component
- `client/src/components/ui/StepIndicator.jsx`
- Shows current step, completed steps, step labels
- Animated transitions between steps
- **Commit**: `feat(client): add animated StepIndicator component for multi-step wizard`

### Phase 50 — Apply wizard state management + README update
- Install `@reduxjs/toolkit react-redux`
- `client/src/store/applySlice.js` — tracks wizard step, resume/JD selection, agent outputs
- Update README: JD ingestion section, Apply wizard flow diagram
- **Commit**: `feat(client): add Redux apply slice for wizard state management`

---

## Epic F — AI Agent Pipeline Backend (Phases 51–60)

### Phase 51 — LangChain + LangGraph setup
- Install `@langchain/core @langchain/langgraph @langchain/anthropic`
- `server/src/config/llm.js` — initialize LLM client (Claude Sonnet) from env
- Environment vars: `ANTHROPIC_API_KEY`, `LLM_MODEL`, `LLM_TEMPERATURE`
- **Commit**: `feat(server): initialize LangChain and LangGraph with Claude Sonnet`

### Phase 52 — Agent state type definition
- `server/src/agents/state.js`
- LangGraph state schema: `{ resumeSections, jdRequirements, tailoredBullets, atsReport, coverLetter, fitScore, humanApproved, userEdits }`
- **Commit**: `feat(server): define LangGraph agent state schema`

### Phase 53 — Parser agent node
- `server/src/agents/nodes/parserNode.js`
- Combines resume sections + JD requirements into structured comparison format
- Output: `{ structuredResume, structuredJD }` added to state
- **Commit**: `feat(server): implement Parser agent node`

### Phase 54 — Resume Tailoring Agent node
- `server/src/agents/nodes/resumeTailoringNode.js`
- System prompt: rewrite bullets to emphasize JD keywords; no fabrication; preserve voice
- Structured JSON output: `{ originalBullet, tailoredBullet, reasoning }[]`
- **Commit**: `feat(server): implement Resume Tailoring Agent with structured JSON output`

### Phase 55 — ATS Keyword Agent node
- `server/src/agents/nodes/atsKeywordNode.js`
- Extract JD keywords with importance weights (required/preferred/bonus)
- Check each against resume text
- Output: `{ matchedKeywords: [{keyword, importance, location}], missingKeywords: [{keyword, importance, suggestion}], overallScore: Number }`
- **Commit**: `feat(server): implement ATS Keyword Agent with weighted keyword analysis`

### Phase 56 — Cover Letter Agent node
- `server/src/agents/nodes/coverLetterNode.js`
- Takes tailored bullets + JD context
- System prompt: professional tone, no clichés, specific to role
- Output: `{ subject, body, keyThemes }` in JSON
- **Commit**: `feat(server): implement Cover Letter Agent with structured output`

### Phase 57 — Fit Scoring Agent node
- `server/src/agents/nodes/fitScoringNode.js`
- Combines ATS report + qualitative gap analysis
- Output: `{ score: 0-100, tier: 'strong'|'moderate'|'stretch', gaps: [{ skill, severity, suggestion }], strengths: [String] }`
- **Commit**: `feat(server): implement Fit Scoring Agent with gap analysis`

### Phase 58 — LangGraph pipeline assembly
- `server/src/agents/pipeline.js`
- Wire nodes: Parser → [ResumeTailoring ∥ ATS] → CoverLetter → FitScoring → `__human_interrupt__`
- Add conditional edge: if `humanApproved` → save, else → loop back with edits
- **Commit**: `feat(server): assemble LangGraph pipeline with parallel agent execution`

### Phase 59 — Pipeline API endpoints
- `POST /api/pipeline/run` — accepts `{ resumeId, jdId }`, starts pipeline, returns `{ runId, state, status: 'awaiting_review' }`
- `GET /api/pipeline/:runId` — get current state
- `POST /api/pipeline/:runId/approve` — resume graph with human approval
- `POST /api/pipeline/:runId/edit` — resume graph with user edits
- **Commit**: `feat(server): implement pipeline run, status, approve, and edit endpoints`

### Phase 60 — Pipeline run persistence + README update
- `server/src/models/PipelineRun.js` — stores run state, status, timestamps
- Add run reference to Application model
- Update README: agent pipeline section, architecture diagram (Mermaid), API reference
- **Commit**: `feat(server): add PipelineRun model and update README with agent architecture`

---

## Epic G — Human-in-the-Loop Checkpoint UI (Phases 61–70)

### Phase 61 — Apply wizard Step 2: pipeline trigger
- `client/src/pages/apply/Step2Running.jsx`
- POST to `/api/pipeline/run`, show animated agent progress (Parser → ATS → Tailoring → Cover Letter → Fit Score)
- Each agent lights up as it completes
- **Commit**: `feat(client): build Apply Step 2 — pipeline progress animation`

### Phase 62 — ATS Report component
- `client/src/components/review/ATSReport.jsx`
- Two-column layout: Matched Keywords (green tags) vs Missing Keywords (red tags)
- Importance badges: Required / Preferred / Bonus
- Overall ATS score progress ring
- **Commit**: `feat(client): add ATSReport component with keyword tag visualization`

### Phase 63 — Fit Score component
- `client/src/components/review/FitScore.jsx`
- Large score dial (0–100)
- Tier badge: Strong / Moderate / Stretch
- Gap list with severity indicators and suggestions
- **Commit**: `feat(client): add FitScore component with tier badge and gap analysis`

### Phase 64 — Resume bullets editor
- `client/src/components/review/BulletsEditor.jsx`
- For each bullet: show Original vs Tailored side-by-side
- Click tailored bullet to open inline editor
- Accept / Reject / Edit per bullet
- **Commit**: `feat(client): add BulletsEditor with per-bullet accept/reject/edit`

### Phase 65 — Cover letter editor
- `client/src/components/review/CoverLetterEditor.jsx`
- Full-page rich text area (plain textarea with formatting hints)
- "Regenerate" button to re-prompt with user notes
- Character/word count
- **Commit**: `feat(client): add CoverLetterEditor with regeneration and word count`

### Phase 66 — Review checkpoint page assembly
- `client/src/pages/apply/Step3Review.jsx`
- Tabs: Resume Bullets | Cover Letter | ATS Report | Fit Score
- All four components in one page
- **Commit**: `feat(client): assemble Step 3 Review checkpoint with all four panels`

### Phase 67 — Approve / Request edits action
- "Approve & Save Application" button → POST `/api/pipeline/:runId/approve`
- "Request Edits" → modal with notes → POST `/api/pipeline/:runId/edit`
- On approve: redirect to Application detail page
- **Commit**: `feat(client): wire Approve and Request Edits actions to pipeline API`

### Phase 68 — Optimistic UI + error boundary
- `client/src/components/ui/ErrorBoundary.jsx`
- Wrap Step 3 in error boundary
- Show skeleton loaders while pipeline is running
- **Commit**: `feat(client): add ErrorBoundary and skeleton loaders for review step`

### Phase 69 — Keyboard shortcuts + accessibility
- Keyboard: `Ctrl+Enter` = approve, `Escape` = close edit modal
- ARIA labels on all interactive elements
- Focus trap in modals
- **Commit**: `feat(client): add keyboard shortcuts and ARIA accessibility to review UI`

### Phase 70 — Review flow E2E + README update
- Smoke test full flow: upload resume → paste JD → run pipeline → review → approve
- Update README: human-in-the-loop section with screenshot grid
- **Commit**: `feat: complete human-in-the-loop review flow and update README`

---

## Epic H — Application Tracker CRM (Phases 71–80)

### Phase 71 — Application model (Mongoose)
- `server/src/models/Application.js`
- All fields from spec: userId, company, roleTitle, jobDescription, tailoredResume, coverLetter, atsReport, fitScore, status enum, appliedAt, lastFollowUpAt, nextFollowUpAt, userEdits
- **Commit**: `feat(server): add Application mongoose model with full CRM fields`

### Phase 72 — Application CRUD endpoints
- `POST /api/applications` — create (triggered by pipeline approve)
- `GET /api/applications` — list with pagination, filter by status
- `GET /api/applications/:id` — full detail
- `PATCH /api/applications/:id` — update status, follow-up dates
- `DELETE /api/applications/:id`
- **Commit**: `feat(server): implement Application CRUD API with filtering and pagination`

### Phase 73 — Status transition validation
- Middleware: validate status enum on PATCH
- Add status history: `statusHistory: [{ status, changedAt }]` to model
- **Commit**: `feat(server): add status transition validation and history tracking`

### Phase 74 — Follow-up reminder endpoint
- `GET /api/applications/follow-ups/due` — applications where `nextFollowUpAt <= now`
- **Commit**: `feat(server): add follow-up due endpoint for reminder surfacing`

### Phase 75 — Tracker Kanban board component
- `client/src/components/tracker/KanbanBoard.jsx`
- Columns: Drafted | Applied | Interviewing | Rejected | Offer
- Drag-and-drop between columns: install `@dnd-kit/core @dnd-kit/sortable`
- Card shows: company, role, applied date, fit score badge
- **Commit**: `feat(client): build Kanban application tracker with drag-and-drop`

### Phase 76 — Application card component
- `client/src/components/tracker/ApplicationCard.jsx`
- Compact: company logo placeholder, role, status badge, fit score, days since applied
- Hover: reveals quick actions (view, edit status, mark follow-up)
- **Commit**: `feat(client): add ApplicationCard with hover quick actions`

### Phase 77 — Application detail page
- `client/src/pages/ApplicationDetail.jsx`
- Full history: what was tailored, ATS report, cover letter used, status timeline
- Edit status inline, set follow-up date with date picker
- **Commit**: `feat(client): build ApplicationDetail page with status timeline`

### Phase 78 — Table view toggle
- `client/src/components/tracker/ApplicationTable.jsx`
- Toggle between Kanban and table view
- Table: sortable columns (company, date, score, status)
- Persist view preference in localStorage
- **Commit**: `feat(client): add ApplicationTable view with sortable columns and Kanban toggle`

### Phase 79 — Follow-up reminder banner
- `client/src/components/tracker/FollowUpBanner.jsx`
- Shown at top of tracker when follow-ups are due
- Click to mark followed-up or snooze
- **Commit**: `feat(client): add FollowUpBanner for due reminder surfacing`

### Phase 80 — Tracker flow E2E + README update
- Full tracker walkthrough: create application → move through statuses → set follow-up
- Update README: tracker section with Kanban screenshot
- **Commit**: `feat: complete application tracker CRM and update README`

---

## Epic I — Dashboard & Analytics (Phases 81–90)

### Phase 81 — Analytics aggregation endpoint
- `GET /api/analytics/summary` — total applications, by-status counts, response rate, avg fit score
- `GET /api/analytics/timeline` — applications per week over last 12 weeks
- `GET /api/analytics/score-vs-response` — fit score bands vs callback rate
- **Commit**: `feat(server): add analytics aggregation endpoints`

### Phase 82 — Chart library setup
- Install `recharts`
- `client/src/components/charts/` directory
- Base chart wrapper with consistent theming
- **Commit**: `feat(client): add Recharts and base chart wrapper`

### Phase 83 — Applications timeline chart
- `client/src/components/charts/TimelineChart.jsx`
- Area chart: applications per week
- Animated entry, tooltip with week details
- **Commit**: `feat(client): add animated timeline area chart`

### Phase 84 — Status distribution chart
- `client/src/components/charts/StatusDonut.jsx`
- Donut chart: applications by status with color coding
- Center: total application count
- **Commit**: `feat(client): add status distribution donut chart`

### Phase 85 — Fit score vs response rate chart
- `client/src/components/charts/ScoreVsResponseBar.jsx`
- Grouped bar chart: fit score bands (0-40, 41-70, 71-100) vs response rate %
- Insight callout: "Higher tailoring quality correlates with X% more callbacks"
- **Commit**: `feat(client): add fit-score-vs-response-rate bar chart`

### Phase 86 — KPI stat cards
- `client/src/components/dashboard/StatCard.jsx`
- Cards: Total Applied, Response Rate, Avg Fit Score, Open Follow-ups
- Animated number counter on load
- Trend indicator vs previous month
- **Commit**: `feat(client): add animated KPI StatCards for dashboard`

### Phase 87 — Dashboard page assembly
- `client/src/pages/Dashboard.jsx`
- Grid layout: stat cards (top) + charts (middle) + recent applications (bottom)
- Responsive: 3-col desktop, 1-col mobile
- **Commit**: `feat(client): assemble Dashboard page with charts and stat cards`

### Phase 88 — Recent applications panel
- `client/src/components/dashboard/RecentApplications.jsx`
- Last 5 applications with status, fit score, applied date
- Quick links to application detail
- **Commit**: `feat(client): add RecentApplications panel on dashboard`

### Phase 89 — Empty state illustrations
- `client/src/components/ui/EmptyState.jsx`
- SVG illustration + CTA for: no resumes, no applications, no analytics yet
- **Commit**: `feat(client): add EmptyState component with SVG illustrations`

### Phase 90 — Dashboard E2E + README update
- Seed script to generate sample data for dashboard demo
- Update README: dashboard section with chart screenshots
- **Commit**: `feat: complete analytics dashboard and update README`

---

## Epic J — Polish, Testing & Deployment (Phases 91–100)

### Phase 91 — Unit tests: server services
- Install `jest supertest`
- Tests: pdfParser, docxParser, sectionExtractor, jdParser
- npm test script
- **Commit**: `test(server): add unit tests for parser services`

### Phase 92 — Unit tests: agent nodes
- Tests: ATS keyword extraction accuracy, fit score calculation, cover letter output structure
- Mock LLM responses for deterministic testing
- **Commit**: `test(server): add unit tests for agent nodes with mocked LLM`

### Phase 93 — Integration tests: API endpoints
- Supertest: auth flow, resume upload, pipeline run → approve, application CRUD
- **Commit**: `test(server): add integration tests for core API endpoints`

### Phase 94 — Client component tests
- Install `@testing-library/react @testing-library/user-event vitest`
- Tests: ATSReport rendering, BulletsEditor accept/reject, KanbanBoard drag
- **Commit**: `test(client): add component tests for review and tracker UI`

### Phase 95 — Performance optimizations
- Server: add `compression` middleware, response caching for analytics
- Client: code splitting with React.lazy, image optimization
- Lighthouse audit → fix any score < 90
- **Commit**: `perf: add compression, code splitting, and Lighthouse optimizations`

### Phase 96 — Security hardening
- Add `helmet` CSP headers, CORS whitelist from env
- Rate limit all API routes (not just login)
- Sanitize file uploads: check magic bytes, not just MIME type
- **Commit**: `security: add CSP headers, rate limiting, and upload sanitization`

### Phase 97 — Backend deployment (Railway/Render)
- `Dockerfile` for production server
- `railway.json` or `render.yaml` config
- CI: GitHub Actions workflow — lint + test on push to main
- **Commit**: `chore: add production Dockerfile and CI/CD workflow`

### Phase 98 — Frontend deployment (Vercel)
- `vercel.json` config with rewrite rules for SPA routing
- Set environment variables in Vercel dashboard (documented in README)
- **Commit**: `chore: add Vercel deployment config for frontend`

### Phase 99 — Full production smoke test
- Deploy both services, run through full flow on production URL
- Fix any environment-specific issues
- **Commit**: `fix: production deployment fixes and environment-specific corrections`

### Phase 100 — Final README + demo video
- Complete README: all sections, architecture diagram, feature list, live demo link, tech stack badges, screenshots
- Record 3-minute demo video and embed in README
- Resume bullet points section in README (ready to copy)
- **Commit**: `docs: final README with demo link, screenshots, and resume bullets`

---

## Epic K — Stretch Goals (Phases 101–110)

### Phase 101 — URL-to-JD scraper (full implementation)
- Complete `jdScraper.js` with LinkedIn/Naukri/Greenhouse parsers
- Handle anti-bot measures with rotating user agents
- **Commit**: `feat(server): implement URL-to-JD scraper for major job boards`

### Phase 102 — Scraper UI integration
- Add URL input tab to JDPasteForm
- Show scraping progress, allow edit before submitting
- **Commit**: `feat(client): add URL scraping tab to JD input form`

### Phase 103 — Voice learning: edit history collector
- Store every user edit diff in `userEdits` array on Application
- `server/src/services/voiceLearning/editCollector.js`
- **Commit**: `feat(server): implement user edit history collection for voice learning`

### Phase 104 — Voice learning: personalization injection
- Before tailoring agent: fetch last 10 approved edits, inject as "style examples" in system prompt
- **Commit**: `feat(server): inject user edit history into tailoring agent for voice learning`

### Phase 105 — Browser extension scaffold
- `extension/manifest.json` (Chrome MV3)
- Content script: detect job description on LinkedIn/Naukri
- Background service worker
- **Commit**: `feat(extension): scaffold Chrome extension with MV3 manifest`

### Phase 106 — Extension: JD capture
- Content script selects JD text, sends to extension popup
- Popup shows captured JD with "Send to ApplyForge" button
- **Commit**: `feat(extension): implement JD capture from job board pages`

### Phase 107 — Extension: API integration
- Extension popup authenticates with ApplyForge JWT stored in extension storage
- "Send to ApplyForge" → POST to API → redirect to Apply wizard with JD pre-filled
- **Commit**: `feat(extension): integrate extension with ApplyForge API and auth`

### Phase 108 — Email follow-up draft agent
- New agent node: draft follow-up email based on application + days since applied
- Endpoint: `POST /api/applications/:id/draft-followup`
- **Commit**: `feat(server): add follow-up email drafting agent`

### Phase 109 — Follow-up draft UI
- `client/src/components/tracker/FollowUpDraftModal.jsx`
- Shows generated email, editable, copy-to-clipboard
- **Commit**: `feat(client): add follow-up email draft modal`

### Phase 110 — Final stretch goal README + changelog
- Update README with all stretch features
- Add `CHANGELOG.md` with full version history
- **Commit**: `docs: update README with stretch features and add CHANGELOG`

---

## 📌 Cross-Cutting Conventions

### Commit Format
Every commit follows Conventional Commits: `type(scope): message`
- `feat`, `fix`, `chore`, `docs`, `test`, `perf`, `security`, `refactor`

### README Update Policy
- Every 10th phase (or milestone phase) MUST update the README
- README sections: Overview, Features, Tech Stack, Architecture, Setup, API Reference, Screenshots, Roadmap

### Branch Strategy
- All phases commit directly to `main` (since this is a solo project)
- Tag major milestones: `v0.1-auth`, `v0.2-agents`, `v0.3-tracker`, `v1.0`

### Phase Execution Order
Phases must be executed **strictly in order** (1 → 110). No skipping — each phase's code is a dependency for the next.

---

## 🗂️ Final File Tree (after all phases)

```
ApplyForge/
├── client/                        # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/               # Button, Input, Card, Spinner, etc.
│   │   │   ├── layout/           # Navbar, AppLayout
│   │   │   ├── resume/           # ResumeUploader, ResumePreview
│   │   │   ├── jd/               # JDPasteForm, JDRequirementsPanel
│   │   │   ├── review/           # ATSReport, FitScore, BulletsEditor, CoverLetterEditor
│   │   │   ├── tracker/          # KanbanBoard, ApplicationCard, ApplicationTable
│   │   │   ├── dashboard/        # StatCard, RecentApplications
│   │   │   └── charts/           # TimelineChart, StatusDonut, ScoreVsResponseBar
│   │   ├── context/              # AuthContext
│   │   ├── hooks/                # useToast, useAuth
│   │   ├── lib/                  # axios instance
│   │   ├── pages/                # Register, Login, Apply, Tracker, Dashboard, ApplicationDetail
│   │   ├── router/               # index.jsx, route guards
│   │   ├── schemas/              # Zod schemas
│   │   ├── store/                # Redux slices
│   │   └── styles/               # tokens.css, global.css
│   └── vercel.json
├── server/                        # Node.js + Express backend
│   ├── src/
│   │   ├── agents/
│   │   │   ├── nodes/            # parserNode, tailoringNode, atsNode, coverLetterNode, fitScoringNode
│   │   │   ├── pipeline.js       # LangGraph graph assembly
│   │   │   └── state.js          # State type definition
│   │   ├── config/               # env.js, database.js, llm.js
│   │   ├── middleware/           # auth.js, validate.js, upload.js
│   │   ├── models/               # User, Resume, JobDescription, Application, PipelineRun
│   │   ├── routes/               # auth, resume, jd, pipeline, application, analytics
│   │   ├── services/
│   │   │   ├── parsers/          # pdfParser, docxParser, sectionExtractor, jdParser
│   │   │   ├── scraper/          # jdScraper
│   │   │   └── voiceLearning/    # editCollector
│   │   ├── utils/                # jwt.js
│   │   └── validators/           # auth.validators.js
│   ├── Dockerfile
│   └── railway.json
├── extension/                     # Chrome MV3 browser extension (stretch)
├── .github/
│   └── workflows/ci.yml
├── docker-compose.yml
├── package.json                   # Root workspace
├── CHANGELOG.md
└── README.md
```

---

> **Next Step**: Approve this plan and I will begin executing **Phase 1** immediately, creating the monorepo root structure and making the first commit.

