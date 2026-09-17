const {
  fitScoringNode,
  determineTier,
  generateFitScoreHeuristic,
  parseFitScore,
  buildFitScoringPrompt,
} = require('../../src/agents/nodes/fitScoringNode');

describe('fitScoringNode Service', () => {
  const sampleAtsReport = {
    overallScore: 78,
    matchedKeywords: [
      { keyword: 'Node.js', importance: 'required', location: 'Skills' },
      { keyword: 'TypeScript', importance: 'required', location: 'Skills' },
      { keyword: 'Docker', importance: 'required', location: 'Experience' },
    ],
    missingKeywords: [
      {
        keyword: 'Kubernetes',
        importance: 'required',
        suggestion: 'Highlight container orchestration experience.',
      },
      {
        keyword: 'GraphQL',
        importance: 'preferred',
        suggestion: 'Mention any API experience with GraphQL.',
      },
      {
        keyword: 'Terraform',
        importance: 'bonus',
        suggestion: 'Optional: mention infrastructure-as-code.',
      },
    ],
  };

  const sampleResume = {
    contact: { name: 'Alex Johnson' },
    skills: ['Node.js', 'TypeScript', 'Docker', 'PostgreSQL'],
    summary: 'Experienced Backend Engineer with 5+ years building microservices.',
    experience: [
      {
        title: 'Senior Engineer',
        company: 'CloudScale',
        bulletPoints: ['Reduced API response latency by 42% through query optimization.'],
      },
    ],
    education: [
      {
        degree: 'Bachelor of Science in Computer Science',
        institution: 'UC Berkeley',
      },
    ],
  };

  const sampleJD = {
    roleTitle: 'Senior Backend Engineer',
    company: 'NextGen Tech',
    requiredSkills: ['Node.js', 'TypeScript', 'Kubernetes'],
    niceToHave: ['GraphQL', 'Terraform'],
    experience: ['5+ years software engineering experience'],
    qualifications: ["Bachelor's degree in Computer Science or equivalent"],
  };

  const sampleTailoredBullets = [
    {
      originalBullet: 'Optimized SQL queries.',
      tailoredBullet:
        'Engineered high-performance microservices reducing latency by 42% for 2M daily active users.',
    },
  ];

  describe('determineTier', () => {
    it("should return 'strong' for scores 80 and above", () => {
      expect(determineTier(100)).toBe('strong');
      expect(determineTier(85)).toBe('strong');
      expect(determineTier(80)).toBe('strong');
    });

    it("should return 'moderate' for scores between 60 and 79", () => {
      expect(determineTier(79)).toBe('moderate');
      expect(determineTier(70)).toBe('moderate');
      expect(determineTier(60)).toBe('moderate');
    });

    it("should return 'stretch' for scores below 60", () => {
      expect(determineTier(59)).toBe('stretch');
      expect(determineTier(40)).toBe('stretch');
      expect(determineTier(0)).toBe('stretch');
    });
  });

  describe('generateFitScoreHeuristic', () => {
    it('should compute deterministic score, tier, itemized gaps, and strengths', () => {
      const result = generateFitScoreHeuristic({
        atsReport: sampleAtsReport,
        structuredResume: sampleResume,
        structuredJD: sampleJD,
        tailoredBullets: sampleTailoredBullets,
      });

      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(['strong', 'moderate', 'stretch']).toContain(result.tier);

      // Verify gaps
      expect(Array.isArray(result.gaps)).toBe(true);
      expect(result.gaps.length).toBe(3);

      const k8sGap = result.gaps.find((g) => g.skill === 'Kubernetes');
      expect(k8sGap).toBeDefined();
      expect(k8sGap.severity).toBe('high');

      const graphqlGap = result.gaps.find((g) => g.skill === 'GraphQL');
      expect(graphqlGap).toBeDefined();
      expect(graphqlGap.severity).toBe('medium');

      const terraformGap = result.gaps.find((g) => g.skill === 'Terraform');
      expect(terraformGap).toBeDefined();
      expect(terraformGap.severity).toBe('low');

      // Verify strengths
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(result.strengths.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('parseFitScore', () => {
    it('should parse valid JSON object string', () => {
      const jsonString = JSON.stringify({
        score: 87,
        tier: 'strong',
        gaps: [
          {
            skill: 'Kubernetes',
            severity: 'high',
            suggestion: 'Build a sample cluster.',
          },
        ],
        strengths: ['5+ years Node.js experience'],
      });

      const parsed = parseFitScore(jsonString);
      expect(parsed.score).toBe(87);
      expect(parsed.tier).toBe('strong');
      expect(parsed.gaps.length).toBe(1);
      expect(parsed.strengths).toContain('5+ years Node.js experience');
    });

    it('should parse JSON wrapped in markdown code fence', () => {
      const fenced = '```json\n{"score": 75, "tier": "moderate", "gaps": [], "strengths": ["Strong coding ability"]}\n```';
      const parsed = parseFitScore(fenced);
      expect(parsed.score).toBe(75);
      expect(parsed.tier).toBe('moderate');
      expect(parsed.strengths).toContain('Strong coding ability');
    });

    it('should clamp score to [0, 100]', () => {
      expect(parseFitScore(JSON.stringify({ score: 150 })).score).toBe(100);
      expect(parseFitScore(JSON.stringify({ score: -20 })).score).toBe(0);
    });

    it('should fallback to heuristic when given invalid/malformed JSON string', () => {
      const fallbackParams = {
        atsReport: sampleAtsReport,
        structuredResume: sampleResume,
        structuredJD: sampleJD,
        tailoredBullets: sampleTailoredBullets,
      };

      const parsed = parseFitScore('This is not json at all', fallbackParams);
      expect(typeof parsed.score).toBe('number');
      expect(['strong', 'moderate', 'stretch']).toContain(parsed.tier);
      expect(parsed.gaps.length).toBeGreaterThan(0);
    });
  });

  describe('buildFitScoringPrompt', () => {
    it('should construct human prompt with candidate details, target role, and ATS data', () => {
      const prompt = buildFitScoringPrompt({
        candidateName: 'Alex Johnson',
        roleTitle: 'Senior Backend Engineer',
        company: 'NextGen Tech',
        atsReport: sampleAtsReport,
        structuredResume: sampleResume,
        structuredJD: sampleJD,
        tailoredBullets: sampleTailoredBullets,
      });

      expect(prompt).toContain('Alex Johnson');
      expect(prompt).toContain('Senior Backend Engineer');
      expect(prompt).toContain('NextGen Tech');
      expect(prompt).toContain('78%');
      expect(prompt).toContain('Node.js');
      expect(prompt).toContain('Kubernetes');
    });
  });

  describe('fitScoringNode execution with Mocked LLM', () => {
    it('should invoke mocked LLM and return structured fitScore', async () => {
      const mockLlmResponse = {
        content: JSON.stringify({
          score: 86,
          tier: 'strong',
          gaps: [
            {
              skill: 'Kubernetes',
              severity: 'high',
              suggestion: 'Obtain CKA or build container deployment workflows.',
            },
          ],
          strengths: [
            '5+ years verified backend experience with Node.js and TypeScript',
            'Proven track record optimizing query latency by 42%',
          ],
        }),
      };

      const mockLLM = {
        invoke: jest.fn().mockResolvedValue(mockLlmResponse),
      };

      const state = {
        structuredResume: sampleResume,
        structuredJD: sampleJD,
        atsReport: sampleAtsReport,
        tailoredBullets: sampleTailoredBullets,
      };

      const result = await fitScoringNode(state, { llm: mockLLM });

      expect(mockLLM.invoke).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('fit_scored');
      expect(result.fitScore).toBeDefined();
      expect(result.fitScore.score).toBe(86);
      expect(result.fitScore.tier).toBe('strong');
      expect(result.fitScore.gaps.length).toBe(1);
      expect(result.fitScore.gaps[0].skill).toBe('Kubernetes');
      expect(result.fitScore.strengths.length).toBe(2);
    });

    it('should fallback gracefully to heuristic if mocked LLM throws an error', async () => {
      const failingMockLLM = {
        invoke: jest.fn().mockRejectedValue(new Error('LLM rate limit exceeded')),
      };

      const state = {
        structuredResume: sampleResume,
        structuredJD: sampleJD,
        atsReport: sampleAtsReport,
        tailoredBullets: sampleTailoredBullets,
      };

      const result = await fitScoringNode(state, { llm: failingMockLLM, allowFallback: true });

      expect(failingMockLLM.invoke).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('fit_scored');
      expect(result.fitScore).toBeDefined();
      expect(typeof result.fitScore.score).toBe('number');
      expect(['strong', 'moderate', 'stretch']).toContain(result.fitScore.tier);
    });
  });
});
