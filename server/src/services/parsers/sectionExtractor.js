/**
 * Heuristic regex-based extraction for resume sections.
 * Extracts Contact, Summary, Experience, Education, Skills, and Certifications
 * into a structured object conforming to the Resume model parsedSections schema.
 */

// Common section header patterns
const SECTION_PATTERNS = {
  summary:
    /^(?:professional\s+summary|executive\s+summary|summary(?:\s+of\s+qualifications)?|career\s+objective|objective|about\s+me|professional\s+profile|profile)\s*[:\-—]?$/i,
  experience:
    /^(?:work\s+experience|professional\s+experience|relevant\s+experience|employment\s+history|work\s+history|experience)\s*[:\-—]?$/i,
  education:
    /^(?:education(?:al\s+background)?|academic\s+background|academics|qualifications)\s*[:\-—]?$/i,
  skills:
    /^(?:technical\s+skills|core\s+competencies|key\s+skills|areas\s+of\s+expertise|skills\s+&\s+abilities|skills(?:\s+and\s+tools)?|skills|technologies|tech\s+stack)\s*[:\-—]?$/i,
  certifications:
    /^(?:certifications|licenses(?:\s+and\s+certifications)?|credentials|certificates)\s*[:\-—]?$/i,
};

// Regex patterns for Contact information
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,14})/;
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub)\/([a-zA-Z0-9_/-]+)/i;
const GITHUB_REGEX = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i;
const PORTFOLIO_REGEX =
  /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9_-]+\.(?:dev|io|me|portfolio|app|com)(?:\/[^\s]*)?)/i;
const LOCATION_REGEX = /(?:([A-Z][a-zA-Z\s.-]+),\s*([A-Z]{2}(?:\s+\d{5})?|[A-Z][a-zA-Z\s]+))/;

// Regex for Dates in Experience & Education
const DATE_RANGE_REGEX =
  /(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{1,2}\/\d{4}|\d{4})\b(?:\s*[-–—to]+\s*(?:present|current|now|\d{1,2}\/\d{4}|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{4}))?)/i;

/**
 * Returns empty parsedSections structure
 */
const getDefaultSections = () => ({
  contact: {
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    portfolio: '',
  },
  summary: '',
  experience: [],
  education: [],
  skills: [],
  certifications: [],
});

/**
 * Extracts contact information from the raw text and header lines.
 */
const extractContact = (rawText, headerLines) => {
  const contact = {
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    portfolio: '',
  };

  if (!rawText) return contact;

  // Name: First line with alphabet characters that is not a header/URL/email
  for (const line of headerLines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 1 &&
      trimmed.length < 50 &&
      !EMAIL_REGEX.test(trimmed) &&
      !PHONE_REGEX.test(trimmed) &&
      !trimmed.includes('http') &&
      !Object.values(SECTION_PATTERNS).some((p) => p.test(trimmed))
    ) {
      contact.name = trimmed;
      break;
    }
  }

  // Email
  const emailMatch = rawText.match(EMAIL_REGEX);
  if (emailMatch) {
    contact.email = emailMatch[0].toLowerCase();
  }

  // Phone
  const phoneMatch = rawText.match(PHONE_REGEX);
  if (phoneMatch) {
    contact.phone = phoneMatch[0].trim();
  }

  // LinkedIn
  const linkedinMatch = rawText.match(LINKEDIN_REGEX);
  if (linkedinMatch) {
    contact.linkedin = linkedinMatch[0].startsWith('http')
      ? linkedinMatch[0]
      : `https://${linkedinMatch[0]}`;
  }

  // GitHub
  const githubMatch = rawText.match(GITHUB_REGEX);
  if (githubMatch) {
    contact.github = githubMatch[0].startsWith('http')
      ? githubMatch[0]
      : `https://${githubMatch[0]}`;
  }

  // Portfolio: exclude email domains, linkedin, and github
  let textForPortfolio = rawText.replace(new RegExp(EMAIL_REGEX.source, 'gi'), '');
  if (linkedinMatch) {
    textForPortfolio = textForPortfolio.replaceAll(linkedinMatch[0], '');
  }
  if (githubMatch) {
    textForPortfolio = textForPortfolio.replaceAll(githubMatch[0], '');
  }

  const portfolioMatch =
    textForPortfolio.match(
      /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9_-]+\.(?:dev|io|me|portfolio|site|app|page|design|tech)(?:\/[^\s]*)?/i
    ) || textForPortfolio.match(/https?:\/\/(?:www\.)?[a-zA-Z0-9_-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/i);

  if (portfolioMatch) {
    contact.portfolio = portfolioMatch[0].startsWith('http')
      ? portfolioMatch[0]
      : `https://${portfolioMatch[0]}`;
  }

  // Location heuristic: check header lines and segments
  for (const line of headerLines) {
    const segments = line.split(/[|•·\t]/).map((s) => s.trim());
    for (const seg of segments) {
      if (!seg.includes('@') && !seg.includes('http') && !PHONE_REGEX.test(seg)) {
        const locMatch = seg.match(LOCATION_REGEX);
        if (locMatch) {
          contact.location = locMatch[0].trim();
          break;
        }
      }
    }
    if (contact.location) break;
  }

  return contact;
};

