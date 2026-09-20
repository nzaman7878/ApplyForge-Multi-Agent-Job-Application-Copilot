import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/axios';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const SAMPLE_JD = {
  company: 'CloudScale Systems',
  roleTitle: 'Senior Full Stack Engineer',
  rawText: `About the Role:
We are seeking an experienced Senior Full Stack Engineer to lead the development of our high-scale AI-assisted analytics platform.

Requirements:
• 5+ years of full-stack software development experience
• Strong proficiency in React, TypeScript, Next.js, and modern CSS
• Hands-on backend experience with Node.js, Express, and REST/GraphQL APIs
• Expertise with databases such as MongoDB, PostgreSQL, and Redis
• Bachelor's degree in Computer Science, Software Engineering, or equivalent experience

Nice to Have:
• Experience with Docker, Kubernetes, and AWS cloud infrastructure is a plus
• Familiarity with LLM orchestration frameworks (LangChain, LlamaIndex) is preferred
• Track record of building microservices and CI/CD pipelines`,
};

const SCRAPE_STEPS = [
  'Rotating browser user-agents & simulating authentic client headers...',
  'Connecting to job board & bypassing anti-bot shields...',
  'Extracting job posting content & stripping navigation chrome...',
  'Analyzing role title, company name, and technical qualifications...',
];

/**
 * JDPasteForm Component
 *
 * Provides a dual-mode interface for inputting job descriptions:
 * 1. Manual Text Paste: Paste raw text with word/char metrics and sample loader
 * 2. URL Scraper: Automatically scrape from LinkedIn, Greenhouse, Naukri, or corporate career sites
 *    with real-time progress indicators and pre-submission editing.
 */
