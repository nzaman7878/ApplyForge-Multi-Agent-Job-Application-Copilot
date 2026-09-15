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
 * ResumePreview Component
 *
 * Renders parsed resume sections in a structured layout:
 * - Contact Information (Email, Phone, Location, Links)
 * - Professional Summary
 * - Skills Badges
 * - Work Experience Timeline & Bullet Points
 * - Education & Honors
 * - Certifications
 * - Raw Text inspection drawer/toggle
 */
export default function ResumePreview({
  resume,
  isLoading = false,
  onClose,
  className = '',
}) {
  const [activeTab, setActiveTab] = useState('structured'); // 'structured' | 'raw'
  const [copiedRaw, setCopiedRaw] = useState(false);
  const toast = useToast();

  if (isLoading) {
    return (
      <div
        className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center backdrop-blur-sm ${className}`}
      >
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-3"></div>
        <p className="text-sm text-slate-300 font-medium">Loading resume preview...</p>
        <p className="text-xs text-slate-500 mt-1">Fetching parsed document sections</p>
      </div>
    );
  }

  if (!resume) {
    return (
      <div
        className={`bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 sm:p-16 text-center ${className}`}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-300">No Resume Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Select an uploaded resume from your list or upload a new PDF / DOCX to inspect the parsed sections.
        </p>
      </div>
    );
  }

  const sections = resume.parsedSections || {};
  const contact = sections.contact || {};
  const summary = sections.summary || '';
  const skills = Array.isArray(sections.skills) ? sections.skills : [];
  const experience = Array.isArray(sections.experience) ? sections.experience : [];
  const education = Array.isArray(sections.education) ? sections.education : [];
  const certifications = Array.isArray(sections.certifications) ? sections.certifications : [];
  const rawText = resume.rawText || '';

  const candidateName =
    contact.name || resume.name || resume.originalFilename || 'Candidate Resume';
  const isPdf = (resume.originalFilename || resume.name || '').endsWith('.pdf');

  const handleCopyRawText = () => {
    if (!rawText) return;
    navigator.clipboard.writeText(rawText);
    setCopiedRaw(true);
    toast.success('Raw resume text copied to clipboard');
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div
      className={`bg-slate-900/70 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md ${className}`}
    >
      {/* 1. Header Toolbar */}
      <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-950/40">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs uppercase ${
              isPdf
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}
          >
            {isPdf ? 'PDF' : 'DOCX'}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{candidateName}</h2>
            <p className="text-xs text-slate-400 truncate">
              {resume.originalFilename || resume.name}
              {resume.uploadedAt && (
                <span className="text-slate-500 ml-2">
                  • Uploaded {formatDate(resume.uploadedAt)}
                </span>
              )}
            </p>
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
              Structured View
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
              Raw Extracted Text
            </button>
          </div>

          {resume.cloudinaryUrl && (
            <a
              href={resume.cloudinaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-200 border border-indigo-500/30 rounded-lg text-xs font-medium transition cursor-pointer"
              title="Open original file on Cloudinary"
            >
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>View Original</span>
            </a>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close preview"
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
        /* Raw Text Inspection Tab */
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Raw plain text parsed from document buffer:
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
        /* Structured Sections View */
        <div className="p-6 sm:p-8 space-y-8">
          {/* Section: Contact Bar */}
          <div className="flex flex-wrap gap-2.5">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition"
              >
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                {contact.email}
              </a>
            )}

            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition"
              >
                <svg className="w-3.5 h-3.5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                {contact.phone}
              </a>
            )}

            {contact.location && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/70 text-slate-300 border border-slate-700/60">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {contact.location}
              </span>
            )}

            {contact.linkedin && (
              <a
                href={contact.linkedin.startsWith('http') ? contact.linkedin : `https://${contact.linkedin}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/70 hover:bg-slate-800 text-blue-300 hover:text-blue-200 border border-slate-700/60 transition"
              >
                <span>LinkedIn</span>
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {contact.github && (
              <a
                href={contact.github.startsWith('http') ? contact.github : `https://${contact.github}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/70 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/60 transition"
              >
                <span>GitHub</span>
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {contact.portfolio && (
              <a
                href={contact.portfolio.startsWith('http') ? contact.portfolio : `https://${contact.portfolio}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/70 hover:bg-slate-800 text-teal-300 hover:text-teal-200 border border-slate-700/60 transition"
              >
                <span>Portfolio</span>
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>

          {/* Section: Professional Summary */}
          {summary && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Professional Summary
              </h3>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-sm text-slate-300 leading-relaxed">
                {summary}
              </div>
            </div>
          )}

          {/* Section: Skills */}
          {skills.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Skills & Competencies
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {skills.length} extracted
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <span
                    key={`${skill}-${index}`}
                    className="px-3 py-1 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/70 rounded-lg text-xs font-medium transition hover:border-blue-500/50"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section: Work Experience */}
          {experience.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Work Experience
              </h3>
              <div className="space-y-4">
                {experience.map((job, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2.5 relative pl-5 before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:bg-blue-600 before:rounded-r"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {job.title || 'Role Title'}
                        </h4>
                        <p className="text-xs text-slate-300 font-medium">
                          {job.company || 'Company'}
                          {job.location && (
                            <span className="text-slate-500 ml-1.5">• {job.location}</span>
                          )}
                        </p>
                      </div>
                      {(job.startDate || job.endDate || job.current) && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700/80 self-start sm:self-auto">
                          {job.startDate || ''} {job.startDate && (job.endDate || job.current) ? '–' : ''}{' '}
                          {job.current ? 'Present' : job.endDate || ''}
                        </span>
                      )}
                    </div>

                    {job.description && (
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {job.description}
                      </p>
                    )}

                    {job.bulletPoints && job.bulletPoints.length > 0 && (
                      <ul className="space-y-1.5 pt-1">
                        {job.bulletPoints.map((point, pIdx) => (
                          <li
                            key={pIdx}
                            className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed"
                          >
                            <span className="text-blue-500 font-bold leading-tight select-none">
                              •
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Education */}
          {education.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Education
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {education.map((edu, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1"
                  >
                    <h4 className="text-sm font-semibold text-white">
                      {edu.degree || edu.institution || 'Degree'}
                    </h4>
                    {edu.institution && (
                      <p className="text-xs text-slate-300">{edu.institution}</p>
                    )}
                    {edu.fieldOfStudy && (
                      <p className="text-xs text-slate-400">{edu.fieldOfStudy}</p>
                    )}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <span>
                        {edu.startDate || ''} {edu.startDate && edu.endDate ? '–' : ''}{' '}
                        {edu.endDate || ''}
                      </span>
                      {edu.gpa && (
                        <span className="text-teal-400 font-medium">GPA: {edu.gpa}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Certifications */}
          {certifications.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Certifications
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {cert.name || 'Certification'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {cert.issuer || ''} {cert.date ? `• ${cert.date}` : ''}
                      </p>
                    </div>
                    {cert.url && (
                      <a
                        href={cert.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium shrink-0 flex items-center gap-1"
                      >
                        Verify
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
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
