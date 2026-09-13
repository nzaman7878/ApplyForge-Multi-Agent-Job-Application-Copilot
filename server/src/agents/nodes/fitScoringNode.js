const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { getLLM } = require('../../config/llm');
const { formatStructuredResume, formatStructuredJD } = require('./parserNode');
const { atsKeywordNode } = require('./atsKeywordNode');

/**
 * System prompt for qualitative gap and role compatibility scoring
 */
const FIT_SCORING_SYSTEM_PROMPT = `You are an elite talent acquisition leader and hiring assessment AI agent for ApplyForge.
Your role is to perform an in-depth qualitative gap and fit analysis by evaluating a candidate's resume and ATS report against a target job description.

MANDATORY RULES:
1. HOLISTIC ASSESSMENT: Combine quantitative keyword presence from the ATS report with qualitative evaluation of experience depth, seniority, and technical accomplishments.
2. ACCURATE SCORING: Calculate a final fit score from 0 to 100:
   - 80-100: 'strong' (Candidate meets almost all required criteria with demonstrable impact)
   - 60-79: 'moderate' (Candidate possesses core competencies but has manageable skill/experience gaps)
   - 0-59: 'stretch' (Candidate lacks multiple fundamental prerequisites)
3. IDENTIFY GENUINE GAPS: For each gap, specify:
   - "skill": The specific missing technology, tool, or qualification.
   - "severity": 'high' (for non-negotiable required skills), 'medium' (for preferred skills/experience), or 'low' (for bonus/nice-to-have items).
   - "suggestion": Concrete, actionable advice on how the candidate can address or bridge this gap.
4. HIGHLIGHT STANDOUT STRENGTHS: Provide an array of specific, compelling strength statements detailing the candidate's strongest competitive advantages.
5. STRUCTURED JSON OUTPUT: You must output ONLY a valid JSON object matching this schema:
{
  "score": 85,
  "tier": "strong",
  "gaps": [
    {
      "skill": "Kubernetes",
      "severity": "high",
      "suggestion": "Highlight container orchestration experience or complete CKA certification."
    }
  ],
  "strengths": [
    "5+ years of verified Node.js and distributed backend engineering",
    "Proven track record scaling microservices to 50k RPS"
  ]
}

Output ONLY valid JSON. No conversational preamble or postscript.`;

/**
 * Constructs prompt for the fit scoring agent.
 *
 * @param {Object} params
 * @returns {string}
 */
function buildFitScoringPrompt({
  candidateName,
  roleTitle,
  company,
  atsReport,
  structuredResume,
  structuredJD,
  tailoredBullets,
}) {
  const matchedList = (atsReport?.matchedKeywords || [])
    .map((m) => `${m.keyword} (${m.importance}, found in ${m.location})`)
    .join(', ') || 'None';

  const missingList = (atsReport?.missingKeywords || [])
    .map((m) => `${m.keyword} (${m.importance})`)
    .join(', ') || 'None';

  const bulletsFormatted = (tailoredBullets || [])
    .slice(0, 5)
    .map((b, i) => `[Accomplishment ${i + 1}]: "${b.tailoredBullet || b.originalBullet || b.text || b}"`)
    .join('\n');

  return `
TARGET OPPORTUNITY:
- Role Title: ${roleTitle}
- Company: ${company}
- Required Skills: ${(structuredJD?.requiredSkills || []).join(', ') || 'None listed'}
- Qualifications: ${(structuredJD?.qualifications || []).join('; ') || 'None listed'}
- Experience Requirements: ${(structuredJD?.experience || []).join('; ') || 'None listed'}

CANDIDATE PROFILE:
- Name: ${candidateName}
- Summary: ${structuredResume?.summary || 'Not provided'}
- Skills: ${(structuredResume?.skills || []).join(', ') || 'None listed'}
- Key Accomplishments:
${bulletsFormatted || 'None listed'}

ATS ANALYSIS REPORT:
- ATS Match Score: ${atsReport?.overallScore ?? 'N/A'}%
- Matched Keywords: ${matchedList}
- Missing Keywords: ${missingList}

Instructions:
1. Conduct a rigorous evaluation combining the ATS keyword metrics and candidate accomplishments.
2. Determine the overall score (0-100) and tier ('strong' | 'moderate' | 'stretch').
3. Itemize all gaps with severity ('high' | 'medium' | 'low') and actionable suggestions.
4. Highlight 2 to 5 concrete strengths.
5. Return ONLY a valid JSON object matching:
{
  "score": number,
  "tier": "strong" | "moderate" | "stretch",
  "gaps": [{ "skill": string, "severity": "high" | "medium" | "low", "suggestion": string }],
  "strengths": [string]
}
`.trim();
}

