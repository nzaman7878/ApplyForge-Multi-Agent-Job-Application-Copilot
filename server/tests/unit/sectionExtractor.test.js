const extractSections = require('../../src/services/parsers/sectionExtractor');
const { getDefaultSections } = extractSections;

describe('sectionExtractor Service', () => {
  describe('getDefaultSections', () => {
    it('should return a standard empty resume schema', () => {
      const defaults = getDefaultSections();
      expect(defaults).toEqual({
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
    });
  });

  describe('extractSections with complete structured resume', () => {
    const fullResumeText = `
Alex R. Johnson
alex.johnson@example.com | (555) 234-5678 | San Francisco, CA
https://linkedin.com/in/alexjohnson | https://github.com/alexjohnson | https://alexjohnson.dev

PROFESSIONAL SUMMARY
Senior Full-Stack Engineer with over 6 years of expertise building scalable cloud applications, distributed microservices, and AI-driven automation pipelines. Strong foundation in React, Node.js, and TypeScript.

TECHNICAL SKILLS
Languages & Frameworks: JavaScript, TypeScript, Python, Node.js, React, Next.js, Express
Databases & Cloud: MongoDB, PostgreSQL, Redis, AWS, Docker, Kubernetes
Tools & Methods: Git, CI/CD, Agile, Microservices, REST APIs, GraphQL

WORK EXPERIENCE
Senior Full-Stack Engineer at TechFlow Inc.
03/2021 - Present | San Francisco, CA
• Architected event-driven microservices serving 2M+ monthly active users with 99.99% uptime.
• Reduced API response latency by 42% through optimized MongoDB aggregations and Redis caching.
• Led a cross-functional squad of 5 engineers delivering high-impact features ahead of sprint deadlines.

Software Engineer at CloudScale Solutions
06/2018 - 02/2021 | Austin, TX
• Developed and maintained customer-facing React components with Tailwind CSS.
• Implemented automated CI/CD pipelines reducing deployment failure rates by 25%.

EDUCATION
University of California, Berkeley
Bachelor of Science in Computer Science
09/2014 - 05/2018 | GPA: 3.82
Dean's Honors List

CERTIFICATIONS
AWS Certified Solutions Architect - Associate | 2023 | https://aws.amazon.com/verify/12345
Certified Kubernetes Administrator (CKA) | 2022
`;

    it('should extract contact information accurately', () => {
      const parsed = extractSections(fullResumeText);
      expect(parsed.contact.name).toBe('Alex R. Johnson');
      expect(parsed.contact.email).toBe('alex.johnson@example.com');
      expect(parsed.contact.phone).toBe('(555) 234-5678');
      expect(parsed.contact.location).toBe('San Francisco, CA');
      expect(parsed.contact.linkedin).toBe('https://linkedin.com/in/alexjohnson');
      expect(parsed.contact.github).toBe('https://github.com/alexjohnson');
      expect(parsed.contact.portfolio).toBe('https://alexjohnson.dev');
    });

    it('should extract professional summary', () => {
      const parsed = extractSections(fullResumeText);
      expect(parsed.summary).toContain('Senior Full-Stack Engineer with over 6 years');
      expect(parsed.summary).toContain('React, Node.js, and TypeScript');
    });

    it('should extract and clean technical skills', () => {
      const parsed = extractSections(fullResumeText);
      expect(Array.isArray(parsed.skills)).toBe(true);
      expect(parsed.skills.length).toBeGreaterThanOrEqual(8);
      const skillText = parsed.skills.join(', ');
      expect(skillText).toContain('React');
      expect(skillText).toContain('Node.js');
      expect(skillText).toContain('TypeScript');
      expect(skillText).toContain('MongoDB');
      expect(skillText).toContain('Docker');
    });

    it('should extract work experience with titles, dates, current status, and bullets', () => {
      const parsed = extractSections(fullResumeText);
      expect(Array.isArray(parsed.experience)).toBe(true);
      expect(parsed.experience.length).toBe(2);

      const [job1, job2] = parsed.experience;

      expect(job1.title).toContain('Senior Full-Stack Engineer');
      expect(job1.company).toContain('TechFlow');
      expect(job1.current).toBe(true);
      expect(job1.endDate).toBe('Present');
      expect(job1.bulletPoints.length).toBe(3);
      expect(job1.bulletPoints[0]).toContain('Architected event-driven microservices');

      expect(job2.title).toContain('Software Engineer');
      expect(job2.company).toContain('CloudScale');
      expect(job2.current).toBe(false);
      expect(job2.bulletPoints.length).toBe(2);
    });

    it('should extract education entries with institution, degree, field of study, and GPA', () => {
      const parsed = extractSections(fullResumeText);
      expect(Array.isArray(parsed.education)).toBe(true);
      expect(parsed.education.length).toBe(1);

      const edu = parsed.education[0];
      expect(edu.institution).toContain('University of California, Berkeley');
      expect(edu.degree).toContain('Bachelor of Science');
      expect(edu.fieldOfStudy).toContain('Computer Science');
      expect(edu.gpa).toBe('3.82');
      expect(edu.honors.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract certifications with name, date, and URL', () => {
      const parsed = extractSections(fullResumeText);
      expect(Array.isArray(parsed.certifications)).toBe(true);
      expect(parsed.certifications.length).toBe(2);

      const awsCert = parsed.certifications.find((c) => c.name.includes('AWS'));
      expect(awsCert).toBeDefined();
      expect(awsCert.date).toBe('2023');
      expect(awsCert.url).toContain('https://aws.amazon.com/verify/12345');

      const ckaCert = parsed.certifications.find((c) => c.name.includes('CKA') || c.name.includes('Kubernetes'));
      expect(ckaCert).toBeDefined();
      expect(ckaCert.date).toBe('2022');
    });
  });

  describe('edge cases and fallbacks', () => {
    it('should return default empty structure for null, empty, or non-string inputs', () => {
      expect(extractSections('')).toEqual(getDefaultSections());
      expect(extractSections(null)).toEqual(getDefaultSections());
      expect(extractSections(undefined)).toEqual(getDefaultSections());
      expect(extractSections(12345)).toEqual(getDefaultSections());
    });

    it('should handle unformatted text without section headers gracefully', () => {
      const unformatted = `
Johnathan Doe
johnathan@testcorp.com | (123) 456-7890
Self-taught developer looking for junior frontend roles.
Passionate about web standards and user experience.
`;
      const parsed = extractSections(unformatted);
      expect(parsed.contact.name).toBe('Johnathan Doe');
      expect(parsed.contact.email).toBe('johnathan@testcorp.com');
      expect(parsed.contact.phone).toBe('(123) 456-7890');
      expect(parsed.summary).toBeDefined();
    });

    it('should prefix https:// to bare linkedin and github domains', () => {
      const text = `
Alice Wonder
alice@wonderland.org
linkedin.com/in/alicewonder
github.com/alicewonder
`;
      const parsed = extractSections(text);
      expect(parsed.contact.linkedin).toBe('https://linkedin.com/in/alicewonder');
      expect(parsed.contact.github).toBe('https://github.com/alicewonder');
    });
  });
});
