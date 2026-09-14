import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../lib/axios';
import { useToast } from '../hooks/useToast';
import AppLayout from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';
import PageLoader from '../components/ui/PageLoader';
import {
  BulletsEditor,
  CoverLetterEditor,
  ATSReport,
  FitScore,
} from '../components/review';
import {
  StatusTimeline,
  KANBAN_COLUMNS,
  getStatusInfo,
  getFitScoreStyle,
  getDaysSinceApplied,
} from '../components/tracker';
import { selectAgentOutputs } from '../store/applySlice';

const DETAIL_TABS = [
  { id: 'bullets', label: 'Tailored Bullets', icon: '📝' },
  { id: 'coverLetter', label: 'Cover Letter', icon: '✉️' },
  { id: 'ats', label: 'ATS Analysis', icon: '🎯' },
  { id: 'fit', label: 'Role Fit', icon: '📊' },
  { id: 'timeline', label: 'Status & Timeline', icon: '⏳' },
];

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const agentOutputs = useSelector(selectAgentOutputs);

  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bullets');

  // Inline Status & Follow-Up State
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingFollowUp, setIsUpdatingFollowUp] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [status, setStatus] = useState('applied');
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch application details on mount
  useEffect(() => {
    let isMounted = true;

    async function loadApplication() {
      setIsLoading(true);
      try {
        // 1. Try fetching from /api/applications/:id
        const res = await api.get(`/api/applications/${id}`);
        if (isMounted && res.data?.application) {
          const app = res.data.application;
          const isOverdue = Boolean(
            app.nextFollowUpAt && new Date(app.nextFollowUpAt).getTime() <= Date.now()
          );
          setApplication({ ...app, isOverdue });
          setStatus(app.status || 'applied');
          setNotes(app.notes || '');

          if (app.nextFollowUpAt) {
            const d = new Date(app.nextFollowUpAt);
            if (!isNaN(d.getTime())) {
              setFollowUpDate(d.toISOString().split('T')[0]);
            }
          }
          setIsLoading(false);
          return;
        }
      } catch {
        // 2. Fallback: try fetching from /api/pipeline/:id
        try {
          const pipelineRes = await api.get(`/api/pipeline/${id}`);
          if (isMounted && pipelineRes.data) {
            const state = pipelineRes.data.state || {};
            const synthesizedApp = {
              _id: pipelineRes.data.runId,
              runId: pipelineRes.data.runId,
              company: state.structuredJD?.company || 'Target Company',
              roleTitle: state.structuredJD?.roleTitle || 'Target Role',
              status: 'applied',
              statusHistory: [{ status: 'applied', changedAt: new Date().toISOString() }],
              tailoredBullets: state.tailoredBullets || state.tailoredResume || [],
              coverLetter: state.coverLetter || null,
              fitScore: state.fitScore || null,
              atsReport: state.atsReport || null,
              appliedAt: new Date().toISOString(),
              appliedDate: new Date().toISOString(),
              nextFollowUpAt: null,
              notes: '',
            };
            setApplication(synthesizedApp);
            setStatus('applied');
            setIsLoading(false);
            return;
          }
        } catch (pipelineErr) {
          console.warn('[ApplicationDetail] Pipeline fallback fetch failed:', pipelineErr);
        }

        // 3. Fallback: check Redux agentOutputs
        if (agentOutputs && (agentOutputs.runId === id || agentOutputs.state?.runId === id)) {
          const state = agentOutputs.state || agentOutputs;
          const fallbackApp = {
            _id: id,
            runId: id,
            company: state.structuredJD?.company || 'Target Company',
            roleTitle: state.structuredJD?.roleTitle || 'Target Role',
            status: 'applied',
            statusHistory: [{ status: 'applied', changedAt: new Date().toISOString() }],
            tailoredBullets: state.tailoredBullets || state.tailoredResume || [],
            coverLetter: state.coverLetter || null,
            fitScore: state.fitScore || null,
            atsReport: state.atsReport || null,
            appliedAt: new Date().toISOString(),
            appliedDate: new Date().toISOString(),
            nextFollowUpAt: null,
            notes: '',
          };
          if (isMounted) {
            setApplication(fallbackApp);
            setStatus('applied');
            setIsLoading(false);
            return;
          }
        }

        if (isMounted) {
          toast.error('Application not found');
          setIsLoading(false);
        }
      }
    }

    loadApplication();

    return () => {
      isMounted = false;
    };
  }, [id, agentOutputs, toast]);

  // Handle inline status update
  const handleUpdateStatus = async (newStatus) => {
    if (newStatus === status) return;

    const prevStatus = status;
    const prevHistory = application?.statusHistory || [];
    const newEntry = { status: newStatus, changedAt: new Date().toISOString() };

    // Optimistic UI update
    setStatus(newStatus);
    setApplication((prev) => ({
      ...prev,
      status: newStatus,
      statusHistory: [...(prev?.statusHistory || []), newEntry],
    }));
    setIsUpdatingStatus(true);

    try {
      const res = await api.patch(`/api/applications/${id}`, { status: newStatus });
      const updated = res.data?.application;
      if (updated) {
        setApplication(updated);
        setStatus(updated.status);
      }
      const targetCol = KANBAN_COLUMNS.find((c) => c.statusKey === newStatus || c.id === newStatus);
      toast.success(`Application status updated to ${targetCol?.title || newStatus}`);
    } catch (err) {
      console.warn('[ApplicationDetail] Status update failed:', err);
      // Revert optimistic update
      setStatus(prevStatus);
      setApplication((prev) => ({
        ...prev,
        status: prevStatus,
        statusHistory: prevHistory,
      }));
      toast.error(err.response?.data?.message || 'Failed to update application status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle follow-up date update via date picker
  const handleSaveFollowUpDate = async (newDateVal) => {
    setIsUpdatingFollowUp(true);
    const prevDate = application?.nextFollowUpAt;
    const isoDate = newDateVal ? new Date(newDateVal).toISOString() : null;

    // Optimistic UI update
    setFollowUpDate(newDateVal || '');
    const isOverdue = Boolean(isoDate && new Date(isoDate).getTime() <= Date.now());
    setApplication((prev) => ({
      ...prev,
      nextFollowUpAt: isoDate,
      isOverdue,
    }));

    try {
      const res = await api.patch(`/api/applications/${id}`, {
        nextFollowUpAt: isoDate,
      });
      if (res.data?.application) {
        setApplication({
          ...res.data.application,
          isOverdue,
        });
      }
      toast.success(
        isoDate
          ? `Follow-up date scheduled for ${new Date(newDateVal).toLocaleDateString()}`
          : 'Follow-up reminder cleared'
      );
    } catch (err) {
      console.error('[ApplicationDetail] Follow-up update failed:', err);
      // Revert
      setApplication((prev) => ({
        ...prev,
        nextFollowUpAt: prevDate,
      }));
      if (prevDate) {
        setFollowUpDate(new Date(prevDate).toISOString().split('T')[0]);
      } else {
        setFollowUpDate('');
      }
      toast.error(err.response?.data?.message || 'Failed to update follow-up date');
    } finally {
      setIsUpdatingFollowUp(false);
    }
  };

  // Handle quick preset follow-up buttons (+3d, +7d, +14d)
  const handlePresetFollowUp = (days) => {
    if (days === null) {
      handleSaveFollowUpDate('');
      return;
    }
    const target = new Date();
    target.setDate(target.getDate() + days);
    const yyyyMmDd = target.toISOString().split('T')[0];
    handleSaveFollowUpDate(yyyyMmDd);
  };

  // Handle mark follow-up done
  const handleMarkFollowUpCompleted = async () => {
    setIsUpdatingFollowUp(true);
    try {
      const now = new Date().toISOString();
      const res = await api.patch(`/api/applications/${id}`, {
        lastFollowUpAt: now,
        nextFollowUpAt: null,
      });
      if (res.data?.application) {
        setApplication(res.data.application);
      }
      setFollowUpDate('');
      toast.success('Follow-up logged as completed!');
    } catch (err) {
      console.error('[ApplicationDetail] Mark follow-up completed failed:', err);
      toast.error('Failed to log follow-up completion');
    } finally {
      setIsUpdatingFollowUp(false);
    }
  };

  // Handle notes save
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await api.patch(`/api/applications/${id}`, { notes });
      toast.success('Application notes saved');
    } catch (err) {
      console.warn('[ApplicationDetail] Notes update failed:', err);
      toast.error('Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Export full package
  const handleExportPackage = async () => {
    if (!application) return;
    setIsExporting(true);
    try {
      const bulletsList = Array.isArray(application.tailoredBullets) && application.tailoredBullets.length > 0
        ? application.tailoredBullets
        : Array.isArray(application.tailoredResume)
        ? application.tailoredResume
        : [];

      const bulletsText = bulletsList.length > 0
        ? bulletsList
            .map((b) => `• ${b.tailoredBullet || b.text || b}`)
            .join('\n\n')
        : 'None';

      const clText = application.coverLetter?.body
        ? `SUBJECT: ${application.coverLetter.subject || 'Application'}\n\n${application.coverLetter.body}`
        : 'None';

      const content = [
        `===================================================================`,
        `APPLYFORGE SAVED APPLICATION PACKAGE`,
        `===================================================================`,
        `Company:     ${application.company || 'Target Company'}`,
        `Role:        ${application.roleTitle || 'Target Role'}`,
        `Status:      ${status.toUpperCase()}`,
        `Date:        ${new Date(application.appliedAt || application.appliedDate || Date.now()).toLocaleDateString()}`,
        `Fit Score:   ${application.fitScore?.score ?? 'N/A'}/100`,
        `ATS Match:   ${application.atsReport?.overallScore ?? 'N/A'}%`,
        `===================================================================`,
        ``,
        `--- TAILORED RESUME BULLETS ---`,
        bulletsText,
        ``,
        `===================================================================`,
        `--- PERSONALIZED COVER LETTER ---`,
        clText,
        `===================================================================`,
      ].join('\n');

      await navigator.clipboard.writeText(content);

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(application.company || 'Company').replace(/\s+/g, '_')}_Application_Package.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Package copied to clipboard & downloaded!');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export package');
    } finally {
      setIsExporting(false);
    }
  };

  // Follow-up urgency evaluation
  const isFollowUpDue = Boolean(application?.isOverdue);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <PageLoader message="Loading application history & tailoring details..." />
        </div>
      </AppLayout>
    );
  }

  if (!application) {
    return (
      <AppLayout>
        <main className="max-w-4xl mx-auto w-full p-6 sm:p-12 text-center">
          <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <span className="text-4xl">🔍</span>
            <h1 className="text-xl font-bold text-white">Application Not Found</h1>
            <p className="text-xs text-slate-400">
              The application you are looking for may have been removed or does not exist.
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => navigate('/tracker')}>
                Back to Tracker
              </Button>
              <Button variant="primary" onClick={() => navigate('/apply')}>
                Start New Application
              </Button>
            </div>
          </div>
        </main>
      </AppLayout>
    );
  }

  const statusInfo = getStatusInfo(status);
  const rawScore =
    application.fitScore?.score !== undefined
      ? application.fitScore.score
      : typeof application.fitScore === 'number'
      ? application.fitScore
      : null;
  const scoreInfo = getFitScoreStyle(rawScore);
  const atsScoreVal = application.atsReport?.overallScore;
  const bulletsList =
    Array.isArray(application.tailoredBullets) && application.tailoredBullets.length > 0
      ? application.tailoredBullets
      : Array.isArray(application.tailoredResume)
      ? application.tailoredResume
      : [];
  const daysSinceApplied = getDaysSinceApplied(application.appliedAt || application.appliedDate);

  return (
    <AppLayout>
      <main className="max-w-6xl mx-auto w-full p-4 sm:p-8 space-y-8 animate-fadeIn">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link to="/dashboard" className="hover:text-white transition">
            Dashboard
          </Link>
          <span>/</span>
          <Link to="/tracker" className="hover:text-white transition">
            Tracker
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-semibold truncate max-w-[200px] sm:max-w-none">
            {application.roleTitle} at {application.company}
          </span>
        </div>

        {/* Overdue Follow-up Banner */}
        {isFollowUpDue && (
          <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <p>
                <strong className="font-semibold text-white">Action Due:</strong> A follow-up reminder is due today for{' '}
                <span className="text-amber-300 font-semibold">{application.company}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkFollowUpCompleted}
              disabled={isUpdatingFollowUp}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition text-xs shrink-0"
            >
              ✓ Mark Follow-Up Completed
            </button>
          </div>
        )}

        {/* Application Header Card */}
        <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-blue-950/40 border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Status Indicator Pill */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.badgeBg}`}
                >
                  <span>{statusInfo.icon}</span>
                  <span>{statusInfo.title}</span>
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ⏱️ {daysSinceApplied}
                </span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {application.roleTitle}
                </h1>
                <p className="text-base text-blue-400 font-bold mt-0.5">
                  {application.company}
                </p>
              </div>
            </div>

            {/* Metrics Chips */}
            <div className="flex flex-wrap items-center gap-3">
              {rawScore !== null && (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center min-w-[90px]">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fit Score</p>
                  <p className="text-xl font-black text-white mt-0.5">
                    {scoreInfo.score}
                    <span className="text-xs font-normal text-slate-400">/100</span>
                  </p>
                </div>
              )}

              {atsScoreVal !== undefined && (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center min-w-[90px]">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">ATS Match</p>
                  <p className="text-xl font-black text-white mt-0.5">{atsScoreVal}%</p>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center min-w-[90px]">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tailored Bullets</p>
                <p className="text-xl font-black text-white mt-0.5">{bulletsList.length}</p>
              </div>
            </div>
          </div>

          {/* Inline Status & Quick Actions Bar */}
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-800/80">
            {/* Inline Status Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold mr-1">Edit Status:</span>
              {KANBAN_COLUMNS.map((col) => {
                const isSelected = status === col.statusKey || status === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleUpdateStatus(col.statusKey)}
                    disabled={isUpdatingStatus}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? `${col.badgeBg} shadow-md ring-2 ring-blue-500/30 scale-102`
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{col.icon}</span>
                    <span>{col.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleExportPackage}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : '📦 Export Package'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => navigate('/tracker')}
              >
                ← Back to Tracker
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
          {DETAIL_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        <div className="space-y-6">
          {activeTab === 'bullets' && (
            <div className="animate-fadeIn space-y-4">
              <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-200 flex items-center justify-between">
                <span>
                  ✨ These resume bullets were custom-tailored by the Tailoring Node to align with target role requirements.
                </span>
                <span className="font-mono font-semibold">{bulletsList.length} items</span>
              </div>
              <BulletsEditor bullets={bulletsList} />
            </div>
          )}

          {activeTab === 'coverLetter' && (
            <div className="animate-fadeIn">
              <CoverLetterEditor
                coverLetter={application.coverLetter}
                runId={application.runId || id}
              />
            </div>
          )}

          {activeTab === 'ats' && (
            <div className="animate-fadeIn">
              <ATSReport atsReport={application.atsReport} />
            </div>
          )}

          {activeTab === 'fit' && (
            <div className="animate-fadeIn">
              <FitScore fitScore={application.fitScore} />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="animate-fadeIn space-y-6">
              <StatusTimeline
                statusHistory={application.statusHistory}
                currentStatus={status}
                onStatusChange={handleUpdateStatus}
              />
            </div>
          )}
        </div>

        {/* CRM Follow-Up Scheduler & Status Timeline Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Follow-Up Date Picker Card */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📅</span>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Follow-Up Reminder
                  </h3>
                  <p className="text-xs text-slate-400">
                    Schedule recruitment follow-up alerts & check-ins
                  </p>
                </div>
              </div>
              {application.nextFollowUpAt && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-mono border ${
                    isFollowUpDue
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}
                >
                  {isFollowUpDue ? '⚠️ Overdue' : 'Scheduled'}
                </span>
              )}
            </div>

            {/* Date Input & Controls */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-slate-300">
                Next Follow-Up Date
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleSaveFollowUpDate(followUpDate)}
                  disabled={isUpdatingFollowUp}
                >
                  {isUpdatingFollowUp ? 'Saving...' : 'Save Date'}
                </Button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                <span className="text-slate-400 font-medium">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handlePresetFollowUp(3)}
                  disabled={isUpdatingFollowUp}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-medium text-xs"
                >
                  +3 Days
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetFollowUp(7)}
                  disabled={isUpdatingFollowUp}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-medium text-xs"
                >
                  +1 Week
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetFollowUp(14)}
                  disabled={isUpdatingFollowUp}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-medium text-xs"
                >
                  +2 Weeks
                </button>
                {followUpDate && (
                  <button
                    type="button"
                    onClick={() => handlePresetFollowUp(null)}
                    disabled={isUpdatingFollowUp}
                    className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 transition font-medium text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Mark Completed Button */}
              {application.nextFollowUpAt && (
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Follow-up sent or resolved?</span>
                  <button
                    type="button"
                    onClick={handleMarkFollowUpCompleted}
                    disabled={isUpdatingFollowUp}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition font-bold"
                  >
                    ✓ Mark as Completed
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Private Candidate Notes Card */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📝</span>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Private Application Notes</h3>
                  <p className="text-xs text-slate-400">
                    Recruiter contacts, interview questions, & salary milestones
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
              >
                {isSavingNotes ? 'Saving...' : 'Save Notes'}
              </Button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Record recruiter emails, interview notes, technical questions asked, or target salary expectations..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>
        </div>

        {/* Prominent Status Timeline Display when not on timeline tab */}
        {activeTab !== 'timeline' && (
          <StatusTimeline
            statusHistory={application.statusHistory}
            currentStatus={status}
            onStatusChange={handleUpdateStatus}
          />
        )}
      </main>
    </AppLayout>
  );
}