/**
 * Validates and normalizes fit score tier.
 *
 * @param {number} score
 * @returns {'strong' | 'moderate' | 'stretch'}
 */
function determineTier(score) {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'moderate';
  return 'stretch';
}

/**
 * Deterministic heuristic fit scoring engine for testing or offline environments.
 *
 * @param {Object} params
 * @returns {{ score: number, tier: 'strong' | 'moderate' | 'stretch', gaps: Array, strengths: Array }}
 */
function generateFitScoreHeuristic({
  atsReport,
  structuredResume,
  structuredJD,
  tailoredBullets = [],
}) {
  const atsScore = atsReport?.overallScore ?? 70;
  const missingKeywords = atsReport?.missingKeywords || [];
  const matchedKeywords = atsReport?.matchedKeywords || [];

  // Generate itemized gaps
  const gaps = missingKeywords.map((item) => {
    let severity = 'medium';
    if (item.importance === 'required') severity = 'high';
    else if (item.importance === 'bonus') severity = 'low';

    return {
      skill: item.keyword,
      severity,
      suggestion:
        item.suggestion ||
        `Acquire practical experience or showcase related work in "${item.keyword}".`,
    };
  });

  // Generate itemized strengths
  const strengths = [];

  const matchedSkillsNames = matchedKeywords.map((m) => m.keyword).slice(0, 4);
  if (matchedSkillsNames.length > 0) {
    strengths.push(
      `Direct proficiency in core required technologies: ${matchedSkillsNames.join(', ')}.`
    );
  }

  if (tailoredBullets.length > 0) {
    const highlight =
      tailoredBullets[0]?.tailoredBullet || tailoredBullets[0]?.originalBullet;
    if (highlight) {
      strengths.push(
        `Demonstrated high-impact technical accomplishment: "${highlight.slice(0, 100)}..."`
      );
    }
  }

  if (Array.isArray(structuredResume?.education) && structuredResume.education.length > 0) {
    const edu = structuredResume.education[0];
    if (edu.degree && edu.institution) {
      strengths.push(`Relevant educational background: ${edu.degree} from ${edu.institution}.`);
    }
  }

  if (strengths.length === 0) {
    strengths.push('Solid foundational technical background with transferable engineering skills.');
  }

  // Calculate qualitative penalty
  const highGapsCount = gaps.filter((g) => g.severity === 'high').length;
  let qualitativeScore = 85 - highGapsCount * 12;
  qualitativeScore = Math.max(25, Math.min(100, qualitativeScore));

  // Synthesize ATS (60%) + Qualitative (40%)
  const finalScore = Math.min(
    100,
    Math.max(0, Math.round(atsScore * 0.6 + qualitativeScore * 0.4))
  );

  const tier = determineTier(finalScore);

  return {
    score: finalScore,
    tier,
    gaps,
    strengths,
  };
}

/**
 * Parses and validates fit score payload from LLM output.
 *
 * @param {string|Object} rawOutput
 * @param {Object} fallbackParams
 * @returns {{ score: number, tier: 'strong' | 'moderate' | 'stretch', gaps: Array, strengths: Array }}
 */
