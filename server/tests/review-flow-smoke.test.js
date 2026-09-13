const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const JSZip = require('jszip');

// Test environment configuration
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke_test_jwt_secret_applyforge_70';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'smoke_test_refresh_secret_applyforge_70';
process.env.PORT = process.env.PORT || '5008';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const JobDescription = require('../src/models/JobDescription');
const Application = require('../src/models/Application');
const PipelineRun = require('../src/models/PipelineRun');
const { resetRunsStore } = require('../src/controllers/pipeline.controller');

/**
 * Creates a valid DOCX binary buffer with structured resume content
 */
async function createSampleResumeDocx() {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
  );

  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
  );

  const text = [
    'Sarah Connor',
    'sarah.connor@skyline.dev | (555) 019-2834 | San Francisco, CA',
    'EXPERIENCE',
    'Lead Distributed Systems Engineer at HyperScale Tech (2021 - Present)',
    '• Architected high-throughput microservices handling 75,000 requests per second with Node.js, Express, and Redis.',
    '• Reduced database query latency by 45% through PostgreSQL partitioning and read-replica orchestration.',
    '• Mentored 8 junior and mid-level software engineers across backend, CI/CD, and infrastructure domain best practices.',
    'SKILLS',
    'Node.js, TypeScript, PostgreSQL, Redis, Docker, Kubernetes, AWS, GraphQL, REST APIs, Microservices Architecture',
    'EDUCATION',
    'B.S. in Computer Science, UC Berkeley (2017 - 2021)',
  ].join('\n');

  const paragraphs = text
    .split('\n')
    .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
    .join('');

  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * End-to-End Smoke Test: Phase 70
 * Flow: Register User → Upload Resume → Paste JD → Run Pipeline → Review Checkpoint → Request Edits → Approve
 */
