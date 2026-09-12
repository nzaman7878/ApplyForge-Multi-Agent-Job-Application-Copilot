const assert = require('assert');
const { StateGraph } = require('@langchain/langgraph');
const { AgentState } = require('../src/agents/state');
const { parserNode } = require('../src/agents/nodes/parserNode');
const { resumeTailoringNode } = require('../src/agents/nodes/resumeTailoringNode');
const {
  atsKeywordNode,
  extractWeightedKeywords,
  locateKeywordInResume,
  generateSuggestion,
  calculateOverallScore,
  DEFAULT_KEYWORD_WEIGHTS,
} = require('../src/agents/nodes/atsKeywordNode');
const agentsIndex = require('../src/agents');

async function testAtsKeywordNode() {
  console.log('🧪 Testing ATS Keyword Agent Node (Phase 55)...\n');

  // [Test 1] Verify re-exports from agents index
  console.log('[Test 1] Verifying atsKeywordNode re-exports from agents index...');
  assert.strictEqual(typeof agentsIndex.atsKeywordNode, 'function');
  assert.strictEqual(typeof agentsIndex.extractWeightedKeywords, 'function');
  assert.strictEqual(typeof agentsIndex.locateKeywordInResume, 'function');
  assert.strictEqual(typeof agentsIndex.calculateOverallScore, 'function');
  assert.strictEqual(typeof agentsIndex.DEFAULT_KEYWORD_WEIGHTS, 'object');
  console.log('  ✅ Re-exports confirmed\n');

  // [Test 2] Test extractWeightedKeywords with required, preferred, and bonus
  console.log('[Test 2] Testing extractWeightedKeywords classification...');
  const sampleJD = {
    company: 'FinTech Systems',
    roleTitle: 'Lead Cloud Architect',
    requiredSkills: ['Node.js', 'PostgreSQL', 'Docker', 'TypeScript'],
    niceToHave: ['GraphQL', 'Kubernetes is preferred', 'AWS certification is a bonus', 'Kafka is a plus'],
    rawText: 'Looking for a Lead Cloud Architect. Bonus: Terraform, Golang.',
  };

  const weightedKeywords = extractWeightedKeywords(sampleJD, sampleJD.rawText);
  assert.ok(Array.isArray(weightedKeywords), 'Must return array of weighted keywords');

  const requiredItems = weightedKeywords.filter((k) => k.importance === 'required');
  const preferredItems = weightedKeywords.filter((k) => k.importance === 'preferred');
  const bonusItems = weightedKeywords.filter((k) => k.importance === 'bonus');

  assert.strictEqual(requiredItems.length, 4, 'Should have 4 required skills');
  assert.strictEqual(requiredItems[0].weight, DEFAULT_KEYWORD_WEIGHTS.required);

  assert.ok(preferredItems.some((k) => k.keyword === 'GraphQL'));
  assert.ok(preferredItems.some((k) => k.keyword === 'Kubernetes'));

  assert.ok(bonusItems.some((k) => k.keyword.toLowerCase().includes('aws')));
  assert.ok(bonusItems.some((k) => k.keyword === 'Kafka'));
  assert.ok(bonusItems.some((k) => k.keyword.toLowerCase().includes('terraform')));

  console.log('  ✅ Keywords categorized by importance:', {
    requiredCount: requiredItems.length,
    preferredCount: preferredItems.length,
    bonusCount: bonusItems.length,
  });

  // [Test 3] Test locateKeywordInResume across various sections & word boundaries
  console.log('\n[Test 3] Testing locateKeywordInResume section matching...');
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

  // Skills section
  assert.strictEqual(locateKeywordInResume('Node.js', sampleResume), 'Skills');
  // Experience section
  assert.strictEqual(locateKeywordInResume('Kafka', sampleResume), 'Experience');
  assert.strictEqual(locateKeywordInResume('Docker', sampleResume), 'Experience');
  // Summary section
  assert.strictEqual(locateKeywordInResume('microservices', sampleResume), 'Summary');
  // Education section
  assert.strictEqual(locateKeywordInResume('Computer Science', sampleResume), 'Education');
  // Certifications section
  assert.strictEqual(locateKeywordInResume('AWS', sampleResume), 'Certifications');

  // Word boundary protection: "Java" should NOT match "JavaScript"
  assert.strictEqual(locateKeywordInResume('Java', sampleResume), null);
  // Missing keyword
  assert.strictEqual(locateKeywordInResume('Kubernetes', sampleResume), null);

  // Tailored bullets location detection
  const tailoredBullets = [
    { tailoredBullet: 'Architected automated deployment clusters using Kubernetes.' },
  ];
  assert.strictEqual(locateKeywordInResume('Kubernetes', sampleResume, tailoredBullets), 'Tailored Bullets');

  console.log('  ✅ Location detection verified across Skills, Experience, Summary, Education, Certifications, and Tailored Bullets\n');

  // [Test 4] Test calculateOverallScore
  console.log('[Test 4] Testing calculateOverallScore calculation...');
  const matchedSample = [
    { keyword: 'Node.js', importance: 'required' }, // 3
    { keyword: 'TypeScript', importance: 'required' }, // 3
    { keyword: 'Docker', importance: 'required' }, // 3
    { keyword: 'Kafka', importance: 'preferred' }, // 2
  ]; // 11 points
  const missingSample = [
    { keyword: 'PostgreSQL', importance: 'required' }, // 3
    { keyword: 'GraphQL', importance: 'preferred' }, // 2
    { keyword: 'Terraform', importance: 'bonus' }, // 1
  ]; // 6 points
  // Total = 17 points, matched = 11, score = Math.round((11 / 17) * 100) = 65

  const score = calculateOverallScore(matchedSample, missingSample);
  assert.strictEqual(score, 65, `Expected score 65, got ${score}`);

  // Edge cases
  assert.strictEqual(calculateOverallScore([], []), 100, 'Empty keywords should return 100');
  assert.strictEqual(calculateOverallScore([], missingSample), 0, 'Zero matched should return 0');
  assert.strictEqual(calculateOverallScore(matchedSample, []), 100, 'All matched should return 100');
  console.log('  ✅ Weighted ATS scoring verified (matched: 11 / 17 = 65%)\n');

  // [Test 5] Test atsKeywordNode execution and output schema
  console.log('[Test 5] Testing atsKeywordNode output schema...');
  const stateInput = {
    resumeSections: sampleResume,
    jdRequirements: sampleJD,
  };

  const nodeResult = await atsKeywordNode(stateInput);
  assert.ok(nodeResult.atsReport, 'Node must return atsReport');
  assert.strictEqual(nodeResult.status, 'ats_analyzed');

  const { matchedKeywords, missingKeywords, overallScore } = nodeResult.atsReport;

  assert.ok(Array.isArray(matchedKeywords), 'matchedKeywords must be an array');
  assert.ok(Array.isArray(missingKeywords), 'missingKeywords must be an array');
  assert.strictEqual(typeof overallScore, 'number');
  assert.ok(overallScore >= 0 && overallScore <= 100, 'overallScore must be between 0 and 100');

  // Verify matchedKeywords item format: { keyword, importance, location }
  for (const m of matchedKeywords) {
    assert.ok(m.keyword, 'matched keyword must have keyword property');
    assert.ok(m.importance, 'matched keyword must have importance property');
    assert.ok(m.location, 'matched keyword must have location property');
  }

  // Verify missingKeywords item format: { keyword, importance, suggestion }
  for (const miss of missingKeywords) {
    assert.ok(miss.keyword, 'missing keyword must have keyword property');
    assert.ok(miss.importance, 'missing keyword must have importance property');
    assert.ok(miss.suggestion, 'missing keyword must have suggestion property');
    assert.ok(
      miss.suggestion.includes(miss.keyword),
      'Suggestion must mention the missing keyword'
    );
  }

  console.log('  ✅ atsReport schema confirmed:\n', {
    matchedCount: matchedKeywords.length,
    missingCount: missingKeywords.length,
    overallScore,
    sampleMatched: matchedKeywords[0],
    sampleMissing: missingKeywords[0],
  });

  // [Test 6] Chained LangGraph pipeline integration
  console.log('\n[Test 6] Testing ATS Keyword Node inside LangGraph StateGraph...');
  const workflow = new StateGraph(AgentState);

  workflow.addNode('parser', parserNode);
  workflow.addNode('ats', atsKeywordNode);

  workflow.addEdge('__start__', 'parser');
  workflow.addEdge('parser', 'ats');
  workflow.addEdge('ats', '__end__');

  const compiledWorkflow = workflow.compile();
  const graphResult = await compiledWorkflow.invoke({
    resumeSections: sampleResume,
    jdRequirements: sampleJD,
  });

  assert.ok(graphResult.structuredResume, 'Graph state must include structuredResume');
  assert.ok(graphResult.structuredJD, 'Graph state must include structuredJD');
  assert.ok(graphResult.atsReport, 'Graph state must include atsReport');
  assert.strictEqual(graphResult.status, 'ats_analyzed');
  assert.ok(graphResult.atsReport.matchedKeywords.length > 0);
  assert.strictEqual(typeof graphResult.atsReport.overallScore, 'number');

  console.log('  ✅ LangGraph pipeline successfully executed parser -> atsKeywordNode\n');

  console.log('🎉 All ATS Keyword Agent Node tests passed successfully!\n');
}

if (require.main === module) {
  testAtsKeywordNode().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testAtsKeywordNode };
