import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useApi } from '@/hooks/useApi';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

/** Runtime information only. Provider credentials are owned by Floyd Core. */
export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const api = useApi();
  const [status, setStatus] = useState('Checking Floyd Core');

  useEffect(() => {
    if (!isOpen) return;
    api.checkHealth()
      .then((health) => setStatus(`${health.status}: ${health.model}`))
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold">Runtime</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close runtime panel">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="rounded border border-slate-700 bg-slate-900 p-3">
            <div className="text-slate-400">Connection</div>
            <div className="mt-1 text-slate-100">{status}</div>
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-2 text-slate-300">
            <dt className="text-slate-500">Surface</dt><dd>@floyd/sdk</dd>
            <dt className="text-slate-500">Authority</dt><dd>Floyd Core</dd>
            <dt className="text-slate-500">Coding engine</dt><dd>OpenCode SDK</dd>
            <dt className="text-slate-500">Credentials</dt><dd>Server-side only</dd>
          </dl>
          <p className="text-slate-400">
            Provider and model routing are configured centrally in Floyd Core. This pane never accepts or stores provider keys.
          </p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
          <button onClick={() => { onSave(); onClose(); }} className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
