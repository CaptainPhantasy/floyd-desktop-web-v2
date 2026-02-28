/**
 * Intent Parser Test Suite - SPECIFICATION FIRST
 * 
 * These tests define the EXPECTED BEHAVIOR of the parser.
 * The parser implementation must satisfy ALL tests, not just pass individual cases.
 * 
 * Testing Philosophy:
 * 1. Test by INTENT CATEGORY, not by phrasing
 * 2. Test BOUNDARIES (what IS and ISN'T each intent)
 * 3. Test EDGE CASES systematically
 * 4. Test AMBIGUOUS inputs
 * 5. Test MALFORMED inputs
 */

import { parseIntent, MediaIntent, ParsedIntent } from './intent-parser.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestCase {
  input: string;
  expectedIntent: MediaIntent;
  expectedParamKey?: 'prompt' | 'text';
  expectedParamContains?: string;
  description: string;
}

interface TestResult {
  passed: boolean;
  input: string;
  expected: MediaIntent;
  actual: MediaIntent;
  reason?: string;
}

function runTest(tc: TestCase): TestResult {
  const result = parseIntent(tc.input);
  
  if (result.intent !== tc.expectedIntent) {
    return {
      passed: false,
      input: tc.input,
      expected: tc.expectedIntent,
      actual: result.intent,
      reason: `Wrong intent: expected ${tc.expectedIntent}, got ${result.intent}`,
    };
  }
  
  if (tc.expectedParamKey && tc.expectedParamContains) {
    const paramValue = result.parameters[tc.expectedParamKey];
    if (!paramValue || !paramValue.toLowerCase().includes(tc.expectedParamContains.toLowerCase())) {
      return {
        passed: false,
        input: tc.input,
        expected: tc.expectedIntent,
        actual: result.intent,
        reason: `Parameter mismatch: expected ${tc.expectedParamKey} to contain "${tc.expectedParamContains}", got "${paramValue}"`,
      };
    }
  }
  
  return {
    passed: true,
    input: tc.input,
    expected: tc.expectedIntent,
    actual: result.intent,
  };
}

function runTestSuite(suiteName: string, tests: TestCase[]): { passed: number; failed: number; results: TestResult[] } {
  const results = tests.map(runTest);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUITE: ${suiteName}`);
  console.log(`${'='.repeat(60)}`);
  
  results.forEach((r, i) => {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} [${r.actual.padEnd(15)}] "${tests[i].input.substring(0, 50)}"`);
    if (!r.passed && r.reason) {
      console.log(`   ${r.reason}`);
    }
  });
  
  console.log(`\nResults: ${passed}/${tests.length} passed (${Math.round(passed/tests.length*100)}%)`);
  
  return { passed, failed, results };
}

// ============================================================================
// TEST SUITES - THE SPECIFICATION
// ============================================================================

