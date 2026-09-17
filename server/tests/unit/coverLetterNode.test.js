const {
  coverLetterNode,
  parseCoverLetter,
  generateCoverLetterHeuristic,
  buildCoverLetterPrompt,
} = require('../../src/agents/nodes/coverLetterNode');

describe('coverLetterNode Service', () => {
  const sampleCandidate = {
    contact: { name: 'Sarah Connor' },
    summary: 'Senior Distributed Systems Engineer with 7 years experience building scalable backend platforms.',
    skills: ['Go', 'Kubernetes', 'Docker', 'PostgreSQL', 'gRPC'],
    allBulletPoints: [
      'Architected distributed event-driven data pipeline handling 100k events/sec with 99.99% uptime.',
      'Reduced deployment latency by 60% through automated Kubernetes operator pipelines.',
    ],
  };

  const sampleJD = {
    roleTitle: 'Staff Backend Infrastructure Engineer',
    company: 'Cyberdyne Systems',
    requiredSkills: ['Go', 'Kubernetes', 'Distributed Systems'],
    niceToHave: ['gRPC', 'Terraform'],
    experience: ['6+ years backend infrastructure experience'],
  };

  const sampleTailoredBullets = [
    {
      tailoredBullet:
        'Architected distributed event-driven data pipeline handling 100k events/sec with 99.99% uptime at scale.',
    },
    {
      tailoredBullet:
        'Reduced deployment latency by 60% through automated Kubernetes operator pipelines.',
    },
  ];

  describe('generateCoverLetterHeuristic', () => {
    it('should generate valid cover letter structure with subject, body, and keyThemes', () => {
      const result = generateCoverLetterHeuristic({
        candidateName: 'Sarah Connor',
        roleTitle: 'Staff Backend Infrastructure Engineer',
        company: 'Cyberdyne Systems',
        tailoredBullets: sampleTailoredBullets,
        jobDescription: sampleJD,
      });

      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('keyThemes');

      expect(result.subject).toContain('Staff Backend Infrastructure Engineer');
      expect(result.subject).toContain('Sarah Connor');

      expect(result.body).toContain('Cyberdyne Systems');
      expect(result.body).toContain('Sarah Connor');
      expect(result.body).toContain('100k events/sec');

      expect(Array.isArray(result.keyThemes)).toBe(true);
      expect(result.keyThemes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('parseCoverLetter', () => {
    it('should parse valid JSON object string', () => {
      const jsonString = JSON.stringify({
        subject: 'Application for Staff Engineer - Sarah Connor',
        body: 'Dear Cyberdyne Systems Hiring Team,\n\nI am thrilled to submit my qualifications...',
        keyThemes: ['Cloud Infrastructure', 'Kubernetes Ecosystem'],
      });

      const parsed = parseCoverLetter(jsonString);
      expect(parsed.subject).toBe('Application for Staff Engineer - Sarah Connor');
      expect(parsed.body).toContain('Dear Cyberdyne Systems');
      expect(parsed.keyThemes).toEqual(['Cloud Infrastructure', 'Kubernetes Ecosystem']);
    });

    it('should parse JSON wrapped in markdown code blocks', () => {
      const fenced = '```json\n{"subject": "Staff Engineer - Sarah", "body": "Dear Team,\\n\\nCover letter text.", "keyThemes": ["Reliability"]}\n```';
      const parsed = parseCoverLetter(fenced);
      expect(parsed.subject).toBe('Staff Engineer - Sarah');
      expect(parsed.body).toBe('Dear Team,\n\nCover letter text.');
      expect(parsed.keyThemes).toEqual(['Reliability']);
    });

    it('should fallback to heuristic when given unparseable text', () => {
      const fallbackParams = {
        candidateName: 'Sarah Connor',
        roleTitle: 'Staff Engineer',
        company: 'Cyberdyne Systems',
        tailoredBullets: sampleTailoredBullets,
        jobDescription: sampleJD,
      };

      const parsed = parseCoverLetter('Not a json output', fallbackParams);
      expect(parsed).toHaveProperty('subject');
      expect(parsed).toHaveProperty('body');
      expect(parsed).toHaveProperty('keyThemes');
      expect(parsed.subject).toContain('Sarah Connor');
    });
  });

  describe('buildCoverLetterPrompt', () => {
    it('should weave candidate achievements and target company into human prompt', () => {
      const prompt = buildCoverLetterPrompt({
        candidateName: 'Sarah Connor',
        roleTitle: 'Staff Backend Infrastructure Engineer',
        company: 'Cyberdyne Systems',
        tailoredBullets: sampleTailoredBullets,
        jobDescription: sampleJD,
        candidateSummary: sampleCandidate.summary,
        userEdits: { notes: 'Emphasize experience scaling distributed databases.' },
      });

      expect(prompt).toContain('Sarah Connor');
      expect(prompt).toContain('Cyberdyne Systems');
      expect(prompt).toContain('Staff Backend Infrastructure Engineer');
      expect(prompt).toContain('100k events/sec');
      expect(prompt).toContain('Emphasize experience scaling distributed databases.');
    });
  });

  describe('coverLetterNode execution with Mocked LLM', () => {
    it('should invoke mocked LLM and return structured coverLetter with subject, body, and keyThemes', async () => {
      const mockLlmResponse = {
        content: JSON.stringify({
          subject: 'Staff Backend Infrastructure Engineer - Sarah Connor',
          body: `Dear Hiring Team at Cyberdyne Systems,

Leading high-scale infrastructure initiatives requires rigorous architecture and decisive execution. Over the past seven years, I have specialized in architecting resilient distributed systems and containerized microservice ecosystems.

At my current organization, I architected a distributed event-driven data pipeline handling 100k events/second with 99.99% uptime. Furthermore, I spearheaded automated Kubernetes operator pipelines that accelerated deployment velocity by 60%.

Cyberdyne Systems' ambitious infrastructure roadmap requires technical depth, cross-functional alignment, and unwavering system reliability. I welcome the opportunity to discuss how my expertise can drive your platform forward.

Sincerely,
Sarah Connor`,
          keyThemes: [
            'Distributed Systems Architecture',
            'Kubernetes & Infrastructure Automation',
            'High-Throughput Reliability',
          ],
        }),
      };

      const mockLLM = {
        invoke: jest.fn().mockResolvedValue(mockLlmResponse),
      };

      const state = {
        structuredResume: sampleCandidate,
        structuredJD: sampleJD,
        tailoredBullets: sampleTailoredBullets,
      };

      const result = await coverLetterNode(state, { llm: mockLLM });

      expect(mockLLM.invoke).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('cover_letter_generated');
      expect(result.coverLetter).toBeDefined();

      const { subject, body, keyThemes } = result.coverLetter;

      // Verify output structure
      expect(typeof subject).toBe('string');
      expect(typeof body).toBe('string');
      expect(Array.isArray(keyThemes)).toBe(true);

      expect(subject).toContain('Staff Backend Infrastructure Engineer');
      expect(subject).toContain('Sarah Connor');

      expect(body).toContain('Cyberdyne Systems');
      expect(body).toContain('Sincerely,');
      expect(body).toContain('Sarah Connor');

      // Verify absence of banned clichés
      expect(body).not.toMatch(/I am writing to (?:express my )?enthusiastic/i);
      expect(body).not.toMatch(/I am the (?:ideal|perfect) candidate/i);
      expect(body).not.toMatch(/self-motivated team player/i);

      expect(keyThemes.length).toBe(3);
      expect(keyThemes).toContain('Distributed Systems Architecture');
    });

    it('should fallback gracefully to heuristic if mocked LLM fails', async () => {
      const failingMockLLM = {
        invoke: jest.fn().mockRejectedValue(new Error('LLM timeout')),
      };

      const state = {
        structuredResume: sampleCandidate,
        structuredJD: sampleJD,
        tailoredBullets: sampleTailoredBullets,
      };

      const result = await coverLetterNode(state, { llm: failingMockLLM, allowFallback: true });

      expect(failingMockLLM.invoke).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('cover_letter_generated');
      expect(result.coverLetter).toBeDefined();
      expect(result.coverLetter.subject).toContain('Staff Backend Infrastructure Engineer');
      expect(result.coverLetter.body).toContain('Dear Hiring Team');
    });
  });
});
