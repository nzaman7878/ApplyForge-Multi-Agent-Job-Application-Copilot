# ApplyForge — Multi-Agent Job Application Copilot

_Paste a job description and your resume — a multi-agent pipeline tailors your application, checks ATS fit, and tracks the whole application lifecycle._

## Overview

Tailoring every resume and cover letter to each job description is the single most time-consuming part of a job search — and skipping it is exactly what gets freshers filtered out by ATS keyword matching before a human ever sees the resume. Most "AI resume tools" either (a) just rewrite text with no verification of fit, or (b) give a generic ATS score with no actionable fix. None of them close the loop by also tracking what you applied to and when to follow up.

ApplyForge is an agentic pipeline that takes a job description + your resume, produces a tailored resume and cover letter, verifies ATS keyword coverage, scores real fit (not just keyword overlap), and — critically — puts a human approval step before anything is finalized. It then tracks the application through its lifecycle like a lightweight personal CRM.

## Architecture

The system uses a LangGraph-powered AI agent pipeline with a human-in-the-loop checkpoint.

```mermaid
graph TD
    A[User submits resume + JD] --> B[Parser: extract resume sections + JD requirements]
    B --> C[Resume Tailoring Agent]
    B --> D[ATS Keyword Agent]
    C --> E[Cover Letter Agent]
    D --> F[Fit Scoring Agent]
    E --> G[HUMAN CHECKPOINT: review + edit all outputs]
    F --> G
    G -->|Approved| H[Save final application to MongoDB]
    G -->|Edits requested| C
    H --> I[Application Tracker CRM]
    I --> J[Follow-up reminder scheduling]
```

## Setup

### Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose (for local database)

### Environment Variables

Before starting the app, set up your `.env` files. You can copy the provided example files:

```bash
cp server/.env.example server/.env
```

| Variable            | Description                                    | Default                                |
| ------------------- | ---------------------------------------------- | -------------------------------------- |
| `PORT`              | The port the Express server runs on            | `5000`                                 |
| `NODE_ENV`          | Environment mode (`development`, `production`) | `development`                          |
| `MONGODB_URI`       | Connection string for MongoDB (required later) | `mongodb://localhost:27017/applyforge` |
| `JWT_SECRET`        | Secret key for JWT access tokens               |                                        |
| `ANTHROPIC_API_KEY` | API key for Claude/LangGraph                   |                                        |

### Running the App Locally

**1. Install Dependencies**
Install dependencies for the root, client, and server:

```bash
npm install
npm install -w client
npm install -w server
```

**2. Start the Database**
Use Docker Compose to spin up a local MongoDB instance:

```bash
npm run docker:up
```

**3. Run the Development Servers**
Start both the React frontend and Express backend concurrently:

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:5000`.

## API Reference

### Health Check

| Method | Endpoint      | Access | Description                                                                                  |
| ------ | ------------- | ------ | -------------------------------------------------------------------------------------------- |
| `GET`  | `/api/health` | Public | Basic server health check returning `{ status: 'ok', message: 'ApplyForge API is running' }` |

### Authentication Endpoints (`/api/auth`)

| Method | Endpoint             | Access                       | Description                                                                                                                          |
| ------ | -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `POST` | `/api/auth/register` | Public                       | Register a new user with `name`, `email`, and `password`. Returns access token, refresh token, and sanitized user object.            |
| `POST` | `/api/auth/login`    | Public (Rate-limited)        | Authenticate user with credentials. Rate limited to 5 requests per 15 minutes. Returns access token, refresh token, and user object. |
| `GET`  | `/api/auth/me`       | Protected (`Bearer <token>`) | Retrieve current authenticated user profile without sensitive password hashes or tokens.                                             |
| `POST` | `/api/auth/refresh`  | Public                       | Submit `refreshToken` to receive a newly issued `accessToken`.                                                                       |
| `POST` | `/api/auth/logout`   | Protected / Token-based      | Invalidate active session by clearing the stored `refreshToken` in the database.                                                     |

### Resume Ingestion Endpoints (`/api/resumes`)

| Method   | Endpoint           | Access                       | Description                                                                                              |
| -------- | ------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/resumes`     | Protected (`Bearer <token>`) | Upload and parse resume file (PDF or DOCX, up to 5MB). Extracts sections, saves to MongoDB, returns doc. |
| `GET`    | `/api/resumes`     | Protected (`Bearer <token>`) | List all resumes belonging to the authenticated user (`id`, `name`, `uploadedAt`), sorted newest first.  |
| `GET`    | `/api/resumes/:id` | Protected (`Bearer <token>`) | Retrieve full resume document with complete `parsedSections` (Contact, Summary, Experience, etc.).       |
| `DELETE` | `/api/resumes/:id` | Protected (`Bearer <token>`) | Delete resume with user ownership verification and associated file cleanup on disk.                      |

