import { useState, useCallback } from 'react';
import { PROVIDERS } from '../providers/capabilities';
import type { ResponseState } from '../hooks/useProviders';


interface Props {
  response: ResponseState;
  index: number;
  onRetry: (providerId: string) => void;
}

export function ResponseColumn({ response, index, onRetry }: Props) {
  const [copied, setCopied] = useState(false);
  const isJudge = response.providerId === '__judge';
  const provider = isJudge ? null : PROVIDERS[response.providerId];

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(response.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [response.text]);

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      className={`column-enter flex flex-col min-w-0 rounded-lg border overflow-hidden ${
        isJudge ? 'border-amber-500/40 col-span-full' : 'border-border/50'
      }`}
      style={{
        animationDelay: `${index * 100}ms`,
        background: isJudge ? 'var(--theme-judge-bg, rgba(30, 28, 20, 0.9))' : 'var(--theme-glass-bg)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${isJudge ? 'border-amber-500/30' : 'border-border/50'}`}>
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 transition-shadow duration-300"
          style={{
            backgroundColor: isJudge ? '#f59e0b' : provider!.brandColor,
            boxShadow: response.streaming ? `0 0 8px ${isJudge ? '#f59e0b' : provider!.brandColor}60` : 'none',
          }}
        />
        <span className="text-xs font-semibold text-text-primary truncate">
          {isJudge ? 'Judge / Synthesizer' : provider!.name}
        </span>
        <span className="text-[10px] text-text-secondary truncate">{response.model}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {response.streaming && (
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-accent shimmer-dot" />
              <span className="w-1 h-1 rounded-full bg-accent shimmer-dot" />
              <span className="w-1 h-1 rounded-full bg-accent shimmer-dot" />
            </span>
          )}
          {!response.streaming && !response.error && (
            <span className="text-[10px] text-text-secondary">
              {formatTime(response.elapsedMs)}
              {response.usage
                ? ` · ${response.usage.inputTokens + response.usage.outputTokens} tokens`
                : ` · ~${response.estimatedTokens} tokens`}
              {response.costUsd !== null && ` · $${response.costUsd < 0.01 ? response.costUsd.toFixed(4) : response.costUsd.toFixed(3)}`}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 text-sm text-text-primary leading-relaxed min-h-[100px]">
        {response.error ? (
          <div className="text-error text-xs">
            <p className="font-medium mb-1">Error</p>
            <p className="text-error/80">{response.error}</p>
            <button
              onClick={() => onRetry(response.providerId)}
              className="mt-2 px-3 py-1 text-xs bg-error/10 border border-error/30 rounded hover:bg-error/20 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className={response.streaming ? 'streaming-cursor' : ''}>
            {response.text.split('\n').map((line, i) => (
              <p key={i} className={line === '' ? 'h-3' : ''}>
                {renderInlineFormatting(line)}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {!response.streaming && response.text && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border/30">
          <button
            onClick={handleCopy}
            className="text-[10px] text-text-secondary hover:text-text-primary transition-colors"
          >
            {copied ? 'Copied \u2713' : 'Copy'}
          </button>
          <button
            onClick={() => onRetry(response.providerId)}
            className="text-[10px] text-text-secondary hover:text-text-primary transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

function renderInlineFormatting(text: string): React.ReactNode {
  // Simple inline code rendering
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 bg-bg rounded text-xs text-accent">
          {part.slice(1, -1)}
        </code>
      );
    }
    // Bold
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, j) => {
      if (bp.startsWith('**') && bp.endsWith('**')) {
        return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>;
      }
      return bp;
    });
  });
}
