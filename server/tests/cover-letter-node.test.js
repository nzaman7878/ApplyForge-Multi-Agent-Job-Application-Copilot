const assert = require('assert');
const { StateGraph } = require('@langchain/langgraph');
const { AgentState } = require('../src/agents/state');
const { parserNode } = require('../src/agents/nodes/parserNode');
const { resumeTailoringNode } = require('../src/agents/nodes/resumeTailoringNode');
const {
  coverLetterNode,
  COVER_LETTER_SYSTEM_PROMPT,
  buildCoverLetterPrompt,
  parseCoverLetter,
  generateCoverLetterHeuristic,
} = require('../src/agents/nodes/coverLetterNode');
const agentsIndex = require('../src/agents');

async function testCoverLetterNode() {
  console.log('🧪 Testing Cover Letter Agent Node (Phase 56)...\n');

  // [Test 1] Verify re-exports from agents index
  console.log('[Test 1] Verifying coverLetterNode re-exports from agents index...');
  assert.strictEqual(typeof agentsIndex.coverLetterNode, 'function');
  assert.strictEqual(typeof agentsIndex.COVER_LETTER_SYSTEM_PROMPT, 'string');
  assert.strictEqual(typeof agentsIndex.buildCoverLetterPrompt, 'function');
  assert.strictEqual(typeof agentsIndex.parseCoverLetter, 'function');
  assert.strictEqual(typeof agentsIndex.generateCoverLetterHeuristic, 'function');
  console.log('  ✅ Re-exports confirmed\n');

  // [Test 2] Verify System Prompt constraints
  console.log('[Test 2] Verifying system prompt constraints...');
  const promptLower = COVER_LETTER_SYSTEM_PROMPT.toLowerCase();
  assert.ok(promptLower.includes('professional tone'), 'Must enforce professional tone');
  assert.ok(promptLower.includes('no clichés') || promptLower.includes('avoid'), 'Must instruct against clichés');
  assert.ok(promptLower.includes('role'), 'Must instruct role specificity');
  assert.ok(promptLower.includes('subject'), 'Must request subject in output');
  assert.ok(promptLower.includes('body'), 'Must request body in output');
  assert.ok(promptLower.includes('keythemes'), 'Must request keyThemes in output');
  console.log('  ✅ System prompt verified (professional tone, no clichés, role-specific, structured JSON)\n');

  // [Test 3] Verify buildCoverLetterPrompt
  console.log('[Test 3] Verifying prompt construction...');
  const sampleTailoredBullets = [
    {
      originalBullet: 'Built microservices with Node.js',
      tailoredBullet: 'Architected high-throughput microservices using Node.js, GraphQL, and Redis, scaling to 50k RPS.',
      reasoning: 'Injected Redis and performance metrics',
    },
    {
      originalBullet: 'Managed PostgreSQL database',
      tailoredBullet: 'Optimized PostgreSQL query latency by 40% through index re-engineering and connection pooling.',
      reasoning: 'Highlighted database performance',
    },
  ];

  const sampleJD = {
    company: 'Stripe',
    roleTitle: 'Staff Backend Engineer',
    requiredSkills: ['Node.js', 'Redis', 'PostgreSQL', 'Distributed Systems'],
    niceToHave: ['Kafka', 'Go'],
    experience: ['7+ years'],
  };

  const promptText = buildCoverLetterPrompt({
    candidateName: 'Jordan Lee',
    roleTitle: sampleJD.roleTitle,
    company: sampleJD.company,
    tailoredBullets: sampleTailoredBullets,
    jobDescription: sampleJD,
    candidateSummary: 'Senior distributed systems specialist.',
    userEdits: { notes: 'Emphasize payment resilience and reliability.' },
  });

  assert.ok(promptText.includes('Stripe'), 'Must include company');
  assert.ok(promptText.includes('Staff Backend Engineer'), 'Must include role');
  assert.ok(promptText.includes('Jordan Lee'), 'Must include candidate name');
  assert.ok(promptText.includes('50k RPS'), 'Must include tailored bullets');
  assert.ok(promptText.includes('payment resilience'), 'Must include user edits');
  console.log('  ✅ Prompt builder verified with role, company, tailored bullets, and user notes\n');

  // [Test 4] Verify parseCoverLetter with JSON object and markdown codeblocks
  console.log('[Test 4] Testing parseCoverLetter with various formats...');
  
  // Clean JSON object
  const cleanObj = {
    subject: 'Staff Backend Engineer Application - Jordan Lee',
    body: 'Dear Stripe Engineering Team,\n\nI am thrilled to present my background...',
    keyThemes: ['Distributed Scalability', 'System Resilience'],
  };
  const parsedFromObj = parseCoverLetter(cleanObj);
  assert.strictEqual(parsedFromObj.subject, cleanObj.subject);
  assert.strictEqual(parsedFromObj.body, cleanObj.body);
  assert.deepStrictEqual(parsedFromObj.keyThemes, cleanObj.keyThemes);

  // Markdown codeblock string
  const markdownCodeblock = `
\`\`\`json
{
  "subject": "Staff Backend Engineer Application - Jordan Lee",
  "body": "Dear Stripe Engineering Team,\\n\\nWith deep experience in distributed systems...",
  "keyThemes": ["High Throughput", "Financial Infrastructure"]
}
\`\`\`
  `;
  const parsedFromMarkdown = parseCoverLetter(markdownCodeblock);
  assert.strictEqual(parsedFromMarkdown.subject, 'Staff Backend Engineer Application - Jordan Lee');
  assert.ok(parsedFromMarkdown.body.includes('distributed systems'));
  assert.strictEqual(parsedFromMarkdown.keyThemes.length, 2);

  // Fallback on invalid JSON string
  const invalidJson = 'Not valid JSON from model';
  const parsedFallback = parseCoverLetter(invalidJson, {
    candidateName: 'Jordan Lee',
    roleTitle: 'Staff Backend Engineer',
    company: 'Stripe',
  });
  assert.strictEqual(parsedFallback.subject, 'Staff Backend Engineer Application - Jordan Lee');
  assert.ok(parsedFallback.body.includes('Stripe'));
  console.log('  ✅ Response parser validated (handles objects, markdown codeblocks, and fallback)\n');

  // [Test 5] Test generateCoverLetterHeuristic
  console.log('[Test 5] Testing generateCoverLetterHeuristic...');
  const heuristicResult = generateCoverLetterHeuristic({
    candidateName: 'Jordan Lee',
    roleTitle: 'Staff Backend Engineer',
    company: 'Stripe',
    tailoredBullets: sampleTailoredBullets,
    jobDescription: sampleJD,
  });

  assert.strictEqual(heuristicResult.subject, 'Staff Backend Engineer Application - Jordan Lee');
  assert.ok(heuristicResult.body.includes('Stripe'));
  assert.ok(heuristicResult.body.includes('Jordan Lee'));
  assert.ok(Array.isArray(heuristicResult.keyThemes));
  assert.ok(heuristicResult.keyThemes.length >= 2);

  // Verify no generic clichés
  assert.strictEqual(heuristicResult.body.toLowerCase().includes('perfect candidate'), false);
  assert.strictEqual(heuristicResult.body.toLowerCase().includes('hard worker'), false);
  console.log('  ✅ Heuristic cover letter generator produced role-specific text without clichés\n');

  // [Test 6] Test coverLetterNode with mock LLM client
  console.log('[Test 6] Testing coverLetterNode with mock LLM client...');
  const mockLLM = {
    async invoke(messages) {
      assert.strictEqual(messages.length, 2);
      assert.strictEqual(messages[0]._getType(), 'system');
      assert.strictEqual(messages[1]._getType(), 'human');
      return {
        content: JSON.stringify({
          subject: 'Staff Backend Engineer Application - Jordan Lee',
          body: `Dear Stripe Engineering Team,

Throughout my career designing distributed architectures, I have prioritized system resilience and measurable execution. At Stripe, where payment reliability is mission-critical, my technical background directly aligns with your infrastructure ambitions.

Notably, I architected high-throughput microservices using Node.js, GraphQL, and Redis, scaling to 50k RPS. Furthermore, I optimized PostgreSQL query latency by 40% through index re-engineering and connection pooling. These experiences directly support Stripe's standards for developer velocity and zero-downtime operations.

I look forward to discussing how my experience can advance Stripe's mission.

Sincerely,
Jordan Lee`,
          keyThemes: [
            'Distributed Systems Architecture',
            'Mission-Critical Resilience',
            'Database Optimization',
          ],
        }),
      };
    },
  };

  const stateInput = {
    structuredResume: {
      contact: { name: 'Jordan Lee' },
      allBulletPoints: sampleTailoredBullets,
      summary: 'Senior distributed systems architect',
    },
    structuredJD: sampleJD,
    tailoredBullets: sampleTailoredBullets,
  };

  const nodeResult = await coverLetterNode(stateInput, { llm: mockLLM });
  assert.ok(nodeResult.coverLetter, 'Must return coverLetter object');
  assert.strictEqual(nodeResult.status, 'cover_letter_generated');

  const { subject, body, keyThemes } = nodeResult.coverLetter;
  assert.strictEqual(typeof subject, 'string');
  assert.strictEqual(typeof body, 'string');
  assert.ok(Array.isArray(keyThemes));
  assert.strictEqual(keyThemes.length, 3);
  assert.ok(body.includes('Stripe'));
  assert.ok(body.includes('50k RPS'));

  console.log('  ✅ Mock LLM execution output validated:\n', {
    subject,
    keyThemes,
    bodyParagraphs: body.split('\n\n').length,
  });

  // [Test 7] Full LangGraph pipeline integration (Parser -> Tailoring -> CoverLetter)
  console.log('\n[Test 7] Testing multi-node pipeline: Parser -> ResumeTailoring -> CoverLetter...');
  const pipeline = new StateGraph(AgentState);

  pipeline.addNode('parser', parserNode);
  pipeline.addNode('tailor', (state) => resumeTailoringNode(state, { allowFallback: true }));
  pipeline.addNode('cover_letter', (state) => coverLetterNode(state, { llm: mockLLM }));

  pipeline.addEdge('__start__', 'parser');
  pipeline.addEdge('parser', 'tailor');
  pipeline.addEdge('tailor', 'cover_letter');
  pipeline.addEdge('cover_letter', '__end__');

  const compiledPipeline = pipeline.compile();

  const fullResumeDoc = {
    name: 'Jordan Lee',
    parsedSections: {
      contact: { name: 'Jordan Lee', email: 'jordan@example.com' },
      summary: 'Senior distributed systems specialist',
      skills: ['Node.js', 'PostgreSQL', 'Redis', 'Docker'],
      experience: [
        {
          company: 'CloudScale',
          title: 'Lead Architect',
          bulletPoints: ['Architected microservices handling 50k RPS using Node.js and Redis.'],
        },
      ],
    },
  };

  const pipelineOutput = await compiledPipeline.invoke({
    resumeSections: fullResumeDoc,
    jdRequirements: sampleJD,
  });

  assert.ok(pipelineOutput.structuredResume, 'State must contain structuredResume');
  assert.ok(pipelineOutput.structuredJD, 'State must contain structuredJD');
  assert.ok(pipelineOutput.tailoredBullets, 'State must contain tailoredBullets');
  assert.ok(pipelineOutput.coverLetter, 'State must contain coverLetter');
  assert.strictEqual(pipelineOutput.status, 'cover_letter_generated');
  assert.strictEqual(pipelineOutput.coverLetter.subject, 'Staff Backend Engineer Application - Jordan Lee');

  console.log('  ✅ LangGraph pipeline successfully executed parser -> tailor -> cover_letter:\n', {
    tailoredBulletsCount: pipelineOutput.tailoredBullets.length,
    coverLetterSubject: pipelineOutput.coverLetter.subject,
    keyThemes: pipelineOutput.coverLetter.keyThemes,
    status: pipelineOutput.status,
  });

  console.log('\n🎉 All Cover Letter Agent Node tests passed successfully!\n');
}

if (require.main === module) {
  testCoverLetterNode().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testCoverLetterNode };
