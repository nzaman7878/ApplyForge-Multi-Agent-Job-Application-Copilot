import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useToast } from '../../hooks/useToast';
import api from '../../lib/axios';
import { Button } from '../ui/Button';
import Spinner from '../ui/Spinner';
import {
  getStatusInfo,
  getCompanyLogoColor,
  getCompanyInitials,
} from './constants';

const STRATEGY_DETAILS = {
  early_courtesy_check: {
    title: 'Early Courtesy Check',
    stageLabel: '≤ 7 Days Elapsed',
    description: 'Polite, brief check-in confirming application receipt and reiterating enthusiasm.',
    badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    icon: '👋',
  },
  standard_status_inquiry: {
    title: 'Standard Status Inquiry',
    stageLabel: '8–14 Days Elapsed',
    description: 'Professional status update request highlighting key engineering strengths.',
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    icon: '⏱️',
  },
  graceful_re_engagement: {
    title: 'Graceful Re-Engagement',
    stageLabel: '> 14 Days Elapsed',
    description: 'Respectful check-in checking whether search timeline remains active.',
    badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    icon: '🔄',
  },
  post_interview_reinforcement: {
    title: 'Post-Interview Reinforcement',
    stageLabel: 'Interviewing Stage',
    description: 'Thank-you note reinforcing topics and technical priorities discussed in interview.',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    icon: '🤝',
  },
};

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional & Polished' },
  { value: 'enthusiastic', label: 'Enthusiastic & High Energy' },
  { value: 'concise', label: 'Brief & Direct' },
  { value: 'conversational', label: 'Warm & Conversational' },
];

/**
 * Calculates days elapsed since application date
 */
function calculateDaysElapsed(application) {
  if (!application) return 0;
  const rawDate = application.appliedAt || application.appliedDate || application.createdAt;
  if (!rawDate) return 0;
  const appliedTime = new Date(rawDate).getTime();
  if (isNaN(appliedTime)) return 0;
  return Math.max(0, Math.floor((Date.now() - appliedTime) / (1000 * 60 * 60 * 24)));
}

/**
 * FollowUpDraftModal Component
 *
 * Provides an intelligent, editable follow-up email composer powered by the follow-up draft agent:
 * - Shows generated follow-up email with subject line, body, and strategy badge
 * - Allows real-time editing of both subject and body
 * - One-click copy-to-clipboard for full email, subject-only, or body-only
 * - AI fine-tuning controls: customize recipient name, tone, custom notes, and elapsed days
 * - Manual edit saving and instant "Mark Followed-Up" shortcut
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Modal close handler
 * @param {Object} props.application - Application dossier object
 * @param {Function} [props.onDraftSaved] - Callback(updatedApp, draft)
 * @param {Function} [props.onMarkFollowedUp] - Callback(applicationId)
 */
