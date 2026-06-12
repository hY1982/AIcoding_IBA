import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { matchService } from '@/api/match.service';
import type { MatchMessage } from '@/api/match.service';

const DEFAULT_POLL_INTERVAL = 5000;
const DEFAULT_PAGE_SIZE = 20;

/**
 * 消息轮询 Hook
 *
 * MVP 阶段使用 REST 轮询获取群聊消息。
 * 未来替换 WebSocket 时，只需替换此 hook 的内部实现，
 * 对外接口（messages/isPolling/refresh）保持不变。
 *
 * @param matchId 比赛 ID
 * @param interval 轮询间隔（毫秒），默认 5000
 */
export function useMessagePolling(matchId: number, interval = DEFAULT_POLL_INTERVAL) {
  const [messages, setMessages] = useState<MatchMessage[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestMessageIdRef = useRef<number>(0);

  // Initial load
  const fetchInitial = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await matchService.getMessages(matchId, {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
      });
      // Backend returns DESC, reverse for ASC display
      const sorted = [...response.list].reverse();
      setMessages(sorted);
      if (sorted.length > 0) {
        latestMessageIdRef.current = sorted[sorted.length - 1].id;
      }
      setHasMore(response.total > DEFAULT_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  // Poll for new messages
  const pollNewMessages = useCallback(async () => {
    try {
      const response = await matchService.getMessages(matchId, {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
      });
      const sorted = [...response.list].reverse();
      if (sorted.length > 0 && sorted[sorted.length - 1].id > latestMessageIdRef.current) {
        // Filter only new messages
        const newMessages = sorted.filter((m) => m.id > latestMessageIdRef.current);
        latestMessageIdRef.current = sorted[sorted.length - 1].id;
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const trulyNew = newMessages.filter((m) => !existingIds.has(m.id));
          if (trulyNew.length === 0) return prev;
          return [...prev, ...trulyNew];
        });
      }
    } catch {
      // Silently fail polling — will retry next interval
    }
  }, [matchId]);

  // Load more history (older messages)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    try {
      setIsLoadingMore(true);
      const nextPage = page + 1;
      const response = await matchService.getMessages(matchId, {
        page: nextPage,
        pageSize: DEFAULT_PAGE_SIZE,
      });
      const sorted = [...response.list].reverse();
      setMessages((prev) => [...sorted.filter((m) => !prev.some((p) => p.id === m.id)), ...prev]);
      setHasMore(response.total > nextPage * DEFAULT_PAGE_SIZE);
      setPage(nextPage);
    } catch {
      // Silently fail load more
    } finally {
      setIsLoadingMore(false);
    }
  }, [matchId, page, hasMore, isLoadingMore]);

  // Start/stop polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    setIsPolling(true);
    intervalRef.current = setInterval(pollNewMessages, interval);
  }, [pollNewMessages, interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Initial fetch + start polling
  useEffect(() => {
    fetchInitial().then(startPolling);
    return () => stopPolling();
  }, [fetchInitial, startPolling, stopPolling]);

  // AppState listener — pause polling when backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        pollNewMessages(); // Fetch immediately on resume
        startPolling();
      } else {
        stopPolling();
      }
    });
    return () => subscription.remove();
  }, [startPolling, stopPolling, pollNewMessages]);

  // Append a locally-sent message (optimistic update)
  const appendMessage = useCallback((message: MatchMessage) => {
    setMessages((prev) => [...prev, message]);
    if (message.id > latestMessageIdRef.current) {
      latestMessageIdRef.current = message.id;
    }
  }, []);

  return {
    messages,
    isLoading,
    isLoadingMore,
    isPolling,
    error,
    hasMore,
    refresh: fetchInitial,
    loadMore,
    appendMessage,
  };
}
