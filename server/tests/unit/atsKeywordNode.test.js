const {
  atsKeywordNode,
  extractWeightedKeywords,
  locateKeywordInResume,
  generateSuggestion,
  calculateOverallScore,
  DEFAULT_KEYWORD_WEIGHTS,
} = require('../../src/agents/nodes/atsKeywordNode');

describe('atsKeywordNode Service', () => {
  const sampleJD = {
    company: 'CloudScale AI',
    roleTitle: 'Senior Full-Stack Engineer',
    requiredSkills: ['Node.js', 'PostgreSQL', 'Docker', 'TypeScript'],
    niceToHave: [
      'GraphQL',
      'Kubernetes is preferred',
      'AWS certification is a bonus',
      'Kafka is a plus',
    ],
    rawText: 'Looking for a Senior Engineer. Bonus: Terraform, Golang.',
  };

  const sampleResume = {
    skills: ['JavaScript', 'TypeScript', 'Node.js', 'PostgreSQL'],
    summary: 'Senior Cloud Architect with extensive background in distributed microservices.',
    experience: [
      {
        title: 'Principal Engineer',
        company: 'ScaleForce',
        bulletPoints: [
          'Engineered event-driven pipeline utilizing Kafka and Redis.',
          'Containerized deployment workflows with Docker.',
        ],
      },
    ],
    education: [
      {
        degree: 'Master of Science',
        fieldOfStudy: 'Computer Science',
        institution: 'Stanford University',
      },
    ],
    certifications: [
      {
        name: 'AWS Certified Solutions Architect - Professional',
        issuer: 'Amazon Web Services',
      },
    ],
  };

  describe('extractWeightedKeywords', () => {
    it('should categorize required skills with weight 3', () => {
      const keywords = extractWeightedKeywords(sampleJD, sampleJD.rawText);
      const required = keywords.filter((k) => k.importance === 'required');

      expect(required.length).toBe(4);
      expect(required.map((k) => k.keyword)).toEqual(
        expect.arrayContaining(['Node.js', 'PostgreSQL', 'Docker', 'TypeScript'])
      );
      expect(required.every((k) => k.weight === DEFAULT_KEYWORD_WEIGHTS.required)).toBe(true);
    });

    it('should categorize preferred skills with weight 2 and strip trailing cosmetic labels', () => {
      const keywords = extractWeightedKeywords(sampleJD, sampleJD.rawText);
      const preferred = keywords.filter((k) => k.importance === 'preferred');

      expect(preferred.some((k) => k.keyword === 'GraphQL')).toBe(true);
      expect(preferred.some((k) => k.keyword === 'Kubernetes')).toBe(true);
      expect(preferred.every((k) => k.weight === DEFAULT_KEYWORD_WEIGHTS.preferred)).toBe(true);
    });

    it('should identify bonus competencies from phrases and rawText with weight 1', () => {
      const keywords = extractWeightedKeywords(sampleJD, sampleJD.rawText);
      const bonus = keywords.filter((k) => k.importance === 'bonus');

      expect(bonus.some((k) => k.keyword.toLowerCase().includes('aws'))).toBe(true);
      expect(bonus.some((k) => k.keyword === 'Kafka')).toBe(true);
      expect(bonus.some((k) => k.keyword.toLowerCase().includes('terraform'))).toBe(true);
      expect(bonus.every((k) => k.weight === DEFAULT_KEYWORD_WEIGHTS.bonus)).toBe(true);
    });

    it('should deduplicate keywords case-insensitively', () => {
      const jdWithDuplicates = {
        requiredSkills: ['React', 'react', 'REACT'],
        niceToHave: ['React is preferred'],
      };
      const keywords = extractWeightedKeywords(jdWithDuplicates);
      const reactMatches = keywords.filter((k) => k.keyword.toLowerCase() === 'react');
      expect(reactMatches.length).toBe(1);
    });
  });

  describe('locateKeywordInResume', () => {
    it('should locate keywords in the Skills section', () => {
      expect(locateKeywordInResume('Node.js', sampleResume)).toBe('Skills');
      expect(locateKeywordInResume('TypeScript', sampleResume)).toBe('Skills');
    });

    it('should locate keywords in the Experience section', () => {
      expect(locateKeywordInResume('Kafka', sampleResume)).toBe('Experience');
      expect(locateKeywordInResume('Docker', sampleResume)).toBe('Experience');
    });

    it('should locate keywords in the Summary section', () => {
      expect(locateKeywordInResume('microservices', sampleResume)).toBe('Summary');
    });

    it('should locate keywords in Education and Certifications sections', () => {
      expect(locateKeywordInResume('Computer Science', sampleResume)).toBe('Education');
      expect(locateKeywordInResume('AWS', sampleResume)).toBe('Certifications');
    });

    it('should locate keywords in Tailored Bullets', () => {
      const tailoredBullets = [
        { tailoredBullet: 'Architected automated deployment clusters using Kubernetes.' },
      ];
      expect(locateKeywordInResume('Kubernetes', sampleResume, tailoredBullets)).toBe(
        'Tailored Bullets'
      );
    });

    it('should respect word boundaries and not match substrings (e.g. Java in JavaScript)', () => {
      expect(locateKeywordInResume('Java', sampleResume)).toBeNull();
    });

    it('should return null when keyword is completely absent from resume', () => {
      expect(locateKeywordInResume('Ruby on Rails', sampleResume)).toBeNull();
    });
  });

  describe('calculateOverallScore', () => {
    it('should calculate weighted score based on matched and missing keywords', () => {
      const matched = [
        { keyword: 'Node.js', importance: 'required' }, // 3
        { keyword: 'TypeScript', importance: 'required' }, // 3
        { keyword: 'Docker', importance: 'required' }, // 3
        { keyword: 'Kafka', importance: 'preferred' }, // 2
      ]; // Matched = 11

      const missing = [
        { keyword: 'PostgreSQL', importance: 'required' }, // 3
        { keyword: 'GraphQL', importance: 'preferred' }, // 2
        { keyword: 'Terraform', importance: 'bonus' }, // 1
      ]; // Missing = 6. Total = 17. 11/17 = 64.7% -> 65

      const score = calculateOverallScore(matched, missing);
      expect(score).toBe(65);
    });

    it('should return 100 when all keywords are matched', () => {
      const matched = [{ keyword: 'React', importance: 'required' }];
      expect(calculateOverallScore(matched, [])).toBe(100);
    });

    it('should return 0 when zero keywords are matched', () => {
      const missing = [{ keyword: 'React', importance: 'required' }];
      expect(calculateOverallScore([], missing)).toBe(0);
    });

    it('should return 100 when both matched and missing are empty', () => {
      expect(calculateOverallScore([], [])).toBe(100);
    });
  });

  describe('generateSuggestion', () => {
    it('should generate high priority suggestion for required skills', () => {
      const suggestion = generateSuggestion('PostgreSQL', 'required');
      expect(suggestion).toContain('High priority');
      expect(suggestion).toContain('PostgreSQL');
    });

    it('should generate recommended suggestion for preferred skills', () => {
      const suggestion = generateSuggestion('GraphQL', 'preferred');
      expect(suggestion).toContain('Recommended');
      expect(suggestion).toContain('GraphQL');
    });

    it('should generate optional suggestion for bonus skills', () => {
      const suggestion = generateSuggestion('Terraform', 'bonus');
      expect(suggestion).toContain('Optional');
      expect(suggestion).toContain('Terraform');
    });
  });

  describe('atsKeywordNode agent execution', () => {
    it('should generate a comprehensive ATS report conforming to schema', async () => {
      const state = {
        resumeSections: sampleResume,
        jdRequirements: sampleJD,
      };

      const result = await atsKeywordNode(state);

      expect(result.status).toBe('ats_analyzed');
      expect(result.atsReport).toBeDefined();

      const { matchedKeywords, missingKeywords, overallScore } = result.atsReport;

      expect(Array.isArray(matchedKeywords)).toBe(true);
      expect(Array.isArray(missingKeywords)).toBe(true);
      expect(typeof overallScore).toBe('number');
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(100);

      // Validate matched keyword shape
      expect(matchedKeywords.length).toBeGreaterThan(0);
      for (const m of matchedKeywords) {
        expect(m).toHaveProperty('keyword');
        expect(m).toHaveProperty('importance');
        expect(m).toHaveProperty('location');
      }

      // Validate missing keyword shape
      expect(missingKeywords.length).toBeGreaterThan(0);
      for (const miss of missingKeywords) {
        expect(miss).toHaveProperty('keyword');
        expect(miss).toHaveProperty('importance');
        expect(miss).toHaveProperty('suggestion');
        expect(miss.suggestion).toContain(miss.keyword);
      }
    });
  });
});
