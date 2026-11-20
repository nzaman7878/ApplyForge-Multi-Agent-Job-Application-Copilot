import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';

const DOC_ITEMS = [
  {
    id: 'architecture',
    title: 'Architecture Specification',
    filename: 'ARCHITECTURE.md',
    category: 'Engineering & Design',
    description: 'Multi-agent LangGraph DAG topology, agent state schemas, parallel fan-out analysis, human-in-the-loop checkpoint, and Chrome MV3 extension architecture.',
    tags: ['LangGraph', 'Multi-Agent', 'DAG', 'HITL', 'Gemini'],
    path: '/docs/ARCHITECTURE.md',
  },
  {
    id: 'api',
    title: 'REST API Specification',
    filename: 'API.md',
    category: 'API & Reference',
    description: 'Complete API reference covering Auth, Resumes, JDs, Scraper, Pipeline execution, CRM applications, and Analytics endpoints with payload schemas.',
    tags: ['REST', 'Endpoints', 'Schemas', 'JSON', 'JWT'],
    path: '/docs/API.md',
  },
  {
    id: 'auth-security',
    title: 'Authentication & Security Architecture',
    filename: 'AUTH_SECURITY.md',
    category: 'Security & Auth',
    description: 'JWT & refresh token flow, bcrypt password hashing, Axios response interceptor queue, Helmet CSP headers, rate limiting, and magic-byte upload sanitization.',
    tags: ['JWT', 'Security', 'CSP', 'Rate Limiting', 'Sanitization'],
    path: '/docs/AUTH_SECURITY.md',
  },
  {
    id: 'database',
    title: 'Database Architecture & Models',
    filename: 'DATABASE.md',
    category: 'Engineering & Design',
    description: 'MongoDB schemas and Mongoose ODM models for User, Resume, JobDescription, PipelineRun, and Application, with compound indexing and connection management.',
    tags: ['MongoDB', 'Mongoose', 'Schemas', 'Indexing', 'ERD'],
    path: '/docs/DATABASE.md',
  },
  {
    id: 'debugging',
    title: 'Debugging & Diagnostic Runbook',
    filename: 'DEBUGGING.md',
    category: 'Operations & QA',
    description: 'Diagnostic runbooks, Gemini API quota & key fallbacks, magic-byte inspection errors, Chrome MV3 DevTools debugging, and token refresh troubleshooting.',
    tags: ['Runbook', 'Debugging', 'Troubleshooting', 'Logs', 'Fallbacks'],
    path: '/docs/DEBUGGING.md',
  },
  {
    id: 'design',
    title: 'UI/UX Design System Specification',
    filename: 'DESIGN.md',
    category: 'Product & Design',
    description: 'Design system tokens, color palettes (slate, blue, emerald, amber, rose), Inter typography hierarchy, glassmorphic UI, and WAI-ARIA accessibility.',
    tags: ['Design Tokens', 'Tailwind', 'Typography', 'Accessibility', 'UI'],
    path: '/docs/DESIGN.md',
  },
  {
    id: 'feature-development',
    title: 'Feature Development & Engineering Guide',
    filename: 'FEATURE_DEVELOPMENT.md',
    category: 'Developer Guide',
    description: 'Developer onboarding guide on monorepo structure, adding LangGraph agent nodes, creating REST endpoints, building client components, and TDD workflows.',
    tags: ['Developer Guide', 'Agent Nodes', 'Controllers', 'Conventions'],
    path: '/docs/FEATURE_DEVELOPMENT.md',
  },
  {
    id: 'implementation-plan',
    title: 'Master Implementation Plan (110 Phases)',
    filename: 'IMPLEMENTATION_PLAN.md',
    category: 'Engineering & Design',
    description: 'The master 110-phase roadmap across Epics A through K, documenting every atomic commit, deliverable milestone, and capability from bootstrap to stretch goals.',
    tags: ['Roadmap', '110 Phases', 'Epics', 'Milestones', 'History'],
    path: '/docs/IMPLEMENTATION_PLAN.md',
  },
  {
    id: 'integrations',
    title: 'Third-Party Integrations & Ecosystem',
    filename: 'INTEGRATIONS.md',
    category: 'API & Reference',
    description: 'Integrations with Google Gemini 2.5 Flash, Cloudinary asset storage, Cheerio live web scrapers, Chrome MV3 extension, and cloud deployment targets.',
    tags: ['Gemini', 'Cloudinary', 'Cheerio', 'Chrome MV3', 'Vercel'],
    path: '/docs/INTEGRATIONS.md',
  },
  {
    id: 'mcp',
    title: 'Model Context Protocol (MCP) Specification',
    filename: 'MCP.md',
    category: 'Engineering & Design',
    description: 'Standardized tool protocols, ApplyForge MCP Server specification, tool schemas (tailor, ATS score, CRM query, follow-up draft), and resource URI lookups.',
    tags: ['MCP', 'AI Protocol', 'Tools', 'Resources', 'JSON-RPC'],
    path: '/docs/MCP.md',
  },
  {
    id: 'prd',
    title: 'Product Requirements Document (PRD)',
    filename: 'PRD.md',
    category: 'Product & Design',
    description: 'Product vision, user personas (Alex, Priya, Marcus), functional requirements FR-1 through FR-8, non-functional requirements, and success metrics.',
    tags: ['PRD', 'Product Vision', 'Personas', 'Requirements', 'KPIs'],
    path: '/docs/PRD.md',
  },
  {
    id: 'go-live-signoff',
    title: 'Production Go-Live Sign-Off & Release Audit',
    filename: 'PRODUCTION_GO_LIVE_SIGNOFF.md',
    category: 'Operations & QA',
    description: 'Formal sign-off checklist certifying 110 completed phases, 265+ passing tests, security hardening, Lighthouse >95 scores, and deployment readiness.',
    tags: ['Sign-Off', 'Audit', 'Production Ready', 'Verification', 'Quality'],
    path: '/docs/PRODUCTION_GO_LIVE_SIGNOFF.md',
  },
  {
    id: 'launch-roadmap',
    title: 'Production Launch Roadmap & Rollout Plan',
    filename: 'PRODUCTION_LAUNCH_ROADMAP.md',
    category: 'Operations & QA',
    description: 'Phased rollout plan: Pre-launch staging, Day-0 cutover, Days 1–14 stabilization, 30/60/90 day product horizons, and instant disaster recovery runbooks.',
    tags: ['Rollout', 'Launch', 'Disaster Recovery', 'Monitoring', 'Day-0'],
    path: '/docs/PRODUCTION_LAUNCH_ROADMAP.md',
  },
  {
    id: 'setup',
    title: 'Developer & Production Setup Guide',
    filename: 'SETUP.md',
    category: 'Developer Guide',
    description: 'Step-by-step setup guide covering Node.js prerequisites, environment variables, Docker Compose MongoDB startup, database seeding, and extension setup.',
    tags: ['Setup', 'Docker', 'Environment', 'Seeding', 'Onboarding'],
    path: '/docs/SETUP.md',
  },
  {
    id: 'testing',
    title: 'Testing Strategy & Verification Guide',
    filename: 'TESTING.md',
    category: 'Operations & QA',
    description: 'Comprehensive test guide detailing the test pyramid, Jest unit suites, Supertest integration tests, Vitest client tests, and GitHub Actions CI/CD.',
    tags: ['Testing', 'Jest', 'Supertest', 'Vitest', 'CI/CD', '265+ Tests'],
    path: '/docs/TESTING.md',
  },
];

