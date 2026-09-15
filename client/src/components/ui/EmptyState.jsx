import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Hand-crafted SVG Illustration for "No Resumes" state
 */
export function NoResumesIllustration({ className = 'w-32 h-32 mx-auto' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="resumeBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="resumeAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="resumeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ambient background glow and guide circle */}
      <circle cx="80" cy="80" r="66" fill="url(#resumeGlow)" />
      <circle
        cx="80"
        cy="80"
        r="60"
        stroke="#334155"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.6"
      />

      {/* Main Document Body */}
      <rect
        x="46"
        y="34"
        width="68"
        height="92"
        rx="8"
        fill="url(#resumeBg)"
        stroke="#475569"
        strokeWidth="1.5"
      />

      {/* Folded Top-Right Corner */}
      <path
        d="M46 42 C46 37.58 49.58 34 54 34 H98 L114 50 V118 C114 122.42 110.42 126 106 126 H54 C49.58 126 46 122.42 46 118 Z"
        fill="url(#resumeBg)"
        stroke="#3b82f6"
        strokeWidth="1.5"
      />
      <path
        d="M98 34 V46 C98 48.2 99.8 50 102 50 H114"
        fill="#1e293b"
        stroke="#3b82f6"
        strokeWidth="1.5"
      />

      {/* Avatar placeholder circle */}
      <circle cx="64" cy="58" r="8" fill="#334155" stroke="#60a5fa" strokeWidth="1.5" />

      {/* Resume text lines */}
      <rect x="78" y="54" width="26" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="78" y="60" width="18" height="2.5" rx="1.25" fill="#64748b" />
      <rect x="56" y="74" width="48" height="2.5" rx="1.25" fill="#64748b" />
      <rect x="56" y="81" width="42" height="2.5" rx="1.25" fill="#475569" />
      <rect x="56" y="88" width="46" height="2.5" rx="1.25" fill="#475569" />
      <rect x="56" y="95" width="34" height="2.5" rx="1.25" fill="#334155" />

      {/* Upload Badge overlay at bottom right */}
      <circle
        cx="108"
        cy="116"
        r="16"
        fill="url(#resumeAccent)"
        stroke="#1e293b"
        strokeWidth="2.5"
      />
      <path
        d="M108 123 V109 M103 114 L108 109 L113 114"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Hand-crafted SVG Illustration for "No Applications" state
 */
export function NoApplicationsIllustration({ className = 'w-32 h-32 mx-auto' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="appBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="appAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="appGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ambient background glow and guide circle */}
      <circle cx="80" cy="80" r="66" fill="url(#appGlow)" />
      <circle
        cx="80"
        cy="80"
        r="60"
        stroke="#334155"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.6"
      />

      {/* Briefcase Handle */}
      <path
        d="M66 52 V44 C66 40.69 68.69 38 72 38 H88 C91.31 38 94 40.69 94 44 V52"
        stroke="#64748b"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Briefcase Body */}
      <rect
        x="38"
        y="52"
        width="84"
        height="66"
        rx="10"
        fill="url(#appBg)"
        stroke="#475569"
        strokeWidth="1.5"
      />

      {/* Latches and seam line */}
      <path d="M38 74 H122" stroke="#334155" strokeWidth="1.5" />
      <rect
        x="73"
        y="68"
        width="14"
        height="12"
        rx="3"
        fill="#1e293b"
        stroke="#64748b"
        strokeWidth="1.5"
      />
      <circle cx="80" cy="74" r="2" fill="#94a3b8" />

      {/* Interior document / tags lines */}
      <rect x="46" y="86" width="32" height="4" rx="2" fill="#475569" />
      <rect x="46" y="94" width="22" height="3" rx="1.5" fill="#334155" />

      {/* Checkmark badge overlay at bottom right */}
      <circle
        cx="112"
        cy="112"
        r="16"
        fill="url(#appAccent)"
        stroke="#1e293b"
        strokeWidth="2.5"
      />
      <path
        d="M106 112 L110 116 L118 108"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Sparkle decorative element */}
      <path
        d="M48 38 L50 42 L54 44 L50 46 L48 50 L46 46 L42 44 L46 42 Z"
        fill="#38bdf8"
        opacity="0.8"
      />
    </svg>
  );
}

