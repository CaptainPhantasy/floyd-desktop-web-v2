/**
 * Floyd Desktop - Model Registry
 * 
 * Centralized registry for all AI models across providers.
 * Supports language, vision, image generation, video generation, and audio generation.
 */

export type ModelType = 
  | 'language' 
  | 'vision' 
  | 'image-generation' 
  | 'video-generation' 
  | 'audio-generation' 
  | 'speech-to-text';

export type ModelProvider = 'openai' | 'zai' | 'elevenlabs' | 'anthropic';

export interface ModelCapability {
  id: string;
  name: string;
  provider: ModelProvider;
  type: ModelType;
  endpoint: string;
  maxTokens?: number;
  supportedFormats?: string[];
  pricing?: {
    perRequest?: number;
    perToken?: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Complete registry of all multimedia-capable models
 */
export const MULTIMEDIA_MODEL_REGISTRY: ModelCapability[] = [
  // ============ Language Models (Existing) ============
  {
    id: 'glm-4.6v',
    name: 'GLM-4.6v Vision',
    provider: 'zai',
    type: 'vision',
    endpoint: '/api/paas/v4',
    maxTokens: 16384,
    metadata: { supportsVision: true }
  },
  {
    id: 'glm-5',
    name: 'GLM-5',
    provider: 'zai',
    type: 'language',
    endpoint: '/api/paas/v4',
    maxTokens: 16384,
  },
  {
    id: 'glm-4-plus',
    name: 'GLM-4 Plus',
    provider: 'zai',
    type: 'language',
    endpoint: '/api/paas/v4',
    maxTokens: 128000,
  },
  {
    id: 'glm-4-0520',
    name: 'GLM-4-0520',
    provider: 'zai',
    type: 'language',
    endpoint: '/api/paas/v4',
    maxTokens: 128000,
  },
  {
    id: 'glm-4-air',
    name: 'GLM-4 Air',
    provider: 'zai',
    type: 'language',
    endpoint: '/api/paas/v4',
    maxTokens: 8192,
  },

  // ============ Image Generation (OpenAI) ============
  {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    provider: 'openai',
    type: 'image-generation',
    endpoint: 'https://api.openai.com/v1/images/generations',
    supportedFormats: ['png', 'webp', 'jpeg'],
    pricing: { perRequest: 0.04 },
    metadata: {
      sizes: ['1024x1024', '1024x1536', '1536x1024'],
      qualities: ['standard', 'hd'],
      styles: ['vivid', 'natural']
    }
  },
  {
    id: 'dall-e-2',
    name: 'DALL-E 2',
    provider: 'openai',
    type: 'image-generation',
    endpoint: 'https://api.openai.com/v1/images/generations',
    supportedFormats: ['png', 'webp', 'jpeg'],
    pricing: { perRequest: 0.02 },
    metadata: {
      sizes: ['256x256', '512x512', '1024x1024']
    }
  },

  // ============ Video Generation (Zai CogVideoX) ============
  {
    id: 'cogvideox-3',
    name: 'CogVideoX-3',
    provider: 'zai',
    type: 'video-generation',
    endpoint: 'https://api.z.ai/api/paas/v4/videos/generations',
    supportedFormats: ['mp4'],
    pricing: { perRequest: 0.20 },
    metadata: {
      asyncPolling: true,
      pollEndpoint: 'https://api.z.ai/api/paas/v4/async-result',
      sizes: ['1280x720', '720x1280', '1024x1024', '1920x1080', '1080x1920', '2048x1080', '3840x2160'],
      fps: [30, 60],
      durations: [5, 10],
      estimatedTime: { speed: 30000, quality: 90000 }
    }
  },

  // ============ Audio Generation (ElevenLabs) ============
  {
    id: 'eleven_turbo_v2',
    name: 'Eleven Turbo v2',
    provider: 'elevenlabs',
    type: 'audio-generation',
    endpoint: 'https://api.elevenlabs.io/v1/text-to-speech',
    supportedFormats: ['mp3', 'wav', 'pcm'],
    metadata: {
      fast: true,
      languages: ['en']
    }
  },
  {
    id: 'eleven_multilingual_v2',
    name: 'Eleven Multilingual v2',
    provider: 'elevenlabs',
    type: 'audio-generation',
    endpoint: 'https://api.elevenlabs.io/v1/text-to-speech',
    supportedFormats: ['mp3', 'wav', 'pcm'],
    metadata: {
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hu', 'ko', 'hi']
    }
  },

  // ============ Speech-to-Text (Future) ============
  // Placeholder for future speech recognition models
];

/**
 * Get a model by its unique ID
 */
export function getModelById(id: string): ModelCapability | undefined {
  return MULTIMEDIA_MODEL_REGISTRY.find(m => m.id === id);
}

/**
 * Get all models of a specific type
 */
export function getModelsByType(type: ModelType): ModelCapability[] {
  return MULTIMEDIA_MODEL_REGISTRY.filter(m => m.type === type);
}

/**
 * Get all models from a specific provider
 */
export function getModelsByProvider(provider: ModelProvider): ModelCapability[] {
  return MULTIMEDIA_MODEL_REGISTRY.filter(m => m.provider === provider);
}

/**
 * Get all models that support a specific format
 */
export function getModelsByFormat(format: string): ModelCapability[] {
  return MULTIMEDIA_MODEL_REGISTRY.filter(m => 
    m.supportedFormats?.includes(format.toLowerCase())
  );
}

/**
 * Check if a model supports async operations (polling required)
 */
export function isAsyncModel(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.metadata?.asyncPolling === true;
}

/**
 * Get the polling endpoint for async models
 */
export function getPollEndpoint(modelId: string): string | undefined {
  const model = getModelById(modelId);
  return model?.metadata?.pollEndpoint;
}

/**
 * Get estimated generation time for a model (in ms)
 */
export function getEstimatedTime(modelId: string, quality: 'speed' | 'quality' = 'speed'): number {
  const model = getModelById(modelId);
  if (model?.metadata?.estimatedTime) {
    return model.metadata.estimatedTime[quality] || 30000;
  }
  return 30000; // Default 30 seconds
}

/**
 * Get default model for a specific type
 */
export function getDefaultModel(type: ModelType): ModelCapability | undefined {
  const defaults: Record<ModelType, string> = {
    'language': 'glm-5',
    'vision': 'glm-4.6v',
    'image-generation': 'dall-e-3',
    'video-generation': 'cogvideox-3',
    'audio-generation': 'eleven_multilingual_v2',
    'speech-to-text': 'glm-4.6v' // Fallback to vision for now
  };
  
  return getModelById(defaults[type]);
}

/**
 * Get all unique providers in the registry
 */
export function getAllProviders(): ModelProvider[] {
  const providers = new Set<ModelProvider>();
  MULTIMEDIA_MODEL_REGISTRY.forEach(m => providers.add(m.provider));
  return Array.from(providers);
}

/**
 * Get models grouped by type for UI display
 */
export function getModelsGroupedByType(): Record<ModelType, ModelCapability[]> {
  const grouped: Record<ModelType, ModelCapability[]> = {
    'language': [],
    'vision': [],
    'image-generation': [],
    'video-generation': [],
    'audio-generation': [],
    'speech-to-text': []
  };
  
  MULTIMEDIA_MODEL_REGISTRY.forEach(model => {
    grouped[model.type].push(model);
  });
  
  return grouped;
}
