import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { useAppStore } from '../store/appStore';
import { PROVIDERS } from '../providers/capabilities';
import { ProviderChip } from './ProviderChip';
import { FileUploadChip } from './FileUploadChip';
import { normalizeFile, getAcceptString, isAcceptedFile, type NormalizedFile } from '../lib/fileUtils';

interface Props {
  onSend: (query: string, files: NormalizedFile[]) => void;
  isQuerying: boolean;
  onCancel: () => void;
  followUpMode: boolean;
  onToggleFollowUp: (v: boolean) => void;
  followUpProviders: Set<string>;
  onSetFollowUpProviders: (v: Set<string>) => void;
  hasConversation: boolean;
  onClearConversation: () => void;
}

export function QueryInput({
  onSend, isQuerying, onCancel,
  followUpMode, onToggleFollowUp,
  followUpProviders, onSetFollowUpProviders,
  hasConversation, onClearConversation,
}: Props) {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<NormalizedFile[]>([]);
  const [sendPulse, setSendPulse] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const configuredProviders = useAppStore(s => s.getConfiguredProviders)();
  const sendKey = useAppStore(s => s.sendKey);

  const handleSend = useCallback(() => {
    if (!query.trim() || isQuerying) return;
    setSendPulse(true);
    setTimeout(() => setSendPulse(false), 200);
    onSend(query.trim(), files);
    setQuery('');
    setFiles([]);
    setShowProviderPicker(false);
  }, [query, files, isQuerying, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (sendKey === 'enter' && e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleSend();
    } else if (sendKey === 'ctrl-enter' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, sendKey]);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: NormalizedFile[] = [];
    for (const file of Array.from(fileList)) {
      if (isAcceptedFile(file)) {
        try { newFiles.push(await normalizeFile(file)); } catch { /* skip */ }
      }
    }
    if (newFiles.length > 0) setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    await addFiles(fileList);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const toggleFollowUpProvider = (id: string) => {
    const next = new Set(followUpProviders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSetFollowUpProviders(next);
  };

  const activeFollowUpCount = followUpProviders.size;
  const followUpLabel = activeFollowUpCount === configuredProviders.length
    ? 'Follow-up to all'
    : `Follow-up to ${activeFollowUpCount}`;

  return (
    <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur-sm border-b border-border px-4 py-3">
      {/* Provider chips (only when not in follow-up mode) */}
      {!followUpMode && (
        <div className="flex flex-wrap gap-2 mb-2">
          {configuredProviders.map(id => (
            <ProviderChip key={id} providerId={id} />
          ))}
        </div>
      )}

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

      {/* Input area */}
      <div
        className="relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drop overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent/10 pointer-events-none">
            <span className="text-xs text-accent font-medium">Drop files here</span>
          </div>
        )}
        <div className={`flex items-start bg-surface border rounded-lg overflow-hidden focus-within:border-accent/50 transition-colors ${isDragging ? 'border-accent' : 'border-border'}`}>
          {/* Left icons */}
          <div className="flex items-center shrink-0 pl-2 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-text-secondary hover:text-text-primary transition-colors"
              title="Attach file"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptString()}
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Textarea with follow-up chip inside */}
          <div className="flex-1 min-w-0">
            {/* Follow-up chip row inside the input box */}
            {followUpMode && hasConversation && (
              <div className="flex items-center gap-1.5 px-2 pt-2 pb-0.5">
                <button
                  onClick={() => setShowProviderPicker(v => !v)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/15 border border-accent/40 text-accent hover:bg-accent/20 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 14 4 9 9 4" />
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                  </svg>
                  {followUpLabel}
                </button>
                <button
                  onClick={() => {
                    onToggleFollowUp(false);
                    onClearConversation();
                    setShowProviderPicker(false);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors"
                  title="Start new conversation"
                >
                  New chat
                </button>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={query}
              onChange={e => { setQuery(e.target.value); handleTextareaInput(); }}
              onKeyDown={handleKeyDown}
              placeholder={followUpMode && hasConversation ? 'Ask a follow-up...' : 'Ask anything...'}
              rows={1}
              className="w-full px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 resize-none focus:outline-none bg-transparent"
              style={{ maxHeight: 120 }}
            />
          </div>

          {/* Right side buttons */}
          <div className="flex items-end shrink-0 pr-2 pb-2">
            {isQuerying ? (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 bg-error/20 text-error border border-error/30 rounded-md text-xs font-medium hover:bg-error/30 transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!query.trim()}
                className={`
                  px-3 py-1.5 bg-accent text-white rounded-md text-xs font-medium
                  hover:bg-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed
                  ${sendPulse ? 'btn-pulse' : ''}
                `}
              >
                {followUpMode && hasConversation ? 'Follow up' : 'Ask All'}
              </button>
            )}
          </div>
        </div>

        {/* Provider picker dropdown */}
        {showProviderPicker && (
          <div className="absolute left-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg p-2 z-20">
            <p className="text-[10px] text-text-secondary mb-1.5">Send follow-up to:</p>
            {configuredProviders.map(id => (
              <button
                key={id}
                onClick={() => toggleFollowUpProvider(id)}
                className={`flex items-center gap-2 w-full px-2 py-1 rounded text-[11px] transition-colors ${
                  followUpProviders.has(id)
                    ? 'text-text-primary bg-accent/10'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: followUpProviders.has(id) ? PROVIDERS[id].brandColor : '#555' }}
                />
                {PROVIDERS[id].name}
                {followUpProviders.has(id) && <span className="ml-auto text-accent text-[10px]">{'\u2713'}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="text-[10px] text-text-secondary/40 mt-1 text-right">
        {sendKey === 'enter' ? 'Enter to send · Shift+Enter for new line' : `${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to send`}
      </div>
    </div>
  );
}
