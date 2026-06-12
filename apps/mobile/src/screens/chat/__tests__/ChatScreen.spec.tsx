import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ChatScreen } from '../ChatScreen';
import { matchService } from '@/api/match.service';
import type { MatchMessage } from '@/api/match.service';
import type { PaginatedResponse } from '@shared/common';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line prefer-const
let mockRouteParams: Record<string, unknown> = { matchId: 1 };

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: mockRouteParams,
    }),
    useFocusEffect: (cb: () => void) => {
      const React = require('react');
      React.useEffect(() => { cb(); }, []);
    },
  };
});

jest.mock('@/api/match.service', () => ({
  matchService: {
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
  },
}));

jest.mock('@/stores', () => ({
  useAppStore: jest.fn((selector) => {
    const state = { user: { id: 100, nickname: '当前用户', userType: 'player' } };
    return selector(state);
  }),
}));

// Mock AppState to avoid issues
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  currentState: 'active',
}));

describe('ChatScreen', () => {
  const mockMessages: MatchMessage[] = [
    {
      id: 1,
      matchId: 1,
      senderId: 0,
      content: '比赛已创建',
      messageType: 'system',
      createdAt: '2026-06-15T10:00:00.000Z',
    },
    {
      id: 2,
      matchId: 1,
      senderId: 100,
      content: '大家好',
      messageType: 'text',
      createdAt: '2026-06-15T10:01:00.000Z',
    },
    {
      id: 3,
      matchId: 1,
      senderId: 42,
      content: '你好！',
      messageType: 'text',
      createdAt: '2026-06-15T10:02:00.000Z',
    },
  ];

  const mockPaginatedResponse = (
    list: MatchMessage[],
    total?: number,
  ): PaginatedResponse<MatchMessage> => ({
    page: 1,
    pageSize: 20,
    total: total ?? list.length,
    list,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockRouteParams = { matchId: 1 };
  });

  it('should render loading state initially', () => {
    (matchService.getMessages as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<ChatScreen />);
    expect(screen.getByLabelText('加载中')).toBeTruthy();
  });

  it('should render messages after loading', async () => {
    (matchService.getMessages as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(mockMessages),
    );

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByText('大家好')).toBeTruthy();
    });
    expect(screen.getByText('你好！')).toBeTruthy();
  });

  it('should render system messages with system style', async () => {
    (matchService.getMessages as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(mockMessages),
    );

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByText('比赛已创建')).toBeTruthy();
    });
    // System messages should have a specific accessibility label
    expect(screen.getByLabelText('系统消息-比赛已创建')).toBeTruthy();
  });

  it('should render my messages with right alignment', async () => {
    (matchService.getMessages as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(mockMessages),
    );

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('我的消息-大家好')).toBeTruthy();
    });
  });

  it('should render other messages with left alignment', async () => {
    (matchService.getMessages as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(mockMessages),
    );

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('他人消息-你好！')).toBeTruthy();
    });
  });

  it('should call sendMessage on send press', async () => {
    (matchService.getMessages as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(mockMessages),
    );
    (matchService.sendMessage as jest.Mock).mockResolvedValue({
      id: 4,
      matchId: 1,
      senderId: 100,
      content: '新消息',
      messageType: 'text',
      createdAt: '2026-06-15T10:03:00.000Z',
    });

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('消息输入框')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('消息输入框'), '新消息');
    fireEvent.press(screen.getByLabelText('发送'));

    await waitFor(() => {
      expect(matchService.sendMessage).toHaveBeenCalledWith(1, {
        content: '新消息',
        messageType: 'text',
      });
    });
  });

  it('should clear input and show new message after send success', async () => {
    (matchService.getMessages as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(mockMessages),
    );
    (matchService.sendMessage as jest.Mock).mockResolvedValue({
      id: 4,
      matchId: 1,
      senderId: 100,
      content: '新消息',
      messageType: 'text',
      createdAt: '2026-06-15T10:03:00.000Z',
    });

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('消息输入框')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('消息输入框'), '新消息');
    fireEvent.press(screen.getByLabelText('发送'));

    await waitFor(() => {
      expect(screen.getByText('新消息')).toBeTruthy();
    });

    // Input should be cleared
    expect(screen.getByLabelText('消息输入框').props.value).toBe('');
  });

  it('should show error on send failure', async () => {
    (matchService.getMessages as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(mockMessages),
    );
    (matchService.sendMessage as jest.Mock).mockRejectedValue(new Error('发送失败'));

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('消息输入框')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('消息输入框'), '测试');
    fireEvent.press(screen.getByLabelText('发送'));

    await waitFor(() => {
      expect(screen.getByText('发送失败')).toBeTruthy();
    });
  });

  it('should disable send button when input is empty', async () => {
    (matchService.getMessages as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(mockMessages),
    );

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('消息输入框')).toBeTruthy();
    });

    // Send button should be disabled when input is empty
    const sendButton = screen.getByLabelText('发送');
    expect(sendButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('should show error state with retry on load failure', async () => {
    (matchService.getMessages as jest.Mock).mockRejectedValue(new Error('网络错误'));

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeTruthy();
    });
    expect(screen.getByLabelText('重试')).toBeTruthy();
  });

  it('should show sending indicator while sending', async () => {
    (matchService.getMessages as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(mockMessages),
    );
    (matchService.sendMessage as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('消息输入框')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('消息输入框'), '测试消息');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('发送'));
    });

    expect(screen.getByLabelText('发送中')).toBeTruthy();
  });

  it('should render KeyboardAvoidingView', async () => {
    (matchService.getMessages as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(mockMessages),
    );

    render(<ChatScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('消息输入框')).toBeTruthy();
    });

    // KeyboardAvoidingView should be present (tested by the fact the screen renders properly)
    expect(screen.getByLabelText('群聊页面')).toBeTruthy();
  });
});
