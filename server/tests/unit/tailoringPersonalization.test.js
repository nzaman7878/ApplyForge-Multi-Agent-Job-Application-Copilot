const {
  buildTailoringSystemPrompt,
  formatStyleExamplesForPrompt,
  resumeTailoringNode,
  TAILORING_SYSTEM_PROMPT,
} = require('../../src/agents/nodes/resumeTailoringNode');
const { formatStyleExamplesForPrompt: serviceFormat } = require('../../src/services/voiceLearning');

describe('Phase 104 Voice Learning: Tailoring Personalization Unit Tests', () => {
  const sampleStyleExamples = [
    {
      id: 'edit-1',
      company: 'Stripe',
      roleTitle: 'Senior Backend Engineer',
      original: 'Developed APIs using Node.js and MongoDB.',
      edited: 'Architected high-throughput payment processing microservices using Node.js and PostgreSQL, slashing p99 latency by 40%.',
      diff: {
        actionVerbChanged: true,
        originalVerb: 'Developed',
        editedVerb: 'Architected',
        wordCountDelta: 8,
      },
    },
    {
      id: 'edit-2',
      company: 'Datadog',
      roleTitle: 'Infrastructure Engineer',
      original: 'Helped team with Kubernetes cluster monitoring.',
      edited: 'Spearheaded distributed observability across 200+ Kubernetes nodes using Prometheus and OpenTelemetry.',
      diff: {
        actionVerbChanged: true,
        originalVerb: 'Helped',
        editedVerb: 'Spearheaded',
        wordCountDelta: 5,
      },
    },
  ];

  describe('formatStyleExamplesForPrompt', () => {
    it('should return an empty string when given an empty or non-array input', () => {
      expect(formatStyleExamplesForPrompt([])).toBe('');
      expect(formatStyleExamplesForPrompt(null)).toBe('');
      expect(formatStyleExamplesForPrompt(undefined)).toBe('');
    });

    it('should format approved user revisions into clear numbered style examples', () => {
      const formatted = formatStyleExamplesForPrompt(sampleStyleExamples);

      expect(formatted).toContain("CANDIDATE'S PERSONAL VOICE & STYLE EXAMPLES");
      expect(formatted).toContain('[Style Example 1] (Senior Backend Engineer at Stripe)');
      expect(formatted).toContain('- Original Draft: "Developed APIs using Node.js and MongoDB."');
      expect(formatted).toContain('- Candidate\'s Approved Revision: "Architected high-throughput payment processing microservices');
      expect(formatted).toContain('[Style Example 2] (Infrastructure Engineer at Datadog)');
      expect(formatted).toContain('- Candidate\'s Approved Revision: "Spearheaded distributed observability');
      expect(formatted).toContain('VOICE & TONE GUIDELINES DERIVED FROM CANDIDATE EDITS');
    });

    it('should cap formatting at a maximum of 10 examples', () => {
      const elevenExamples = Array.from({ length: 15 }, (_, i) => ({
        id: `edit-${i + 1}`,
        original: `Original draft bullet number ${i + 1}`,
        edited: `Candidate polished revision number ${i + 1}`,
      }));

      const formatted = formatStyleExamplesForPrompt(elevenExamples);
      expect(formatted).toContain('[Style Example 10]');
      expect(formatted).not.toContain('[Style Example 11]');
    });
  });

  describe('buildTailoringSystemPrompt', () => {
    it('should return standard TAILORING_SYSTEM_PROMPT when no style examples exist', () => {
      const prompt = buildTailoringSystemPrompt([]);
      expect(prompt).toBe(TAILORING_SYSTEM_PROMPT);
      expect(prompt).not.toContain("CANDIDATE'S PERSONAL VOICE & STYLE EXAMPLES");
    });

    it('should append voice learning style examples and guidelines when provided', () => {
      const prompt = buildTailoringSystemPrompt(sampleStyleExamples);

      expect(prompt).toContain(TAILORING_SYSTEM_PROMPT);
      expect(prompt).toContain("CANDIDATE'S PERSONAL VOICE & STYLE EXAMPLES");
      expect(prompt).toContain('Architected high-throughput payment processing microservices');
      expect(prompt).toContain('Spearheaded distributed observability');
      expect(prompt).toContain('Emulate the candidate\'s action verb preferences');
    });
  });

  describe('resumeTailoringNode with Voice Learning Style Examples Injection', () => {
    it('should inject style examples into the LLM system message', async () => {
      let capturedMessages = null;

      // Mock LLM client capturing invocation messages
      const mockLLM = {
        invoke: async (messages) => {
          capturedMessages = messages;
          return JSON.stringify({
            bullets: [
              {
                originalBullet: 'Built customer authentication service.',
                tailoredBullet: 'Architected secure OAuth2 customer authentication service with Redis session caching.',
                reasoning: 'Adopted candidate preferred action verb Architected and emphasized target security skills.',
              },
            ],
          });
        },
      };

      const testState = {
        structuredResume: {
          allBulletPoints: [
            {
              id: 'b1',
              text: 'Built customer authentication service.',
            },
          ],
        },
        structuredJD: {
          company: 'Acme Corp',
          roleTitle: 'Staff Security Engineer',
          requiredSkills: ['OAuth2', 'Redis'],
        },
        styleExamples: sampleStyleExamples,
      };

      const result = await resumeTailoringNode(testState, { llm: mockLLM });

      expect(result.status).toBe('tailored');
      expect(result.tailoredBullets.length).toBe(1);
      expect(result.styleExamples).toEqual(sampleStyleExamples);

      // Verify captured system prompt in LLM call
      expect(capturedMessages).toBeDefined();
      expect(capturedMessages.length).toBe(2);

      const systemMsg = capturedMessages[0];
      expect(systemMsg.content).toContain("CANDIDATE'S PERSONAL VOICE & STYLE EXAMPLES");
      expect(systemMsg.content).toContain('Architected high-throughput payment processing microservices');
      expect(systemMsg.content).toContain('Spearheaded distributed observability');
    });

    it('should use candidate action verb from style examples in heuristic fallback', async () => {
      const testState = {
        structuredResume: {
          allBulletPoints: [
            {
              id: 'b1',
              text: 'Built customer authentication service.',
            },
          ],
        },
        structuredJD: {
          company: 'Acme Corp',
          roleTitle: 'Staff Security Engineer',
          requiredSkills: ['OAuth2', 'Redis'],
        },
        styleExamples: sampleStyleExamples,
      };

      // Force fallback by providing a failing LLM client
      const failingLLM = {
        invoke: async () => {
          throw new Error('LLM service rate limited');
        },
      };

      const result = await resumeTailoringNode(testState, {
        llm: failingLLM,
        allowFallback: true,
      });

      expect(result.status).toBe('tailored');
      expect(result.tailoredBullets.length).toBe(1);
      const tailoredText = result.tailoredBullets[0].tailoredBullet;
      // Heuristic incorporates preferred action verb 'Architected' from style example
      expect(tailoredText.startsWith('Architected')).toBe(true);
      expect(result.styleExamples).toHaveLength(2);
    });
  });
});
