/**
 * Normalizes an array of strings, trimming whitespace and filtering duplicates case-insensitively.
 *
 * @param {Array<string>} list
 * @returns {Array<string>}
 */
function cleanStringList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (typeof item === 'string' && item.trim().length > 0) {
      const clean = item.trim();
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(clean);
      }
    }
  }
  return result;
}

/**
 * Normalizes resume sections into a standardized comparison object.
 *
 * @param {Object} rawSections - Input resume sections or Resume model document
 * @returns {Object} Structured resume format
 */
function formatStructuredResume(rawSections) {
  const sections =
    rawSections && rawSections.parsedSections
      ? rawSections.parsedSections
      : rawSections || {};

  const contact = {
    name: sections.contact?.name || rawSections?.name || '',
    email: sections.contact?.email || '',
    phone: sections.contact?.phone || '',
    location: sections.contact?.location || '',
    linkedin: sections.contact?.linkedin || '',
    github: sections.contact?.github || '',
    portfolio: sections.contact?.portfolio || '',
  };

  const summary = (typeof sections.summary === 'string' ? sections.summary : '').trim();

  // Normalize skills
  const skills = cleanStringList(sections.skills);

  // Normalize experience and extract all individual bullet points
  const experienceList = Array.isArray(sections.experience) ? sections.experience : [];
  const experience = [];
  const allBulletPoints = [];

  experienceList.forEach((exp, expIdx) => {
    const title = exp.title || '';
    const company = exp.company || '';
    const location = exp.location || '';
    const startDate = exp.startDate || '';
    const endDate = exp.endDate || '';
    const current = Boolean(exp.current);
    const description = exp.description || '';
    const rawBullets = Array.isArray(exp.bulletPoints) ? exp.bulletPoints : [];
    const bulletPoints = [];

    rawBullets.forEach((bullet, bIdx) => {
      if (typeof bullet === 'string' && bullet.trim().length > 0) {
        const text = bullet.trim();
        bulletPoints.push(text);
        allBulletPoints.push({
          id: `exp_${expIdx}_bullet_${bIdx}`,
          experienceIndex: expIdx,
          bulletIndex: bIdx,
          company,
          role: title,
          original: text,
        });
      }
    });

    experience.push({
      title,
      company,
      location,
      startDate,
      endDate,
      current,
      description,
      bulletPoints,
    });
  });

  // Normalize education
  const educationList = Array.isArray(sections.education) ? sections.education : [];
  const education = educationList.map((edu) => ({
    institution: edu.institution || '',
    degree: edu.degree || '',
    fieldOfStudy: edu.fieldOfStudy || '',
    startDate: edu.startDate || '',
    endDate: edu.endDate || '',
    gpa: edu.gpa || '',
    honors: cleanStringList(edu.honors),
  }));

  // Normalize certifications
  const certList = Array.isArray(sections.certifications) ? sections.certifications : [];
  const certifications = certList.map((cert) => ({
    name: cert.name || '',
    issuer: cert.issuer || '',
    date: cert.date || '',
    url: cert.url || '',
  }));

  // Generate concatenated plain text for downstream token/keyword analyzers
  const textParts = [
    contact.name,
    summary,
    skills.join(', '),
    ...experience.map((e) => `${e.title} at ${e.company}. ${e.bulletPoints.join(' ')}`),
    ...education.map((ed) => `${ed.degree} in ${ed.fieldOfStudy} from ${ed.institution}`),
    ...certifications.map((c) => `${c.name} ${c.issuer}`),
  ].filter(Boolean);

  const fullText = textParts.join('\n\n');

  return {
    contact,
    summary,
    skills,
    experience,
    allBulletPoints,
    education,
    certifications,
    totalBulletPoints: allBulletPoints.length,
    fullText,
  };
}

/**
 * Normalizes job description requirements into a standardized comparison object.
 *
 * @param {Object} rawRequirements - Input JD requirements or JobDescription model document
 * @returns {Object} Structured JD format
 */
function formatStructuredJD(rawRequirements) {
  const reqs =
    rawRequirements && rawRequirements.parsedRequirements
      ? rawRequirements.parsedRequirements
      : rawRequirements || {};

  const company = rawRequirements?.company || reqs.company || '';
  const roleTitle = rawRequirements?.roleTitle || reqs.roleTitle || '';
  const rawText = rawRequirements?.rawText || reqs.rawText || '';

  const requiredSkills = cleanStringList(reqs.skills);
  const niceToHave = cleanStringList(reqs.niceToHave);
  const experience = cleanStringList(reqs.experience);
  const qualifications = cleanStringList(reqs.qualifications);

  // Combine unique skills
  const allSkills = cleanStringList([...requiredSkills, ...niceToHave]);

  return {
    company,
    roleTitle,
    requiredSkills,
    niceToHave,
    allSkills,
    experience,
    qualifications,
    rawText,
    totalRequiredSkills: requiredSkills.length,
  };
}

/**
 * Parser Agent Node for LangGraph pipeline.
 *
 * Combines resumeSections and jdRequirements from state into structured comparison format.
 * Output: { structuredResume, structuredJD } added to state.
 *
 * @param {Object} state - Current LangGraph AgentState
 * @returns {Promise<Object>} State update object containing { structuredResume, structuredJD, status }
 */
async function parserNode(state) {
  const rawResume = state?.resumeSections || {};
  const rawJD = state?.jdRequirements || {};

  const structuredResume = formatStructuredResume(rawResume);
  const structuredJD = formatStructuredJD(rawJD);

  // Cross-reference skills between candidate resume and target JD
  const resumeSkillsLower = new Set(structuredResume.skills.map((s) => s.toLowerCase()));
  const resumeFullTextLower = structuredResume.fullText.toLowerCase();

  const matchedSkills = [];
  const missingSkills = [];

  for (const skill of structuredJD.requiredSkills) {
    const sLower = skill.toLowerCase();
    if (resumeSkillsLower.has(sLower) || resumeFullTextLower.includes(sLower)) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  // Attach comparison metadata to structuredJD
  structuredJD.comparison = {
    matchedSkills,
    missingSkills,
    matchedCount: matchedSkills.length,
    missingCount: missingSkills.length,
    initialMatchRatio:
      structuredJD.requiredSkills.length > 0
        ? Math.round((matchedSkills.length / structuredJD.requiredSkills.length) * 100) / 100
        : 1.0,
  };

  return {
    structuredResume,
    structuredJD,
    status: 'parsed',
  };
}

module.exports = {
  parserNode,
  formatStructuredResume,
  formatStructuredJD,
};
