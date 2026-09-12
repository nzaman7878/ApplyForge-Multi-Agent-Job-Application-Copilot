const assert = require('assert');
const { StateGraph } = require('@langchain/langgraph');
const { AgentState } = require('../src/agents/state');
const {
  parserNode,
  formatStructuredResume,
  formatStructuredJD,
} = require('../src/agents/nodes/parserNode');
const agentsIndex = require('../src/agents');

async function testParserNode() {
  console.log('🧪 Testing Parser Agent Node (Phase 53)...\n');

  // [Test 1] Verify re-exports from agents module
  console.log('[Test 1] Verifying parserNode re-exports from agents index...');
  assert.strictEqual(typeof agentsIndex.parserNode, 'function');
  assert.strictEqual(typeof agentsIndex.formatStructuredResume, 'function');
  assert.strictEqual(typeof agentsIndex.formatStructuredJD, 'function');
  console.log('  ✅ Re-exports confirmed\n');

  // [Test 2] Test formatStructuredResume
  console.log('[Test 2] Testing formatStructuredResume with rich resume data...');
  const sampleResume = {
    name: 'Alex Developer',
    parsedSections: {
      contact: {
        name: 'Alex Developer',
        email: 'alex@example.com',
        phone: '+1 555-0199',
        location: 'San Francisco, CA',
        linkedin: 'https://linkedin.com/in/alexdev',
        github: 'https://github.com/alexdev',
      },
      summary: 'Experienced Senior Full-Stack Engineer specializing in Node.js and distributed systems.',
      skills: ['JavaScript', 'TypeScript', 'Node.js', 'React', 'Docker', 'GraphQL', 'javascript', ' NODE.JS '],
      experience: [
        {
          title: 'Senior Backend Engineer',
          company: 'CloudScale Inc.',
          location: 'San Francisco, CA',
          startDate: '2022-01',
          endDate: 'Present',
          current: true,
          bulletPoints: [
            'Architected microservices handling 50k requests per second using Node.js and Redis.',
            'Reduced database query latency by 45% through PostgreSQL indexing and caching strategies.',
          ],
        },
        {
          title: 'Software Engineer',
          company: 'StartupHub',
          location: 'Remote',
          startDate: '2019-06',
          endDate: '2021-12',
          current: false,
          bulletPoints: [
            'Built responsive web interfaces with React and Next.js.',
            'Implemented automated CI/CD pipelines with GitHub Actions and Docker.',
          ],
        },
      ],
      education: [
        {
          institution: 'University of California, Berkeley',
          degree: 'B.S.',
          fieldOfStudy: 'Computer Science',
          gpa: '3.85',
          honors: ["Dean's List", 'Cum Laude'],
        },
      ],
      certifications: [
        {
          name: 'AWS Certified Solutions Architect',
          issuer: 'Amazon Web Services',
          date: '2023-05',
        },
      ],
    },
  };

  const structuredResume = formatStructuredResume(sampleResume);

  assert.strictEqual(structuredResume.contact.name, 'Alex Developer');
  assert.strictEqual(structuredResume.contact.email, 'alex@example.com');
  assert.strictEqual(structuredResume.summary.startsWith('Experienced Senior Full-Stack'), true);

  // Check skill deduplication
  assert.deepStrictEqual(structuredResume.skills, [
    'JavaScript',
    'TypeScript',
    'Node.js',
    'React',
    'Docker',
    'GraphQL',
  ]);

  // Check experiences and extracted bullet points
  assert.strictEqual(structuredResume.experience.length, 2);
  assert.strictEqual(structuredResume.allBulletPoints.length, 4);
  assert.strictEqual(structuredResume.totalBulletPoints, 4);

  // Check first bullet point metadata
  const firstBullet = structuredResume.allBulletPoints[0];
  assert.strictEqual(firstBullet.id, 'exp_0_bullet_0');
  assert.strictEqual(firstBullet.company, 'CloudScale Inc.');
  assert.strictEqual(firstBullet.role, 'Senior Backend Engineer');
  assert.strictEqual(firstBullet.original.includes('50k requests per second'), true);

  // Check education & certifications
  assert.strictEqual(structuredResume.education.length, 1);
  assert.strictEqual(structuredResume.education[0].institution, 'University of California, Berkeley');
  assert.strictEqual(structuredResume.certifications.length, 1);
  assert.strictEqual(structuredResume.certifications[0].name, 'AWS Certified Solutions Architect');
  assert.strictEqual(structuredResume.fullText.includes('Alex Developer'), true);
  assert.strictEqual(structuredResume.fullText.includes('CloudScale Inc.'), true);

  console.log('  ✅ Resume formatting validated: 4 bullets, 6 deduped skills, clean contact/edu/cert structures\n');

  // [Test 3] Test formatStructuredJD
  console.log('[Test 3] Testing formatStructuredJD with job description data...');
  const sampleJD = {
    company: 'FinTech Global',
    roleTitle: 'Lead Distributed Systems Engineer',
    rawText: 'Full JD text here...',
    parsedRequirements: {
      skills: ['Node.js', 'TypeScript', 'Docker', 'Kubernetes', 'Kafka', 'PostgreSQL'],
      experience: ['5+ years of distributed backend experience'],
      qualifications: ["Bachelor's degree in Computer Science or equivalent"],
      niceToHave: ['GraphQL', 'Go', 'Financial sector experience'],
    },
  };

  const structuredJD = formatStructuredJD(sampleJD);

  assert.strictEqual(structuredJD.company, 'FinTech Global');
  assert.strictEqual(structuredJD.roleTitle, 'Lead Distributed Systems Engineer');
  assert.strictEqual(structuredJD.requiredSkills.length, 6);
  assert.strictEqual(structuredJD.niceToHave.length, 3);
  assert.strictEqual(structuredJD.allSkills.length, 9);
  assert.strictEqual(structuredJD.experience[0], '5+ years of distributed backend experience');
  assert.strictEqual(structuredJD.totalRequiredSkills, 6);

  console.log('  ✅ JD formatting validated: 6 required skills, 3 nice-to-have, 1 experience requirement\n');

  // [Test 4] Test parserNode standalone execution
  console.log('[Test 4] Testing parserNode standalone execution with state...');
  const agentStateInput = {
    resumeSections: sampleResume,
    jdRequirements: sampleJD,
  };

  const nodeOutput = await parserNode(agentStateInput);

  assert.ok(nodeOutput.structuredResume, 'Should return structuredResume');
  assert.ok(nodeOutput.structuredJD, 'Should return structuredJD');
  assert.strictEqual(nodeOutput.status, 'parsed');

  // Verify comparison metadata
  const comparison = nodeOutput.structuredJD.comparison;
  assert.ok(comparison, 'Comparison metadata must be present on structuredJD');

  // Matched skills should include Node.js, TypeScript, Docker, PostgreSQL (from resume text or skills)
  assert.ok(comparison.matchedSkills.includes('Node.js'));
  assert.ok(comparison.matchedSkills.includes('TypeScript'));
  assert.ok(comparison.matchedSkills.includes('Docker'));
  assert.ok(comparison.matchedSkills.includes('PostgreSQL'));

  // Missing skills should include Kubernetes, Kafka
  assert.ok(comparison.missingSkills.includes('Kubernetes'));
  assert.ok(comparison.missingSkills.includes('Kafka'));

  assert.strictEqual(comparison.matchedCount, 4);
  assert.strictEqual(comparison.missingCount, 2);
  assert.strictEqual(comparison.initialMatchRatio, 0.67);

  console.log('  ✅ Comparison metrics calculated:', {
    matched: comparison.matchedSkills,
    missing: comparison.missingSkills,
    matchRatio: comparison.initialMatchRatio,
  });

  // [Test 5] Test edge cases (null or empty inputs)
  console.log('\n[Test 5] Testing parserNode edge cases (empty or null state)...');
  const emptyOutput = await parserNode({});
  assert.ok(emptyOutput.structuredResume);
  assert.deepStrictEqual(emptyOutput.structuredResume.skills, []);
  assert.deepStrictEqual(emptyOutput.structuredResume.allBulletPoints, []);
  assert.strictEqual(emptyOutput.structuredResume.totalBulletPoints, 0);

  assert.ok(emptyOutput.structuredJD);
  assert.deepStrictEqual(emptyOutput.structuredJD.requiredSkills, []);
  assert.strictEqual(emptyOutput.structuredJD.comparison.initialMatchRatio, 1.0);
  console.log('  ✅ Empty/null state safely handled without errors\n');

  // [Test 6] Integration in LangGraph StateGraph pipeline
  console.log('[Test 6] Testing parserNode integration inside LangGraph StateGraph...');
  const workflow = new StateGraph(AgentState);
  workflow.addNode('parser', parserNode);
  workflow.addEdge('__start__', 'parser');
  workflow.addEdge('parser', '__end__');

  const compiledPipeline = workflow.compile();
  const graphResult = await compiledPipeline.invoke({
    resumeSections: sampleResume,
    jdRequirements: sampleJD,
  });

  assert.ok(graphResult.structuredResume, 'Graph state must contain structuredResume');
  assert.ok(graphResult.structuredJD, 'Graph state must contain structuredJD');
  assert.strictEqual(graphResult.status, 'parsed');
  assert.strictEqual(graphResult.structuredResume.totalBulletPoints, 4);
  assert.strictEqual(graphResult.structuredJD.comparison.matchedCount, 4);

  console.log('  ✅ LangGraph pipeline executed parserNode and updated graph channels seamlessly\n');

  console.log('🎉 All Parser Agent Node tests passed successfully!\n');
}

if (require.main === module) {
  testParserNode().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testParserNode };