// SUITE 1: Image Intent - Core Detection
// These MUST be detected as image requests regardless of phrasing
const IMAGE_CORE_TESTS: TestCase[] = [
  // Primary verbs + image noun
  { input: 'generate an image of a cat', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'Primary verb + image' },
  { input: 'create an image of a sunset', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'sunset', description: 'Primary verb + image' },
  { input: 'make an image of mountains', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'mountains', description: 'Primary verb + image' },
  { input: 'draw an image of a dragon', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'dragon', description: 'Primary verb + image' },
  
  // Primary verbs + picture noun
  { input: 'generate a picture of a dog', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'dog', description: 'Primary verb + picture' },
  { input: 'create a picture of space', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'space', description: 'Primary verb + picture' },
  
  // Standalone nouns with "of"
  { input: 'image of a red car', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'red car', description: 'Standalone image of' },
  { input: 'picture of a flower', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'flower', description: 'Standalone picture of' },
  { input: 'photo of the ocean', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'ocean', description: 'Standalone photo of' },
  
  // Drawing-specific verbs
  { input: 'draw a cat', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'Draw verb' },
  { input: 'draw me a dragon', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'dragon', description: 'Draw me' },
  { input: 'sketch a portrait', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'portrait', description: 'Sketch verb' },
  { input: 'paint a landscape', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'landscape', description: 'Paint verb' },
  { input: 'illustrate a scene', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'scene', description: 'Illustrate verb' },
  
  // Art-specific nouns
  { input: 'create art of a robot', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'robot', description: 'Art noun' },
  { input: 'digital art of a cyberpunk city', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cyberpunk city', description: 'Digital art' },
  { input: 'artwork of a phoenix', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'phoenix', description: 'Artwork noun' },
  
  // Question forms
  { input: 'what does a unicorn look like', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'unicorn', description: 'Question form' },
  { input: 'show me what a star looks like', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'star', description: 'Show me question' },
];

// SUITE 2: Audio Intent - Core Detection
const AUDIO_CORE_TESTS: TestCase[] = [
  // Speech verbs
  { input: 'say hello world', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'hello', description: 'Say verb' },
  { input: 'speak the word hello', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'hello', description: 'Speak verb' },
  { input: 'pronounce entrepreneur', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'entrepreneur', description: 'Pronounce verb' },
  
  // Read verbs
  { input: 'read this text', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'text', description: 'Read verb' },
  { input: 'read aloud', expectedIntent: 'generate-audio', description: 'Read aloud' },
  { input: 'read out loud', expectedIntent: 'generate-audio', description: 'Read out loud' },
  
  // TTS specific
  { input: 'text to speech hello', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'hello', description: 'TTS' },
  { input: 'tts hello world', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'hello', description: 'TTS abbreviation' },
  
  // Audio generation
  { input: 'generate audio of hello', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'hello', description: 'Generate audio' },
  { input: 'create speech saying hi', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'hi', description: 'Create speech' },
  
  // Listening requests
  { input: 'I want to hear hello', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'hello', description: 'Want to hear' },
];

// SUITE 3: Video Intent - Core Detection
const VIDEO_CORE_TESTS: TestCase[] = [
  // Video verbs + noun
  { input: 'generate a video of a car', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'car', description: 'Generate video' },
  { input: 'create a video of waves', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'waves', description: 'Create video' },
  { input: 'make a video of rain', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'rain', description: 'Make video' },
  
  // Standalone video noun
  { input: 'video of a flying bird', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'bird', description: 'Standalone video' },
  
  // Animation specific
  { input: 'animate a ball', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'ball', description: 'Animate verb' },
  { input: 'animation of a robot', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'robot', description: 'Animation noun' },
  { input: 'create an animation of fire', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'fire', description: 'Create animation' },
  
  // GIF specific
  { input: 'gif of a cat jumping', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'Gif noun' },
  { input: 'create a gif of dancing', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'dancing', description: 'Create gif' },
  
  // Motion specific
  { input: 'make it move', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'it', description: 'Make move' },
  { input: 'put in motion', expectedIntent: 'generate-video', description: 'Put in motion' },
  
  // Footage/Clip
  { input: 'footage of a storm', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'storm', description: 'Footage noun' },
  { input: 'clip of a sunset', expectedIntent: 'generate-video', expectedParamKey: 'prompt', expectedParamContains: 'sunset', description: 'Clip noun' },
];

// SUITE 4: Unknown Intent - Must NOT trigger false positives
const UNKNOWN_TESTS: TestCase[] = [
  // Greetings (should NOT be audio just because they're short)
  { input: 'hello', expectedIntent: 'unknown', description: 'Greeting' },
  { input: 'hi', expectedIntent: 'unknown', description: 'Greeting' },
  { input: 'hey', expectedIntent: 'unknown', description: 'Greeting' },
  { input: 'good morning', expectedIntent: 'unknown', description: 'Greeting' },
  
  // Questions (should NOT trigger "what does X look like" pattern)
  { input: 'how are you', expectedIntent: 'unknown', description: 'Question' },
  { input: 'what is the weather', expectedIntent: 'unknown', description: 'Question' },
  { input: 'tell me about yourself', expectedIntent: 'unknown', description: 'Question - NOT audio' },
  { input: 'help me with homework', expectedIntent: 'unknown', description: 'Request' },
  
  // Statements that contain ambiguous words
  { input: 'I like images', expectedIntent: 'unknown', description: 'Statement about images' },
  { input: 'videos are cool', expectedIntent: 'unknown', description: 'Statement about videos' },
  { input: 'the image was generated yesterday', expectedIntent: 'unknown', description: 'Past tense statement' },
];

// SUITE 5: Edge Cases - Robustness tests
const EDGE_CASE_TESTS: TestCase[] = [
  // Punctuation
  { input: 'generate an image of a cat!', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'With exclamation' },
  { input: 'generate an image of a cat?', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'With question mark' },
  { input: 'generate an image of a cat.', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'With period' },
  
  // Case variations
  { input: 'GENERATE AN IMAGE OF A CAT', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'All caps' },
  { input: 'Generate An Image Of A Cat', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'Title case' },
  { input: 'gEnErAtE aN iMaGe Of A cAt', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'Mixed case' },
  
  // Extra whitespace
  { input: '  generate   an   image   of   a   cat  ', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'Extra whitespace' },
  
  // Quotes
  { input: 'say "hello world"', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'hello', description: 'Quoted text' },
  { input: "say 'hello world'", expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'hello', description: 'Single quotes' },
  
  // Complex prompts
  { input: 'generate an image of a futuristic cyberpunk city with neon lights and flying cars', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'futuristic', description: 'Complex prompt' },
  
  // With modifiers
  { input: 'please generate an image of a cat', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'cat', description: 'With please' },
  { input: 'can you create an image of a dog', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'dog', description: 'With can you' },
];

// SUITE 6: Boundary Tests - Ensure intents don't bleed into each other
const BOUNDARY_TESTS: TestCase[] = [
  // "video of" should NOT trigger "image of"
  { input: 'image of a video', expectedIntent: 'generate-image', expectedParamKey: 'prompt', expectedParamContains: 'video', description: 'Image containing video word' },
  
  // "say" should NOT trigger image
  { input: 'say the word image', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'image', description: 'Audio containing image word' },
  
  // These should clearly be their respective types
  { input: 'create an image', expectedIntent: 'generate-image', description: 'Just create an image' },
  { input: 'create a video', expectedIntent: 'generate-video', description: 'Just create a video' },
  { input: 'say something', expectedIntent: 'generate-audio', expectedParamKey: 'text', expectedParamContains: 'something', description: 'Just say something' },
];

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export function runAllTests(): { totalPassed: number; totalFailed: number; summary: string } {
  console.log('\n' + '='.repeat(60));
  console.log('INTENT PARSER TEST SUITE');
  console.log('='.repeat(60));
  
  const suites = [
    { name: 'IMAGE CORE DETECTION', tests: IMAGE_CORE_TESTS },
    { name: 'AUDIO CORE DETECTION', tests: AUDIO_CORE_TESTS },
    { name: 'VIDEO CORE DETECTION', tests: VIDEO_CORE_TESTS },
    { name: 'UNKNOWN (NO FALSE POSITIVES)', tests: UNKNOWN_TESTS },
    { name: 'EDGE CASES', tests: EDGE_CASE_TESTS },
    { name: 'BOUNDARY TESTS', tests: BOUNDARY_TESTS },
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  const failedSuites: string[] = [];
  
  for (const suite of suites) {
    const result = runTestSuite(suite.name, suite.tests);
    totalPassed += result.passed;
    totalFailed += result.failed;
    if (result.failed > 0) {
      failedSuites.push(suite.name);
    }
  }
  
  const total = totalPassed + totalFailed;
  const summary = `\n${'='.repeat(60)}
FINAL SUMMARY: ${totalPassed}/${total} tests passed (${Math.round(totalPassed/total*100)}%)
${totalFailed > 0 ? `FAILED SUITES: ${failedSuites.join(', ')}` : 'ALL SUITES PASSED!'}
${'='.repeat(60)}`;
  
  console.log(summary);
  
  return { totalPassed, totalFailed, summary };
}

// Export for running
export const ALL_TESTS = [
  ...IMAGE_CORE_TESTS,
  ...AUDIO_CORE_TESTS,
  ...VIDEO_CORE_TESTS,
  ...UNKNOWN_TESTS,
  ...EDGE_CASE_TESTS,
  ...BOUNDARY_TESTS,
];
