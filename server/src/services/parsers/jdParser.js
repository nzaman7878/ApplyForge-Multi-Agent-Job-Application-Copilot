/**
 * Job Description Parsing Service
 * Extracts:
 * - required skills (technical and domain keywords)
 * - experience requirements (tenure, years of experience, relevant domain experience)
 * - qualifications (degrees, education, eligibility requirements)
 * - nice-to-have (preferred qualifications, bonus skills, desired attributes)
 *
 * Uses structured regex heuristics and keyword detection.
 */

// Section heading pattern identifiers
const SECTION_PATTERNS = {
  requirements:
    /^(?:minimum\s+qualifications|basic\s+qualifications|requirements|must\s+haves?|what\s+you(?:'ll|\s+will)\s+need|what\s+we(?:'re|\s+are)\s+looking\s+for|what\s+you\s+bring|who\s+you\s+are|role\s+requirements|core\s+requirements|qualifications(?!\s+and\s+perks))\s*[:\-—]?$/i,
  niceToHave:
    /^(?:preferred\s+qualifications|nice\s+to\s+haves?|bonus\s+points?|bonus\s+qualifications|good\s+to\s+have|preferred\s+skills|preferred\s+experience|plus|pluses|what\s+gives\s+you\s+an\s+edge|additional\s+qualifications|desired\s+skills)\s*[:\-—]?$/i,
  responsibilities:
    /^(?:responsibilities|what\s+you(?:'ll|\s+will)\s+do|about\s+the\s+role|duties|job\s+description|the\s+role|what\s+you'll\s+be\s+doing|key\s+responsibilities)\s*[:\-—]?$/i,
  other:
    /^(?:benefits|perks|compensation|what\s+we\s+offer|about\s+us|about\s+the\s+company|equal\s+opportunity|interview\s+process|how\s+to\s+apply)\s*[:\-—]?$/i,
};

// Common technical skills dictionary with canonical casing
const TECHNICAL_SKILLS_DICTIONARY = [
  // Languages
  { name: 'JavaScript', regex: /\b(?:javascript|js)\b/i },
  { name: 'TypeScript', regex: /\b(?:typescript|ts)\b/i },
  { name: 'Python', regex: /\bpython\b/i },
  { name: 'Java', regex: /\bjava\b(?!script)/i },
  { name: 'C++', regex: /\bc\+\+\b/i },
  { name: 'C#', regex: /\bc#|\bc\s*sharp\b/i },
  { name: 'Go', regex: /\b(?:golang|go)\b/i },
  { name: 'Rust', regex: /\brust\b/i },
  { name: 'Ruby', regex: /\bruby\b/i },
  { name: 'PHP', regex: /\bphp\b/i },
  { name: 'Swift', regex: /\bswift\b/i },
  { name: 'Kotlin', regex: /\bkotlin\b/i },
  { name: 'SQL', regex: /\bsql\b/i },
  { name: 'HTML5', regex: /\bhtml5?\b/i },
  { name: 'CSS3', regex: /\bcss3?\b/i },
  { name: 'Bash', regex: /\b(?:bash|shell\s+scripting)\b/i },

  // Frontend
  { name: 'React', regex: /\breact(?:\.?js)?\b/i },
  { name: 'React Native', regex: /\breact\s+native\b/i },
  { name: 'Vue.js', regex: /\bvue(?:\.?js)?\b/i },
  { name: 'Angular', regex: /\bangular(?:\.?js)?\b/i },
  { name: 'Next.js', regex: /\bnext(?:\.?js)?\b/i },
  { name: 'Svelte', regex: /\bsvelte\b/i },
  { name: 'Redux', regex: /\bredux\b/i },
  { name: 'Tailwind CSS', regex: /\btailwind(?:\s*css)?\b/i },
  { name: 'Bootstrap', regex: /\bbootstrap\b/i },
  { name: 'Vite', regex: /\bvite\b/i },
  { name: 'Webpack', regex: /\bwebpack\b/i },

  // Backend & APIs
  { name: 'Node.js', regex: /\bnode(?:\.?js)?\b/i },
  { name: 'Express', regex: /\bexpress(?:\.?js)?\b/i },
  { name: 'NestJS', regex: /\bnest(?:\.?js)?\b/i },
  { name: 'FastAPI', regex: /\bfastapi\b/i },
  { name: 'Django', regex: /\bdjango\b/i },
  { name: 'Flask', regex: /\bflask\b/i },
  { name: 'Spring Boot', regex: /\bspring(?:\s+boot)?\b/i },
  { name: 'Ruby on Rails', regex: /\b(?:rails|ruby\s+on\s+rails)\b/i },
  { name: 'GraphQL', regex: /\bgraphql\b/i },
  { name: 'REST APIs', regex: /\b(?:rest|restful)(?:\s+apis?)?\b/i },
  { name: 'gRPC', regex: /\bgrpc\b/i },
  { name: 'Microservices', regex: /\bmicroservices?\b/i },
  { name: 'WebSockets', regex: /\bwebsockets?\b/i },

  // Databases & Caching
  { name: 'PostgreSQL', regex: /\b(?:postgres|postgresql)\b/i },
  { name: 'MySQL', regex: /\bmysql\b/i },
  { name: 'MongoDB', regex: /\bmongodb\b/i },
  { name: 'Redis', regex: /\bredis\b/i },
  { name: 'Cassandra', regex: /\bcassandra\b/i },
  { name: 'DynamoDB', regex: /\bdynamodb\b/i },
  { name: 'Elasticsearch', regex: /\belasticsearch\b/i },
  { name: 'Prisma', regex: /\bprisma\b/i },
  { name: 'Mongoose', regex: /\bmongoose\b/i },

  // Cloud & DevOps
  { name: 'AWS', regex: /\b(?:aws|amazon\s+web\s+services)\b/i },
  { name: 'Azure', regex: /\bazure\b/i },
  { name: 'Google Cloud (GCP)', regex: /\b(?:gcp|google\s+cloud(?:\s+platform)?)\b/i },
  { name: 'Docker', regex: /\bdocker\b/i },
  { name: 'Kubernetes', regex: /\b(?:kubernetes|k8s)\b/i },
  { name: 'Terraform', regex: /\bterraform\b/i },
  { name: 'CI/CD', regex: /\bci[\s/]?cd\b/i },
  { name: 'GitHub Actions', regex: /\bgithub\s+actions\b/i },
  { name: 'Git', regex: /\bgit\b/i },
  { name: 'Linux', regex: /\blinux\b/i },
  { name: 'Serverless', regex: /\bserverless\b/i },
  { name: 'Kafka', regex: /\bkafka\b/i },
  { name: 'RabbitMQ', regex: /\brabbitmq\b/i },

  // AI & Data
  { name: 'Machine Learning', regex: /\bmachine\s+learning|\bml\b/i },
  { name: 'Deep Learning', regex: /\bdeep\s+learning\b/i },
  { name: 'LLMs', regex: /\b(?:llms?|large\s+language\s+models?)\b/i },
  { name: 'LangChain', regex: /\blangchain\b/i },
  { name: 'OpenAI API', regex: /\bopenai(?:\s+api)?\b/i },
  { name: 'PyTorch', regex: /\bpytorch\b/i },
  { name: 'TensorFlow', regex: /\btensorflow\b/i },

  // Practices & Testing
  { name: 'Agile / Scrum', regex: /\b(?:agile|scrum)\b/i },
  { name: 'TDD', regex: /\b(?:tdd|test[- ]driven\s+development)\b/i },
  { name: 'Unit Testing', regex: /\bunit\s+testing\b/i },
  { name: 'System Design', regex: /\bsystem\s+design\b/i },
  { name: 'Distributed Systems', regex: /\bdistributed\s+systems?\b/i },
];

/**
 * Returns default empty parsed requirements object
 */
const getDefaultRequirements = () => ({
  skills: [],
  experience: [],
  qualifications: [],
  niceToHave: [],
});

/**
 * Splits raw job description text into categorized section blocks based on headings
 */
const splitJdIntoSections = (rawText) => {
  const lines = rawText.split('\n');
  const sections = {
    requirements: [],
    niceToHave: [],
    responsibilities: [],
    other: [],
    unclassified: [],
  };

  let currentSection = 'unclassified';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let matchedHeading = false;
    for (const [sectionKey, regex] of Object.entries(SECTION_PATTERNS)) {
      if (regex.test(line)) {
        currentSection = sectionKey;
        matchedHeading = true;
        break;
      }
    }

    if (!matchedHeading) {
      if (sections[currentSection]) {
        sections[currentSection].push(line);
      } else {
        sections.unclassified.push(line);
      }
    }
  }

  return sections;
};

/**
 * Extracts technical and domain skills from text
 */
const extractSkills = (rawText, sectionBlocks) => {
  const matchedSkills = new Set();

  // 1. Dictionary matching across raw text
  for (const skill of TECHNICAL_SKILLS_DICTIONARY) {
    if (skill.regex.test(rawText)) {
      matchedSkills.add(skill.name);
    }
  }

  // 2. Extract bullet points or lists in requirements that mention specific tech tokens
  const relevantLines = [
    ...(sectionBlocks.requirements || []),
    ...(sectionBlocks.niceToHave || []),
  ];

  for (const line of relevantLines) {
    const clean = line.replace(/^[•\-*▪–—\d.)]+\s*/, '').trim();

    // Look for phrases like "Proficiency with X, Y, and Z" or "Experience with X, Y"
    const skillListMatch = clean.match(
      /(?:experience\s+with|proficiency\s+in|knowledge\s+of|skills?\s*[:\-—]|technologies\s*[:\-—])\s*([^.;]+)/i
    );

    if (skillListMatch && skillListMatch[1]) {
      const candidates = skillListMatch[1]
        .split(/[,&/]|\band\b/i)
        .map((s) => s.trim())
        .filter(
          (s) =>
            s.length >= 2 &&
            s.length <= 30 &&
            !/\b(?:years?|experience|strong|excellent)\b/i.test(s)
        );

      for (const candidate of candidates) {
        // Find if candidate matches existing skill dictionary
        const found = TECHNICAL_SKILLS_DICTIONARY.find(
          (item) => item.name.toLowerCase() === candidate.toLowerCase()
        );
        if (found) {
          matchedSkills.add(found.name);
        } else if (
          /^[A-Z][a-zA-Z0-9#+.]*$/.test(candidate) &&
          !['Strong', 'Excellent', 'Good', 'Demonstrated', 'Proven', 'Such', 'Other'].includes(
            candidate
          )
        ) {
          matchedSkills.add(candidate);
        }
      }
    }
  }

  return Array.from(matchedSkills);
};

/**
 * Extracts experience requirements (years of experience, domain tenure)
 */
const extractExperience = (rawText, sectionBlocks) => {
  const experienceEntries = new Set();

  const linesToSearch = [
    ...(sectionBlocks.requirements || []),
    ...(sectionBlocks.unclassified || []),
  ];

  // Regex to match "X+ years of experience in Y" or "X-Y years building Z" (without prematurely splitting on .js)
  const YEARS_EXP_REGEX =
    /(?:(?:at\s+least\s+)?(?:\d{1,2}(?:\s*[-–—+to]+\s*\d{1,2})?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten))\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:hands-on|demonstrated|proven|relevant|practical|professional))?\s+experience[^\n!?;\r]*)/gi;

  for (const line of linesToSearch) {
    const cleanLine = line.replace(/^[•\-*▪–—\d.)]+\s*/, '').trim();
    if (!cleanLine) continue;

    // Direct line check
    const matches = cleanLine.match(YEARS_EXP_REGEX);
    if (matches) {
      for (const m of matches) {
        const trimmedMatch = m.trim().replace(/^[,\s-]+|[,\s-]+$/g, '');
        if (trimmedMatch.length > 5 && trimmedMatch.length < 150) {
          experienceEntries.add(trimmedMatch);
        }
      }
    } else if (
      /\b(?:years?|yrs?)\b/i.test(cleanLine) &&
      /\b(?:experience|background|working|building)\b/i.test(cleanLine) &&
      cleanLine.length < 160
    ) {
      experienceEntries.add(cleanLine);
    }
  }

  // Fallback: If section headings weren't identified, search rawText globally
  if (experienceEntries.size === 0) {
    const globalMatches = rawText.match(YEARS_EXP_REGEX);
    if (globalMatches) {
      for (const m of globalMatches) {
        experienceEntries.add(m.trim().replace(/^[,\s-]+|[,\s-]+$/g, ''));
      }
    }
  }

  return Array.from(experienceEntries);
};

