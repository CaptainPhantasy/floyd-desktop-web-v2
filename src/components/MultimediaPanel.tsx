/**
 * Multimedia Panel - Generate images, audio, and video
 * 
 * Phase 3: Frontend Integration
 * Created: 2026-02-28 16:45:00 UTC
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import {
  X,
  Image,
  Music,
  Video,
  Loader2,
  Download,
  Play,
  Pause,
  RefreshCw,
  Volume2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface MultimediaPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'image' | 'audio' | 'video';

interface Voice {
  id: string;
  name: string;
}

export function MultimediaPanel({ isOpen, onClose }: MultimediaPanelProps) {
  const api = useApi();
  const [activeTab, setActiveTab] = useState<Tab>('image');

  // Image state
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageQuality, setImageQuality] = useState<'standard' | 'hd'>('standard');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Audio state
  const [audioText, setAudioText] = useState('');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Audio element reference for playback control

  // Video state
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoDuration, setVideoDuration] = useState<5 | 10>(5);
  const [videoQuality, setVideoQuality] = useState<'speed' | 'quality'>('speed');
  const [videoTaskId, setVideoTaskId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [videoProgress, setVideoProgress] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Load voices on mount
  useEffect(() => {
    if (isOpen) {
      loadVoices();
    }
  }, [isOpen]);

  // Poll video status when processing
  useEffect(() => {
    if (videoStatus === 'processing' && videoTaskId) {
      const interval = setInterval(async () => {
        try {
          const status = await api.getVideoStatus(videoTaskId);
          setVideoProgress(status.progress || 0);
          
          if (status.status === 'completed' && status.result?.data) {
            setGeneratedVideo(status.result.data);
            setVideoStatus('completed');
          } else if (status.status === 'failed') {
            setVideoError(status.error || 'Video generation failed');
            setVideoStatus('failed');
          }
        } catch (err) {
          console.error('Error polling video status:', err);
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [videoStatus, videoTaskId, api]);

  const loadVoices = async () => {
    try {
      const result = await api.getVoices();
      setVoices(result.voices);
      if (result.voices.length > 0) {
        setSelectedVoice(result.voices[0].id);
      }
    } catch (err) {
      console.error('Failed to load voices:', err);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;

    setImageLoading(true);
    setImageError(null);
    setGeneratedImage(null);

    try {
      const result = await api.generateImage(imagePrompt, {
        quality: imageQuality,
      });

      if (result.success && result.data) {
        setGeneratedImage(result.data);
      } else {
        setImageError(result.error || 'Failed to generate image');
      }
    } catch (err: any) {
      setImageError(err.message || 'Failed to generate image');
    } finally {
      setImageLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!audioText.trim() || !selectedVoice) return;

    setAudioLoading(true);
    setAudioError(null);
    setGeneratedAudio(null);

    try {
      const result = await api.generateAudio(audioText, selectedVoice);

      if (result.success && result.data) {
        setGeneratedAudio(result.data);
      } else {
        setAudioError(result.error || 'Failed to generate audio');
      }
    } catch (err: any) {
      setAudioError(err.message || 'Failed to generate audio');
    } finally {
      setAudioLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) return;

    setVideoLoading(true);
    setVideoError(null);
    setGeneratedVideo(null);
    setVideoStatus('idle');
    setVideoTaskId(null);

    try {
      const result = await api.generateVideo(videoPrompt, {
        duration: videoDuration,
        quality: videoQuality,
      });

      if (result.success && result.taskId) {
        setVideoTaskId(result.taskId);
        setVideoStatus('processing');
        setVideoProgress(0);
      } else {
        setVideoError(result.error || 'Failed to start video generation');
      }
    } catch (err: any) {
      setVideoError(err.message || 'Failed to start video generation');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleDownload = useCallback((data: string, filename: string, mimeType: string) => {
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${data}`;
    link.download = filename;
    link.click();
  }, []);

  const handlePlayAudio = useCallback(() => {
    if (generatedAudio) {
      const audio = new Audio(`data:audio/mp3;base64,${generatedAudio}`);
      audio.play();
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
    }
  }, [generatedAudio]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Image className="w-5 h-5" />
            Multimedia Studio
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('image')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'image'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Image className="w-4 h-4" />
            Image
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'audio'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Music className="w-4 h-4" />
            Audio
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'video'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Video className="w-4 h-4" />
            Video
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Image Tab */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Prompt
                </label>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Quality
                </label>
                <select
                  value={imageQuality}
                  onChange={(e) => setImageQuality(e.target.value as 'standard' | 'hd')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                >
                  <option value="standard">Standard</option>
                  <option value="hd">HD (Higher Quality)</option>
                </select>
              </div>

              <button
                onClick={handleGenerateImage}
                disabled={!imagePrompt.trim() || imageLoading}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  imageLoading
                    ? 'bg-slate-700 cursor-not-allowed'
                    : 'bg-sky-600 hover:bg-sky-700'
                )}
              >
                {imageLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Image className="w-4 h-4" />
                    Generate Image
                  </>
                )}
              </button>

              {imageError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {imageError}
                </div>
              )}

              {generatedImage && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Image generated successfully
                  </div>
                  <img
                    src={`data:image/png;base64,${generatedImage}`}
                    alt="Generated"
                    className="w-full rounded-lg border border-slate-700"
                  />
                  <button
                    onClick={() => handleDownload(generatedImage, 'generated-image.png', 'image/png')}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Image
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Audio Tab */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Text to Speak
                </label>
                <textarea
                  value={audioText}
                  onChange={(e) => setAudioText(e.target.value)}
                  placeholder="Enter the text you want to convert to speech..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Voice
                </label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                >
                  {voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerateAudio}
                disabled={!audioText.trim() || !selectedVoice || audioLoading}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  audioLoading
                    ? 'bg-slate-700 cursor-not-allowed'
                    : 'bg-sky-600 hover:bg-sky-700'
                )}
              >
                {audioLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    Generate Audio
                  </>
                )}
              </button>

              {audioError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {audioError}
                </div>
              )}

              {generatedAudio && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Audio generated successfully
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePlayAudio}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button
                      onClick={() => handleDownload(generatedAudio, 'generated-audio.mp3', 'audio/mp3')}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download Audio
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video Tab */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Prompt
                </label>
                <textarea
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="Describe the video you want to generate..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Duration
                  </label>
                  <select
                    value={videoDuration}
                    onChange={(e) => setVideoDuration(Number(e.target.value) as 5 | 10)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Quality Mode
                  </label>
                  <select
                    value={videoQuality}
                    onChange={(e) => setVideoQuality(e.target.value as 'speed' | 'quality')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="speed">Speed (Faster)</option>
                    <option value="quality">Quality (Better)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerateVideo}
                disabled={!videoPrompt.trim() || videoLoading || videoStatus === 'processing'}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  videoLoading || videoStatus === 'processing'
                    ? 'bg-slate-700 cursor-not-allowed'
                    : 'bg-sky-600 hover:bg-sky-700'
                )}
              >
                {videoLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : videoStatus === 'processing' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing ({videoProgress}%)
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    Generate Video
                  </>
                )}
              </button>

              {videoError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {videoError}
                </div>
              )}

              {videoStatus === 'processing' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Video is being generated. This may take a few minutes...
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-sky-500 h-2 rounded-full transition-all"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {generatedVideo && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Video generated successfully
                  </div>
                  <video
                    src={`data:video/mp4;base64,${generatedVideo}`}
                    controls
                    className="w-full rounded-lg border border-slate-700"
                  />
                  <button
                    onClick={() => handleDownload(generatedVideo, 'generated-video.mp4', 'video/mp4')}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Video
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
