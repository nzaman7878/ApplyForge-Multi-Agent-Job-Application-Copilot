const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { getLLM } = require('../../config/llm');
const { formatStructuredResume, formatStructuredJD } = require('./parserNode');

/**
 * System prompt for the Follow-Up Email Drafting Agent.
 * Enforces:
 * 1. Professional, poised, and courteous tone without cliché desperation.
 * 2. Deep contextual alignment with the role, company, and elapsed days since applying.
 * 3. Concrete value articulation drawing from candidate's achievements.
 * 4. Structured JSON output matching the target schema.
 */
const FOLLOW_UP_SYSTEM_PROMPT = `You are a premier executive career strategist and communications specialist for ApplyForge.
Your objective is to craft an exceptional, modern, and highly effective follow-up email for a candidate based on their application details, current hiring status, and the number of days elapsed since applying.

MANDATORY WRITING PRINCIPLES:
1. PROFESSIONAL & COURTEOUS TONE: Confident, articulate, and respectful of the recruiter or hiring manager's schedule. Never sound entitled, pushy, or desperate.
2. TIMELINE & STAGE ADAPTATION:
   - Early Stage (1-7 days): Polite submission confirmation, succinct reiteration of enthusiasm, and light check-in.
   - Standard Stage (8-14 days): Professional status check-in, highlighting continued alignment, 1-2 core technical strengths, and inquiry on timeline.
   - Extended Stage (15+ days): Graceful, low-pressure ping to determine if the role remains active, reaffirming interest without friction.
   - Interview Stage (status = 'interviewing'): Warm post-discussion reinforcement, referencing team conversations, and inquiring on next steps.
3. CONCISE & ACTIONABLE: Keep the email succinct (between 100 and 180 words, 2-3 short paragraphs) with a clear, non-intrusive call to action.
4. EVIDENCE-BASED VALUE: Seamlessly integrate 1-2 specific achievements or technical capabilities from the candidate's background.
5. STRUCTURED JSON OUTPUT: You must output ONLY a valid JSON object matching this exact schema:
{
  "subject": "Clear, professional subject line (e.g., 'Following Up: [Role Title] - [Candidate Name]')",
  "body": "Dear [Hiring Manager / Team],\n\n[Concise, well-crafted follow-up body paragraphs]\n\nBest regards,\n[Candidate Name]",
  "strategy": "Classification of follow-up angle (e.g., 'early_courtesy_check', 'standard_status_inquiry', 'post_interview_reinforcement', 'graceful_re_engagement')",
  "daysSinceApplied": 8,
  "recommendedSendTime": "Strategic recommendation for best delivery (e.g., 'Tuesday morning between 9:00 AM - 10:30 AM')",
  "keyHighlights": ["Highlight 1", "Highlight 2"],
  "tone": "polite_professional"
}

Output ONLY valid JSON. No conversational preamble or postscript.`;

/**
 * Builds the human prompt for the follow-up email agent.
 *
 * @param {Object} params
 * @returns {string} Formatted human prompt
 */
function buildFollowUpPrompt({
  candidateName = 'Candidate',
  candidateEmail = '',
  roleTitle = 'Target Role',
  company = 'Target Company',
  status = 'applied',
  daysSinceApplied = 0,
  tailoredBullets = [],
  jobDescription = {},
  recipientName = '',
  tone = 'professional',
  customNotes = '',
}) {
  const reqSkills = (jobDescription.requiredSkills || []).slice(0, 5).join(', ') || 'Not specified';
  const bulletsFormatted = (tailoredBullets || [])
    .slice(0, 3)
    .map((b, i) => {
      const text = b.tailoredBullet || b.tailored || b.originalBullet || b.text || b;
      return `[Key Achievement ${i + 1}]: "${text}"`;
    })
    .join('\n');

  const notesSection = customNotes
    ? `\nUSER SPECIFIC NOTES / DIRECTIVES:\n${customNotes}\n`
    : '';

  const recipientContext = recipientName
    ? `Direct recipient: ${recipientName}`
    : `Direct recipient: Hiring Team / Manager at ${company}`;

  return `
APPLICATION CONTEXT:
- Role Title: ${roleTitle}
- Target Company: ${company}
- Current Stage/Status: ${status}
- Days Since Application Submitted: ${daysSinceApplied} day(s)
- ${recipientContext}
- Target Skills/Stack: ${reqSkills}

CANDIDATE INFORMATION:
- Name: ${candidateName}
- Email: ${candidateEmail || 'Not specified'}
- Preferred Tone: ${tone}
${notesSection}
CANDIDATE KEY ACCOMPLISHMENTS:
${bulletsFormatted || 'Demonstrated technical impact and software engineering leadership.'}

Instructions:
1. Craft a tailored follow-up email tailored specifically for ${daysSinceApplied} day(s) elapsed since applying.
2. Adapt tone to "${tone}" and respect the current stage ("${status}").
3. Weave in candidate achievements naturally.
4. Output strict JSON matching the schema with subject, body, strategy, daysSinceApplied, recommendedSendTime, keyHighlights, and tone.
`.trim();
}

