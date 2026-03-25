import type { NormalizedFile } from '../lib/fileUtils';

interface Props {
  file: NormalizedFile;
  onRemove: () => void;
}

export function FileUploadChip({ file, onRemove }: Props) {
  const icon = file.type === 'image' ? '\u{1F5BC}' : file.type === 'pdf' ? '\u{1F4C4}' : '\u{1F4DD}';

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-border text-xs text-text-secondary">
      <span>{icon}</span>
      <span className="truncate max-w-[120px]">{file.filename}</span>
      <button
        onClick={onRemove}
        className="ml-1 text-text-secondary hover:text-error transition-colors"
        aria-label={`Remove ${file.filename}`}
      >
        x
      </button>
    </span>
  );
}
