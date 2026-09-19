const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const axios = require('axios');

// Set test environment configuration
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5004';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const { signToken } = require('../src/utils/jwt');
const {
  extractCleanText,
  scrapeJobDescription,
} = require('../src/services/scraper/jdScraper');
const scraperService = require('../src/services/scraper');

async function testJdScraper() {
  console.log('🧪 Testing JD Scraper Service & Stub Endpoint...\n');

  // [Test 1] HTML stripping and clean text extraction
  console.log('[Test 1] Testing extractCleanText from messy HTML...');
  const messyHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Senior Staff Engineer - OpenAI Careers</title>
        <style>.ads { color: red; } body { font-family: sans-serif; }</style>
        <script>console.log("analytics script");</script>
      </head>
      <body>
        <header>
          <nav>
            <a href="/">Home</a>
            <a href="/jobs">Jobs</a>
          </nav>
        </header>

        <main id="job-description">
          <h1>Senior Staff Engineer</h1>
          <p>We are looking for an exceptional <strong>Senior Staff Engineer</strong> to join our team.</p>

          <h2>Responsibilities</h2>
          <ul>
            <li>Architect and scale real-time AI inference services.</li>
            <li>Collaborate with research scientists to deploy cutting-edge foundation models.</li>
          </ul>

          <h2>Requirements</h2>
          <ul>
            <li>8+ years of distributed backend systems experience.</li>
            <li>Proficiency in Python, Rust, and Go.</li>
          </ul>
        </main>

        <form action="/apply"><button type="submit">Apply Now</button></form>
        <footer>
          <p>&copy; 2026 OpenAI. All rights reserved.</p>
        </footer>
      </body>
    </html>
  `;

  const { text, title } = extractCleanText(messyHtml);

  if (!title.includes('Senior Staff Engineer')) {
    throw new Error(`Expected title to include "Senior Staff Engineer", got: "${title}"`);
  }
  if (text.includes('analytics script') || text.includes('.ads { color: red; }')) {
    throw new Error('Expected script and style content to be stripped');
  }
  if (text.includes('Home') && text.includes('Jobs') && text.includes('All rights reserved')) {
    throw new Error('Expected nav and footer to be removed');
  }
  if (!text.includes('8+ years of distributed backend systems experience')) {
    throw new Error('Expected main requirements text to be preserved');
  }
  if (!text.includes('Python, Rust, and Go')) {
    throw new Error('Expected skills text to be preserved');
  }
  console.log('✔ Cleanly extracted text from HTML, stripped noise tags, and extracted title:');
  console.log(`  Title: "${title}"`);
  console.log(`  Extracted sample:\n${text.split('\n').slice(0, 5).join('\n')}\n`);

  // [Test 2] Empty & invalid HTML handling
  console.log('[Test 2] Testing safety with empty or non-string inputs...');
  const emptyRes1 = extractCleanText('');
  const emptyRes2 = extractCleanText(null);
  const emptyRes3 = extractCleanText(undefined);
  if (emptyRes1.text !== '' || emptyRes2.text !== '' || emptyRes3.text !== '') {
    throw new Error('Expected empty results for invalid inputs');
  }
  console.log('✔ Empty/null inputs safely handled');

  // [Test 3] Re-export verification from services/scraper
  console.log('\n[Test 3] Testing scraper module re-exports...');
  if (
    typeof scraperService.scrapeJobDescription !== 'function' ||
    typeof scraperService.extractCleanText !== 'function'
  ) {
    throw new Error('Expected scraper module to export scrapeJobDescription and extractCleanText');
  }
  console.log('✔ Scraper module correctly re-exports functions');

  // [Test 4] Scraper URL validation
  console.log('\n[Test 4] Testing scrapeJobDescription URL parameter validation...');
  try {
    await scrapeJobDescription('invalid-url-without-protocol');
    throw new Error('Expected invalid URL to throw');
  } catch (err) {
    if (!err.message.includes('http:// or https://')) {
      throw new Error(`Expected protocol error message, got: ${err.message}`);
    }
    console.log(`✔ Correctly rejected invalid URL protocol: ${err.message}`);
  }

  // [Test 5] Test Stub endpoint POST /api/jds/from-url
  console.log('\n[Test 5] Testing POST /api/jds/from-url stub endpoint...');
  let mongoServer;

  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const testUser = new User({
      name: 'Scraper User',
      email: 'scraper@example.com',
      passwordHash: 'PasswordHash123!',
    });
    await testUser.save();
    const token = signToken(testUser._id);

    // 5.1 Missing auth check
    const unauthRes = await request(app)
      .post('/api/jds/from-url')
      .send({ url: 'https://jobs.example.com/posting/123' })
      .expect(401);

    if (unauthRes.body.code !== 'TOKEN_MISSING') {
      throw new Error(`Expected 401 TOKEN_MISSING, got: ${JSON.stringify(unauthRes.body)}`);
    }
    console.log('✔ Rejected unauthenticated request with 401');

    // 5.2 Validation failure check (missing URL)
    const badRes = await request(app)
      .post('/api/jds/from-url')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    if (badRes.body.error !== 'Validation failed') {
      throw new Error(`Expected Validation failed, got: ${JSON.stringify(badRes.body)}`);
    }
    console.log('✔ Rejected missing URL with 400 Validation failed');

    // 5.3 Successful scrape and persistence test (expect 201 Created)
    const originalAxiosGet = axios.get;
    axios.get = async () => ({
      status: 200,
      data: `
        <!DOCTYPE html>
        <html>
          <head><title>Cloud Infrastructure Engineer - Stripe</title></head>
          <body>
            <div id="wrapper">
              <h1 class="app-title">Cloud Infrastructure Engineer</h1>
              <span class="company-name">Stripe</span>
              <div class="location">Remote - US</div>
              <div id="content">
                <p>Build scalable payments infrastructure.</p>
                <h3>Requirements:</h3>
                <ul>
                  <li>Kubernetes, Go, and Terraform experience.</li>
                </ul>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    try {
      const liveRes = await request(app)
        .post('/api/jds/from-url')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://boards.greenhouse.io/stripe/jobs/123456' })
        .expect(201);

      if (liveRes.body.company !== 'Stripe') {
        throw new Error(`Expected company Stripe, got: ${liveRes.body.company}`);
      }
      if (liveRes.body.source !== 'url') {
        throw new Error(`Expected source url, got: ${liveRes.body.source}`);
      }
      if (!liveRes.body.rawText.includes('Kubernetes, Go, and Terraform')) {
        throw new Error('Expected requirements in rawText');
      }
      console.log('✔ POST /api/jds/from-url correctly scrapes, parses, and returns 201 Created:');
      console.log(`  Created JD: ${liveRes.body.company} - ${liveRes.body.roleTitle} (source: ${liveRes.body.source})`);
    } finally {
      axios.get = originalAxiosGet;
    }

    console.log('\n=============================================');
    console.log('🎉 ALL JD SCRAPER & INGESTION TESTS PASSED');
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

testJdScraper()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
