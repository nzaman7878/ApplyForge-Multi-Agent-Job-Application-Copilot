# ApplyForge Developer & Production Setup Guide

[← Back to Documentation Hub](README.md) • [Architecture](ARCHITECTURE.md) • [Testing](TESTING.md) • [API Reference](API.md)

---

## 1. Prerequisites

Before installing ApplyForge, ensure you have the following installed on your machine:

- **Node.js**: v18.0.0 or higher (v20.x recommended)
- **npm**: v9.0.0 or higher
- **Docker & Docker Compose**: Required for local MongoDB container
- **Google Gemini API Key**: Free tier or paid key from [Google AI Studio](https://aistudio.google.com/)
- **Cloudinary Account (Optional for Local)**: For binary resume storage (can be mocked for tests)

---

## 2. Step-by-Step Installation

### Step 1: Clone Repository & Install Dependencies
Clone the repository and install all npm dependencies for the root, client, and server workspaces:

```bash
git clone https://github.com/nzaman7878/ApplyForge-Multi-Agent-Job-Application-Copilot.git
cd "ApplyForge  Multi Agent Job Application Copilot"

# Install monorepo root and workspace packages
npm install
npm install -w client
npm install -w server
```

---

### Step 2: Configure Environment Variables

Copy the provided example environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

#### Backend Environment Variables (`server/.env`)

| Variable | Required | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | Express server port | `5000` |
| `NODE_ENV` | Optional | Environment mode (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | **Required** | MongoDB connection string | `mongodb://localhost:27017/applyforge` |
| `JWT_SECRET` | **Required** | Secret key for signing access tokens | `super-secret-jwt-key-min-32-chars` |
| `JWT_REFRESH_SECRET` | **Required** | Secret key for refresh tokens | `super-secret-refresh-key-min-32-chars` |
| `JWT_EXPIRES_IN` | Optional | Access token expiration duration | `7d` |
| `GEMINI_API_KEY` | **Required** | Google Gemini API Key | `AIzaSy...` |
| `LLM_MODEL` | Optional | Gemini model name | `gemini-2.5-flash` |
| `LLM_TEMPERATURE` | Optional | Model temperature (0.0 to 1.0) | `0.7` |
| `CLOUDINARY_CLOUD_NAME`| Optional | Cloudinary cloud account name | `demo-cloud` |
| `CLOUDINARY_API_KEY` | Optional | Cloudinary API access key | `1234567890` |
| `CLOUDINARY_API_SECRET` | Optional | Cloudinary API secret key | `secret` |
| `CORS_ORIGIN` | Optional | Whitelisted frontend origins | `http://localhost:5173,http://localhost:3000` |

#### Frontend Environment Variables (`client/.env`)

| Variable | Required | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | **Required** | Base HTTP endpoint of Express API | `http://localhost:5000` |

---

### Step 3: Spin Up Local MongoDB via Docker

Use the included Docker Compose configuration to start an isolated MongoDB 7.0 container:

```bash
# Start MongoDB in background
npm run docker:up

# To verify MongoDB is running:
docker ps
```

---

### Step 4: Seed Demo Data

To populate your local database with sample resumes, job descriptions, and 24 realistic applications distributed across 12 velocity weeks:

```bash
npm run seed:dashboard -w server
```

**Seed Credentials Provisioned**:
- **Email**: `demo@applyforge.dev`
- **Password**: `Password123!`

---

### Step 5: Start Concurrent Development Servers

Run both the React frontend and Express backend simultaneously using `concurrently`:

```bash
npm run dev
```

- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **API Health Check**: `http://localhost:5000/api/health`

---

## 3. Chrome Browser Extension Setup

To install and run the ApplyForge Chrome Extension (Manifest V3):

1. Open Google Chrome (or any Chromium browser: Edge, Brave).
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** via the toggle switch in the upper-right corner.
4. Click **"Load unpacked"** in the top left.
5. In the file picker, select the `extension` directory inside this repository:
   ```
   ApplyForge  Multi Agent Job Application Copilot/extension
   ```
6. The extension **ApplyForge Job Application Copilot** will appear in your extensions list.
7. Open `http://localhost:5173` and log in, then open the extension popup and click **"⚡ Sync from Tab"** to link your session!

---

## 4. Useful Development Commands

```bash
# Run server test suites
npm test -w server

# Run client component tests
npm test -w client

# Run code linter
npm run lint

# Format code with Prettier
npm run format

# Stop MongoDB Docker container
npm run docker:down
```

---

*ApplyForge &copy; 2026. Document revision 1.2.0.*
