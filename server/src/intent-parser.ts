/**
 * Intent Parser - PROPERLY ARCHITECTED
 * 
 * Design Philosophy:
 * 1. MULTI-PASS: Normalize → Score → Extract → Validate
 * 2. INTENT SCORING: Each intent gets a score, highest wins
 * 3. CLEAR INDICATORS: Primary, secondary, and negative signals
 * 4. SEPARATION: Intent detection is separate from parameter extraction
 * 
 * Created: 2026-02-28 20:00:00 UTC
 * Phase: 5 - Chat-to-Generation Integration
 */

export type MediaIntent = 'generate-image' | 'generate-audio' | 'generate-video' | 'unknown';

export interface ParsedIntent {
  intent: MediaIntent;
  confidence: number;
  parameters: Record<string, any>;
  clarifyingQuestion?: string;
}

// ============================================================================
// PASS 1: INPUT NORMALIZATION
// ============================================================================

interface NormalizedInput {
  original: string;
  cleaned: string;
  lowercase: string;
  words: Set<string>;
  hasQuotes: boolean;
  quotedContent: string | null;
}

function normalizeInput(message: string): NormalizedInput {
  const cleaned = message.trim().replace(/\s+/g, ' ');
  const lowercase = cleaned.toLowerCase();
  const words = new Set(lowercase.split(/\s+/).filter(w => w.length > 0));
  
  // Extract quoted content
  const doubleQuoteMatch = cleaned.match(/"([^"]+)"/);
  const singleQuoteMatch = cleaned.match(/'([^']+)'/);
  const quotedContent = doubleQuoteMatch?.[1] || singleQuoteMatch?.[1] || null;
  
  return {
    original: message,
    cleaned,
    lowercase,
    words,
    hasQuotes: quotedContent !== null,
    quotedContent,
  };
}

// ============================================================================
// PASS 2: INTENT SCORING
// ============================================================================

interface IntentScore {
  intent: MediaIntent;
  score: number;
  indicators: string[];
}

/**
 * INDICATOR DEFINITIONS
 * 
 * Primary indicators: Strong signal that THIS is the intent (weight: 3)
 * Secondary indicators: Supporting signal (weight: 1)
 * Negative indicators: Reduces confidence (weight: -2)
 */

const IMAGE_INDICATORS = {
  // Primary: Strong verbs + image nouns
  primary: [
    // Verb + image noun patterns
    /\b(generate|create|make|produce|render)\s+(an?\s+)?(image|picture|photo|photograph)\b/,
    // Standalone image nouns with "of"
    /\b(image|picture|photo|photograph)\s+of\b/,
    // Drawing-specific verbs (these are exclusively image)
    /\b(draw|sketch|paint|illustrate|doodle)\b/,
    // Art nouns
    /\b(artwork|art\s+of|digital\s+art|illustration\s+of|painting\s+of)\b/,
    // Visual question form
    /\bwhat\s+does\s+.+\s+look\s+like\b/,
    /\bshow\s+me\s+what\s+.+\s+looks?\s+like\b/,
    // Visualize/render
    /\bvisualize\b/,
    /\brender\s+(an?\s+)?(image|picture|scene)\b/,
  ],
  // Secondary: Supporting indicators
  secondary: [
    /\bportrait\b/,
    /\blandscape\b/,
    /\bstyle\s+of\b/,
    /\bin\s+(the\s+)?style\b/,
    /\bdepict(ing)?\b/,
    /\billustrat(ed|ion)?\b/,
  ],
  // Negative: Things that suggest NOT image
  negative: [
    /\bvideo\b/,
    /\banimate(d|)?\b/,
    /\banimation\b/,
    /\bmotion\b/,
    /\bsay\b/,
    /\bspeak\b/,
    /\bread\s+(this|it|aloud|out)/,
    /\b(audio|voice|speech)\b/,
    /\btts\b/,
    /\btext\s+to\s+speech\b/,
  ],
};

