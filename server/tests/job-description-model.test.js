const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../src/models/User');
const JobDescription = require('../src/models/JobDescription');

async function testJobDescriptionModel() {
  console.log('🧪 Testing JobDescription Mongoose Model...\n');
  let mongoServer;

  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log('✔ Connected to in-memory MongoDB');

    // 1. Create dummy user
    const user = new User({
      name: 'JD Recruiter',
      email: 'recruiter@example.com',
      passwordHash: 'SuperSecret123!',
    });
    await user.save();
    console.log('✔ Created test user:', user._id);

    // 2. Validation Test: Missing required fields
    console.log('\n[Test 1] Validating required fields constraint...');
    const emptyJD = new JobDescription({});
    let validationError;
    try {
      await emptyJD.validate();
    } catch (err) {
      validationError = err;
    }

    if (
      !validationError ||
      !validationError.errors.userId ||
      !validationError.errors.company ||
      !validationError.errors.roleTitle ||
      !validationError.errors.rawText
    ) {
      throw new Error(
        'Validation should fail when userId, company, roleTitle, and rawText are missing'
      );
    }
    console.log('✔ Validation properly rejected missing required fields');

    // 3. Validation Test: Source enum validation
    console.log('\n[Test 2] Validating source enum constraint...');
    const invalidSourceJD = new JobDescription({
      userId: user._id,
      company: 'Acme Corp',
      roleTitle: 'Frontend Engineer',
      rawText: 'Looking for React developer',
      source: 'invalid_source',
    });

    let sourceError;
    try {
      await invalidSourceJD.validate();
    } catch (err) {
      sourceError = err;
    }

    if (!sourceError || !sourceError.errors.source) {
      throw new Error('Validation should fail for invalid source enum value');
    }
    console.log('✔ Source enum properly rejected invalid values');

    // 4. Create and save full JobDescription document
    console.log('\n[Test 3] Creating and saving a full JobDescription document...');
    const sampleJD = new JobDescription({
      userId: user._id,
      company: 'Stripe',
      roleTitle: 'Staff Backend Engineer',
      rawText:
        'Stripe is hiring a Staff Backend Engineer.\nRequirements:\n- 6+ years with Node.js or Go\n- Experience designing distributed financial systems\n- BS or MS in Computer Science\nNice to have:\n- Kafka or RabbitMQ experience',
      parsedRequirements: {
        skills: ['Node.js', 'Go', 'Distributed Systems', 'PostgreSQL', 'Docker'],
        experience: ['6+ years of backend engineering', 'Experience in financial systems'],
        qualifications: ['BS or MS in Computer Science or equivalent practical experience'],
        niceToHave: ['Kafka', 'RabbitMQ', 'Kubernetes'],
      },
      source: 'paste',
    });

    const savedJD = await sampleJD.save();
    if (!savedJD._id) {
      throw new Error('Failed to save JobDescription document');
    }
    console.log('✔ JobDescription successfully saved with ID:', savedJD._id);

    // 5. Verification Test: Retrieval and field inspection
    console.log('\n[Test 4] Verifying stored fields and relations...');
    const fetchedJD = await JobDescription.findById(savedJD._id).populate('userId', 'email name');

    if (!fetchedJD) {
      throw new Error('Failed to retrieve saved JobDescription document');
    }
    if (fetchedJD.userId.email !== 'recruiter@example.com') {
      throw new Error('Populated user email does not match');
    }
    if (fetchedJD.company !== 'Stripe' || fetchedJD.roleTitle !== 'Staff Backend Engineer') {
      throw new Error('Company or roleTitle mismatch');
    }
    if (fetchedJD.source !== 'paste') {
      throw new Error('Source field mismatch');
    }

    const reqs = fetchedJD.parsedRequirements;
    if (!reqs.skills.includes('Node.js') || !reqs.skills.includes('Go')) {
      throw new Error('Parsed skills mismatch');
    }
    if (reqs.experience.length !== 2) {
      throw new Error('Parsed experience length mismatch');
    }
    if (reqs.qualifications.length !== 1) {
      throw new Error('Parsed qualifications mismatch');
    }
    if (!reqs.niceToHave.includes('Kafka')) {
      throw new Error('Parsed niceToHave mismatch');
    }

    // 6. Test JSON serialization and transform
    const jsonOutput = fetchedJD.toJSON();
    if (jsonOutput.__v !== undefined) {
      throw new Error('toJSON transform should strip __v');
    }
    if (!jsonOutput.id || jsonOutput.id.toString() !== savedJD._id.toString()) {
      throw new Error('toJSON transform should map id to _id');
    }
    console.log('✔ toJSON serialization correctly strips __v and includes id');

    // 7. Test default source and default parsedRequirements
    console.log('\n[Test 5] Testing defaults for source and parsedRequirements...');
    const minimalJD = new JobDescription({
      userId: user._id,
      company: 'OpenAI',
      roleTitle: 'Research Engineer',
      rawText: 'Research and implement large language models',
    });
    const savedMinimal = await minimalJD.save();
    if (savedMinimal.source !== 'paste') {
      throw new Error(`Expected default source "paste", got "${savedMinimal.source}"`);
    }
    if (
      !Array.isArray(savedMinimal.parsedRequirements.skills) ||
      !Array.isArray(savedMinimal.parsedRequirements.experience)
    ) {
      throw new Error('Expected parsedRequirements arrays to default to empty arrays');
    }
    console.log('✔ Default source ("paste") and empty requirements arrays verified');

    console.log('\n=============================================');
    console.log('🎉 JOB DESCRIPTION MODEL TESTS PASSED');
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

testJobDescriptionModel()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
