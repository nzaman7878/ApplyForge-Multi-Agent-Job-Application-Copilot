const { formatStructuredResume, formatStructuredJD } = require('./parserNode');

/**
 * Default importance weights used for ATS overall score calculation
 */
const DEFAULT_KEYWORD_WEIGHTS = {
  required: 3,
  preferred: 2,
  bonus: 1,
};

/**
 * Escapes regex special characters in a keyword string.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Performs word-boundary safe keyword matching against text.
 * Handles symbols in languages like C++, C#, .NET safely.
 *
 * @param {string} keyword
 * @param {string} text
 * @returns {boolean}
 */
function matchKeywordInText(keyword, text) {
  if (!keyword || !text || typeof text !== 'string') return false;

  const escaped = escapeRegex(keyword.trim());
  const prefix = /^\w/.test(keyword.trim()) ? '\\b' : '';
  const suffix = /\w$/.test(keyword.trim()) ? '\\b' : '';

  try {
    const regex = new RegExp(prefix + escaped + suffix, 'i');
    return regex.test(text);
  } catch {
    return text.toLowerCase().includes(keyword.trim().toLowerCase());
  }
}

/**
 * Extracts target keywords from a job description, categorizing each with an importance level:
 * - 'required': Core non-negotiable skills and qualifications
 * - 'preferred': Preferred qualifications and nice-to-haves
 * - 'bonus': Explicitly tagged bonus or plus competencies
 *
 * @param {Object} structuredJD - Structured job description
 * @param {string} [rawText=''] - Raw JD text for bonus pattern discovery
 * @returns {Array<{ keyword: string, importance: 'required' | 'preferred' | 'bonus', weight: number }>}
 */