/**
 * Deterministic follow-up generator for offline execution, fallback, or unit testing.
 *
 * @param {Object} params
 * @returns {{ subject: string, body: string, strategy: string, daysSinceApplied: number, recommendedSendTime: string, keyHighlights: string[], tone: string }}
 */
function generateFollowUpHeuristic({
  candidateName = 'Candidate',
  roleTitle = 'Software Engineer',
  company = 'Target Company',
  status = 'applied',
  daysSinceApplied = 7,
  tailoredBullets = [],
  recipientName = '',
  tone = 'professional',
  customNotes = '',
}) {
  const recipientSalutation = recipientName ? recipientName : `Hiring Team at ${company}`;
  const firstAchievement =
    tailoredBullets[0]?.tailoredBullet ||
    tailoredBullets[0]?.originalBullet ||
    'delivering scalable and resilient software solutions';

  const cleanAchievement = String(firstAchievement).replace(/\.$/, '').trim();
  let subject = '';
  let body = '';
  let strategy = '';
  let recommendedSendTime = 'Tuesday or Wednesday morning between 9:00 AM - 11:00 AM';

  const noteAddition = customNotes ? `\n\nAdditionally, ${customNotes}.` : '';

  if (status === 'interviewing') {
    strategy = 'post_interview_reinforcement';
    subject = `Thank You & Follow-Up: ${roleTitle} Interview - ${candidateName}`;
    body = `Dear ${recipientSalutation},

Thank you very much for the opportunity to speak with you regarding the ${roleTitle} position at ${company}. I thoroughly enjoyed our discussion and learning more about your team's current technical priorities.

Our conversation reinforced my excitement about joining ${company}. Given my background in ${cleanAchievement}, I am confident that my experience aligns closely with your team's objectives.${noteAddition}

Please let me know if there are any updates regarding next steps in the interview process or if you need any additional materials from my side.

Best regards,
${candidateName}`;
  } else if (daysSinceApplied <= 7) {
    strategy = 'early_courtesy_check';
    subject = `Application Follow-Up: ${roleTitle} - ${candidateName}`;
    body = `Dear ${recipientSalutation},

I hope this email finds you well.

I recently submitted my application for the ${roleTitle} role at ${company} and wanted to briefly reiterate my enthusiastic interest in joining your team. With my background in ${cleanAchievement}, I am particularly energized by ${company}'s ongoing work and mission.${noteAddition}

I understand you are actively reviewing submissions, and I wanted to confirm you have all the information you need from my end. I would welcome the opportunity to discuss how my qualifications align with your upcoming goals.

Thank you for your time and consideration.

Best regards,
${candidateName}`;
  } else if (daysSinceApplied <= 14) {
    strategy = 'standard_status_inquiry';
    subject = `Status Inquiry: ${roleTitle} Application - ${candidateName}`;
    body = `Dear ${recipientSalutation},

I hope your week is off to a great start.

I am following up on my application for the ${roleTitle} position at ${company}, which I submitted ${daysSinceApplied} days ago. Given ${company}'s high standards for engineering excellence, I remain very excited about the prospect of contributing to your team.${noteAddition}

Specifically, my experience in ${cleanAchievement} has prepared me to deliver immediate value to your current initiatives. If you are conducting candidate interviews, I would love to connect for a brief introductory conversation.

Please let me know if I can provide any additional information or work samples.

Sincerely,
${candidateName}`;
  } else {
    strategy = 'graceful_re_engagement';
    subject = `Checking In: ${roleTitle} Role at ${company} - ${candidateName}`;
    recommendedSendTime = 'Tuesday morning at 9:30 AM';
    body = `Dear ${recipientSalutation},

I hope all is well with you and the team at ${company}.

I am reaching out to respectfully check in on the status of my application for the ${roleTitle} role submitted a few weeks ago. Knowing how dynamic hiring processes can be, I wanted to see if the position is still open and reaffirm my strong interest in the team.${noteAddition}

With demonstrated success in ${cleanAchievement}, I would be thrilled to bring my problem-solving mindset and technical expertise to ${company}. If the search is still ongoing, I welcome the chance to speak.

Thank you again for your time, and I wish you all the best with your search.

Warm regards,
${candidateName}`;
  }

  const recommendedWaitDays =
    status === 'interviewing'
      ? 3
      : daysSinceApplied <= 7
      ? 7
      : daysSinceApplied <= 14
      ? 5
      : 10;

  return {
    subject,
    body,
    strategy,
    daysSinceApplied: Number(daysSinceApplied) || 0,
    recommendedSendTime,
    recommendedWaitDays,
    keyHighlights: [
      `${roleTitle} domain expertise`,
      cleanAchievement.slice(0, 60),
    ],
    tone: tone || 'polite_professional',
  };
}

