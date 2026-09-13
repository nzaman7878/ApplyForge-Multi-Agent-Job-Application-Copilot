import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../lib/axios';
import { useToast } from '../../hooks/useToast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Button, ErrorBoundary, ReviewSkeleton } from '../../components/ui';
import {
  BulletsEditor,
  CoverLetterEditor,
  ATSReport,
  FitScore,
} from '../../components/review';
import {
  setCurrentStep,
  setAgentOutputs,
  selectAgentOutputs,
  selectSelectedResume,
  selectSelectedJd,
} from '../../store/applySlice';

/**
 * Tab configuration conforming strictly to Phase 66:
 * Tabs: Resume Bullets | Cover Letter | ATS Report | Fit Score
 */
const TABS = [
  { id: 'bullets', label: 'Resume Bullets', icon: '📝' },
  { id: 'coverLetter', label: 'Cover Letter', icon: '✉️' },
  { id: 'ats', label: 'ATS Report', icon: '🎯' },
  { id: 'fit', label: 'Fit Score', icon: '📊' },
];

const EDIT_PRESETS = [
  'Emphasize leadership, architecture, and team mentorship',
  'Add more quantifiable impact metrics and business ROI',
  'Refine tone to be more confident, polished, and senior',
  'Target missing ATS keywords more aggressively',
  'Keep resume bullet points tight and under 25 words',
  'Highlight hands-on cloud and microservices experience',
];

/**
 * Step3Review Component
 *
 * Assembles the complete Human-in-the-Loop review checkpoint:
 * - 4 panels: Resume Bullets | Cover Letter | ATS Report | Fit Score
 * - Tabbed navigation with real-time status & score pills
 * - "All Panels" stacked view toggle
 * - One-click Application Approval (`POST /api/pipeline/:runId/approve`)
 * - Request Edits modal with notes (`POST /api/pipeline/:runId/edit`)
 * - On approve: redirect to Application detail page
 * - Export application package (.txt / clipboard)
 */
