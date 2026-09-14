import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { KanbanBoard } from '../components/tracker';
import PageLoader from '../components/ui/PageLoader';
import { useToast } from '../hooks/useToast';
import api from '../lib/axios';

export default function Tracker() {
  const toast = useToast();
  const [applications, setApplications] = useState([]);
  const [dueFollowUps, setDueFollowUps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all applications and due reminders
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [appRes, dueRes] = await Promise.all([
        api.get('/api/applications?limit=100'),
        api.get('/api/applications/follow-ups/due').catch(() => ({ data: { dueFollowUps: [] } })),
      ]);

      const appsList = appRes.data?.applications || [];
      const dueList = dueRes.data?.dueFollowUps || [];
      const dueSet = new Set(dueList.map((d) => d._id || d.id));
      const enrichedApps = appsList.map((app) => ({
        ...app,
        isOverdue: dueSet.has(app._id || app.id),
      }));

      setApplications(enrichedApps);
      setDueFollowUps(dueList);
    } catch (err) {
      console.error('[Tracker] Error loading applications:', err);
      toast.error('Failed to load tracked applications');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Drag-and-Drop Status Change
  const handleStatusChange = async (applicationId, newStatus) => {
    // Find target application
    const targetApp = applications.find(
      (a) => (a.id || a._id) === applicationId
    );

    if (!targetApp) return;

    const previousStatus = targetApp.status;

    // 1. Optimistic local update
    setApplications((prev) =>
      prev.map((app) =>
        (app.id || app._id) === applicationId
          ? { ...app, status: newStatus }
          : app
      )
    );

    const statusLabels = {
      wishlist: 'Drafted',
      applied: 'Applied',
      interviewing: 'Interviewing',
      rejected: 'Rejected',
      offer: 'Offer',
    };

    try {
      // 2. Persist status transition via PATCH
      await api.patch(`/api/applications/${applicationId}`, {
        status: newStatus,
      });

      toast.success(
        `Moved "${targetApp.company}" to ${statusLabels[newStatus] || newStatus}`
      );
    } catch (err) {
      console.error('[Tracker] Status update failed:', err);

      // Revert optimistic update
      setApplications((prev) =>
        prev.map((app) =>
          (app.id || app._id) === applicationId
            ? { ...app, status: previousStatus }
            : app
        )
      );

      toast.error(
        err.response?.data?.message || 'Failed to update application status'
      );
    }
  };

  // Filter applications by search text
  const filteredApplications = useMemo(() => {
    if (!searchQuery.trim()) return applications;
    const q = searchQuery.toLowerCase().trim();
    return applications.filter(
      (app) =>
        app.company?.toLowerCase().includes(q) ||
        app.roleTitle?.toLowerCase().includes(q) ||
        app.notes?.toLowerCase().includes(q)
    );
  }, [applications, searchQuery]);

  // Status Metrics Breakdown
  const metrics = useMemo(() => {
    const counts = {
      total: applications.length,
      wishlist: 0,
      applied: 0,
      interviewing: 0,
      rejected: 0,
      offer: 0,
    };

    applications.forEach((app) => {
      const s = (app.status || 'applied').toLowerCase();
      if (s === 'wishlist' || s === 'drafted') counts.wishlist += 1;
      else if (s === 'applied') counts.applied += 1;
      else if (s === 'interviewing') counts.interviewing += 1;
      else if (s === 'rejected') counts.rejected += 1;
      else if (s === 'offer') counts.offer += 1;
    });

    return counts;
  }, [applications]);

  if (isLoading && applications.length === 0) {
    return (
      <AppLayout>
        <PageLoader message="Loading application tracker board..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-xs sm:text-sm text-slate-400">
          <Link to="/dashboard" className="hover:text-white transition">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-white font-medium">Tracker</span>
        </div>

        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Application Tracker</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                Kanban
              </span>
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Drag-and-drop job applications across stages to manage your hiring pipeline.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/apply"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition shadow-sm shadow-blue-600/30"
            >
              <span>+ New Application</span>
            </Link>
          </div>
        </div>

        {/* Due Follow-Ups Banner */}
        {dueFollowUps.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <p>
                <strong className="font-semibold text-white">
                  {dueFollowUps.length} follow-up{dueFollowUps.length > 1 ? 's' : ''} due:
                </strong>{' '}
                {dueFollowUps
                  .map((d) => d.company)
                  .slice(0, 3)
                  .join(', ')}
                {dueFollowUps.length > 3 ? ` and ${dueFollowUps.length - 3} more` : ''}.
              </p>
            </div>
            <span className="text-[11px] text-amber-300/80 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
              Check urgent cards marked with beacon
            </span>
          </div>
        )}

        {/* Metrics Overview Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-xs text-slate-400 font-medium">Total</span>
            <p className="text-xl font-bold text-white mt-0.5">{metrics.total}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-xs text-slate-400 font-medium">📝 Drafted</span>
            <p className="text-xl font-bold text-slate-300 mt-0.5">{metrics.wishlist}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-xs text-blue-400 font-medium">🚀 Applied</span>
            <p className="text-xl font-bold text-blue-300 mt-0.5">{metrics.applied}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-xs text-amber-400 font-medium">🎯 Interviewing</span>
            <p className="text-xl font-bold text-amber-300 mt-0.5">{metrics.interviewing}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-xs text-rose-400 font-medium">✖️ Rejected</span>
            <p className="text-xl font-bold text-rose-300 mt-0.5">{metrics.rejected}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-xs text-emerald-400 font-medium">🏆 Offer</span>
            <p className="text-xl font-bold text-emerald-300 mt-0.5">{metrics.offer}</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-3 mb-6 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search applications by company, role, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Kanban Board Component */}
        <div className="bg-slate-950/40 rounded-2xl border border-slate-800/80 p-4">
          <KanbanBoard
            applications={filteredApplications}
            onStatusChange={handleStatusChange}
            isLoading={isLoading}
          />
        </div>
      </main>
    </AppLayout>
  );
}
