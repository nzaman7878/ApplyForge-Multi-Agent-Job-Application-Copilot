/**
 * Kanban Board Columns Definition & Helpers
 * Columns: Drafted | Applied | Interviewing | Rejected | Offer
 */
export const KANBAN_COLUMNS = [
  {
    id: 'wishlist',
    statusKey: 'wishlist',
    aliases: ['wishlist', 'drafted'],
    title: 'Drafted',
    icon: '📝',
    color: 'text-slate-300 border-slate-700/60',
    headerBg: 'bg-slate-800/60',
    badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
  },
  {
    id: 'applied',
    statusKey: 'applied',
    aliases: ['applied'],
    title: 'Applied',
    icon: '🚀',
    color: 'text-blue-300 border-blue-500/30',
    headerBg: 'bg-blue-950/40',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  {
    id: 'interviewing',
    statusKey: 'interviewing',
    aliases: ['interviewing'],
    title: 'Interviewing',
    icon: '🎯',
    color: 'text-amber-300 border-amber-500/30',
    headerBg: 'bg-amber-950/40',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    id: 'rejected',
    statusKey: 'rejected',
    aliases: ['rejected'],
    title: 'Rejected',
    icon: '✖️',
    color: 'text-rose-300 border-rose-500/30',
    headerBg: 'bg-rose-950/40',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
  {
    id: 'offer',
    statusKey: 'offer',
    aliases: ['offer'],
    title: 'Offer',
    icon: '🏆',
    color: 'text-emerald-300 border-emerald-500/30',
    headerBg: 'bg-emerald-950/40',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
];

/**
 * Normalizes any application status string to matching Kanban column ID
 */
export function normalizeStatusToColumnId(status) {
  if (!status) return 'applied';
  const clean = status.trim().toLowerCase();
  for (const col of KANBAN_COLUMNS) {
    if (col.aliases.includes(clean) || col.id === clean) {
      return col.id;
    }
  }
  return 'applied';
}

/**
 * Returns column styling and metadata for a given status
 */
export function getStatusInfo(status) {
  const colId = normalizeStatusToColumnId(status);
  return (
    KANBAN_COLUMNS.find((c) => c.id === colId) || {
      id: 'applied',
      title: 'Applied',
      icon: '🚀',
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    }
  );
}

/**
 * Returns fit score badge styling and label
 */
export function getFitScoreStyle(score) {
  if (score === undefined || score === null) {
    return {
      score: null,
      label: 'Fit: N/A',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    };
  }
  const numericScore = typeof score === 'number' ? score : parseInt(score, 10);
  if (isNaN(numericScore)) {
    return {
      score: null,
      label: 'Fit: N/A',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    };
  }
  if (numericScore >= 80) {
    return {
      score: numericScore,
      label: `${numericScore}% Strong Fit`,
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    };
  }
  if (numericScore >= 60) {
    return {
      score: numericScore,
      label: `${numericScore}% Moderate`,
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    };
  }
  return {
    score: numericScore,
    label: `${numericScore}% Stretch`,
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  };
}

/**
 * Formats days elapsed since applied date
 */
export function getDaysSinceApplied(dateVal) {
  if (!dateVal) return 'Drafted';
  const applied = new Date(dateVal);
  if (isNaN(applied.getTime())) return 'Drafted';

  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return 'Scheduled';
  if (diffDays === 0) return 'Applied today';
  if (diffDays === 1) return 'Applied 1d ago';
  if (diffDays < 7) return `Applied ${diffDays}d ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Applied ${weeks}w ago`;
  }
  const months = Math.floor(diffDays / 30);
  return `Applied ${months}mo ago`;
}

/**
 * Deterministically generates a gradient based on company name string
 */
export function getCompanyLogoColor(companyName = '') {
  const gradients = [
    'from-blue-600 to-indigo-600 text-blue-100 border-blue-400/30',
    'from-violet-600 to-purple-600 text-purple-100 border-purple-400/30',
    'from-emerald-600 to-teal-600 text-emerald-100 border-emerald-400/30',
    'from-amber-600 to-orange-600 text-amber-100 border-amber-400/30',
    'from-rose-600 to-pink-600 text-rose-100 border-rose-400/30',
    'from-cyan-600 to-blue-600 text-cyan-100 border-cyan-400/30',
  ];

  let hash = 0;
  for (let i = 0; i < companyName.length; i++) {
    hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

/**
 * Extracts initials from company name (up to 2 characters)
 */
export function getCompanyInitials(name = '') {
  const clean = name.trim();
  if (!clean) return 'AP';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

