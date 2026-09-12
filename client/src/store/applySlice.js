import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Current wizard step (1: Source Inputs, 2: Agent Pipeline, 3: Review & Export)
  currentStep: 1,

  // Selected candidate resume
  selectedResumeId: null,
  selectedResume: null,

  // Selected target job description
  selectedJdId: null,
  selectedJd: null,

  // Multi-agent pipeline outputs and state
  agentOutputs: {
    status: 'idle', // 'idle' | 'running' | 'completed' | 'failed'
    error: null,
    gapAnalysis: null,
    tailoredResume: null,
    coverLetter: null,
    outreachMessage: null,
    lastRunAt: null,
  },
};

export const applySlice = createSlice({
  name: 'apply',
  initialState,
  reducers: {
    setCurrentStep: (state, action) => {
      const step = Number(action.payload);
      if (step >= 1 && step <= 3) {
        state.currentStep = step;
      }
    },
    nextStep: (state) => {
      if (state.currentStep < 3) {
        state.currentStep += 1;
      }
    },
    prevStep: (state) => {
      if (state.currentStep > 1) {
        state.currentStep -= 1;
      }
    },
    setSelectedResume: (state, action) => {
      state.selectedResume = action.payload;
      state.selectedResumeId = action.payload ? action.payload.id || action.payload._id : null;
    },
    clearSelectedResume: (state) => {
      state.selectedResume = null;
      state.selectedResumeId = null;
    },
    setSelectedJd: (state, action) => {
      state.selectedJd = action.payload;
      state.selectedJdId = action.payload ? action.payload.id || action.payload._id : null;
    },
    clearSelectedJd: (state) => {
      state.selectedJd = null;
      state.selectedJdId = null;
    },
    setAgentStatus: (state, action) => {
      state.agentOutputs.status = action.payload;
    },
    setAgentOutputs: (state, action) => {
      state.agentOutputs = {
        ...state.agentOutputs,
        ...action.payload,
        lastRunAt: new Date().toISOString(),
      };
    },
    setGapAnalysis: (state, action) => {
      state.agentOutputs.gapAnalysis = action.payload;
    },
    setTailoredResume: (state, action) => {
      state.agentOutputs.tailoredResume = action.payload;
    },
    setCoverLetter: (state, action) => {
      state.agentOutputs.coverLetter = action.payload;
    },
    setOutreachMessage: (state, action) => {
      state.agentOutputs.outreachMessage = action.payload;
    },
    setAgentError: (state, action) => {
      state.agentOutputs.status = 'failed';
      state.agentOutputs.error = action.payload;
    },
    resetWizard: () => initialState,
  },
});

export const {
  setCurrentStep,
  nextStep,
  prevStep,
  setSelectedResume,
  clearSelectedResume,
  setSelectedJd,
  clearSelectedJd,
  setAgentStatus,
  setAgentOutputs,
  setGapAnalysis,
  setTailoredResume,
  setCoverLetter,
  setOutreachMessage,
  setAgentError,
  resetWizard,
} = applySlice.actions;

// Selectors
export const selectCurrentStep = (state) => state.apply.currentStep;
export const selectSelectedResume = (state) => state.apply.selectedResume;
export const selectSelectedResumeId = (state) => state.apply.selectedResumeId;
export const selectSelectedJd = (state) => state.apply.selectedJd;
export const selectSelectedJdId = (state) => state.apply.selectedJdId;
export const selectAgentOutputs = (state) => state.apply.agentOutputs;
export const selectAgentStatus = (state) => state.apply.agentOutputs.status;
export const selectIsStep1Ready = (state) =>
  Boolean(state.apply.selectedResumeId && state.apply.selectedJdId);

export default applySlice.reducer;
