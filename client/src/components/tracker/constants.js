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
