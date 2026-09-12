const {
  parserNode,
  formatStructuredResume,
  formatStructuredJD,
} = require('./parserNode');

const {
  resumeTailoringNode,
  TAILORING_SYSTEM_PROMPT,
  buildTailoringPrompt,
  parseTailoredBullets,
  tailorBulletsHeuristic,
} = require('./resumeTailoringNode');

const {
  atsKeywordNode,
  extractWeightedKeywords,
  locateKeywordInResume,
  generateSuggestion,
  calculateOverallScore,
  DEFAULT_KEYWORD_WEIGHTS,
} = require('./atsKeywordNode');

module.exports = {
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
};
