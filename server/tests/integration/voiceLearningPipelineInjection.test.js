const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_test_jwt_secret_applyforge';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'integration_test_refresh_secret_applyforge';
process.env.NODE_ENV = 'test';

const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Resume = require('../../src/models/Resume');
const JobDescription = require('../../src/models/JobDescription');
const Application = require('../../src/models/Application');
const { signToken } = require('../../src/utils/jwt');
const {
  getRecentStyleExamples,
  recordApplicationEdits,
} = require('../../src/services/voiceLearning');
const {
  resumeTailoringNode,
  buildTailoringSystemPrompt,
} = require('../../src/agents/nodes/resumeTailoringNode');

describe('Phase 104 Voice Learning: Pipeline & Personalization Integration Tests', () => {
  let mongoServer;
  let testUser;
  let authToken;
  let sampleResume;
  let sampleJD;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    testUser = await User.create({
      name: 'Maya Lin',
      email: 'maya.voice@applyforge.test',
      passwordHash: 'SuperPassword123!',
    });
    authToken = signToken(testUser._id);

    sampleResume = await Resume.create({
      userId: testUser._id,
      originalFilename: 'maya_resume.pdf',
      rawText: 'Maya Lin\nSoftware Engineer\nBuilt web applications with Node.js and React.',
      parsedSections: {
        contact: { name: 'Maya Lin', email: 'maya.voice@applyforge.test' },
        experience: [
          {
            company: 'TechCorp',
            role: 'Software Engineer',
            bulletPoints: ['Built web applications with Node.js and React.'],
            bullets: ['Built web applications with Node.js and React.'],
          },
        ],
        skills: ['Node.js', 'React', 'TypeScript'],
      },
    });

    sampleJD = await JobDescription.create({
      userId: testUser._id,
      company: 'ScaleAI Systems',
      roleTitle: 'Senior Full Stack Engineer',
      rawText: 'Seeking a Senior Full Stack Engineer proficient in React, Node.js, and Redis.',
      parsedData: {
        company: 'ScaleAI Systems',
        roleTitle: 'Senior Full Stack Engineer',
        requiredSkills: ['React', 'Node.js', 'Redis'],
      },
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('should fetch the last 10 approved edits across applications for a user', async () => {
    // Create 3 historical applications with various edits
    const app1 = await Application.create({
      userId: testUser._id,
      company: 'App One Co',
      roleTitle: 'Frontend Dev',
      status: 'applied',
      tailoredBullets: [
        { original: 'Built UI components', tailored: 'Created React components' },
      ],
    });

    // Add 4 edits to app1
    await recordApplicationEdits(app1, {
      originalBullets: [
        'Created React components',
        'Handled styling with CSS',
        'Fixed bugs in dashboard',
      ],
      editedBullets: [
        'Engineered reusable TypeScript/React design system components',
        'Crafted responsive CSS/Tailwind layouts boosting engagement by 20%',
        'Resolved 35+ high-priority frontend regression defects',
      ],
    });

    const app2 = await Application.create({
      userId: testUser._id,
      company: 'App Two Systems',
      roleTitle: 'Backend Dev',
      status: 'interviewing',
      tailoredBullets: [
        { original: 'Maintained servers', tailored: 'Maintained AWS servers' },
      ],
    });

    // Add 8 more edits to app2
    const editsToCreate = Array.from({ length: 8 }, (_, i) => ({
      orig: `Original draft bullet number ${i + 1}`,
      rev: `Revamped high-scale microservice workflow iteration ${i + 1}`,
    }));

    await recordApplicationEdits(app2, {
      originalBullets: editsToCreate.map((e) => e.orig),
      editedBullets: editsToCreate.map((e) => e.rev),
    });

    // Fetch recent style examples - should fetch exactly 10
    const styleExamples = await getRecentStyleExamples(testUser._id, 10);

    expect(styleExamples.length).toBe(10);
    expect(styleExamples[0]).toHaveProperty('original');
    expect(styleExamples[0]).toHaveProperty('edited');
    expect(styleExamples[0]).toHaveProperty('company');
    expect(styleExamples[0]).toHaveProperty('roleTitle');
    expect(styleExamples[0].edited).toContain('Revamped high-scale microservice');
  });

  it('should automatically inject style examples into tailoring agent when invoked with userId', async () => {
    let capturedSystemMessage = null;

    const mockLLM = {
      invoke: async (messages) => {
        capturedSystemMessage = messages[0].content;
        return JSON.stringify({
          bullets: [
            {
              originalBullet: 'Built web applications with Node.js and React.',
              tailoredBullet: 'Engineered high-scale web platforms with React, Node.js, and Redis caching.',
              reasoning: 'Applied candidate preferred active verb Engineered and highlighted Redis requirement.',
            },
          ],
        });
      },
    };

    const agentState = {
      userId: testUser._id,
      structuredResume: {
        allBulletPoints: [
          {
            id: 'b1',
            text: 'Built web applications with Node.js and React.',
          },
        ],
      },
      structuredJD: {
        company: 'ScaleAI Systems',
        roleTitle: 'Senior Full Stack Engineer',
        requiredSkills: ['React', 'Node.js', 'Redis'],
      },
    };

    const output = await resumeTailoringNode(agentState, { llm: mockLLM });

    expect(output.status).toBe('tailored');
    expect(output.styleExamples).toBeDefined();
    expect(output.styleExamples.length).toBe(10);

    // Verify the system message contains the style examples section
    expect(capturedSystemMessage).toContain("CANDIDATE'S PERSONAL VOICE & STYLE EXAMPLES");
    expect(capturedSystemMessage).toContain('Revamped high-scale microservice');
    expect(capturedSystemMessage).toContain('VOICE & TONE GUIDELINES DERIVED FROM CANDIDATE EDITS');
  });

  it('should run full pipeline execution via POST /api/pipeline/run and attach style examples', async () => {
    const res = await request(app)
      .post('/api/pipeline/run')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        resumeId: sampleResume._id.toString(),
        jdId: sampleJD._id.toString(),
      })
      .expect(201);

    expect(res.body).toHaveProperty('runId');
    expect(res.body).toHaveProperty('status', 'awaiting_review');
    expect(res.body.state).toHaveProperty('tailoredBullets');
    expect(res.body.state.styleExamples).toBeDefined();
    expect(Array.isArray(res.body.state.styleExamples)).toBe(true);
    expect(res.body.state.styleExamples.length).toBe(10);
  });

  it('should handle new users without any prior edit history gracefully', async () => {
    const freshUser = await User.create({
      name: 'First Time Candidate',
      email: 'newbie@applyforge.test',
      passwordHash: 'NewbiePassword123!',
    });
    const freshToken = signToken(freshUser._id);

    const freshResume = await Resume.create({
      userId: freshUser._id,
      originalFilename: 'fresh.pdf',
      rawText: 'Junior Engineer\nSkills: Python, Django',
      parsedSections: {
        skills: ['Python', 'Django'],
        experience: [
          {
            company: 'Startup',
            role: 'Junior Engineer',
            bulletPoints: ['Assisted in writing Python scripts.'],
            bullets: ['Assisted in writing Python scripts.'],
          },
        ],
      },
    });

    const freshJD = await JobDescription.create({
      userId: freshUser._id,
      company: 'Pythonic Labs',
      roleTitle: 'Python Developer',
      rawText: 'Looking for a Python Developer with Django experience.',
      parsedData: {
        company: 'Pythonic Labs',
        roleTitle: 'Python Developer',
        requiredSkills: ['Python', 'Django'],
      },
    });

    const res = await request(app)
      .post('/api/pipeline/run')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({
        resumeId: freshResume._id.toString(),
        jdId: freshJD._id.toString(),
      })
      .expect(201);

    expect(res.body.status).toBe('awaiting_review');
    expect(res.body.state.styleExamples).toEqual([]);
    expect(res.body.state.tailoredBullets.length).toBeGreaterThan(0);
  });
});
