import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Button } from '../ui/Button';
import { setTailoredResume, setAgentOutputs } from '../../store/applySlice';

/**
 * Status Badge Component for bullet state
 */
function BulletStatusBadge({ status }) {
  switch (status) {
    case 'accepted':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Accepted
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          Rejected (Using Original)
        </span>
      );
    case 'edited':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Custom Edited
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Pending Review
        </span>
      );
  }
}

/**
 * BulletsEditor Component
 *
 * Provides a side-by-side comparison between Original Resume Bullets and
 * Tailored Bullets with per-bullet Accept, Reject, and Inline Editing actions.
 *
 * @param {Object} props
 * @param {Array<{ originalBullet: string, tailoredBullet: string, reasoning?: string }>} props.bullets
 * @param {Function} [props.onChange] - Optional change callback
 * @param {string} [props.className] - Optional container classes
 */
export default function BulletsEditor({ bullets = [], onChange, className = '' }) {
  const dispatch = useDispatch();

  // Helper to initialize local editable items
  const formatItems = (list) => {
    if (!Array.isArray(list)) return [];
    return list.map((b, idx) => ({
      id: idx,
      originalBullet: b.originalBullet || b.original || b.text || '',
      aiTailoredBullet: b.tailoredBullet || b.tailored || b.text || '',
      currentText: b.tailoredBullet || b.tailored || b.text || '',
      reasoning: b.reasoning || '',
      status: b.status || 'pending',
      isEditing: false,
      draftText: b.tailoredBullet || b.tailored || b.text || '',
    }));
  };

  // Initialize local editable state from bullets prop
  const [bulletItems, setBulletItems] = useState(() => formatItems(bullets));
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'accepted' | 'edited' | 'rejected'
  const [copySuccess, setCopySuccess] = useState(false);

  // Sync state if external bullets prop changes after mounting
  const prevBulletsRef = React.useRef(bullets);
  useEffect(() => {
    if (prevBulletsRef.current !== bullets && Array.isArray(bullets) && bullets.length > 0) {
      prevBulletsRef.current = bullets;
      setBulletItems(formatItems(bullets));
    }
  }, [bullets]);

  // Synchronize with Redux and parent callback on state changes
  const notifyChanges = (updatedItems) => {
    const formattedPayload = updatedItems.map((item) => ({
      originalBullet: item.originalBullet,
      tailoredBullet: item.currentText,
      reasoning: item.reasoning,
      status: item.status,
    }));

    dispatch(setTailoredResume(formattedPayload));
    dispatch(
      setAgentOutputs({
        tailoredResume: formattedPayload,
        tailoredBullets: formattedPayload,
      })
    );

    if (typeof onChange === 'function') {
      onChange(formattedPayload);
    }
  };

  // Per-bullet action: Accept AI tailored version
  const handleAccept = (index) => {
    setBulletItems((prev) => {
      const next = [...prev];
      const target = next[index];
      next[index] = {
        ...target,
        status: 'accepted',
        currentText: target.aiTailoredBullet,
        draftText: target.aiTailoredBullet,
        isEditing: false,
      };
      notifyChanges(next);
      return next;
    });
  };

  // Per-bullet action: Reject and revert to original
  const handleReject = (index) => {
    setBulletItems((prev) => {
      const next = [...prev];
      const target = next[index];
      next[index] = {
        ...target,
        status: 'rejected',
        currentText: target.originalBullet,
        draftText: target.originalBullet,
        isEditing: false,
      };
      notifyChanges(next);
      return next;
    });
  };

  // Open inline editor for a specific bullet
  const handleStartEdit = (index) => {
    setBulletItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        isEditing: true,
        draftText: next[index].currentText,
      };
      return next;
    });
  };

  // Save inline edit
  const handleSaveEdit = (index) => {
    setBulletItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const trimmed = target.draftText.trim();
      next[index] = {
        ...target,
        currentText: trimmed,
        status: 'edited',
        isEditing: false,
      };
      notifyChanges(next);
      return next;
    });
  };

  // Cancel inline edit
  const handleCancelEdit = (index) => {
    setBulletItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        isEditing: false,
        draftText: next[index].currentText,
      };
      return next;
    });
  };

  // Update text inside inline editor
  const handleDraftChange = (index, value) => {
    setBulletItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        draftText: value,
      };
      return next;
    });
  };

  // Batch action: Accept all
  const handleAcceptAll = () => {
    setBulletItems((prev) => {
      const next = prev.map((item) => ({
        ...item,
        status: 'accepted',
        currentText: item.aiTailoredBullet,
        isEditing: false,
      }));
      notifyChanges(next);
      return next;
    });
  };

  // Batch action: Reject all (use original)
  const handleRejectAll = () => {
    setBulletItems((prev) => {
      const next = prev.map((item) => ({
        ...item,
        status: 'rejected',
        currentText: item.originalBullet,
        isEditing: false,
      }));
      notifyChanges(next);
      return next;
    });
  };

  // Copy all active bullets to clipboard
  const handleCopyAll = async () => {
    try {
      const textToCopy = bulletItems
        .map((b) => `• ${b.currentText}`)
        .join('\n');
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy bullets:', err);
    }
  };

  // Summary counts
  const totalCount = bulletItems.length;
  const acceptedCount = bulletItems.filter((b) => b.status === 'accepted').length;
  const editedCount = bulletItems.filter((b) => b.status === 'edited').length;
  const rejectedCount = bulletItems.filter((b) => b.status === 'rejected').length;
  const pendingCount = bulletItems.filter((b) => b.status === 'pending').length;

  // Filtered bullets
  const filteredBullets = useMemo(() => {
    if (filterStatus === 'all') return bulletItems;
    return bulletItems.filter((b) => b.status === filterStatus);
  }, [bulletItems, filterStatus]);

  if (totalCount === 0) {
    return (
      <div className={`p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center ${className}`}>
        <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <h4 className="text-base font-semibold text-white">No Tailored Bullets Available</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Execute the multi-agent pipeline in Step 2 to generate tailored resume bullet points matching the target job description.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header Card: Summary & Batch Actions */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>Resume Tailoring Agent • Side-by-Side Review</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Interactive Bullet Points Editor
            </h3>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Compare your original resume achievements with AI-tailored optimizations. Click any tailored bullet to edit inline, or accept/reject individually.
            </p>
          </div>

          {/* Batch Quick Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAcceptAll}
              className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
            >
              ✓ Accept All ({totalCount})
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRejectAll}
              className="text-slate-400 hover:text-slate-200"
            >
              Revert All to Original
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyAll}
            >
              {copySuccess ? '✓ Copied!' : '📋 Copy Bullets'}
            </Button>
          </div>
        </div>

        {/* Breakdown Badges & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
          {/* Quick Stat Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
              {acceptedCount} Accepted
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
              {editedCount} Custom Edited
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold">
              {rejectedCount} Rejected
            </span>
            {pendingCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 font-semibold">
                {pendingCount} Pending
              </span>
            )}
          </div>

          {/* Filter Status Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            {[
              { id: 'all', label: `All (${totalCount})` },
              { id: 'accepted', label: `Accepted (${acceptedCount})` },
              { id: 'edited', label: `Edited (${editedCount})` },
              { id: 'rejected', label: `Rejected (${rejectedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`px-2.5 py-1 font-semibold rounded-lg transition cursor-pointer ${
                  filterStatus === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bullet Items Comparison List */}
      <div className="space-y-6">
        {filteredBullets.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
            No bullet points match the selected filter.
          </div>
        ) : (
          filteredBullets.map((item) => {
            const index = item.id;
            const isRejected = item.status === 'rejected';
            const isAccepted = item.status === 'accepted';
            const isEdited = item.status === 'edited';

            return (
              <div
                key={index}
                className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 shadow-xl space-y-4 transition"
              >
                {/* Header: Index, Status Badge, & Per-Bullet Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center font-mono font-bold text-xs">
                      #{index + 1}
                    </span>
                    <h4 className="text-sm font-bold text-white tracking-tight">
                      Experience Achievement Bullet
                    </h4>
                    <BulletStatusBadge status={item.status} />
                  </div>

                  {/* Per-Bullet Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Accept Button */}
                    <button
                      type="button"
                      onClick={() => handleAccept(index)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isAccepted
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                          : 'bg-emerald-950/40 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40'
                      }`}
                      title="Accept AI tailored optimization"
                    >
                      <span>✓</span>
                      <span>{isAccepted ? 'Accepted' : 'Accept AI'}</span>
                    </button>

                    {/* Inline Edit Trigger */}
                    {!item.isEditing && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(index)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          isEdited
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                        title="Click to edit bullet inline"
                      >
                        <span>✎</span>
                        <span>{isEdited ? 'Edit Again' : 'Edit'}</span>
                      </button>
                    )}

                    {/* Reject Button (Revert to Original) */}
                    <button
                      type="button"
                      onClick={() => handleReject(index)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                        isRejected
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                          : 'bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-700/50'
                      }`}
                      title="Reject AI version and keep original bullet"
                    >
                      <span>✕</span>
                      <span>{isRejected ? 'Using Original' : 'Reject'}</span>
                    </button>
                  </div>
                </div>

                {/* Side-by-Side Comparison Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* ==================================================== */}
                  {/* LEFT COLUMN: ORIGINAL RESUME BULLET                 */}
                  {/* ==================================================== */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        Original Source Bullet
                      </span>
                      {isRejected && (
                        <span className="text-[10px] text-rose-400 font-semibold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800">
                          Active Choice
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs leading-relaxed transition-colors ${
                        isRejected
                          ? 'text-slate-200 font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.originalBullet}
                    </p>
                  </div>

                  {/* ==================================================== */}
                  {/* RIGHT COLUMN: TAILORED BULLET (With Inline Editor)  */}
                  {/* ==================================================== */}
                  <div
                    className={`p-4 rounded-2xl border transition-all space-y-2 ${
                      item.isEditing
                        ? 'bg-slate-950 border-blue-500 ring-2 ring-blue-500/20 shadow-xl'
                        : isAccepted
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : isEdited
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : isRejected
                        ? 'bg-slate-950/40 border-slate-800 opacity-60'
                        : 'bg-slate-950/60 border-blue-500/30 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        {isEdited ? 'Custom Tailored Bullet' : 'AI Tailored Bullet'}
                      </span>

                      {!item.isEditing && (
                        <span className="text-[10px] text-slate-500 italic hidden sm:inline">
                          Click text below to edit
                        </span>
                      )}
                    </div>

                    {/* Inline Editor or Interactive Text View */}
                    {item.isEditing ? (
                      <div className="space-y-3 pt-1">
                        <textarea
                          rows={3}
                          value={item.draftText}
                          onChange={(e) => handleDraftChange(index, e.target.value)}
                          className="w-full p-3 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                          placeholder="Edit your tailored achievement bullet..."
                          autoFocus
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">
                            {item.draftText.length} characters • {item.draftText.trim().split(/\s+/).filter(Boolean).length} words
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCancelEdit(index)}
                              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handleSaveEdit(index)}
                              disabled={!item.draftText.trim()}
                            >
                              Save Bullet
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleStartEdit(index)}
                        className="group/text cursor-pointer rounded-xl p-1.5 -m-1.5 hover:bg-slate-800/40 transition"
                        title="Click to edit inline"
                      >
                        <p
                          className={`text-xs leading-relaxed font-medium transition ${
                            isAccepted
                              ? 'text-emerald-200'
                              : isEdited
                              ? 'text-amber-200'
                              : isRejected
                              ? 'text-slate-500 line-through'
                              : 'text-slate-100 group-hover/text:text-blue-300'
                          }`}
                        >
                          {item.currentText}
                        </p>
                      </div>
                    )}

                    {/* AI Optimization Reasoning Pill */}
                    {item.reasoning && (
                      <div className="pt-2 border-t border-slate-800/60 flex items-start gap-1.5 text-[11px] text-slate-400">
                        <span className="text-blue-400 font-bold shrink-0">💡 Strategy:</span>
                        <span className="italic leading-snug">{item.reasoning}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
