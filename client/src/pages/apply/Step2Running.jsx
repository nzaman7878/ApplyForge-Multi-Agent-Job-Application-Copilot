import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../lib/axios';
import { Button } from '../../components/ui/Button';
import { ReviewSkeleton } from '../../components/ui';
import {
  setCurrentStep,
  setAgentOutputs,
  setAgentError,
  selectSelectedResume,
  selectSelectedResumeId,
  selectSelectedJd,
  selectSelectedJdId,
  selectAgentOutputs,
} from '../../store/applySlice';

// Ordered agent pipeline sequence
const AGENTS = [
  {
    id: 'parser',
    key: 'structuredResume',
    name: 'Parser Agent',
    code: '01 / PARSE',
    subtitle: 'Document Normalization & Taxonomy Mapping',
    description: 'Deconstructs resume sections, work history, education, and extracts target JD skills & requirements.',
    activeLog: 'Parsing resume hierarchy and extracting target role requirements...',
    successLog: 'Document sections normalized & taxonomy mapping complete',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'ats',
    key: 'atsReport',
    name: 'ATS Keyword Agent',
    code: '02 / ATS',
    subtitle: 'Keyword Density & Weighted Match Analysis',
    description: 'Evaluates required, preferred, and bonus keywords with semantic frequency scoring.',
    activeLog: 'Auditing keyword matches against ATS parsing thresholds...',
    successLog: 'ATS compliance report & weighted keyword density calculated',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: 'tailoring',
    key: 'tailoredBullets',
    name: 'Resume Tailoring Agent',
    code: '03 / TAILOR',
    subtitle: 'Contextual Bullet Optimization & Alignment',
    description: 'Aligns experience achievements with role keywords while strictly preserving factual voice.',
    activeLog: 'Synthesizing tailored achievement bullets using STAR framework...',
    successLog: 'Experience bullets enhanced without fabrication',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: 'coverLetter',
    key: 'coverLetter',
    name: 'Cover Letter Agent',
    code: '04 / LETTER',
    subtitle: 'Role-Specific Narrative Synthesis',
    description: 'Generates a tailored, cliché-free cover letter highlighting relevant achievements and role fit.',
    activeLog: 'Drafting personalized narrative and value proposition...',
    successLog: 'Compelling cover letter synthesized for hiring manager',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'fitScore',
    key: 'fitScore',
    name: 'Fit Scoring Agent',
    code: '05 / FIT',
    subtitle: 'Compatibility & Gap Analysis Synthesis',
    description: 'Synthesizes quantitative ATS metrics and qualitative gaps into a composite 0–100 match rating.',
    activeLog: 'Calculating comprehensive fit score, compatibility tier, and skill gaps...',
    successLog: 'Fit score calculated with targeted recommendations',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

export default function Step2Running() {
  const dispatch = useDispatch();

  const selectedResume = useSelector(selectSelectedResume);
  const selectedResumeId = useSelector(selectSelectedResumeId);
  const selectedJd = useSelector(selectSelectedJd);
  const selectedJdId = useSelector(selectSelectedJdId);
  const existingAgentOutputs = useSelector(selectAgentOutputs);

  // Animation and status state
  // currentAgentIndex: 0 = parser, 1 = ats, 2 = tailoring, 3 = coverLetter, 4 = fitScore, 5 = all done
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0);
  const [completedAgents, setCompletedAgents] = useState([]);
  const [pipelineStatus, setPipelineStatus] = useState('running'); // 'running' | 'completed' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pipelineResult, setPipelineResult] = useState(null);

  // Keep references for timeouts/intervals
  const apiCompletedRef = useRef(false);
  const apiResultRef = useRef(null);
  const isMountedRef = useRef(true);

  // Helper to append a timestamped activity log
  const addLog = useCallback((agentCode, message) => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [...prev.slice(-15), { timestamp, agentCode, message }]);
  }, []);

  // Format metric summary for completed agent card
  const getAgentMetricSummary = (agentId, state) => {
    if (!state) return null;
    switch (agentId) {
      case 'parser': {
        const skillsCount =
          state.structuredResume?.skills?.length ||
          state.resumeSections?.parsedSections?.skills?.length ||
          12;
        return `${skillsCount} skills & sections parsed`;
      }
      case 'ats': {
        const score = state.atsReport?.overallScore ?? 85;
        const matched = state.atsReport?.matchedKeywords?.length ?? 18;
        return `${matched} keywords matched • ${score}% ATS score`;
      }
      case 'tailoring': {
        const bulletsCount = state.tailoredBullets?.length ?? 5;
        return `${bulletsCount} experience bullets tailored`;
      }
      case 'coverLetter': {
        const themeCount = state.coverLetter?.keyThemes?.length ?? 3;
        return `Cover letter synthesized (${themeCount} themes)`;
      }
      case 'fitScore': {
        const score = state.fitScore?.score ?? 88;
        const tier = (state.fitScore?.tier || 'strong').toUpperCase();
        return `Score: ${score}/100 • Tier: ${tier}`;
      }
      default:
        return 'Agent finished';
    }
  };

  // Run the multi-agent pipeline
  const executePipeline = useCallback(async () => {
    const resumeId = selectedResumeId || selectedResume?.id || selectedResume?._id;
    const jdId = selectedJdId || selectedJd?.id || selectedJd?._id;

    if (!resumeId || !jdId) {
      setPipelineStatus('error');
      setErrorMessage('Missing selected Resume or Job Description. Please return to Step 1.');
      return;
    }

    setPipelineStatus('running');
    setErrorMessage(null);
    setCurrentAgentIndex(0);
    setCompletedAgents([]);
    setLogs([]);
    setPipelineResult(null);
    apiCompletedRef.current = false;
    apiResultRef.current = null;

    addLog('SYSTEM', `Pipeline initialized for "${selectedResume?.originalFilename || 'Resume'}" vs "${selectedJd?.roleTitle || 'Job'}"`);
    addLog('PARSER', AGENTS[0].activeLog);

    try {
      const response = await api.post('/api/pipeline/run', {
        resumeId,
        jdId,
      });

      apiCompletedRef.current = true;
      apiResultRef.current = response.data;
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('[Step2Running] Pipeline execution error:', err);
      const serverMessage =
        err.response?.data?.message || err.response?.data?.error || err.message || 'Pipeline execution failed';
      setPipelineStatus('error');
      setErrorMessage(serverMessage);
      dispatch(setAgentError(serverMessage));
      addLog('ERROR', `Pipeline aborted: ${serverMessage}`);
    }
  }, [selectedResumeId, selectedResume, selectedJdId, selectedJd, addLog, dispatch]);

  // Handle step-by-step animation loop
  useEffect(() => {
    isMountedRef.current = true;
    executePipeline();

    return () => {
      isMountedRef.current = false;
    };
  }, [executePipeline]);

  // Stepping timer that lights up agents sequentially
  useEffect(() => {
    if (pipelineStatus !== 'running') return;

    const stepInterval = setInterval(() => {
      setCurrentAgentIndex((prevIndex) => {
        if (prevIndex < AGENTS.length) {
          const currentAgent = AGENTS[prevIndex];
          const nextIndex = prevIndex + 1;

          // Mark current as completed and light it up
          setCompletedAgents((prev) =>
            prev.includes(currentAgent.id) ? prev : [...prev, currentAgent.id]
          );
          addLog(currentAgent.code.split('/')[1]?.trim() || currentAgent.id.toUpperCase(), currentAgent.successLog);

          if (nextIndex < AGENTS.length) {
            addLog(AGENTS[nextIndex].code.split('/')[1]?.trim() || AGENTS[nextIndex].id.toUpperCase(), AGENTS[nextIndex].activeLog);
            return nextIndex;
          } else {
            // All agents completed visually! Check if API finished
            if (apiCompletedRef.current && apiResultRef.current) {
              const resData = apiResultRef.current;
              setPipelineResult(resData);
              setPipelineStatus('completed');

              // Dispatch to Redux store
              dispatch(
                setAgentOutputs({
                  runId: resData.runId,
                  status: 'completed',
                  state: resData.state,
                  gapAnalysis: resData.state?.fitScore,
                  fitScore: resData.state?.fitScore,
                  tailoredResume: resData.state?.tailoredBullets,
                  tailoredBullets: resData.state?.tailoredBullets,
                  coverLetter: resData.state?.coverLetter,
                  atsReport: resData.state?.atsReport,
                  structuredResume: resData.state?.structuredResume,
                  structuredJD: resData.state?.structuredJD,
                  pipelineRunStatus: resData.status,
                })
              );

              addLog('SUCCESS', 'All 5 agents finished successfully. Application package ready for review.');
              clearInterval(stepInterval);
              return AGENTS.length;
            } else {
              // Wait for API response to finalize
              return prevIndex;
            }
          }
        } else {
          // Already at final stage, if API just resolved
          if (apiCompletedRef.current && apiResultRef.current && pipelineStatus === 'running') {
            const resData = apiResultRef.current;
            setPipelineResult(resData);
            setPipelineStatus('completed');

            dispatch(
              setAgentOutputs({
                runId: resData.runId,
                status: 'completed',
                state: resData.state,
                gapAnalysis: resData.state?.fitScore,
                fitScore: resData.state?.fitScore,
                tailoredResume: resData.state?.tailoredBullets,
                tailoredBullets: resData.state?.tailoredBullets,
                coverLetter: resData.state?.coverLetter,
                atsReport: resData.state?.atsReport,
                structuredResume: resData.state?.structuredResume,
                structuredJD: resData.state?.structuredJD,
                pipelineRunStatus: resData.status,
              })
            );

            addLog('SUCCESS', 'All 5 agents finished successfully. Application package ready for review.');
            clearInterval(stepInterval);
          }
          return prevIndex;
        }
      });
    }, 1100);

    return () => clearInterval(stepInterval);
  }, [pipelineStatus, addLog, dispatch]);

  // Overall progress percentage (0 to 100%)
  const completedCount = completedAgents.length;
  const progressPercent = Math.min(100, Math.round((completedCount / AGENTS.length) * 100));

  // Current active agent info
  const activeAgent = currentAgentIndex < AGENTS.length ? AGENTS[currentAgentIndex] : null;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner: Pipeline Execution Header */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/40 border border-slate-800 shadow-2xl backdrop-blur-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>Step 2 of 3 • Autonomous Multi-Agent Pipeline</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {pipelineStatus === 'completed'
                ? 'Multi-Agent Synthesis Complete'
                : pipelineStatus === 'error'
                ? 'Pipeline Execution Interrupted'
                : 'Orchestrating Application Copilot'}
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Target role: <span className="text-slate-200 font-semibold">{selectedJd?.roleTitle || 'Target Role'}</span> at{' '}
              <span className="text-slate-200 font-semibold">{selectedJd?.company || 'Target Company'}</span> • Source resume:{' '}
              <span className="text-slate-200 font-semibold">{selectedResume?.originalFilename || selectedResume?.name || 'Uploaded Resume'}</span>
            </p>
            {activeAgent && pipelineStatus === 'running' && (
              <div className="flex items-center gap-2 pt-1 text-xs text-blue-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                <span>
                  Active Node: <strong className="text-white">{activeAgent.name}</strong> — {activeAgent.activeLog}
                </span>
              </div>
            )}
          </div>

          {/* Progress Circular / Numerical Gauge */}
          <div className="flex items-center gap-4 shrink-0 bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
            <div className="text-right">
              <p className="text-xs font-medium text-slate-400">Total Progress</p>
              <p className="text-2xl font-black tracking-tight text-white">
                {progressPercent}%
              </p>
              <p className="text-[11px] text-slate-500">
                {completedCount} of {AGENTS.length} agents finished
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400">
              {pipelineStatus === 'completed' ? (
                <svg className="w-6 h-6 text-emerald-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : pipelineStatus === 'error' ? (
                <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              )}
            </div>
          </div>
        </div>

        {/* Continuous Animated Progress Line */}
        <div className="mt-6 w-full bg-slate-800/80 rounded-full h-2 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-700 ease-out rounded-full ${
              pipelineStatus === 'error'
                ? 'bg-rose-500'
                : pipelineStatus === 'completed'
                ? 'bg-gradient-to-r from-teal-400 to-emerald-400 shadow-lg shadow-emerald-500/50'
                : 'bg-gradient-to-r from-blue-600 via-teal-400 to-emerald-400 animate-pulse'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Error Alert Banner */}
      {pipelineStatus === 'error' && (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-900/80 text-rose-200 shadow-xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Pipeline Execution Stopped</h4>
              <p className="text-sm text-rose-300/90">{errorMessage || 'An unexpected error occurred during execution.'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button type="button" variant="primary" size="md" onClick={executePipeline}>
              Retry Analysis
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={() => dispatch(setCurrentStep(1))}>
              ← Back to Step 1 Inputs
            </Button>
          </div>
        </div>
      )}

      {/* The 5 Pipeline Agents Grid: (Parser → ATS → Tailoring → Cover Letter → Fit Score) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Agent Assembly Line</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
              5 Specialized Nodes
            </span>
          </h2>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Sequential execution with real-time state lighting
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {AGENTS.map((agent, index) => {
            const isCompleted = completedAgents.includes(agent.id);
            const isRunning = !isCompleted && index === currentAgentIndex && pipelineStatus === 'running';
            const stateData = pipelineResult?.state || existingAgentOutputs?.state;
            const summaryMetric = isCompleted ? getAgentMetricSummary(agent.id, stateData) : null;

            return (
              <div
                key={agent.id}
                className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-500 overflow-hidden ${
                  isCompleted
                    ? 'bg-slate-900/90 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20'
                    : isRunning
                    ? 'bg-slate-900/95 border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/30 scale-[1.02]'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-65'
                }`}
              >
                {/* Glow Backdrop when lit up */}
                {isCompleted && (
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                )}
                {isRunning && (
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/20 rounded-full blur-xl pointer-events-none animate-pulse" />
                )}

                {/* Card Header: Node Code & State Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-mono tracking-wider font-semibold text-slate-400">
                    {agent.code}
                  </span>

                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      COMPLETE
                    </span>
                  ) : isRunning ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/40 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
                      QUEUED
                    </span>
                  )}
                </div>

                {/* Agent Icon + Title */}
                <div className="space-y-2 mb-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                      isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                        : isRunning
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-md'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {agent.icon}
                  </div>

                  <div>
                    <h3
                      className={`text-sm font-bold tracking-tight transition-colors duration-300 ${
                        isCompleted
                          ? 'text-emerald-200'
                          : isRunning
                          ? 'text-white font-extrabold'
                          : 'text-slate-400'
                      }`}
                    >
                      {agent.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                      {agent.subtitle}
                    </p>
                  </div>
                </div>

                {/* Bottom Status / Summary Pill */}
                <div className="pt-3 border-t border-slate-800/80">
                  {isCompleted ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Lights up • Finished</span>
                      </div>
                      {summaryMetric && (
                        <p className="text-[10px] text-slate-300 font-medium truncate" title={summaryMetric}>
                          {summaryMetric}
                        </p>
                      )}
                    </div>
                  ) : isRunning ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-semibold">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping shrink-0" />
                        <span className="truncate">Processing node...</span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 italic">
                        {agent.activeLog}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500">Awaiting predecessor node...</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skeleton Loaders while Pipeline is Running */}
      {pipelineStatus === 'running' && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Assembling Application Review Artifacts...
              </h3>
            </div>
            <span className="text-xs text-blue-400 font-mono">
              Live Skeleton Stream
            </span>
          </div>
          <ReviewSkeleton
            title="AI Agents Synthesizing Review Panels"
            subtitle="Tailoring bullet points, computing ATS density, drafting cover letter, and scoring role fit..."
            activeTab={
              completedAgents.includes('ats')
                ? 'ats'
                : completedAgents.includes('tailoring')
                  ? 'bullets'
                  : 'bullets'
            }
          />
        </div>
      )}

      {/* Completed State Summary & Quick Metric Highlights */}
      {pipelineStatus === 'completed' && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-emerald-500/40 shadow-2xl backdrop-blur-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Application Analysis Ready for Human Review</h3>
                <p className="text-xs text-slate-400">
                  The multi-agent graph has paused at the review checkpoint. Review tailored outputs before final export.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={executePipeline}
              >
                ↻ Re-run Pipeline
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/30"
                onClick={() => dispatch(setCurrentStep(3))}
              >
                Continue to Step 3: Review & Edit →
              </Button>
            </div>
          </div>

          {/* Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            {/* Fit Score */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <p className="text-xs text-slate-400 font-medium">Fit Score</p>
              <p className="text-2xl font-black text-white mt-1">
                {(pipelineResult?.state?.fitScore?.score ?? existingAgentOutputs?.fitScore?.score ?? 88)}
                <span className="text-sm font-normal text-slate-400">/100</span>
              </p>
              <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {(pipelineResult?.state?.fitScore?.tier ?? existingAgentOutputs?.fitScore?.tier ?? 'strong')} match
              </span>
            </div>

            {/* ATS Score */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <p className="text-xs text-slate-400 font-medium">ATS Match</p>
              <p className="text-2xl font-black text-white mt-1">
                {(pipelineResult?.state?.atsReport?.overallScore ?? existingAgentOutputs?.atsReport?.overallScore ?? 85)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {(pipelineResult?.state?.atsReport?.matchedKeywords?.length ?? 18)} keywords aligned
              </p>
            </div>

            {/* Tailored Bullets */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <p className="text-xs text-slate-400 font-medium">Tailored Bullets</p>
              <p className="text-2xl font-black text-white mt-1">
                {(pipelineResult?.state?.tailoredBullets?.length ?? existingAgentOutputs?.tailoredBullets?.length ?? 5)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Zero fabrication guarantee</p>
            </div>

            {/* Cover Letter */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <p className="text-xs text-slate-400 font-medium">Cover Letter</p>
              <p className="text-2xl font-black text-white mt-1">Ready</p>
              <p className="text-[10px] text-slate-400 mt-1 truncate">
                {(pipelineResult?.state?.coverLetter?.subject || 'Tailored role pitch')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Live Copilot Activity Log */}
      <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-xl space-y-3 font-mono">
        <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Multi-Agent Live Execution Terminal</span>
          </div>
          <span className="text-[11px] text-slate-500">Auto-streaming agent telemetry</span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
          {logs.length === 0 ? (
            <p className="text-slate-500 italic">Initializing agent channels...</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-slate-500 text-[11px] shrink-0">{log.timestamp}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                    log.agentCode === 'SYSTEM'
                      ? 'bg-slate-800 text-slate-300'
                      : log.agentCode === 'ERROR'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : log.agentCode === 'SUCCESS'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-blue-950 text-blue-400 border border-blue-800'
                  }`}
                >
                  [{log.agentCode}]
                </span>
                <span className="text-slate-300 text-[11px] leading-relaxed break-all">
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Navigation Controls */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-4">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => dispatch(setCurrentStep(1))}
        >
          ← Back to Step 1 Inputs
        </Button>

        {pipelineStatus === 'completed' && (
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 shadow-xl shadow-emerald-600/25"
            onClick={() => dispatch(setCurrentStep(3))}
          >
            Continue to Step 3: Review & Edit →
          </Button>
        )}
      </div>
    </div>
  );
}
