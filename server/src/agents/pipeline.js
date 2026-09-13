const { StateGraph, START, END } = require('@langchain/langgraph');
const { AgentState } = require('./state');
const { parserNode } = require('./nodes/parserNode');
const { resumeTailoringNode } = require('./nodes/resumeTailoringNode');
const { atsKeywordNode } = require('./nodes/atsKeywordNode');
const { coverLetterNode } = require('./nodes/coverLetterNode');
const { fitScoringNode } = require('./nodes/fitScoringNode');

/**
 * Standard identifier constants for pipeline graph nodes.
 */
const PIPELINE_NODES = {
  PARSER: 'parser',
  RESUME_TAILORING: 'resume_tailoring',
  ATS: 'ats',
  COVER_LETTER: 'cover_letter',
  FIT_SCORING: 'fit_scoring',
  HUMAN_INTERRUPT: '__human_interrupt__',
  SAVE: 'save',
  // PascalCase aliases
  Parser: 'parser',
  ResumeTailoring: 'resume_tailoring',
  ATSNode: 'ats',
  CoverLetter: 'cover_letter',
  FitScoring: 'fit_scoring',
};

/**
 * Human interrupt checkpoint node.
 * Sets pipeline status indicating whether review has been approved or is awaiting user action.
 *
 * @param {Object} state - Current AgentState
 * @returns {Object} State delta
 */
async function humanInterruptNode(state) {
  return {
    status: state.humanApproved ? 'review_approved' : 'awaiting_human_review',
  };
}

/**
 * Save node representing final persistence or approval of the tailored application.
 *
 * @param {Object} state - Current AgentState
 * @param {Function} [onSave] - Optional external persistence callback
 * @returns {Promise<Object>} State delta with saved status
 */
async function saveNode(state, onSave) {
  if (typeof onSave === 'function') {
    try {
      await onSave(state);
    } catch (err) {
      return {
        status: 'save_failed',
        error: err.message,
      };
    }
  }

  return {
    status: 'saved',
  };
}

/**
 * Conditional router evaluating human approval.
 * If humanApproved is true, proceeds to save.
 * If humanApproved is false, loops back to resume_tailoring with user edits.
 *
 * @param {Object} state - Current AgentState
 * @returns {'save' | 'loop_back'} Target edge key
 */
function shouldContinueAfterHumanReview(state) {
  if (state && state.humanApproved === true) {
    return 'save';
  }
  return 'loop_back';
}

/**
 * Builds the uncompiled StateGraph representing the multi-agent application copilot pipeline.
 *
 * Topology:
 * START → Parser → [ResumeTailoring ∥ ATS] → CoverLetter → FitScoring → __human_interrupt__
 * __human_interrupt__ → (conditional: if humanApproved → save → END, else → loop back to ResumeTailoring with edits)
 *
 * @param {Object} [options={}] - Configuration options and node overrides
 * @returns {StateGraph} Configured LangGraph StateGraph instance
 */
function buildApplicationGraph(options = {}) {
  const workflow = new StateGraph(AgentState);

  const nodeOptions = {
    llm: options.llm,
    allowFallback: options.allowFallback !== false,
    ...options.nodeOptions,
  };

  // 1. Register Graph Nodes
  workflow.addNode(PIPELINE_NODES.PARSER, (state) => parserNode(state));

  // Parallel agent branches: ResumeTailoring and ATS Keyword Node
  workflow.addNode(PIPELINE_NODES.RESUME_TAILORING, (state) =>
    resumeTailoringNode(state, nodeOptions)
  );
  workflow.addNode(PIPELINE_NODES.ATS, (state) =>
    atsKeywordNode(state, nodeOptions)
  );

  // Downstream synthesis nodes
  workflow.addNode(PIPELINE_NODES.COVER_LETTER, (state) =>
    coverLetterNode(state, nodeOptions)
  );
  workflow.addNode(PIPELINE_NODES.FIT_SCORING, (state) =>
    fitScoringNode(state, nodeOptions)
  );

  // Human-in-the-loop checkpoint & save nodes
  workflow.addNode(PIPELINE_NODES.HUMAN_INTERRUPT, (state) =>
    humanInterruptNode(state)
  );
  workflow.addNode(PIPELINE_NODES.SAVE, (state) =>
    saveNode(state, options.onSave)
  );

  // 2. Wire Graph Edges
  // START → Parser
  workflow.addEdge(START, PIPELINE_NODES.PARSER);

  // Parser → [ResumeTailoring ∥ ATS] (Parallel fan-out)
  workflow.addEdge(PIPELINE_NODES.PARSER, PIPELINE_NODES.RESUME_TAILORING);
  workflow.addEdge(PIPELINE_NODES.PARSER, PIPELINE_NODES.ATS);

  // [ResumeTailoring ∥ ATS] → CoverLetter (Fan-in join)
  workflow.addEdge(PIPELINE_NODES.RESUME_TAILORING, PIPELINE_NODES.COVER_LETTER);
  workflow.addEdge(PIPELINE_NODES.ATS, PIPELINE_NODES.COVER_LETTER);

  // CoverLetter → FitScoring
  workflow.addEdge(PIPELINE_NODES.COVER_LETTER, PIPELINE_NODES.FIT_SCORING);

  // FitScoring → __human_interrupt__
  workflow.addEdge(PIPELINE_NODES.FIT_SCORING, PIPELINE_NODES.HUMAN_INTERRUPT);

  // 3. Conditional Edge: if humanApproved → save, else → loop back to ResumeTailoring with edits
  workflow.addConditionalEdges(
    PIPELINE_NODES.HUMAN_INTERRUPT,
    shouldContinueAfterHumanReview,
    {
      save: PIPELINE_NODES.SAVE,
      loop_back: PIPELINE_NODES.RESUME_TAILORING,
    }
  );

  // Save → END
  workflow.addEdge(PIPELINE_NODES.SAVE, END);

  return workflow;
}

/**
 * Creates and compiles the complete LangGraph pipeline.
 * By default configures interruptBefore on '__human_interrupt__' to enable
 * Human-in-the-Loop review before finalization.
 *
 * @param {Object} [options={}] - Pipeline options (checkpointer, interruptBefore, nodeOptions, etc.)
 * @returns {Object} Compiled LangGraph Runnable Application
 */
function createApplicationPipeline(options = {}) {
  const workflow = buildApplicationGraph(options);

  const compileOptions = {
    interruptBefore:
      options.interruptBefore !== undefined
        ? options.interruptBefore
        : [PIPELINE_NODES.HUMAN_INTERRUPT],
    checkpointer: options.checkpointer,
    ...options.compileOptions,
  };

  return workflow.compile(compileOptions);
}

// Pre-compiled default pipeline instance
const defaultApplicationPipeline = createApplicationPipeline();

module.exports = {
  PIPELINE_NODES,
  buildApplicationGraph,
  createApplicationPipeline,
  humanInterruptNode,
  saveNode,
  shouldContinueAfterHumanReview,
  defaultApplicationPipeline,
  pipeline: defaultApplicationPipeline,
};
