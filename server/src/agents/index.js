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
const {
  atsKeywordNode,
  extractWeightedKeywords,
  locateKeywordInResume,
  generateSuggestion,
  calculateOverallScore,
  DEFAULT_KEYWORD_WEIGHTS,
} = require('./nodes/atsKeywordNode');
const {
  coverLetterNode,
  COVER_LETTER_SYSTEM_PROMPT,
  buildCoverLetterPrompt,
  parseCoverLetter,
  generateCoverLetterHeuristic,
} = require('./nodes/coverLetterNode');
const {
  fitScoringNode,
  FIT_SCORING_SYSTEM_PROMPT,
  buildFitScoringPrompt,
  determineTier,
  generateFitScoreHeuristic,
  parseFitScore,
} = require('./nodes/fitScoringNode');

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
  atsKeywordNode,
  extractWeightedKeywords,
  locateKeywordInResume,
  generateSuggestion,
  calculateOverallScore,
  DEFAULT_KEYWORD_WEIGHTS,
  coverLetterNode,
  COVER_LETTER_SYSTEM_PROMPT,
  buildCoverLetterPrompt,
  parseCoverLetter,
  generateCoverLetterHeuristic,
  fitScoringNode,
  FIT_SCORING_SYSTEM_PROMPT,
  buildFitScoringPrompt,
  determineTier,
  generateFitScoreHeuristic,
  parseFitScore,
};

