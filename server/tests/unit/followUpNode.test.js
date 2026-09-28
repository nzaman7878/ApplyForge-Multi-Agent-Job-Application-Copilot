const {
  followUpNode,
  parseFollowUpDraft,
  generateFollowUpHeuristic,
  buildFollowUpPrompt,
  generateFollowUpEmail,
} = require('../../src/agents/nodes/followUpNode');

describe('followUpNode Unit Tests', () => {
  const sampleCandidate = {
    contact: { name: 'Elena Rostova', email: 'elena@example.com' },
    summary: 'Lead Cloud Architect with 8+ years specializing in distributed Kubernetes platforms.',
  };

  const sampleJD = {
    roleTitle: 'Principal Cloud Platform Engineer',
    company: 'Stripe',
  };

  describe('buildFollowUpPrompt', () => {
    it('should format all fields into the user prompt', () => {
      const prompt = buildFollowUpPrompt({
        candidateName: 'Elena Rostova',
        roleTitle: 'Principal Cloud Platform Engineer',
        company: 'Stripe',
        daysSinceApplied: 10,
        status: 'applied',
        recipientName: 'Alex Mercer',
        customNotes: 'Mentioned AWS migration experience during referral.',
      });

      expect(prompt).toContain('Elena Rostova');
      expect(prompt).toContain('Principal Cloud Platform Engineer');
      expect(prompt).toContain('Stripe');
      expect(prompt).toMatch(/10 day\(s\)/i);
      expect(prompt).toContain('Alex Mercer');
      expect(prompt).toContain('Mentioned AWS migration experience during referral.');
      expect(prompt).toContain('Craft a tailored follow-up email');
    });
  });

  describe('generateFollowUpHeuristic', () => {
    it('should generate early courtesy check strategy for <= 7 days', () => {
      const draft = generateFollowUpHeuristic({
        candidateName: 'Elena Rostova',
        roleTitle: 'Staff Engineer',
        company: 'Figma',
        daysSinceApplied: 4,
        status: 'applied',
      });

      expect(draft.strategy).toBe('early_courtesy_check');
      expect(draft.daysSinceApplied).toBe(4);
      expect(draft.subject).toMatch(/follow-up/i);
      expect(draft.subject).toContain('Staff Engineer');
      expect(draft.body).toContain('Figma');
      expect(draft.body).toContain('Elena Rostova');
      expect(draft.recommendedWaitDays).toBe(7);
    });

    it('should generate standard status inquiry for 8-14 days', () => {
      const draft = generateFollowUpHeuristic({
        candidateName: 'Elena Rostova',
        roleTitle: 'Staff Engineer',
        company: 'Figma',
        daysSinceApplied: 12,
        status: 'applied',
      });

      expect(draft.strategy).toBe('standard_status_inquiry');
      expect(draft.daysSinceApplied).toBe(12);
      expect(draft.subject).toMatch(/status inquiry/i);
      expect(draft.body).toContain('Figma');
      expect(draft.recommendedWaitDays).toBe(5);
    });

    it('should generate graceful re-engagement for > 14 days', () => {
      const draft = generateFollowUpHeuristic({
        candidateName: 'Elena Rostova',
        roleTitle: 'Staff Engineer',
        company: 'Figma',
        daysSinceApplied: 21,
        status: 'applied',
      });

      expect(draft.strategy).toBe('graceful_re_engagement');
      expect(draft.daysSinceApplied).toBe(21);
      expect(draft.subject).toMatch(/checking in|re-connecting|following up/i);
      expect(draft.body).toContain('Figma');
      expect(draft.recommendedWaitDays).toBe(10);
    });

    it('should generate post-interview reinforcement when status is interviewing', () => {
      const draft = generateFollowUpHeuristic({
        candidateName: 'Elena Rostova',
        roleTitle: 'Staff Engineer',
        company: 'Figma',
        daysSinceApplied: 3,
        status: 'interviewing',
        recipientName: 'Hiring Team',
      });

      expect(draft.strategy).toBe('post_interview_reinforcement');
      expect(draft.subject).toMatch(/thank you/i);
      expect(draft.body).toMatch(/discussion|priorities|interview/i);
    });

    it('should handle missing candidate and company gracefully with sensible defaults', () => {
      const draft = generateFollowUpHeuristic({});

      expect(draft.strategy).toBe('early_courtesy_check');
      expect(draft.subject).toBeDefined();
      expect(draft.body).toMatch(/hiring team/i);
    });
  });

  describe('parseFollowUpDraft', () => {
    it('should parse direct JSON string successfully', () => {
      const raw = JSON.stringify({
        subject: 'Following up: Cloud Architect application',
        body: 'Hi Team, Checking in on my application.',
        strategy: 'standard_status_inquiry',
        recommendedWaitDays: 7,
      });

      const parsed = parseFollowUpDraft(raw);
      expect(parsed.subject).toBe('Following up: Cloud Architect application');
      expect(parsed.strategy).toBe('standard_status_inquiry');
      expect(parsed.recommendedWaitDays).toBe(7);
    });

    it('should parse markdown-fenced JSON string successfully', () => {
      const raw = `Here is the follow up email draft:
\`\`\`json
{
  "subject": "Follow-up: Staff Engineer role",
  "body": "Hi Sarah,\\n\\nFollowing up on my application.",
  "strategy": "early_courtesy_check",
  "recommendedWaitDays": 5
}
\`\`\``;

      const parsed = parseFollowUpDraft(raw);
      expect(parsed.subject).toBe('Follow-up: Staff Engineer role');
      expect(parsed.strategy).toBe('early_courtesy_check');
      expect(parsed.recommendedWaitDays).toBe(5);
    });

    it('should fall back to heuristic when parsing fails', () => {
      const parsed = parseFollowUpDraft('This is not valid JSON at all', {
        candidateName: 'Elena Rostova',
        roleTitle: 'Staff Engineer',
        company: 'Figma',
        daysSinceApplied: 10,
      });

      expect(parsed).toHaveProperty('subject');
      expect(parsed).toHaveProperty('body');
      expect(parsed.strategy).toBe('standard_status_inquiry');
    });
  });

  describe('followUpNode LangGraph execution', () => {
    it('should process state and return followUpEmail using heuristic fallback on mock llm error', async () => {
      const mockState = {
        candidateProfile: sampleCandidate,
        jobDescription: sampleJD,
        application: {
          daysSinceApplied: 9,
          status: 'applied',
        },
      };

      const result = await followUpNode(mockState);
      expect(result).toHaveProperty('followUpEmail');
      expect(result.followUpEmail.strategy).toBe('standard_status_inquiry');
      expect(result.followUpEmail.daysSinceApplied).toBe(9);
      expect(result.followUpEmail.subject).toMatch(/status inquiry/i);
    });
  });

  describe('generateFollowUpEmail standalone helper', () => {
    it('should generate draft with provided context', async () => {
      const draft = await generateFollowUpEmail({
        candidateName: 'Elena Rostova',
        roleTitle: 'Principal Cloud Platform Engineer',
        company: 'Stripe',
        daysSinceApplied: 6,
        status: 'applied',
        recipientName: 'Hiring Lead',
      });

      expect(draft).toHaveProperty('subject');
      expect(draft).toHaveProperty('body');
      expect(draft.strategy).toBe('early_courtesy_check');
      expect(draft.daysSinceApplied).toBe(6);
    });
  });
});
