import React, { useState } from 'react';
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

/**
 * JDPasteForm Component
 *
 * Provides a form for pasting and parsing job descriptions:
 * - Company & Role Title inputs
 * - Large textarea for raw JD text
 * - Dynamic character, word, and reading time counters
 * - Client & server validation with toast feedback
 * - Fast sample filler and clear action
 */
export default function JDPasteForm({ onSuccess, onCancel, className = '' }) {
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const toast = useToast();

  // Metrics
  const charCount = rawText.length;
  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
  const estimatedReadTime = Math.max(1, Math.ceil(wordCount / 200));

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please complete all required fields properly');
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await api.post('/api/jds', {
        company: company.trim(),
        roleTitle: roleTitle.trim(),
        rawText: rawText.trim(),
        source: 'paste',
      });

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
    setErrors({});
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl ${className}`}
      noValidate
    >
      {/* Header with Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
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
            Paste Job Description
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Extract required skills, experience tenure, and qualifications automatically.
          </p>
        </div>

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
          disabled={isSubmitting}
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
          disabled={isSubmitting}
        />
      </div>

      {/* Large Textarea for JD */}
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
            placeholder="Paste the full job posting text here, including requirements, responsibilities, technical qualifications, and preferred skills..."
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              if (errors.rawText) setErrors((prev) => ({ ...prev, rawText: undefined }));
            }}
            disabled={isSubmitting}
            className={`w-full p-4 text-sm bg-slate-900/90 border rounded-xl text-white placeholder-slate-500 font-normal leading-relaxed transition-colors focus:outline-none focus:ring-2 resize-y min-h-[220px] ${
              errors.rawText
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        </div>

        {/* Character counter bar */}
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

      {/* Footer Submit Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSubmitting}
          disabled={isSubmitting || charCount < 10 || !company.trim() || !roleTitle.trim()}
          className="shadow-lg shadow-blue-600/20 px-6 font-semibold"
        >
          Parse & Save Job Description
        </Button>
      </div>
    </form>
  );
}
