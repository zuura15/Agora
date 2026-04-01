import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useHistoryStore } from '../store/historyStore';
import { PROVIDERS } from '../providers/capabilities';
import { getStreamFn, type ConversationTurn } from '../providers/index';
import { estimateCost, type TokenUsage } from '../lib/streamUtils';
import { reserveQuery } from '../lib/accessCodeService';
import type { ProxyReservation } from '../proxy/proxyStream';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
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

export interface ConversationEntry {
  query: string;
  responses: Record<string, ResponseState>;
  isFollowUp: boolean;
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

function summarizeHistory(history: ConversationTurn[]): ConversationTurn[] {
  if (history.length <= 10) return history;

  // Keep last 10 turns, summarize older ones into a single context turn
  const oldTurns = history.slice(0, -10);
  const recentTurns = history.slice(-10);

  const summary = oldTurns.map(t =>
    `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content.slice(0, 200)}${t.content.length > 200 ? '...' : ''}`
  ).join('\n');

  return [
    { role: 'user', content: `[Earlier conversation summary]\n${summary}` },
    { role: 'assistant', content: 'I understand the context from our earlier conversation. Please continue.' },
    ...recentTurns,
  ];
}

export function useProviders() {
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [followUpMode, setFollowUpMode] = useState(false);
  const [followUpProviders, setFollowUpProviders] = useState<Set<string>>(new Set());
  const abortControllers = useRef<Record<string, AbortController>>({});
  // Track conversation history per provider
  const conversationHistories = useRef<Record<string, ConversationTurn[]>>({});

  const apiKeys = useAppStore(s => s.apiKeys);
  const activeProviders = useAppStore(s => s.activeProviders);
  const selectedModels = useAppStore(s => s.selectedModels);
  const addSession = useHistoryStore(s => s.addSession);
  const updateSessionResponse = useHistoryStore(s => s.updateSessionResponse);

  // Current (latest) responses for display
  const responses = conversation.length > 0
    ? conversation[conversation.length - 1].responses
    : {};

  const sendQuery = useCallback(async (query: string, files: NormalizedFile[]) => {
    if (!query.trim()) return;

    Object.values(abortControllers.current).forEach(c => c.abort());
    abortControllers.current = {};

    const isFollowUp = followUpMode && conversation.length > 0;
    const { queryMode, availableProviders, canSendAccessCodeQuery, setTotalBalance, setDailyQueryCount } = useAppStore.getState();
    const isAccessCode = queryMode === 'access-code';

    logger.access.info('sendQuery', { queryMode, isAccessCode, isFollowUp, availableProviders, activeProviders: Array.from(activeProviders) });

    let providers: string[];
    let currentReservation: ProxyReservation | undefined;
    if (isAccessCode) {
      const activeIds = isFollowUp ? Array.from(followUpProviders) : Array.from(activeProviders);
      providers = activeIds.filter(id => availableProviders.includes(id));
      logger.access.info('sendQuery — access-code providers', { activeIds, filtered: providers });

      if (providers.length === 0) {
        logger.access.warn('sendQuery — no providers available, aborting');
        return;
      }

      const check = canSendAccessCodeQuery();
      if (!check.allowed) {
        logger.access.warn('sendQuery — guard blocked', check);
        // Show error as a fake response
        const errorEntry: ConversationEntry = {
          query,
          responses: { '__error': { providerId: '__error', model: '', text: '', streaming: false, error: check.reason || 'Cannot send query', startTime: Date.now(), elapsedMs: 0, estimatedTokens: 0, usage: null, costUsd: null } },
          isFollowUp: false,
        };
        setConversation(prev => [...prev, errorEntry]);
        return;
      }

      // Reserve credit + claim daily slot
      logger.access.info('sendQuery — reserving credit...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        const reservationResult = await reserveQuery(session);
        logger.access.info('sendQuery — reservation success', reservationResult);
        setTotalBalance(reservationResult.remaining_credit);
        setDailyQueryCount(reservationResult.queries_today);
        if (reservationResult.available_providers?.length) {
          useAppStore.getState().setAvailableProviders(reservationResult.available_providers);
        }
        currentReservation = {
          query_group_id: reservationResult.query_group_id,
          active_code_id: reservationResult.active_code_id,
        };
      } catch (err: any) {
        logger.access.error('sendQuery — reservation failed', err);
        const msg = err?.error || err?.message || 'Reservation failed';
        const errorEntry: ConversationEntry = {
          query,
          responses: { '__error': { providerId: '__error', model: '', text: '', streaming: false, error: msg, startTime: Date.now(), elapsedMs: 0, estimatedTokens: 0, usage: null, costUsd: null } },
          isFollowUp: false,
        };
        setConversation(prev => [...prev, errorEntry]);
        return;
      }
    } else {
      providers = isFollowUp
        ? Array.from(followUpProviders).filter(id => apiKeys[id])
        : Array.from(activeProviders).filter(id => apiKeys[id]);
    }
    if (providers.length === 0) return;

    // If not a follow-up, reset conversation
    if (!isFollowUp) {
      conversationHistories.current = {};
      setConversation([]);
    }

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

    const newEntry: ConversationEntry = { query, responses: initial, isFollowUp };
    setConversation(prev => [...prev, newEntry]);
    setIsQuerying(true);

    const promises = providers.map(async (providerId) => {
      const controller = new AbortController();
      abortControllers.current[providerId] = controller;

      const model = selectedModels[providerId] || PROVIDERS[providerId].defaultModels[0];
      const key = isAccessCode ? '' : apiKeys[providerId];
      const streamFn = getStreamFn(providerId, currentReservation);
      const startTime = Date.now();

      // Get and summarize history for this provider
      const history = summarizeHistory(conversationHistories.current[providerId] || []);

      try {
        await streamFn(key, model, query, files, {
          onToken: (token) => {
            setConversation(prev => {
              const updated = [...prev];
              const last = { ...updated[updated.length - 1] };
              const current = last.responses[providerId];
              if (!current) return prev;
              const newText = current.text + token;
              last.responses = {
                ...last.responses,
                [providerId]: {
                  ...current,
                  text: newText,
                  elapsedMs: Date.now() - startTime,
                  estimatedTokens: Math.ceil(newText.length / 4),
                },
              };
              updated[updated.length - 1] = last;
              return updated;
            });
          },
          onUsage: (usage) => {
            setConversation(prev => {
              const updated = [...prev];
              const last = { ...updated[updated.length - 1] };
              const current = last.responses[providerId];
              if (!current) return prev;
              last.responses = {
                ...last.responses,
                [providerId]: { ...current, usage, costUsd: estimateCost(model, usage) },
              };
              updated[updated.length - 1] = last;
              return updated;
            });
          },
          onDone: () => {
            setConversation(prev => {
              const updated = [...prev];
              const last = { ...updated[updated.length - 1] };
              const current = last.responses[providerId];
              if (!current) return prev;
              const final = { ...current, streaming: false, elapsedMs: Date.now() - startTime };

              // Update conversation history for this provider
              if (!conversationHistories.current[providerId]) {
                conversationHistories.current[providerId] = [];
              }
              conversationHistories.current[providerId].push(
                { role: 'user', content: query },
                { role: 'assistant', content: final.text },
              );

              updateSessionResponse(sessionId, {
                providerId,
                model,
                text: final.text,
                elapsedMs: final.elapsedMs,
                estimatedTokens: final.estimatedTokens,
              });

              last.responses = { ...last.responses, [providerId]: final };
              updated[updated.length - 1] = last;
              return updated;
            });
          },
          onError: (error) => {
            setConversation(prev => {
              const updated = [...prev];
              const last = { ...updated[updated.length - 1] };
              const current = last.responses[providerId];
              if (!current) return prev;
              const final = { ...current, streaming: false, error: error.message, elapsedMs: Date.now() - startTime };

              updateSessionResponse(sessionId, {
                providerId,
                model,
                text: final.text,
                error: error.message,
                elapsedMs: final.elapsedMs,
                estimatedTokens: final.estimatedTokens,
              });

              last.responses = { ...last.responses, [providerId]: final };
              updated[updated.length - 1] = last;
              return updated;
            });
          },
        }, controller.signal, history.length > 0 ? history : undefined);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setConversation(prev => {
          const updated = [...prev];
          const last = { ...updated[updated.length - 1] };
          const current = last.responses[providerId];
          if (!current) return prev;
          last.responses = {
            ...last.responses,
            [providerId]: { ...current, streaming: false, error: message, elapsedMs: Date.now() - startTime },
          };
          updated[updated.length - 1] = last;
          return updated;
        });
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

    // Judge
    const { judgeProvider, autoJudge } = useAppStore.getState();
    const hasJudgeKey = isAccessCode || apiKeys[judgeProvider!];
    const shouldJudge = judgeProvider && hasJudgeKey && providers.includes(judgeProvider);
    if (shouldJudge || (autoJudge && judgeProvider && hasJudgeKey)) {
      await new Promise(r => setTimeout(r, 100));

      setConversation(prev => {
        const updated = [...prev];
        const last = { ...updated[updated.length - 1] };
        const otherResponses = Object.values(last.responses)
          .filter(r => r.providerId !== judgeProvider && r.text && !r.error);

        if (otherResponses.length < 2) return prev;

        const judgeModel = selectedModels[judgeProvider] || PROVIDERS[judgeProvider].defaultModels[0];
        const judgeKey = isAccessCode ? '' : apiKeys[judgeProvider];
        const streamFn = getStreamFn(judgeProvider, currentReservation);
        const controller = new AbortController();
        abortControllers.current['__judge'] = controller;
        const judgePrompt = buildJudgePrompt(query, otherResponses);
        const startTime = Date.now();

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

        streamFn(judgeKey, judgeModel, judgePrompt, [], {
          onToken: (token) => {
            setConversation(p => {
              const u = [...p];
              const l = { ...u[u.length - 1] };
              const c = l.responses['__judge'];
              if (!c) return p;
              l.responses = { ...l.responses, ['__judge']: { ...c, text: c.text + token, elapsedMs: Date.now() - startTime, estimatedTokens: Math.ceil((c.text + token).length / 4) } };
              u[u.length - 1] = l;
              return u;
            });
          },
          onUsage: (usage) => {
            setConversation(p => {
              const u = [...p];
              const l = { ...u[u.length - 1] };
              const c = l.responses['__judge'];
              if (!c) return p;
              l.responses = { ...l.responses, ['__judge']: { ...c, usage, costUsd: estimateCost(judgeModel, usage) } };
              u[u.length - 1] = l;
              return u;
            });
          },
          onDone: () => {
            setConversation(p => {
              const u = [...p];
              const l = { ...u[u.length - 1] };
              const c = l.responses['__judge'];
              if (!c) return p;
              l.responses = { ...l.responses, ['__judge']: { ...c, streaming: false, elapsedMs: Date.now() - startTime } };
              u[u.length - 1] = l;
              return u;
            });
            setIsQuerying(false);
            setFollowUpMode(true);
            setFollowUpProviders(new Set(providers));
          },
          onError: (error) => {
            setConversation(p => {
              const u = [...p];
              const l = { ...u[u.length - 1] };
              const c = l.responses['__judge'];
              if (!c) return p;
              l.responses = { ...l.responses, ['__judge']: { ...c, streaming: false, error: error.message, elapsedMs: Date.now() - startTime } };
              u[u.length - 1] = l;
              return u;
            });
            setIsQuerying(false);
          },
        }, controller.signal).catch(() => setIsQuerying(false));

        last.responses = { ...last.responses, ['__judge']: judgeState };
        updated[updated.length - 1] = last;
        return updated;
      });
    } else {
      setIsQuerying(false);
      // Auto-enable follow-up mode after first query completes
      setFollowUpMode(true);
      setFollowUpProviders(new Set(providers));
    }
  }, [activeProviders, apiKeys, selectedModels, addSession, updateSessionResponse, followUpMode, followUpProviders, conversation]);

  const retryProvider = useCallback(async (providerId: string, query: string, files: NormalizedFile[]) => {
    const { queryMode: retryMode } = useAppStore.getState();
    const isRetryAccessCode = retryMode === 'access-code';
    const key = isRetryAccessCode ? '' : apiKeys[providerId];
    if (!key && !isRetryAccessCode) return;

    const model = selectedModels[providerId] || PROVIDERS[providerId].defaultModels[0];
    const controller = new AbortController();
    abortControllers.current[providerId] = controller;
    const startTime = Date.now();

    const retryState: ResponseState = {
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
    };

    setConversation(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      last.responses = { ...last.responses, [providerId]: retryState };
      updated[updated.length - 1] = last;
      return updated;
    });

    // For access-code retries, reserve a new slot (costs another daily query)
    let retryReservation: ProxyReservation | undefined;
    if (isRetryAccessCode) {
      try {
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (!retrySession) return;
        const res = await reserveQuery(retrySession);
        useAppStore.getState().setTotalBalance(res.remaining_credit);
        useAppStore.getState().setDailyQueryCount(res.queries_today);
        retryReservation = {
          query_group_id: res.query_group_id,
          active_code_id: res.active_code_id,
        };
      } catch {
        return; // Reservation failed, can't retry
      }
    }

    const streamFn = getStreamFn(providerId, retryReservation);
    try {
      await streamFn(key, model, query, files, {
        onToken: (token) => {
          setConversation(prev => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            const current = last.responses[providerId];
            if (!current) return prev;
            const newText = current.text + token;
            last.responses = { ...last.responses, [providerId]: { ...current, text: newText, elapsedMs: Date.now() - startTime, estimatedTokens: Math.ceil(newText.length / 4) } };
            updated[updated.length - 1] = last;
            return updated;
          });
        },
        onUsage: (usage) => {
          setConversation(prev => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            const current = last.responses[providerId];
            if (!current) return prev;
            last.responses = { ...last.responses, [providerId]: { ...current, usage, costUsd: estimateCost(model, usage) } };
            updated[updated.length - 1] = last;
            return updated;
          });
        },
        onDone: () => {
          setConversation(prev => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            const current = last.responses[providerId];
            if (!current) return prev;
            last.responses = { ...last.responses, [providerId]: { ...current, streaming: false, elapsedMs: Date.now() - startTime } };
            updated[updated.length - 1] = last;
            return updated;
          });
        },
        onError: (error) => {
          setConversation(prev => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            const current = last.responses[providerId];
            if (!current) return prev;
            last.responses = { ...last.responses, [providerId]: { ...current, streaming: false, error: error.message, elapsedMs: Date.now() - startTime } };
            updated[updated.length - 1] = last;
            return updated;
          });
        },
      }, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      setConversation(prev => {
        const updated = [...prev];
        const last = { ...updated[updated.length - 1] };
        last.responses = { ...last.responses, [providerId]: { ...last.responses[providerId], streaming: false, error: message, elapsedMs: Date.now() - startTime } };
        updated[updated.length - 1] = last;
        return updated;
      });
    }
  }, [apiKeys, selectedModels]);

  const cancelAll = useCallback(() => {
    Object.values(abortControllers.current).forEach(c => c.abort());
    abortControllers.current = {};
    setIsQuerying(false);
  }, []);

  const clearConversation = useCallback(() => {
    conversationHistories.current = {};
    setConversation([]);
    setFollowUpMode(false);
  }, []);

  return {
    responses,
    conversation,
    isQuerying,
    followUpMode,
    setFollowUpMode,
    followUpProviders,
    setFollowUpProviders,
    sendQuery,
    retryProvider,
    cancelAll,
    clearConversation,
  };
}