/**
 * Hand-crafted SVG Illustration for "No Analytics" state
 */
export function NoAnalyticsIllustration({ className = 'w-32 h-32 mx-auto' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="chartBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="chartLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="chartArea" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
        </linearGradient>
        <linearGradient id="chartGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ambient background glow and guide circle */}
      <circle cx="80" cy="80" r="66" fill="url(#chartGlow)" />
      <circle
        cx="80"
        cy="80"
        r="60"
        stroke="#334155"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.6"
      />

      {/* Analytics Dashboard Card Window */}
      <rect
        x="36"
        y="42"
        width="88"
        height="76"
        rx="8"
        fill="url(#chartBg)"
        stroke="#475569"
        strokeWidth="1.5"
      />

      {/* Window Controls Mockup */}
      <circle cx="46" cy="52" r="3" fill="#ef4444" />
      <circle cx="54" cy="52" r="3" fill="#f59e0b" />
      <circle cx="62" cy="52" r="3" fill="#10b981" />
      <rect x="74" y="50.5" width="40" height="3" rx="1.5" fill="#334155" />

      {/* Grid lines inside chart */}
      <path
        d="M44 68 H116 M44 82 H116 M44 96 H116"
        stroke="#334155"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.6"
      />

      {/* Area fill beneath curve */}
      <path
        d="M46 96 C56 94 62 84 74 86 C86 88 94 72 108 66 C112 64 114 62 116 62 V104 H46 Z"
        fill="url(#chartArea)"
      />

      {/* Dynamic Velocity / Response Curve */}
      <path
        d="M46 96 C56 94 62 84 74 86 C86 88 94 72 108 66 C112 64 114 62 116 62"
        stroke="url(#chartLine)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Data keyframe dots */}
      <circle cx="46" cy="96" r="3" fill="#8b5cf6" stroke="#0f172a" strokeWidth="1.5" />
      <circle cx="74" cy="86" r="3" fill="#a855f7" stroke="#0f172a" strokeWidth="1.5" />
      <circle cx="108" cy="66" r="3.5" fill="#ec4899" stroke="#0f172a" strokeWidth="1.5" />

      {/* Trending arrow badge overlay at bottom right */}
      <circle cx="114" cy="114" r="16" fill="#8b5cf6" stroke="#1e293b" strokeWidth="2.5" />
      <path
        d="M109 119 L119 109 M119 109 H113 M119 109 V115"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Standard configuration presets for empty states
 */
const PRESETS = {
  'no-resumes': {
    title: 'No Resumes Uploaded Yet',
    description:
      'Upload your master PDF or DOCX resume to extract sections, technical skills, and work experience for AI tailoring.',
    actionText: 'Upload Master Resume',
    actionLink: '/apply',
    IllustrationComponent: NoResumesIllustration,
    glowColor: 'from-blue-500/10 via-indigo-500/10 to-transparent',
    btnColor: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20',
  },
  'no-applications': {
    title: 'No Applications Tracked',
    description:
      'Start by selecting a resume and target job description to generate tailored bullets, ATS analysis, and custom cover letters.',
    actionText: 'Create First Application',
    actionLink: '/apply',
    IllustrationComponent: NoApplicationsIllustration,
    glowColor: 'from-emerald-500/10 via-teal-500/10 to-transparent',
    btnColor: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20',
  },
  'no-analytics': {
    title: 'No Analytics Data Yet',
    description:
      'Once you submit tailored applications and track recruiter responses, your submission velocity and fit score correlations will populate here.',
    actionText: 'Start Tailoring Applications',
    actionLink: '/apply',
    IllustrationComponent: NoAnalyticsIllustration,
    glowColor: 'from-purple-500/10 via-pink-500/10 to-transparent',
    btnColor: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20',
  },
};

/**
 * Unified EmptyState Component
 *
 * Renders rich SVG illustrations and clear call-to-actions for empty states
 * across resumes, applications, analytics, and custom workflows.
 *
 * @param {Object} props
 * @param {'no-resumes'|'no-applications'|'no-analytics'|'generic'} [props.type='no-applications'] - Preset illustration type
 * @param {string} [props.title] - Override title
 * @param {string} [props.description] - Override descriptive text
 * @param {string} [props.actionText] - Override primary action text
 * @param {string} [props.actionLink] - Primary action router link (defaults to /apply)
 * @param {Function} [props.onAction] - Primary action callback
 * @param {string} [props.secondaryActionText] - Optional secondary action text
 * @param {string} [props.secondaryActionLink] - Optional secondary action link
 * @param {Function} [props.onSecondaryAction] - Optional secondary action callback
 * @param {React.ReactNode} [props.illustration] - Custom SVG illustration override
 * @param {boolean} [props.compact=false] - Compact rendering mode
 * @param {string} [props.className=''] - Additional container styling
 */
export default function EmptyState({
  type = 'no-applications',
  title,
  description,
  actionText,
  actionLink,
  onAction,
  secondaryActionText,
  secondaryActionLink,
  onSecondaryAction,
  illustration,
  compact = false,
  className = '',
}) {
  const preset = PRESETS[type] || PRESETS['no-applications'];

  const displayTitle = title || preset.title;
  const displayDescription = description || preset.description;
  const displayActionText = actionText || preset.actionText;
  const displayActionLink = actionLink || preset.actionLink;
  const IllustrationComp = preset.IllustrationComponent;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 text-center backdrop-blur-md transition-all shadow-xl ${
        compact ? 'p-6 sm:p-8' : 'p-8 sm:p-12'
      } ${className}`}
    >
      {/* Subtle top ambient glow strip */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${preset.glowColor} opacity-70`}
      />

      {/* SVG Illustration */}
      <div className="mb-5 flex justify-center">
        {illustration || (
          <IllustrationComp className={compact ? 'w-24 h-24 mx-auto' : 'w-32 h-32 mx-auto'} />
        )}
      </div>

      {/* Title & Description */}
      <h3
        className={`font-bold text-white tracking-tight ${
          compact ? 'text-base sm:text-lg mb-1.5' : 'text-lg sm:text-xl mb-2'
        }`}
      >
        {displayTitle}
      </h3>

      {displayDescription && (
        <p
          className={`text-slate-400 max-w-md mx-auto leading-relaxed ${
            compact ? 'text-xs sm:text-sm mb-5' : 'text-sm mb-6'
          }`}
        >
          {displayDescription}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {displayActionText && (
          onAction ? (
            <button
              type="button"
              onClick={onAction}
              className={`inline-flex items-center gap-2 font-semibold rounded-xl transition shadow-lg ${
                compact ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm'
              } ${preset.btnColor}`}
            >
              <span>✨</span>
              <span>{displayActionText}</span>
            </button>
          ) : (
            <Link
              to={displayActionLink}
              className={`inline-flex items-center gap-2 font-semibold rounded-xl transition shadow-lg ${
                compact ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm'
              } ${preset.btnColor}`}
            >
              <span>✨</span>
              <span>{displayActionText}</span>
            </Link>
          )
        )}

        {secondaryActionText && (
          onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              className={`inline-flex items-center gap-1.5 font-semibold rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 transition ${
                compact ? 'px-3.5 py-2 text-xs' : 'px-4 py-2.5 text-sm'
              }`}
            >
              {secondaryActionText}
            </button>
          ) : (
            <Link
              to={secondaryActionLink || '/tracker'}
              className={`inline-flex items-center gap-1.5 font-semibold rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 transition ${
                compact ? 'px-3.5 py-2 text-xs' : 'px-4 py-2.5 text-sm'
              }`}
            >
              {secondaryActionText}
            </Link>
          )
        )}
      </div>
    </div>
  );
}
