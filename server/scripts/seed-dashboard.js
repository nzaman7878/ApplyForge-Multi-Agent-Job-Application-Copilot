const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const JobDescription = require('../src/models/JobDescription');
const Application = require('../src/models/Application');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/applyforge';

const DEMO_USER = {
  name: 'Alex Rivera',
  email: 'demo@applyforge.dev',
  password: 'Password123!',
};

const SAMPLE_COMPANIES = [
  { company: 'Stripe', role: 'Staff Full Stack Engineer', score: 94, status: 'offer' },
  { company: 'Linear', role: 'Senior Frontend Engineer', score: 91, status: 'interviewing' },
  { company: 'Vercel', role: 'Next.js Platform Engineer', score: 88, status: 'interviewing' },
  { company: 'Datadog', role: 'Senior Systems Engineer', score: 86, status: 'applied' },
  { company: 'Figma', role: 'Product Infrastructure Engineer', score: 89, status: 'interviewing' },
  { company: 'Airbnb', role: 'Lead Design Systems Engineer', score: 84, status: 'applied' },
  { company: 'GitHub', role: 'Senior Cloud Platform Engineer', score: 82, status: 'applied' },
  { company: 'OpenAI', role: 'AI Applications Engineer', score: 96, status: 'interviewing' },
  { company: 'Anthropic', role: 'Frontend AI Tools Engineer', score: 92, status: 'offer' },
  { company: 'Shopify', role: 'Senior Backend Engineer (Node/Go)', score: 78, status: 'applied' },
  { company: 'Netflix', role: 'UI Platform Engineer', score: 75, status: 'interviewing' },
  { company: 'Spotify', role: 'Web Player Core Engineer', score: 73, status: 'applied' },
  { company: 'Snowflake', role: 'Distributed Systems Engineer', score: 68, status: 'applied' },
  { company: 'Cloudflare', role: 'Edge Computing Developer Advocate', score: 72, status: 'rejected' },
  { company: 'Notion', role: 'Full Stack Product Engineer', score: 65, status: 'applied' },
  { company: 'Slack', role: 'Enterprise Frontend Architect', score: 64, status: 'rejected' },
  { company: 'Atlassian', role: 'Growth Engineering Lead', score: 62, status: 'applied' },
  { company: 'DoorDash', role: 'Logistics Backend Engineer', score: 58, status: 'rejected' },
  { company: 'Uber', role: 'High Throughput Platform Engineer', score: 54, status: 'rejected' },
  { company: 'Amazon', role: 'AWS Serverless Architect', score: 48, status: 'rejected' },
  { company: 'Meta', role: 'Product Foundation Engineer', score: 38, status: 'rejected' },
  { company: 'Google', role: 'Search Infrastructure Engineer', score: 35, status: 'rejected' },
  { company: 'Apple', role: 'Cloud Services Engineer', score: 32, status: 'wishlist' },
  { company: 'Microsoft', role: 'Azure DevOps Specialist', score: 79, status: 'wishlist' },
];

/**
 * Main seeding execution
 */
