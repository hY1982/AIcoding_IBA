import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { matchService } from '@/api/match.service';
import type { MatchMessage } from '@/api/match.service';
import type { ChatScreenRouteProp } from '@/navigation/types';
import { useAppStore } from '@/stores';
import { useMessagePolling } from '@/hooks/useMessagePolling';

export function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const { matchId } = route.params;
  const user = useAppStore((state) => state.user);

  const {
    messages,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    appendMessage,
  } = useMessagePolling(matchId);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Scroll to bottom after initial load or new message
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [isLoading, messages.length]);

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || isSending) return;

    try {
      setIsSending(true);
      setSendError(null);
      const newMessage = await matchService.sendMessage(matchId, {
        content,
        messageType: 'text',
      });
      appendMessage(newMessage);
      setInputText('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : '发送失败';
      setSendError(message);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const renderMessage = useCallback(
    ({ item }: { item: MatchMessage }) => {
      // System message
      if (item.messageType === 'system') {
        return (
          <View style={styles.systemMessageContainer} accessibilityLabel={`系统消息-${item.content}`}>
            <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
        );
      }

      const isMine = user && item.senderId === user.id;

      return (
        <View
          style={[styles.messageRow, isMine ? styles.myMessageRow : styles.otherMessageRow]}
          accessibilityLabel={isMine ? `我的消息-${item.content}` : `他人消息-${item.content}`}
        >
          {!isMine && item.senderNickname && (
            <Text style={styles.senderNickname}>{item.senderNickname}</Text>
          )}
          <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.otherBubble]}>
            <Text style={[styles.messageText, isMine ? styles.myMessageText : styles.otherMessageText]}>
              {item.content}
            </Text>
            <Text style={[styles.timeText, isMine ? styles.myTimeText : styles.otherTimeText]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [user],
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadMoreContainer}>
        <ActivityIndicator size="small" color="#3498db" />
        <Text style={styles.loadMoreText}>加载更多...</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer} accessibilityLabel="加载中">
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={refresh}
          accessibilityLabel="重试"
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      accessibilityLabel="群聊页面"
    >
      {/* Send Error Banner */}
      {sendError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{sendError}</Text>
        </View>
      )}

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.messageList}
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        windowSize={10}
        initialNumToRender={20}
        accessibilityLabel="消息列表"
      />

      {/* Input Area */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="输入消息..."
          maxLength={1000}
          multiline
          accessibilityLabel="消息输入框"
        />
        {isSending ? (
          <View style={[styles.sendButton, styles.sendButtonDisabled]} accessibilityLabel="发送中">
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            accessibilityLabel="发送"
            accessibilityState={{ disabled: !inputText.trim() }}
          >
            <Text style={styles.sendButtonText}>发送</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#fdecea',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  errorBannerText: {
    fontSize: 13,
    color: '#e74c3c',
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
  },
  systemMessageContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  messageRow: {
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  myMessageRow: {
    alignItems: 'flex-end',
  },
  otherMessageRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  myBubble: {
    backgroundColor: '#3498db',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    elevation: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherTimeText: {
    color: '#999',
    textAlign: 'left',
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 12,
    color: '#999',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#3498db',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  senderNickname: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
});
