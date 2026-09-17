const parseJobDescription = require('../../src/services/parsers/jdParser');
const { TECHNICAL_SKILLS_DICTIONARY } = parseJobDescription;

describe('jdParser Service', () => {
  const structuredJdText = `
Role: Senior Full-Stack Engineer
Company: CloudScale AI
Location: San Francisco, CA (Remote Friendly)

ABOUT THE ROLE:
CloudScale AI is building the next generation of developer productivity tools. We are seeking an exceptional Senior Full-Stack Engineer to scale our distributed systems and client applications.

RESPONSIBILITIES:
- Architect, build, and maintain scalable microservices handling millions of API requests daily.
- Develop intuitive user interfaces using React, Next.js, and Tailwind CSS.
- Collaborate with product and design teams in an Agile sprint cadence.
- Ensure high code quality through automated unit testing and CI/CD pipelines.

MINIMUM QUALIFICATIONS:
- 5+ years of software engineering experience building production applications.
- At least 3 years of hands-on experience with Node.js and TypeScript.
- Strong proficiency in React, PostgreSQL, Redis, and RESTful APIs.
- Bachelor's degree in Computer Science, Engineering, or equivalent practical experience.
- Solid understanding of data structures, algorithms, and distributed systems.

PREFERRED QUALIFICATIONS:
- Experience with Docker, Kubernetes, and AWS (ECS, S3, RDS).
- Familiarity with GraphQL and WebSockets is a plus.
- Background in LangChain or building LLM-powered applications.
- Demonstrated experience in Test-Driven Development (TDD).
`;

  describe('parseJobDescription with structured JD', () => {
    it('should extract canonical skills matching the skills dictionary', () => {
      const parsed = parseJobDescription(structuredJdText);

      expect(Array.isArray(parsed.skills)).toBe(true);
      expect(parsed.skills).toContain('Node.js');
      expect(parsed.skills).toContain('TypeScript');
      expect(parsed.skills).toContain('React');
      expect(parsed.skills).toContain('Next.js');
      expect(parsed.skills).toContain('PostgreSQL');
      expect(parsed.skills).toContain('Redis');
      expect(parsed.skills).toContain('Docker');
      expect(parsed.skills).toContain('Kubernetes');
      expect(parsed.skills).toContain('AWS');
    });

    it('should extract experience requirements including tenure and years of experience', () => {
      const parsed = parseJobDescription(structuredJdText);

      expect(Array.isArray(parsed.experience)).toBe(true);
      expect(parsed.experience.length).toBeGreaterThanOrEqual(2);

      const has5Years = parsed.experience.some((e) => e.includes('5+') || e.includes('5 years'));
      const has3Years = parsed.experience.some((e) => e.includes('3 years'));

      expect(has5Years).toBe(true);
      expect(has3Years).toBe(true);
    });

    it('should extract education and qualifications', () => {
      const parsed = parseJobDescription(structuredJdText);

      expect(Array.isArray(parsed.qualifications)).toBe(true);
      expect(parsed.qualifications.length).toBeGreaterThanOrEqual(1);

      const hasDegree = parsed.qualifications.some((q) =>
        /bachelor|computer\s+science/i.test(q)
      );
      expect(hasDegree).toBe(true);
    });

    it('should extract nice-to-have / preferred qualifications', () => {
      const parsed = parseJobDescription(structuredJdText);

      expect(Array.isArray(parsed.niceToHave)).toBe(true);
      expect(parsed.niceToHave.length).toBeGreaterThanOrEqual(2);

      const hasPreferredSkill = parsed.niceToHave.some((item) =>
        /docker|kubernetes|aws|graphql|langchain/i.test(item)
      );
      expect(hasPreferredSkill).toBe(true);
    });
  });

  describe('parseJobDescription with freeform text', () => {
    it('should extract requirements from text without standard headers', () => {
      const freeform = `
We are looking for a Python and FastAPI engineer with 4+ years of backend experience.
Must hold a BS in Computer Science or Software Engineering.
Experience with PostgreSQL and Docker is essential.
Bonus points if you know Kubernetes or machine learning models.
`;
      const parsed = parseJobDescription(freeform);

      expect(parsed.skills).toContain('Python');
      expect(parsed.skills).toContain('FastAPI');
      expect(parsed.skills).toContain('PostgreSQL');
      expect(parsed.skills).toContain('Docker');
      expect(parsed.experience.length).toBeGreaterThanOrEqual(1);
      expect(parsed.qualifications.length).toBeGreaterThanOrEqual(1);
      expect(parsed.niceToHave.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edge cases and fallbacks', () => {
    it('should return empty arrays for null, undefined, empty string, or non-strings', () => {
      const emptyResult = {
        skills: [],
        experience: [],
        qualifications: [],
        niceToHave: [],
      };

      expect(parseJobDescription('')).toEqual(emptyResult);
      expect(parseJobDescription('   ')).toEqual(emptyResult);
      expect(parseJobDescription(null)).toEqual(emptyResult);
      expect(parseJobDescription(undefined)).toEqual(emptyResult);
      expect(parseJobDescription(12345)).toEqual(emptyResult);
      expect(parseJobDescription({})).toEqual(emptyResult);
    });

    it('should export TECHNICAL_SKILLS_DICTIONARY with comprehensive skills list', () => {
      expect(Array.isArray(TECHNICAL_SKILLS_DICTIONARY)).toBe(true);
      expect(TECHNICAL_SKILLS_DICTIONARY.length).toBeGreaterThanOrEqual(30);

      const jsSkill = TECHNICAL_SKILLS_DICTIONARY.find((s) => s.name === 'JavaScript');
      expect(jsSkill).toBeDefined();
      expect(jsSkill.regex).toBeInstanceOf(RegExp);
    });
  });
});
