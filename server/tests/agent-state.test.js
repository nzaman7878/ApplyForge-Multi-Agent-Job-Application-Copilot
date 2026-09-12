const assert = require('assert');
const { StateGraph } = require('@langchain/langgraph');
const {
  AgentState,
  createInitialAgentState,
  AGENT_STATE_KEYS,
} = require('../src/agents/state');
const agentsIndex = require('../src/agents');

async function testAgentState() {
  console.log('🧪 Testing LangGraph Agent State Schema (Phase 52)...\n');

  // [Test 1] Verify AGENT_STATE_KEYS contains all required channels
  console.log('[Test 1] Verifying required agent state keys...');
  const expectedKeys = [
    'resumeSections',
    'jdRequirements',
    'tailoredBullets',
    'atsReport',
    'coverLetter',
    'fitScore',
    'humanApproved',
    'userEdits',
  ];

  for (const key of expectedKeys) {
    assert.ok(
      AGENT_STATE_KEYS.includes(key),
      `AGENT_STATE_KEYS must include "${key}"`
    );
    assert.ok(
      key in AgentState.spec,
      `AgentState.spec must contain channel "${key}"`
    );
  }
  console.log('  ✅ All 8 required channels defined in AgentState.spec\n');

  // [Test 2] Verify index exports match state exports
  console.log('[Test 2] Verifying server/src/agents/index.js exports...');
  assert.strictEqual(agentsIndex.AgentState, AgentState);
  assert.strictEqual(agentsIndex.createInitialAgentState, createInitialAgentState);
  assert.deepStrictEqual(agentsIndex.AGENT_STATE_KEYS, AGENT_STATE_KEYS);
  console.log('  ✅ agents/index.js re-exports verified\n');

  // [Test 3] Verify createInitialAgentState defaults
  console.log('[Test 3] Verifying createInitialAgentState default values...');
  const defaultState = createInitialAgentState();
  assert.strictEqual(defaultState.resumeSections, null);
  assert.strictEqual(defaultState.jdRequirements, null);
  assert.deepStrictEqual(defaultState.tailoredBullets, []);
  assert.strictEqual(defaultState.atsReport, null);
  assert.strictEqual(defaultState.coverLetter, null);
  assert.strictEqual(defaultState.fitScore, null);
  assert.strictEqual(defaultState.humanApproved, false);
  assert.strictEqual(defaultState.userEdits, null);
  assert.strictEqual(defaultState.status, 'idle');
  console.log('  ✅ createInitialAgentState produces expected default schema\n');

  // [Test 4] Verify createInitialAgentState with custom inputs
  console.log('[Test 4] Verifying createInitialAgentState with custom inputs...');
  const customInputs = {
    resumeSections: { experience: ['Senior Engineer at Tech Corp'] },
    jdRequirements: { skills: ['Node.js', 'React', 'TypeScript'] },
    humanApproved: true,
    userEdits: { notes: 'Make cover letter more concise' },
  };
  const customizedState = createInitialAgentState(customInputs);
  assert.deepStrictEqual(
    customizedState.resumeSections,
    customInputs.resumeSections
  );
  assert.deepStrictEqual(
    customizedState.jdRequirements,
    customInputs.jdRequirements
  );
  assert.strictEqual(customizedState.humanApproved, true);
  assert.deepStrictEqual(customizedState.userEdits, customInputs.userEdits);
  console.log('  ✅ createInitialAgentState correctly merges custom parameters\n');

  // [Test 5] Verify StateGraph execution with AgentState
  console.log('[Test 5] Verifying StateGraph compilation and state transitions...');
  const workflow = new StateGraph(AgentState);

  // Node A: Parser / Tailor simulation
  workflow.addNode('tailor_node', (state) => {
    return {
      tailoredBullets: [
        {
          original: 'Built microservices in Node.js',
          tailored: 'Architected high-throughput microservices using Node.js, GraphQL, and Redis',
          reasoning: 'Highlights required JD skills',
        },
      ],
      atsReport: {
        matchedKeywords: ['Node.js', 'TypeScript', 'GraphQL'],
        missingKeywords: ['Docker'],
        overallScore: 88,
      },
    };
  });

  // Node B: Cover Letter + Fit Scoring simulation
  workflow.addNode('scoring_node', (state) => {
    return {
      coverLetter: {
        subject: 'Application for Senior Full-Stack Engineer',
        body: 'Dear Hiring Team,\n\nI am excited to apply...',
        keyThemes: ['Distributed systems', 'Leadership', 'Clean Architecture'],
      },
      fitScore: {
        score: 92,
        tier: 'strong',
        strengths: ['Deep Node.js expertise', 'System design'],
        gaps: [{ skill: 'Docker', severity: 'low', suggestion: 'Add containerization mention' }],
      },
      status: 'awaiting_review',
    };
  });

  // Wire pipeline
  workflow.addEdge('__start__', 'tailor_node');
  workflow.addEdge('tailor_node', 'scoring_node');
  workflow.addEdge('scoring_node', '__end__');

  const compiledPipeline = workflow.compile();
  assert.ok(compiledPipeline, 'Workflow should compile successfully');

  // Run pipeline invocation
  const inputPayload = {
    resumeSections: {
      experience: ['Built microservices in Node.js'],
      skills: ['JavaScript', 'Node.js'],
    },
    jdRequirements: {
      skills: ['Node.js', 'TypeScript', 'Docker', 'GraphQL'],
      experience: ['5+ years'],
    },
  };

  const finalState = await compiledPipeline.invoke(inputPayload);

  // Verify all channels in final state
  assert.deepStrictEqual(finalState.resumeSections, inputPayload.resumeSections);
  assert.deepStrictEqual(finalState.jdRequirements, inputPayload.jdRequirements);
  assert.strictEqual(finalState.tailoredBullets.length, 1);
  assert.strictEqual(
    finalState.tailoredBullets[0].original,
    'Built microservices in Node.js'
  );
  assert.strictEqual(finalState.atsReport.overallScore, 88);
  assert.strictEqual(finalState.coverLetter.subject, 'Application for Senior Full-Stack Engineer');
  assert.strictEqual(finalState.fitScore.score, 92);
  assert.strictEqual(finalState.fitScore.tier, 'strong');
  assert.strictEqual(finalState.humanApproved, false);
  assert.strictEqual(finalState.status, 'awaiting_review');

  console.log('  ✅ StateGraph executed multi-node pipeline and produced full final state:\n', {
    tailoredBulletsCount: finalState.tailoredBullets.length,
    atsScore: finalState.atsReport.overallScore,
    fitScore: finalState.fitScore.score,
    status: finalState.status,
  });

  // [Test 6] Human-in-the-loop state mutation
  console.log('\n[Test 6] Verifying human review state update...');
  const approvedWorkflow = new StateGraph(AgentState);
  approvedWorkflow.addNode('review_approval', (state) => ({
    humanApproved: true,
    userEdits: { approvedAt: new Date().toISOString() },
    status: 'approved',
  }));
  approvedWorkflow.addEdge('__start__', 'review_approval');
  approvedWorkflow.addEdge('review_approval', '__end__');

  const compiledApproval = approvedWorkflow.compile();
  const approvedState = await compiledApproval.invoke(finalState);

  assert.strictEqual(approvedState.humanApproved, true);
  assert.strictEqual(approvedState.status, 'approved');
  assert.ok(approvedState.userEdits.approvedAt);
  // Unaltered channels should remain intact
  assert.strictEqual(approvedState.fitScore.score, 92);
  console.log('  ✅ Human approval mutation correctly toggled state channels\n');

  console.log('🎉 All AgentState tests passed successfully!\n');
}

if (require.main === module) {
  testAgentState().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testAgentState };