function parseFitScore(rawOutput, fallbackParams = {}) {
  let parsed = null;

  if (typeof rawOutput === 'object' && rawOutput !== null) {
    parsed = rawOutput;
  } else if (typeof rawOutput === 'string') {
    let clean = rawOutput.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    try {
      parsed = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }
  }

  if (
    parsed &&
    typeof parsed.score === 'number' &&
    !isNaN(parsed.score)
  ) {
    const rawScore = Math.min(100, Math.max(0, Math.round(parsed.score)));
    const tier =
      ['strong', 'moderate', 'stretch'].includes(parsed.tier)
        ? parsed.tier
        : determineTier(rawScore);

    const gaps = Array.isArray(parsed.gaps)
      ? parsed.gaps.map((g) => ({
          skill: g.skill || 'Unspecified skill',
          severity: ['high', 'medium', 'low'].includes(g.severity) ? g.severity : 'medium',
          suggestion: g.suggestion || 'Bridge this skill with practical projects or training.',
        }))
      : [];

    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.map((s) => String(s).trim()).filter(Boolean)
      : ['Strong technical alignment with core role expectations.'];

    return {
      score: rawScore,
      tier,
      gaps,
      strengths,
    };
  }

  // Fallback to deterministic heuristic
  return generateFitScoreHeuristic(fallbackParams);
}

/**
 * Fit Scoring Agent Node for LangGraph pipeline.
 *
 * Combines ATS report + qualitative gap analysis.
 * Output: { score: 0-100, tier: 'strong'|'moderate'|'stretch', gaps: [{ skill, severity, suggestion }], strengths: [String] }
 *
 * @param {Object} state - Current LangGraph AgentState
 * @param {Object} [options={}] - Optional overrides (e.g. llm client for tests)
 * @returns {Promise<Object>} State update containing fitScore object
 */
async function fitScoringNode(state, options = {}) {
  const structuredResume =
    state.structuredResume || formatStructuredResume(state.resumeSections || {});
  const structuredJD =
    state.structuredJD || formatStructuredJD(state.jdRequirements || {});
  const tailoredBullets = state.tailoredBullets || structuredResume.allBulletPoints || [];

  // Ensure ATS report is available
  let atsReport = state.atsReport;
  if (!atsReport) {
    const atsResult = await atsKeywordNode(state);
    atsReport = atsResult.atsReport;
  }

  const candidateName = structuredResume.contact?.name || 'Applicant';
  const roleTitle = structuredJD.roleTitle || 'Target Role';
  const company = structuredJD.company || 'Target Company';

  const fallbackParams = {
    candidateName,
    roleTitle,
    company,
    atsReport,
    structuredResume,
    structuredJD,
    tailoredBullets,
  };

  // Obtain LLM instance
  let llmClient = options.llm || state.llm || null;

  if (!llmClient) {
    try {
      llmClient = getLLM();
    } catch {
      if (options.allowFallback !== false) {
        const heuristicOutput = generateFitScoreHeuristic(fallbackParams);
        return {
          fitScore: heuristicOutput,
          status: 'fit_scored',
        };
      }
      throw new Error('GEMINI_API_KEY is not configured for fitScoringNode');
    }
  }

  const humanPrompt = buildFitScoringPrompt(fallbackParams);

  const messages = [
    new SystemMessage(FIT_SCORING_SYSTEM_PROMPT),
    new HumanMessage(humanPrompt),
  ];

  try {
    const response = await llmClient.invoke(messages);
    const content = typeof response === 'string' ? response : response?.content || '';
    const fitScore = parseFitScore(content, fallbackParams);

    return {
      fitScore,
      status: 'fit_scored',
    };
  } catch (err) {
    if (options.allowFallback !== false) {
      console.warn(
        `[FitScoringNode] LLM invocation encountered an error (${err.message}). Using heuristic fallback.`
      );
      const fallbackOutput = generateFitScoreHeuristic(fallbackParams);
      return {
        fitScore: fallbackOutput,
        status: 'fit_scored',
      };
    }
    throw err;
  }
}

module.exports = {
  fitScoringNode,
  FIT_SCORING_SYSTEM_PROMPT,
  buildFitScoringPrompt,
  determineTier,
  generateFitScoreHeuristic,
  parseFitScore,
};
