import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useHistoryStore } from '../store/historyStore';
import { PROVIDERS } from '../providers/capabilities';
import { getStreamFn } from '../providers/index';
import { estimateCost, type TokenUsage } from '../lib/streamUtils';
import type { NormalizedFile } from '../lib/fileUtils';

export interface ResponseState {
  providerId: string;
  model: string;
  text: string;
  streaming: boolean;
  error: string | null;
  startTime: number;
  elapsedMs: number;
  estimatedTokens: number;
  usage: TokenUsage | null;
  costUsd: number | null;
}

function buildJudgePrompt(query: string, responses: ResponseState[]): string {
  const responseSummaries = responses.map(r => {
    const name = PROVIDERS[r.providerId]?.name || r.providerId;
    return `--- ${name} (${r.model}) ---\n${r.text}`;
  }).join('\n\n');

  return `You are an impartial AI judge. A user asked the following question to multiple AI models. Compare their responses, highlight where they agree and diverge, note which response is most accurate or complete, and provide a brief synthesis of the best answer.

User's question:
"${query}"

Responses:

${responseSummaries}

Provide your analysis in this format:
1. **Consensus** — where the models agree
2. **Divergences** — where they disagree and who is likely more accurate
3. **Best synthesis** — the most complete and accurate answer, combining the best parts`;
}