function extractWeightedKeywords(structuredJD, rawText = '') {
  const keywords = [];
  const seen = new Set();

  const addKeyword = (rawKeyword, defaultImportance) => {
    if (!rawKeyword || typeof rawKeyword !== 'string') return;
    const clean = rawKeyword.trim();
    if (clean.length === 0) return;

    // Detect if keyword string indicates bonus / plus
    let importance = defaultImportance;
    if (/\b(?:bonus|plus|optional|nice\s+to\s+have)\b/i.test(clean)) {
      importance = 'bonus';
    }

    // Clean cosmetic trailing phrases like "is a plus", "is preferred", "is bonus"
    const normalizedName = clean
      .replace(/\s+(?:is\s+(?:a\s+)?(?:bonus|plus)|is\s+preferred|preferred|optional|required)$/i, '')
      .trim();

    const lower = normalizedName.toLowerCase();
    if (!seen.has(lower) && normalizedName.length > 0) {
      seen.add(lower);
      keywords.push({
        keyword: normalizedName,
        importance,
        weight: DEFAULT_KEYWORD_WEIGHTS[importance] || 2,
      });
    }
  };

  // 1. Required skills (Highest priority: required)
  const reqSkills = structuredJD?.requiredSkills || [];
  for (const skill of reqSkills) {
    addKeyword(skill, 'required');
  }

  // 2. Preferred / Nice-to-have skills (preferred or bonus)
  const niceSkills = structuredJD?.niceToHave || [];
  for (const skill of niceSkills) {
    addKeyword(skill, 'preferred');
  }

  // 3. Scan qualifications & rawText for auxiliary bonus indicators
  const fullJdText = rawText || structuredJD?.rawText || '';
  if (fullJdText) {
    const bonusMatches = fullJdText.match(
      /(?:bonus|plus|preferred|nice\s+to\s+have)[:\s-]+([A-Za-z0-9#+.\s,/]+)(?:\.|\n|$)/gi
    );
    if (bonusMatches) {
      for (const m of bonusMatches) {
        const parts = m
          .replace(/^(?:bonus|plus|preferred|nice\s+to\s+have)[:\s-]+/i, '')
          .split(/[,/]/);
        for (const p of parts) {
          if (p.trim().length > 1 && p.trim().length < 30) {
            addKeyword(p, 'bonus');
          }
        }
      }
    }
  }

  return keywords;
}

/**
 * Searches across all sections of a structured resume and tailored bullets
 * to determine the specific sections where a keyword appears.
 *
 * @param {string} keyword
 * @param {Object} structuredResume
 * @param {Array} [tailoredBullets=[]]
 * @returns {string|null} Comma-separated list of matched sections or null if absent
 */
function locateKeywordInResume(keyword, structuredResume, tailoredBullets = []) {
  const matchedSections = [];

  // 1. Skills section
  if (Array.isArray(structuredResume?.skills)) {
    const inSkills = structuredResume.skills.some((s) => matchKeywordInText(keyword, s));
    if (inSkills) matchedSections.push('Skills');
  }

  // 2. Work Experience (titles, company names, and bullet points)
  if (Array.isArray(structuredResume?.experience)) {
    let inExp = false;
    for (const exp of structuredResume.experience) {
      const expBlock = `${exp.title || ''} ${exp.company || ''} ${(exp.bulletPoints || []).join(' ')}`;
      if (matchKeywordInText(keyword, expBlock)) {
        inExp = true;
        break;
      }
    }
    if (inExp) matchedSections.push('Experience');
  }

  // 3. Professional Summary
  if (structuredResume?.summary && matchKeywordInText(keyword, structuredResume.summary)) {
    matchedSections.push('Summary');
  }

  // 4. Education
  if (Array.isArray(structuredResume?.education)) {
    const inEdu = structuredResume.education.some((e) =>
      matchKeywordInText(keyword, `${e.degree || ''} ${e.fieldOfStudy || ''} ${e.institution || ''}`)
    );
    if (inEdu) matchedSections.push('Education');
  }

  // 5. Certifications
  if (Array.isArray(structuredResume?.certifications)) {
    const inCert = structuredResume.certifications.some((c) =>
      matchKeywordInText(keyword, `${c.name || ''} ${c.issuer || ''}`)
    );
    if (inCert) matchedSections.push('Certifications');
  }

  // 6. Tailored Bullets (if generated)
  if (Array.isArray(tailoredBullets) && tailoredBullets.length > 0) {
    const inTailored = tailoredBullets.some((b) =>
      matchKeywordInText(keyword, b.tailoredBullet || b.tailored || '')
    );
    if (inTailored && !matchedSections.includes('Experience')) {
      matchedSections.push('Tailored Bullets');
    }
  }

  return matchedSections.length > 0 ? matchedSections.join(', ') : null;
}

/**
 * Computes actionable suggestion message for missing keywords based on importance.
 *
 * @param {string} keyword
 * @param {'required' | 'preferred' | 'bonus'} importance
 * @returns {string}
 */
function generateSuggestion(keyword, importance) {
  switch (importance) {
    case 'required':
      return `High priority: Incorporate "${keyword}" into your core technical skills and relevant experience bullets to clear ATS filters.`;
    case 'preferred':
      return `Recommended: Highlight any practical experience, projects, or coursework involving "${keyword}" in your job bullets.`;
    case 'bonus':
    default:
      return `Optional: Mention familiarity or self-directed learning with "${keyword}" in your summary or skills section.`;
  }
}

/**
 * Calculates weighted ATS match score from matched and missing keywords.
 *
 * @param {Array} matchedKeywords
 * @param {Array} missingKeywords
 * @param {Object} [weights=DEFAULT_KEYWORD_WEIGHTS]
 * @returns {number} Integer between 0 and 100
 */
function calculateOverallScore(matchedKeywords, missingKeywords, weights = DEFAULT_KEYWORD_WEIGHTS) {
  let matchedScore = 0;
  let totalScore = 0;

  for (const m of matchedKeywords) {
    const w = weights[m.importance] || weights.preferred || 2;
    matchedScore += w;
    totalScore += w;
  }

  for (const m of missingKeywords) {
    const w = weights[m.importance] || weights.preferred || 2;
    totalScore += w;
  }

  if (totalScore === 0) return 100;
  return Math.round((matchedScore / totalScore) * 100);
}

/**
 * ATS Keyword Agent Node for LangGraph pipeline.
 *
 * Extracts JD keywords with importance weights (required/preferred/bonus),
 * evaluates each against the candidate's resume sections and tailored bullets,
 * and generates a weighted ATS compliance report.
 *
 * Output:
 * {
 *   matchedKeywords: [{ keyword, importance, location }],
 *   missingKeywords: [{ keyword, importance, suggestion }],
 *   overallScore: Number
 * }
 *
 * @param {Object} state - LangGraph AgentState
 * @param {Object} [options={}] - Optional configuration overrides
 * @returns {Promise<Object>} State update containing atsReport
 */
async function atsKeywordNode(state, options = {}) {
  const structuredResume =
    state.structuredResume || formatStructuredResume(state.resumeSections || {});
  const structuredJD =
    state.structuredJD || formatStructuredJD(state.jdRequirements || {});
  const tailoredBullets = state.tailoredBullets || [];

  const rawJdText = state.jdRequirements?.rawText || structuredJD.rawText || '';

  // Extract weighted keywords from JD
  const weightedKeywords =
    options.keywords || extractWeightedKeywords(structuredJD, rawJdText);

  const matchedKeywords = [];
  const missingKeywords = [];

  for (const item of weightedKeywords) {
    const location = locateKeywordInResume(
      item.keyword,
      structuredResume,
      tailoredBullets
    );

    if (location) {
      matchedKeywords.push({
        keyword: item.keyword,
        importance: item.importance,
        location,
      });
    } else {
      missingKeywords.push({
        keyword: item.keyword,
        importance: item.importance,
        suggestion: generateSuggestion(item.keyword, item.importance),
      });
    }
  }

  const overallScore = calculateOverallScore(
    matchedKeywords,
    missingKeywords,
    options.weights || DEFAULT_KEYWORD_WEIGHTS
  );

  const atsReport = {
    matchedKeywords,
    missingKeywords,
    overallScore,
  };

  return {
    atsReport,
    status: 'ats_analyzed',
  };
}

module.exports = {
  atsKeywordNode,
  extractWeightedKeywords,
  locateKeywordInResume,
  generateSuggestion,
  calculateOverallScore,
  DEFAULT_KEYWORD_WEIGHTS,
};