### Job Description Endpoints (`/api/jds`)

| Method   | Endpoint            | Access                       | Description                                                                                          |
| -------- | ------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/jds`          | Protected (`Bearer <token>`) | Create and parse a new job description from pasted text (`company`, `roleTitle`, `rawText`).         |
| `POST`   | `/api/jds/from-url` | Protected (`Bearer <token>`) | Scrape and ingest job description from target URL (stretch preview stub, responds `501`).           |
| `GET`    | `/api/jds`          | Protected (`Bearer <token>`) | List all job descriptions for the authenticated user, sorted in reverse chronological order.         |
| `GET`    | `/api/jds/:id`      | Protected (`Bearer <token>`) | Retrieve full job description document with complete `parsedRequirements` and original `rawText`.   |
| `DELETE` | `/api/jds/:id`      | Protected (`Bearer <token>`) | Delete job description with user ownership verification.                                             |

## Resume Ingestion & Parsing Pipeline


ApplyForge features a robust, heuristic document ingestion pipeline that transforms unstructured PDF and DOCX resumes into structured, schema-compliant career profiles ready for AI tailoring.

### Ingestion Lifecycle

```mermaid
graph LR
    A[Upload PDF / DOCX] --> B[Multer Middleware: validate MIME, ext, & 5MB limit]
    B --> C[Document Parser Router: pdf-parse / mammoth]
    C --> D[Text Normalization: clean control chars, format breaks]
    D --> E[Heuristic Section Extractor: Regex heading classifier]
    E --> F[Structured Resume Document: Contact, Summary, Experience, Education, Skills, Certifications]
    F --> G[(MongoDB Persistence: Resume Model)]
```

### Supported Formats & Limits

| Format                      | File Extension | MIME Type                                                                 | Max File Size | Parser Engine |
| --------------------------- | -------------- | ------------------------------------------------------------------------- | ------------- | ------------- |
| **Portable Document**       | `.pdf`         | `application/pdf`                                                         | `5 MB`        | `pdf-parse`   |
| **Microsoft Word Document** | `.docx`        | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `5 MB`        | `mammoth`     |

### Extracted Resume Sections

- **Contact**: Candidate name, email address, phone number, physical location, LinkedIn profile, GitHub profile, and portfolio website.
- **Summary**: Professional summary and executive profile statements.
- **Experience**: Work history timeline including job titles, companies, employment dates (`startDate`, `endDate`, `current`), locations, descriptions, and itemized bullet points.
- **Education**: Academic history including universities/institutions, degrees, fields of study, attendance dates, GPA, and honors.
- **Skills**: Technical skills, frameworks, tools, and competencies extracted via dictionary matching and delimited tokens.
- **Certifications**: Industry credentials, issuers, credential dates, and verification URLs.

### Resume UI Components

- **`ResumeUploader`** (`client/src/components/resume/ResumeUploader.jsx`):
  - Interactive drag-and-drop zone with visual hover/drop animations.
  - File picker with client-side format and size validation.
  - Real-time animated upload progress bar and parsing state indicator.
  - Uploaded resumes management list with selection and inline delete confirmation.
- **`ResumePreview`** (`client/src/components/resume/ResumePreview.jsx`):
  - Structured card layout rendering contact pills, professional summary, skill tags, work experience timeline with bullet points, education, and certifications.
  - Raw extracted text view with one-click copy to clipboard for transparency.

## Job Description (JD) Ingestion & Parsing Pipeline

ApplyForge provides an intelligent job description ingestion and parsing pipeline that processes pasted job listings or URLs, extracting essential job criteria, required skills, and qualification metrics through structured regex heuristics and keyword classification.

### JD Ingestion Lifecycle

```mermaid
graph LR
    A[Pasted Raw Text / Job URL] --> B{Source Type}
    B -->|Paste| C[Text Normalizer: clean whitespace & sanitize text]
    B -->|URL| D[JD Scraper: axios fetch & cheerio text extractor]
    C --> E[JD Section Parser: structured regex & dictionary matcher]
    D --> E
    E --> F[Extracted Criteria: Required Skills, Experience, Qualifications, Nice-to-Have]
    F --> G[(MongoDB Persistence: JobDescription Model)]
