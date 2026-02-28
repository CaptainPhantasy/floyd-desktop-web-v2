# Multimedia Generation API

**Created:** 2026-02-28 18:55:00 UTC  
**Status:** Production Ready  
**Version:** 1.0.0

---

## Overview

The Multimedia Generation API provides endpoints for generating images, audio, and video content using various AI providers.

### Providers

| Type | Provider | Model | API Key Required |
|------|----------|-------|------------------|
| Image | OpenAI | DALL-E 3 | `openaiApiKey` |
| Audio | ElevenLabs | Multilingual v2 | `elevenLabsApiKey` |
| Video | Zai/GLM | CogVideoX-3 | `zaiApiKey` / `GLM_API_KEY` |

---

## Endpoints

### POST /api/generate/image

Generate an image from a text prompt using DALL-E 3.

**Request:**
```json
{
  "prompt": "A serene mountain landscape at sunset",
  "options": {
    "quality": "standard",
    "dimensions": {
      "width": 1024,
      "height": 1024
    }
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Text description of the desired image |
| `options.quality` | string | No | `"standard"` or `"hd"` (default: `"standard"`) |
| `options.dimensions` | object | No | Width/height (default: 1024x1024) |

**Response (Success):**
```json
{
  "success": true,
  "data": "base64-encoded-png-image...",
  "metadata": {
    "model": "dall-e-3",
    "format": "png",
    "generationTime": 12500
  }
}
```

**Response (Error):**
```json
{
  "error": "OpenAI API key not configured",
  "hint": "Add your OpenAI API key in Settings to enable image generation.",
  "code": "MISSING_API_KEY"
}
```

**Error Codes:**

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `MISSING_PROMPT` | No prompt provided | 400 |
| `MISSING_API_KEY` | OpenAI API key not configured | 503 |
| `GENERATION_FAILED` | Generation failed (rate limit, content policy, etc.) | 500 |

**cURL Example:**
```bash
curl -X POST http://localhost:3001/api/generate/image \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A red circle on white background"}'
```

---

### POST /api/generate/audio

Convert text to speech using ElevenLabs.

**Request:**
```json
{
  "text": "Hello, this is a test of the audio generation.",
  "voiceId": "CwhRBWXzGAHq8TQ4Fs17"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to convert to speech |
| `voiceId` | string | Yes | ElevenLabs voice ID (get from `/api/voices`) |

**Response (Success):**
```json
{
  "success": true,
  "data": "base64-encoded-mp3-audio...",
  "metadata": {
    "model": "eleven_multilingual_v2",
    "format": "mp3",
    "generationTime": 1689
  }
}
```

**Error Codes:**

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `MISSING_TEXT` | No text provided | 400 |
| `MISSING_VOICE_ID` | No voice ID provided | 400 |
| `MISSING_API_KEY` | ElevenLabs API key not configured | 503 |

**cURL Example:**
```bash
curl -X POST http://localhost:3001/api/generate/audio \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voiceId": "CwhRBWXzGAHq8TQ4Fs17"}'
```

---

### GET /api/voices

Get available ElevenLabs voices for text-to-speech.

**Response:**
```json
{
  "voices": [
    {
      "id": "CwhRBWXzGAHq8TQ4Fs17",
      "name": "Roger - Laid-Back, Casual, Resonant"
    },
    {
      "id": "EXAVITQu4vr4xnSDxMaL",
      "name": "Sarah - Mature, Reassuring, Confident"
    }
  ]
}
```

**cURL Example:**
```bash
curl http://localhost:3001/api/voices
```

---

### POST /api/generate/video

Start async video generation using CogVideoX-3.

**Request:**
```json
{
  "prompt": "A golden sunset over calm ocean waves",
  "options": {
    "duration": 5,
    "fps": 30,
    "quality": "speed"
  },
  "imageUrl": "optional-base64-or-url"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Text description of the desired video |
| `options.duration` | number | No | Video length in seconds: `5` or `10` (default: `5`) |
| `options.fps` | number | No | Frames per second: `30` or `60` (default: `30`) |
| `options.quality` | string | No | `"speed"` or `"quality"` (default: `"speed"`) |
| `imageUrl` | string | No | Optional reference image for video generation |

**Response:**
```json
{
  "success": true,
  "taskId": "08753968-dde9-4e81-a9ea-a0d7958aaaef",
  "externalTaskId": "20260301024008bfc550fbef214dd1",
  "status": "processing",
  "message": "Video generation started. Poll /api/generate/status/:taskId for updates."
}
```

**Note:** Video generation is **async** and typically takes 2-5 minutes. Poll the status endpoint to check progress.

**cURL Example:**
```bash
curl -X POST http://localhost:3001/api/generate/video \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Ocean waves at sunset", "options": {"duration": 5}}'
```

---

### GET /api/generate/status/:taskId

Poll the status of an async generation task.

**Response (Processing):**
```json
{
  "taskId": "08753968-dde9-4e81-a9ea-a0d7958aaaef",
  "type": "video-generation",
  "status": "processing",
  "progress": 45,
  "createdAt": 1709140807768,
  "updatedAt": 1709140842286
}
```

**Response (Completed):**
```json
{
  "taskId": "08753968-dde9-4e81-a9ea-a0d7958aaaef",
  "type": "video-generation",
  "status": "completed",
  "progress": 100,
  "createdAt": 1709140807768,
  "updatedAt": 1709141102286,
  "completedAt": 1709141102286,
  "result": {
    "data": "base64-encoded-mp4-video...",
    "metadata": {
      "model": "cogvideox-3",
      "format": "mp4"
    }
  }
}
```

**Response (Failed):**
```json
{
  "taskId": "08753968-dde9-4e81-a9ea-a0d7958aaaef",
  "type": "video-generation",
  "status": "failed",
  "error": "Video generation failed: content policy violation"
}
```

**Task Statuses:**

| Status | Description |
|--------|-------------|
| `pending` | Task created, waiting to start |
| `processing` | Generation in progress |
| `completed` | Generation finished successfully |
| `failed` | Generation failed |

**cURL Example:**
```bash
curl http://localhost:3001/api/generate/status/08753968-dde9-4e81-a9ea-a0d7958aaaef
```

---

### GET /api/generate/stats

Get current task queue statistics.

**Response:**
```json
{
  "total": 5,
  "pending": 1,
  "processing": 2,
  "completed": 10,
  "failed": 0
}
```

**cURL Example:**
```bash
curl http://localhost:3001/api/generate/stats
```

---

## Frontend Integration

### useApi Hook Methods

The `useApi` hook in `src/hooks/useApi.ts` provides these methods:

```typescript
const api = useApi();

// Get available voices
const { voices } = await api.getVoices();

// Generate image
const imageResult = await api.generateImage(prompt, { quality: 'standard' });
// imageResult.success, imageResult.data (base64), imageResult.metadata

// Generate audio
const audioResult = await api.generateAudio(text, voiceId);
// audioResult.success, audioResult.data (base64), audioResult.metadata

// Generate video (async)
const videoResult = await api.generateVideo(prompt, { duration: 5, fps: 30 });
// videoResult.success, videoResult.taskId, videoResult.externalTaskId

// Poll video status
const status = await api.getVideoStatus(taskId);
// status.status, status.progress, status.result (when completed)

// Get queue stats
const stats = await api.getGenerationStats();
// stats.total, stats.pending, stats.processing, stats.completed, stats.failed
```

---

## Configuration

### Required API Keys

Configure API keys in Settings or via environment variables:

| Key | Settings Field | Environment Variable |
|-----|----------------|----------------------|
| OpenAI | `openaiApiKey` | `OPENAI_API_KEY` |
| ElevenLabs | `elevenLabsApiKey` | `ELEVENLABS_API_KEY` |
| Zai/GLM | `zaiApiKey` | `GLM_API_KEY` |

### Environment Variables

Create a `.env.local` file:
```
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
GLM_API_KEY=...
```

---

## Rate Limits & Performance

| Operation | Typical Time | Rate Limit |
|-----------|--------------|------------|
| Image Generation | 8-15 seconds | OpenAI limits apply |
| Audio Generation | 1-3 seconds | ElevenLabs limits apply |
| Video Generation | 2-5 minutes | Zai/GLM limits apply |

**Best Practices:**
- Poll video status every 3 seconds (not faster)
- Implement cancel functionality for long-running video tasks
- Display progress indicators for user feedback
- Handle rate limit errors gracefully with retry suggestions

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-28 | 1.0.0 | Initial API documentation |