/**
 * Extracts education and qualification requirements
 */
const extractQualifications = (rawText, sectionBlocks) => {
  const qualifications = new Set();

  const linesToSearch = [
    ...(sectionBlocks.requirements || []),
    ...(sectionBlocks.unclassified || []),
  ];

  const DEGREE_REGEX =
    /\b(?:bachelor'?s?|master'?s?|ph\.?d\.?|b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?b\.?a\.?|degree|diploma)\b/i;
  const FIELD_REGEX =
    /\b(?:computer\s+science|software\s+engineering|information\s+technology|data\s+science|stem|engineering|mathematics|related\s+field|equivalent\s+practical\s+experience)\b/i;

  for (const line of linesToSearch) {
    const cleanLine = line.replace(/^[•\-*▪–—\d.)]+\s*/, '').trim();
    if (!cleanLine) continue;

    if (DEGREE_REGEX.test(cleanLine) && (FIELD_REGEX.test(cleanLine) || cleanLine.length < 120)) {
      qualifications.add(cleanLine);
    }
  }

  // Fallback: Search all lines if none found
  if (qualifications.size === 0) {
    const allLines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of allLines) {
      const cleanLine = line.replace(/^[•\-*▪–—\d.)]+\s*/, '').trim();
      if (DEGREE_REGEX.test(cleanLine) && FIELD_REGEX.test(cleanLine)) {
        qualifications.add(cleanLine);
      }
    }
  }

  return Array.from(qualifications);
};

