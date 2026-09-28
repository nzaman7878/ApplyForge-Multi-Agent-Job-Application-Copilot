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

const {
  coverLetterNode,
  COVER_LETTER_SYSTEM_PROMPT,
  buildCoverLetterPrompt,
  parseCoverLetter,
  generateCoverLetterHeuristic,
} = require('./coverLetterNode');

const {
  fitScoringNode,
  FIT_SCORING_SYSTEM_PROMPT,
  buildFitScoringPrompt,
  determineTier,
  generateFitScoreHeuristic,
  parseFitScore,
} = require('./fitScoringNode');

const {
  followUpNode,
  FOLLOW_UP_SYSTEM_PROMPT,
  buildFollowUpPrompt,
  generateFollowUpHeuristic,
  parseFollowUpDraft,
  generateFollowUpEmail,
} = require('./followUpNode');

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
  followUpNode,
  FOLLOW_UP_SYSTEM_PROMPT,
  buildFollowUpPrompt,
  generateFollowUpHeuristic,
  parseFollowUpDraft,
  generateFollowUpEmail,
};