/**
 * Parses and extracts structured follow-up email draft from LLM output.
 *
 * @param {string|Object} rawOutput
 * @param {Object} fallbackParams
 * @returns {{ subject: string, body: string, strategy: string, daysSinceApplied: number, recommendedSendTime: string, keyHighlights: string[], tone: string }}
 */
function parseFollowUpDraft(rawOutput, fallbackParams = {}) {
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
    parsed.body.trim().length > 0 &&
    typeof parsed.subject === 'string' &&
    parsed.subject.trim().length > 0
  ) {
    const days =
      typeof parsed.daysSinceApplied === 'number'
        ? parsed.daysSinceApplied
        : Number(fallbackParams.daysSinceApplied) || 0;

    const keyHighlights = Array.isArray(parsed.keyHighlights) && parsed.keyHighlights.length > 0
      ? parsed.keyHighlights.map((k) => String(k).trim()).filter(Boolean)
      : [`${fallbackParams.roleTitle || 'Role'} alignment`, 'Demonstrated technical impact'];

    return {
      subject: parsed.subject.trim(),
      body: parsed.body.trim(),
      strategy: parsed.strategy || (days <= 7 ? 'early_courtesy_check' : 'standard_status_inquiry'),
      daysSinceApplied: days,
      recommendedSendTime:
        parsed.recommendedSendTime || 'Tuesday or Wednesday morning between 9:00 AM - 11:00 AM',
      recommendedWaitDays:
        typeof parsed.recommendedWaitDays === 'number'
          ? parsed.recommendedWaitDays
          : (days <= 7 ? 7 : days <= 14 ? 5 : 10),
      keyHighlights,
      tone: parsed.tone || fallbackParams.tone || 'polite_professional',
    };
  }

  return generateFollowUpHeuristic(fallbackParams);
}

/**
 * Follow-up Email Agent Node for LangGraph pipeline.
 *
 * @param {Object} state - Current LangGraph AgentState
 * @param {Object} [options={}] - Optional injection (e.g. llm client for tests)
 * @returns {Promise<Object>} State update with followUpEmail object
 */
