const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Set dummy JWT secret and env vars before loading app
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5004';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const { signToken } = require('../src/utils/jwt');

async function testResumeDeleteEndpoint() {
  console.log('🧪 Testing DELETE /api/resumes/:id Endpoint...\n');

  let mongoServer;
  const tempFiles = [];

  try {
    // 1. Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // 2. Create User A and User B
    const userA = new User({
      name: 'Sarah Connor',
      email: 'sarah@example.com',
      passwordHash: 'Password123!',
    });
    await userA.save();
    const tokenA = signToken(userA._id);

    const userB = new User({
      name: 'John Connor',
      email: 'john@example.com',
      passwordHash: 'Password123!',
    });
    await userB.save();
    const tokenB = signToken(userB._id);

    console.log('✔ Created test users: Sarah (User A) and John (User B)');

    // 3. Test DELETE without auth token
    console.log('\n[Test 1] DELETE /api/resumes/:id without auth token (expect 401)...');
    const fakeId = new mongoose.Types.ObjectId();
    const noAuthRes = await request(app).delete(`/api/resumes/${fakeId}`).expect(401);
    if (noAuthRes.body.code !== 'TOKEN_MISSING') {
      throw new Error(`Expected TOKEN_MISSING code, got: ${JSON.stringify(noAuthRes.body)}`);
    }
    console.log('✔ Correctly rejected unauthorized DELETE request (401 TOKEN_MISSING)');

    // 4. Test DELETE with invalid ObjectId
    console.log('\n[Test 2] DELETE /api/resumes/:id with invalid ID format (expect 400)...');
    const invalidIdRes = await request(app)
      .delete('/api/resumes/invalid-mongo-id')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);

    if (invalidIdRes.body.code !== 'INVALID_RESUME_ID') {
      throw new Error(`Expected INVALID_RESUME_ID, got: ${JSON.stringify(invalidIdRes.body)}`);
    }
    console.log('✔ Correctly handled invalid ObjectId format (400 INVALID_RESUME_ID)');

    // 5. Test DELETE non-existent resume
    console.log('\n[Test 3] DELETE /api/resumes/:id with non-existent ID (expect 404)...');
    const notFoundRes = await request(app)
      .delete(`/api/resumes/${fakeId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);

    if (notFoundRes.body.code !== 'RESUME_NOT_FOUND') {
      throw new Error(`Expected RESUME_NOT_FOUND, got: ${JSON.stringify(notFoundRes.body)}`);
    }
    console.log('✔ Correctly handled non-existent resume ID (404 RESUME_NOT_FOUND)');

    // 6. Test Ownership Guard: User B tries to delete User A's resume
    console.log(
      "\n[Test 4] Ownership guard: User B attempts to delete User A's resume (expect 404)..."
    );
    const resumeA1 = new Resume({
      userId: userA._id,
      originalFilename: 'Sarah_Resume_Confidential.pdf',
      rawText: 'Sarah Connor Resume Content',
      parsedSections: {
        contact: { name: 'Sarah Connor', email: 'sarah@example.com' },
        summary: 'Defense Engineer',
      },
    });
    await resumeA1.save();

    await request(app)
      .delete(`/api/resumes/${resumeA1._id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    // Verify document was NOT deleted
    const stillExists = await Resume.findById(resumeA1._id);
    if (!stillExists) {
      throw new Error('Document was deleted despite unauthorized user!');
    }
    console.log("✔ Ownership guard verified: User B could not delete User A's resume (404)");

    // 7. Test Successful Deletion with physical file removal
    console.log(
      '\n[Test 5] Successful deletion: User A deletes resume + file on disk (expect 200)...'
    );
    const uploadDir = path.resolve(__dirname, '../uploads/resumes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const testFilePath = path.join(uploadDir, `test-delete-${Date.now()}.pdf`);
    fs.writeFileSync(testFilePath, '%PDF-1.4 dummy resume content for delete test');
    tempFiles.push(testFilePath);

    const resumeA2 = new Resume({
      userId: userA._id,
      originalFilename: 'Sarah_Resume_Public.pdf',
      rawText: 'Sarah Connor Public Resume',
      filePath: testFilePath,
      parsedSections: {
        contact: { name: 'Sarah Connor', email: 'sarah@example.com' },
      },
    });
    await resumeA2.save();

    if (!fs.existsSync(testFilePath)) {
      throw new Error('Test file was not created on disk');
    }

    const deleteRes = await request(app)
      .delete(`/api/resumes/${resumeA2._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    if (!deleteRes.body.message || !deleteRes.body.message.includes('deleted successfully')) {
      throw new Error(`Unexpected delete response: ${JSON.stringify(deleteRes.body)}`);
    }

    // Verify file deleted from disk
    if (fs.existsSync(testFilePath)) {
      throw new Error('Physical file still exists on disk after deletion!');
    }
    console.log('✔ Physical file successfully unlinked from disk');

    // Verify document deleted from MongoDB
    const deletedDoc = await Resume.findById(resumeA2._id);
    if (deletedDoc !== null) {
      throw new Error('MongoDB document still exists after deletion!');
    }
    console.log('✔ MongoDB document successfully removed');

    // 8. Test Safe Deletion when filePath is missing or already removed
    console.log('\n[Test 6] Safe deletion when physical file is already absent (expect 200)...');
    const resumeA3 = new Resume({
      userId: userA._id,
      originalFilename: 'Sarah_No_File_Resume.pdf',
      rawText: 'No file on disk',
      filePath: path.join(uploadDir, 'non-existent-file.pdf'),
    });
    await resumeA3.save();

    await request(app)
      .delete(`/api/resumes/${resumeA3._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const deletedDoc3 = await Resume.findById(resumeA3._id);
    if (deletedDoc3 !== null) {
      throw new Error('MongoDB document was not deleted when file was absent');
    }
    console.log('✔ Successfully deleted document even when physical file was absent');

    console.log('\n=============================================');
    console.log('🎉 ALL RESUME DELETE ENDPOINT TESTS PASSED');
    console.log('=============================================\n');
  } finally {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
        }
      } catch (err) {
        // ignore
      }
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

testResumeDeleteEndpoint()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
