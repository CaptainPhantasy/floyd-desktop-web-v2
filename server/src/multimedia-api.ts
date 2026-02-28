/**
 * Floyd Desktop - Multimedia API Handler
 * 
 * Handles all multimedia generation operations:
 * - Image generation (DALL-E 3 via OpenAI)
 * - Video generation (CogVideoX-3 via Zai)
 * - Audio generation (ElevenLabs)
 * 
 * Created: 2026-02-28 13:32:00 UTC
 */

import OpenAI from 'openai';
import { ModelCapability, getModelById } from './model-registry.js';
import { providerRouter, RoutingRequirements } from './provider-router.js';

export interface GenerationOptions {
  format?: string;
  dimensions?: { width: number; height: number };
  duration?: 5 | 10;
  fps?: 30 | 60;
  voice?: string;
  quality?: 'low' | 'medium' | 'high';
  withAudio?: boolean;
}

export interface GenerationResult {
  success: boolean;
  data?: string; // Base64 or URL
  taskId?: string; // For async operations
  metadata?: {
    model: string;
    format?: string;
    size?: string;
    duration?: number;
    generationTime?: number;
  };
  error?: string;
}

export class MultimediaAPIHandler {
  private openaiClient: OpenAI | null = null;
  private zaiApiKey: string | null = null;
  private elevenLabsApiKey: string | null = null;

  configure(settings: {
    openaiApiKey?: string;
    zaiApiKey?: string;
    elevenLabsApiKey?: string;
  }): void {
    if (settings.openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: settings.openaiApiKey });
    }
    this.zaiApiKey = settings.zaiApiKey || null;
    this.elevenLabsApiKey = settings.elevenLabsApiKey || null;
  }

  async generateImage(
    prompt: string,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.openaiClient) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    const startTime = Date.now();
    
    try {
      const response = await this.openaiClient.images.generate({
        model: 'dall-e-3',
        prompt,
        size: options?.dimensions 
          ? `${options.dimensions.width}x${options.dimensions.height}` as any
          : '1024x1024',
        quality: options?.quality === 'high' ? 'hd' : 'standard',
        n: 1,
        response_format: 'b64_json',
      });

      const image = response.data[0];
      
      return {
        success: true,
        data: image.b64_json,
        metadata: {
          model: 'dall-e-3',
          format: options?.format || 'png',
          generationTime: Date.now() - startTime,
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async generateVideo(
    prompt: string,
    options?: GenerationOptions,
    imageUrl?: string
  ): Promise<GenerationResult> {
    if (!this.zaiApiKey) {
      return { success: false, error: 'Zai API key not configured' };
    }

    const startTime = Date.now();

    try {
      const body: any = {
        model: 'cogvideox-3',
        prompt,
        quality: options?.quality === 'high' ? 'quality' : 'speed',
        with_audio: options?.withAudio ?? false,
        size: options?.dimensions 
          ? `${options.dimensions.width}x${options.dimensions.height}`
          : '1920x1080',
        fps: options?.fps || 30,
        duration: options?.duration || 5,
      };

      if (imageUrl) {
        body.image_url = [imageUrl];
      }

      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/videos/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.zaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.task_status === 'FAIL') {
        return { success: false, error: 'Video generation failed' };
      }

      return {
        success: true,
        taskId: data.id,
        metadata: {
          model: 'cogvideox-3',
          generationTime: Date.now() - startTime,
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getVideoResult(taskId: string): Promise<GenerationResult> {
    if (!this.zaiApiKey) {
      return { success: false, error: 'Zai API key not configured' };
    }

    try {
      const response = await fetch(`https://open.bigmodel.cn/api/paas/v4/async-result/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${this.zaiApiKey}`,
        },
      });

      const data = await response.json();

      if (data.task_status === 'PROCESSING') {
        return { success: true, taskId, metadata: { model: 'cogvideox-3' } };
      }

      if (data.task_status === 'SUCCESS' && data.video_result?.[0]?.url) {
        const videoResponse = await fetch(data.video_result[0].url);
        const videoBuffer = await videoResponse.arrayBuffer();
        const videoBase64 = Buffer.from(videoBuffer).toString('base64');

        return {
          success: true,
          data: videoBase64,
          metadata: {
            model: 'cogvideox-3',
            format: 'mp4',
          }
        };
      }

      return { success: false, error: 'Video generation failed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async generateAudio(
    text: string,
    voiceId: string,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    if (!this.elevenLabsApiKey) {
      return { success: false, error: 'ElevenLabs API key not configured' };
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.elevenLabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          output_format: 'mp3_44100_128',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Audio generation failed' };
      }

      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');

      return {
        success: true,
        data: audioBase64,
        metadata: {
          model: 'eleven_multilingual_v2',
          format: 'mp3',
          generationTime: Date.now() - startTime,
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getVoices(): Promise<{ id: string; name: string }[]> {
    if (!this.elevenLabsApiKey) {
      return [];
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.elevenLabsApiKey,
        },
      });

      const data = await response.json();
      return data.voices?.map((v: any) => ({ id: v.voice_id, name: v.name })) || [];
    } catch {
      return [];
    }
  }
}

export const multimediaAPI = new MultimediaAPIHandler();
