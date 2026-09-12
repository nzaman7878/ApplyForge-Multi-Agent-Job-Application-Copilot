const { Annotation } = require('@langchain/langgraph');

/**
 * AgentState definition for ApplyForge LangGraph pipeline.
 *
 * State Channels:
 * - resumeSections: Structured resume sections (Contact, Experience, Skills, Education, etc.)
 * - jdRequirements: Parsed JD requirements (skills, experience, qualifications, niceToHave)
 * - tailoredBullets: Array of tailored resume bullet points with reasoning
 * - atsReport: Keyword match analysis, missing keywords, and match score
 * - coverLetter: Structured cover letter (subject, body, keyThemes)
 * - fitScore: Overall role compatibility metrics (0-100 score, tier, strengths, gaps)
 * - humanApproved: Boolean flag representing user approval or rejection
 * - userEdits: Feedback or direct bullet/letter modifications provided by user
 *
 * Additional pipeline channels:
 * - structuredResume: Normalized resume representation from parser agent
 * - structuredJD: Normalized job description representation from parser agent
 * - status: Pipeline lifecycle state ('idle', 'parsing', 'tailoring', 'scoring', 'awaiting_review', 'completed', 'failed')
 * - error: Error payload if execution encounters an exception
 */
const AgentState = Annotation.Root({
  // Input channels
  resumeSections: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),
  jdRequirements: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),

  // Optional intermediate structured formats
  structuredResume: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),
  structuredJD: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),

  // Agent output channels
  tailoredBullets: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => [],
  }),
  atsReport: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),
  coverLetter: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),
  fitScore: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),

  // Human-in-the-loop checkpoint channels
  humanApproved: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => false,
  }),
  userEdits: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),

  // Pipeline telemetry & error channels
  status: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => 'idle',
  }),
  error: Annotation({
    reducer: (curr, update) => (update !== undefined ? update : curr),
    default: () => null,
  }),
});

/**
 * Creates an initial state object populated with defaults and provided values.
 *
 * @param {Object} [params={}] - Initial state parameters
 * @returns {Object} Clean initial agent state object
 */
function createInitialAgentState(params = {}) {
  return {
    resumeSections: params.resumeSections || null,
    jdRequirements: params.jdRequirements || null,
    structuredResume: params.structuredResume || null,
    structuredJD: params.structuredJD || null,
    tailoredBullets: Array.isArray(params.tailoredBullets) ? params.tailoredBullets : [],
    atsReport: params.atsReport || null,
    coverLetter: params.coverLetter || null,
    fitScore: params.fitScore || null,
    humanApproved: Boolean(params.humanApproved),
    userEdits: params.userEdits || null,
    status: params.status || 'idle',
    error: params.error || null,
  };
}

/**
 * Standard required channel keys
 */
const AGENT_STATE_KEYS = [
  'resumeSections',
  'jdRequirements',
  'tailoredBullets',
  'atsReport',
  'coverLetter',
  'fitScore',
  'humanApproved',
  'userEdits',
];

module.exports = {
  AgentState,
  createInitialAgentState,
  AGENT_STATE_KEYS,
};