export default function Step3Review({ onApprove, onBack, className = '' }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const agentOutputs = useSelector(selectAgentOutputs);
  const selectedResume = useSelector(selectSelectedResume);
  const selectedJd = useSelector(selectSelectedJd);

  const [activeTab, setActiveTab] = useState('bullets'); // 'bullets' | 'coverLetter' | 'ats' | 'fit'
  const [viewMode, setViewMode] = useState('tabs'); // 'tabs' | 'all'
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Request Edits modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [isSubmittingEdits, setIsSubmittingEdits] = useState(false);

  // Extract intermediate outputs
  const runId = agentOutputs?.runId || agentOutputs?.state?.runId;
  const fitScoreData = agentOutputs?.fitScore || agentOutputs?.gapAnalysis || agentOutputs?.state?.fitScore;
  const atsReportData = agentOutputs?.atsReport || agentOutputs?.state?.atsReport;
  const tailoredBulletsData =
    agentOutputs?.tailoredResume || agentOutputs?.tailoredBullets || agentOutputs?.state?.tailoredBullets || [];
  const coverLetterData = agentOutputs?.coverLetter || agentOutputs?.state?.coverLetter;

  // Counts & metrics for badges
  const bulletsCount = Array.isArray(tailoredBulletsData) ? tailoredBulletsData.length : 0;
  const atsScore = atsReportData?.overallScore;
  const fitScoreVal = fitScoreData?.score;
  const hasCoverLetter = Boolean(coverLetterData?.body);

  // Focus trap for Request Edits modal
  const editModalRef = useFocusTrap(showEditModal, {
    onEscape: () => setShowEditModal(false),
  });

  // Handle pipeline approval (resumes LangGraph to 'save' node and redirects to Application detail)
  const handleApproveApplication = useCallback(async () => {
    if (!runId) {
      setIsApproved(true);
      toast.success('Application marked as approved and finalized!');
      if (typeof onApprove === 'function') onApprove();
      navigate('/tracker');
      return;
    }

    setIsApproving(true);
    try {
      const response = await api.post(`/api/pipeline/${runId}/approve`);
      const updatedState = response.data?.state;

      dispatch(
        setAgentOutputs({
          status: 'saved',
          state: updatedState,
          pipelineRunStatus: 'saved',
        })
      );

      setIsApproved(true);
      toast.success('Application package approved and saved to tracker!');
      if (typeof onApprove === 'function') {
        onApprove(response.data);
      }

      // Redirect to Application detail page
      const targetId = response.data?.applicationId || response.data?.application?._id || runId;
      if (targetId) {
        navigate(`/applications/${targetId}`);
      } else {
        navigate('/tracker');
      }
    } catch (err) {
      console.error('[Step3Review] Approval error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to approve application';
      toast.error(errMsg);
    } finally {
      setIsApproving(false);
    }
  }, [runId, onApprove, navigate, toast, dispatch]);

  // Handle Request Edits submission (POST /api/pipeline/:runId/edit)
  const handleRequestEdits = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!editNotes.trim()) {
      toast.error('Please enter notes or guidance for the AI agents');
      return;
    }

    if (!runId) {
      toast.error('No active pipeline run ID found to request edits');
      return;
    }

    setIsSubmittingEdits(true);
    try {
      const payload = {
        notes: editNotes.trim(),
        userEdits: {
          notes: editNotes.trim(),
          requestedAt: new Date().toISOString(),
        },
      };

      const response = await api.post(`/api/pipeline/${runId}/edit`, payload);
      const revisedState = response.data?.state;

      if (revisedState) {
        dispatch(
          setAgentOutputs({
            ...agentOutputs,
            status: 'awaiting_review',
            state: revisedState,
            tailoredResume: revisedState.tailoredBullets || revisedState.tailoredResume,
            tailoredBullets: revisedState.tailoredBullets,
            coverLetter: revisedState.coverLetter,
            atsReport: revisedState.atsReport,
            fitScore: revisedState.fitScore,
          })
        );
      }

      toast.success('AI agents re-ran pipeline with your edits! Review updated package.');
      setShowEditModal(false);
      setEditNotes('');
    } catch (err) {
      console.error('[Step3Review] Request edits error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to request edits';
      toast.error(errMsg);
    } finally {
      setIsSubmittingEdits(false);
    }
  }, [editNotes, runId, agentOutputs, toast, dispatch]);

  // Global Keyboard Shortcuts
  // Ctrl+Enter / Cmd+Enter: Approve application (or submit edit modal if open)
  // Escape: Close edit modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (showEditModal) {
          e.preventDefault();
          if (editNotes.trim() && !isSubmittingEdits) {
            handleRequestEdits();
          }
        } else if (!isApproved && !isApproving && !isSubmittingEdits) {
          e.preventDefault();
          handleApproveApplication();
        }
        return;
      }

      // Escape key to close edit modal
      if (e.key === 'Escape' && showEditModal) {
        e.preventDefault();
        setShowEditModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showEditModal, editNotes, isSubmittingEdits, isApproved, isApproving, handleRequestEdits, handleApproveApplication]);

  // Keyboard navigation for WAI-ARIA tablist (Arrow keys / Home / End)
  const handleTabKeyDown = (e, index) => {
    let nextIndex = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % TABS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== null) {
      setViewMode('tabs');
      setActiveTab(TABS[nextIndex].id);
      const nextBtn = document.getElementById(`tab-btn-${TABS[nextIndex].id}`);
      if (nextBtn) nextBtn.focus();
    }
  };

  // Export full customized application package
  const handleExportPackage = async () => {
    setIsExporting(true);
    try {
      const roleTitle = selectedJd?.roleTitle || 'Target Role';
      const company = selectedJd?.company || 'Target Company';
      const candidateName = selectedResume?.originalFilename || 'Candidate';

      const bulletsText = Array.isArray(tailoredBulletsData)
        ? tailoredBulletsData
            .map((b) => `• ${b.tailoredBullet || b.text || b}`)
            .join('\n\n')
        : 'None';

      const clText = coverLetterData?.body
        ? `SUBJECT: ${coverLetterData.subject || 'Application'}\n\n${coverLetterData.body}`
        : 'None';

      const packageContent = [
        `===================================================================`,
        `APPLYFORGE CUSTOM APPLICATION PACKAGE`,
        `===================================================================`,
        `Target Role: ${roleTitle}`,
        `Company:     ${company}`,
        `Candidate:   ${candidateName}`,
        `Date:        ${new Date().toLocaleDateString()}`,
        `Fit Score:   ${fitScoreVal ?? 'N/A'}/100`,
        `ATS Match:   ${atsScore ?? 'N/A'}%`,
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

      // Copy to clipboard
      await navigator.clipboard.writeText(packageContent);

      // Download file
      const blob = new Blob([packageContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${company}_${roleTitle.replace(/\s+/g, '_')}_Application_Package.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Complete package copied to clipboard & downloaded!');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export application package');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`space-y-8 animate-fadeIn ${className}`}>
      {/* Top Header Card: Review Checkpoint Overview */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-blue-950/40 border border-slate-800 shadow-2xl backdrop-blur-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Step 3 of 3 • Human Review Checkpoint
              </span>
              {isApproved && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                  ✓ Application Approved
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Application Review & Customization
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Target role: <span className="text-slate-200 font-semibold">{selectedJd?.roleTitle || 'Target Role'}</span> at{' '}
              <span className="text-slate-200 font-semibold">{selectedJd?.company || 'Target Company'}</span> • Source resume:{' '}
              <span className="text-slate-200 font-semibold">{selectedResume?.originalFilename || selectedResume?.name || 'Resume'}</span>
            </p>
          </div>

          {/* Quick Metrics Header Cards */}
          <div className="flex flex-wrap items-center gap-3 shrink-0" role="region" aria-label="Application review summary metrics">
            {/* Fit Score Badge */}
            <div
              className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center min-w-[90px]"
              aria-label={`Role Fit Score: ${fitScoreVal ?? 'not calculated'} out of 100`}
            >
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fit Score</p>
              <p className="text-xl font-black text-white mt-0.5">
                {fitScoreVal ?? '--'}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </p>
            </div>

            {/* ATS Score Badge */}
            <div
              className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center min-w-[90px]"
              aria-label={`ATS Keyword Match: ${atsScore !== undefined ? `${atsScore}%` : 'not calculated'}`}
            >
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">ATS Match</p>
              <p className="text-xl font-black text-white mt-0.5">
                {atsScore !== undefined ? `${atsScore}%` : '--'}
              </p>
            </div>

            {/* Bullets Count */}
            <div
              className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center min-w-[90px]"
              aria-label={`Tailored resume bullets count: ${bulletsCount}`}
            >
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Bullets</p>
              <p className="text-xl font-black text-white mt-0.5">{bulletsCount}</p>
            </div>
          </div>
        </div>

        {/* Global Action Controls Bar */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => (typeof onBack === 'function' ? onBack() : dispatch(setCurrentStep(2)))}
              aria-label="Return to Step 2 pipeline execution"
            >
              ← Back to Pipeline
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => dispatch(setCurrentStep(1))}
              aria-label="Restart wizard from Step 1"
            >
              Restart at Step 1
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportPackage}
              disabled={isExporting}
              aria-label="Export complete application package as text file and copy to clipboard"
            >
              {isExporting ? 'Exporting...' : '📦 Export Full Package'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowEditModal(true)}
              disabled={isApproving || isApproved || isSubmittingEdits}
              className="border-slate-700 hover:border-slate-600 text-slate-200"
              aria-label="Open dialog to request AI agent edits"
            >
              ✏️ Request Edits
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleApproveApplication}
              disabled={isApproving || isApproved || isSubmittingEdits}
              aria-label="Approve and save application package to tracker. Shortcut: Control plus Enter"
              className={`font-bold shadow-xl transition flex items-center ${
                isApproved
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              <span>{isApproving ? 'Approving...' : isApproved ? '✓ Application Approved & Saved' : 'Approve & Save Application →'}</span>
              {!isApproved && (
                <kbd className="hidden sm:inline-flex items-center ml-2 px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider bg-emerald-700/80 rounded border border-emerald-400/40 text-emerald-100">
                  Ctrl+↵
                </kbd>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar + All-in-One View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-slate-900/60 border border-slate-800 rounded-3xl backdrop-blur-sm">
        {/* The 4 Review Tabs */}
        <div
          role="tablist"
          aria-label="Application review panels"
          className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto"
        >
          {TABS.map((tab, idx) => {
            const isActive = viewMode === 'tabs' && activeTab === tab.id;

            // Get badge for each tab
            let badge = null;
            if (tab.id === 'bullets') {
              badge = `${bulletsCount} Bullets`;
            } else if (tab.id === 'coverLetter') {
              badge = hasCoverLetter ? 'Ready' : null;
            } else if (tab.id === 'ats') {
              badge = atsScore !== undefined ? `${atsScore}%` : null;
            } else if (tab.id === 'fit') {
              badge = fitScoreVal !== undefined ? `${fitScoreVal}/100` : null;
            }

            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                aria-label={`${tab.label}${badge ? `, ${badge}` : ''}`}
                onClick={() => {
                  setViewMode('tabs');
                  setActiveTab(tab.id);
                }}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
                {badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border ${
                      isActive
                        ? 'bg-blue-950/60 border-blue-400/40 text-blue-200'
                        : 'bg-slate-950 border-slate-700 text-slate-300'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle: Single Tab vs All 4 Panels in One Page */}
        <div
          role="group"
          aria-label="Display layout mode"
          className="flex items-center gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 self-end sm:self-auto"
        >
          <button
            type="button"
            onClick={() => setViewMode('tabs')}
            aria-pressed={viewMode === 'tabs'}
            aria-label="Show single tabbed view"
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              viewMode === 'tabs'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tabbed View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            aria-pressed={viewMode === 'all'}
            aria-label="Show all four review panels on one page"
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              viewMode === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All 4 Panels
          </button>
        </div>
      </div>

      {/* Main Panels Area: Shows Skeleton while submitting edits or rendering tabs with ErrorBoundaries */}
      {isSubmittingEdits ? (
        <ReviewSkeleton
          activeTab={activeTab}
          title="Regenerating Application Package with Your Edits..."
          subtitle="The AI agents are re-evaluating the candidate artifacts with your custom directives."
          showTabs={false}
        />
      ) : viewMode === 'tabs' ? (
        /* Tabbed Display Mode */
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-btn-${activeTab}`}
          tabIndex={0}
          className="space-y-6 focus:outline-none"
        >
          {activeTab === 'bullets' && (
            <ErrorBoundary
              title="Resume Bullets Editor Issue"
              description="An issue occurred while rendering tailored resume bullets. Your data is preserved."
            >
              <div className="animate-fadeIn">
                <BulletsEditor bullets={tailoredBulletsData} />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'coverLetter' && (
            <ErrorBoundary
              title="Cover Letter Editor Issue"
              description="An issue occurred while rendering your cover letter. Your data is preserved."
            >
              <div className="animate-fadeIn">
                <CoverLetterEditor
                  coverLetter={coverLetterData}
                  runId={runId}
                />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'ats' && (
            <ErrorBoundary
              title="ATS Keyword Report Issue"
              description="An issue occurred while rendering the ATS compliance audit."
            >
              <div className="animate-fadeIn">
                <ATSReport atsReport={atsReportData} />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'fit' && (
            <ErrorBoundary
              title="Fit Score Dial Issue"
              description="An issue occurred while rendering the role fit & gap analysis."
            >
              <div className="animate-fadeIn">
                <FitScore fitScore={fitScoreData} />
              </div>
            </ErrorBoundary>
          )}
        </div>
      ) : (
        /* All 4 Panels in One Page Mode */
        <div className="space-y-12 animate-fadeIn" role="region" aria-label="All application review panels">
          {/* Panel 1: Resume Bullets */}
          <section id="section-bullets" className="space-y-3" aria-labelledby="heading-bullets">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" aria-hidden="true" />
              <h2 id="heading-bullets" className="text-base font-bold text-white tracking-tight">
                1. Resume Bullets Optimization
              </h2>
            </div>
            <ErrorBoundary title="Resume Bullets Panel Error">
              <BulletsEditor bullets={tailoredBulletsData} />
            </ErrorBoundary>
          </section>

          {/* Panel 2: Cover Letter */}
          <section id="section-cover-letter" className="space-y-3" aria-labelledby="heading-cover-letter">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" aria-hidden="true" />
              <h2 id="heading-cover-letter" className="text-base font-bold text-white tracking-tight">
                2. Targeted Cover Letter
              </h2>
            </div>
            <ErrorBoundary title="Cover Letter Panel Error">
              <CoverLetterEditor
                coverLetter={coverLetterData}
                runId={runId}
              />
            </ErrorBoundary>
          </section>

          {/* Panel 3: ATS Report */}
          <section id="section-ats" className="space-y-3" aria-labelledby="heading-ats">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
              <h2 id="heading-ats" className="text-base font-bold text-white tracking-tight">
                3. ATS Keyword Compliance Report
              </h2>
            </div>
            <ErrorBoundary title="ATS Report Panel Error">
              <ATSReport atsReport={atsReportData} />
            </ErrorBoundary>
          </section>

          {/* Panel 4: Fit Score */}
          <section id="section-fit" className="space-y-3" aria-labelledby="heading-fit">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" aria-hidden="true" />
              <h2 id="heading-fit" className="text-base font-bold text-white tracking-tight">
                4. Role Fit & Qualitative Gap Analysis
              </h2>
            </div>
            <ErrorBoundary title="Fit Score Panel Error">
              <FitScore fitScore={fitScoreData} />
            </ErrorBoundary>
          </section>
        </div>
      )}

      {/* Bottom Sticky Action Footer */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
          <span>
            {isApproved
              ? 'Application checkpoint approved & finalized in MongoDB.'
              : 'Human review required before finalizing application.'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => (typeof onBack === 'function' ? onBack() : dispatch(setCurrentStep(2)))}
            aria-label="Return to pipeline step 2"
          >
            ← Back to Pipeline
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setShowEditModal(true)}
            disabled={isApproving || isApproved || isSubmittingEdits}
            aria-label="Request AI Agent pipeline edits"
            className="border-slate-700 hover:border-slate-600 text-slate-200 font-semibold"
          >
            ✏️ Request Edits
          </Button>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleApproveApplication}
            disabled={isApproving || isApproved || isSubmittingEdits}
            aria-label="Approve and save application package to tracker. Shortcut: Control plus Enter"
            className={`font-bold px-8 shadow-xl flex items-center ${
              isApproved
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            <span>{isApproving ? 'Approving...' : isApproved ? '✓ Approved & Saved' : 'Approve & Save Application →'}</span>
            {!isApproved && (
              <kbd className="hidden sm:inline-flex items-center ml-2 px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider bg-emerald-700/80 rounded border border-emerald-400/40 text-emerald-100">
                Ctrl+↵
              </kbd>
            )}
          </Button>
        </div>
      </div>

      {/* Request Edits Interactive Modal with Focus Trap and ARIA dialog roles */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div
            ref={editModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-edits-title"
            aria-describedby="request-edits-description"
            className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 my-auto focus:outline-none"
            tabIndex={-1}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 text-lg" aria-hidden="true">🤖</span>
                  <h2 id="request-edits-title" className="text-xl font-bold text-white tracking-tight">
                    Request AI Agent Pipeline Edits
                  </h2>
                </div>
                <p id="request-edits-description" className="text-xs text-slate-400 leading-relaxed">
                  Provide custom guidance or feedback. The pipeline will loop back to resume tailoring and cover letter agents to regenerate your package.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                aria-label="Close dialog (Escape)"
                title="Close dialog (Escape)"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-xs"
              >
                <span>✕</span>
                <kbd className="hidden sm:inline-block px-1 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-950 rounded border border-slate-800">Esc</kbd>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <label id="presets-label" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quick Suggestion Presets (Click to insert)
              </label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="presets-label">
                {EDIT_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Insert preset: ${preset}`}
                    onClick={() => {
                      setEditNotes((prev) =>
                        prev ? `${prev}\n• ${preset}` : `• ${preset}`
                      );
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-850 transition cursor-pointer text-left focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Edit Notes Input Form */}
            <form onSubmit={handleRequestEdits} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <label htmlFor="editNotesTextarea" className="font-semibold text-slate-300">
                    Revision Notes & Instructions
                  </label>
                  <span aria-live="polite">{editNotes.length} characters</span>
                </div>
                <textarea
                  id="editNotesTextarea"
                  rows={5}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Focus on distributed systems and microservices in the top 2 bullets. In the cover letter, emphasize my experience scaling systems to 10M DAU and make the closing paragraph more enthusiastic."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none"
                  autoFocus
                  aria-required="true"
                />
              </div>

              {/* Modal Action Controls */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmittingEdits}
                  aria-label="Cancel and close modal (Escape)"
                  className="flex items-center"
                >
                  <span>Cancel</span>
                  <kbd className="hidden sm:inline-block ml-1.5 px-1 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 rounded border border-slate-700">Esc</kbd>
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmittingEdits || !editNotes.trim()}
                  aria-label="Submit edits and re-run pipeline (Control plus Enter)"
                  className="bg-blue-600 hover:bg-blue-500 font-bold px-6 shadow-lg shadow-blue-600/30 flex items-center"
                >
                  {isSubmittingEdits ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      Regenerating Package...
                    </span>
                  ) : (
                    <>
                      <span>Submit Edits & Re-run →</span>
                      <kbd className="hidden sm:inline-flex items-center ml-1.5 px-1.5 py-0.5 text-[10px] font-mono bg-blue-700/90 rounded border border-blue-400/40 text-white">
                        Ctrl+↵
                      </kbd>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
