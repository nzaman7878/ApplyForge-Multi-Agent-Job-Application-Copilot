import React from 'react';

/**
 * StepIndicator Component
 *
 * Renders a responsive multi-step progress bar with:
 * - Completed checkmarks with emerald accent
 * - Active glowing pulse indicators
 * - Animated progress fill lines
 * - Step titles and supporting descriptions
 * - Optional interactive step clicking
 */
export default function StepIndicator({
  steps = [],
  currentStep = 1,
  completedSteps,
  onStepClick,
  className = '',
}) {
  if (!steps || steps.length === 0) return null;

  // Normalize step elements into objects
  const normalizedSteps = steps.map((step, index) => {
    const stepNumber = index + 1;
    if (typeof step === 'string') {
      return { id: stepNumber, label: step, description: '' };
    }
    return {
      id: step.id ?? stepNumber,
      label: step.label || `Step ${stepNumber}`,
      description: step.description || '',
      icon: step.icon,
    };
  });

  const totalSteps = normalizedSteps.length;

  // Helper to determine completion
  const isCompleted = (index, step) => {
    if (Array.isArray(completedSteps)) {
      return completedSteps.includes(step.id) || completedSteps.includes(index + 1);
    }
    return index + 1 < currentStep;
  };

  const isCurrent = (index, step) => {
    return step.id === currentStep || index + 1 === currentStep;
  };

  // Calculate overall progress percentage for the continuous progress bar
  const activeIndex = normalizedSteps.findIndex((s, i) => isCurrent(i, s));
  const effectiveActiveIndex = activeIndex >= 0 ? activeIndex : currentStep - 1;
  const progressPercent =
    totalSteps > 1
      ? Math.min(100, Math.max(0, (effectiveActiveIndex / (totalSteps - 1)) * 100))
      : 100;

  return (
    <nav aria-label="Wizard Steps" className={`w-full ${className}`}>
      {/* 1. Stepper Node & Connecting Line Track */}
      <div className="relative flex items-center justify-between">
        {/* Background Connecting Line */}
        <div
          className="absolute left-0 top-5 -translate-y-1/2 h-1 bg-slate-800 rounded-full z-0"
          style={{ width: '100%' }}
        />

        {/* Animated Progress Fill Line */}
        <div
          className="absolute left-0 top-5 -translate-y-1/2 h-1 bg-gradient-to-r from-blue-600 via-teal-400 to-emerald-400 rounded-full transition-all duration-500 ease-out z-0"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Step Nodes */}
        {normalizedSteps.map((step, index) => {
          const completed = isCompleted(index, step);
          const current = isCurrent(index, step);
          const isClickable = onStepClick && (completed || current);

          return (
            <div
              key={step.id}
              className={`relative z-10 flex flex-col items-center group ${
                isClickable ? 'cursor-pointer' : ''
              }`}
              onClick={() => isClickable && onStepClick(step.id ?? index + 1)}
            >
              {/* Node Circle */}
              <div
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-all duration-300 select-none ${
                  completed
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 scale-100'
                    : current
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-4 ring-blue-500/20 scale-105 border border-blue-400'
                      : 'bg-slate-900 text-slate-400 border border-slate-700/80 group-hover:border-slate-600'
                }`}
              >
                {completed ? (
                  /* Animated checkmark icon */
                  <svg
                    className="w-5 h-5 text-slate-950 transition-transform duration-300 scale-100"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.8}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{step.icon || index + 1}</span>
                )}

                {/* Subtle ping pulse ring on active current step */}
                {current && (
                  <span className="absolute -inset-1 rounded-xl bg-blue-400/20 animate-ping pointer-events-none" />
                )}
              </div>

              {/* Step Label & Subtitle */}
              <div className="mt-2.5 text-center min-w-[90px] max-w-[140px] px-1">
                <p
                  className={`text-xs font-semibold tracking-tight transition-colors duration-200 truncate ${
                    current
                      ? 'text-white font-bold'
                      : completed
                        ? 'text-slate-200'
                        : 'text-slate-400 group-hover:text-slate-300'
                  }`}
                  title={step.label}
                >
                  {step.label}
                </p>

                {step.description && (
                  <p
                    className={`text-[11px] truncate hidden sm:block mt-0.5 transition-colors duration-200 ${
                      current
                        ? 'text-blue-400 font-medium'
                        : completed
                          ? 'text-emerald-400/80'
                          : 'text-slate-500'
                    }`}
                    title={step.description}
                  >
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
