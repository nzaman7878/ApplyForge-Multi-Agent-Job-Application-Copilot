const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { getLLM } = require('../../config/llm');
const { formatStructuredResume, formatStructuredJD } = require('./parserNode');
const {
  getRecentStyleExamples,
  formatStyleExamplesForPrompt,
} = require('../../services/voiceLearning');

/**
 * System prompt enforcing:
 * 1. Rewrite bullets to emphasize JD keywords
 * 2. No fabrication (strictly preserve factual truth and metrics)
 * 3. Preserve authentic candidate voice and domain style
 * 4. Structured JSON output format: { bullets: [{ originalBullet, tailoredBullet, reasoning }] }
 */
const TAILORING_SYSTEM_PROMPT = `You are an elite resume strategist and career tailoring AI agent for ApplyForge.
Your task is to tailor candidate resume bullet points to align with a target job description.

MANDATORY RULES:
1. EMPHASIZE JD KEYWORDS: Seamlessly incorporate target technologies, methodologies, and competencies from the job description where they naturally match the candidate's actual work.
2. NO FABRICATION: Never invent numbers, accomplishments, tools, employer names, or false claims. Stay strictly grounded in the truth of the original bullet.
3. PRESERVE CANDIDATE VOICE: Maintain the candidate's authentic tone, seniority level, and domain style while elevating clarity, precision, and impact.
4. ACTION-ORIENTED FORMULA: Follow the Google XYZ formula where possible ("Accomplished [X] as measured by [Y] by doing [Z]") starting with strong active past-tense verbs.
5. STRUCTURED JSON OUTPUT: Return a valid JSON object containing an array named "bullets". Every item must strictly conform to:
   - "originalBullet": Exact string of the original bullet point.
   - "tailoredBullet": The revised, keyword-optimized bullet point.
   - "reasoning": A concise sentence explaining which keywords or impact metrics were highlighted and why.

Output ONLY valid JSON. No conversational filler or preamble.`;

/**
 * Builds the complete tailoring system prompt, incorporating past approved user edits
 * as concrete style examples when available.
 *
 * @param {Array<object>} [styleExamples=[]] - Recent approved edits from candidate history
 * @returns {string} Fully articulated system prompt
 */
function buildTailoringSystemPrompt(styleExamples = []) {
  const examplesSection = formatStyleExamplesForPrompt(styleExamples);
  if (!examplesSection) {
    return TAILORING_SYSTEM_PROMPT;
  }
  return `${TAILORING_SYSTEM_PROMPT}\n\n${examplesSection}`;
}

/**
 * Constructs the human prompt providing target JD criteria, candidate bullets, and optional user instructions.
 *
 * @param {Object} params
 * @param {Array} params.resumeBullets - Candidate bullet points
 * @param {Object} params.jobDescription - Target job requirements
 * @param {Object} [params.userEdits] - Optional user instructions/notes
 * @returns {string} Formatted prompt string
 */
function buildTailoringPrompt({ resumeBullets, jobDescription, userEdits }) {
  const reqSkills = (jobDescription.requiredSkills || []).join(', ') || 'None listed';
  const niceSkills = (jobDescription.niceToHave || []).join(', ') || 'None listed';
  const expContext = (jobDescription.experience || []).concat(jobDescription.qualifications || []).join('; ') || 'None listed';

  const jdSummary = [
    `TARGET COMPANY: ${jobDescription.company || 'Target Company'}`,
    `TARGET ROLE: ${jobDescription.roleTitle || 'Target Role'}`,
    `REQUIRED SKILLS: ${reqSkills}`,
    `NICE-TO-HAVE SKILLS: ${niceSkills}`,
    `EXPERIENCE & QUALIFICATIONS: ${expContext}`,
  ].join('\n');

  const bulletsFormatted = resumeBullets
    .map((b, i) => {
      const roleStr = b.role ? ` (Role: ${b.role})` : '';
      const compStr = b.company ? ` (Company: ${b.company})` : '';
      const text = b.original || b.text || b;
      return `[Bullet ${i + 1}]${roleStr}${compStr}\n"${text}"`;
    })
    .join('\n\n');

  let userNotes = '';
  if (userEdits && (userEdits.notes || userEdits.tailoringInstructions)) {
    userNotes = `\nUSER SPECIAL INSTRUCTIONS:\n${userEdits.notes || userEdits.tailoringInstructions}\n`;
  }

  return `
${jdSummary}
${userNotes}
ORIGINAL CANDIDATE BULLET POINTS TO TAILOR:
${bulletsFormatted}

Instructions:
1. Tailor each bullet point above to emphasize the required skills and target role context.
2. Strictly adhere to NO FABRICATION and PRESERVE VOICE.
3. Return the results as a valid JSON object:
{
  "bullets": [
    {
      "originalBullet": "<original text>",
      "tailoredBullet": "<tailored text>",
      "reasoning": "<why and what keywords were emphasized>"
    }
  ]
}
`.trim();
}

