/**
 * ExportChatButton - Export chat history to Markdown
 * 
 * Downloads the current conversation as a formatted Markdown file.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Download, CheckCircle } from 'lucide-react';
import type { Message } from '@/types';

interface ExportChatButtonProps {
  messages: Message[];
  sessionTitle?: string;
}

export function ExportChatButton({ messages, sessionTitle = 'Chat' }: ExportChatButtonProps) {
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    if (messages.length === 0) return;

    const timestamp = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('en-US', { hour12: false }).replace(/:/g, '-');
    
    // Build Markdown content
    let markdown = `# ${sessionTitle}\n\n`;
    markdown += `**Exported:** ${new Date().toLocaleString()}\n`;
    markdown += `**Messages:** ${messages.length}\n\n`;
    markdown += `---\n\n`;
    markdown += `## Conversation\n\n`;

    messages.forEach((message, index) => {
      const role = message.role === 'user' ? '👤 **User**' : '🤖 **Floyd**';
      const time = message.timestamp 
        ? new Date(message.timestamp).toLocaleTimeString()
        : '';
      
      markdown += `### ${role}${time ? ` (${time})` : ''}\n\n`;
      markdown += `${message.content}\n\n`;
      
      if (index < messages.length - 1) {
        markdown += `---\n\n`;
      }
    });

    markdown += `\n---\n\n*Exported from Floyd Desktop*\n`;

    // Create and download file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${timestamp}_${time}_${sessionTitle.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success feedback
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <button
      onClick={handleExport}
      disabled={messages.length === 0 || exported}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
        'transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        exported 
          ? 'bg-green-600 text-white' 
          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
      )}
      title="Export chat to Markdown"
    >
      {exported ? (
        <>
          <CheckCircle className="w-4 h-4" />
          <span>Exported!</span>
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          <span>Export</span>
        </>
      )}
    </button>
  );
}
