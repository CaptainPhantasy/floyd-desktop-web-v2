import { useState } from 'react';
import type { PendingPermission, PendingQuestion } from '@/lib/experience-interactions';

interface ArtifactPanelState {
  id: string;
  view: string;
  loading: boolean;
  content?: string;
  error?: string;
}

interface Props {
  artifact: ArtifactPanelState | null;
  questions: PendingQuestion[];
  permissions: PendingPermission[];
  interactionError: string;
  disabled: boolean;
  onAnswer: (requestId: string, answers: string[][]) => Promise<void>;
  onPermission: (requestId: string, reply: 'once' | 'always' | 'reject') => Promise<void>;
}

export function ExperiencePanels({ artifact, questions, permissions, interactionError, disabled, onAnswer, onPermission }: Props) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const setAnswer = (requestId: string, index: number, value: string) => {
    setAnswers((current) => {
      const next = [...(current[requestId] ?? [])];
      next[index] = value;
      return { ...current, [requestId]: next };
    });
  };

  const answer = async (question: PendingQuestion) => {
    const values = answers[question.requestId] ?? [];
    if (question.prompts.some((_prompt, index) => !values[index]?.trim())) return;
    setBusy(question.requestId);
    try { await onAnswer(question.requestId, values.map((value) => [value.trim()])); }
    finally { setBusy(null); }
  };

  const permission = async (requestId: string, reply: 'once' | 'always' | 'reject') => {
    setBusy(requestId);
    try { await onPermission(requestId, reply); }
    finally { setBusy(null); }
  };

  if (!artifact && !questions.length && !permissions.length && !interactionError) return null;
  return (
    <section aria-label="Portable Floyd context" className="border-b border-slate-700 bg-slate-950/70 p-4 space-y-3">
      {interactionError && <div role="alert" className="rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200 whitespace-pre-wrap">{interactionError}</div>}
      {artifact && (
        <article className="rounded-lg border border-sky-500/40 bg-slate-900 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-medium text-sky-200">Artifact</h2>
            <span className="truncate font-mono text-xs text-slate-400" title={artifact.id}>{artifact.id}</span>
          </div>
          {artifact.view && <div className="mb-2 text-xs text-slate-500">View: {artifact.view}</div>}
          {artifact.loading ? <div className="text-sm text-slate-400">Loading artifact…</div>
            : artifact.error ? <div role="alert" className="text-sm text-red-300 whitespace-pre-wrap">{artifact.error}</div>
              : <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-3 text-xs text-slate-200">{artifact.content}</pre>}
        </article>
      )}
      {questions.map((question) => (
        <article key={question.requestId} className="rounded-lg border border-violet-500/40 bg-slate-900 p-3 space-y-3">
          <h2 className="font-medium text-violet-200">Question from Floyd</h2>
          {question.prompts.map((prompt, index) => {
            const inputId = `question-${question.requestId}-${index}`;
            return (
            <div key={`${question.requestId}-${index}`} className="block text-sm text-slate-200">
              <label htmlFor={inputId} className="mb-1 block">{prompt.text}</label>
              {prompt.options.length > 0 && <span className="mb-2 flex flex-wrap gap-1">{prompt.options.map((option) => (
                <button key={option} type="button" disabled={disabled || busy === question.requestId} onClick={() => setAnswer(question.requestId, index, option)} className="rounded border border-violet-500/50 px-2 py-1 text-xs hover:bg-violet-900/50">{option}</button>
              ))}</span>}
              <input id={inputId} value={answers[question.requestId]?.[index] ?? ''} disabled={disabled || busy === question.requestId} onChange={(event) => setAnswer(question.requestId, index, event.target.value)} className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2" />
            </div>
          );})}
          <button type="button" disabled={disabled || busy === question.requestId || question.prompts.some((_prompt, index) => !answers[question.requestId]?.[index]?.trim())} onClick={() => void answer(question)} className="rounded bg-violet-600 px-3 py-2 text-sm disabled:opacity-50">Answer</button>
        </article>
      ))}
      {permissions.map((item) => (
        <article key={item.requestId} className="rounded-lg border border-amber-500/40 bg-slate-900 p-3">
          <h2 className="font-medium text-amber-200">Permission required: {item.title}</h2>
          {item.detail && <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-300">{item.detail}</pre>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={disabled || busy === item.requestId} onClick={() => void permission(item.requestId, 'once')} className="rounded bg-amber-600 px-3 py-2 text-sm disabled:opacity-50">Allow once</button>
            <button type="button" disabled={disabled || busy === item.requestId} onClick={() => void permission(item.requestId, 'always')} className="rounded border border-amber-500 px-3 py-2 text-sm disabled:opacity-50">Always allow</button>
            <button type="button" disabled={disabled || busy === item.requestId} onClick={() => void permission(item.requestId, 'reject')} className="rounded border border-red-500 px-3 py-2 text-sm text-red-200 disabled:opacity-50">Reject</button>
          </div>
        </article>
      ))}
    </section>
  );
}