async function runReviewFlowSmokeTest() {
  console.log('🚀 [Phase 70] Starting Human-in-the-Loop Review Flow E2E Smoke Test...\n');

  let mongoServer;

  try {
    // 0. Connect to In-Memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory test MongoDB instance');

    resetRunsStore();

    // =========================================================================
    // STEP 1: User Registration & Authentication
    // =========================================================================
    console.log('\n[Step 1] User Registration (POST /api/auth/register)...');
    const userPayload = {
      name: 'Sarah Connor',
      email: 'sarah.connor@skyline.dev',
      password: 'SecurePassword123!',
    };

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(userPayload)
      .expect(201);

    const token = registerRes.body.accessToken;
    const userId = registerRes.body.user.id;
    assert.ok(token, 'Must return accessToken');
    assert.ok(userId, 'Must return user ID');
    console.log(`  ✔ Candidate registered successfully: ${userPayload.email} (ID: ${userId})`);

    // =========================================================================
    // STEP 2: Resume Upload (POST /api/resumes)
    // =========================================================================
    console.log('\n[Step 2] Resume Upload (POST /api/resumes)...');
    const resumeBuffer = await createSampleResumeDocx();

    const uploadRes = await request(app)
      .post('/api/resumes')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', resumeBuffer, 'sarah_connor_resume.docx')
      .expect(201);

    const resumeId = uploadRes.body.resume?._id || uploadRes.body.resume?.id || uploadRes.body._id;
    assert.ok(resumeId, 'Must return uploaded resume ID');
    assert.ok(uploadRes.body.resume?.parsedSections, 'Must extract structured parsedSections');
    console.log(`  ✔ Resume uploaded and parsed: ${uploadRes.body.resume.originalFilename} (ID: ${resumeId})`);
    console.log(`    Parsed Sections:`, Object.keys(uploadRes.body.resume.parsedSections));

    // =========================================================================
    // STEP 3: Job Description Ingestion (POST /api/jds)
    // =========================================================================
    console.log('\n[Step 3] Job Description Ingestion (POST /api/jds)...');
    const jdPayload = {
      company: 'Stripe',
      roleTitle: 'Staff Infrastructure & Backend Engineer',
      sourceUrl: 'https://stripe.com/jobs/staff-infra-engineer',
      rawText: [
        'Role: Staff Infrastructure & Backend Engineer at Stripe',
        'Requirements:',
        '- 5+ years of experience with Node.js, TypeScript, PostgreSQL, and distributed caching (Redis).',
        '- Hands-on experience scaling systems to millions of transactions per day.',
        '- Proficiency with Docker, Kubernetes, and cloud platforms (AWS or GCP).',
        '- Strong cross-functional leadership, technical communication, and mentorship track record.',
        'Preferred: GraphQL API architecture, Kafka message queues, 99.99% SLA reliability.',
      ].join('\n'),
    };

    const jdRes = await request(app)
      .post('/api/jds')
      .set('Authorization', `Bearer ${token}`)
      .send(jdPayload)
      .expect(201);

    const jdId = jdRes.body.jobDescription?._id || jdRes.body.jobDescription?.id || jdRes.body._id;
    assert.ok(jdId, 'Must return ingested JD ID');
    assert.strictEqual(jdRes.body.jobDescription.company, 'Stripe');
    assert.strictEqual(jdRes.body.jobDescription.roleTitle, 'Staff Infrastructure & Backend Engineer');
    assert.ok(jdRes.body.jobDescription.parsedRequirements, 'Must extract parsed requirements');
    console.log(`  ✔ Job description ingested: ${jdPayload.company} — ${jdPayload.roleTitle} (ID: ${jdId})`);

    // =========================================================================
    // STEP 4: Run Multi-Agent Pipeline (POST /api/pipeline/run)
    // =========================================================================
    console.log('\n[Step 4] Run Multi-Agent Pipeline (POST /api/pipeline/run)...');
    const runRes = await request(app)
      .post('/api/pipeline/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ resumeId, jdId })
      .expect(201);

    const runId = runRes.body.runId;
    assert.ok(runId, 'Must return active pipeline runId');
    assert.strictEqual(runRes.body.status, 'awaiting_review', 'Pipeline must pause at human review checkpoint');
    assert.ok(runRes.body.state, 'Must return intermediate state');

    const initialState = runRes.body.state;
    assert.ok(Array.isArray(initialState.tailoredBullets) && initialState.tailoredBullets.length > 0, 'Must produce tailoredBullets');
    assert.ok(initialState.atsReport && typeof initialState.atsReport.overallScore === 'number', 'Must produce atsReport');
    assert.ok(initialState.coverLetter && initialState.coverLetter.body, 'Must produce coverLetter');
    assert.ok(initialState.fitScore && typeof initialState.fitScore.score === 'number', 'Must produce fitScore');
    assert.strictEqual(initialState.humanApproved, false, 'humanApproved must initially be false');

    console.log(`  ✔ Multi-agent pipeline executed successfully (Run ID: ${runId}):`, {
      status: runRes.body.status,
      bulletsCount: initialState.tailoredBullets.length,
      atsScore: `${initialState.atsReport.overallScore}%`,
      fitScore: `${initialState.fitScore.score}/100 (${initialState.fitScore.tier})`,
      coverLetterWords: initialState.coverLetter.body.split(/\s+/).length,
    });

    // Verify PipelineRun model in MongoDB
    const persistedRun = await PipelineRun.findOne({ runId });
    assert.ok(persistedRun, 'PipelineRun document must exist in MongoDB');
    assert.strictEqual(persistedRun.status, 'awaiting_review');
    console.log(`  ✔ PipelineRun document verified in MongoDB (status: ${persistedRun.status})`);

    // =========================================================================
    // STEP 5: Review Checkpoint & State Retrieval (GET /api/pipeline/:runId)
    // =========================================================================
    console.log('\n[Step 5] Human Review Checkpoint Inspection (GET /api/pipeline/:runId)...');
    const checkpointRes = await request(app)
      .get(`/api/pipeline/${runId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.strictEqual(checkpointRes.body.runId, runId);
    assert.strictEqual(checkpointRes.body.status, 'awaiting_review');
    assert.ok(checkpointRes.body.state.atsReport.matchedKeywords.length > 0, 'Must have matched keywords');
    console.log(`  ✔ Checkpoint state verified: paused at awaiting_review`);

    // =========================================================================
    // STEP 6: Request AI Agent Edits (POST /api/pipeline/:runId/edit)
    // =========================================================================
    console.log('\n[Step 6] Candidate Requests AI Agent Revisions (POST /api/pipeline/:runId/edit)...');
    const editPayload = {
      notes: 'Please highlight 99.99% uptime reliability and cross-functional engineering mentorship in the top bullets.',
      userEdits: {
        notes: 'Emphasize high availability and team mentorship.',
        requestedAt: new Date().toISOString(),
      },
    };

    const editRes = await request(app)
      .post(`/api/pipeline/${runId}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send(editPayload)
      .expect(200);

    assert.strictEqual(editRes.body.runId, runId);
    assert.strictEqual(editRes.body.status, 'awaiting_review');
    assert.ok(editRes.body.state, 'Must return revised state');
    assert.strictEqual(editRes.body.state.humanApproved, false);
    console.log(`  ✔ Pipeline looped back with custom candidate notes and re-paused at awaiting_review`);

    // =========================================================================
    // STEP 7: Candidate Approval (POST /api/pipeline/:runId/approve)
    // =========================================================================
    console.log('\n[Step 7] Candidate Approves Application Package (POST /api/pipeline/:runId/approve)...');
    const approveRes = await request(app)
      .post(`/api/pipeline/${runId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.strictEqual(approveRes.body.runId, runId);
    assert.strictEqual(approveRes.body.status, 'saved');
    assert.strictEqual(approveRes.body.state.humanApproved, true);
    const applicationId = approveRes.body.applicationId || approveRes.body.application?._id;
    assert.ok(applicationId, 'Must return created applicationId');
    console.log(`  ✔ Application approved! Created Application ID: ${applicationId}`);

    // =========================================================================
    // STEP 8: Application Detail Verification (GET /api/applications/:id)
    // =========================================================================
    console.log('\n[Step 8] Verifying Application Record in MongoDB (GET /api/applications/:id)...');
    const appDetailRes = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const savedApp = appDetailRes.body.application;
    assert.ok(savedApp, 'Must return application detail');
    assert.strictEqual(savedApp.company, 'Stripe');
    assert.strictEqual(savedApp.roleTitle, 'Staff Infrastructure & Backend Engineer');
    assert.strictEqual(savedApp.runId, runId);
    assert.ok(savedApp.tailoredBullets && savedApp.tailoredBullets.length > 0, 'Must save tailored bullets');
    assert.ok(savedApp.coverLetter && savedApp.coverLetter.body, 'Must save cover letter');
    assert.ok(savedApp.fitScore && typeof savedApp.fitScore.score === 'number', 'Must save fit score');
    console.log(`  ✔ Application record verified in tracker: ${savedApp.company} (${savedApp.status})`);

    // Verify PipelineRun document updated to 'saved'
    const finalRun = await PipelineRun.findOne({ runId });
    assert.strictEqual(finalRun.status, 'saved');
    assert.ok(finalRun.updatedAt, 'updatedAt must be populated');
    console.log(`  ✔ PipelineRun status verified as "saved" with update timestamp: ${finalRun.updatedAt}`);

    console.log('\n=============================================================');
    console.log('🎉 FULL HUMAN-IN-THE-LOOP REVIEW FLOW E2E SMOKE TEST PASSED!');
    console.log('   upload resume → paste JD → run pipeline → review → approve');
    console.log('=============================================================\n');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

if (require.main === module) {
  runReviewFlowSmokeTest().catch((err) => {
    console.error('❌ E2E Smoke Test Failed:', err);
    process.exit(1);
  });
}

module.exports = { runReviewFlowSmokeTest };
