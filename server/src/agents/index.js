const { AgentState, createInitialAgentState, AGENT_STATE_KEYS } = require('./state');
const {
  parserNode,
  formatStructuredResume,
  formatStructuredJD,
} = require('./nodes/parserNode');
const {
  resumeTailoringNode,
  TAILORING_SYSTEM_PROMPT,
  buildTailoringPrompt,
  parseTailoredBullets,
  tailorBulletsHeuristic,
} = require('./nodes/resumeTailoringNode');

module.exports = {
  AgentState,
  createInitialAgentState,
  AGENT_STATE_KEYS,
  parserNode,
  formatStructuredResume,
  formatStructuredJD,
  resumeTailoringNode,
  TAILORING_SYSTEM_PROMPT,
  buildTailoringPrompt,
  parseTailoredBullets,
  tailorBulletsHeuristic,
};