const AUDIO_INDICATORS = {
  // Primary: Speech-specific verbs
  primary: [
    // Direct speech verbs (with or without quotes)
    /\b(say|speak|pronounce|utter)\s+["']?\w/,
    // Read with object
    /\bread\s+(this|it|the\s+\w+|aloud|out\s+loud)\b/,
    // TTS
    /\btext\s+to\s+speech\b/,
    /\btts\s+\w/,  // TTS followed by text
    // Audio generation
    /\b(generate|create|make|produce)\s+(an?\s+)?(audio|voice|speech)\b/,
    // Narration
    /\bnarrate\b/,
    // Voice synthesis
    /\bvoice\s+synthesis\b/,
    /\bspeech\s+synthesis\b/,
    // Want to hear
    /\b(want|would\s+like)\s+to\s+hear\b/,
  ],
  // Secondary: Supporting indicators
  secondary: [
    /\baudio\b/,
    /\bvoice\b/,
    /\bspeech\b/,
    /\bsound\b/,
    /\bout\s+loud\b/,
    /\baloud\b/,
    /\blisten\b/,
  ],
  // Negative: Things that suggest NOT audio
  negative: [
    /\bimage\b/,
    /\bpicture\b/,
    /\bphoto\b/,
    /\bdraw\b/,
    /\bpaint\b/,
    /\bsketch\b/,
    /\bvideo\b/,
    /\banimate\b/,
    /\banimation\b/,
  ],
};

const VIDEO_INDICATORS = {
  // Primary: Video-specific nouns/verbs
  primary: [
    // Video generation
    /\b(generate|create|make|produce)\s+(a\s+)?video\b/,
    /\bvideo\s+of\b/,
    // Animation
    /\banimate\s+\w/,  // Animate followed by something
    /\banimation\s+of\b/,
    /\banimated\s+(gif|video|clip)\b/,
    // GIF
    /\b(generate|create|make)\s+(a\s+)?gif\b/,
    /\bgif\s+of\b/,
    // Motion
    /\bmake\s+(it|this)\s+move\b/,
    /\bput\s+(it|this)?\s*in\s+motion\b/,
    /\bin\s+motion\b/,
    /\bmotion\s+(graphics|picture|video)\b/,
    // Footage/Clip
    /\bfootage\s+of\b/,
    /\b(video\s+)?clip\s+of\b/,
  ],
  // Secondary: Supporting indicators
  secondary: [
    /\bduration\b/,
    /\bfps\b/,
    /\bsecond(s)?\s+(long|video)\b/,
    /\bframes?\b/,
    /\bscene\b/,
  ],
  // Negative: Things that suggest NOT video
  negative: [
    /\bimage\b/,
    /\bpicture\b/,
    /\bphoto\b/,
    /\bsay\b/,
    /\bspeak\b/,
    /\bread\s+(this|it)/,
    /\b(audio|voice)\b/,
  ],
};

/**
 * Score an intent based on indicators
 */
function scoreIntent(input: NormalizedInput, indicators: typeof IMAGE_INDICATORS): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];
  
  // Check primary indicators (weight: 3)
  for (const pattern of indicators.primary) {
    if (pattern.test(input.lowercase)) {
      score += 3;
      signals.push(`primary: ${pattern.source.substring(0, 30)}...`);
    }
  }
  
  // Check secondary indicators (weight: 1)
  for (const pattern of indicators.secondary) {
    if (pattern.test(input.lowercase)) {
      score += 1;
      signals.push(`secondary: ${pattern.source.substring(0, 30)}...`);
    }
  }
  
  // Check negative indicators (weight: -2)
  for (const pattern of indicators.negative) {
    if (pattern.test(input.lowercase)) {
      score -= 2;
      signals.push(`negative: ${pattern.source.substring(0, 30)}...`);
    }
  }
  
  return { score, signals };
}

/**
 * Determine the most likely intent
 */
