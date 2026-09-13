import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch, useSelector } from 'react-redux';
import api from '../lib/axios';
import { useToast } from '../hooks/useToast';
import AppLayout from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';
import { StepIndicator } from '../components/ui';
import ResumeUploader from '../components/resume/ResumeUploader';
import ResumePreview from '../components/resume/ResumePreview';
import { JDPasteForm, JDRequirementsPanel } from '../components/jd';
import Step2Running from './apply/Step2Running';
import { ATSReport, FitScore, BulletsEditor } from '../components/review';
import { applyStep1Schema } from '../schemas/apply.schemas';
import {
  setCurrentStep,
  setSelectedResume,
  setSelectedJd,
  selectCurrentStep,
  selectSelectedResume,
  selectSelectedJd,
  selectAgentOutputs,
} from '../store/applySlice';

const WIZARD_STEPS = [
  {
    id: 1,
    label: 'Source Inputs',
    description: 'Resume & Job Description',
  },
  {
    id: 2,
    label: 'Agent Pipeline',
    description: 'Gap Analysis & Tailoring',
  },
  {
    id: 3,
    label: 'Review & Export',
    description: 'Customized Application',
  },
];

export default function Apply() {
  const dispatch = useDispatch();

  // Wizard state from Redux store
  const currentStep = useSelector(selectCurrentStep);
  const selectedResume = useSelector(selectSelectedResume);
  const selectedJd = useSelector(selectSelectedJd);
  const agentOutputs = useSelector(selectAgentOutputs);

  // Saved JDs list state
  const [savedJds, setSavedJds] = useState([]);
  const [isLoadingJds, setIsLoadingJds] = useState(false);
  const [jdInputMode, setJdInputMode] = useState('paste'); // 'paste' | 'saved'

  // Modal / Preview states
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [reviewTab, setReviewTab] = useState('fit'); // 'fit' | 'ats'

  const toast = useToast();

  // React Hook Form with Zod validation for Step 1
  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(applyStep1Schema),
    defaultValues: {
      resumeId: selectedResume ? selectedResume.id || selectedResume._id : '',
      jobDescriptionId: selectedJd ? selectedJd.id || selectedJd._id : '',
    },
    mode: 'onChange',
  });

  const watchedResumeId = watch('resumeId');
  const watchedJdId = watch('jobDescriptionId');

  // Synchronize initial Redux selections with form state
  useEffect(() => {
    if (selectedResume) {
      setValue('resumeId', selectedResume.id || selectedResume._id, { shouldValidate: true });
    }
    if (selectedJd) {
      setValue('jobDescriptionId', selectedJd.id || selectedJd._id, { shouldValidate: true });
    }
  }, [selectedResume, selectedJd, setValue]);

  // Fetch saved JDs on mount
  useEffect(() => {
    let isMounted = true;

    const fetchJds = async () => {
      setIsLoadingJds(true);
      try {
        const res = await api.get('/api/jds');
        const list = Array.isArray(res.data) ? res.data : res.data.jds || [];
        if (isMounted) {
          setSavedJds(list);
          // If JDs exist and none selected in Redux, optionally select latest
          if (list.length > 0 && !selectedJd) {
            dispatch(setSelectedJd(list[0]));
            setValue('jobDescriptionId', list[0].id || list[0]._id, { shouldValidate: true });
          }
        }
      } catch (err) {
        console.error('Failed to load job descriptions:', err);
      } finally {
        if (isMounted) {
          setIsLoadingJds(false);
        }
      }
    };

    fetchJds();

    return () => {
      isMounted = false;
    };
  }, [dispatch, selectedJd, setValue]);

  // Sync selected resume with Redux & RHF
  const handleSelectResume = (resume) => {
    dispatch(setSelectedResume(resume));
    if (resume) {
      const id = resume.id || resume._id;
      setValue('resumeId', id, { shouldValidate: true });
    } else {
      setValue('resumeId', '', { shouldValidate: true });
    }
  };

  // Sync selected JD with Redux & RHF
  const handleSelectJd = (jd) => {
    dispatch(setSelectedJd(jd));
    if (jd) {
      const id = jd.id || jd._id;
      setValue('jobDescriptionId', id, { shouldValidate: true });
    } else {
      setValue('jobDescriptionId', '', { shouldValidate: true });
    }
  };

  // JD paste success callback
  const handleJdCreated = (newJd) => {
    setSavedJds((prev) => [newJd, ...prev]);
    handleSelectJd(newJd);
  };

  // Step 1 Form Submission
  const onProceedToStep2 = (_data) => {
    toast.success(
      'Step 1 inputs verified! Ready to initialize multi-agent tailoring pipeline.'
    );

    // Advance to multi-agent copilot / Step 2
    dispatch(setCurrentStep(2));
  };


  const isStep1Complete = !!watchedResumeId && !!watchedJdId;

  return (
    <AppLayout>
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link to="/dashboard" className="hover:text-white transition">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-white font-medium">New Application Wizard</span>
        </div>

        {/* Wizard Header & Stepper */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Tailor Job Application
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Configure your source resume and target job requirements for AI multi-agent tailoring.
              </p>
            </div>

            {/* Step Counter Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 self-start md:self-auto text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-slate-300">Step {currentStep} of 3</span>
            </div>
          </div>

          {/* Animated StepIndicator Component */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-lg backdrop-blur-sm">
            <StepIndicator
              steps={WIZARD_STEPS}
              currentStep={currentStep}
              completedSteps={
                currentStep > 2
                  ? [1, 2]
                  : isStep1Complete && currentStep > 1
                  ? [1]
                  : []
              }
              onStepClick={(stepId) => {
                if (stepId === 1) dispatch(setCurrentStep(1));
                if (stepId === 2 && isStep1Complete) dispatch(setCurrentStep(2));
              }}
            />

          </div>
        </div>


        {/* Step 1 Main Content */}
        {currentStep === 1 ? (
          <form onSubmit={handleSubmit(onProceedToStep2)} className="space-y-8">
            {/* Side-by-Side Dual Ingestion Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* ======================================================== */}
              {/* LEFT COLUMN: RESUME SELECTION / UPLOADER                 */}
              {/* ======================================================== */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight">
                        Target Candidate Resume
                      </h2>
                      <p className="text-xs text-slate-400">
                        Select an existing document or upload a new PDF/DOCX
                      </p>
                    </div>
                  </div>

                  {selectedResume && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Resume Ready
                    </span>
                  )}
                </div>

                {/* Validation Error Message */}
                {errors.resumeId && (
                  <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-400 flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{errors.resumeId.message}</span>
                  </div>
                )}

                {/* Active Resume Card if selected */}
                {selectedResume ? (
                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-blue-500/50 shadow-lg shadow-blue-500/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs uppercase">
                          {(selectedResume.originalFilename || selectedResume.name || '').endsWith('.pdf') ? 'PDF' : 'DOCX'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {selectedResume.originalFilename || selectedResume.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {selectedResume.parsedSections?.skills?.length || 0} skills recognized
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowResumePreview(true)}
                        >
                          Preview
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectResume(null)}
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Resume Uploader component */
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <ResumeUploader
                      onUploadSuccess={handleSelectResume}
                      onSelectResume={handleSelectResume}
                      selectedResumeId={selectedResume?.id}
                    />
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* RIGHT COLUMN: JOB DESCRIPTION INGESTION / VISUALIZER     */}
              {/* ======================================================== */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight">
                        Target Job Description
                      </h2>
                      <p className="text-xs text-slate-400">
                        Paste the full posting or pick from previously saved JDs
                      </p>
                    </div>
                  </div>

                  {selectedJd && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      JD Parsed
                    </span>
                  )}
                </div>

                {/* Validation Error Message */}
                {errors.jobDescriptionId && (
                  <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-400 flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{errors.jobDescriptionId.message}</span>
                  </div>
                )}

                {/* If JD is selected, render JDRequirementsPanel */}
                {selectedJd ? (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSelectJd(null)}
                      >
                        Choose Different JD
                      </Button>
                    </div>
                    <JDRequirementsPanel
                      jobDescription={selectedJd}
                      onClose={() => handleSelectJd(null)}
                    />
                  </div>
                ) : (
                  /* Form / Saved JDs Selector */
                  <div className="space-y-4">
                    {/* Mode Tabs */}
                    <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 max-w-xs">
                      <button
                        type="button"
                        onClick={() => setJdInputMode('paste')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                          jdInputMode === 'paste'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Paste New JD
                      </button>
                      <button
                        type="button"
                        onClick={() => setJdInputMode('saved')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                          jdInputMode === 'saved'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Saved JDs ({savedJds.length})
                      </button>
                    </div>

                    {jdInputMode === 'paste' ? (
                      <JDPasteForm onSuccess={handleJdCreated} />
                    ) : (
                      /* Saved JDs List */
                      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                        {isLoadingJds ? (
                          <div className="p-8 text-center">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mb-2"></div>
                            <p className="text-xs text-slate-400">Loading saved job descriptions...</p>
                          </div>
                        ) : savedJds.length === 0 ? (
                          <div className="p-8 text-center space-y-2">
                            <p className="text-sm font-medium text-slate-400">No saved job descriptions found</p>
                            <p className="text-xs text-slate-500">
                              Switch to "Paste New JD" tab to add your first target role.
                            </p>
                          </div>
                        ) : (
                          <ul className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                            {savedJds.map((jd) => (
                              <li
                                key={jd.id || jd._id}
                                onClick={() => handleSelectJd(jd)}
                                className="group p-4 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition truncate">
                                    {jd.roleTitle}
                                  </h3>
                                  <p className="text-xs text-slate-400">
                                    {jd.company} • {jd.parsedRequirements?.skills?.length || 0} skills identified
                                  </p>
                                </div>
                                <Button type="button" variant="secondary" size="sm">
                                  Select
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-6">
                {/* Resume Status Indicator */}
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      watchedResumeId ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}
                  ></span>
                  <span className={watchedResumeId ? 'text-slate-200' : 'text-slate-500'}>
                    Resume: {selectedResume ? selectedResume.originalFilename || selectedResume.name : 'Missing'}
                  </span>
                </div>

                {/* JD Status Indicator */}
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      watchedJdId ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}
                  ></span>
                  <span className={watchedJdId ? 'text-slate-200' : 'text-slate-500'}>
                    Job Description: {selectedJd ? `${selectedJd.roleTitle} (${selectedJd.company})` : 'Missing'}
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!isStep1Complete}
                className={`font-semibold px-8 shadow-xl ${
                  isStep1Complete
                    ? 'shadow-blue-600/30'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                Continue to Multi-Agent Analysis →
              </Button>
            </div>
          </form>
        ) : currentStep === 2 ? (
          /* Step 2 Multi-Agent Pipeline Execution */
          <Step2Running />
        ) : (
          /* Step 3: Review & Customization */
          <div className="space-y-8 animate-fadeIn">
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Step 3: Review & Customization</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Examine keyword compliance, review tailored bullet points, and customize your application package.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => dispatch(setCurrentStep(2))}
                >
                  ← Back to Agent Pipeline
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => dispatch(setCurrentStep(1))}
                >
                  Start Over at Step 1
                </Button>
              </div>
            </div>

            {/* Review Section Navigation Tabs */}
            <div className="flex flex-wrap items-center p-1 bg-slate-950 rounded-2xl border border-slate-800 max-w-xl">
              <button
                type="button"
                onClick={() => setReviewTab('fit')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                  reviewTab === 'fit'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>Role Fit</span>
                {agentOutputs?.fitScore?.score !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-950/60 border border-blue-400/40 text-blue-200">
                    {agentOutputs.fitScore.score}/100
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setReviewTab('ats')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                  reviewTab === 'ats'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>ATS Audit</span>
                {agentOutputs?.atsReport?.overallScore !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-950/60 border border-blue-400/40 text-blue-200">
                    {agentOutputs.atsReport.overallScore}%
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setReviewTab('bullets')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                  reviewTab === 'bullets'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>Tailored Bullets</span>
                {Array.isArray(agentOutputs?.tailoredResume || agentOutputs?.tailoredBullets || agentOutputs?.state?.tailoredBullets) && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-950/60 border border-blue-400/40 text-blue-200">
                    {(agentOutputs.tailoredResume || agentOutputs.tailoredBullets || agentOutputs.state?.tailoredBullets || []).length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab View: Role Fit vs ATS Keyword Report vs Bullets Editor */}
            {reviewTab === 'fit' ? (
              <FitScore
                fitScore={
                  agentOutputs?.fitScore ||
                  agentOutputs?.gapAnalysis ||
                  agentOutputs?.state?.fitScore
                }
              />
            ) : reviewTab === 'ats' ? (
              <ATSReport
                atsReport={
                  agentOutputs?.atsReport ||
                  agentOutputs?.state?.atsReport
                }
              />
            ) : (
              <BulletsEditor
                bullets={
                  agentOutputs?.tailoredResume ||
                  agentOutputs?.tailoredBullets ||
                  agentOutputs?.state?.tailoredBullets ||
                  []
                }
              />
            )}
          </div>
        )}

        {/* Modal: Resume Preview */}
        {showResumePreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto my-auto">
              <ResumePreview
                resume={selectedResume}
                onClose={() => setShowResumePreview(false)}
              />
            </div>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
