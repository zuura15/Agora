import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { useAppStore } from '../store/appStore';
import { ProviderChip } from './ProviderChip';
import { FileUploadChip } from './FileUploadChip';
import { normalizeFile, getAcceptString, isAcceptedFile, type NormalizedFile } from '../lib/fileUtils';

interface Props {
  onSend: (query: string, files: NormalizedFile[]) => void;
  isQuerying: boolean;
  onCancel: () => void;
}

export function QueryInput({ onSend, isQuerying, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<NormalizedFile[]>([]);
  const [sendPulse, setSendPulse] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const configuredProviders = useAppStore(s => s.getConfiguredProviders)();

  const handleSend = useCallback(() => {
    if (!query.trim() || isQuerying) return;
    setSendPulse(true);
    setTimeout(() => setSendPulse(false), 200);
    onSend(query.trim(), files);
    setQuery('');
    setFiles([]);
  }, [query, files, isQuerying, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const newFiles: NormalizedFile[] = [];
    for (const file of Array.from(fileList)) {
      if (isAcceptedFile(file)) {
        try {
          newFiles.push(await normalizeFile(file));
        } catch {
          // Skip files that fail normalization
        }
      }
    }
    setFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  return (
    <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur-sm border-b border-border px-4 py-3">
      {/* Provider chips */}
      <div className="flex flex-wrap gap-2 mb-2">
        {configuredProviders.map(id => (
          <ProviderChip key={id} providerId={id} />
        ))}
      </div>

      {/* File chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((f, i) => (
            <FileUploadChip
              key={`${f.filename}-${i}`}
              file={f}
              onRemove={() => setFiles(prev => prev.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 p-2 text-text-secondary hover:text-text-primary transition-colors"
          title="Attach file"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={getAcceptString()}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={query}
          onChange={e => { setQuery(e.target.value); handleTextareaInput(); }}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          rows={1}
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 resize-none focus:outline-none focus:border-accent/50 transition-colors"
          style={{ maxHeight: 120 }}
        />

        {isQuerying ? (
          <button
            onClick={onCancel}
            className="shrink-0 px-4 py-2 bg-error/20 text-error border border-error/30 rounded-lg text-sm font-medium hover:bg-error/30 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!query.trim()}
            className={`
              shrink-0 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium
              hover:bg-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed
              ${sendPulse ? 'btn-pulse' : ''}
            `}
          >
            Ask All
          </button>
        )}
      </div>
      <div className="text-[10px] text-text-secondary/40 mt-1 text-right">
        Enter to send · Shift+Enter for new line
      </div>
    </div>
  );
}