/**
 * Extracts nice-to-have / preferred qualifications
 */
const extractNiceToHave = (rawText, sectionBlocks) => {
  const niceToHaveEntries = new Set();

  // 1. Items directly under niceToHave section block
  if (sectionBlocks.niceToHave && sectionBlocks.niceToHave.length > 0) {
    for (const line of sectionBlocks.niceToHave) {
      const cleanLine = line.replace(/^[•\-*▪–—\d.)]+\s*/, '').trim();
      // Ensure it's not a heading or colon-only line
      if (
        cleanLine &&
        cleanLine.length > 3 &&
        cleanLine.length < 200 &&
        !cleanLine.endsWith(':') &&
        !Object.values(SECTION_PATTERNS).some((p) => p.test(cleanLine))
      ) {
        niceToHaveEntries.add(cleanLine);
      }
    }
  }

  // 2. Search for inline bonus phrases across all sections
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const BONUS_INLINE_REGEX =
    /^(?:bonus(?:\s+points?)?|nice\s+to\s+have|preferred|a\s+plus|plus|ideal(?:\s+if)?)\s*[:\-—]?\s*(.+)$/i;

  for (const line of lines) {
    // Skip lines that match any section header
    if (Object.values(SECTION_PATTERNS).some((p) => p.test(line))) {
      continue;
    }

    const match = line.match(BONUS_INLINE_REGEX);
    if (match && match[1] && match[1].trim().length > 3 && !match[1].trim().endsWith(':')) {
      niceToHaveEntries.add(match[1].trim());
    } else if (
      /\b(?:is\s+a\s+plus|are\s+a\s+plus|bonus\s+if)\b/i.test(line) &&
      line.length < 180 &&
      !line.endsWith(':')
    ) {
      const cleanLine = line.replace(/^[•\-*▪–—\d.)]+\s*/, '').trim();
      if (cleanLine.length > 3) {
        niceToHaveEntries.add(cleanLine);
      }
    }
  }

  return Array.from(niceToHaveEntries);
};

/**
 * Main parser function: extracts structured requirements from raw JD text.
 *
 * @param {string} rawText - Raw text of the job description
 * @returns {Object} - Object matching JobDescription model parsedRequirements
 *                   { skills: string[], experience: string[], qualifications: string[], niceToHave: string[] }
 */
const parseJobDescription = (rawText) => {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return getDefaultRequirements();
  }

  const cleanedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sectionBlocks = splitJdIntoSections(cleanedText);

  const skills = extractSkills(cleanedText, sectionBlocks);
  const experience = extractExperience(cleanedText, sectionBlocks);
  const qualifications = extractQualifications(cleanedText, sectionBlocks);
  const niceToHave = extractNiceToHave(cleanedText, sectionBlocks);

  return {
    skills,
    experience,
    qualifications,
    niceToHave,
  };
};

module.exports = parseJobDescription;
module.exports.parseJobDescription = parseJobDescription;
module.exports.TECHNICAL_SKILLS_DICTIONARY = TECHNICAL_SKILLS_DICTIONARY;
