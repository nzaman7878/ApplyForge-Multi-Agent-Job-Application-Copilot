const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { getLLM } = require('../../config/llm');
const { formatStructuredResume, formatStructuredJD } = require('./parserNode');

/**
 * System prompt enforcing:
 * 1. Professional, articulate, and compelling tone
 * 2. Absolute prohibition of clichés (e.g. "I am writing to apply", "perfect fit", "hard worker")
 * 3. Deep specificity to the target role, company, and challenges
 * 4. Grounded in actual candidate accomplishments from tailored bullets
 * 5. Structured JSON output: { subject, body, keyThemes }
 */
const COVER_LETTER_SYSTEM_PROMPT = `You are a premier executive career strategist and cover letter writer for ApplyForge.
Your objective is to craft an exceptional, modern, and highly targeted cover letter based on the candidate's tailored achievements and the company's job requirements.

MANDATORY WRITING PRINCIPLES:
1. PROFESSIONAL TONE: Articulate, poised, and confident without being arrogant or sycophantic. Focus on value creation and demonstrated engineering/leadership impact.
2. NO CLICHÉS: Strictly avoid generic, overused openers and fluff such as:
   - "I am writing to express my enthusiastic interest in..."
   - "I am the ideal/perfect candidate for your position..."
   - "I am a self-motivated team player and hard worker..."
   - "Ever since I was young, I've had a passion for..."
3. ROLE-SPECIFIC CONTEXT: Lead immediately with relevant domain expertise and genuine alignment with the company's specific mission, scale, and technical stack.
4. EVIDENCE-BASED: Integrate 2-3 specific accomplishments from the candidate's tailored bullet points, highlighting measurable outcomes (e.g., latency reduction, throughput, system scale, revenue impact).
5. STRUCTURED JSON OUTPUT: You must output ONLY a valid JSON object matching this schema:
{
  "subject": "Role Title Application - Candidate Name",
  "body": "Dear [Hiring Manager / Team],\n\n[Paragraph 1: High-impact hook connecting candidate domain expertise with company need]\n\n[Paragraph 2: Deep dive into core technical accomplishments and problem solving]\n\n[Paragraph 3: Additional relevant skills, leadership, or culture alignment]\n\n[Paragraph 4: Call to action and forward-looking closing]\n\nSincerely,\n[Candidate Name]",
  "keyThemes": ["Theme 1", "Theme 2", "Theme 3"]
}

Output ONLY valid JSON. No conversational preamble or postscript.`;

/**
 * Builds the human prompt for the cover letter agent.
 *
 * @param {Object} params
 * @param {string} params.candidateName
 * @param {string} params.roleTitle
 * @param {string} params.company
 * @param {Array} params.tailoredBullets
 * @param {Object} params.jobDescription
 * @param {string} [params.candidateSummary]
 * @param {Object} [params.userEdits]
 * @returns {string} Formatted prompt string
 */
function buildCoverLetterPrompt({
  candidateName,
  roleTitle,
  company,
  tailoredBullets,
  jobDescription,
  candidateSummary = '',
  userEdits = null,
}) {
  const reqSkills = (jobDescription.requiredSkills || []).join(', ') || 'Not specified';
  const niceSkills = (jobDescription.niceToHave || []).join(', ') || 'None listed';
  const expContext = (jobDescription.experience || [])
    .concat(jobDescription.qualifications || [])
    .join('; ') || 'Not specified';

  const bulletsFormatted = (tailoredBullets || [])
    .slice(0, 5)
    .map((b, i) => {
      const text = b.tailoredBullet || b.tailored || b.originalBullet || b.text || b;
      return `[Achievement ${i + 1}]: "${text}"`;
    })
    .join('\n');

  let userNotes = '';
  if (userEdits && (userEdits.notes || userEdits.coverLetterInstructions)) {
    userNotes = `\nUSER SPECIFIC INSTRUCTIONS:\n${userEdits.notes || userEdits.coverLetterInstructions}\n`;
  }

  return `
TARGET OPPORTUNITY:
- Role Title: ${roleTitle || 'Target Role'}
- Company: ${company || 'Target Company'}
- Key Skills Required: ${reqSkills}
- Preferred Competencies: ${niceSkills}
- Qualifications / Experience: ${expContext}

CANDIDATE INFORMATION:
- Name: ${candidateName || 'Candidate'}
- Summary: ${candidateSummary || 'Senior Professional'}
${userNotes}
KEY TAILORED ACCOMPLISHMENTS TO WEAVE INTO LETTER:
${bulletsFormatted || 'No specific bullets provided.'}

Instructions:
1. Write a compelling, role-specific cover letter free of clichés.
2. Weave the candidate's achievements directly into the narrative.
3. Return the response as a JSON object with:
   - "subject": Application subject line
   - "body": Full cover letter text with professional salutation and sign-off
   - "keyThemes": Array of 2 to 4 major narrative themes emphasized in the letter
`.trim();
}

/**
 * Parses and extracts structured cover letter from LLM output.
 *
 * @param {string|Object} rawOutput
 * @param {Object} fallbackParams
 * @returns {{ subject: string, body: string, keyThemes: string[] }}
 */
