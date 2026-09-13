const assert = require('assert');
const { MemorySaver } = require('@langchain/langgraph');
const {
  PIPELINE_NODES,
  buildApplicationGraph,
  createApplicationPipeline,
  humanInterruptNode,
  saveNode,
  shouldContinueAfterHumanReview,
  pipeline,
} = require('../src/agents/pipeline');
const agentsIndex = require('../src/agents');

async function testAgentPipeline() {
  console.log('🧪 Testing LangGraph Pipeline Assembly (Phase 58)...\n');

  // [Test 1] Verify re-exports from agents index
  console.log('[Test 1] Verifying pipeline re-exports from agents index...');
  assert.strictEqual(typeof agentsIndex.buildApplicationGraph, 'function');
  assert.strictEqual(typeof agentsIndex.createApplicationPipeline, 'function');
  assert.strictEqual(typeof agentsIndex.humanInterruptNode, 'function');
  assert.strictEqual(typeof agentsIndex.saveNode, 'function');
  assert.strictEqual(typeof agentsIndex.shouldContinueAfterHumanReview, 'function');
  assert.ok(agentsIndex.PIPELINE_NODES, 'PIPELINE_NODES must be exported');
  assert.ok(agentsIndex.pipeline, 'Default pipeline must be exported');
  assert.strictEqual(typeof agentsIndex.pipeline.invoke, 'function');
  console.log('  ✅ Pipeline re-exports confirmed\n');

  // [Test 2] Verify PIPELINE_NODES constants and Graph Topology
  console.log('[Test 2] Verifying pipeline nodes and graph topology...');
  assert.strictEqual(PIPELINE_NODES.PARSER, 'parser');
  assert.strictEqual(PIPELINE_NODES.RESUME_TAILORING, 'resume_tailoring');
  assert.strictEqual(PIPELINE_NODES.ATS, 'ats');
  assert.strictEqual(PIPELINE_NODES.COVER_LETTER, 'cover_letter');
  assert.strictEqual(PIPELINE_NODES.FIT_SCORING, 'fit_scoring');
  assert.strictEqual(PIPELINE_NODES.HUMAN_INTERRUPT, '__human_interrupt__');
  assert.strictEqual(PIPELINE_NODES.SAVE, 'save');

  const graph = buildApplicationGraph();
  const nodeKeys = Object.keys(graph.nodes);
  assert.ok(nodeKeys.includes('parser'), 'Graph must contain parser node');
  assert.ok(nodeKeys.includes('resume_tailoring'), 'Graph must contain resume_tailoring node');
  assert.ok(nodeKeys.includes('ats'), 'Graph must contain ats node');
  assert.ok(nodeKeys.includes('cover_letter'), 'Graph must contain cover_letter node');
  assert.ok(nodeKeys.includes('fit_scoring'), 'Graph must contain fit_scoring node');
  assert.ok(nodeKeys.includes('__human_interrupt__'), 'Graph must contain __human_interrupt__ node');
  assert.ok(nodeKeys.includes('save'), 'Graph must contain save node');
  console.log('  ✅ Graph topology verified with all 7 nodes:\n', nodeKeys);

  // [Test 3] Verify conditional routing logic (shouldContinueAfterHumanReview)
  console.log('\n[Test 3] Verifying conditional edge routing function...');
  assert.strictEqual(
    shouldContinueAfterHumanReview({ humanApproved: true }),
    'save',
    'Must route to save if humanApproved is true'
  );
  assert.strictEqual(
    shouldContinueAfterHumanReview({ humanApproved: false }),
    'loop_back',
    'Must route to loop_back if humanApproved is false'
  );
  assert.strictEqual(
    shouldContinueAfterHumanReview({ humanApproved: null }),
    'loop_back',
    'Must route to loop_back if humanApproved is null'
  );
  assert.strictEqual(
    shouldContinueAfterHumanReview({}),
    'loop_back',
    'Must route to loop_back if humanApproved is omitted'
  );
  console.log('  ✅ Conditional routing verified (humanApproved ? save : loop_back)\n');

  // [Test 4] Verify humanInterruptNode and saveNode unit behavior
  console.log('[Test 4] Verifying humanInterruptNode and saveNode...');
  const interruptStateApproved = await humanInterruptNode({ humanApproved: true });
  assert.strictEqual(interruptStateApproved.status, 'review_approved');

  const interruptStatePending = await humanInterruptNode({ humanApproved: false });
  assert.strictEqual(interruptStatePending.status, 'awaiting_human_review');

  let onSaveCalled = false;
  let savedPayload = null;
  const saveResult = await saveNode({ sample: 'data' }, async (state) => {
    onSaveCalled = true;
    savedPayload = state;
  });
  assert.strictEqual(saveResult.status, 'saved');
  assert.strictEqual(onSaveCalled, true);
  assert.strictEqual(savedPayload.sample, 'data');
  console.log('  ✅ humanInterruptNode and saveNode behavior confirmed\n');

  // Prepare standard mock input data
  const sampleResume = {
    name: 'Jordan Lee',
    parsedSections: {
      contact: { name: 'Jordan Lee', email: 'jordan@example.com' },
      summary: 'Senior distributed systems engineer',
      skills: ['Node.js', 'PostgreSQL', 'Docker'],
      experience: [
        {
          company: 'CloudCorp',
          title: 'Senior Engineer',
          bulletPoints: ['Engineered high-throughput backend services with Node.js and PostgreSQL.'],
        },
      ],
    },
  };

  const sampleJD = {
    company: 'Stripe',
    roleTitle: 'Staff Backend Engineer',
    skills: ['Node.js', 'PostgreSQL', 'Redis'],
    experience: ['5+ years distributed systems'],
  };

  // [Test 5] Verify Parallel Execution and Human Interrupt Checkpoint
  console.log('[Test 5] Verifying parallel agent execution and interruptBefore checkpoint...');
  const checkpointer = new MemorySaver();
  const testPipeline = createApplicationPipeline({
    checkpointer,
    allowFallback: true,
  });

  const config = { configurable: { thread_id: 'pipeline-test-session-1' } };

  const checkpointState = await testPipeline.invoke(
    {
      resumeSections: sampleResume,
      jdRequirements: sampleJD,
      humanApproved: false,
    },
    config
  );

  // Verify all upstream nodes executed before interrupt
  assert.ok(checkpointState.structuredResume, 'structuredResume must be present');
  assert.ok(checkpointState.structuredJD, 'structuredJD must be present');

  // Verify parallel branches both completed: [ResumeTailoring ∥ ATS]
  assert.ok(
    Array.isArray(checkpointState.tailoredBullets) && checkpointState.tailoredBullets.length > 0,
    'tailoredBullets must be populated by ResumeTailoring node'
  );
  assert.ok(
    checkpointState.atsReport && typeof checkpointState.atsReport.overallScore === 'number',
    'atsReport must be populated by ATS node'
  );

  // Verify downstream CoverLetter and FitScoring executed
  assert.ok(
    checkpointState.coverLetter && typeof checkpointState.coverLetter.subject === 'string',
    'coverLetter must be populated'
  );
  assert.ok(
    checkpointState.fitScore && typeof checkpointState.fitScore.score === 'number',
    'fitScore must be populated'
  );

  console.log('  ✅ Upstream parallel agents executed successfully before checkpoint:\n', {
    tailoredBulletsCount: checkpointState.tailoredBullets.length,
    atsScore: checkpointState.atsReport.overallScore,
    coverLetterSubject: checkpointState.coverLetter.subject,
    fitScore: checkpointState.fitScore.score,
    tier: checkpointState.fitScore.tier,
  });

  // [Test 6] Verify Human Approval Flow (if humanApproved → save)
  console.log('\n[Test 6] Testing human approval resumption (humanApproved: true → save)...');
  let externalSaveTriggered = false;
  const approvedCheckpointer = new MemorySaver();
  const approvedPipeline = createApplicationPipeline({
    checkpointer: approvedCheckpointer,
    allowFallback: true,
    onSave: async () => {
      externalSaveTriggered = true;
    },
  });

  const approvedConfig = { configurable: { thread_id: 'pipeline-approved-session' } };
  await approvedPipeline.invoke(
    {
      resumeSections: sampleResume,
      jdRequirements: sampleJD,
      humanApproved: false,
    },
    approvedConfig
  );

  // Resume with human approval
  await approvedPipeline.updateState(approvedConfig, { humanApproved: true });
  const finalApprovedState = await approvedPipeline.invoke(null, approvedConfig);

  assert.strictEqual(finalApprovedState.humanApproved, true);
  assert.strictEqual(finalApprovedState.status, 'saved');
  assert.strictEqual(externalSaveTriggered, true, 'onSave hook must be executed');
  console.log('  ✅ Pipeline transitioned: __human_interrupt__ → save → END (status: "saved")\n');

  // [Test 7] Verify Loop-Back with Edits (else → loop back to ResumeTailoring)
  console.log('[Test 7] Testing human edit rejection loop-back (humanApproved: false with edits)...');
  const loopCheckpointer = new MemorySaver();
  const loopPipeline = createApplicationPipeline({
    checkpointer: loopCheckpointer,
    allowFallback: true,
  });

  const loopConfig = { configurable: { thread_id: 'pipeline-loop-session' } };
  const initialPassState = await loopPipeline.invoke(
    {
      resumeSections: sampleResume,
      jdRequirements: sampleJD,
      humanApproved: false,
    },
    loopConfig
  );

  const initialBullet = initialPassState.tailoredBullets[0]?.tailoredBullet;
  assert.ok(initialBullet, 'Initial bullet must exist');

  // Simulate user providing edits/instructions and requesting a revision
  await loopPipeline.updateState(loopConfig, {
    humanApproved: false,
    userEdits: {
      notes: 'Highlight Redis distributed caching and 99.99% availability SLA.',
    },
  });

  // Resuming triggers loop_back to resume_tailoring
  const revisedPassState = await loopPipeline.invoke(null, loopConfig);

  assert.strictEqual(revisedPassState.humanApproved, false);
  assert.ok(
    revisedPassState.tailoredBullets && revisedPassState.tailoredBullets.length > 0,
    'Tailored bullets must be regenerated'
  );
  assert.ok(
    revisedPassState.fitScore && typeof revisedPassState.fitScore.score === 'number',
    'Fit score must be recalculated'
  );

  // Finally approve the revision
  await loopPipeline.updateState(loopConfig, { humanApproved: true });
  const finalSavedState = await loopPipeline.invoke(null, loopConfig);

  assert.strictEqual(finalSavedState.humanApproved, true);
  assert.strictEqual(finalSavedState.status, 'saved');
  console.log('  ✅ Loop-back with user edits executed and successfully finalized on approval\n');

  // [Test 8] Verify mock LLM injection through pipeline options
  console.log('[Test 8] Testing pipeline with custom mock LLM injection...');
  let mockLLMInvocations = 0;
  const mockLLM = {
    async invoke(messages) {
      mockLLMInvocations++;
      const promptContent = messages[1]?.content || '';
      if (promptContent.includes('ORIGINAL CANDIDATE BULLET POINTS')) {
        return {
          content: JSON.stringify({
            bullets: [
              {
                originalBullet: 'Engineered high-throughput backend services with Node.js and PostgreSQL.',
                tailoredBullet: 'Architected distributed Node.js microservices with Redis caching, supporting 50k RPS.',
                reasoning: 'Emphasized Redis and scalability.',
              },
            ],
          }),
        };
      }
      if (promptContent.includes('TARGET OPPORTUNITY') && promptContent.includes('COVER LETTER')) {
        return {
          content: JSON.stringify({
            subject: 'Staff Backend Engineer Application - Jordan Lee',
            body: 'Dear Stripe Engineering Team, I am eager to apply my distributed systems background...',
            keyThemes: ['Distributed Scalability', 'Reliability'],
          }),
        };
      }
      // Fit scoring response
      return {
        content: JSON.stringify({
          score: 91,
          tier: 'strong',
          gaps: [],
          strengths: ['Deep expertise in Node.js and Redis'],
        }),
      };
    },
  };

  const customPipeline = createApplicationPipeline({
    llm: mockLLM,
    interruptBefore: [], // Run straight through with humanApproved: true
  });

  const fullRunState = await customPipeline.invoke({
    resumeSections: sampleResume,
    jdRequirements: sampleJD,
    humanApproved: true,
  });

  assert.strictEqual(fullRunState.status, 'saved');
  assert.strictEqual(fullRunState.fitScore.score, 91);
  assert.strictEqual(fullRunState.fitScore.tier, 'strong');
  assert.ok(mockLLMInvocations >= 2, 'Mock LLM must be invoked by agent nodes');
  console.log('  ✅ Custom LLM injected and executed across agent nodes with final score 91 (strong)\n');

  console.log('🎉 All LangGraph Pipeline Assembly tests passed successfully!\n');
}

if (require.main === module) {
  testAgentPipeline().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testAgentPipeline };
