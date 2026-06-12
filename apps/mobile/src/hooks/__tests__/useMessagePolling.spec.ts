import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMessagePolling } from '../useMessagePolling';
import { matchService } from '@/api/match.service';
import type { MatchMessage } from '@/api/match.service';
import type { PaginatedResponse } from '@shared/common';

// Override global fake timers — hooks with setInterval need real timers
jest.useRealTimers();

jest.mock('@/api/match.service', () => ({
  matchService: {
    getMessages: jest.fn(),
  },
}));

// Mock AppState via direct path to avoid native module loading
const mockAppStateListeners = new Map<string, (state: string) => void>();
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: jest.fn((event: string, callback: (state: string) => void) => {
    mockAppStateListeners.set(event, callback);
    return { remove: () => mockAppStateListeners.delete(event) };
  }),
  currentState: 'active',
}));

const mockedGetMessages = matchService.getMessages as jest.Mock;

const msg = (id: number, content = `msg-${id}`): MatchMessage => ({
  id,
  matchId: 1,
  senderId: 42,
  content,
  messageType: 'text',
  createdAt: `2026-06-15T10:00:0${id}.000Z`,
});

const paginated = (list: MatchMessage[], total?: number): PaginatedResponse<MatchMessage> => ({
  page: 1,
  pageSize: 20,
  total: total ?? list.length,
  list,
});

describe('useMessagePolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateListeners.clear();
  });

  it('should fetch initial messages and start polling', async () => {
    mockedGetMessages.mockResolvedValue(paginated([msg(3), msg(2), msg(1)]));

    const { result } = renderHook(() => useMessagePolling(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Messages reversed to ASC order
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[0].id).toBe(1);
    expect(result.current.messages[2].id).toBe(3);
    expect(result.current.isPolling).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should set error on initial fetch failure', async () => {
    mockedGetMessages.mockRejectedValue(new Error('网络错误'));

    const { result } = renderHook(() => useMessagePolling(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('网络错误');
    expect(result.current.messages).toHaveLength(0);
  });

  it('should poll new messages at interval', async () => {
    mockedGetMessages.mockResolvedValueOnce(paginated([msg(1)]));

    const { result } = renderHook(() => useMessagePolling(1, 500));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.messages).toHaveLength(1);

    // Simulate new messages arriving via poll
    mockedGetMessages.mockResolvedValue(paginated([msg(3), msg(2), msg(1)]));

    await waitFor(
      () => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(3);
      },
      { timeout: 3000 },
    );
  });

  it('should deduplicate messages during polling', async () => {
    mockedGetMessages.mockResolvedValue(paginated([msg(2), msg(1)]));

    const { result } = renderHook(() => useMessagePolling(1, 500));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    // Wait a bit for a poll cycle, should remain 2 (no duplicates)
    await new Promise((r) => setTimeout(r, 800));

    expect(result.current.messages).toHaveLength(2);
  });

  it('should silently handle polling errors', async () => {
    mockedGetMessages.mockResolvedValueOnce(paginated([msg(1)]));

    const { result } = renderHook(() => useMessagePolling(1, 500));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Polling fails on next cycle
    mockedGetMessages.mockRejectedValue(new Error('timeout'));

    // Wait for a poll cycle
    await new Promise((r) => setTimeout(r, 800));

    // Messages unchanged, no error set
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('should load more history messages', async () => {
    // Backend returns messages in DESC order (newest first), hook reverses to ASC
    // Initial: 20 messages, ids 11-30 in DESC order
    const initialMsgsDesc = Array.from({ length: 20 }, (_, i) => msg(30 - i));
    // Set default for initial fetch AND any polling calls (same data = no new msgs)
    mockedGetMessages.mockResolvedValue(paginated(initialMsgsDesc, 35));

    const { result } = renderHook(() => useMessagePolling(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);
    expect(result.current.messages).toHaveLength(20);

    // For loadMore: override getMessages to return older page.
    // Backend returns DESC order, hook reverses to ASC.
    mockedGetMessages.mockImplementation(async (_matchId: number, params?: { page?: number }) => {
      if (params?.page === 2) {
        // Backend DESC order: newest first
        const olderMsgsDesc = Array.from({ length: 15 }, (_, i) => msg(15 - i));
        return paginated(olderMsgsDesc, 35);
      }
      // Backend DESC order for initial page
      const initialDesc = Array.from({ length: 20 }, (_, i) => msg(30 - i));
      return paginated(initialDesc, 35);
    });

    await act(async () => {
      await result.current.loadMore();
    });

    // 15 older (ids 1-15) + 20 initial (ids 11-30), deduped = 30 unique messages
    // ids 1-10 are new, ids 11-15 overlap with initial
    expect(result.current.messages).toHaveLength(30);
    // Older messages prepended
    expect(result.current.messages[0].id).toBe(1);
    expect(result.current.hasMore).toBe(false);
  });

  it('should not load more when hasMore is false', async () => {
    mockedGetMessages.mockResolvedValueOnce(paginated([msg(1)], 1));

    const { result } = renderHook(() => useMessagePolling(1));

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });

    const callCount = mockedGetMessages.mock.calls.length;

    await act(async () => {
      await result.current.loadMore();
    });

    // No additional call made
    expect(mockedGetMessages.mock.calls.length).toBe(callCount);
  });

  it('should append message optimistically', async () => {
    mockedGetMessages.mockResolvedValueOnce(paginated([msg(1)]));

    const { result } = renderHook(() => useMessagePolling(1));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    act(() => {
      result.current.appendMessage(msg(100, '我发的'));
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].content).toBe('我发的');
  });

  it('should refresh messages', async () => {
    mockedGetMessages.mockResolvedValueOnce(paginated([msg(1)]));

    const { result } = renderHook(() => useMessagePolling(1));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Refresh returns different data
    mockedGetMessages.mockResolvedValueOnce(paginated([msg(5), msg(3), msg(1)]));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.messages).toHaveLength(3);
  });

  it('should pause polling on background, resume on foreground', async () => {
    mockedGetMessages.mockResolvedValue(paginated([msg(1)]));

    const { result } = renderHook(() => useMessagePolling(1, 500));

    await waitFor(() => {
      expect(result.current.isPolling).toBe(true);
    });

    // Simulate background
    await act(async () => {
      mockAppStateListeners.get('change')?.('background');
    });

    expect(result.current.isPolling).toBe(false);

    // Simulate foreground
    await act(async () => {
      mockAppStateListeners.get('change')?.('active');
    });

    expect(result.current.isPolling).toBe(true);
  });
});