/**
 * Extracts an array of skills from the Skills section text.
 */
const extractSkills = (skillsText) => {
  if (!skillsText) return [];

  const items = skillsText
    // Split by commas, semicolons, bullets (•, -, *, |), or newlines
    .split(/[,;•\n|*]+/)
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      // Filter out pure numbers or excessively long blocks
      if (s.length > 50) return false;
      // Strip colon if label like "Languages: JavaScript"
      return true;
    });

  const cleanedSkills = [];
  for (const item of items) {
    // If it has a category colon like "Frontend: React, Vue"
    if (item.includes(':')) {
      const parts = item.split(':').slice(1).join(':').trim();
      if (parts) {
        cleanedSkills.push(parts);
      }
    } else {
      cleanedSkills.push(item);
    }
  }

  // Deduplicate and filter
  return Array.from(new Set(cleanedSkills.map((s) => s.trim()))).filter((s) => s.length > 1);
};

/**
 * Extracts experience items from the Experience section text.
 */
const extractExperience = (experienceText) => {
  if (!experienceText) return [];

  const entries = [];
  const lines = experienceText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let currentEntry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^[•\-*▪–—]\s*/.test(line);
    const dateMatch = line.match(DATE_RANGE_REGEX);

    // If currentEntry exists but has no dates and no bullets yet, this line is the date/location line for currentEntry
    if (
      !isBullet &&
      dateMatch &&
      line.length < 120 &&
      currentEntry &&
      !currentEntry.startDate &&
      currentEntry.bulletPoints.length === 0
    ) {
      const dateStr = dateMatch[0];
      const isCurrent = /present|current|now/i.test(dateStr);
      const parts = dateStr.split(/[-–—to]+/i).map((s) => s.trim());

      currentEntry.startDate = parts[0] || '';
      currentEntry.endDate = isCurrent ? 'Present' : parts[1] || '';
      currentEntry.current = isCurrent;

      const remaining = line
        .replace(dateMatch[0], '')
        .replace(/^[|•·\t\s,]+/, '')
        .replace(/[|•·\t\s,]+$/, '')
        .trim();
      if (remaining && !currentEntry.location) {
        currentEntry.location = remaining;
      }
      continue;
    }

    // If we encounter a new job line with dates (not a bullet), start a new job block
    if (!isBullet && dateMatch && line.length < 120) {
      if (currentEntry) {
        entries.push(currentEntry);
      }

      const dateStr = dateMatch[0];
      const isCurrent = /present|current|now/i.test(dateStr);
      const parts = dateStr.split(/[-–—to]+/i).map((s) => s.trim());

      currentEntry = {
        title: '',
        company: '',
        location: '',
        startDate: parts[0] || '',
        endDate: isCurrent ? 'Present' : parts[1] || '',
        current: isCurrent,
        description: '',
        bulletPoints: [],
      };

      // Try to extract title/company from the line or previous line
      const textWithoutDate = line
        .replace(dateMatch[0], '')
        .trim()
        .replace(/^[-–—|,]\s*/, '')
        .replace(/[-–—|,]\s*$/, '');
      if (textWithoutDate) {
        const splitByAt = textWithoutDate.split(/\s+at\s+|\s+[-–—|]\s+/i);
        if (splitByAt.length > 1) {
          currentEntry.title = splitByAt[0].trim();
          currentEntry.company = splitByAt[1].trim();
        } else {
          currentEntry.title = textWithoutDate;
        }
      } else if (i > 0 && !currentEntry.title) {
        const prevLine = lines[i - 1];
        if (!/^[•\-*▪]/.test(prevLine) && prevLine.length < 80) {
          currentEntry.title = prevLine;
        }
      }
    } else if (isBullet && currentEntry) {
      const bulletText = line.replace(/^[•\-*▪–—]\s*/, '').trim();
      if (bulletText) {
        currentEntry.bulletPoints.push(bulletText);
      }
    } else if (currentEntry && (currentEntry.bulletPoints.length > 0 || currentEntry.startDate)) {
      // We already have a complete entry, so this line without bullets is likely a new job title
      entries.push(currentEntry);

      const splitByAt = line.split(/\s+at\s+|\s+[-–—|]\s+/i);
      let title = line;
      let company = '';
      if (splitByAt.length > 1) {
        title = splitByAt[0].trim();
        company = splitByAt[1].trim();
      }

      currentEntry = {
        title,
        company,
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        description: '',
        bulletPoints: [],
      };
    } else if (currentEntry) {
      // If we don't have title/company yet, assign line
      if (!currentEntry.title && line.length < 80) {
        const splitByAt = line.split(/\s+at\s+|\s+[-–—|]\s+/i);
        if (splitByAt.length > 1) {
          currentEntry.title = splitByAt[0].trim();
          currentEntry.company = splitByAt[1].trim();
        } else {
          currentEntry.title = line;
        }
      } else if (!currentEntry.company && line.length < 80) {
        currentEntry.company = line;
      } else if (!isBullet) {
        if (!currentEntry.description) {
          currentEntry.description = line;
        } else {
          currentEntry.bulletPoints.push(line);
        }
      }
    } else {
      const splitByAt = line.split(/\s+at\s+|\s+[-–—|]\s+/i);
      let title = line;
      let company = '';
      if (splitByAt.length > 1) {
        title = splitByAt[0].trim();
        company = splitByAt[1].trim();
      }

      currentEntry = {
        title,
        company,
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        description: '',
        bulletPoints: [],
      };
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
};

/**
 * Extracts education items from the Education section text.
 */
const extractEducation = (educationText) => {
  if (!educationText) return [];

  const entries = [];
  const lines = educationText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const DEGREE_REGEX =
    /(?:b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?b\.?a\.?|ph\.?d\.?|bachelor|master|doctor|associate|diploma|b\.tech|m\.tech)\b/i;
  const GPA_REGEX = /gpa\s*[:\-—]?\s*([0-4](?:\.\d{1,2})?)/i;

  let currentEntry = null;

  for (const line of lines) {
    const isDegree = DEGREE_REGEX.test(line);
    const isInstitution =
      line.toLowerCase().includes('university') ||
      line.toLowerCase().includes('college') ||
      line.toLowerCase().includes('institute') ||
      line.toLowerCase().includes('school') ||
      line.toLowerCase().includes('polytechnic') ||
      line.toLowerCase().includes('academy');
    const dateMatch = line.match(DATE_RANGE_REGEX);
    const gpaMatch = line.match(GPA_REGEX);

    if (!currentEntry) {
      currentEntry = {
        institution: '',
        degree: '',
        fieldOfStudy: '',
        startDate: '',
        endDate: '',
        gpa: '',
        honors: [],
      };
    }

    // A subsequent new education entry starts if we hit another institution or degree after filling current
    const isNewEntry =
      (isInstitution && currentEntry.institution) ||
      (isDegree && currentEntry.degree && (currentEntry.endDate || currentEntry.gpa));

    if (isNewEntry) {
      entries.push(currentEntry);
      currentEntry = {
        institution: '',
        degree: '',
        fieldOfStudy: '',
        startDate: '',
        endDate: '',
        gpa: '',
        honors: [],
      };
    }

    if (isDegree && !currentEntry.degree) {
      if (line.toLowerCase().includes(' in ')) {
        const parts = line.split(/\s+in\s+/i);
        currentEntry.degree = parts[0].trim();
        currentEntry.fieldOfStudy = parts[1].trim();
      } else {
        currentEntry.degree = line;
      }
    } else if (isInstitution && !currentEntry.institution) {
      currentEntry.institution = line;
    }

    if (gpaMatch && !currentEntry.gpa) {
      currentEntry.gpa = gpaMatch[1];
    }

    if (dateMatch && !currentEntry.endDate) {
      const parts = dateMatch[0].split(/[-–—to]+/i).map((s) => s.trim());
      currentEntry.startDate = parts[0] || '';
      currentEntry.endDate = parts[1] || '';
    }

    if (line.toLowerCase().includes('honor') || line.toLowerCase().includes('dean')) {
      currentEntry.honors.push(line);
    }
  }

  if (currentEntry && (currentEntry.institution || currentEntry.degree)) {
    entries.push(currentEntry);
  }

  return entries;
};

/**
 * Extracts certification items from the Certifications section text.
 */
const extractCertifications = (certText) => {
  if (!certText) return [];

  const lines = certText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const certs = [];

  for (const line of lines) {
    const cleanLine = line.replace(/^[•\-*▪–—]\s*/, '').trim();
    if (!cleanLine) continue;

    const dateMatch = cleanLine.match(/\b(20\d{2}|19\d{2})\b/);
    const date = dateMatch ? dateMatch[0] : '';
    const urlMatch = cleanLine.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : '';

    let name = cleanLine;
    if (url) name = name.replace(url, '').trim();

    certs.push({
      name,
      issuer: '',
      date,
      url,
    });
  }

  return certs;
};

/**
 * Main parser function: heuristic regex-based resume section extractor.
 *
 * @param {string} rawText - Cleaned raw text extracted from PDF or DOCX
 * @returns {Object} - Structured object matching Resume model parsedSections
 */
const extractSections = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    return getDefaultSections();
  }

  const lines = rawText.split('\n');

  // Identify section boundaries by scanning line by line
  const sectionIndices = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const [sectionKey, regex] of Object.entries(SECTION_PATTERNS)) {
      if (regex.test(line)) {
        sectionIndices.push({
          section: sectionKey,
          lineIndex: i,
        });
        break;
      }
    }
  }

  // Extract raw text blocks for each identified section
  const sectionBlocks = {
    header: '',
    summary: '',
    experience: '',
    education: '',
    skills: '',
    certifications: '',
  };

  if (sectionIndices.length === 0) {
    // No explicit headers detected; treat first lines as header/contact and rest as summary
    sectionBlocks.header = lines.slice(0, 10).join('\n');
    sectionBlocks.summary = lines.slice(10).join('\n');
  } else {
    // Header block is everything before first section
    sectionBlocks.header = lines.slice(0, sectionIndices[0].lineIndex).join('\n');

    for (let j = 0; j < sectionIndices.length; j++) {
      const current = sectionIndices[j];
      const next = sectionIndices[j + 1];

      const start = current.lineIndex + 1;
      const end = next ? next.lineIndex : lines.length;

      const content = lines.slice(start, end).join('\n').trim();
      sectionBlocks[current.section] = content;
    }
  }

  // Header lines for contact details
  const headerLines = sectionBlocks.header
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Parse structured subsections
  const contact = extractContact(rawText, headerLines);
  const summary = sectionBlocks.summary.trim();
  const experience = extractExperience(sectionBlocks.experience);
  const education = extractEducation(sectionBlocks.education);
  const skills = extractSkills(sectionBlocks.skills);
  const certifications = extractCertifications(sectionBlocks.certifications);

  return {
    contact,
    summary,
    experience,
    education,
    skills,
    certifications,
  };
};

extractSections.extractSections = extractSections;
extractSections.getDefaultSections = getDefaultSections;

module.exports = extractSections;