```

### Extracted JD Criteria & Heuristics

- **Required Skills**: Core technical competencies, programming languages, platforms, and frameworks matched against a comprehensive technology dictionary.
- **Experience Years**: Numeric year ranges, seniority levels (Junior, Mid-Level, Senior, Staff, Lead), and minimum required experience detected via regex heuristics.
- **Qualifications**: Degrees (Bachelor's, Master's, PhD), certifications, and relevant academic or professional prerequisites.
- **Nice-to-Have**: Preferred skills, bonus domain experience, and optional competencies separated from non-negotiable requirements.

### JD UI Components

- **`JDPasteForm`** (`client/src/components/jd/JDPasteForm.jsx`):
  - Company name and role title inputs with clean dark-mode input fields.
  - Large expandable textarea for job postings with real-time character count and paste actions.
  - Quick example loader for rapid testing and interactive validation.
- **`JDRequirementsPanel`** (`client/src/components/jd/JDRequirementsPanel.jsx`):
  - Color-coded tag lists displaying extracted required skills, qualifications, experience level, and nice-to-have items.
  - Summary metrics and expandable full text preview with one-click clipboard copy.

## Application Tailoring Wizard Flow

The multi-step Application Copilot wizard orchestrates user inputs, LLM multi-agent reasoning, and generated artifacts through centralized Redux state management.

### Wizard Lifecycle Diagram

```mermaid
graph TD
    Step1[Step 1: Input Selection<br>Choose Resume + Job Description] -->|Validate & Next| Step2[Step 2: Gap Analysis<br>Skills Audit & ATS Match Score]
    Step2 -->|Run Agent| Step3[Step 3: Resume Tailoring<br>Keyword Alignment & Bullet Optimization]
    Step3 -->|Run Agent| Step4[Step 4: Cover Letter<br>Targeted Value Proposition]
    Step4 -->|Run Agent| Step5[Step 5: Outreach Message<br>Recruiter & Hiring Manager InMails]
    Step5 --> Complete[Ready to Apply & Export Artifacts]
