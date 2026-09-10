const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const extractSections = require('../src/services/parsers/sectionExtractor');
const Resume = require('../src/models/Resume');
const User = require('../src/models/User');

async function testSectionExtractor() {
  console.log('🧪 Testing Resume Section Extractor Service...\n');
  let mongoServer;

  try {
    // 1. Comprehensive Resume Text Sample
    const sampleResume = `
Alex R. Johnson
alex.johnson@example.com | (555) 234-5678 | San Francisco, CA
https://linkedin.com/in/alexjohnson | https://github.com/alexjohnson | https://alexjohnson.dev

PROFESSIONAL SUMMARY
Senior Full-Stack Engineer with over 6 years of expertise building scalable cloud applications, distributed microservices, and AI-driven automation pipelines. Strong foundation in React, Node.js, and TypeScript.

TECHNICAL SKILLS
Languages & Frameworks: JavaScript, TypeScript, Python, Node.js, React, Next.js, Express
Databases & Cloud: MongoDB, PostgreSQL, Redis, AWS, Docker, Kubernetes
Tools & Methods: Git, CI/CD, Agile, Microservices, REST APIs, GraphQL

WORK EXPERIENCE
Senior Full-Stack Engineer at TechFlow Inc.
03/2021 - Present | San Francisco, CA
• Architected event-driven microservices serving 2M+ monthly active users with 99.99% uptime.
• Reduced API response latency by 42% through optimized MongoDB aggregations and Redis caching.
• Led a cross-functional squad of 5 engineers delivering high-impact features ahead of sprint deadlines.

Software Engineer at CloudScale Solutions
06/2018 - 02/2021 | Austin, TX
• Developed and maintained customer-facing React components with Tailwind CSS.
• Implemented automated CI/CD pipelines reducing deployment failure rates by 25%.

EDUCATION
University of California, Berkeley
Bachelor of Science in Computer Science
09/2014 - 05/2018 | GPA: 3.82
Dean's Honors List

CERTIFICATIONS
AWS Certified Solutions Architect - Associate | 2023 | https://aws.amazon.com/verify/12345
Certified Kubernetes Administrator (CKA) | 2022
`;

    console.log('[Test 1] Extracting sections from sample resume text...');
    const parsed = extractSections(sampleResume);

    // Verify Contact
    console.log('\n- Verifying Contact extraction:');
    if (!parsed.contact.name || parsed.contact.name !== 'Alex R. Johnson') {
      throw new Error(
        `Name extraction failed: expected 'Alex R. Johnson', got '${parsed.contact.name}'`
      );
    }
    if (parsed.contact.email !== 'alex.johnson@example.com') {
      throw new Error(`Email extraction failed: got '${parsed.contact.email}'`);
    }
    if (!parsed.contact.phone || !parsed.contact.phone.includes('234-5678')) {
      throw new Error(`Phone extraction failed: got '${parsed.contact.phone}'`);
    }
    if (!parsed.contact.linkedin.includes('linkedin.com/in/alexjohnson')) {
      throw new Error(`LinkedIn extraction failed: got '${parsed.contact.linkedin}'`);
    }
    if (!parsed.contact.github.includes('github.com/alexjohnson')) {
      throw new Error(`GitHub extraction failed: got '${parsed.contact.github}'`);
    }
    if (!parsed.contact.portfolio.includes('alexjohnson.dev')) {
      throw new Error(`Portfolio extraction failed: got '${parsed.contact.portfolio}'`);
    }
    if (!parsed.contact.location || !parsed.contact.location.includes('San Francisco')) {
      throw new Error(`Location extraction failed: got '${parsed.contact.location}'`);
    }
    console.log('  ✔ Contact info extracted successfully (name, email, phone, location, links)');

    // Verify Summary
    console.log('\n- Verifying Summary extraction:');
    if (
      !parsed.summary ||
      !parsed.summary.includes('Senior Full-Stack Engineer with over 6 years')
    ) {
      throw new Error(`Summary extraction failed: got '${parsed.summary}'`);
    }
    console.log('  ✔ Summary extracted successfully');

    // Verify Skills
    console.log('\n- Verifying Skills extraction:');
    if (!Array.isArray(parsed.skills) || parsed.skills.length < 5) {
      throw new Error(
        `Skills extraction failed: expected multiple skills, got ${parsed.skills.length}`
      );
    }
    const skillList = parsed.skills.join(', ');
    if (
      !skillList.includes('React') ||
      !skillList.includes('Node.js') ||
      !skillList.includes('MongoDB')
    ) {
      throw new Error(`Skills missing expected technologies. Got: ${skillList}`);
    }
    console.log(
      `  ✔ Extracted ${parsed.skills.length} skills successfully: ${parsed.skills.slice(0, 5).join(', ')}...`
    );

    // Verify Experience
    console.log('\n- Verifying Experience extraction:');
    if (!Array.isArray(parsed.experience) || parsed.experience.length < 2) {
      throw new Error(
        `Experience extraction failed: expected 2 entries, got ${parsed.experience.length}`
      );
    }
    const firstJob = parsed.experience[0];
    if (
      !firstJob.title.includes('Senior Full-Stack Engineer') &&
      !firstJob.company.includes('TechFlow')
    ) {
      throw new Error(`First job title/company extraction failed: ${JSON.stringify(firstJob)}`);
    }
    if (!firstJob.current || firstJob.endDate !== 'Present') {
      throw new Error(
        `Current job detection failed: current=${firstJob.current}, endDate=${firstJob.endDate}`
      );
    }
    if (firstJob.bulletPoints.length < 2) {
      throw new Error(
        `Bullet points extraction failed: got ${firstJob.bulletPoints.length} bullets`
      );
    }
    console.log('  ✔ Experience entries and bullet points extracted successfully');

    // Verify Education
    console.log('\n- Verifying Education extraction:');
    if (!Array.isArray(parsed.education) || parsed.education.length < 1) {
      throw new Error('Education extraction failed: no entries');
    }
    const edu = parsed.education[0];
    if (!edu.institution.includes('Berkeley') && !edu.degree.includes('Bachelor')) {
      throw new Error(`Education institution/degree mismatch: ${JSON.stringify(edu)}`);
    }
    if (edu.gpa !== '3.82') {
      throw new Error(`GPA extraction failed: expected '3.82', got '${edu.gpa}'`);
    }
    console.log('  ✔ Education extracted successfully with degree and GPA');

    // Verify Certifications
    console.log('\n- Verifying Certifications extraction:');
    if (!Array.isArray(parsed.certifications) || parsed.certifications.length < 1) {
      throw new Error('Certifications extraction failed');
    }
    console.log('  ✔ Certifications extracted successfully');

    // [Test 2] Empty/Null input safety
    console.log('\n[Test 2] Testing safety on empty/null input...');
    const emptyResult = extractSections('');
    if (
      !emptyResult.contact ||
      !Array.isArray(emptyResult.skills) ||
      !Array.isArray(emptyResult.experience)
    ) {
      throw new Error('Should return empty default structure on empty input');
    }
    console.log('  ✔ Empty input safely returned default structure');

    // [Test 3] Mongoose Resume model compatibility check
    console.log(
      '\n[Test 3] Verifying extracted object saves directly to Resume model in MongoDB...'
    );
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const testUser = new User({
      name: 'Test User',
      email: 'resume.schema.test@example.com',
      passwordHash: 'hashedPass123!',
    });
    await testUser.save();

    const resumeDoc = new Resume({
      userId: testUser._id,
      originalFilename: 'alex_johnson_resume.pdf',
      rawText: sampleResume,
      parsedSections: parsed,
    });

    const savedDoc = await resumeDoc.save();
    if (!savedDoc._id || savedDoc.parsedSections.contact.email !== 'alex.johnson@example.com') {
      throw new Error('Mongoose schema failed to store parsedSections cleanly');
    }
    console.log('  ✔ parsedSections fully validated and persisted in Resume model');

    console.log('\n=============================================');
    console.log('🎉 ALL SECTION EXTRACTOR TESTS PASSED');
    console.log('=============================================\n');
  } catch (error) {
    console.error('\n❌ Section Extractor Test Failed:', error);
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

testSectionExtractor();
