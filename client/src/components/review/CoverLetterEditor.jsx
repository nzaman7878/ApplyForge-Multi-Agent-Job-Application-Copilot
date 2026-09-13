import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '../ui/Button';
import api from '../../lib/axios';
import { useToast } from '../../hooks/useToast';
import {
  setCoverLetter,
  setAgentOutputs,
  selectAgentOutputs,
} from '../../store/applySlice';

/**
 * CoverLetterEditor Component
 *
 * Provides a dedicated, full-page editing interface for candidate cover letters:
 * - Full-page styled textarea with formatting hints (Header, Hook, Accomplishments, Closing)
 * - Subject line editor
 * - "Regenerate" workflow allowing candidate to provide custom prompt instructions/notes
 * - Real-time character, word, and reading time counters
 * - One-click clipboard copy and text export
 *
 * @param {Object} props
 * @param {Object} [props.coverLetter] - { subject, body, keyThemes }
 * @param {string} [props.runId] - Active pipeline runId for backend re-prompting
 * @param {Function} [props.onChange] - Optional change callback
 * @param {string} [props.className] - Optional container classes
 */
export default function CoverLetterEditor({
  coverLetter: initialCoverLetter,
  runId: propRunId,
  onChange,
  className = '',
}) {
  const dispatch = useDispatch();
  const toast = useToast();
  const agentOutputs = useSelector(selectAgentOutputs);

  const activeRunId = propRunId || agentOutputs?.runId || agentOutputs?.state?.runId;
  const sourceCoverLetter = initialCoverLetter || agentOutputs?.coverLetter || agentOutputs?.state?.coverLetter;

  // Local editor state initialized directly from source
  const [subject, setSubject] = useState(
    () => sourceCoverLetter?.subject || 'Application for Target Role'
  );
  const [body, setBody] = useState(() => sourceCoverLetter?.body || '');
  const [keyThemes, setKeyThemes] = useState(() => sourceCoverLetter?.keyThemes || []);
  const [isCopied, setIsCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [showFormattingGuide, setShowFormattingGuide] = useState(false);

  // Sync state if external coverLetter prop changes after mounting
  const prevSourceRef = React.useRef(sourceCoverLetter);
  useEffect(() => {
    if (sourceCoverLetter && prevSourceRef.current !== sourceCoverLetter) {
      prevSourceRef.current = sourceCoverLetter;
      setSubject(sourceCoverLetter.subject || 'Application for Target Role');
      setBody(sourceCoverLetter.body || '');
      setKeyThemes(sourceCoverLetter.keyThemes || []);
    }
  }, [sourceCoverLetter]);

  // Compute metrics: character count, word count, reading time
  const metrics = useMemo(() => {
    const trimmed = body.trim();
    const characters = body.length;
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    // Estimated reading time at 200 words per minute
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

    return {
      characters,
      words,
      readingTimeMinutes,
    };
  }, [body]);

  // Notify parent and store of changes
  const handleBodyChange = (newBody) => {
    setBody(newBody);
    const updated = {
      subject,
      body: newBody,
      keyThemes,
    };
    dispatch(setCoverLetter(updated));
    dispatch(setAgentOutputs({ coverLetter: updated }));
    if (typeof onChange === 'function') {
      onChange(updated);
    }
  };

  const handleSubjectChange = (newSubject) => {
    setSubject(newSubject);
    const updated = {
      subject: newSubject,
      body,
      keyThemes,
    };
    dispatch(setCoverLetter(updated));
    dispatch(setAgentOutputs({ coverLetter: updated }));
    if (typeof onChange === 'function') {
      onChange(updated);
    }
  };

  // One-click clipboard copy
  const handleCopy = async () => {
    try {
      const fullText = subject ? `Subject: ${subject}\n\n${body}` : body;
      await navigator.clipboard.writeText(fullText);
      setIsCopied(true);
      toast.success('Cover letter copied to clipboard');
      setTimeout(() => setIsCopied(false), 2200);
    } catch (err) {
      console.error('Failed to copy cover letter:', err);
      toast.error('Could not copy to clipboard');
    }
  };

  // Download plain text file
  const handleDownload = () => {
    try {
      const fullText = subject ? `Subject: ${subject}\n\n${body}` : body;
      const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Cover_Letter_${(subject || 'Application').replace(/[^a-z0-9]/gi, '_')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Cover letter downloaded as .txt');
    } catch (err) {
      console.error('Failed to download cover letter:', err);
      toast.error('Download failed');
    }
  };

  // Trigger agent pipeline re-prompting with user notes
  const handleRegenerate = async () => {
    if (!activeRunId) {
      // Offline fallback: prepend user notes or enhance locally
      toast.error('No active pipeline run found to re-prompt. You can edit directly below.');
      setShowRegenModal(false);
      return;
    }

    setIsRegenerating(true);
    setShowRegenModal(false);

    try {
      const response = await api.post(`/api/pipeline/${activeRunId}/edit`, {
        userEdits: {
          notes: userNotes,
          coverLetterNotes: userNotes,
          tailoringInstructions: userNotes,
        },
      });

      const updatedState = response.data?.state;
      if (updatedState?.coverLetter) {
        const newCL = updatedState.coverLetter;
        setSubject(newCL.subject || subject);
        setBody(newCL.body || body);
        setKeyThemes(newCL.keyThemes || keyThemes);

        dispatch(setCoverLetter(newCL));
        dispatch(
          setAgentOutputs({
            coverLetter: newCL,
            state: updatedState,
          })
        );
        toast.success('Cover letter successfully regenerated by AI Agent!');
      } else {
        toast.success('Pipeline updated. State refreshed.');
      }
    } catch (err) {
      console.error('Error regenerating cover letter:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to regenerate cover letter';
      toast.error(errMsg);
    } finally {
      setIsRegenerating(false);
      setUserNotes('');
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Bar: Action Toolbar & Metainfo */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>Cover Letter Synthesis Agent</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Personalized Cover Letter Editor
            </h3>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Tailored specifically to the role without cliché openings. Edit the text directly, format using guide hints, or re-prompt with custom directives.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowFormattingGuide(!showFormattingGuide)}
              className="text-slate-300 hover:text-white"
            >
              {showFormattingGuide ? 'Hide Format Guide' : '💡 Formatting Guide'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowRegenModal(true)}
              disabled={isRegenerating}
              className="border-blue-500/40 text-blue-300 hover:bg-blue-950/40"
            >
              {isRegenerating ? 'Regenerating...' : '✨ Regenerate with AI'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopy}
            >
              {isCopied ? '✓ Copied!' : '📋 Copy Text'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDownload}
            >
              ⬇ Download .txt
            </Button>
          </div>
        </div>

        {/* Real-time Counters and Themes Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
          {/* Metrics */}
          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-slate-200">
              <span className="text-blue-400 font-bold">{metrics.words}</span> words
            </span>
            <span>•</span>
            <span>
              <span className="text-slate-200 font-semibold">{metrics.characters}</span> characters
            </span>
            <span>•</span>
            <span className="text-slate-400">
              ~{metrics.readingTimeMinutes} min read
            </span>
          </div>

          {/* Key Themes Badges */}
          {keyThemes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500">Key Themes:</span>
              {keyThemes.map((theme, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 border border-blue-500/25 text-blue-300"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Formatting Guide Collapsible Card */}
      {showFormattingGuide && (
        <div className="p-5 rounded-3xl bg-slate-900/60 border border-blue-500/30 text-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-bold text-white flex items-center gap-2">
              <span>📐 Modern Cover Letter Structure & Formatting Hints</span>
            </h4>
            <span className="text-[10px] text-slate-400">Standard 4-Paragraph Formula</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-slate-300">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <p className="font-bold text-blue-400 mb-1">1. The Hook</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Connect your engineering/domain track record directly with the company's core mission or scaling challenge. Avoid "I am writing to apply".
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <p className="font-bold text-emerald-400 mb-1">2. Core Proof</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Deep dive into 1-2 quantified accomplishments (e.g. latency cut by 40%, scaled to 1M users) that mirror their required tech stack.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <p className="font-bold text-purple-400 mb-1">3. Value Alignment</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Explain why their specific engineering culture, product trajectory, or architecture excites your professional goals.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <p className="font-bold text-amber-400 mb-1">4. Confident Close</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Forward-looking signoff welcoming discussion on how your technical capabilities directly accelerate their roadmaps.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Full-Page Editor Area */}
      <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-2xl space-y-4">
        {/* Subject Line Input */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Email Subject Line
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            placeholder="e.g. Senior Full-Stack Engineer Application - Alex Dev"
            className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-inner"
          />
        </div>

        {/* Cover Letter Body Area */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Cover Letter Body
            </label>
            <span className="text-[10px] text-slate-500">
              Plain text format • Markdown enabled
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-slate-800 focus-within:border-blue-500 transition shadow-inner bg-slate-950/90">
            <textarea
              rows={18}
              value={body}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder="Dear Hiring Team,&#10;&#10;Write your targeted cover letter narrative here..."
              className="w-full p-5 text-sm sm:text-base font-serif sm:font-sans bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none leading-relaxed resize-y selection:bg-blue-600 selection:text-white"
            />
          </div>
        </div>
      </div>

      {/* Modal: Regenerate with Custom Directives */}
      {showRegenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg p-6 sm:p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
                  ✨
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">
                    Regenerate Cover Letter
                  </h4>
                  <p className="text-xs text-slate-400">
                    Re-prompt the agent with specific guidance or instructions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegenModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Custom Instructions or Tone Directives:
              </label>
              <textarea
                rows={4}
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="e.g. Emphasize my experience leading distributed teams, make the tone more conversational, highlight my recent GraphQL microservice project..."
                className="w-full p-3.5 text-xs bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
              />
              <p className="text-[11px] text-slate-500">
                The agent will retain verified facts from your resume while incorporating your instructions.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRegenModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleRegenerate}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                Run AI Regeneration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
