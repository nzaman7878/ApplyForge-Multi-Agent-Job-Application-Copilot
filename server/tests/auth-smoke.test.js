const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Set dummy JWT secret if not configured in environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke_test_jwt_secret_applyforge_123';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'smoke_test_refresh_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5001';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');

async function runSmokeTest() {
  console.log('🚀 Starting ApplyForge Auth Flow E2E Smoke Test...\n');
  let mongoServer;

  try {
    // 0. Spin up in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory test database');

    const testUser = {
      name: 'Alex Developer',
      email: 'alex.tester@example.com',
      password: 'Password123!',
    };

    // 1. REGISTER
    console.log('\n[Step 1] Testing User Registration (POST /api/auth/register)...');
    const registerRes = await request(app).post('/api/auth/register').send(testUser).expect(201);

    if (!registerRes.body.accessToken || !registerRes.body.refreshToken) {
      throw new Error('Registration failed to return accessToken or refreshToken');
    }
    if (registerRes.body.user.passwordHash || registerRes.body.user.refreshToken) {
      throw new Error('Registration leaked passwordHash or refreshToken in user object');
    }
    console.log(
      `✔ Registered user: ${registerRes.body.user.email} (ID: ${registerRes.body.user.id})`
    );

    // 2. LOGIN
    console.log('\n[Step 2] Testing User Login (POST /api/auth/login)...');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    const { accessToken, refreshToken, user } = loginRes.body;
    if (!accessToken || !refreshToken) {
      throw new Error('Login failed to return accessToken or refreshToken');
    }
    console.log(`✔ Login successful for ${user.email}`);

    // 3. DASHBOARD / AUTH ME CHECK
    console.log('\n[Step 3] Testing Protected Profile Access for Dashboard (GET /api/auth/me)...');
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    if (meRes.body.email !== testUser.email) {
      throw new Error(
        `Profile email mismatch: expected ${testUser.email}, got ${meRes.body.email}`
      );
    }
    console.log(`✔ Authenticated user retrieved: ${meRes.body.name} (${meRes.body.email})`);

    // 4. REFRESH TOKEN FLOW
    console.log('\n[Step 4] Testing Token Refresh Flow (POST /api/auth/refresh)...');
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    if (!refreshRes.body.accessToken) {
      throw new Error('Refresh token endpoint did not return new accessToken');
    }
    const newAccessToken = refreshRes.body.accessToken;
    console.log('✔ Access token refreshed successfully');

    // Verify new access token works on protected route
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(200);
    console.log('✔ New access token validated against protected route');

    // 5. LOGOUT
    console.log('\n[Step 5] Testing User Logout (POST /api/auth/logout)...');
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .send({ refreshToken })
      .expect(200);

    if (!logoutRes.body.message || !logoutRes.body.message.includes('Logged out')) {
      throw new Error('Logout response did not indicate success');
    }
    console.log('✔ User logged out successfully');

    // 6. VERIFY TOKEN INVALIDATION AFTER LOGOUT
    console.log('\n[Step 6] Verifying Refresh Token is Invalidated After Logout...');
    await request(app).post('/api/auth/refresh').send({ refreshToken }).expect(401);
    console.log('✔ Reusing revoked refresh token was properly rejected (401)');

    console.log('\n=============================================');
    console.log('🎉 ALL AUTH SMOKE TESTS PASSED (E2E FLOW OK)');
    console.log('=============================================\n');
  } catch (err) {
    console.error('\n❌ Smoke Test Failed:', err);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runSmokeTest();
