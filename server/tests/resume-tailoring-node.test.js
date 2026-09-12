const assert = require('assert');
const { StateGraph } = require('@langchain/langgraph');
const { AgentState } = require('../src/agents/state');
const { parserNode } = require('../src/agents/nodes/parserNode');
const {
  resumeTailoringNode,
  TAILORING_SYSTEM_PROMPT,
  buildTailoringPrompt,
  parseTailoredBullets,
  tailorBulletsHeuristic,
} = require('../src/agents/nodes/resumeTailoringNode');
const agentsIndex = require('../src/agents');

async function testResumeTailoringNode() {
  console.log('🧪 Testing Resume Tailoring Agent Node (Phase 54)...\n');

  // [Test 1] Verify re-exports from agents index
  console.log('[Test 1] Verifying resumeTailoringNode re-exports from agents index...');
  assert.strictEqual(typeof agentsIndex.resumeTailoringNode, 'function');
  assert.strictEqual(typeof agentsIndex.TAILORING_SYSTEM_PROMPT, 'string');
  assert.strictEqual(typeof agentsIndex.buildTailoringPrompt, 'function');
  assert.strictEqual(typeof agentsIndex.parseTailoredBullets, 'function');
  console.log('  ✅ Re-exports confirmed\n');

  // [Test 2] Verify System Prompt instructions
  console.log('[Test 2] Verifying System Prompt core constraints...');
  const promptLower = TAILORING_SYSTEM_PROMPT.toLowerCase();
  assert.ok(promptLower.includes('no fabrication'), 'Prompt must instruct against fabrication');
  assert.ok(promptLower.includes('jd keywords'), 'Prompt must instruct emphasizing JD keywords');
  assert.ok(promptLower.includes('voice'), 'Prompt must instruct preserving candidate voice');
  assert.ok(promptLower.includes('bullets'), 'Prompt must request structured bullets JSON output');
  console.log('  ✅ System prompt constraints verified (no fabrication, emphasize keywords, preserve voice)\n');

  // [Test 3] Verify buildTailoringPrompt
  console.log('[Test 3] Verifying prompt construction...');
  const sampleBullets = [
    {
      id: 'exp_0_bullet_0',
      company: 'Alpha Tech',
      role: 'Backend Developer',
      original: 'Developed backend services with Node.js and PostgreSQL.',
    },
  ];
  const sampleJD = {
    company: 'FinTech Cloud',
    roleTitle: 'Senior Platform Engineer',
    requiredSkills: ['Node.js', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes'],
    niceToHave: ['GraphQL', 'AWS'],
    experience: ['5+ years distributed systems'],
  };
  const promptText = buildTailoringPrompt({
    resumeBullets: sampleBullets,
    jobDescription: sampleJD,
    userEdits: { notes: 'Focus especially on caching' },
  });

  assert.ok(promptText.includes('FinTech Cloud'), 'Prompt must include target company');
  assert.ok(promptText.includes('Senior Platform Engineer'), 'Prompt must include target role');
  assert.ok(promptText.includes('Node.js, PostgreSQL, Redis'), 'Prompt must include required skills');
  assert.ok(promptText.includes('Focus especially on caching'), 'Prompt must include user edits');
  assert.ok(promptText.includes('Developed backend services with Node.js'), 'Prompt must include bullet');
  console.log('  ✅ Prompt builder correctly formatted JD and candidate bullets\n');

  // [Test 4] Verify parseTailoredBullets
  console.log('[Test 4] Testing parseTailoredBullets with various LLM output formats...');
  
  // Clean JSON object
  const cleanJsonObj = {
    bullets: [
      {
        originalBullet: 'Built API endpoints',
        tailoredBullet: 'Architected high-throughput RESTful API endpoints using Node.js and Redis',
        reasoning: 'Highlighted target backend technologies and architecture experience',
      },
    ],
  };
  const parsedFromObj = parseTailoredBullets(cleanJsonObj, sampleBullets);
  assert.strictEqual(parsedFromObj.length, 1);
  assert.strictEqual(parsedFromObj[0].originalBullet, 'Built API endpoints');
  assert.strictEqual(parsedFromObj[0].tailoredBullet.includes('Redis'), true);

  // Markdown codeblock string
  const markdownJsonStr = `
\`\`\`json
{
  "bullets": [
    {
      "originalBullet": "Managed database migrations",
      "tailoredBullet": "Spearheaded PostgreSQL database schema migrations with zero downtime",
      "reasoning": "Emphasized database reliability and PostgreSQL"
    }
  ]
}
\`\`\`
  `;
  const parsedFromMarkdown = parseTailoredBullets(markdownJsonStr, sampleBullets);
  assert.strictEqual(parsedFromMarkdown.length, 1);
  assert.strictEqual(parsedFromMarkdown[0].tailoredBullet.includes('zero downtime'), true);

  // Fallback on invalid JSON
  const invalidJsonStr = 'This is not valid JSON from the model.';
  const parsedFallback = parseTailoredBullets(invalidJsonStr, sampleBullets);
  assert.strictEqual(parsedFallback.length, 1);
  assert.strictEqual(parsedFallback[0].originalBullet, sampleBullets[0].original);
  console.log('  ✅ Robust JSON parser handles plain objects, markdown codeblocks, and fallback\n');

  // [Test 5] Test resumeTailoringNode with injected mock LLM
  console.log('[Test 5] Testing resumeTailoringNode with mock LLM client...');
  const mockLLM = {
    async invoke(messages) {
      assert.strictEqual(messages.length, 2);
      assert.strictEqual(messages[0]._getType(), 'system');
      assert.strictEqual(messages[1]._getType(), 'human');
      return {
        content: JSON.stringify({
          bullets: [
            {
              originalBullet: sampleBullets[0].original,
              tailoredBullet: 'Architected scalable microservices using Node.js, Redis, and PostgreSQL, reducing latency by 35%.',
              reasoning: 'Injected Redis and performance impact while keeping original role truthful.',
            },
          ],
        }),
      };
    },
  };

  const stateInput = {
    structuredResume: {
      allBulletPoints: sampleBullets,
    },
    structuredJD: sampleJD,
  };

  const nodeResult = await resumeTailoringNode(stateInput, { llm: mockLLM });
  assert.ok(nodeResult.tailoredBullets, 'Must return tailoredBullets');
  assert.strictEqual(nodeResult.status, 'tailored');
  assert.strictEqual(nodeResult.tailoredBullets.length, 1);

  const tailoredItem = nodeResult.tailoredBullets[0];
  assert.strictEqual(tailoredItem.originalBullet, sampleBullets[0].original);
  assert.strictEqual(tailoredItem.tailoredBullet.includes('Redis'), true);
  assert.strictEqual(tailoredItem.reasoning.includes('Injected Redis'), true);
  console.log('  ✅ Mock LLM execution produced structured JSON bullet output:\n', tailoredItem);

  // [Test 6] Test resumeTailoringNode heuristic fallback
  console.log('\n[Test 6] Testing heuristic fallback when LLM is unavailable...');
  const fallbackResult = await resumeTailoringNode(stateInput, { allowFallback: true });
  assert.ok(fallbackResult.tailoredBullets);
  assert.strictEqual(fallbackResult.status, 'tailored');
  assert.strictEqual(fallbackResult.tailoredBullets.length, 1);
  assert.ok(fallbackResult.tailoredBullets[0].tailoredBullet);
  assert.ok(fallbackResult.tailoredBullets[0].reasoning);
  console.log('  ✅ Heuristic fallback produced clean bullet alignment without fabrication\n');

  // [Test 7] Empty bullet points handling
  console.log('[Test 7] Testing empty bullet points handling...');
  const emptyResult = await resumeTailoringNode({ structuredResume: { allBulletPoints: [] } });
  assert.deepStrictEqual(emptyResult.tailoredBullets, []);
  assert.strictEqual(emptyResult.status, 'tailored');
  console.log('  ✅ Empty bullets handled gracefully\n');

  // [Test 8] Integration in LangGraph StateGraph (Parser -> ResumeTailoring)
  console.log('[Test 8] Testing multi-node LangGraph pipeline integration...');
  const pipeline = new StateGraph(AgentState);

  pipeline.addNode('parser', parserNode);
  pipeline.addNode('tailor', (state) => resumeTailoringNode(state, { llm: mockLLM }));

  pipeline.addEdge('__start__', 'parser');
  pipeline.addEdge('parser', 'tailor');
  pipeline.addEdge('tailor', '__end__');

  const compiledPipeline = pipeline.compile();

  const fullResumeDoc = {
    name: 'Jane Doe',
    parsedSections: {
      contact: { name: 'Jane Doe', email: 'jane@example.com' },
      summary: 'Senior Cloud Engineer',
      skills: ['Node.js', 'PostgreSQL', 'Docker'],
      experience: [
        {
          company: 'Alpha Tech',
          title: 'Backend Developer',
          bulletPoints: ['Developed backend services with Node.js and PostgreSQL.'],
        },
      ],
    },
  };

  const graphOutput = await compiledPipeline.invoke({
    resumeSections: fullResumeDoc,
    jdRequirements: sampleJD,
  });

  assert.ok(graphOutput.structuredResume, 'State must contain structuredResume');
  assert.ok(graphOutput.structuredJD, 'State must contain structuredJD');
  assert.ok(graphOutput.tailoredBullets, 'State must contain tailoredBullets');
  assert.strictEqual(graphOutput.status, 'tailored');
  assert.strictEqual(graphOutput.tailoredBullets.length, 1);
  assert.strictEqual(
    graphOutput.tailoredBullets[0].originalBullet,
    'Developed backend services with Node.js and PostgreSQL.'
  );

  console.log('  ✅ LangGraph pipeline successfully chained parserNode -> resumeTailoringNode:\n', {
    parsedResumeBullets: graphOutput.structuredResume.totalBulletPoints,
    tailoredBulletsCount: graphOutput.tailoredBullets.length,
    status: graphOutput.status,
  });

  console.log('\n🎉 All Resume Tailoring Agent Node tests passed successfully!\n');
}

if (require.main === module) {
  testResumeTailoringNode().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testResumeTailoringNode };
