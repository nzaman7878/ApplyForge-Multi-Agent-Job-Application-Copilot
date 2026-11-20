# ApplyForge REST API Specification

[← Back to Documentation Hub](README.md) • [Architecture](ARCHITECTURE.md) • [Auth & Security](AUTH_SECURITY.md) • [Database](DATABASE.md)

---

## 1. Overview & Conventions

The ApplyForge API is organized around REST conventions. All requests and responses use JSON formatting (`Content-Type: application/json`), except file uploads which use `multipart/form-data`.

- **Base URL (Local)**: `http://localhost:5000/api`
- **Base URL (Production)**: `https://applyforge-api.onrender.com/api`
- **Authentication**: JWT Bearer token passed in the `Authorization` header (`Bearer <access_token>`).

### Standard Response Structure

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Standard Error Response

```json
{
  "success": false,
  "message": "Descriptive error message",
  "errors": [ ... ]
}
```

---

## 2. Health & System Status

### `GET /health`
Returns the operational health and uptime of the API server.

- **Access**: Public
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "message": "ApplyForge API is running",
  "timestamp": "2026-11-20T22:00:00.000Z",
  "uptime": 1420.5
}
```

---

## 3. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/register`
Creates a new candidate account.

- **Access**: Public
- **Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123!"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "4a18e00...",
  "user": {
    "id": "673cf90123...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "2026-11-20T22:00:00.000Z"
  }
}
```

### `POST /api/auth/login`
Authenticates an existing candidate. Rate limited to 5 requests per 15 minutes.

- **Access**: Public
- **Request Body**:
```json
{
  "email": "jane@example.com",
  "password": "Password123!"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "4a18e00...",
  "user": {
    "id": "673cf90123...",
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}
```

### `GET /api/auth/me`
Retrieves the profile of the authenticated user.

- **Access**: Protected (`Bearer <token>`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "user": {
    "id": "673cf90123...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "2026-11-20T22:00:00.000Z"
  }
}
```

### `POST /api/auth/refresh`
Exchanges an active refresh token for a newly issued access token.

- **Access**: Public
- **Request Body**:
```json
{
  "refreshToken": "4a18e00..."
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOi..."
}
```

### `POST /api/auth/logout`
Revokes the session and clears the refresh token from storage.

- **Access**: Protected (`Bearer <token>`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

---

## 4. Resume Management Endpoints (`/api/resumes`)

### `POST /api/resumes`
Uploads and parses a candidate resume file (PDF or DOCX).

- **Access**: Protected (`Bearer <token>`)
- **Headers**: `Content-Type: multipart/form-data`
- **Form Fields**: `file` (Binary file, max 5MB)
- **Response `201 Created`**:
```json
{
  "success": true,
  "resume": {
    "id": "673cfa88...",
    "name": "Jane_Doe_Resume.pdf",
    "uploadedAt": "2026-11-20T22:00:00.000Z",
    "cloudinaryUrl": "https://res.cloudinary.com/...",
    "parsedSections": {
      "contact": {
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+1 555-0199",
        "location": "San Francisco, CA",
        "linkedin": "linkedin.com/in/janedoe",
        "github": "github.com/janedoe"
      },
      "summary": "Full Stack Engineer with 4 years experience...",
      "skills": ["React", "Node.js", "Express", "MongoDB", "TypeScript", "Docker"],
      "experience": [
        {
          "company": "Acme Tech",
          "title": "Software Engineer",
          "startDate": "2022-01",
          "endDate": "Present",
          "bullets": [
            "Architected real-time WebSocket messaging layer reducing latency by 35%."
          ]
        }
      ],
      "education": [
        {
          "institution": "University of California",
          "degree": "B.S. Computer Science",
          "year": "2021"
        }
      ],
      "certifications": []
    }
  }
}
```

### `GET /api/resumes`
Lists all resumes owned by the authenticated candidate.

- **Access**: Protected (`Bearer <token>`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "resumes": [
    {
      "id": "673cfa88...",
      "name": "Jane_Doe_Resume.pdf",
      "uploadedAt": "2026-11-20T22:00:00.000Z",
      "cloudinaryUrl": "https://res.cloudinary.com/..."
    }
  ]
}
```

### `GET /api/resumes/:id`
Retrieves a single resume by its ID with full parsed sections.

- **Access**: Protected (`Bearer <token>`)
- **Response `200 OK`**: Full resume object.

### `DELETE /api/resumes/:id`
Deletes a resume and removes associated binary assets from Cloudinary.

- **Access**: Protected (`Bearer <token>`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Resume deleted successfully"
}
```

---

## 5. Job Description Endpoints (`/api/jds`)

### `POST /api/jds`
Creates and parses a new job description from pasted text.

- **Access**: Protected (`Bearer <token>`)
- **Request Body**:
```json
{
  "company": "Stripe",
  "roleTitle": "Backend Infrastructure Engineer",
  "rawText": "We are seeking a Backend Engineer with 3+ years experience in Node.js, distributed databases, Docker, and Kafka..."
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "jd": {
    "id": "673cfb12...",
    "company": "Stripe",
    "roleTitle": "Backend Infrastructure Engineer",
    "parsedRequirements": {
      "requiredSkills": ["Node.js", "Docker", "Kafka", "Distributed Systems"],
      "niceToHave": ["Kubernetes", "Redis"],
      "experienceYears": "3+",
      "qualifications": ["B.S. in Computer Science or equivalent practical experience"]
    },
    "createdAt": "2026-11-20T22:00:00.000Z"
  }
}
```

### `POST /api/jds/from-url`
Scrapes a job posting directly from a live web URL.

- **Access**: Protected (`Bearer <token>`)
- **Request Body**:
```json
{
  "url": "https://boards.greenhouse.io/acme/jobs/12345"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "jd": {
    "id": "673cfb44...",
    "company": "Acme",
    "roleTitle": "Staff Software Engineer",
    "rawText": "Extracted job description text...",
    "sourceUrl": "https://boards.greenhouse.io/acme/jobs/12345",
    "parsedRequirements": { ... }
  }
}
```

### `GET /api/jds`
Lists all job descriptions for the authenticated candidate.

### `GET /api/jds/:id`
Retrieves a specific job description with extracted requirements.

### `DELETE /api/jds/:id`
Deletes a job description with ownership verification.

---

## 6. Multi-Agent Pipeline Endpoints (`/api/pipeline`)

### `POST /api/pipeline/run`
Initiates the multi-agent graph execution. Halts at `__human_interrupt__`.

- **Access**: Protected (`Bearer <token>`)
- **Request Body**:
```json
{
  "resumeId": "673cfa88...",
  "jdId": "673cfb12..."
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "runId": "run_a89bc21...",
  "status": "awaiting_review",
  "state": {
    "tailoredBullets": [
      {
        "originalBullet": "Built microservices for payment processing.",
        "tailoredBullet": "Architected resilient Node.js microservices processing $12M+ in monthly transactions with 99.99% uptime.",
        "reasoning": "Emphasized scale and uptime metrics matching Stripe's infrastructure requirements."
      }
    ],
    "atsReport": {
      "overallScore": 88,
      "matchedKeywords": [
        { "keyword": "Node.js", "section": "Experience", "importance": "required" },
        { "keyword": "Docker", "section": "Skills", "importance": "required" }
      ],
      "missingKeywords": [
        { "keyword": "Kafka", "importance": "required", "suggestion": "Add distributed streaming context to experience bullets." }
      ]
    },
    "coverLetter": {
      "subject": "Backend Infrastructure Engineer — Jane Doe",
      "body": "Dear Engineering Team at Stripe,\n\nI was drawn to Stripe's commitment to developer-first payments infrastructure..."
    },
    "fitScore": {
      "score": 86,
      "tier": "strong",
      "summary": "Candidate exhibits strong backend systems experience aligning closely with role demands.",
      "gaps": [],
      "strengths": ["Deep Node.js runtime experience", "Production containerization"]
    }
  }
}
```

### `GET /api/pipeline/:runId`
Retrieves the current execution state and status for a pipeline run.

### `POST /api/pipeline/:runId/approve`
Resumes graph execution past the human checkpoint and saves the application.

- **Access**: Protected (`Bearer <token>`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "status": "saved",
  "applicationId": "673cfd99..."
}
```

### `POST /api/pipeline/:runId/edit`
Submits revision notes and loops back through tailoring agents.

- **Access**: Protected (`Bearer <token>`)
- **Request Body**:
```json
{
  "userEdits": [
    {
      "field": "tailoredBullets",
      "feedback": "Make the second bullet point focus more on Kubernetes cluster autoscaling."
    }
  ]
}
```

---

## 7. Application Tracker CRM Endpoints (`/api/applications`)

### `GET /api/applications`
Lists tracked applications with pagination, sorting, and stage filters.

- **Query Parameters**:
  - `page`: default `1`
  - `limit`: default `20`
  - `status`: filter by `wishlist`, `applied`, `interviewing`, `offer`, `rejected`
  - `sortBy`: `createdAt`, `fitScore`, `company`
- **Response `200 OK`**: Paginated array of applications.

### `GET /api/applications/follow-ups/due`
Returns applications where `nextFollowUpAt <= now`, sorted most overdue first.

- **Access**: Protected (`Bearer <token>`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "dueCount": 2,
  "applications": [
    {
      "id": "673cfd99...",
      "company": "Stripe",
      "roleTitle": "Backend Engineer",
      "nextFollowUpAt": "2026-11-18T10:00:00.000Z",
      "daysOverdue": 2
    }
  ]
}
```

### `GET /api/applications/:id`
Retrieves full application dossier, status timeline, and generated assets.

### `PATCH /api/applications/:id`
Updates stage, notes, or follow-up schedule. Enforces status enum transition rules.

### `DELETE /api/applications/:id`
Deletes an application with user ownership verification.

### `POST /api/applications/:id/draft-followup`
Generates an AI-crafted recruiter follow-up email draft.

- **Access**: Protected (`Bearer <token>`)
- **Request Body (Optional)**:
```json
{
  "tone": "enthusiastic",
  "customNotes": "Mentioned the distributed caching talk from last week.",
  "recipient": "Sarah Connor"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "strategy": "standard_status_inquiry",
  "daysSinceApplied": 9,
  "draft": {
    "subject": "Following up on Backend Infrastructure Engineer application — Jane Doe",
    "body": "Hi Sarah,\n\nI hope your week is off to a great start..."
  }
}
```

### `POST /api/applications/:id/edits`
Logs candidate manual edits to train the adaptive voice learning engine.

- **Access**: Protected (`Bearer <token>`)
- **Request Body**:
```json
{
  "section": "tailoredResume",
  "original": "Built microservices for payment processing.",
  "edited": "Engineered scalable Node.js microservices processing high transaction volumes.",
  "feedback": "I prefer using 'Engineered' rather than 'Built'."
}
```

---

## 8. Analytics Endpoints (`/api/analytics`)

### `GET /api/analytics/summary`
Returns high-level KPI metrics (`totalApplied`, `totalActive`, `totalInterviews`, `totalOffers`, `responseRate`, `avgFitScore`).

### `GET /api/analytics/timeline`
Returns 12-week rolling application submission velocity buckets.

### `GET /api/analytics/score-vs-response`
Returns correlation data comparing interview callback rates across Low (0-40), Moderate (41-70), and High (71-100) ATS match score tiers.

---

*ApplyForge &copy; 2026. Document revision 1.2.0.*
