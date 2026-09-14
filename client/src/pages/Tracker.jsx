import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { KanbanBoard, ApplicationTable, FollowUpBanner } from '../components/tracker';
import PageLoader from '../components/ui/PageLoader';
import { useToast } from '../hooks/useToast';
import api from '../lib/axios';

export default function Tracker() {
  const toast = useToast();
  const [applications, setApplications] = useState([]);
  const [dueFollowUps, setDueFollowUps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('applyforge_tracker_view') || 'kanban';
    } catch {
      return 'kanban';
    }
  });

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('applyforge_tracker_view', mode);
    } catch (e) {
      console.warn('Failed to persist view preference in localStorage:', e);
    }
  };

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

  // Handle Mark / Schedule Follow-Up
  const handleMarkFollowUp = async (applicationId, nextFollowUpAt) => {
    const targetApp = applications.find(
      (a) => (a.id || a._id) === applicationId
    );
    if (!targetApp) return;

    const previousNextFollowUp = targetApp.nextFollowUpAt;

    // 1. Optimistic local update
    setApplications((prev) =>
      prev.map((app) =>
        (app.id || app._id) === applicationId
          ? { ...app, nextFollowUpAt, isOverdue: false }
          : app
      )
    );

    try {
      // 2. Persist follow-up date via PATCH
      await api.patch(`/api/applications/${applicationId}`, {
        nextFollowUpAt,
      });

      toast.success(
        nextFollowUpAt
          ? `Follow-up reminder set for ${targetApp.company}`
          : `Cleared follow-up reminder for ${targetApp.company}`
      );
    } catch (err) {
      console.error('[Tracker] Failed to update follow-up date:', err);

      // Revert optimistic update
      setApplications((prev) =>
        prev.map((app) =>
          (app.id || app._id) === applicationId
            ? { ...app, nextFollowUpAt: previousNextFollowUp }
            : app
        )
      );

      toast.error(
        err.response?.data?.message || 'Failed to update follow-up reminder'
      );
    }
  };

  // Handle marking follow-up as completed from FollowUpBanner
  const handleMarkFollowedUp = async (applicationId) => {
    const targetApp = applications.find(
      (a) => (a.id || a._id) === applicationId
    );
    const company = targetApp?.company || 'Application';
    const nowIso = new Date().toISOString();

    // 1. Optimistic local update
    setDueFollowUps((prev) =>
      prev.filter((d) => (d.id || d._id) !== applicationId)
    );
    setApplications((prev) =>
      prev.map((app) =>
        (app.id || app._id) === applicationId
          ? {
              ...app,
              lastFollowUpAt: nowIso,
              nextFollowUpAt: null,
              isOverdue: false,
            }
          : app
      )
    );

    try {
      // 2. Persist completion via PATCH
      await api.patch(`/api/applications/${applicationId}`, {
        lastFollowUpAt: nowIso,
        nextFollowUpAt: null,
      });

      toast.success(`Marked follow-up completed for ${company}!`);
    } catch (err) {
      console.error('[Tracker] Failed to mark follow-up completed:', err);
      toast.error('Failed to mark follow-up as completed');
      loadData();
    }
  };

  // Handle snoozing follow-up reminder from FollowUpBanner
  const handleSnoozeFollowUp = async (applicationId, days) => {
    const targetApp = applications.find(
      (a) => (a.id || a._id) === applicationId
    );
    const company = targetApp?.company || 'Application';

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const isoDate = targetDate.toISOString();

    // 1. Optimistic local update
    setDueFollowUps((prev) =>
      prev.filter((d) => (d.id || d._id) !== applicationId)
    );
    setApplications((prev) =>
      prev.map((app) =>
        (app.id || app._id) === applicationId
          ? {
              ...app,
              nextFollowUpAt: isoDate,
              isOverdue: false,
            }
          : app
      )
    );

    try {
      // 2. Persist snooze date via PATCH
      await api.patch(`/api/applications/${applicationId}`, {
        nextFollowUpAt: isoDate,
      });

      toast.success(`Snoozed follow-up for ${company} by ${days} day${days > 1 ? 's' : ''}`);
    } catch (err) {
      console.error('[Tracker] Failed to snooze follow-up:', err);
      toast.error('Failed to snooze follow-up reminder');
      loadData();
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
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium capitalize">
                {viewMode === 'kanban' ? 'Kanban Board' : 'Table View'}
              </span>
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              {viewMode === 'kanban'
                ? 'Drag-and-drop job applications across stages to manage your hiring pipeline.'
                : 'Sortable table overview of your applications, interview stages, and follow-ups.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle: Kanban vs Table */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-inner">
              <button
                type="button"
                onClick={() => handleViewModeChange('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Kanban Board View"
                aria-pressed={viewMode === 'kanban'}
              >
                <span>📊</span>
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Table List View"
                aria-pressed={viewMode === 'table'}
              >
                <span>☰</span>
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            <Link
              to="/apply"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition shadow-sm shadow-blue-600/30"
            >
              <span>+ New Application</span>
            </Link>
          </div>
        </div>

        {/* Due Follow-Ups Banner */}
        <FollowUpBanner
          dueFollowUps={dueFollowUps}
          onMarkFollowedUp={handleMarkFollowedUp}
          onSnooze={handleSnoozeFollowUp}
        />

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

        {/* Applications View: Kanban Board or Sortable Table */}
        {viewMode === 'kanban' ? (
          <div className="bg-slate-950/40 rounded-2xl border border-slate-800/80 p-4">
            <KanbanBoard
              applications={filteredApplications}
              onStatusChange={handleStatusChange}
              onMarkFollowUp={handleMarkFollowUp}
              isLoading={isLoading}
            />
          </div>
        ) : (
          <ApplicationTable
            applications={filteredApplications}
            onStatusChange={handleStatusChange}
            isLoading={isLoading}
          />
        )}
      </main>
    </AppLayout>
  );
}