export function useProviders() {
  const [responses, setResponses] = useState<Record<string, ResponseState>>({});
  const [isQuerying, setIsQuerying] = useState(false);
  const abortControllers = useRef<Record<string, AbortController>>({});

  const apiKeys = useAppStore(s => s.apiKeys);
  const activeProviders = useAppStore(s => s.activeProviders);
  const selectedModels = useAppStore(s => s.selectedModels);
  const addSession = useHistoryStore(s => s.addSession);
  const updateSessionResponse = useHistoryStore(s => s.updateSessionResponse);

  const sendQuery = useCallback(async (query: string, files: NormalizedFile[]) => {
    if (!query.trim()) return;

    // Abort any ongoing requests
    Object.values(abortControllers.current).forEach(c => c.abort());
    abortControllers.current = {};

    const providers = Array.from(activeProviders).filter(id => apiKeys[id]);
    if (providers.length === 0) return;

    // Create history session
    const sessionId = await addSession(query, files.map(f => f.filename));

    const initial: Record<string, ResponseState> = {};
    for (const id of providers) {
      initial[id] = {
        providerId: id,
        model: selectedModels[id] || PROVIDERS[id].defaultModels[0],
        text: '',
        streaming: true,
        error: null,
        startTime: Date.now(),
        elapsedMs: 0,
        estimatedTokens: 0,
        usage: null,
        costUsd: null,
      };
    }
    setResponses(initial);
    setIsQuerying(true);

    // Fire all provider requests simultaneously
    const promises = providers.map(async (providerId) => {
      const controller = new AbortController();
      abortControllers.current[providerId] = controller;

      const model = selectedModels[providerId] || PROVIDERS[providerId].defaultModels[0];
      const key = apiKeys[providerId];
      const streamFn = getStreamFn(providerId);
      const startTime = Date.now();

      try {
        await streamFn(key, model, query, files, {
          onToken: (token) => {
            setResponses(prev => {
              const current = prev[providerId];
              if (!current) return prev;
              const newText = current.text + token;
              return {
                ...prev,
                [providerId]: {
                  ...current,
                  text: newText,
                  elapsedMs: Date.now() - startTime,
                  estimatedTokens: Math.ceil(newText.length / 4),
                },
              };
            });
          },
          onUsage: (usage) => {
            setResponses(prev => {
              const current = prev[providerId];
              if (!current) return prev;
              return {
                ...prev,
                [providerId]: {
                  ...current,
                  usage,
                  costUsd: estimateCost(model, usage),
                },
              };
            });
          },
          onDone: () => {
            setResponses(prev => {
              const current = prev[providerId];
              if (!current) return prev;
              const final = {
                ...current,
                streaming: false,
                elapsedMs: Date.now() - startTime,
              };

              // Save to history
              updateSessionResponse(sessionId, {
                providerId,
                model,
                text: final.text,
                elapsedMs: final.elapsedMs,
                estimatedTokens: final.estimatedTokens,
              });

              return { ...prev, [providerId]: final };
            });
          },
          onError: (error) => {
            setResponses(prev => {
              const current = prev[providerId];
              if (!current) return prev;
              const final = {
                ...current,
                streaming: false,
                error: error.message,
                elapsedMs: Date.now() - startTime,
              };

              updateSessionResponse(sessionId, {
                providerId,
                model,
                text: final.text,
                error: error.message,
                elapsedMs: final.elapsedMs,
                estimatedTokens: final.estimatedTokens,
              });

              return { ...prev, [providerId]: final };
            });
          },
        }, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setResponses(prev => ({
          ...prev,
          [providerId]: {
            ...prev[providerId],
            streaming: false,
            error: message,
            elapsedMs: Date.now() - startTime,
          },
        }));
        updateSessionResponse(sessionId, {
          providerId,
          model,
          text: '',
          error: message,
          elapsedMs: Date.now() - startTime,
          estimatedTokens: 0,
        });
      }
    });

    await Promise.allSettled(promises);

    // Judge/summarizer: after all responses, ask the judge to synthesize
    const judgeProvider = useAppStore.getState().judgeProvider;
    if (judgeProvider && apiKeys[judgeProvider] && providers.includes(judgeProvider)) {
      // Gather completed responses (excluding judge's own)
      const currentResponses = useAppStore.getState();
      // We need to read from our local state via a ref-like approach
      // Use a small delay to ensure state is settled
      await new Promise(r => setTimeout(r, 100));

      setResponses(prev => {
        const otherResponses = Object.values(prev)
          .filter(r => r.providerId !== judgeProvider && r.text && !r.error);

        if (otherResponses.length < 2) return prev; // Need at least 2 to compare

        // Fire the judge request
        const judgeModel = selectedModels[judgeProvider] || PROVIDERS[judgeProvider].defaultModels[0];
        const judgeKey = apiKeys[judgeProvider];
        const streamFn = getStreamFn(judgeProvider);
        const controller = new AbortController();
        abortControllers.current['__judge'] = controller;

        const judgePrompt = buildJudgePrompt(query, otherResponses);

        const judgeState: ResponseState = {
          providerId: '__judge',
          model: `${PROVIDERS[judgeProvider].name} (Judge)`,
          text: '',
          streaming: true,
          error: null,
          startTime: Date.now(),
          elapsedMs: 0,
          estimatedTokens: 0,
          usage: null,
          costUsd: null,
        };

        const startTime = Date.now();

        streamFn(judgeKey, judgeModel, judgePrompt, [], {
          onToken: (token) => {
            setResponses(p => {
              const current = p['__judge'];
              if (!current) return p;
              const newText = current.text + token;
              return {
                ...p,
                ['__judge']: {
                  ...current,
                  text: newText,
                  elapsedMs: Date.now() - startTime,
                  estimatedTokens: Math.ceil(newText.length / 4),
                },
              };
            });
          },
          onUsage: (usage) => {
            setResponses(p => {
              const current = p['__judge'];
              if (!current) return p;
              return { ...p, ['__judge']: { ...current, usage, costUsd: estimateCost(judgeModel, usage) } };
            });
          },
          onDone: () => {
            setResponses(p => {
              const current = p['__judge'];
              if (!current) return p;
              return { ...p, ['__judge']: { ...current, streaming: false, elapsedMs: Date.now() - startTime } };
            });
            setIsQuerying(false);
          },
          onError: (error) => {
            setResponses(p => {
              const current = p['__judge'];
              if (!current) return p;
              return { ...p, ['__judge']: { ...current, streaming: false, error: error.message, elapsedMs: Date.now() - startTime } };
            });
            setIsQuerying(false);
          },
        }, controller.signal).catch(() => {
          setIsQuerying(false);
        });

        return { ...prev, ['__judge']: judgeState };
      });
    } else {
      setIsQuerying(false);
    }
  }, [activeProviders, apiKeys, selectedModels, addSession, updateSessionResponse]);

  const retryProvider = useCallback(async (providerId: string, query: string, files: NormalizedFile[]) => {
    const key = apiKeys[providerId];
    if (!key) return;

    const model = selectedModels[providerId] || PROVIDERS[providerId].defaultModels[0];
    const controller = new AbortController();
    abortControllers.current[providerId] = controller;
    const startTime = Date.now();

    setResponses(prev => ({
      ...prev,
      [providerId]: {
        providerId,
        model,
        text: '',
        streaming: true,
        error: null,
        startTime,
        elapsedMs: 0,
        estimatedTokens: 0,
        usage: null,
        costUsd: null,
      },
    }));

    const streamFn = getStreamFn(providerId);
    try {
      await streamFn(key, model, query, files, {
        onToken: (token) => {
          setResponses(prev => {
            const current = prev[providerId];
            if (!current) return prev;
            const newText = current.text + token;
            return {
              ...prev,
              [providerId]: {
                ...current,
                text: newText,
                elapsedMs: Date.now() - startTime,
                estimatedTokens: Math.ceil(newText.length / 4),
              },
            };
          });
        },
        onUsage: (usage) => {
          setResponses(prev => {
            const current = prev[providerId];
            if (!current) return prev;
            return { ...prev, [providerId]: { ...current, usage, costUsd: estimateCost(model, usage) } };
          });
        },
        onDone: () => {
          setResponses(prev => {
            const current = prev[providerId];
            if (!current) return prev;
            return { ...prev, [providerId]: { ...current, streaming: false, elapsedMs: Date.now() - startTime } };
          });
        },
        onError: (error) => {
          setResponses(prev => {
            const current = prev[providerId];
            if (!current) return prev;
            return { ...prev, [providerId]: { ...current, streaming: false, error: error.message, elapsedMs: Date.now() - startTime } };
          });
        },
      }, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      setResponses(prev => ({
        ...prev,
        [providerId]: { ...prev[providerId], streaming: false, error: message, elapsedMs: Date.now() - startTime },
      }));
    }
  }, [apiKeys, selectedModels]);

  const cancelAll = useCallback(() => {
    Object.values(abortControllers.current).forEach(c => c.abort());
    abortControllers.current = {};
    setIsQuerying(false);
  }, []);

  return { responses, isQuerying, sendQuery, retryProvider, cancelAll };
}
