const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

// Set test environment configuration
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5003';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const JobDescription = require('../src/models/JobDescription');
const { signToken } = require('../src/utils/jwt');

async function testJdCreateEndpoint() {
  console.log('🧪 Testing POST /api/jds Endpoint (Paste)...\n');

  let mongoServer;

  try {
    // 1. Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // 2. Create test user and token
    const testUser = new User({
      name: 'Dev Recruiter',
      email: 'recruiter@techforge.io',
      passwordHash: 'PasswordHash123!',
    });
    await testUser.save();
    const token = signToken(testUser._id);
    console.log(`✔ Created test user: ${testUser.email} (ID: ${testUser._id})`);

    // [Test 1] 401 when Authorization header is missing
    console.log('\n[Test 1] POST /api/jds without Authorization header (expect 401)...');
    const noAuthRes = await request(app)
      .post('/api/jds')
      .send({
        company: 'Stripe',
        roleTitle: 'Senior Backend Engineer',
        rawText: 'Looking for a Senior Backend Engineer with Node.js and AWS experience.',
      })
      .expect(401);

    if (noAuthRes.body.code !== 'TOKEN_MISSING') {
      throw new Error(`Expected TOKEN_MISSING, got: ${JSON.stringify(noAuthRes.body)}`);
    }
    console.log('✔ Correctly rejected unauthorized request (401 TOKEN_MISSING)');

    // [Test 2] 401 when Authorization token is invalid
    console.log('\n[Test 2] POST /api/jds with invalid Authorization token (expect 401)...');
    const invalidTokenRes = await request(app)
      .post('/api/jds')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .send({
        company: 'Stripe',
        roleTitle: 'Senior Backend Engineer',
        rawText: 'Looking for a Senior Backend Engineer with Node.js and AWS experience.',
      })
      .expect(401);

    if (invalidTokenRes.body.code !== 'TOKEN_INVALID') {
      throw new Error(`Expected TOKEN_INVALID, got: ${JSON.stringify(invalidTokenRes.body)}`);
    }
    console.log('✔ Correctly rejected invalid token (401 TOKEN_INVALID)');

    // [Test 3] 400 when company is missing
    console.log('\n[Test 3] POST /api/jds with missing company (expect 400)...');
    const noCompanyRes = await request(app)
      .post('/api/jds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roleTitle: 'Full Stack Engineer',
        rawText: 'Requirements: 4+ years React and Node.js experience.',
      })
      .expect(400);

    if (!JSON.stringify(noCompanyRes.body).includes('Company name is required')) {
      throw new Error(
        `Expected validation error for company, got: ${JSON.stringify(noCompanyRes.body)}`
      );
    }
    console.log('✔ Correctly rejected missing company (400 validation error)');

    // [Test 4] 400 when roleTitle is missing
    console.log('\n[Test 4] POST /api/jds with missing roleTitle (expect 400)...');
    const noRoleRes = await request(app)
      .post('/api/jds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company: 'Vercel',
        rawText: 'Requirements: 5+ years Next.js and TypeScript experience.',
      })
      .expect(400);

    if (!JSON.stringify(noRoleRes.body).includes('Role title is required')) {
      throw new Error(
        `Expected validation error for roleTitle, got: ${JSON.stringify(noRoleRes.body)}`
      );
    }
    console.log('✔ Correctly rejected missing roleTitle (400 validation error)');

    // [Test 5] 400 when rawText is missing or too short
    console.log('\n[Test 5] POST /api/jds with empty or too short rawText (expect 400)...');
    const shortTextRes = await request(app)
      .post('/api/jds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company: 'Airbnb',
        roleTitle: 'Frontend Dev',
        rawText: 'Short',
      })
      .expect(400);

    if (!JSON.stringify(shortTextRes.body).includes('at least 10 characters')) {
      throw new Error(
        `Expected validation error for rawText length, got: ${JSON.stringify(shortTextRes.body)}`
      );
    }
    console.log('✔ Correctly rejected short rawText (400 validation error)');

    // [Test 6] 201 when valid paste payload is provided
    console.log('\n[Test 6] POST /api/jds with complete job description text (expect 201)...');
    const sampleJdText = `
Company: CloudScale AI
Role: Lead Backend Engineer
Location: Remote (US)

ABOUT THE ROLE:
We are seeking a Lead Backend Engineer to spearhead our high-scale data ingestion engine.

REQUIREMENTS:
- 5+ years of experience developing distributed systems and REST/GraphQL APIs
- Strong proficiency in Node.js, TypeScript, and Go
- Proven expertise in MongoDB, PostgreSQL, and Redis
- Hands-on experience with Docker, Kubernetes, and AWS (ECS, S3, Lambda)
- Bachelor's degree in Computer Science or equivalent practical experience

NICE TO HAVE:
- Experience with Kafka or RabbitMQ event streaming is a plus
- Familiarity with Next.js or React is preferred
- Master's degree in Computer Science is a bonus
`;

    const createRes = await request(app)
      .post('/api/jds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company: 'CloudScale AI',
        roleTitle: 'Lead Backend Engineer',
        rawText: sampleJdText,
      })
      .expect(201);

    const jd = createRes.body;

    if (!jd.id && !jd._id) {
      throw new Error(`Expected jd ID in response, got: ${JSON.stringify(jd)}`);
    }
    if (jd.company !== 'CloudScale AI') {
      throw new Error(`Expected company "CloudScale AI", got: "${jd.company}"`);
    }
    if (jd.roleTitle !== 'Lead Backend Engineer') {
      throw new Error(`Expected roleTitle "Lead Backend Engineer", got: "${jd.roleTitle}"`);
    }
    if (jd.source !== 'paste') {
      throw new Error(`Expected source "paste", got: "${jd.source}"`);
    }

    // Verify parsedRequirements
    const reqs = jd.parsedRequirements;
    if (!reqs) {
      throw new Error('Expected parsedRequirements in response payload');
    }

    console.log(`✔ Extracted skills: [${reqs.skills.join(', ')}]`);
    console.log(`✔ Extracted experience entries: [${reqs.experience.join(' | ')}]`);
    console.log(`✔ Extracted qualifications: [${reqs.qualifications.join(' | ')}]`);
    console.log(`✔ Extracted nice-to-have: [${reqs.niceToHave.join(' | ')}]`);

    // Verify skills detection
    const expectedSkills = [
      'Node.js',
      'TypeScript',
      'Go',
      'MongoDB',
      'PostgreSQL',
      'Redis',
      'Docker',
      'Kubernetes',
      'AWS',
    ];
    for (const skill of expectedSkills) {
      if (!reqs.skills.includes(skill)) {
        throw new Error(`Expected extracted skills to include "${skill}"`);
      }
    }

    // Verify experience detection
    const has5Years = reqs.experience.some((exp) => exp.includes('5+ years') || exp.includes('5'));
    if (!has5Years) {
      throw new Error('Expected experience to detect 5+ years requirement');
    }

    // Verify qualifications detection
    const hasDegree = reqs.qualifications.some(
      (q) => q.toLowerCase().includes('bachelor') || q.toLowerCase().includes('computer science')
    );
    if (!hasDegree) {
      throw new Error("Expected qualifications to detect Bachelor's degree requirement");
    }

    // Verify nice to have detection
    const hasKafkaOrPlus = reqs.niceToHave.some(
      (nth) => nth.toLowerCase().includes('kafka') || nth.toLowerCase().includes('plus')
    );
    if (!hasKafkaOrPlus) {
      throw new Error('Expected niceToHave to extract preferred qualifications');
    }

    // Verify MongoDB storage
    const storedJd = await JobDescription.findById(jd.id || jd._id);
    if (!storedJd) {
      throw new Error('JobDescription document not found in MongoDB after 201 response');
    }
    if (storedJd.userId.toString() !== testUser._id.toString()) {
      throw new Error(`Stored userId ${storedJd.userId} does not match test user ${testUser._id}`);
    }
    console.log(`✔ Job description saved to MongoDB with ID: ${storedJd._id}`);

    // [Test 7] User isolation test
    console.log('\n[Test 7] Verifying user isolation across multiple accounts...');
    const anotherUser = new User({
      name: 'Another User',
      email: 'another@example.com',
      passwordHash: 'AnotherSecretPass123!',
    });
    await anotherUser.save();
    const anotherToken = signToken(anotherUser._id);

    const user2Res = await request(app)
      .post('/api/jds')
      .set('Authorization', `Bearer ${anotherToken}`)
      .send({
        company: 'Acme Corp',
        roleTitle: 'Staff Frontend Engineer',
        rawText:
          'Looking for a Staff Frontend Engineer with 7+ years of React and CSS architecture experience.',
      })
      .expect(201);

    const user2Jd = await JobDescription.findById(user2Res.body.id || user2Res.body._id);
    if (user2Jd.userId.toString() !== anotherUser._id.toString()) {
      throw new Error('Job description userId should match second user');
    }
    console.log('✔ Verified user isolation and accurate userId mapping');

    console.log('\n=============================================');
    console.log('🎉 ALL POST /api/jds ENDPOINT TESTS PASSED');
    console.log('=============================================\n');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

testJdCreateEndpoint()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
