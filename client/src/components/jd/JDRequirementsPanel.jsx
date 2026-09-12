import React, { useState } from 'react';
import { useToast } from '../../hooks/useToast';

/**
 * Format date string into human readable format
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * JDRequirementsPanel Component
 *
 * Visualizes parsed Job Description requirements:
 * - Required Skills (interactive tags/chips with quick search)
 * - Experience Tenure Requirements
 * - Educational & Professional Qualifications
 * - Preferred / Nice-to-Have Skills
 * - Raw Text toggle with one-click copy
 */
export default function JDRequirementsPanel({
  jobDescription,
  isLoading = false,
  onClose,
  className = '',
}) {
  const [activeTab, setActiveTab] = useState('structured'); // 'structured' | 'raw'
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [skillFilter, setSkillFilter] = useState('');

  const toast = useToast();

  if (isLoading) {
    return (
      <div
        className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center backdrop-blur-sm ${className}`}
      >
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-3"></div>
        <p className="text-sm text-slate-300 font-medium">Loading requirements visualizer...</p>
        <p className="text-xs text-slate-500 mt-1">Analyzing parsed job description criteria</p>
      </div>
    );
  }

  if (!jobDescription) {
    return (
      <div
        className={`bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 sm:p-14 text-center ${className}`}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-300">No Job Description Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Paste a job description or choose an existing position to inspect parsed skills,
          experience tenure, and qualifications.
        </p>
      </div>
    );
  }

  const reqs = jobDescription.parsedRequirements || {};
  const skills = Array.isArray(reqs.skills) ? reqs.skills : [];
  const experience = Array.isArray(reqs.experience) ? reqs.experience : [];
  const qualifications = Array.isArray(reqs.qualifications) ? reqs.qualifications : [];
  const niceToHave = Array.isArray(reqs.niceToHave) ? reqs.niceToHave : [];
  const rawText = jobDescription.rawText || '';

  const company = jobDescription.company || 'Target Company';
  const roleTitle = jobDescription.roleTitle || 'Target Role';

  const filteredSkills = skillFilter.trim()
    ? skills.filter((s) => s.toLowerCase().includes(skillFilter.trim().toLowerCase()))
    : skills;

  const totalRequirementsCount =
    skills.length + experience.length + qualifications.length + niceToHave.length;

  const handleCopyRawText = () => {
    if (!rawText) return;
    navigator.clipboard.writeText(rawText);
    setCopiedRaw(true);
    toast.success('Raw job description copied to clipboard');
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div
      className={`bg-slate-900/70 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md ${className}`}
    >
      {/* 1. Header Toolbar */}
      <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-950/40">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 font-bold text-sm">
            JD
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate flex items-center gap-2">
              <span>{roleTitle}</span>
              <span className="text-slate-400 font-normal">at</span>
              <span className="text-blue-400 font-semibold">{company}</span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {jobDescription.source === 'url' ? 'URL Ingested' : 'Pasted JD'}
              </span>
              <span>•</span>
              <span>{totalRequirementsCount} criteria identified</span>
              {jobDescription.createdAt && (
                <>
                  <span>•</span>
                  <span>{formatDate(jobDescription.createdAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* View Tabs & Actions */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('structured')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                activeTab === 'structured'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Requirements
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                activeTab === 'raw'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Raw Posting
            </button>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Content Body */}
      {activeTab === 'raw' ? (
        /* Raw Text Inspection View */
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Complete raw text parsed for this job posting:
            </span>
            <button
              type="button"
              onClick={handleCopyRawText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition border border-slate-700 cursor-pointer"
            >
              {copiedRaw ? (
                <>
                  <svg className="w-3.5 h-3.5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy Text
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed">
            {rawText || 'No raw text available.'}
          </pre>
        </div>
      ) : (
        /* Structured Requirements Visualizer */
        <div className="p-6 sm:p-8 space-y-7">
          {/* Section 1: Required Technical Skills */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Required Skills ({skills.length})
                </h3>
              </div>

              {skills.length > 8 && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter skills..."
                    value={skillFilter}
                    onChange={(e) => setSkillFilter(e.target.value)}
                    className="w-40 px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  {skillFilter && (
                    <button
                      type="button"
                      onClick={() => setSkillFilter('')}
                      className="absolute right-2 top-1 text-slate-400 hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>

            {skills.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
                No explicit technical skills recognized in the posting text.
              </p>
            ) : filteredSkills.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No skills matching "{skillFilter}".</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredSkills.map((skill, index) => (
                  <span
                    key={`${skill}-${index}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium transition shadow-xs"
                  >
                    <svg
                      className="w-3 h-3 text-blue-400 shrink-0"
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
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Experience Requirements */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Experience Requirements ({experience.length})
              </h3>
            </div>

            {experience.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
                No explicit tenure years detected (e.g. "5+ years").
              </p>
            ) : (
              <div className="space-y-2.5">
                {experience.map((expLine, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-slate-200 text-xs leading-relaxed"
                  >
                    <span className="text-amber-400 font-bold mt-0.5 shrink-0">⏳</span>
                    <span>{expLine}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Qualifications & Degrees */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Qualifications & Education ({qualifications.length})
              </h3>
            </div>

            {qualifications.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
                No specific degree requirements identified.
              </p>
            ) : (
              <div className="space-y-2.5">
                {qualifications.map((qualLine, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-slate-200 text-xs leading-relaxed"
                  >
                    <span className="text-emerald-400 font-bold mt-0.5 shrink-0">🎓</span>
                    <span>{qualLine}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Nice-To-Have / Preferred Qualifications */}
          {niceToHave.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  Nice to Have / Preferred ({niceToHave.length})
                </h3>
              </div>

              <div className="space-y-2.5">
                {niceToHave.map((nthLine, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 text-slate-200 text-xs leading-relaxed"
                  >
                    <span className="text-purple-400 font-bold mt-0.5 shrink-0">✨</span>
                    <span>{nthLine}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
