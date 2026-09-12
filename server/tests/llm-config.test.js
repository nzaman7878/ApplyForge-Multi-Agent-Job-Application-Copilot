const assert = require('assert');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { StateGraph, Annotation } = require('@langchain/langgraph');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const {
  createLLM,
  getLLM,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
} = require('../src/config/llm');

async function testLlmConfig() {
  console.log('🧪 Testing LangChain + LangGraph + Gemini Setup (Phase 51)...\n');

  // [Test 1] Verify Constants
  console.log('[Test 1] Verifying default LLM configuration constants...');
  assert.strictEqual(
    DEFAULT_MODEL,
    'gemini-2.5-flash',
    'Default model must be gemini-2.5-flash'
  );
  assert.strictEqual(
    DEFAULT_TEMPERATURE,
    0.7,
    'Default temperature must be 0.7'
  );
  console.log('  ✅ Defaults verified (gemini-2.5-flash, temperature 0.7)\n');

  // [Test 2] Error when API key is missing
  console.log('[Test 2] Verifying error when GEMINI_API_KEY is not provided...');
  const savedKey = process.env.GEMINI_API_KEY;
  const savedGoogleKey = process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  let threwWithoutKey = false;
  try {
    createLLM({ apiKey: '' });
  } catch (err) {
    threwWithoutKey = true;
    assert.ok(
      err.message.includes('GEMINI_API_KEY is not configured'),
      `Unexpected error message: ${err.message}`
    );
  }
  assert.strictEqual(
    threwWithoutKey,
    true,
    'createLLM must throw error when API key is missing'
  );
  console.log('  ✅ Throws descriptive error when GEMINI_API_KEY is missing\n');

  // [Test 3] Create LLM with test API key and default options
  console.log('[Test 3] Verifying LLM instantiation with default options...');
  const defaultClient = createLLM({ apiKey: 'mock-gemini-key' });
  assert.ok(
    defaultClient instanceof ChatGoogleGenerativeAI,
    'Should instantiate ChatGoogleGenerativeAI'
  );
  assert.strictEqual(
    defaultClient.model,
    'gemini-2.5-flash',
    'Model should default to gemini-2.5-flash'
  );
  assert.strictEqual(
    defaultClient.temperature,
    0.7,
    'Temperature should default to 0.7'
  );
  assert.strictEqual(
    defaultClient.apiKey,
    'mock-gemini-key',
    'API key should match provided key'
  );
  console.log('  ✅ ChatGoogleGenerativeAI instantiated with default model and temperature\n');

  // [Test 4] Create LLM with custom overrides
  console.log('[Test 4] Verifying LLM instantiation with custom overrides...');
  const customClient = createLLM({
    apiKey: 'custom-api-key',
    model: 'gemini-1.5-pro',
    temperature: 0.2,
  });
  assert.strictEqual(
    customClient.model,
    'gemini-1.5-pro',
    'Custom model override should be applied'
  );
  assert.strictEqual(
    customClient.temperature,
    0.2,
    'Custom temperature override should be applied'
  );
  assert.strictEqual(
    customClient.apiKey,
    'custom-api-key',
    'Custom apiKey should be applied'
  );
  console.log('  ✅ Custom model and temperature overrides applied successfully\n');

  // [Test 5] Read from environment variables
  console.log('[Test 5] Verifying environment variable resolution...');
  process.env.GEMINI_API_KEY = 'env-gemini-key-123';
  process.env.LLM_MODEL = 'gemini-2.5-flash';
  process.env.LLM_TEMPERATURE = '0.4';

  const envClient = createLLM();
  assert.strictEqual(
    envClient.apiKey,
    'env-gemini-key-123',
    'Should read apiKey from GEMINI_API_KEY env'
  );
  assert.strictEqual(
    envClient.model,
    'gemini-2.5-flash',
    'Should read model from LLM_MODEL env'
  );
  assert.strictEqual(
    envClient.temperature,
    0.4,
    'Should read temperature from LLM_TEMPERATURE env'
  );
  console.log('  ✅ Correctly resolved GEMINI_API_KEY, LLM_MODEL, and LLM_TEMPERATURE from env\n');

  // [Test 6] LangChain Core Messages
  console.log('[Test 6] Verifying LangChain Core message structures...');
  const systemMsg = new SystemMessage('You are ApplyForge Application Copilot.');
  const humanMsg = new HumanMessage('Analyze this resume against the JD.');
  assert.strictEqual(systemMsg.content, 'You are ApplyForge Application Copilot.');
  assert.strictEqual(humanMsg.content, 'Analyze this resume against the JD.');
  assert.strictEqual(systemMsg._getType(), 'system');
  assert.strictEqual(humanMsg._getType(), 'human');
  console.log('  ✅ SystemMessage and HumanMessage correctly instantiated\n');

  // [Test 7] LangGraph StateGraph setup
  console.log('[Test 7] Verifying LangGraph StateGraph initialization...');
  const AgentState = Annotation.Root({
    step: Annotation(),
    input: Annotation(),
    output: Annotation(),
  });

  const graphBuilder = new StateGraph(AgentState);
  graphBuilder.addNode('start_node', (state) => ({
    step: 'completed',
    output: `Processed: ${state.input}`,
  }));
  graphBuilder.addEdge('__start__', 'start_node');
  graphBuilder.addEdge('start_node', '__end__');

  const compiledGraph = graphBuilder.compile();
  assert.ok(compiledGraph, 'StateGraph should compile successfully');

  const graphResult = await compiledGraph.invoke({ input: 'Software Engineer Application' });
  assert.strictEqual(graphResult.step, 'completed');
  assert.strictEqual(graphResult.output, 'Processed: Software Engineer Application');
  console.log('  ✅ LangGraph StateGraph compiled and executed test node workflow\n');

  // Restore env
  if (savedKey) process.env.GEMINI_API_KEY = savedKey;
  else delete process.env.GEMINI_API_KEY;
  if (savedGoogleKey) process.env.GOOGLE_API_KEY = savedGoogleKey;
  else delete process.env.GOOGLE_API_KEY;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_TEMPERATURE;

  console.log('🎉 All LangChain + LangGraph + Gemini setup tests passed successfully!\n');
}

if (require.main === module) {
  testLlmConfig().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testLlmConfig };
