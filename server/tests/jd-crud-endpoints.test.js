const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

// Set test environment configuration
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5005';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const JobDescription = require('../src/models/JobDescription');
const { signToken } = require('../src/utils/jwt');

async function testJdCrudEndpoints() {
  console.log('🧪 Testing JD CRUD Endpoints (GET list, GET detail, DELETE)...\n');

  let mongoServer;

  try {
    // 1. Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // 2. Create two test users to verify ownership and isolation
    const userA = new User({
      name: 'Alice Recruiter',
      email: 'alice@company.com',
      passwordHash: 'PasswordHash123!',
    });
    await userA.save();
    const tokenA = signToken(userA._id);

    const userB = new User({
      name: 'Bob Hiring',
      email: 'bob@enterprise.io',
      passwordHash: 'PasswordHash123!',
    });
    await userB.save();
    const tokenB = signToken(userB._id);

    console.log(`✔ Created user A: ${userA.email} (${userA._id})`);
    console.log(`✔ Created user B: ${userB.email} (${userB._id})`);

    // =========================================================================
    // PART 1: GET /api/jds (List user JDs)
    // =========================================================================
    console.log('\n--- PART 1: GET /api/jds (List) ---');

    // [Test 1] 401 on unauthorized GET /api/jds
    console.log('\n[Test 1] GET /api/jds without Authorization header (expect 401)...');
    const noAuthListRes = await request(app).get('/api/jds').expect(401);
    if (noAuthListRes.body.code !== 'TOKEN_MISSING') {
      throw new Error(`Expected TOKEN_MISSING, got: ${JSON.stringify(noAuthListRes.body)}`);
    }
    console.log('✔ Correctly rejected unauthorized list request (401 TOKEN_MISSING)');

    // [Test 2] Empty list when user has no JDs
    console.log('\n[Test 2] GET /api/jds for user with zero JDs (expect empty array)...');
    const emptyListRes = await request(app)
      .get('/api/jds')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    if (!Array.isArray(emptyListRes.body) || emptyListRes.body.length !== 0) {
      throw new Error(`Expected empty array, got: ${JSON.stringify(emptyListRes.body)}`);
    }
    console.log('✔ Returns empty array when no JDs created');

    // Seed JDs: 2 for User A, 1 for User B
    const jdA1 = new JobDescription({
      userId: userA._id,
      company: 'Alpha Corp',
      roleTitle: 'Frontend Engineer',
      rawText: 'Requirements: 3+ years React, TypeScript, and CSS.',
      parsedRequirements: {
        skills: ['React', 'TypeScript', 'CSS'],
        experience: ['3+ years React'],
        qualifications: [],
        niceToHave: [],
      },
      source: 'paste',
      createdAt: new Date(Date.now() - 20000), // older
    });
    await jdA1.save();

    const jdA2 = new JobDescription({
      userId: userA._id,
      company: 'Beta Labs',
      roleTitle: 'Full Stack Architect',
      rawText: 'Requirements: 7+ years Node.js, GraphQL, AWS, and Docker.',
      parsedRequirements: {
        skills: ['Node.js', 'GraphQL', 'AWS', 'Docker'],
        experience: ['7+ years'],
        qualifications: ["Bachelor's Degree in CS"],
        niceToHave: ['Kubernetes is a plus'],
      },
      source: 'paste',
      createdAt: new Date(Date.now() - 5000), // newer
    });
    await jdA2.save();

    const jdB1 = new JobDescription({
      userId: userB._id,
      company: 'Gamma Systems',
      roleTitle: 'DevOps Engineer',
      rawText: 'Requirements: 4+ years Terraform, Kubernetes, and CI/CD.',
      parsedRequirements: {
        skills: ['Terraform', 'Kubernetes'],
        experience: ['4+ years'],
        qualifications: [],
        niceToHave: [],
      },
      source: 'paste',
      createdAt: new Date(),
    });
    await jdB1.save();

    // [Test 3] Listing User A's JDs in reverse chronological order
    console.log('\n[Test 3] GET /api/jds for User A (expect 2 JDs, newest first)...');
    const userAListRes = await request(app)
      .get('/api/jds')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const userAJds = userAListRes.body;
    if (!Array.isArray(userAJds) || userAJds.length !== 2) {
      throw new Error(`Expected 2 JDs for User A, got: ${userAJds.length}`);
    }
    if (userAJds[0].id !== jdA2._id.toString()) {
      throw new Error(`Expected newest JD (Beta Labs) first, got: ${userAJds[0].company}`);
    }
    if (userAJds[1].id !== jdA1._id.toString()) {
      throw new Error(`Expected older JD (Alpha Corp) second, got: ${userAJds[1].company}`);
    }
    console.log('✔ User A receives their 2 JDs in reverse chronological order:');
    console.log(`  1: ${userAJds[0].company} - ${userAJds[0].roleTitle}`);
    console.log(`  2: ${userAJds[1].company} - ${userAJds[1].roleTitle}`);

    // [Test 4] User isolation on list (User B only sees 1 JD)
    console.log('\n[Test 4] Verifying user isolation on GET /api/jds...');
    const userBListRes = await request(app)
      .get('/api/jds')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    if (userBListRes.body.length !== 1 || userBListRes.body[0].id !== jdB1._id.toString()) {
      throw new Error(`Expected 1 JD for User B, got: ${JSON.stringify(userBListRes.body)}`);
    }
    console.log('✔ User isolation verified: User B only sees Gamma Systems');

    // [Test 5] Query wrap format on GET /api/jds?wrap=true
    console.log('\n[Test 5] GET /api/jds?wrap=true (expect wrapped object)...');
    const wrapRes = await request(app)
      .get('/api/jds?wrap=true')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    if (!wrapRes.body.jobDescriptions || wrapRes.body.count !== 2) {
      throw new Error(`Expected wrapped object with count 2, got: ${JSON.stringify(wrapRes.body)}`);
    }
    console.log('✔ Query parameter wrap=true returns wrapped object with count');

    // =========================================================================
    // PART 2: GET /api/jds/:id (Detail view)
    // =========================================================================
    console.log('\n--- PART 2: GET /api/jds/:id (Detail) ---');

    // [Test 6] 401 without auth token
    console.log('\n[Test 6] GET /api/jds/:id without token (expect 401)...');
    const noAuthDetailRes = await request(app)
      .get(`/api/jds/${jdA1._id}`)
      .expect(401);
    if (noAuthDetailRes.body.code !== 'TOKEN_MISSING') {
      throw new Error(`Expected TOKEN_MISSING, got: ${JSON.stringify(noAuthDetailRes.body)}`);
    }
    console.log('✔ Rejected unauthorized detail request (401)');

    // [Test 7] 400 on invalid ObjectId
    console.log('\n[Test 7] GET /api/jds/:id with invalid ID format (expect 400)...');
    const invalidIdRes = await request(app)
      .get('/api/jds/not-a-valid-id')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);

    if (invalidIdRes.body.code !== 'INVALID_JD_ID') {
      throw new Error(`Expected INVALID_JD_ID, got: ${JSON.stringify(invalidIdRes.body)}`);
    }
    console.log('✔ Correctly rejected malformed ObjectId format (400 INVALID_JD_ID)');

    // [Test 8] 404 on non-existent ObjectId
    console.log('\n[Test 8] GET /api/jds/:id with non-existent ObjectId (expect 404)...');
    const nonExistentId = new mongoose.Types.ObjectId();
    const notFoundRes = await request(app)
      .get(`/api/jds/${nonExistentId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    if (notFoundRes.body.code !== 'JD_NOT_FOUND') {
      throw new Error(`Expected JD_NOT_FOUND, got: ${JSON.stringify(notFoundRes.body)}`);
    }
    console.log('✔ Correctly handled non-existent JD ID (404 JD_NOT_FOUND)');

    // [Test 9] Cross-user access protection: User B attempts to access User A's JD
    console.log('\n[Test 9] Cross-user access protection: User B attempts to access User A\'s JD (expect 404)...');
    const crossAccessRes = await request(app)
      .get(`/api/jds/${jdA2._id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    if (crossAccessRes.body.code !== 'JD_NOT_FOUND') {
      throw new Error(`Expected cross-user JD to return 404, got: ${JSON.stringify(crossAccessRes.body)}`);
    }
    console.log('✔ Cross-user access blocked: User A\'s JD is invisible to User B (404)');

    // [Test 10] Valid detail retrieval with full rawText and parsedRequirements
    console.log('\n[Test 10] GET /api/jds/:id for owner with valid ID (expect 200 + full payload)...');
    const detailRes = await request(app)
      .get(`/api/jds/${jdA2._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const fullJd = detailRes.body;
    if (fullJd.company !== 'Beta Labs' || fullJd.roleTitle !== 'Full Stack Architect') {
      throw new Error(`Unexpected JD details: ${JSON.stringify(fullJd)}`);
    }
    if (!fullJd.rawText || !fullJd.parsedRequirements) {
      throw new Error('Expected rawText and parsedRequirements in detail response');
    }
    if (!fullJd.parsedRequirements.skills.includes('Node.js')) {
      throw new Error('Expected parsed skills in detail response');
    }
    console.log('✔ Retrieved full JD with parsedRequirements:');
    console.log(`  Skills: [${fullJd.parsedRequirements.skills.join(', ')}]`);
    console.log(`  Experience: [${fullJd.parsedRequirements.experience.join(', ')}]`);

    // =========================================================================
    // PART 3: DELETE /api/jds/:id
    // =========================================================================
    console.log('\n--- PART 3: DELETE /api/jds/:id ---');

    // [Test 11] 401 without auth token
    console.log('\n[Test 11] DELETE /api/jds/:id without token (expect 401)...');
    const noAuthDelRes = await request(app)
      .delete(`/api/jds/${jdA1._id}`)
      .expect(401);
    if (noAuthDelRes.body.code !== 'TOKEN_MISSING') {
      throw new Error(`Expected TOKEN_MISSING, got: ${JSON.stringify(noAuthDelRes.body)}`);
    }
    console.log('✔ Rejected unauthorized DELETE request (401)');

    // [Test 12] 400 on invalid ObjectId format
    console.log('\n[Test 12] DELETE /api/jds/:id with invalid ID format (expect 400)...');
    const invalidDelRes = await request(app)
      .delete('/api/jds/bad-id-format')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);

    if (invalidDelRes.body.code !== 'INVALID_JD_ID') {
      throw new Error(`Expected INVALID_JD_ID, got: ${JSON.stringify(invalidDelRes.body)}`);
    }
    console.log('✔ Rejected invalid ID format on delete (400)');

    // [Test 13] Ownership guard: User B attempts to delete User A's JD (expect 404)
    console.log('\n[Test 13] Ownership guard: User B attempts to delete User A\'s JD (expect 404)...');
    const crossDeleteRes = await request(app)
      .delete(`/api/jds/${jdA1._id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    if (crossDeleteRes.body.code !== 'JD_NOT_FOUND') {
      throw new Error(`Expected 404 on cross-user delete, got: ${JSON.stringify(crossDeleteRes.body)}`);
    }

    // Verify document was NOT deleted
    const stillExists = await JobDescription.findById(jdA1._id);
    if (!stillExists) {
      throw new Error('Document was unexpectedly deleted during cross-user delete test');
    }
    console.log('✔ Ownership guard verified: User B could not delete User A\'s JD (404)');

    // [Test 14] Owner successfully deletes JD (expect 200)
    console.log('\n[Test 14] Owner User A deletes jdA1 (expect 200)...');
    const deleteRes = await request(app)
      .delete(`/api/jds/${jdA1._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    if (deleteRes.body.id !== jdA1._id.toString() || !deleteRes.body.message.includes('deleted')) {
      throw new Error(`Unexpected delete response: ${JSON.stringify(deleteRes.body)}`);
    }

    // Verify removed from MongoDB
    const docInDb = await JobDescription.findById(jdA1._id);
    if (docInDb) {
      throw new Error('Job description still exists in MongoDB after successful deletion');
    }
    console.log(`✔ JD ${jdA1._id} successfully removed from MongoDB`);

    // [Test 15] Subsequent GET /:id returns 404 and list count is decremented
    console.log('\n[Test 15] Subsequent GET /:id and list count verification...');
    await request(app)
      .get(`/api/jds/${jdA1._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    const updatedListRes = await request(app)
      .get('/api/jds')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    if (updatedListRes.body.length !== 1) {
      throw new Error(`Expected list count to decrease to 1, got: ${updatedListRes.body.length}`);
    }
    console.log('✔ Subsequent detail request returned 404 and list count decremented to 1');

    console.log('\n=============================================');
    console.log('🎉 ALL JD CRUD ENDPOINTS TESTS PASSED');
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

testJdCrudEndpoints()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