async function seed() {
  try {
    console.log('[Seed] Connecting to MongoDB:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('[Seed] MongoDB Connected successfully.');

    // 1. Find or create demo user
    let user = await User.findOne({ email: DEMO_USER.email });
    if (!user) {
      console.log('[Seed] Creating demo user:', DEMO_USER.email);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(DEMO_USER.password, salt);
      user = await User.create({
        name: DEMO_USER.name,
        email: DEMO_USER.email,
        passwordHash,
      });
    } else {
      console.log('[Seed] Using existing demo user:', user.email, `(${user._id})`);
    }

    const userId = user._id;

    // 2. Find or create sample resume
    let resume = await Resume.findOne({ userId });
    if (!resume) {
      console.log('[Seed] Creating sample resume for user');
      resume = await Resume.create({
        userId,
        originalFilename: 'Alex_Rivera_Staff_Software_Engineer.pdf',
        rawText: 'Alex Rivera - Staff Full Stack Engineer with 8+ years experience in React, Node.js, TypeScript, and Distributed Systems.',
        parsedSections: {
          contact: { name: 'Alex Rivera', email: 'alex@example.com', phone: '555-0199', location: 'San Francisco, CA' },
          summary: 'High-impact Staff Engineer specializing in high-throughput React/Node architectures and AI developer workflows.',
          skills: ['React', 'Node.js', 'TypeScript', 'Tailwind CSS', 'GraphQL', 'Docker', 'MongoDB', 'PostgreSQL', 'LangChain', 'AWS'],
          experience: [{ company: 'TechCorp', role: 'Senior Staff Engineer', duration: '2021 - Present' }],
          education: [{ institution: 'UC Berkeley', degree: 'B.S. Computer Science', year: '2016' }],
          certifications: ['AWS Certified Solutions Architect'],
        },
      });
    }

    // 3. Find or create sample job description
    let jd = await JobDescription.findOne({ userId });
    if (!jd) {
      console.log('[Seed] Creating sample Job Description');
      jd = await JobDescription.create({
        userId,
        company: 'Stripe',
        roleTitle: 'Staff Full Stack Engineer',
        rawText: 'Looking for a Staff Full Stack Engineer experienced with React, Node.js, distributed architectures, and developer tooling.',
        source: 'paste',
        parsedRequirements: {
          skills: ['React', 'Node.js', 'TypeScript', 'Distributed Systems'],
          experience: '7+ years',
          qualifications: ["Bachelor's in CS or equivalent experience"],
          niceToHave: ['GraphQL', 'Kubernetes'],
        },
      });
    }

    // 4. Clear previous applications for clean seeding
    const deleteResult = await Application.deleteMany({ userId });
    console.log(`[Seed] Cleared ${deleteResult.deletedCount} existing applications for user.`);

    // 5. Generate realistic temporal distribution across past 12 weeks
    const now = new Date();
    const applicationsToInsert = [];

    SAMPLE_COMPANIES.forEach((item, index) => {
      // Spread across the past 12 weeks
      // e.g. week 0 (this week), week 1, ... week 11
      const weeksAgo = Math.min(11, Math.floor((index / SAMPLE_COMPANIES.length) * 12));
      const dayOffset = (index % 5) + 1; // 1 to 5 days within that week
      const appDate = new Date(now.getTime() - (weeksAgo * 7 + dayOffset) * 24 * 60 * 60 * 1000);

      // Setup follow-up schedule
      let nextFollowUpAt = null;
      let lastFollowUpAt = null;

      if (item.status === 'applied') {
        if (index % 3 === 0) {
          // Overdue follow-up (2 days ago)
          nextFollowUpAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
          lastFollowUpAt = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000);
        } else if (index % 3 === 1) {
          // Due today
          nextFollowUpAt = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
        } else {
          // Scheduled in future (3 days from now)
          nextFollowUpAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        }
      } else if (item.status === 'interviewing') {
        if (index % 2 === 0) {
          // Due tomorrow
          nextFollowUpAt = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
        }
      }

      // Build status history audit trail
      const statusHistory = [
        { status: 'wishlist', changedAt: new Date(appDate.getTime() - 2 * 24 * 60 * 60 * 1000) },
      ];

      if (item.status !== 'wishlist') {
        statusHistory.push({ status: 'applied', changedAt: appDate });
      }
      if (item.status === 'interviewing' || item.status === 'offer') {
        statusHistory.push({
          status: 'interviewing',
          changedAt: new Date(appDate.getTime() + 5 * 24 * 60 * 60 * 1000),
        });
      }
      if (item.status === 'offer') {
        statusHistory.push({
          status: 'offer',
          changedAt: new Date(appDate.getTime() + 12 * 24 * 60 * 60 * 1000),
        });
      }
      if (item.status === 'rejected') {
        statusHistory.push({
          status: 'rejected',
          changedAt: new Date(appDate.getTime() + 8 * 24 * 60 * 60 * 1000),
        });
      }

      const tier = item.score >= 80 ? 'strong' : item.score >= 60 ? 'moderate' : 'stretch';

      applicationsToInsert.push({
        userId,
        resumeId: resume._id,
        jdId: jd._id,
        company: item.company,
        roleTitle: item.role,
        status: item.status,
        fitScore: {
          score: item.score,
          tier,
          gaps: item.score < 80 ? [{ skill: 'Specialized domain experience', severity: 'medium', suggestion: 'Highlight analogous projects' }] : [],
          strengths: ['Demonstrated systems leadership', 'Full stack architecture track record'],
        },
        atsReport: {
          matchedKeywords: [{ keyword: 'React', importance: 'required', location: 'Skills' }],
          missingKeywords: item.score < 70 ? [{ keyword: 'GraphQL', importance: 'preferred' }] : [],
          overallScore: item.score,
        },
        appliedAt: appDate,
        appliedDate: appDate,
        nextFollowUpAt,
        lastFollowUpAt,
        statusHistory,
        notes: item.status === 'offer' ? 'Received offer package with equity acceleration.' : item.status === 'interviewing' ? 'Technical system design interview scheduled.' : '',
        createdAt: appDate,
        updatedAt: now,
      });
    });

    const created = await Application.insertMany(applicationsToInsert);
    console.log(`[Seed] Successfully inserted ${created.length} sample applications.`);

    // 6. Print out telemetry verification summary
    const total = created.length;
    const byStatus = {};
    let dueCount = 0;
    let scoreSum = 0;

    created.forEach((a) => {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      if (a.nextFollowUpAt && a.nextFollowUpAt <= now) dueCount++;
      scoreSum += a.fitScore?.score || 0;
    });

    console.log('----------------------------------------------------');
    console.log(' ApplyForge Dashboard Sample Telemetry Seeded:');
    console.log(` - Demo User:       ${DEMO_USER.email} (pass: ${DEMO_USER.password})`);
    console.log(` - Total Apps:      ${total}`);
    console.log(` - Status Breakdown:`, byStatus);
    console.log(` - Avg Fit Score:   ${Math.round(scoreSum / total)}%`);
    console.log(` - Open Follow-ups: ${dueCount} due`);
    console.log('----------------------------------------------------');

    await mongoose.disconnect();
    console.log('[Seed] Database disconnected cleanly.');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    process.exit(1);
  }
}

// Run seed if called directly
if (require.main === module) {
  seed();
}

module.exports = { seed, DEMO_USER, SAMPLE_COMPANIES };