export default function FollowUpDraftModal({
  isOpen,
  onClose,
  application,
  onDraftSaved,
  onMarkFollowedUp,
}) {
  const toast = useToast();
  const modalRef = useFocusTrap(isOpen, {
    onEscape: onClose,
  });

  const appId = application?.id || application?._id;
  const company = application?.company || 'Target Company';
  const roleTitle = application?.roleTitle || application?.role || 'Target Role';
  const status = application?.status || 'applied';

  // Form & Draft state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [strategy, setStrategy] = useState('standard_status_inquiry');
  const [recommendedSendTime, setRecommendedSendTime] = useState('');
  const [recommendedWaitDays, setRecommendedWaitDays] = useState(5);
  const [keyHighlights, setKeyHighlights] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingFollowedUp, setIsMarkingFollowedUp] = useState(false);
  const [copiedSection, setCopiedSection] = useState(null); // 'all' | 'subject' | 'body' | null

  // Directives & Options state
  const [showDirectives, setShowDirectives] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [tone, setTone] = useState('professional');
  const [customNotes, setCustomNotes] = useState('');
  const [daysOverride, setDaysOverride] = useState('');

  // Track if initial draft has been loaded for current application
  const loadedAppIdRef = useRef(null);

  // Initialize draft when application changes or modal opens
  useEffect(() => {
    if (!isOpen || !application) {
      return;
    }

    const currentId = application.id || application._id;
    const elapsedDays = calculateDaysElapsed(application);

    // If new application or initial load
    if (loadedAppIdRef.current !== currentId) {
      loadedAppIdRef.current = currentId;
      setDaysOverride(String(elapsedDays));

      const existingDraft = application.followUpEmail;
      if (existingDraft && existingDraft.body) {
        setSubject(existingDraft.subject || '');
        setBody(existingDraft.body || '');
        setStrategy(existingDraft.strategy || 'standard_status_inquiry');
        setRecommendedSendTime(existingDraft.recommendedSendTime || 'Tuesday or Wednesday morning between 9:00 AM - 11:00 AM');
        setRecommendedWaitDays(existingDraft.recommendedWaitDays || 5);
        setKeyHighlights(existingDraft.keyHighlights || []);
        setTone(existingDraft.tone || 'professional');
      } else {
        // Auto-generate initial draft if none exists
        triggerDraftGeneration({
          targetDays: elapsedDays,
          initialAuto: true,
        });
      }
    }
  }, [isOpen, application]);

  // Reset loadedAppId on close
  useEffect(() => {
    if (!isOpen) {
      loadedAppIdRef.current = null;
      setShowDirectives(false);
      setCopiedSection(null);
    }
  }, [isOpen]);

  /**
   * Generates or regenerates follow-up email from API agent
   */
  const triggerDraftGeneration = useCallback(
    async (opts = {}) => {
      if (!appId) return;

      const targetDays =
        opts.targetDays !== undefined
          ? opts.targetDays
          : daysOverride !== '' && !isNaN(Number(daysOverride))
          ? Number(daysOverride)
          : calculateDaysElapsed(application);

      try {
        setIsGenerating(true);

        const payload = {
          daysSinceApplied: targetDays,
          tone: opts.tone || tone || 'professional',
          recipientName: opts.recipientName !== undefined ? opts.recipientName : recipientName,
          customNotes: opts.customNotes !== undefined ? opts.customNotes : customNotes,
        };

        const res = await api.post(`/api/applications/${appId}/draft-followup`, payload);
        const draft = res.data?.emailDraft || res.data?.draft;

        if (draft) {
          setSubject(draft.subject || '');
          setBody(draft.body || '');
          setStrategy(draft.strategy || 'standard_status_inquiry');
          setRecommendedSendTime(draft.recommendedSendTime || 'Tuesday or Wednesday morning between 9:00 AM - 11:00 AM');
          setRecommendedWaitDays(draft.recommendedWaitDays || 5);
          setKeyHighlights(draft.keyHighlights || []);

          if (onDraftSaved) {
            onDraftSaved(res.data?.application || application, draft);
          }

          if (!opts.initialAuto) {
            toast.success('Generated fresh follow-up draft!');
          }
        }
      } catch (err) {
        console.error('[FollowUpDraftModal] Failed to generate follow-up draft:', err);
        toast.error(err.response?.data?.message || 'Failed to generate follow-up draft');
      } finally {
        setIsGenerating(false);
      }
    },
    [appId, daysOverride, tone, recipientName, customNotes, application, onDraftSaved, toast]
  );

  /**
   * Copies specified text to clipboard with fallback and toast
   */
  const handleCopy = async (type) => {
    let textToCopy = '';
    let label = '';

    if (type === 'all') {
      textToCopy = `Subject: ${subject}\n\n${body}`;
      label = 'Full email (Subject + Body)';
    } else if (type === 'subject') {
      textToCopy = subject;
      label = 'Subject line';
    } else if (type === 'body') {
      textToCopy = body;
      label = 'Email body';
    }

    if (!textToCopy) {
      toast.warning('Draft is empty');
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedSection(type);
      toast.success(`Copied ${label} to clipboard!`);
      setTimeout(() => {
        setCopiedSection((prev) => (prev === type ? null : prev));
      }, 2500);
    } catch (err) {
      console.error('[FollowUpDraftModal] Failed to copy to clipboard:', err);
      toast.error('Failed to copy text to clipboard');
    }
  };

  /**
   * Persists manual edits back to the application
   */
  const handleSaveEdits = async () => {
    if (!appId) return;

    try {
      setIsSaving(true);
      const updatedDraft = {
        subject,
        body,
        strategy,
        recommendedSendTime,
        recommendedWaitDays,
        keyHighlights,
        tone,
        daysSinceApplied: Number(daysOverride) || calculateDaysElapsed(application),
        draftedAt: new Date().toISOString(),
      };

      const res = await api.patch(`/api/applications/${appId}`, {
        followUpEmail: updatedDraft,
      });

      if (onDraftSaved) {
        onDraftSaved(res.data?.application || { ...application, followUpEmail: updatedDraft }, updatedDraft);
      }

      toast.success('Follow-up draft changes saved!');
    } catch (err) {
      console.error('[FollowUpDraftModal] Failed to save follow-up draft edits:', err);
      toast.error('Failed to save follow-up draft changes');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Marks follow-up as completed and closes modal
   */
  const handleMarkFollowedUpClick = async () => {
    if (!appId) return;

    try {
      setIsMarkingFollowedUp(true);
      if (onMarkFollowedUp) {
        await onMarkFollowedUp(appId);
      } else {
        await api.patch(`/api/applications/${appId}`, {
          lastFollowUpAt: new Date().toISOString(),
          nextFollowUpAt: null,
        });
        toast.success(`Marked follow-up completed for ${company}!`);
      }
      onClose();
    } catch (err) {
      console.error('[FollowUpDraftModal] Failed to mark follow-up completed:', err);
      toast.error('Failed to mark follow-up completed');
    } finally {
      setIsMarkingFollowedUp(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const currentStrategy = STRATEGY_DETAILS[strategy] || STRATEGY_DETAILS.standard_status_inquiry;
  const companyColor = getCompanyLogoColor(company);
  const initials = getCompanyInitials(company);
  const statusInfo = getStatusInfo(status);
  const elapsedDays = calculateDaysElapsed(application);
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="followup-modal-title"
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-blue-950/40 focus:outline-none overflow-hidden"
        tabIndex={-1}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center font-bold text-sm tracking-wider shadow-sm border shrink-0 ${companyColor}`}
            >
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  id="followup-modal-title"
                  className="font-bold text-base sm:text-lg text-white tracking-tight truncate"
                >
                  Follow-Up Email Draft
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusInfo.badgeBg}`}
                >
                  <span>{statusInfo.icon}</span>
                  <span>{statusInfo.title}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                <span className="text-slate-200 font-semibold">{company}</span> — {roleTitle}{' '}
                <span className="text-slate-500 font-mono">
                  • {elapsedDays} day{elapsedDays === 1 ? '' : 's'} elapsed
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800/80 transition cursor-pointer"
            aria-label="Close dialog (Escape)"
            title="Close dialog (Escape)"
          >
            <span className="text-lg leading-none">✕</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {/* Strategy & Intelligence Banner */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${currentStrategy.badgeClass}`}
                >
                  <span>{currentStrategy.icon}</span>
                  <span>{currentStrategy.title}</span>
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({currentStrategy.stageLabel})
                </span>
              </div>

              {/* Recommended Timing */}
              {recommendedSendTime && (
                <div className="flex items-center gap-1.5 text-xs text-amber-300/90 font-medium bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                  <span>📅</span>
                  <span className="truncate">Best time: {recommendedSendTime}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {currentStrategy.description}
            </p>

            {/* Key Themes / Strengths */}
            {keyHighlights && keyHighlights.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Highlights:
                </span>
                {keyHighlights.map((hl, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium"
                  >
                    ✓ {hl}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* AI Fine-Tuning & Directives (Toggleable) */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDirectives((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/40 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span>🪄</span>
                <span>AI Guidance & Fine-Tuning Directives</span>
              </div>
              <span className="text-slate-500 text-xs">
                {showDirectives ? 'Collapse ▴' : 'Customize & Regenerate ▾'}
              </span>
            </button>

            {showDirectives && (
              <div className="p-4 pt-2 border-t border-slate-800 space-y-3.5 bg-slate-950/60 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Recipient Name */}
                  <div className="space-y-1">
                    <label
                      htmlFor="followup-recipient-name"
                      className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                    >
                      Recipient Name / Salutation
                    </label>
                    <input
                      id="followup-recipient-name"
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins (Recruiter) or Hiring Lead"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Tone Preset */}
                  <div className="space-y-1">
                    <label
                      htmlFor="followup-tone-select"
                      className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                    >
                      Tone Preset
                    </label>
                    <select
                      id="followup-tone-select"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {TONE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Days Since Applied Override */}
                  <div className="space-y-1 sm:col-span-1">
                    <label
                      htmlFor="followup-days-override"
                      className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                    >
                      Elapsed Days (Calculation)
                    </label>
                    <input
                      id="followup-days-override"
                      type="number"
                      min="0"
                      max="365"
                      value={daysOverride}
                      onChange={(e) => setDaysOverride(e.target.value)}
                      placeholder="e.g. 7"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  {/* Custom Notes / Specific context */}
                  <div className="space-y-1 sm:col-span-2">
                    <label
                      htmlFor="followup-custom-notes"
                      className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                    >
                      Specific Details / Conversation Memory
                    </label>
                    <input
                      id="followup-custom-notes"
                      type="text"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder="e.g. Mention referral conversation with Alex last Tuesday"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Regenerate Button */}
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => triggerDraftGeneration()}
                    isLoading={isGenerating}
                    className="gap-1.5 shadow-sm shadow-blue-600/30"
                  >
                    <span>✨</span>
                    <span>Generate Tailored Draft</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Email Subject Line Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="followup-subject-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-300"
              >
                Subject Line
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-mono">
                  {subject.length} chars
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('subject')}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border transition cursor-pointer ${
                    copiedSection === 'subject'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                  }`}
                  title="Copy subject line"
                >
                  <span>{copiedSection === 'subject' ? '✓' : '📋'}</span>
                  <span>{copiedSection === 'subject' ? 'Copied' : 'Copy Subject'}</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                id="followup-subject-input"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line will appear here..."
                disabled={isGenerating}
                className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition shadow-inner"
              />
              {isGenerating && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner size="sm" />
                </div>
              )}
            </div>
          </div>

          {/* Email Body Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="followup-body-textarea"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-300"
                >
                  Email Body
                </label>
                <span className="text-[11px] text-slate-500">
                  (Editable)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-mono">
                  {wordCount} words
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('body')}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border transition cursor-pointer ${
                    copiedSection === 'body'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                  }`}
                  title="Copy email body"
                >
                  <span>{copiedSection === 'body' ? '✓' : '📋'}</span>
                  <span>{copiedSection === 'body' ? 'Copied' : 'Copy Body'}</span>
                </button>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 focus-within:border-blue-500 transition shadow-inner bg-slate-950/90">
              <textarea
                id="followup-body-textarea"
                rows={11}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Drafting follow-up message..."
                disabled={isGenerating}
                className="w-full p-4 sm:p-5 text-sm sm:text-base font-sans bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none leading-relaxed resize-y selection:bg-blue-600 selection:text-white"
              />
              {isGenerating && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                  <Spinner size="md" />
                  <span className="text-xs text-blue-300 font-medium animate-pulse">
                    Agent is crafting your follow-up email...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/70 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left actions: Save edits & mark follow-up */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSaveEdits}
              isLoading={isSaving}
              disabled={isGenerating || !body.trim()}
              className="gap-1.5"
              title="Save manual edits to application dossier"
            >
              <span>💾</span>
              <span>Save Draft</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleMarkFollowedUpClick}
              isLoading={isMarkingFollowedUp}
              disabled={isGenerating}
              className="gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
              title="Mark follow-up completed for this cycle"
            >
              <span>✓</span>
              <span>Mark Followed-Up</span>
            </Button>
          </div>

          {/* Right actions: Copy full email & close */}
          <div className="flex items-center gap-2.5 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isGenerating}
            >
              Close
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => handleCopy('all')}
              disabled={isGenerating || !body.trim()}
              className={`gap-2 font-bold shadow-md transition ${
                copiedSection === 'all'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                  : 'shadow-blue-600/30'
              }`}
            >
              <span>{copiedSection === 'all' ? '✓' : '📋'}</span>
              <span>{copiedSection === 'all' ? 'Copied to Clipboard!' : 'Copy Full Email'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