async function followUpNode(state, options = {}) {
  const structuredResume =
    state.structuredResume ||
    state.candidateProfile ||
    formatStructuredResume(state.resumeSections || {});
  const structuredJD =
    state.structuredJD ||
    state.jobDescription ||
    formatStructuredJD(state.jdRequirements || {});
  const tailoredBullets = state.tailoredBullets || structuredResume.allBulletPoints || [];

  const candidateName = structuredResume.contact?.name || structuredResume.name || 'Applicant';
  const candidateEmail = structuredResume.contact?.email || structuredResume.email || '';
  const roleTitle = structuredJD.roleTitle || 'Target Role';
  const company = structuredJD.company || 'Target Company';
  const status = state.status || state.application?.status || 'applied';
  const daysSinceApplied =
    typeof state.daysSinceApplied === 'number'
      ? state.daysSinceApplied
      : typeof state.application?.daysSinceApplied === 'number'
      ? state.application.daysSinceApplied
      : !isNaN(Number(state.daysSinceApplied)) && state.daysSinceApplied !== null && state.daysSinceApplied !== ''
      ? Number(state.daysSinceApplied)
      : 7;

  const fallbackParams = {
    candidateName,
    candidateEmail,
    roleTitle,
    company,
    status,
    daysSinceApplied,
    tailoredBullets,
    jobDescription: structuredJD,
    recipientName: options.recipientName || '',
    tone: options.tone || 'professional',
    customNotes: options.customNotes || '',
  };

  let llmClient = options.llm || state.llm || null;

  if (!llmClient) {
    try {
      llmClient = getLLM();
    } catch {
      llmClient = null;
    }
  }

  if (!llmClient) {
    const fallbackDraft = generateFollowUpHeuristic(fallbackParams);
    return {
      followUpEmail: fallbackDraft,
      status: 'follow_up_drafted',
    };
  }

  try {
    const promptText = buildFollowUpPrompt(fallbackParams);
    const messages = [
      new SystemMessage(FOLLOW_UP_SYSTEM_PROMPT),
      new HumanMessage(promptText),
    ];

    const response = await llmClient.invoke(messages);
    const rawContent = response?.content || '';
    const draft = parseFollowUpDraft(rawContent, fallbackParams);

    return {
      followUpEmail: draft,
      status: 'follow_up_drafted',
    };
  } catch (err) {
    console.warn('[FollowUpNode] LLM invocation failed, falling back to heuristic:', err.message);
    const fallbackDraft = generateFollowUpHeuristic(fallbackParams);
    return {
      followUpEmail: fallbackDraft,
      status: 'follow_up_drafted',
    };
  }
}

/**
 * Standalone generator helper to draft a follow-up email directly from an application model
 * or explicit parameters.
 *
 * @param {Object} params
 * @param {Object} [options={}]
 * @returns {Promise<Object>}
 */
async function generateFollowUpEmail(params, options = {}) {
  const fallbackParams = {
    candidateName: params.candidateName || 'Applicant',
    candidateEmail: params.candidateEmail || '',
    roleTitle: params.roleTitle || params.application?.roleTitle || 'Target Role',
    company: params.company || params.application?.company || 'Target Company',
    status: params.status || params.application?.status || 'applied',
    daysSinceApplied:
      params.daysSinceApplied !== undefined
        ? Number(params.daysSinceApplied)
        : Math.max(
            0,
            Math.floor(
              (Date.now() -
                new Date(
                  params.application?.appliedAt ||
                    params.application?.appliedDate ||
                    params.application?.createdAt ||
                    Date.now()
                ).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          ),
    tailoredBullets:
      params.tailoredBullets ||
      params.application?.tailoredBullets ||
      params.application?.tailoredResume?.bullets ||
      [],
    recipientName: params.recipientName || '',
    tone: params.tone || 'professional',
    customNotes: params.customNotes || params.instructions || '',
  };

  let llmClient = options.llm || null;
  if (!llmClient) {
    try {
      llmClient = getLLM();
    } catch {
      llmClient = null;
    }
  }

  if (!llmClient) {
    return generateFollowUpHeuristic(fallbackParams);
  }

  try {
    const promptText = buildFollowUpPrompt(fallbackParams);
    const messages = [
      new SystemMessage(FOLLOW_UP_SYSTEM_PROMPT),
      new HumanMessage(promptText),
    ];

    const response = await llmClient.invoke(messages);
    const rawContent = response?.content || '';
    return parseFollowUpDraft(rawContent, fallbackParams);
  } catch (err) {
    console.warn('[generateFollowUpEmail] LLM failed, using heuristic fallback:', err.message);
    return generateFollowUpHeuristic(fallbackParams);
  }
}

module.exports = {
  FOLLOW_UP_SYSTEM_PROMPT,
  buildFollowUpPrompt,
  generateFollowUpHeuristic,
  parseFollowUpDraft,
  followUpNode,
  generateFollowUpEmail,
};
