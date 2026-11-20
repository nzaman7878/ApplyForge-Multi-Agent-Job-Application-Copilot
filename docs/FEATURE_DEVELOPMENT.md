# ApplyForge Feature Development & Engineering Guide

[← Back to Documentation Hub](README.md) • [Architecture](ARCHITECTURE.md) • [API Reference](API.md) • [Testing](TESTING.md)

---

## 1. Monorepo Structure

ApplyForge is structured as an npm workspaces monorepo:

```
├── client/              # React 19 + Vite 6 Single Page Application
│   ├── src/
│   │   ├── components/  # Atomic UI, layout, review, and tracker components
│   │   ├── context/     # AuthContext and global application contexts
│   │   ├── hooks/       # useToast, useFocusTrap, useDebounce
│   │   ├── pages/       # Home, Dashboard, Apply, Tracker, ApplicationDetail, Docs
│   │   ├── router/      # Route definitions and route guards (PublicRoute, PrivateRoute)
│   │   ├── store/       # Redux Toolkit store and slices (applySlice.js)
│   │   └── test/        # Vitest component test suites
├── server/              # Express 5 Backend & LangGraph Agent Runtime
│   ├── src/
│   │   ├── agents/      # LangGraph DAG definition, state schema, and node handlers
│   │   ├── config/      # Database connection, env validation
│   │   ├── controllers/ # REST endpoint controllers
│   │   ├── middleware/  # Auth, rate limiting, upload, compression, cache
│   │   ├── models/      # Mongoose schemas (User, Resume, JobDescription, etc.)
│   │   ├── routes/      # Express route definitions
│   │   └── services/    # Parsers (PDF, DOCX, JD), scrapers, Cloudinary, voice learning
│   └── tests/           # Jest unit and Supertest integration suites
├── extension/           # Chrome Browser Extension (Manifest V3)
│   ├── background.js    # Service worker
│   ├── content.js       # On-page DOM scraper for LinkedIn and Naukri
│   ├── popup.html/js    # Extension popup interface and JWT sync
│   └── manifest.json    # Chrome MV3 manifest
└── docs/                # Comprehensive technical documentation repository
```

---

## 2. Coding Standards & Tooling

- **Linting & Formatting**: Enforced via root `.eslintrc.js` and `.prettierrc`. Run `npm run lint` and `npm run format`.
- **Git Commits**: Conventional Commits standard mandatory:
  - `feat(...)`: New capability (e.g. `feat(server): add follow-up email drafting agent`)
  - `fix(...)`: Bug fix (e.g. `fix(client): resolve modal focus trapping edge case`)
  - `test(...)`: Added or updated test suites
  - `docs(...)`: Documentation updates
  - `perf(...)`: Performance optimization

---

## 3. How to Add a New Agent Node to LangGraph

To extend the AI pipeline with a new agent node:

### Step 1: Create the Node File
Create `server/src/agents/nodes/yourNewNode.js`:

```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function yourNewNode(state) {
  try {
    // 1. Extract required state channels
    const { structuredResume, structuredJD } = state;

    // 2. Instantiate Gemini model
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: process.env.LLM_MODEL || 'gemini-2.5-flash' });

    // 3. Prompt execution with structured schema instructions
    const prompt = `...`;
    const result = await model.generateContent(prompt);
    const output = JSON.parse(result.response.text());

    // 4. Return updated channel slice
    return { yourNewChannel: output };
  } catch (err) {
    console.warn('[YourNewNode] LLM failed, using heuristic fallback:', err.message);
    return { yourNewChannel: yourHeuristicFallback(state) };
  }
}

module.exports = { yourNewNode };
```

### Step 2: Register in Agent State Schema
Update `server/src/agents/state.js` to declare the new channel type:

```javascript
yourNewChannel: {
  value: (x, y) => (y !== undefined ? y : x),
  default: () => null,
}
```

### Step 3: Wire into LangGraph Topology
In `server/src/agents/pipeline.js`:

```javascript
workflow.addNode('your_new_node', yourNewNode);
workflow.addEdge('cover_letter', 'your_new_node');
workflow.addEdge('your_new_node', 'fit_scoring');
```

---

## 4. How to Add a New REST Endpoint

### Step 1: Controller Method
In `server/src/controllers/application.controller.js`:

```javascript
exports.myNewFeature = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await Application.findOne({ _id: id, userId: req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    // Business logic...
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
```

### Step 2: Route Declaration
In `server/src/routes/application.routes.js`:

```javascript
router.post('/:id/my-feature', authenticate, applicationController.myNewFeature);
```

### Step 3: Write Integration Test
In `server/tests/integration/myFeature.test.js`:

```javascript
describe('POST /api/applications/:id/my-feature', () => {
  it('should enforce authentication', async () => {
    const res = await request(app).post('/api/applications/123/my-feature');
    expect(res.status).toBe(401);
  });
});
```

---

## 5. How to Create a New Client Component

1. Create component file in `client/src/components/<category>/MyComponent.jsx`.
2. Apply Tailwind utility classes adhering to design tokens (`slate-950` canvas, `slate-800` cards, `blue-500` accents).
3. Ensure keyboard accessibility and screen-reader friendliness.
4. Add Vitest unit/component test in `client/src/test/MyComponent.test.jsx`.

---

*ApplyForge &copy; 2026. Document revision 1.2.0.*