function determineIntent(input: NormalizedInput): IntentScore {
  const imageResult = scoreIntent(input, IMAGE_INDICATORS);
  const audioResult = scoreIntent(input, AUDIO_INDICATORS);
  const videoResult = scoreIntent(input, VIDEO_INDICATORS);
  
  const scores: IntentScore[] = [
    { intent: 'generate-image', score: imageResult.score, indicators: imageResult.signals },
    { intent: 'generate-audio', score: audioResult.score, indicators: audioResult.signals },
    { intent: 'generate-video', score: videoResult.score, indicators: videoResult.signals },
  ];
  
  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  
  // If top score is <= 0, return unknown
  if (scores[0].score <= 0) {
    return { intent: 'unknown', score: 0, indicators: [] };
  }
  
  return scores[0];
}

// ============================================================================
// PASS 3: PARAMETER EXTRACTION
// ============================================================================

/**
 * Extract prompt for image generation
 */
function extractImagePrompt(input: NormalizedInput): string {
  const text = input.cleaned;
  
  // Pattern priority order (most specific first)
  const patterns = [
    // "X of Y" - capture Y
    /\b(image|picture|photo|photograph|art|artwork|illustration|painting|sketch|portrait|landscape)\s+of\s+(.+?)(?:\s*(?:in\s+the\s+style|with|showing|please|$))/i,
    // "draw/sketch/paint/illustrate X"
    /\b(draw|sketch|paint|illustrate)\s+(?:me\s+)?(?:a\s+)?(.+?)(?:\s*(?:please|now|$))/i,
    // "generate/create/make X of Y"
    /\b(generate|create|make|produce|render)\s+(?:an?\s+)?(?:image|picture|photo)\s+(?:of|for|showing)\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "visualize X"
    /\bvisualize\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "what does X look like"
    /\bwhat\s+does\s+(.+?)\s+look\s+like/i,
    // "show me what X looks like"
    /\bshow\s+me\s+what\s+(.+?)\s+looks?\s+like/i,
    // "show me X"
    /\bshow\s+me\s+(?:an?\s+)?(?:image|picture)\s+(?:of\s+)?(.+?)(?:\s*(?:please|now|$))/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Get the last capture group (the prompt)
      const prompt = match[match.length - 1]?.trim();
      if (prompt && prompt.length > 0) {
        return cleanPrompt(prompt);
      }
    }
  }
  
  return '';
}

/**
 * Extract text for audio generation
 */
function extractAudioText(input: NormalizedInput): string {
  // If there's quoted content, use that
  if (input.quotedContent) {
    return input.quotedContent;
  }
  
  const text = input.cleaned;
  
  const patterns = [
    // "say/speak/pronounce X"
    /\b(say|speak|pronounce|utter)\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "read X"
    /\bread\s+(?:me\s+)?(.+?)(?:\s*(?:please|now|aloud|out\s+loud|$))/i,
    // "tts X" / "text to speech X"
    /\b(?:tts|text\s+to\s+speech)\s+(.+)/i,
    // "generate audio of X"
    /\b(generate|create|make)\s+(?:an?\s+)?(?:audio|voice|speech)\s+(?:of|for|saying)\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "narrate X"
    /\bnarrate\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "voice synthesis of X"
    /\b(?:voice|speech)\s+synthesis\s+(?:of\s+)?(.+?)(?:\s*(?:please|now|$))/i,
    // "want to hear X"
    /\b(?:want|would\s+like)\s+to\s+hear\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "convert to audio X"
    /\bconvert\s+(?:to\s+)?audio[:\s]+(.+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const textContent = match[match.length - 1]?.trim();
      if (textContent && textContent.length > 0) {
        return cleanPrompt(textContent);
      }
    }
  }
  
  return '';
}

/**
 * Extract prompt for video generation
 */