```

### Wizard Architecture & State Management

1. **Redux Store Slice (`client/src/store/applySlice.js`)**:
   - **Step Tracking**: `currentStep` (1 to 5) with sequential boundary navigation (`setCurrentStep`, `nextStep`, `prevStep`).
   - **Document Selection**: `selectedResume` and `selectedJd` instances linked to persistent MongoDB documents.
   - **Agent Outputs**: Central store holding `status` (`idle`, `loading`, `succeeded`, `failed`), `gapAnalysis`, `tailoredResume`, `coverLetter`, `outreachMessage`, and execution timestamps.
   - **Typed Selectors**: Memoized selectors (`selectCurrentStep`, `selectIsStep1Ready`, `selectAgentOutputs`) ensuring optimized re-renders.

2. **Visual Step Indicator (`client/src/components/ui/StepIndicator.jsx`)**:
   - Interactive animated progress rail highlighting active, completed, and upcoming steps.
   - Icon badges and numbered state transitions with accessible ARIA attributes.

## Frontend Authentication Flow

The client application implements a complete, modern authentication system built with React 19, React Router, React Hook Form, Zod, and Tailwind CSS.

### Architecture & Lifecycle

1. **Route Protection & Guards**:
   - **`PublicRoute`**: Wraps guest-only routes (`/login`, `/register`). If an authenticated user visits these routes, they are automatically redirected to `/dashboard`.
   - **`PrivateRoute`**: Protects workspace routes (`/dashboard`, `/apply`, `/tracker`). If a visitor lacks a valid token, they are redirected to `/login`.
   - **`PageLoader`**: Displays an ambient, brand-styled spinner screen during initial session verification.

2. **State Management (`AuthContext`)**:
   - Manages `user`, `accessToken`, and `loading` states.
   - Exposes asynchronous actions: `login(email, password)`, `register(name, email, password)`, and `logout()`.
   - Synchronizes token persistence in memory and `localStorage`.

3. **HTTP Interceptors (`client/src/lib/axios.js`)**:
   - **Request Interceptor**: Automatically attaches `Authorization: Bearer <token>` to all outgoing API requests.
   - **Response Interceptor**: Automatically intercepts `401 Unauthorized` responses, queues incoming requests, exchanges the stored `refreshToken` for a new `accessToken` via `POST /api/auth/refresh`, and transparently replays the original requests without user disruption. If refresh fails, it clears credentials and triggers logout.

4. **Notifications & Feedback (`useToast`)**:
   - Custom hook wrapper around `react-hot-toast` with theme presets matching the dark palette (`slate-900`, `slate-800`, emerald success, and rose error states).

5. **Layout Wrapper (`AppLayout`)**:
   - Wraps protected pages with a responsive sticky top `Navbar` (brand monogram, links, user badge, mobile hamburger drawer) and a desktop navigation sidebar (Dashboard, Tailor Application, Tracker, Multi-Agent status indicator, and quick logout button).

### Screenshots

<!-- Screenshot Placeholders -->

| Page          | Preview                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Login**     | _<!-- Screenshot Placeholder: docs/screenshots/login.png -->_<br>![ApplyForge Login](https://raw.githubusercontent.com/nzaman7878/ApplyForge-Multi-Agent-Job-Application-Copilot/main/docs/screenshots/login.png)<br>_Dark-mode login form with validation and error shake animation_      |
| **Register**  | _<!-- Screenshot Placeholder: docs/screenshots/register.png -->_<br>![ApplyForge Registration](https://raw.githubusercontent.com/nzaman7878/ApplyForge-Multi-Agent-Job-Application-Copilot/main/docs/screenshots/register.png)<br>_Real-time password length indicator and Zod validation_ |
| **Dashboard** | _<!-- Screenshot Placeholder: docs/screenshots/dashboard.png -->_<br>![ApplyForge Dashboard](https://raw.githubusercontent.com/nzaman7878/ApplyForge-Multi-Agent-Job-Application-Copilot/main/docs/screenshots/dashboard.png)<br>_AppLayout with sidebar, Navbar, and application metrics_ |

### Testing & Verification Suites

Run the backend test suites to verify system functionality:

```bash
# Authentication flow E2E smoke test
npm run test:auth -w server

# Resume model schema and validations
npm run test:resume -w server

# Multer file upload middleware (type validation, size limits)
npm run test:upload -w server

# PDF parser service
npm run test:pdf -w server

# DOCX parser service
npm run test:docx -w server

# Heuristic resume section extractor
npm run test:section -w server

# Resume upload endpoint (POST /api/resumes)
npm run test:upload-endpoint -w server

# Resume list and detail endpoints (GET /api/resumes)
npm run test:get-resumes -w server

# Resume delete endpoint with ownership guard (DELETE /api/resumes/:id)
npm run test:delete-resume -w server

# JobDescription model schema and validation
npm run test:jd-model -w server

# Job description section parser service
npm run test:jd-parser -w server

# Job description creation endpoint (POST /api/jds)
npm run test:create-jd -w server

# JD scraper service & URL ingestion endpoint (POST /api/jds/from-url)
npm run test:jd-scraper -w server

# JD list, detail, and delete endpoints (GET/DELETE /api/jds)
npm run test:jd-crud -w server
```

