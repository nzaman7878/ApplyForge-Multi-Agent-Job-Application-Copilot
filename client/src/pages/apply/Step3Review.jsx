import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../lib/axios';
import { useToast } from '../../hooks/useToast';
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

  // Handle pipeline approval (resumes LangGraph to 'save' node and redirects to Application detail)
  const handleApproveApplication = async () => {
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
  };

  // Handle Request Edits submission (POST /api/pipeline/:runId/edit)
  const handleRequestEdits = async (e) => {
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
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Fit Score Badge */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center min-w-[90px]">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fit Score</p>
              <p className="text-xl font-black text-white mt-0.5">
                {fitScoreVal ?? '--'}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </p>
            </div>

            {/* ATS Score Badge */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center min-w-[90px]">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">ATS Match</p>
              <p className="text-xl font-black text-white mt-0.5">
                {atsScore !== undefined ? `${atsScore}%` : '--'}
              </p>
            </div>

            {/* Bullets Count */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center min-w-[90px]">
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
            >
              ← Back to Pipeline
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => dispatch(setCurrentStep(1))}
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
            >
              ✏️ Request Edits
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleApproveApplication}
              disabled={isApproving || isApproved || isSubmittingEdits}
              className={`font-bold shadow-xl transition ${
                isApproved
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              {isApproving ? 'Approving...' : isApproved ? '✓ Application Approved & Saved' : 'Approve & Save Application →'}
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar + All-in-One View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-slate-900/60 border border-slate-800 rounded-3xl backdrop-blur-sm">
        {/* The 4 Review Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {TABS.map((tab) => {
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
                type="button"
                onClick={() => {
                  setViewMode('tabs');
                  setActiveTab(tab.id);
                }}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span>{tab.icon}</span>
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
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('tabs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
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
        <div className="space-y-6">
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
        <div className="space-y-12 animate-fadeIn">
          {/* Panel 1: Resume Bullets */}
          <section id="section-bullets" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                1. Resume Bullets Optimization
              </h2>
            </div>
            <ErrorBoundary title="Resume Bullets Panel Error">
              <BulletsEditor bullets={tailoredBulletsData} />
            </ErrorBoundary>
          </section>

          {/* Panel 2: Cover Letter */}
          <section id="section-cover-letter" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
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
          <section id="section-ats" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                3. ATS Keyword Compliance Report
              </h2>
            </div>
            <ErrorBoundary title="ATS Report Panel Error">
              <ATSReport atsReport={atsReportData} />
            </ErrorBoundary>
          </section>

          {/* Panel 4: Fit Score */}
          <section id="section-fit" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
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
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
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
          >
            ← Back to Pipeline
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setShowEditModal(true)}
            disabled={isApproving || isApproved || isSubmittingEdits}
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
            className={`font-bold px-8 shadow-xl ${
              isApproved
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {isApproving ? 'Approving...' : isApproved ? '✓ Approved & Saved' : 'Approve & Save Application →'}
          </Button>
        </div>
      </div>

      {/* Request Edits Interactive Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 my-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 text-lg">🤖</span>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Request AI Agent Pipeline Edits
                  </h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Provide custom guidance or feedback. The pipeline will loop back to resume tailoring and cover letter agents to regenerate your package.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quick Suggestion Presets (Click to insert)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EDIT_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setEditNotes((prev) =>
                        prev ? `${prev}\n• ${preset}` : `• ${preset}`
                      );
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-850 transition cursor-pointer text-left"
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
                  <span>{editNotes.length} characters</span>
                </div>
                <textarea
                  id="editNotesTextarea"
                  rows={5}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Focus on distributed systems and microservices in the top 2 bullets. In the cover letter, emphasize my experience scaling systems to 10M DAU and make the closing paragraph more enthusiastic."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none"
                  autoFocus
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
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmittingEdits || !editNotes.trim()}
                  className="bg-blue-600 hover:bg-blue-500 font-bold px-6 shadow-lg shadow-blue-600/30"
                >
                  {isSubmittingEdits ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Regenerating Package...
                    </span>
                  ) : (
                    'Submit Edits & Re-run →'
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