function extractVideoPrompt(input: NormalizedInput): string {
  const text = input.cleaned;
  
  const patterns = [
    // "video of X"
    /\bvideo\s+of\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "animation of X" / "animate X"
    /\banimation\s+of\s+(.+?)(?:\s*(?:please|now|$))/i,
    /\banimate\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "gif of X"
    /\bgif\s+of\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "generate/create video of X"
    /\b(generate|create|make|produce)\s+(?:a\s+)?(?:video|animation|gif)\s+(?:of|for|showing)\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "footage of X" / "clip of X"
    /\b(footage|clip)\s+of\s+(.+?)(?:\s*(?:please|now|$))/i,
    // "make X move"
    /\bmake\s+(.+?)\s+move/i,
    // "put X in motion"
    /\bput\s+(.+?)\s+in\s+motion/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const prompt = match[match.length - 1]?.trim();
      if (prompt && prompt.length > 0) {
        return cleanPrompt(prompt);
      }
    }
  }
  
  return '';
}

/**
 * Clean extracted prompt/text
 */
function cleanPrompt(text: string): string {
  return text
    .replace(/^["']|["']$/g, '')  // Remove surrounding quotes
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .trim();
}

// ============================================================================
// PASS 4: MAIN ENTRY POINT
// ============================================================================

/**
 * Parse a message to detect multimedia generation intent
 */
export function parseIntent(message: string): ParsedIntent {
  // PASS 1: Normalize
  const input = normalizeInput(message);
  
  // PASS 2: Score intents
  const intentResult = determineIntent(input);
  
  // If unknown, return early
  if (intentResult.intent === 'unknown') {
    return {
      intent: 'unknown',
      confidence: 0.5,
      parameters: {},
      clarifyingQuestion: "I'm not sure what you'd like me to do. Would you like me to generate an image, create audio, or make a video? For example, try 'generate an image of a sunset' or 'say hello world'.",
    };
  }
  
  // PASS 3: Extract parameters based on intent
  let parameters: Record<string, any> = {};
  
  switch (intentResult.intent) {
    case 'generate-image':
      const imagePrompt = extractImagePrompt(input);
      if (imagePrompt) {
        parameters = { prompt: imagePrompt };
      }
      break;
      
    case 'generate-audio':
      const audioText = extractAudioText(input);
      parameters = {
        text: audioText || '',
        voiceId: 'default',
      };
      break;
      
    case 'generate-video':
      const videoPrompt = extractVideoPrompt(input);
      if (videoPrompt) {
        parameters = { prompt: videoPrompt };
      }
      // Extract optional duration
      const durationMatch = input.lowercase.match(/(\d+)\s*seconds?/);
      if (durationMatch) {
        parameters.duration = parseInt(durationMatch[1], 10);
      }
      break;
  }
  
  // Calculate confidence based on score
  // Score >= 3 = high confidence (0.95) - at least one primary indicator matched
  // Score 1-2 = medium confidence (0.85) - only secondary indicators
  // Score <= 0 = unknown (handled above)
  let confidence: number;
  if (intentResult.score >= 3) {
    confidence = 0.95;
  } else {
    confidence = 0.85;
  }
  
  return {
    intent: intentResult.intent,
    confidence,
    parameters,
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Check if a message contains any multimedia generation keywords
 */
export function hasMediaIntent(message: string): boolean {
  const result = parseIntent(message);
  return result.intent !== 'unknown';
}

/**
 * Get a list of all supported intent types
 */
export function getSupportedIntents(): MediaIntent[] {
  return ['generate-image', 'generate-audio', 'generate-video'];
}

/**
 * Debug: Get scoring details for a message
 */
export function debugIntent(message: string): { input: NormalizedInput; scores: Record<string, { score: number; signals: string[] }> } {
  const input = normalizeInput(message);
  const imageResult = scoreIntent(input, IMAGE_INDICATORS);
  const audioResult = scoreIntent(input, AUDIO_INDICATORS);
  const videoResult = scoreIntent(input, VIDEO_INDICATORS);
  
  return {
    input,
    scores: {
      'generate-image': { score: imageResult.score, signals: imageResult.signals },
      'generate-audio': { score: audioResult.score, signals: audioResult.signals },
      'generate-video': { score: videoResult.score, signals: videoResult.signals },
    },
  };
}
