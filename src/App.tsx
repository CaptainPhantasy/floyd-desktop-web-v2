/**
 * Floyd Web - Main Application
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import type { Session, Message, Settings } from '@/types';
import { SettingsModal } from '@/components/SettingsModal';
import { Sidebar } from '@/components/Sidebar';
import { ChatMessage } from '@/components/ChatMessage';
import { ToolCallCard } from '@/components/ToolCallCard';
import { SkillsPanel } from '@/components/SkillsPanel';
import { ProjectsPanel } from '@/components/ProjectsPanel';
import { BroworkPanel } from '@/components/BroworkPanel';
import { EmergencyStopButton } from '@/components/EmergencyStopButton';
import { ThinkingTerminal } from '@/components/ThinkingTerminal';
import { ExportChatButton } from '@/components/ExportChatButton';
import { FileInput } from '@/components/FileInput';
import {
  Settings as SettingsIcon,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Sparkles,
  FolderKanban,
  Users
} from 'lucide-react';

interface FileAttachment {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'video' | 'document' | 'code' | 'data';
}

export default function App() {
  const api = useApi();

  // State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [_settings, setSettings] = useState<Settings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'no-key' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = useState('');
  const [showSkills, setShowSkills] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showBrowork, setShowBrowork] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<Array<{
    id: string;
    tool: string;
    args: any;
    result?: any;
    success?: boolean;
    isExecuting: boolean;
  }>>([]);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [thinkingContent, _setThinkingContent] = useState('');
  const [chatMode, setChatMode] = useState<'floyd4' | 'streaming'>('streaming');
  const [showModeAlert, setShowModeAlert] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingContentRef = useRef<string>('');

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Initialize
  useEffect(() => {
    async function init() {
      try {
        const health = await api.checkHealth();
        const settingsData = await api.getSettings();
        setSettings(settingsData);
        
        if (!health.hasApiKey) {
          setStatus('no-key');
          setStatusMessage('API key not configured. Click Settings to add your Anthropic API key.');
          setShowSettings(true);
          return;
        }
        
        // Load sessions
        const sessionList = await api.getSessions();
        setSessions(sessionList);
        
        // Create or load session
        if (sessionList.length > 0) {
          const session = await api.getSession(sessionList[0].id);
          setCurrentSession(session);
          setMessages(session.messages);
        } else {
          const session = await api.createSession();
          setSessions([session]);
          setCurrentSession(session);
          setMessages([]);
        }
        
        setStatus('ready');
        setStatusMessage(`Connected to ${health.model}`);
      } catch (err: any) {
        setStatus('error');
        setStatusMessage(err.message || 'Failed to connect to server');
      }
    }
    
    init();
  }, []);

  // Auto-refresh: Poll for new messages from mobile/other clients
  // Enhanced to handle real-time updates better
  useEffect(() => {
    if (status !== 'ready') return;

    const interval = setInterval(async () => {
      if (!currentSession) return;

      // Skip if we're actively streaming to avoid conflicts
      if (isStreaming) {
        return;
      }

      try {
        const updatedSession = await api.getSession(currentSession.id);

        // Only update if server has MORE messages (from another client)
        // Never overwrite local messages with fewer server messages
        if (updatedSession.messages.length > messages.length) {
          console.log(`[App] Auto-refresh: Found ${updatedSession.messages.length - messages.length} new messages`);
          setMessages(updatedSession.messages);
        }
        // Also check if the last message content differs (Floyd4 may update the same message)
        else if (updatedSession.messages.length === messages.length && updatedSession.messages.length > 0) {
          const localLast = messages[messages.length - 1];
          const serverLast = updatedSession.messages[updatedSession.messages.length - 1];
          
          if (localLast && serverLast && 
              localLast.role === 'assistant' && serverLast.role === 'assistant' &&
              localLast.content !== serverLast.content) {
            console.log('[App] Auto-refresh: Last assistant message updated');
            setMessages(updatedSession.messages);
          }
        }

        const updatedSessions = await api.getSessions();
        if (updatedSessions.length !== sessions.length) {
          setSessions(updatedSessions);
        }
      } catch (err) {
        console.error('Auto-refresh failed:', err);
      }
    }, 500); // Reduced to 500ms for more responsive real-time updates

    return () => clearInterval(interval);
  }, [status, currentSession, isStreaming, messages.length, sessions.length, api]);

  // Handle send message - using Floyd4 harness
  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming || !currentSession) return;

    // Check if attachments require streaming mode (for vision support)
    const hasVisionAttachments = attachments.some(att => 
      att.type === 'image' || att.type === 'document' || att.type === 'code'
    );

    // Auto-switch to streaming mode for vision models
    if (hasVisionAttachments && chatMode !== 'streaming') {
      setChatMode('streaming');
      setStatusMessage('🔄 Auto-switched to Streaming Mode - GLM-4.6v Vision Active');
      // Show a brief notification
      setTimeout(() => {
        setStatusMessage('✅ Ready - GLM-4.6v can now see attached images');
      }, 2000);
    }

    const inputText = input.trim();
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');
    streamingContentRef.current = '';
    setActiveToolCalls([]);

    try {
      let uploadedAttachments: Array<{
        id: string;
        name: string;
        size: number;
        type: 'image' | 'video' | 'document' | 'code' | 'data';
        mimeType: string;
        data: string;
      }> = [];

      if (attachments.length > 0) {
        const uploadResult = await api.uploadFiles(attachments.map(a => a.file));
        if (uploadResult.success) {
          uploadedAttachments = uploadResult.files;
        }
        setAttachments([]);
      }

      const userMessage: Message = {
        role: 'user',
        content: inputText || '[Image Attached]',
        timestamp: Date.now(),
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      };

      setMessages(prev => [...prev, userMessage]);

      // Always use streaming mode when attachments are present for proper vision support
      if (chatMode === 'streaming' || hasVisionAttachments) {
        await api.sendMessageStream(
          currentSession.id,
          userMessage.content,
          (text) => {
            streamingContentRef.current += text;
            setStreamingContent(streamingContentRef.current);
          },
          async (_usage, _sessionId) => {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: streamingContentRef.current,
              timestamp: Date.now(),
            }]);
            setStreamingContent('');
            streamingContentRef.current = '';
            setIsStreaming(false);
            setActiveToolCalls([]);

            const sessionList = await api.getSessions();
            setSessions(sessionList);
          },
          (error) => {
            setStatusMessage(`Error: ${error}`);
            setIsStreaming(false);
            setStreamingContent('');
            streamingContentRef.current = '';
          },
          (tool, args, id) => {
            setActiveToolCalls(prev => [...prev, {
              id,
              tool,
              args,
              isExecuting: true,
            }]);
          },
          (_tool, id, result, success) => {
            setActiveToolCalls(prev => prev.map(tc =>
              tc.id === id ? { ...tc, result, success, isExecuting: false } : tc
            ));
          },
          undefined, // onThinking callback - not used
          uploadedAttachments.length > 0 ? uploadedAttachments : undefined
        );
      } else {
        // Floyd4 mode - only for text-only messages
        const result = await api.sendFloydMessage(currentSession.id, userMessage.content, messages, {
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined
        });

        if (result.output) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: result.output,
            timestamp: Date.now(),
          }]);
        }

        setStreamingContent('');
        streamingContentRef.current = '';
        setIsStreaming(false);
        setActiveToolCalls([]);

        const sessionList = await api.getSessions();
        setSessions(sessionList);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
      setIsStreaming(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle emergency stop - halt all operations immediately
  const handleEmergencyStop = async () => {
    console.log('[App] Emergency stop triggered');
    
    // Stop any active Floyd4 session
    try {
      await api.stopFloydChat();
    } catch (err) {
      console.error('[App] Error stopping Floyd4:', err);
    }
    
    // Reset all streaming state
    setIsStreaming(false);
    setStreamingContent('');
    streamingContentRef.current = '';
    setActiveToolCalls([]);
    
    // Enter emergency mode
    setEmergencyMode(true);
    setStatusMessage('🚨 Emergency stop - Control transferred to you');
    
    // Exit emergency mode after 3 seconds
    setTimeout(() => {
      setEmergencyMode(false);
      setStatusMessage('Ready');
    }, 3000);
  };

  // Handle new session
  const handleNewSession = async () => {
    try {
      const session = await api.createSession();
      setSessions(prev => [session, ...prev]);
      setCurrentSession(session);
      setMessages([]);
      inputRef.current?.focus();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  // Handle select session
  const handleSelectSession = async (sessionId: string) => {
    try {
      const session = await api.getSession(sessionId);
      setCurrentSession(session);
      setMessages(session.messages);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  // Handle delete session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (currentSession?.id === sessionId) {
        if (sessions.length > 1) {
          const remaining = sessions.filter(s => s.id !== sessionId);
          const next = await api.getSession(remaining[0].id);
          setCurrentSession(next);
          setMessages(next.messages);
        } else {
          const session = await api.createSession();
          setSessions([session]);
          setCurrentSession(session);
          setMessages([]);
        }
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  // Handle settings save
  const handleSettingsSave = async () => {
    const settingsData = await api.getSettings();
    setSettings(settingsData);
    
    const health = await api.checkHealth();
    if (health.hasApiKey) {
      setStatus('ready');
      setStatusMessage(`Connected to ${health.model}`);
    }
  };

  return (
    <div className="h-screen flex bg-slate-900 text-slate-100">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSession?.id}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-slate-700 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Floyd</h1>
            <span className="text-sm text-slate-400">
              {currentSession?.title || 'New Chat'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Status indicator */}
            <div className={cn(
              'flex items-center gap-2 text-sm px-3 py-1 rounded-full',
              status === 'ready' && 'bg-green-500/10 text-green-400',
              status === 'loading' && 'bg-blue-500/10 text-blue-400',
              status === 'no-key' && 'bg-yellow-500/10 text-yellow-400',
              status === 'error' && 'bg-red-500/10 text-red-400',
            )}>
              {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === 'ready' && <CheckCircle2 className="w-4 h-4" />}
              {status === 'no-key' && <AlertCircle className="w-4 h-4" />}
              {status === 'error' && <AlertCircle className="w-4 h-4" />}
              <span className="max-w-[200px] truncate">{statusMessage}</span>
            </div>
            
            {/* Export Chat Button */}
            <ExportChatButton 
              messages={messages} 
              sessionTitle={currentSession?.title}
            />
            
            {/* Debug GLM Vision Button - Only show in development */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={async () => {
                  setStatusMessage('🔍 Running GLM Vision diagnostic...');
                  try {
                    const diagnostic = await api.getGLMDiagnostic();
                    console.log('GLM Diagnostic Result:', diagnostic);
                    const successCount = diagnostic.tests.filter((t: { status: string }) => t.status === 'success').length;
                    setStatusMessage(`🔍 Diagnostic complete: ${successCount}/${diagnostic.tests.length} tests passed`);
                  } catch (error) {
                    console.error('Diagnostic failed:', error);
                    setStatusMessage('🔍 Diagnostic failed - check console');
                  }
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Debug GLM Vision"
              >
                <Wrench className="w-5 h-5" />
              </button>
            )}
            
            <button
              onClick={() => setShowBrowork(true)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Browork (Sub-agents)"
            >
              <Users className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowProjects(true)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Projects"
            >
              <FolderKanban className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowSkills(true)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Skills"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-4">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-2xl font-semibold text-white mb-2">Welcome to Floyd Desktop</h2>
              <p className="text-slate-400 text-center mb-8">
                Your personal AI assistant with full system access. Free from API costs.
              </p>
              
              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-8">
                <button 
                  onClick={() => setShowBrowork(true)}
                  className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors text-left"
                >
                  <Users className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-sm font-medium">Browork</div>
                    <div className="text-xs text-slate-400">Spawn sub-agents</div>
                  </div>
                </button>
                
                <button 
                  onClick={() => setShowSkills(true)}
                  className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors text-left"
                >
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <div>
                    <div className="text-sm font-medium">Skills</div>
                    <div className="text-xs text-slate-400">Customize behavior</div>
                  </div>
                </button>
                
                <button 
                  onClick={() => setShowProjects(true)}
                  className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors text-left"
                >
                  <FolderKanban className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-sm font-medium">Projects</div>
                    <div className="text-xs text-slate-400">Add context files</div>
                  </div>
                </button>
                
                <button 
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors text-left"
                >
                  <SettingsIcon className="w-5 h-5 text-slate-400" />
                  <div>
                    <div className="text-sm font-medium">Settings</div>
                    <div className="text-xs text-slate-400">API & model config</div>
                  </div>
                </button>
              </div>
              
              {/* Capabilities */}
              <div className="bg-slate-800/50 rounded-lg p-4 w-full max-w-md">
                <div className="text-sm font-medium text-slate-300 mb-3">What Floyd can do:</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3 text-green-400" />
                    Read & write files
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3 text-green-400" />
                    Execute commands
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3 text-green-400" />
                    Run Python/Node code
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3 text-green-400" />
                    Search codebase
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3 text-green-400" />
                    Edit files surgically
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3 text-green-400" />
                    Manage processes
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 mt-6">
                Try: "List the files in this directory" or "What's in package.json?"
              </p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          
          {/* Tool calls */}
          {activeToolCalls.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Wrench className="w-4 h-4" />
                <span>Using tools...</span>
              </div>
              {activeToolCalls.map((tc) => (
                <ToolCallCard
                  key={tc.id}
                  tool={tc.tool}
                  args={tc.args}
                  result={tc.result}
                  success={tc.success}
                  isExecuting={tc.isExecuting}
                />
              ))}
            </div>
          )}
          
          {/* Thinking Terminal - shows AI reasoning in real-time */}
          {isStreaming && thinkingContent && (
            <ThinkingTerminal 
              content={thinkingContent}
              isStreaming={isStreaming}
            />
          )}
          
          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <ChatMessage 
              message={{ role: 'assistant', content: streamingContent }} 
              isStreaming 
            />
          )}
          
          {/* Loading indicator */}
          {isStreaming && !streamingContent && !thinkingContent && activeToolCalls.length === 0 && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-700 p-4">
          <div className="flex flex-col gap-2">
            {/* File attachments preview */}
            {attachments.length > 0 && (
              <div className="px-2">
                <FileInput
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  disabled={status !== 'ready' || isStreaming}
                />
              </div>
            )}

            <div className="flex gap-2">
              {/* Emergency Stop - LEFT of input */}
              <EmergencyStopButton
                onStop={handleEmergencyStop}
                isActive={emergencyMode}
              />

              {/* File Input Button */}
              <div className="flex items-start">
                <FileInput
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  disabled={status !== 'ready' || isStreaming}
                />
              </div>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={status === 'ready' ? 'Type a message...' : 'Configure API key in settings...'}
                disabled={status !== 'ready' || isStreaming}
                className={cn(
                  'flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3',
                  'resize-none focus:outline-none focus:ring-2 focus:ring-sky-500',
                  'placeholder:text-slate-500 disabled:opacity-50',
                )}
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || status !== 'ready' || isStreaming}
                className={cn(
                  'px-4 py-2 bg-sky-600 rounded-lg transition-colors',
                  'hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {isStreaming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSettingsSave}
      />

      {/* Skills Panel */}
      <SkillsPanel
        isOpen={showSkills}
        onClose={() => setShowSkills(false)}
      />

      {/* Projects Panel */}
      <ProjectsPanel
        isOpen={showProjects}
        onClose={() => setShowProjects(false)}
      />

      {/* Browork Panel */}
      <BroworkPanel
        isOpen={showBrowork}
        onClose={() => setShowBrowork(false)}
      />

      {/* Mode Switch Alert */}
      {showModeAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Vision Mode Required
                </h3>
                <p className="text-sm text-slate-300 mb-4">
                  You've attached files that require vision capabilities (images, documents).
                  Floyd4 doesn't support file attachments. Switch to streaming mode to use vision features with Claude.
                </p>
                <div className="bg-slate-900/50 rounded p-3 mb-4 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-red-400">✕</span> Floyd4 Mode: CLI-based, no vision support
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-green-400">✓</span> Streaming Mode: Full API access, vision support
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setChatMode('streaming');
                  setShowModeAlert(false);
                  setStatusMessage('Switched to Streaming Mode (Vision Enabled)');
                  setTimeout(() => handleSend(), 100);
                }}
                className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors font-medium"
              >
                Switch to Streaming Mode
              </button>
              <button
                onClick={() => {
                  setShowModeAlert(false);
                  setAttachments([]);
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Remove Attachments
              </button>
            </div>

            <button
              onClick={() => setShowModeAlert(false)}
              className="w-full mt-2 px-4 py-2 text-slate-400 hover:text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mode Indicator Badge */}
      {chatMode === 'streaming' && (
        <div className="fixed bottom-20 right-6 bg-sky-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-3 h-3" />
          Streaming Mode (GLM-4.6v Vision Active)
          <button
            onClick={() => {
              setChatMode('floyd4');
              setStatusMessage('Switched back to Floyd4 Mode');
            }}
            className="ml-1 hover:bg-white/20 rounded px-1.5 py-0.5 transition-colors"
          >
            Switch Back
          </button>
        </div>
      )}
    </div>
  );
}
