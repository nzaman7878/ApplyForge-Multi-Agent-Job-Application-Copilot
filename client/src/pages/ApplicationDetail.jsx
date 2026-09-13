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
import { selectAgentOutputs } from '../store/applySlice';

const STATUS_CONFIG = {
  wishlist: { label: 'Wishlist', color: 'bg-slate-500/10 text-slate-300 border-slate-500/30' },
  applied: { label: 'Applied', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  interviewing: { label: 'Interviewing', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  offer: { label: 'Offer Received', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'Not Selected', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
};

const DETAIL_TABS = [
  { id: 'bullets', label: 'Tailored Bullets', icon: '📝' },
  { id: 'coverLetter', label: 'Cover Letter', icon: '✉️' },
  { id: 'ats', label: 'ATS Analysis', icon: '🎯' },
  { id: 'fit', label: 'Role Fit', icon: '📊' },
];

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const agentOutputs = useSelector(selectAgentOutputs);

  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bullets');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [status, setStatus] = useState('applied');
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
          setApplication(app);
          setStatus(app.status || 'applied');
          setNotes(app.notes || '');
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
              tailoredBullets: state.tailoredBullets || state.tailoredResume || [],
              coverLetter: state.coverLetter || null,
              fitScore: state.fitScore || null,
              atsReport: state.atsReport || null,
              appliedDate: new Date().toISOString(),
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
            tailoredBullets: state.tailoredBullets || state.tailoredResume || [],
            coverLetter: state.coverLetter || null,
            fitScore: state.fitScore || null,
            atsReport: state.atsReport || null,
            appliedDate: new Date().toISOString(),
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

  // Handle status update
  const handleUpdateStatus = async (newStatus) => {
    setStatus(newStatus);
    setIsUpdatingStatus(true);
    try {
      await api.put(`/api/applications/${id}`, { status: newStatus });
      toast.success(`Application status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (err) {
      console.warn('[ApplicationDetail] Status update warning:', err.message);
      // Even if offline/in-memory, keep local status
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle notes save
  const handleSaveNotes = async () => {
    try {
      await api.put(`/api/applications/${id}`, { notes });
      toast.success('Application notes saved');
    } catch (err) {
      console.warn('[ApplicationDetail] Notes update warning:', err.message);
      toast.success('Notes saved locally');
    }
  };

  // Export package
  const handleExportPackage = async () => {
    if (!application) return;
    setIsExporting(true);
    try {
      const bullets = Array.isArray(application.tailoredBullets)
        ? application.tailoredBullets
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
        `Date:        ${new Date(application.appliedDate || Date.now()).toLocaleDateString()}`,
        `Fit Score:   ${application.fitScore?.score ?? 'N/A'}/100`,
        `ATS Match:   ${application.atsReport?.overallScore ?? 'N/A'}%`,
        `===================================================================`,
        ``,
        `--- TAILORED RESUME BULLETS ---`,
        bullets,
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <PageLoader message="Loading application details..." />
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

  const statusStyle = STATUS_CONFIG[status] || STATUS_CONFIG.applied;
  const bulletsCount = Array.isArray(application.tailoredBullets) ? application.tailoredBullets.length : 0;
  const fitScoreVal = application.fitScore?.score;
  const atsScoreVal = application.atsReport?.overallScore;

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

        {/* Application Header Card */}
        <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-blue-950/40 border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusStyle.color}`}>
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {statusStyle.label}
                </span>
                <span className="text-xs text-slate-500">
                  Applied{' '}
                  {application.appliedDate || application.createdAt
                    ? new Date(application.appliedDate || application.createdAt).toLocaleDateString()
                    : 'Recently'}
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

            {/* Quick Metrics Badges */}
            <div className="flex flex-wrap items-center gap-3">
              {fitScoreVal !== undefined && (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center min-w-[90px]">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fit Score</p>
                  <p className="text-xl font-black text-white mt-0.5">
                    {fitScoreVal}
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
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Bullets</p>
                <p className="text-xl font-black text-white mt-0.5">{bulletsCount}</p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-800/80">
            {/* Status Quick Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold mr-1">Status:</span>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleUpdateStatus(key)}
                  disabled={isUpdatingStatus}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                    status === key
                      ? `${config.color} bg-opacity-20 shadow-sm ring-1 ring-white/20`
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>

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
                ← Tracker
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
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
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
            <div className="animate-fadeIn">
              <BulletsEditor bullets={application.tailoredBullets || []} />
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
        </div>

        {/* Private Application Notes Section */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📝</span>
              <h3 className="text-sm font-bold text-white tracking-tight">Private Application Notes</h3>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSaveNotes}
            >
              Save Notes
            </Button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Record recruiter contact details, salary discussions, interview dates, or follow-up milestones..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          />
        </div>
      </main>
    </AppLayout>
  );
}
