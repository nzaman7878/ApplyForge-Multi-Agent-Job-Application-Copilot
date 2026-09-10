const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

// Set dummy JWT secret and env vars before loading app
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5003';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const { signToken } = require('../src/utils/jwt');

async function testResumeGetEndpoints() {
  console.log(
    '🧪 Testing GET /api/resumes (List) and GET /api/resumes/:id (Detail) Endpoints...\n'
  );

  let mongoServer;

  try {
    // 1. Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // 2. Create User A and User B
    const userA = new User({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      passwordHash: 'Password123!',
    });
    await userA.save();
    const tokenA = signToken(userA._id);

    const userB = new User({
      name: 'Bob Smith',
      email: 'bob@example.com',
      passwordHash: 'Password123!',
    });
    await userB.save();
    const tokenB = signToken(userB._id);

    console.log('✔ Created test users: Alice and Bob');

    // 3. Test GET /api/resumes 401 without auth token
    console.log('\n[Test 1] GET /api/resumes without token (expect 401)...');
    const noAuthRes = await request(app).get('/api/resumes').expect(401);
    if (noAuthRes.body.code !== 'TOKEN_MISSING') {
      throw new Error(`Expected TOKEN_MISSING code, got: ${JSON.stringify(noAuthRes.body)}`);
    }
    console.log('✔ Rejected unauthorized request (401 TOKEN_MISSING)');

    // 4. Test GET /api/resumes with auth when user has no resumes
    console.log('\n[Test 2] GET /api/resumes for user with no resumes (expect empty list)...');
    const emptyListRes = await request(app)
      .get('/api/resumes')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const emptyData = Array.isArray(emptyListRes.body)
      ? emptyListRes.body
      : emptyListRes.body.resumes;

    if (!Array.isArray(emptyData) || emptyData.length !== 0) {
      throw new Error(`Expected empty array, got: ${JSON.stringify(emptyListRes.body)}`);
    }
    console.log('✔ Returns empty list when no resumes exist');

    // 5. Seed resumes: 2 for Alice, 1 for Bob
    const aliceResume1 = new Resume({
      userId: userA._id,
      originalFilename: 'Alice_SWE_Resume_2025.pdf',
      rawText: 'Alice Johnson SWE Resume content',
      parsedSections: {
        contact: { name: 'Alice Johnson', email: 'alice@example.com' },
        summary: 'Experienced Software Engineer',
        skills: ['JavaScript', 'Node.js', 'React'],
      },
      uploadedAt: new Date(Date.now() - 100000), // earlier
    });
    await aliceResume1.save();

    const aliceResume2 = new Resume({
      userId: userA._id,
      originalFilename: 'Alice_Lead_Resume_2026.docx',
      rawText: 'Alice Johnson Lead Resume content',
      parsedSections: {
        contact: { name: 'Alice Johnson', email: 'alice@example.com' },
        summary: 'Tech Lead with distributed systems experience',
        skills: ['TypeScript', 'Go', 'Kubernetes'],
      },
      uploadedAt: new Date(), // latest
    });
    await aliceResume2.save();

    const bobResume = new Resume({
      userId: userB._id,
      originalFilename: 'Bob_DevOps_Resume.pdf',
      rawText: 'Bob Smith DevOps Resume content',
      parsedSections: {
        contact: { name: 'Bob Smith', email: 'bob@example.com' },
        summary: 'Cloud Infrastructure Architect',
        skills: ['AWS', 'Terraform', 'Docker'],
      },
      uploadedAt: new Date(),
    });
    await bobResume.save();

    console.log('✔ Seeded 2 resumes for Alice and 1 resume for Bob');

    // 6. Test GET /api/resumes list items and order
    console.log('\n[Test 3] GET /api/resumes for Alice (expect 2 items, sorted newest first)...');
    const aliceListRes = await request(app)
      .get('/api/resumes')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const aliceResumes = Array.isArray(aliceListRes.body)
      ? aliceListRes.body
      : aliceListRes.body.resumes;

    if (!Array.isArray(aliceResumes) || aliceResumes.length !== 2) {
      throw new Error(`Expected 2 resumes for Alice, got ${aliceResumes.length}`);
    }

    // Verify fields (id, name, uploadedAt)
    const firstItem = aliceResumes[0];
    if (!firstItem.id || !firstItem.name || !firstItem.uploadedAt) {
      throw new Error(`Resume item missing required fields: ${JSON.stringify(firstItem)}`);
    }

    // Verify newest first
    if (firstItem.id !== aliceResume2._id.toString()) {
      throw new Error('Resumes not sorted descending by uploadedAt (newest first)');
    }
    console.log(`✔ List returned 2 resumes with (id, name, uploadedAt) sorted newest first`);
    console.log(`  - 1st: "${firstItem.name}" (ID: ${firstItem.id})`);
    console.log(`  - 2nd: "${aliceResumes[1].name}" (ID: ${aliceResumes[1].id})`);

    // 7. Test User Isolation on GET /api/resumes
    console.log(
      '\n[Test 4] Verifying user isolation on GET /api/resumes (Bob should only see 1)...'
    );
    const bobListRes = await request(app)
      .get('/api/resumes')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const bobResumes = Array.isArray(bobListRes.body) ? bobListRes.body : bobListRes.body.resumes;

    if (bobResumes.length !== 1 || bobResumes[0].id !== bobResume._id.toString()) {
      throw new Error(`User isolation failed: Bob received ${JSON.stringify(bobResumes)}`);
    }
    console.log('✔ User isolation verified: Bob only sees his own resume');

    // 8. Test GET /api/resumes/:id without auth
    console.log('\n[Test 5] GET /api/resumes/:id without token (expect 401)...');
    await request(app).get(`/api/resumes/${aliceResume1._id}`).expect(401);
    console.log('✔ Detail endpoint rejected unauthorized request');

    // 9. Test GET /api/resumes/:id with invalid ObjectId format
    console.log('\n[Test 6] GET /api/resumes/:id with invalid ID format (expect 400)...');
    const invalidIdRes = await request(app)
      .get('/api/resumes/not-a-valid-id')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);

    if (invalidIdRes.body.code !== 'INVALID_RESUME_ID') {
      throw new Error(`Expected INVALID_RESUME_ID, got: ${JSON.stringify(invalidIdRes.body)}`);
    }
    console.log('✔ Correctly handled invalid ObjectId format (400)');

    // 10. Test GET /api/resumes/:id with non-existent ObjectId
    console.log('\n[Test 7] GET /api/resumes/:id with non-existent ID (expect 404)...');
    const randomId = new mongoose.Types.ObjectId();
    const notFoundRes = await request(app)
      .get(`/api/resumes/${randomId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    if (notFoundRes.body.code !== 'RESUME_NOT_FOUND') {
      throw new Error(`Expected RESUME_NOT_FOUND, got: ${JSON.stringify(notFoundRes.body)}`);
    }
    console.log('✔ Correctly handled non-existent resume ID (404)');

    // 11. Test Cross-user access forbidden (Bob tries to access Alice's resume)
    console.log(
      "\n[Test 8] Cross-user access check: Bob attempts GET on Alice's resume (expect 404)..."
    );
    await request(app)
      .get(`/api/resumes/${aliceResume1._id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
    console.log("✔ Cross-user access blocked: Alice's resume invisible to Bob (404)");

    // 12. Test GET /api/resumes/:id success with full sections
    console.log(
      '\n[Test 9] GET /api/resumes/:id for Alice with valid ID (expect 200 + full sections)...'
    );
    const detailRes = await request(app)
      .get(`/api/resumes/${aliceResume2._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const detail = detailRes.body;
    if (detail.id !== aliceResume2._id.toString()) {
      throw new Error(`Expected resume ID ${aliceResume2._id}, got ${detail.id}`);
    }
    if (detail.originalFilename !== 'Alice_Lead_Resume_2026.docx') {
      throw new Error(
        `Expected originalFilename Alice_Lead_Resume_2026.docx, got ${detail.originalFilename}`
      );
    }
    if (!detail.parsedSections || !detail.parsedSections.contact || !detail.parsedSections.skills) {
      throw new Error(`Parsed sections missing in detail response: ${JSON.stringify(detail)}`);
    }
    if (!detail.rawText) {
      throw new Error('rawText missing in detail response');
    }

    console.log('✔ Detail returned full resume with parsed sections:');
    console.log(
      `  - Contact: ${detail.parsedSections.contact.name} (${detail.parsedSections.contact.email})`
    );
    console.log(`  - Summary: ${detail.parsedSections.summary}`);
    console.log(`  - Skills: ${detail.parsedSections.skills.join(', ')}`);

    console.log('\n=============================================');
    console.log('🎉 ALL GET RESUMES ENDPOINT TESTS PASSED');
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

testResumeGetEndpoints()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
