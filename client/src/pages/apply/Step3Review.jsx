import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../lib/axios';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
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

/**
 * Step3Review Component
 *
 * Assembles the complete Human-in-the-Loop review checkpoint:
 * - 4 panels: Resume Bullets | Cover Letter | ATS Report | Fit Score
 * - Tabbed navigation with real-time status & score pills
 * - "All Panels" stacked view toggle
 * - One-click Application Approval (`POST /api/pipeline/:runId/approve`)
 * - Export application package (.txt / clipboard)
 */
export default function Step3Review({ onApprove, onBack, className = '' }) {
  const dispatch = useDispatch();
  const toast = useToast();

  const agentOutputs = useSelector(selectAgentOutputs);
  const selectedResume = useSelector(selectSelectedResume);
  const selectedJd = useSelector(selectSelectedJd);

  const [activeTab, setActiveTab] = useState('bullets'); // 'bullets' | 'coverLetter' | 'ats' | 'fit'
  const [viewMode, setViewMode] = useState('tabs'); // 'tabs' | 'all'
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  // Handle pipeline approval (resumes LangGraph to 'save' node)
  const handleApproveApplication = async () => {
    if (!runId) {
      setIsApproved(true);
      toast.success('Application marked as approved and finalized!');
      if (typeof onApprove === 'function') onApprove();
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
    } catch (err) {
      console.error('[Step3Review] Approval error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to approve application';
      toast.error(errMsg);
    } finally {
      setIsApproving(false);
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
              variant="primary"
              size="md"
              onClick={handleApproveApplication}
              disabled={isApproving || isApproved}
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

      {/* Main Panels Area */}
      {viewMode === 'tabs' ? (
        /* Tabbed Display Mode */
        <div className="space-y-6">
          {activeTab === 'bullets' && (
            <div className="animate-fadeIn">
              <BulletsEditor bullets={tailoredBulletsData} />
            </div>
          )}

          {activeTab === 'coverLetter' && (
            <div className="animate-fadeIn">
              <CoverLetterEditor
                coverLetter={coverLetterData}
                runId={runId}
              />
            </div>
          )}

          {activeTab === 'ats' && (
            <div className="animate-fadeIn">
              <ATSReport atsReport={atsReportData} />
            </div>
          )}

          {activeTab === 'fit' && (
            <div className="animate-fadeIn">
              <FitScore fitScore={fitScoreData} />
            </div>
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
            <BulletsEditor bullets={tailoredBulletsData} />
          </section>

          {/* Panel 2: Cover Letter */}
          <section id="section-cover-letter" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                2. Targeted Cover Letter
              </h2>
            </div>
            <CoverLetterEditor
              coverLetter={coverLetterData}
              runId={runId}
            />
          </section>

          {/* Panel 3: ATS Report */}
          <section id="section-ats" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                3. ATS Keyword Compliance Report
              </h2>
            </div>
            <ATSReport atsReport={atsReportData} />
          </section>

          {/* Panel 4: Fit Score */}
          <section id="section-fit" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                4. Role Fit & Qualitative Gap Analysis
              </h2>
            </div>
            <FitScore fitScore={fitScoreData} />
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

        <div className="flex items-center gap-3">
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
            variant="primary"
            size="lg"
            onClick={handleApproveApplication}
            disabled={isApproving || isApproved}
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
    </div>
  );
}
