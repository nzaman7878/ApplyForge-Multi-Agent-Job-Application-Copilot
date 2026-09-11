const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const parseJobDescription = require('../src/services/parsers/jdParser');
const parsers = require('../src/services/parsers/index');
const User = require('../src/models/User');
const JobDescription = require('../src/models/JobDescription');

async function testJdParser() {
  console.log('🧪 Testing Job Description Parser Service...\n');

  // Sample full real-world JD
  const sampleJdText = `
Role: Senior Full-Stack Engineer
Company: CloudScale AI
Location: San Francisco, CA (Remote Friendly)

ABOUT THE ROLE:
CloudScale AI is building the next generation of developer productivity tools. We are seeking an exceptional Senior Full-Stack Engineer to scale our distributed systems and client applications.

RESPONSIBILITIES:
- Architect, build, and maintain scalable microservices handling millions of API requests daily.
- Develop intuitive user interfaces using React, Next.js, and Tailwind CSS.
- Collaborate with product and design teams in an Agile sprint cadence.
- Ensure high code quality through automated unit testing and CI/CD pipelines.

MINIMUM QUALIFICATIONS:
- 5+ years of software engineering experience building production applications.
- At least 3 years of hands-on experience with Node.js and TypeScript.
- Strong proficiency in React, PostgreSQL, Redis, and RESTful APIs.
- Bachelor's degree in Computer Science, Engineering, or equivalent practical experience.
- Solid understanding of data structures, algorithms, and distributed systems.

PREFERRED QUALIFICATIONS:
- Experience with Docker, Kubernetes, and AWS (ECS, S3, RDS).
- Familiarity with GraphQL and WebSockets is a plus.
- Background in LangChain or building LLM-powered applications.
- Demonstrated experience in Test-Driven Development (TDD).
`;

  try {
    // 1. Test parsing structured JD
    console.log('[Test 1] Parsing structured JD with explicit sections...');
    const parsed = parseJobDescription(sampleJdText);

    // Verify skills
    console.log('\n- Verifying Skills extraction:');
    const expectedSkills = [
      'Node.js',
      'TypeScript',
      'React',
      'Next.js',
      'PostgreSQL',
      'Redis',
      'Docker',
      'Kubernetes',
      'AWS',
    ];
    for (const skill of expectedSkills) {
      if (!parsed.skills.includes(skill)) {
        throw new Error(
          `Expected skill "${skill}" was not extracted. Extracted: ${JSON.stringify(parsed.skills)}`
        );
      }
    }
    console.log(
      `  ✔ Extracted ${parsed.skills.length} skills successfully: ${parsed.skills.slice(0, 8).join(', ')}...`
    );

    // Verify experience
    console.log('\n- Verifying Experience requirements extraction:');
    if (!Array.isArray(parsed.experience) || parsed.experience.length === 0) {
      throw new Error(`Experience requirements missing. Got: ${JSON.stringify(parsed.experience)}`);
    }
    const has5Years = parsed.experience.some((e) => e.includes('5+') || e.includes('5 years'));
    const has3Years = parsed.experience.some((e) => e.includes('3 years'));
    if (!has5Years && !has3Years) {
      throw new Error(
        `Expected tenure requirement (5+ years / 3 years) missing: ${JSON.stringify(parsed.experience)}`
      );
    }
    console.log(`  ✔ Extracted ${parsed.experience.length} experience entries:`);
    parsed.experience.forEach((exp) => console.log(`    • ${exp}`));

    // Verify qualifications
    console.log('\n- Verifying Qualifications extraction:');
    if (!Array.isArray(parsed.qualifications) || parsed.qualifications.length === 0) {
      throw new Error(`Qualifications missing. Got: ${JSON.stringify(parsed.qualifications)}`);
    }
    const hasDegree = parsed.qualifications.some((q) => /bachelor|computer\s+science/i.test(q));
    if (!hasDegree) {
      throw new Error(
        `Expected degree qualification not found: ${JSON.stringify(parsed.qualifications)}`
      );
    }
    console.log(`  ✔ Extracted ${parsed.qualifications.length} qualification entries:`);
    parsed.qualifications.forEach((q) => console.log(`    • ${q}`));

    // Verify nice-to-have
    console.log('\n- Verifying Nice-to-Have / Preferred extraction:');
    if (!Array.isArray(parsed.niceToHave) || parsed.niceToHave.length === 0) {
      throw new Error(`Nice-to-have items missing. Got: ${JSON.stringify(parsed.niceToHave)}`);
    }
    const hasDockerOrK8s = parsed.niceToHave.some((item) =>
      /docker|kubernetes|aws|graphql/i.test(item)
    );
    if (!hasDockerOrK8s) {
      throw new Error(
        `Expected preferred qualifications not found: ${JSON.stringify(parsed.niceToHave)}`
      );
    }
    console.log(`  ✔ Extracted ${parsed.niceToHave.length} nice-to-have items:`);
    parsed.niceToHave.forEach((nth) => console.log(`    • ${nth}`));

    // 2. Test re-export in parsers index
    console.log('\n[Test 2] Testing parsers/index re-export...');
    if (typeof parsers.parseJobDescription !== 'function') {
      throw new Error('parseJobDescription is not exported on parsers index');
    }
    const reExportParsed = parsers.parseJobDescription(sampleJdText);
    if (reExportParsed.skills.length !== parsed.skills.length) {
      throw new Error('Re-exported function produced inconsistent output');
    }
    console.log('✔ parseJobDescription is cleanly re-exported in parsers/index');

    // 3. Test safety on empty and null inputs
    console.log('\n[Test 3] Testing safety on empty, null, and non-string inputs...');
    const emptyParsed = parseJobDescription('');
    const nullParsed = parseJobDescription(null);
    const undefinedParsed = parseJobDescription(undefined);
    const numberParsed = parseJobDescription(12345);

    for (const [name, res] of Object.entries({
      emptyParsed,
      nullParsed,
      undefinedParsed,
      numberParsed,
    })) {
      if (
        !Array.isArray(res.skills) ||
        !Array.isArray(res.experience) ||
        !Array.isArray(res.qualifications) ||
        !Array.isArray(res.niceToHave)
      ) {
        throw new Error(`Safety fallback failed for ${name}`);
      }
    }
    console.log('✔ Safely handled empty, null, and malformed inputs with default schema');

    // 4. Test freeform text without standard headings
    console.log('\n[Test 4] Testing freeform JD text without standard section headers...');
    const freeformText = `
We are looking for a Python and FastAPI engineer with 4+ years of backend experience.
Must hold a BS in Computer Science or Software Engineering.
Experience with PostgreSQL and Docker is essential.
Bonus points if you know Kubernetes or machine learning models.
`;
    const freeformParsed = parseJobDescription(freeformText);
    if (!freeformParsed.skills.includes('Python') || !freeformParsed.skills.includes('FastAPI')) {
      throw new Error(
        `Failed to extract skills from freeform text: ${JSON.stringify(freeformParsed.skills)}`
      );
    }
    if (freeformParsed.experience.length === 0) {
      throw new Error('Failed to extract experience from freeform text');
    }
    if (freeformParsed.qualifications.length === 0) {
      throw new Error('Failed to extract qualifications from freeform text');
    }
    if (freeformParsed.niceToHave.length === 0) {
      throw new Error('Failed to extract niceToHave from freeform text');
    }
    console.log('✔ Successfully extracted requirements from freeform text');

    // 5. Test MongoDB persistence in JobDescription model
    console.log(
      '\n[Test 5] Validating extracted object saves directly to JobDescription model in MongoDB...'
    );
    const mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const testUser = new User({
      name: 'Parser Tester',
      email: 'parser.tester@example.com',
      passwordHash: 'SuperSecret123!',
    });
    await testUser.save();

    const jdDoc = new JobDescription({
      userId: testUser._id,
      company: 'CloudScale AI',
      roleTitle: 'Senior Full-Stack Engineer',
      rawText: sampleJdText,
      parsedRequirements: parsed,
      source: 'paste',
    });

    const savedDoc = await jdDoc.save();
    if (!savedDoc._id) {
      throw new Error('Failed to save parsed requirements into JobDescription model');
    }

    const fetchedDoc = await JobDescription.findById(savedDoc._id);
    if (fetchedDoc.parsedRequirements.skills.length !== parsed.skills.length) {
      throw new Error('Stored skills count does not match parsed output');
    }
    if (fetchedDoc.parsedRequirements.experience.length !== parsed.experience.length) {
      throw new Error('Stored experience count does not match parsed output');
    }
    console.log(
      '✔ parsedRequirements successfully validated and persisted in JobDescription model'
    );

    await mongoose.disconnect();
    await mongoServer.stop();

    console.log('\n=============================================');
    console.log('🎉 ALL JD PARSER SERVICE TESTS PASSED');
    console.log('=============================================\n');
  } catch (err) {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    throw err;
  }
}

testJdParser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
