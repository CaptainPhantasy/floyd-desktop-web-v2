/**
 * Floyd Desktop - Provider Router
 * 
 * Routes multimedia generation requests to optimal models based on
 * requirements (format, quality, cost optimization).
 * 
 * Created: 2026-02-28 13:24:00 UTC
 */

import { ModelCapability, ModelType, getModelById, getModelsByType } from './model-registry.js';

export interface RoutingRequirements {
  format?: string;
  quality?: 'fast' | 'balanced' | 'high';
  costOptimized?: boolean;
}

export class ProviderRouter {
  private defaultModels: Map<ModelType, string> = new Map([
    ['image-generation', 'dall-e-3'],
    ['video-generation', 'cogvideox-3'],
    ['audio-generation', 'eleven_multilingual_v2'],
    ['vision', 'glm-4.6v'],
    ['language', 'glm-5'],
  ]);

  selectOptimalModel(
    taskType: ModelType,
    requirements?: RoutingRequirements
  ): ModelCapability {
    const candidates = getModelsByType(taskType);
    
    if (candidates.length === 0) {
      throw new Error(`No models available for type: ${taskType}`);
    }

    let filtered = candidates;
    if (requirements?.format) {
      filtered = candidates.filter(m => 
        m.supportedFormats?.includes(requirements.format!)
      );
      if (filtered.length === 0) filtered = candidates;
    }

    if (requirements?.quality === 'high') {
      return filtered.sort((a, b) => (b.maxTokens || 0) - (a.maxTokens || 0))[0];
    }
    
    if (requirements?.quality === 'fast') {
      return filtered.sort((a, b) => 
        (a.pricing?.perRequest || 0) - (b.pricing?.perRequest || 0)
      )[0];
    }

    const defaultId = this.defaultModels.get(taskType);
    if (defaultId) {
      const defaultModel = getModelById(defaultId);
      if (defaultModel) return defaultModel;
    }

    return filtered[0];
  }

  setDefaultModel(type: ModelType, modelId: string): void {
    this.defaultModels.set(type, modelId);
  }

  getDefaultModel(type: ModelType): string | undefined {
    return this.defaultModels.get(type);
  }
}

export const providerRouter = new ProviderRouter();
