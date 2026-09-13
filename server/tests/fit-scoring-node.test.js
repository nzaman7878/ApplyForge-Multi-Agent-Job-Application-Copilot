const assert = require('assert');
const { StateGraph } = require('@langchain/langgraph');
const { AgentState } = require('../src/agents/state');
const { parserNode } = require('../src/agents/nodes/parserNode');
const { atsKeywordNode } = require('../src/agents/nodes/atsKeywordNode');
const { resumeTailoringNode } = require('../src/agents/nodes/resumeTailoringNode');
const {
  fitScoringNode,
  FIT_SCORING_SYSTEM_PROMPT,
  buildFitScoringPrompt,
  determineTier,
  generateFitScoreHeuristic,
  parseFitScore,
} = require('../src/agents/nodes/fitScoringNode');
const agentsIndex = require('../src/agents');

async function testFitScoringNode() {
  console.log('🧪 Testing Fit Scoring Agent Node (Phase 57)...\n');

  // [Test 1] Verify re-exports from agents index
  console.log('[Test 1] Verifying fitScoringNode re-exports from agents index...');
  assert.strictEqual(typeof agentsIndex.fitScoringNode, 'function');
  assert.strictEqual(typeof agentsIndex.FIT_SCORING_SYSTEM_PROMPT, 'string');
  assert.strictEqual(typeof agentsIndex.buildFitScoringPrompt, 'function');
  assert.strictEqual(typeof agentsIndex.determineTier, 'function');
  assert.strictEqual(typeof agentsIndex.generateFitScoreHeuristic, 'function');
  assert.strictEqual(typeof agentsIndex.parseFitScore, 'function');
  console.log('  ✅ Re-exports confirmed\n');

  // [Test 2] Verify System Prompt constraints
  console.log('[Test 2] Verifying system prompt constraints...');
  const promptLower = FIT_SCORING_SYSTEM_PROMPT.toLowerCase();
  assert.ok(promptLower.includes('holistic'), 'Must instruct holistic assessment');
  assert.ok(promptLower.includes('strong'), 'Must define strong tier');
  assert.ok(promptLower.includes('moderate'), 'Must define moderate tier');
  assert.ok(promptLower.includes('stretch'), 'Must define stretch tier');
  assert.ok(promptLower.includes('gaps'), 'Must specify gaps output');
  assert.ok(promptLower.includes('severity'), 'Must specify gap severity');
  assert.ok(promptLower.includes('suggestion'), 'Must specify gap suggestions');
  assert.ok(promptLower.includes('strengths'), 'Must specify strengths array');
  console.log('  ✅ System prompt verified (0-100 score, strong/moderate/stretch tiers, gaps, strengths)\n');

  // [Test 3] Verify determineTier function
  console.log('[Test 3] Verifying determineTier logic...');
  assert.strictEqual(determineTier(95), 'strong');
  assert.strictEqual(determineTier(80), 'strong');
  assert.strictEqual(determineTier(79), 'moderate');
  assert.strictEqual(determineTier(60), 'moderate');
  assert.strictEqual(determineTier(59), 'stretch');
  assert.strictEqual(determineTier(20), 'stretch');
  console.log('  ✅ determineTier correctly maps score ranges to tiers\n');

  // [Test 4] Verify buildFitScoringPrompt
  console.log('[Test 4] Verifying prompt construction...');
  const sampleATSReport = {
    overallScore: 78,
    matchedKeywords: [
      { keyword: 'Node.js', importance: 'required', location: 'skills' },
      { keyword: 'PostgreSQL', importance: 'required', location: 'experience' },
      { keyword: 'Redis', importance: 'preferred', location: 'skills' },
    ],
    missingKeywords: [
      {
        keyword: 'Kubernetes',
        importance: 'required',
        suggestion: 'Demonstrate hands-on Kubernetes orchestration experience.',
      },
      {
        keyword: 'GraphQL',
        importance: 'preferred',
        suggestion: 'Add GraphQL API schema design experience.',
      },
    ],
  };

  const sampleStructuredJD = {
    roleTitle: 'Lead Backend Engineer',
    company: 'Stripe',
    requiredSkills: ['Node.js', 'PostgreSQL', 'Kubernetes'],
    qualifications: ["Bachelor's or Master's in Computer Science or equivalent"],
    experience: ['5+ years designing distributed systems'],
  };

  const sampleStructuredResume = {
    contact: { name: 'Jordan Lee' },
    summary: 'Senior software engineer with focus on scalable cloud architectures.',
    skills: ['Node.js', 'PostgreSQL', 'Redis', 'Docker'],
    allBulletPoints: [
      'Architected microservices processing 50k RPS with Node.js and Redis.',
      'Designed PostgreSQL schema optimizations reducing query latency by 40%.',
    ],
  };

  const promptText = buildFitScoringPrompt({
    candidateName: sampleStructuredResume.contact.name,
    roleTitle: sampleStructuredJD.roleTitle,
    company: sampleStructuredJD.company,
    atsReport: sampleATSReport,
    structuredResume: sampleStructuredResume,
    structuredJD: sampleStructuredJD,
    tailoredBullets: [
      { tailoredBullet: 'Architected microservices processing 50k RPS with Node.js and Redis.' },
    ],
  });

  assert.ok(promptText.includes('Lead Backend Engineer'), 'Must contain role title');
  assert.ok(promptText.includes('Stripe'), 'Must contain company');
  assert.ok(promptText.includes('Jordan Lee'), 'Must contain candidate name');
  assert.ok(promptText.includes('78%'), 'Must contain ATS score');
  assert.ok(promptText.includes('Kubernetes (required)'), 'Must contain missing required keywords');
  assert.ok(promptText.includes('Node.js (required, found in skills)'), 'Must contain matched keywords');
  console.log('  ✅ Prompt builder verified with role, company, ATS report, and candidate accomplishments\n');

  // [Test 5] Verify parseFitScore with object, markdown, and fallback
  console.log('[Test 5] Testing parseFitScore with multiple payload formats...');
  const cleanFitObj = {
    score: 82,
    tier: 'strong',
    gaps: [
      {
        skill: 'Kubernetes',
        severity: 'high',
        suggestion: 'Complete CKA certification or deploy sandbox clusters.',
      },
    ],
    strengths: [
      'Deep 5+ year expertise with Node.js microservices',
      'Demonstrated high-scale throughput experience (50k RPS)',
    ],
  };

  const parsedFromObj = parseFitScore(cleanFitObj);
  assert.strictEqual(parsedFromObj.score, 82);
  assert.strictEqual(parsedFromObj.tier, 'strong');
  assert.strictEqual(parsedFromObj.gaps.length, 1);
  assert.strictEqual(parsedFromObj.gaps[0].severity, 'high');
  assert.strictEqual(parsedFromObj.strengths.length, 2);

  // Markdown codeblock format
  const markdownPayload = `
\`\`\`json
{
  "score": 68,
  "tier": "moderate",
  "gaps": [
    {
      "skill": "GraphQL",
      "severity": "medium",
      "suggestion": "Build and document a federated GraphQL sub-graph."
    }
  ],
  "strengths": [
    "Solid PostgreSQL index tuning background",
    "Active Redis caching implementation"
  ]
}
\`\`\`
`;
  const parsedFromMarkdown = parseFitScore(markdownPayload);
  assert.strictEqual(parsedFromMarkdown.score, 68);
  assert.strictEqual(parsedFromMarkdown.tier, 'moderate');
  assert.strictEqual(parsedFromMarkdown.gaps[0].skill, 'GraphQL');
  assert.strictEqual(parsedFromMarkdown.strengths.length, 2);

  // Fallback on corrupt output
  const corruptOutput = 'This is corrupted AI response without valid JSON';
  const parsedFallback = parseFitScore(corruptOutput, {
    atsReport: sampleATSReport,
    structuredResume: sampleStructuredResume,
    structuredJD: sampleStructuredJD,
  });
  assert.strictEqual(typeof parsedFallback.score, 'number');
  assert.ok(['strong', 'moderate', 'stretch'].includes(parsedFallback.tier));
  assert.ok(Array.isArray(parsedFallback.gaps));
  assert.ok(Array.isArray(parsedFallback.strengths));
  console.log('  ✅ parseFitScore validated (handles direct objects, markdown codeblocks, and fallback)\n');

  // [Test 6] Verify generateFitScoreHeuristic deterministic calculation
  console.log('[Test 6] Testing generateFitScoreHeuristic...');
  const heuristicResult = generateFitScoreHeuristic({
    atsReport: sampleATSReport,
    structuredResume: sampleStructuredResume,
    structuredJD: sampleStructuredJD,
    tailoredBullets: [
      { tailoredBullet: 'Architected microservices processing 50k RPS with Node.js and Redis.' },
    ],
  });

  assert.strictEqual(typeof heuristicResult.score, 'number');
  assert.ok(heuristicResult.score >= 0 && heuristicResult.score <= 100);
  assert.strictEqual(heuristicResult.tier, determineTier(heuristicResult.score));
  assert.strictEqual(heuristicResult.gaps.length, 2);
  assert.strictEqual(heuristicResult.gaps[0].skill, 'Kubernetes');
  assert.strictEqual(heuristicResult.gaps[0].severity, 'high');
  assert.strictEqual(heuristicResult.gaps[1].skill, 'GraphQL');
  assert.strictEqual(heuristicResult.gaps[1].severity, 'medium');
  assert.ok(heuristicResult.strengths.length >= 2);
  assert.ok(heuristicResult.strengths[0].includes('Node.js'));
  console.log('  ✅ Heuristic synthesis engine produced accurate score, tier, gaps, and strengths:\n', {
    score: heuristicResult.score,
    tier: heuristicResult.tier,
    gapsCount: heuristicResult.gaps.length,
    strengthsCount: heuristicResult.strengths.length,
  });

  // [Test 7] Test fitScoringNode with mock LLM client
  console.log('\n[Test 7] Testing fitScoringNode with mock LLM client...');
  const mockLLM = {
    async invoke(messages) {
      assert.strictEqual(messages.length, 2);
      assert.strictEqual(messages[0]._getType(), 'system');
      assert.strictEqual(messages[1]._getType(), 'human');
      return {
        content: JSON.stringify({
          score: 86,
          tier: 'strong',
          gaps: [
            {
              skill: 'Kubernetes',
              severity: 'high',
              suggestion: 'Highlight production deployment or container management experience.',
            },
          ],
          strengths: [
            'Direct proficiency in Node.js, PostgreSQL, and Redis',
            'Strong demonstrated accomplishment in 50k RPS microservices',
          ],
        }),
      };
    },
  };

  const stateInput = {
    structuredResume: sampleStructuredResume,
    structuredJD: sampleStructuredJD,
    atsReport: sampleATSReport,
    tailoredBullets: [
      { tailoredBullet: 'Architected microservices processing 50k RPS with Node.js and Redis.' },
    ],
  };

  const nodeResult = await fitScoringNode(stateInput, { llm: mockLLM });
  assert.ok(nodeResult.fitScore, 'Must return fitScore object');
  assert.strictEqual(nodeResult.status, 'fit_scored');

  const { score, tier, gaps, strengths } = nodeResult.fitScore;
  assert.strictEqual(score, 86);
  assert.strictEqual(tier, 'strong');
  assert.strictEqual(gaps.length, 1);
  assert.strictEqual(gaps[0].skill, 'Kubernetes');
  assert.strictEqual(gaps[0].severity, 'high');
  assert.strictEqual(strengths.length, 2);
  console.log('  ✅ Mock LLM execution output validated:\n', {
    score,
    tier,
    gaps,
    strengths,
  });

  // [Test 8] Auto-computation of ATS report if missing in state
  console.log('\n[Test 8] Testing fitScoringNode auto-computation of missing ATS report...');
  const stateWithoutATS = {
    structuredResume: sampleStructuredResume,
    resumeSections: {
      parsedSections: {
        skills: ['Node.js', 'PostgreSQL', 'Docker'],
        experience: [{ bulletPoints: ['Built Node.js APIs with PostgreSQL.'] }],
      },
    },
    jdRequirements: {
      skills: ['Node.js', 'PostgreSQL', 'AWS'],
    },
  };

  const nodeResultWithAutoATS = await fitScoringNode(stateWithoutATS, { allowFallback: true });
  assert.ok(nodeResultWithAutoATS.fitScore, 'Must return fitScore');
  assert.strictEqual(typeof nodeResultWithAutoATS.fitScore.score, 'number');
  assert.ok(nodeResultWithAutoATS.fitScore.gaps.some((g) => g.skill.toLowerCase() === 'aws'));
  console.log('  ✅ Node automatically generated ATS report and computed fitScore successfully\n');

  // [Test 9] Full LangGraph pipeline integration (Parser -> ATS -> FitScoring)
  console.log('[Test 9] Testing multi-node LangGraph pipeline: Parser -> ATS -> FitScoring...');
  const pipeline = new StateGraph(AgentState);

  pipeline.addNode('parser', parserNode);
  pipeline.addNode('tailor', (state) => resumeTailoringNode(state, { allowFallback: true }));
  pipeline.addNode('ats', atsKeywordNode);
  pipeline.addNode('fit_scoring', (state) => fitScoringNode(state, { llm: mockLLM }));

  pipeline.addEdge('__start__', 'parser');
  pipeline.addEdge('parser', 'tailor');
  pipeline.addEdge('tailor', 'ats');
  pipeline.addEdge('ats', 'fit_scoring');
  pipeline.addEdge('fit_scoring', '__end__');

  const compiledPipeline = pipeline.compile();

  const fullResumeDoc = {
    name: 'Jordan Lee',
    parsedSections: {
      contact: { name: 'Jordan Lee', email: 'jordan@example.com' },
      summary: 'Senior distributed systems architect',
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
    jdRequirements: sampleStructuredJD,
  });

  assert.ok(pipelineOutput.structuredResume, 'State must contain structuredResume');
  assert.ok(pipelineOutput.structuredJD, 'State must contain structuredJD');
  assert.ok(pipelineOutput.tailoredBullets, 'State must contain tailoredBullets');
  assert.ok(pipelineOutput.atsReport, 'State must contain atsReport');
  assert.ok(pipelineOutput.fitScore, 'State must contain fitScore');
  assert.strictEqual(pipelineOutput.status, 'fit_scored');
  assert.strictEqual(pipelineOutput.fitScore.score, 86);
  assert.strictEqual(pipelineOutput.fitScore.tier, 'strong');

  console.log('  ✅ LangGraph pipeline successfully executed parser -> tailor -> ats -> fit_scoring:\n', {
    atsScore: pipelineOutput.atsReport.overallScore,
    fitScore: pipelineOutput.fitScore.score,
    tier: pipelineOutput.fitScore.tier,
    gapsCount: pipelineOutput.fitScore.gaps.length,
    strengthsCount: pipelineOutput.fitScore.strengths.length,
    status: pipelineOutput.status,
  });

  console.log('\n🎉 All Fit Scoring Agent Node tests passed successfully!\n');
}

if (require.main === module) {
  testFitScoringNode().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testFitScoringNode };