/**
 * Extracts and normalizes structured bullet output from LLM responses or JSON strings.
 *
 * @param {string|Object} rawOutput - Output from LLM or structured parser
 * @param {Array} originalBullets - Original bullet points for fallback mapping
 * @returns {Array<Object>} Array of { originalBullet, tailoredBullet, reasoning }
 */
function parseTailoredBullets(rawOutput, originalBullets = []) {
  let parsed = null;

  if (typeof rawOutput === 'object' && rawOutput !== null) {
    parsed = rawOutput;
  } else if (typeof rawOutput === 'string') {
    let clean = rawOutput.trim();
    // Strip markdown codeblock if present
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Attempt to extract JSON substring between { and }
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

  const bulletsArray = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.bullets)
    ? parsed.bullets
    : [];

  if (bulletsArray.length > 0) {
    return bulletsArray.map((item, idx) => {
      const orig =
        item.originalBullet ||
        originalBullets[idx]?.original ||
        originalBullets[idx]?.text ||
        (typeof originalBullets[idx] === 'string' ? originalBullets[idx] : `Bullet ${idx + 1}`);

      const tailored =
        item.tailoredBullet ||
        item.tailored ||
        orig;

      const reasoning =
        item.reasoning ||
        item.explanation ||
        'Tailored to align with target role keywords and impact criteria.';

      return {
        originalBullet: orig,
        tailoredBullet: tailored,
        reasoning,
      };
    });
  }

  // Fallback if parsing failed completely
  return originalBullets.map((b) => {
    const text = b.original || b.text || (typeof b === 'string' ? b : '');
    return {
      originalBullet: text,
      tailoredBullet: text,
      reasoning: 'Retained original bullet as baseline.',
    };
  });
}

/**
 * Deterministic keyword-alignment heuristic for offline execution or tests when API key is not configured.
 *
 * @param {Array} resumeBullets
 * @param {Object} structuredJD
 * @param {Array} [styleExamples=[]] - Optional style examples from candidate edit history
 * @returns {Array<Object>}
 */
function tailorBulletsHeuristic(resumeBullets, structuredJD, styleExamples = []) {
  const targetSkills = structuredJD?.requiredSkills || [];

  // Identify preferred action verbs from user's approved edit history
  let candidateVerb = null;
  if (Array.isArray(styleExamples) && styleExamples.length > 0) {
    for (const ex of styleExamples) {
      if (ex.diff && ex.diff.editedVerb) {
        candidateVerb = ex.diff.editedVerb;
        break;
      }
      if (ex.edited) {
        const firstWord = ex.edited.trim().split(/\s+/)[0].replace(/[^a-zA-Z]/g, '');
        if (firstWord && firstWord.length > 2) {
          candidateVerb = firstWord;
          break;
        }
      }
    }
  }

  return resumeBullets.map((bullet, idx) => {
    const orig = bullet.original || bullet.text || (typeof bullet === 'string' ? bullet : '');
    if (!orig) {
      return { originalBullet: '', tailoredBullet: '', reasoning: 'Empty bullet point.' };
    }

    // Find relevant keywords not yet in bullet
    const origLower = orig.toLowerCase();
    const relevantSkills = targetSkills.filter((skill) => {
      const sLower = skill.toLowerCase();
      return !origLower.includes(sLower);
    });

    let tailored = orig;
    let reasoning = 'Refined phrasing for impact while strictly preserving factual accomplishments.';

    if (candidateVerb && idx === 0) {
      const words = orig.split(' ');
      if (words.length > 1 && words[0].toLowerCase() !== candidateVerb.toLowerCase()) {
        tailored = `${candidateVerb} ${words.slice(1).join(' ')}`;
        reasoning = `Aligned with candidate's personal action verb preference "${candidateVerb}" while preserving factual accomplishments.`;
      }
    }

    if (relevantSkills.length > 0 && idx === 0) {
      const skillToHighlight = relevantSkills[0];
      tailored = `${tailored.replace(/\.$/, '')}, applying ${skillToHighlight} best practices.`;
      reasoning = `Emphasized target skill "${skillToHighlight}" to enhance ATS match while preserving candidate voice.`;
    }

    return {
      originalBullet: orig,
      tailoredBullet: tailored,
      reasoning,
    };
  });
}

