/**
 * Chat Message Component
 * Supports text, attachments, and generated media (image, audio, video)
 */

import { cn } from '@/lib/utils';
import type { Message } from '@/types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, ImageIcon, Music, Video, Play, Pause, Volume2 } from 'lucide-react';
import { useState, useRef } from 'react';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

/**
 * Media Renderer Component
 * Handles display of generated media (images, audio, video)
 */
function MediaRenderer({ media }: { media: NonNullable<Message['media']> }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const mediaUrl = `data:${media.mimeType};base64,${media.data}`;

  // Image rendering
  if (media.type === 'image') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ImageIcon className="w-4 h-4" />
          <span>Generated Image</span>
          {media.metadata?.width && media.metadata?.height && (
            <span className="text-slate-500">
              ({media.metadata.width}×{media.metadata.height})
            </span>
          )}
        </div>
        <img
          src={mediaUrl}
          alt="Generated content"
          className="max-w-full rounded-lg border border-slate-600 shadow-lg"
          style={{ maxHeight: '400px' }}
        />
        {media.metadata?.prompt && (
          <p className="text-xs text-slate-500 italic truncate max-w-md">
            "{media.metadata.prompt}"
          </p>
        )}
      </div>
    );
  }

  // Audio rendering with custom controls
  if (media.type === 'audio') {
    const formatTime = (time: number) => {
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const togglePlay = () => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    return (
      <div className="flex flex-col gap-2 bg-slate-900/50 rounded-lg p-3 border border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Music className="w-4 h-4" />
          <span>Generated Audio</span>
          {media.metadata?.duration && (
            <span className="text-slate-500">
              ({formatTime(media.metadata.duration)})
            </span>
          )}
        </div>
        
        <audio
          ref={audioRef}
          src={mediaUrl}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
        
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-sky-600 hover:bg-sky-500 flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" />
            )}
          </button>
          
          <div className="flex-1 flex flex-col gap-1">
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all"
                style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          <Volume2 className="w-5 h-5 text-slate-400" />
        </div>
        
        {media.metadata?.text && (
          <p className="text-xs text-slate-500 italic truncate max-w-md">
            "{media.metadata.text}"
          </p>
        )}
      </div>
    );
  }

  // Video rendering
  if (media.type === 'video') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Video className="w-4 h-4" />
          <span>Generated Video</span>
          {media.metadata?.duration && (
            <span className="text-slate-500">
              ({Math.floor(media.metadata.duration / 60)}:{Math.floor(media.metadata.duration % 60).toString().padStart(2, '0')})
            </span>
          )}
        </div>
        <video
          ref={videoRef}
          src={mediaUrl}
          controls
          className="max-w-full rounded-lg border border-slate-600 shadow-lg"
          style={{ maxHeight: '400px' }}
        />
        {media.metadata?.prompt && (
          <p className="text-xs text-slate-500 italic truncate max-w-md">
            "{media.metadata.prompt}"
          </p>
        )}
      </div>
    );
  }

  return null;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      'flex gap-3',
      isUser ? 'justify-end' : 'justify-start',
    )}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5" />
        </div>
      )}
      
      <div className={cn(
        'max-w-[70%] rounded-lg px-4 py-3 flex flex-col gap-2',
        isUser 
          ? 'bg-sky-600 text-white' 
          : 'bg-slate-800 text-slate-100',
      )}>
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.attachments.map((att, i) => (
              att.type === 'image' ? (
                <img 
                  key={i} 
                  src={`data:${att.mimeType || 'image/jpeg'};base64,${att.data}`} 
                  alt={att.name}
                  className="max-w-[200px] max-h-[200px] rounded-md border border-white/20"
                />
              ) : (
                <div key={i} className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-md text-sm">
                  <span className="font-mono truncate max-w-[150px]">{att.name}</span>
                </div>
              )
            ))}
          </div>
        )}

        {/* Generated Media Rendering */}
        {message.media && (
          <div className="mb-2">
            <MediaRenderer media={message.media} />
          </div>
        )}

        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  
                  if (isInline) {
                    return (
                      <code className="bg-slate-700 px-1 py-0.5 rounded text-sm" {...props}>
                        {children}
                      </code>
                    );
                  }
                  
                  return (
                    <SyntaxHighlighter
                      style={oneDark as any}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg !bg-slate-900 !mt-2 !mb-2"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  );
                },
                p({ children }) {
                  return <p className="mb-2 last:mb-0">{children}</p>;
                },
                ul({ children }) {
                  return <ul className="list-disc list-inside mb-2">{children}</ul>;
                },
                ol({ children }) {
                  return <ol className="list-decimal list-inside mb-2">{children}</ol>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-sky-400 animate-pulse ml-1" />
            )}
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}