export default function JDPasteForm({ onSuccess, onCancel, className = '' }) {
  // Mode: 'paste' | 'url'
  const [mode, setMode] = useState('paste');

  // Form Fields
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // URL Scraper State
  const [inputUrl, setInputUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scrapeStepIndex, setScrapeStepIndex] = useState(0);
  const [scrapedMetadata, setScrapedMetadata] = useState(null);
  const [hasScraped, setHasScraped] = useState(false);

  const toast = useToast();
  const progressTimerRef = useRef(null);
  const stepTimerRef = useRef(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

  // Text metrics
  const charCount = rawText.length;
  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
  const estimatedReadTime = Math.max(1, Math.ceil(wordCount / 200));

  // Form validation
  const validate = () => {
    const newErrors = {};

    if (!company.trim()) {
      newErrors.company = 'Company name is required';
    } else if (company.trim().length > 150) {
      newErrors.company = 'Company name cannot exceed 150 characters';
    }

    if (!roleTitle.trim()) {
      newErrors.roleTitle = 'Role title is required';
    } else if (roleTitle.trim().length > 150) {
      newErrors.roleTitle = 'Role title cannot exceed 150 characters';
    }

    if (!rawText.trim()) {
      newErrors.rawText = 'Job description text is required';
    } else if (rawText.trim().length < 10) {
      newErrors.rawText = 'Job description text must contain at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // URL Scraper Execution
  const handleScrapeUrl = async (e) => {
    if (e) e.preventDefault();

    const trimmedUrl = inputUrl.trim();
    if (!trimmedUrl) {
      setErrors((prev) => ({ ...prev, url: 'Job posting URL is required' }));
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setErrors((prev) => ({
        ...prev,
        url: 'URL must begin with http:// or https://',
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, url: undefined }));
    setIsScraping(true);
    setScrapeProgress(10);
    setScrapeStepIndex(0);

    // Animate progress simulation while fetching
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setScrapeProgress((prev) => {
        if (prev >= 88) return prev;
        const jump = Math.floor(Math.random() * 12) + 5;
        return Math.min(prev + jump, 88);
      });
    }, 450);

    // Rotate step text
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    stepTimerRef.current = setInterval(() => {
      setScrapeStepIndex((prev) => (prev + 1) % SCRAPE_STEPS.length);
    }, 1200);

    try {
      const response = await api.post('/api/jds/from-url', {
        url: trimmedUrl,
        preview: true,
      });

      const data = response.data;
      setScrapeProgress(100);

      // Pre-fill editable form fields with scraped content
      setCompany(data.company || '');
      setRoleTitle(data.roleTitle || '');
      setRawText(data.rawText || '');
      setScrapedMetadata({
        board: data.board || 'generic',
        location: data.location || '',
        url: trimmedUrl,
      });
      setHasScraped(true);

      toast.success(
        `Job details extracted from ${data.board ? data.board.toUpperCase() : 'page'}! You can review and edit below.`
      );
    } catch (err) {
      console.error('Scrape job description error:', err);
      const serverMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to scrape job posting URL. Please check the link or paste the text manually.';

      setErrors((prev) => ({ ...prev, url: serverMessage }));
      toast.error(serverMessage);
    } finally {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setIsScraping(false);
    }
  };

  // Reset scraped state to enter another URL
  const handleResetScraper = () => {
    setHasScraped(false);
    setScrapedMetadata(null);
    setInputUrl('');
    setCompany('');
    setRoleTitle('');
    setRawText('');
    setErrors({});
  };

  // Final Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please complete all required fields properly');
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const payload = {
        company: company.trim(),
        roleTitle: roleTitle.trim(),
        rawText: rawText.trim(),
        source: mode === 'url' && scrapedMetadata ? 'url' : 'paste',
      };

      if (mode === 'url' && (scrapedMetadata?.url || inputUrl.trim())) {
        payload.sourceUrl = (scrapedMetadata?.url || inputUrl).trim();
      }

      const response = await api.post('/api/jds', payload);
      const createdJd = response.data.jobDescription || response.data;

      toast.success(
        `Job description for ${createdJd.company || company} parsed and saved successfully!`
      );

      if (onSuccess) {
        onSuccess(createdJd);
      }
    } catch (err) {
      console.error('Failed to create job description:', err);
      const serverMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to save job description. Please try again.';

      toast.error(serverMessage);

      if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
        const fieldErrors = {};
        err.response.data.details.forEach((item) => {
          if (item.field) fieldErrors[item.field] = item.message;
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillSample = () => {
    setCompany(SAMPLE_JD.company);
    setRoleTitle(SAMPLE_JD.roleTitle);
    setRawText(SAMPLE_JD.rawText);
    setErrors({});
    toast.info('Loaded sample job description');
  };

  const handleClear = () => {
    setCompany('');
    setRoleTitle('');
    setRawText('');
    setInputUrl('');
    setHasScraped(false);
    setScrapedMetadata(null);
    setErrors({});
  };

  return (
    <div
      className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl ${className}`}
    >
      {/* Top Header & Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Target Job Description
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Extract required skills, qualifications, and responsibilities automatically.
          </p>
        </div>

        {/* Segmented Mode Selector */}
        <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setMode('paste');
              setErrors({});
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
              mode === 'paste'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Paste Text
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('url');
              setErrors({});
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
              mode === 'url'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Import from URL
          </button>
        </div>
      </div>

      {/* URL INPUT & SCRAPER WORKFLOW */}
      {mode === 'url' && (
        <div className="space-y-4 pb-2">
          {/* Supported Job Board Badges */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="text-slate-500 font-medium">Supported Boards:</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-950/70 border border-blue-800/60 text-blue-300 font-mono">
              LinkedIn
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-mono">
              Greenhouse
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-950/70 border border-amber-800/60 text-amber-300 font-mono">
              Naukri
            </span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-950/70 border border-indigo-800/60 text-indigo-300 font-mono">
              Direct Portals (JSON-LD)
            </span>
          </div>

          {/* URL Input Bar */}
          {!hasScraped ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  </div>
                  <input
                    type="url"
                    id="job-url-input"
                    aria-label="Job Posting URL"
                    placeholder="https://boards.greenhouse.io/... or https://www.linkedin.com/jobs/view/..."
                    value={inputUrl}
                    onChange={(e) => {
                      setInputUrl(e.target.value);
                      if (errors.url) setErrors((prev) => ({ ...prev, url: undefined }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleScrapeUrl();
                      }
                    }}
                    disabled={isScraping || isSubmitting}
                    className={`w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900/90 border rounded-xl text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 ${
                      errors.url
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20'
                    }`}
                  />
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleScrapeUrl}
                  isLoading={isScraping}
                  disabled={isScraping || !inputUrl.trim()}
                  className="px-5 shrink-0 font-medium"
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                    />
                  </svg>
                  Fetch & Extract JD
                </Button>
              </div>

              {errors.url && <p className="text-xs text-red-400 font-medium">{errors.url}</p>}
            </div>
          ) : (
            /* Scraped Status Callout & Re-scrape Option */
            <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">
                      Job Details Extracted
                    </span>
                    {scrapedMetadata?.board && (
                      <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-semibold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {scrapedMetadata.board}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Extracted from{' '}
                    <span className="text-slate-300 truncate font-mono text-[11px] inline-block max-w-xs align-bottom">
                      {inputUrl}
                    </span>
                    . Review and edit any field below before finalizing.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetScraper}
                className="text-xs text-slate-400 hover:text-white shrink-0"
              >
                Change URL
              </Button>
            </div>
          )}

          {/* Real-time Animated Scraping Progress Bar & Step Indicators */}
          {isScraping && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-blue-400 font-medium">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  <span>{SCRAPE_STEPS[scrapeStepIndex]}</span>
                </div>
                <span className="font-mono text-slate-400">{scrapeProgress}%</span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${scrapeProgress}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Applying rotating user-agents, dynamic delay pacing, and JSON-LD schema parsing.
              </p>
            </div>
          )}
        </div>
      )}

      {/* EDITABLE FORM FIELDS (Applies to both manual paste and reviewed scrape) */}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Actions Bar for Manual Paste */}
        {mode === 'paste' && (
          <div className="flex items-center justify-between gap-2 -mt-2">
            <span className="text-xs text-slate-400">
              Paste the job posting description directly or load sample text.
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleFillSample}
                disabled={isSubmitting}
                title="Preload sample job description for testing"
              >
                Sample JD
              </Button>
              {(company || roleTitle || rawText) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={isSubmitting}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Inputs Grid: Company & Role Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Company Name"
            placeholder="e.g. Stripe, OpenAI, Google"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              if (errors.company) setErrors((prev) => ({ ...prev, company: undefined }));
            }}
            error={errors.company}
            required
            disabled={isSubmitting || isScraping}
          />

          <Input
            label="Role Title"
            placeholder="e.g. Senior Backend Engineer"
            value={roleTitle}
            onChange={(e) => {
              setRoleTitle(e.target.value);
              if (errors.roleTitle) setErrors((prev) => ({ ...prev, roleTitle: undefined }));
            }}
            error={errors.roleTitle}
            required
            disabled={isSubmitting || isScraping}
          />
        </div>

        {/* Large Textarea for Job Description Content */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label
              htmlFor="jd-raw-text"
              className="text-xs font-medium text-slate-300 flex items-center gap-1"
            >
              Job Description Content <span className="text-red-400">*</span>
            </label>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>~{estimatedReadTime} min read</span>
            </div>
          </div>

          <div className="relative">
            <textarea
              id="jd-raw-text"
              rows={12}
              placeholder="Paste the full job posting text here, or use the 'Import from URL' tab to extract automatically..."
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (errors.rawText) setErrors((prev) => ({ ...prev, rawText: undefined }));
              }}
              disabled={isSubmitting || isScraping}
              className={`w-full p-4 text-sm bg-slate-900/90 border rounded-xl text-white placeholder-slate-500 font-normal leading-relaxed transition-colors focus:outline-none focus:ring-2 resize-y min-h-[220px] ${
                errors.rawText
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            />
          </div>

          {/* Character counter and status footer */}
          <div className="flex items-center justify-between text-xs pt-1 px-1">
            {errors.rawText ? (
              <p className="text-red-400 font-medium">{errors.rawText}</p>
            ) : (
              <p className="text-slate-500">
                {charCount < 10 ? (
                  <span className="text-amber-400/90">Requires at least 10 characters</span>
                ) : (
                  <span className="text-emerald-400/90">Ready for automated analysis</span>
                )}
              </p>
            )}

            <div
              className={`font-mono text-[11px] ${
                charCount < 10
                  ? 'text-slate-500'
                  : charCount > 15000
                    ? 'text-amber-400'
                    : 'text-slate-400'
              }`}
            >
              {charCount.toLocaleString()} chars
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onCancel}
              disabled={isSubmitting || isScraping}
            >
              Cancel
            </Button>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={
              isSubmitting || isScraping || charCount < 10 || !company.trim() || !roleTitle.trim()
            }
            className="shadow-lg shadow-blue-600/20 px-6 font-semibold"
          >
            Parse & Save Job Description
          </Button>
        </div>
      </form>
    </div>
  );
}