/**
 * Resume Tailoring Agent node for LangGraph pipeline.
 *
 * Reads structuredResume and structuredJD from state.
 * Fetches last 10 approved edits as style examples if not already present.
 * Employs Gemini LLM with the tailored system prompt to rewrite bullets.
 * Outputs: { tailoredBullets, status: 'tailored', styleExamples }
 *
 * @param {Object} state - Current LangGraph AgentState
 * @param {Object} [options={}] - Optional injection (e.g., llm client for tests)
 * @returns {Promise<Object>} State update with tailoredBullets array
 */
async function resumeTailoringNode(state, options = {}) {
  // Retrieve or compute structured formats
  const structuredResume =
    state.structuredResume || formatStructuredResume(state.resumeSections || {});
  const structuredJD =
    state.structuredJD || formatStructuredJD(state.jdRequirements || {});
  const userEdits = state.userEdits || null;

  // Retrieve or fetch recent approved style examples before tailoring
  let styleExamples = Array.isArray(options.styleExamples)
    ? options.styleExamples
    : Array.isArray(state.styleExamples) && state.styleExamples.length > 0
    ? state.styleExamples
    : [];

  const userId = options.userId || state.userId || null;
  if (styleExamples.length === 0 && userId) {
    try {
      styleExamples = await getRecentStyleExamples(userId, 10);
    } catch (fetchErr) {
      console.warn('[ResumeTailoringNode] Failed to fetch user style examples:', fetchErr.message);
      styleExamples = [];
    }
  }

  const resumeBullets = structuredResume.allBulletPoints || [];

  // If no bullets exist in the resume, return empty array gracefully
  if (resumeBullets.length === 0) {
    return {
      tailoredBullets: [],
      status: 'tailored',
      styleExamples,
    };
  }

  // Obtain LLM instance: passed option -> state.llm -> getLLM()
  let llmClient = options.llm || state.llm || null;

  if (!llmClient) {
    try {
      llmClient = getLLM();
    } catch {
      // If API key is not configured and fallback allowed, use heuristic
      if (options.allowFallback !== false) {
        const fallbackBullets = tailorBulletsHeuristic(resumeBullets, structuredJD, styleExamples);
        return {
          tailoredBullets: fallbackBullets,
          status: 'tailored',
          styleExamples,
        };
      }
      throw new Error('GEMINI_API_KEY is not configured for resumeTailoringNode');
    }
  }

  // Build prompts with personalized system prompt
  const humanPrompt = buildTailoringPrompt({
    resumeBullets,
    jobDescription: structuredJD,
    userEdits,
  });

  const systemPrompt = buildTailoringSystemPrompt(styleExamples);

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(humanPrompt),
  ];

  try {
    const response = await llmClient.invoke(messages);
    const content = typeof response === 'string' ? response : response?.content || '';
    const tailoredBullets = parseTailoredBullets(content, resumeBullets);

    return {
      tailoredBullets,
      status: 'tailored',
      styleExamples,
    };
  } catch (err) {
    if (options.allowFallback !== false) {
      console.warn(`[ResumeTailoringNode] LLM invocation encountered an error (${err.message}). Using heuristic fallback.`);
      const fallbackBullets = tailorBulletsHeuristic(resumeBullets, structuredJD, styleExamples);
      return {
        tailoredBullets: fallbackBullets,
        status: 'tailored',
        styleExamples,
      };
    }
    throw err;
  }
}

module.exports = {
  resumeTailoringNode,
  TAILORING_SYSTEM_PROMPT,
  buildTailoringSystemPrompt,
  formatStyleExamplesForPrompt,
  buildTailoringPrompt,
  parseTailoredBullets,
  tailorBulletsHeuristic,
};