function parseCoverLetter(rawOutput, fallbackParams = {}) {
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
    typeof parsed.body === 'string' &&
    parsed.body.trim().length > 0
  ) {
    const subject =
      typeof parsed.subject === 'string' && parsed.subject.trim().length > 0
        ? parsed.subject.trim()
        : `${fallbackParams.roleTitle || 'Role'} Application - ${fallbackParams.candidateName || 'Candidate'}`;

    const keyThemes = Array.isArray(parsed.keyThemes) && parsed.keyThemes.length > 0
      ? parsed.keyThemes.map((t) => String(t).trim()).filter(Boolean)
      : [
          `${fallbackParams.roleTitle || 'Technical'} Leadership`,
          'Scalable Architecture & Impact',
          'Cross-functional Execution',
        ];

    return {
      subject,
      body: parsed.body.trim(),
      keyThemes,
    };
  }

  // Fallback to deterministic generator
  return generateCoverLetterHeuristic(fallbackParams);
}

/**
 * Deterministic cover letter generator for offline execution or tests.
 *
 * @param {Object} params
 * @returns {{ subject: string, body: string, keyThemes: string[] }}
 */
function generateCoverLetterHeuristic({
  candidateName = 'Candidate',
  roleTitle = 'Software Engineer',
  company = 'Target Company',
  tailoredBullets = [],
  jobDescription = {},
}) {
  const subject = `${roleTitle} Application - ${candidateName}`;
  const targetSkills = (jobDescription.requiredSkills || []).slice(0, 3).join(', ') || 'modern engineering';

  const firstAchievement =
    tailoredBullets[0]?.tailoredBullet ||
    tailoredBullets[0]?.originalBullet ||
    'delivered robust, high-availability software systems with measurable performance gains';

  const secondAchievement =
    tailoredBullets[1]?.tailoredBullet ||
    tailoredBullets[1]?.originalBullet ||
    'collaborated across teams to streamline deployment velocity and elevate product reliability';

  const body = `Dear Hiring Team at ${company},

I am writing to present my background for the ${roleTitle} role. With a proven record in ${targetSkills}, I have consistently built resilient solutions that align technical execution with strategic organizational goals.

At scale, my work centers on driving engineering rigor and demonstrable outcomes. Notably, I ${firstAchievement.replace(/\.$/, '')}. Furthermore, I ${secondAchievement.replace(/\.$/, '')}. These initiatives reflect my focus on high standards, clear communication, and delivering durable business value.

${company}'s reputation for innovation and operational excellence presents an ideal environment where my technical skills and ownership mindset can contribute directly to your team's objectives. I look forward to the opportunity to discuss how my background aligns with your upcoming roadmap.

Sincerely,
${candidateName}`;

  const keyThemes = [
    `${roleTitle} Core Expertise`,
    'High-Throughput Engineering & Scalability',
    'Business Impact & Cross-Functional Alignment',
  ];

  return {
    subject,
    body,
    keyThemes,
  };
}

/**
 * Cover Letter Agent Node for LangGraph pipeline.
 *
 * Consumes tailored bullets + JD context.
 * Generates role-specific cover letter with subject, body, and key narrative themes.
 *
 * Output: { coverLetter: { subject, body, keyThemes }, status: 'cover_letter_generated' }
 *
 * @param {Object} state - Current LangGraph AgentState
 * @param {Object} [options={}] - Optional injection (e.g. llm client for tests)
 * @returns {Promise<Object>} State update with coverLetter object
 */
async function coverLetterNode(state, options = {}) {
  const structuredResume =
    state.structuredResume || formatStructuredResume(state.resumeSections || {});
  const structuredJD =
    state.structuredJD || formatStructuredJD(state.jdRequirements || {});
  const tailoredBullets = state.tailoredBullets || structuredResume.allBulletPoints || [];
  const userEdits = state.userEdits || null;

  const candidateName = structuredResume.contact?.name || 'Applicant';
  const roleTitle = structuredJD.roleTitle || 'Target Role';
  const company = structuredJD.company || 'Target Company';
  const candidateSummary = structuredResume.summary || '';

  const fallbackParams = {
    candidateName,
    roleTitle,
    company,
    tailoredBullets,
    jobDescription: structuredJD,
    candidateSummary,
    userEdits,
  };

  // Obtain LLM instance
  let llmClient = options.llm || state.llm || null;

  if (!llmClient) {
    try {
      llmClient = getLLM();
    } catch {
      if (options.allowFallback !== false) {
        const heuristicOutput = generateCoverLetterHeuristic(fallbackParams);
        return {
          coverLetter: heuristicOutput,
          status: 'cover_letter_generated',
        };
      }
      throw new Error('GEMINI_API_KEY is not configured for coverLetterNode');
    }
  }

  // Build human prompt
  const humanPrompt = buildCoverLetterPrompt(fallbackParams);

  const messages = [
    new SystemMessage(COVER_LETTER_SYSTEM_PROMPT),
    new HumanMessage(humanPrompt),
  ];

  try {
    const response = await llmClient.invoke(messages);
    const content = typeof response === 'string' ? response : response?.content || '';
    const coverLetter = parseCoverLetter(content, fallbackParams);

    return {
      coverLetter,
      status: 'cover_letter_generated',
    };
  } catch (err) {
    if (options.allowFallback !== false) {
      console.warn(
        `[CoverLetterNode] LLM invocation encountered an error (${err.message}). Using heuristic fallback.`
      );
      const fallbackOutput = generateCoverLetterHeuristic(fallbackParams);
      return {
        coverLetter: fallbackOutput,
        status: 'cover_letter_generated',
      };
    }
    throw err;
  }
}

module.exports = {
  coverLetterNode,
  COVER_LETTER_SYSTEM_PROMPT,
  buildCoverLetterPrompt,
  parseCoverLetter,
  generateCoverLetterHeuristic,
};
