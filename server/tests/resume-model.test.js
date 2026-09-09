const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../src/models/User');
const Resume = require('../src/models/Resume');

async function testResumeModel() {
  console.log('🧪 Testing Resume Mongoose Model...\n');
  let mongoServer;

  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log('✔ Connected to in-memory MongoDB');

    // 1. Create dummy user
    const user = new User({
      name: 'Jane Doe',
      email: 'jane.resume@example.com',
      passwordHash: 'SuperSecret123!',
    });
    await user.save();
    console.log('✔ Created test user:', user._id);

    // 2. Validation Test: Missing required fields
    console.log('\n[Test 1] Validating required fields constraint...');
    const emptyResume = new Resume({});
    let validationError;
    try {
      await emptyResume.validate();
    } catch (err) {
      validationError = err;
    }
    if (
      !validationError ||
      !validationError.errors.userId ||
      !validationError.errors.originalFilename ||
      !validationError.errors.rawText
    ) {
      throw new Error(
        'Validation should fail when userId, originalFilename, and rawText are missing'
      );
    }
    console.log('✔ Validation properly rejected missing fields');

    // 3. Create Valid Resume
    console.log('\n[Test 2] Creating and saving a full Resume document...');
    const sampleResume = new Resume({
      userId: user._id,
      originalFilename: 'jane_doe_software_engineer.pdf',
      rawText:
        'Jane Doe\nSoftware Engineer\nEmail: jane@example.com\nExperience: Senior Developer at TechCorp...',
      parsedSections: {
        contact: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+1-555-0199',
          location: 'San Francisco, CA',
          linkedin: 'https://linkedin.com/in/janedoe',
          github: 'https://github.com/janedoe',
          portfolio: 'https://janedoe.dev',
        },
        summary:
          'Experienced Full-Stack Developer with 6+ years specializing in Node.js and React.',
        experience: [
          {
            title: 'Senior Software Engineer',
            company: 'TechCorp Solutions',
            location: 'San Francisco, CA',
            startDate: '2021-03',
            endDate: 'Present',
            current: true,
            description: 'Lead engineer for microservices architecture.',
            bulletPoints: [
              'Architected distributed microservices reducing latency by 35%',
              'Mentored junior engineers and led sprint planning',
            ],
          },
        ],
        education: [
          {
            institution: 'University of California, Berkeley',
            degree: 'Bachelor of Science',
            fieldOfStudy: 'Computer Science',
            startDate: '2016-09',
            endDate: '2020-05',
            gpa: '3.85',
            honors: ["Dean's List"],
          },
        ],
        skills: ['JavaScript', 'TypeScript', 'Node.js', 'React', 'MongoDB', 'Docker', 'AWS'],
        certifications: [
          {
            name: 'AWS Certified Solutions Architect',
            issuer: 'Amazon Web Services',
            date: '2023-08',
            url: 'https://aws.amazon.com/verify/12345',
          },
        ],
      },
    });

    const savedResume = await sampleResume.save();
    console.log('✔ Resume successfully saved with ID:', savedResume._id);

    // 4. Verify fields & types
    console.log('\n[Test 3] Verifying stored fields and relations...');
    const foundResume = await Resume.findById(savedResume._id).populate('userId', 'name email');
    if (!foundResume) {
      throw new Error('Could not find saved resume');
    }
    if (foundResume.userId.email !== 'jane.resume@example.com') {
      throw new Error('User relation populate mismatch');
    }
    if (foundResume.originalFilename !== 'jane_doe_software_engineer.pdf') {
      throw new Error('Filename mismatch');
    }
    if (foundResume.parsedSections.skills.length !== 7) {
      throw new Error('Skills array mismatch');
    }
    if (!foundResume.uploadedAt || !(foundResume.uploadedAt instanceof Date)) {
      throw new Error('uploadedAt date missing or invalid');
    }
    console.log('✔ Stored resume verified with all fields and parsed sections');

    // 5. Verify JSON output
    const jsonOutput = foundResume.toJSON();
    if (!jsonOutput.id || jsonOutput.__v !== undefined) {
      throw new Error('toJSON transformation failed');
    }
    console.log('✔ toJSON serialization correctly strips __v and includes id');

    console.log('\n=============================================');
    console.log('🎉 RESUME MODEL TESTS PASSED SUCCESSFULLY');
    console.log('=============================================\n');
  } catch (err) {
    console.error('\n❌ Resume Model Test Failed:', err);
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

testResumeModel();