const CATEGORIES = [
  'All',
  'Engineering & Design',
  'API & Reference',
  'Developer Guide',
  'Product & Design',
  'Security & Auth',
  'Operations & QA',
];

export default function Docs() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = useMemo(() => {
    return DOC_ITEMS.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col selection:bg-blue-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Header Breadcrumb & Title */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 mb-4">
            <span>📚 Technical Documentation Repository</span>
            <span className="text-slate-500">•</span>
            <span>Version 1.2.0</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            ApplyForge Documentation Hub
          </h1>
          <p className="text-slate-400 mt-2 text-base sm:text-lg max-w-3xl leading-relaxed">
            Comprehensive technical guides, architecture specifications, API references, data models, and developer workflows for the ApplyForge multi-agent copilot.
          </p>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          {/* Search Input */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documentation by title, keyword, or filename..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between mb-4 text-xs text-slate-400 px-1">
          <span>Showing {filteredDocs.length} of {DOC_ITEMS.length} documentation guides</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Clear search
            </button>
          )}
        </div>

        {/* Documentation Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => (
            <Card
              key={doc.id}
              className="p-5 flex flex-col justify-between hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition group bg-slate-900/80 border-slate-800"
            >
              <div>
                {/* Category & Filename Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                    {doc.category}
                  </span>
                  <code className="text-[11px] text-blue-400 font-mono">
                    docs/{doc.filename}
                  </code>
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-blue-400 transition-colors mb-2">
                  {doc.title}
                </h3>

                {/* Description */}
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  {doc.description}
                </p>
              </div>

              {/* Tags & Action Link */}
              <div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800/60 text-slate-400 border border-slate-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <a
                  href={`https://github.com/nzaman7878/ApplyForge-Multi-Agent-Job-Application-Copilot/blob/main/docs/${doc.filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white transition flex items-center justify-center gap-1.5 border border-slate-700/80 hover:border-blue-500"
                >
                  <span>Read Document</span>
                  <svg
                    className="w-3.5 h-3.5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                    />
                  </svg>
                </a>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty state when no docs match filter */}
        {filteredDocs.length === 0 && (
          <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 mt-4">
            <p className="text-slate-400 text-base font-medium mb-2">
              No documentation files found matching "{searchQuery}".
            </p>
            <p className="text-slate-500 text-sm">
              Try adjusting your search terms or selecting another category.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 text-center text-xs text-slate-400">
        ApplyForge Documentation Hub &copy; {new Date().getFullYear()} — Multi-Agent Job Application Copilot
      </footer>
    </div>
  );
}
