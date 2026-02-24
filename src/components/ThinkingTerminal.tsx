/**
 * ThinkingTerminal - Terminal-style display for AI thinking process
 * 
 * Shows real-time reasoning/thinking content in a retro terminal aesthetic.
 * Auto-scrolls to follow new content.
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Brain, Terminal } from 'lucide-react';

interface ThinkingTerminalProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function ThinkingTerminal({ content, isStreaming = false, className }: ThinkingTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [content]);

  // Don't render if no content
  if (!content) return null;

  return (
    <div className={cn(
      'rounded-lg border border-green-900/50 overflow-hidden',
      'bg-black font-mono text-sm',
      className
    )}>
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border-b border-green-900/30">
        <Brain className="w-4 h-4 text-green-400" />
        <span className="text-green-400 text-xs font-semibold uppercase tracking-wide">
          Thinking Process
        </span>
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-500 text-xs">streaming...</span>
          </span>
        )}
      </div>

      {/* Terminal Content */}
      <div 
        ref={terminalRef}
        className="p-3 max-h-64 overflow-y-auto"
      >
        <div className="flex items-start gap-2">
          <Terminal className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
          <pre className={cn(
            'text-green-400 whitespace-pre-wrap break-words',
            'leading-relaxed',
            isStreaming && 'after:content-["▋"] after:animate-pulse after:ml-0.5'
          )}>
            {content}
          </pre>
        </div>
      </div>
    </div>
  );
}
