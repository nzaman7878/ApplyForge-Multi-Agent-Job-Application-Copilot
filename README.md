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

### Running the End-to-End Smoke Test

Run the full end-to-end authentication smoke test (registration → login → protected profile verification → token refresh → logout → token invalidation check):

```bash
npm run test:auth -w server
```
