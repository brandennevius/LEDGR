import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiRequest, apiStreamRequest } from '../lib/api';
import { colors } from '../theme';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type TextSegment = {
  text: string;
  bold: boolean;
};

function parseBoldSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*([\s\S]+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  if (segments.length === 0) {
    segments.push({ text, bold: false });
  }

  return segments;
}

type CoachChatFabProps = {
  variant?: 'fab' | 'icon';
};

export function CoachChatFab({ variant = 'fab' }: CoachChatFabProps) {
  const insets = useSafeAreaInsets();
  const messagesRef = useRef<ScrollView | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "I'm Penny. Ask about spending patterns, categories, or where to cut this month.",
    },
  ]);

  const bottomOffset = useMemo(() => Math.max(24, insets.bottom + 12), [insets.bottom]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setLoading(true);

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      await apiStreamRequest({
        path: '/api/insights/chat',
        body: { messages: next.slice(-10), stream: true },
        onChunk: (chunk) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            copy[copy.length - 1] = {
              ...last,
              content: `${last.content}${chunk}`,
            };
            return copy;
          });
        },
      });
    } catch {
      // Fallback to non-streaming so the user still gets an answer.
      try {
        const response = await apiRequest<{ answer?: string }>('/api/insights/chat', {
          method: 'POST',
          body: { messages: next.slice(-10) },
        });
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (!last || last.role !== 'assistant') {
            return [
              ...prev,
              { role: 'assistant', content: response.answer ?? 'No insight available yet.' },
            ];
          }
          copy[copy.length - 1] = {
            ...last,
            content: response.answer ?? 'No insight available yet.',
          };
          return copy;
        });
      } catch {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (!last || last.role !== 'assistant') {
            return [
              ...prev,
              {
                role: 'assistant',
                content: "I couldn't fetch insights right now. Try again in a moment.",
              },
            ];
          }
          copy[copy.length - 1] = {
            ...last,
            content: "I couldn't fetch insights right now. Try again in a moment.",
          };
          return copy;
        });
      }
    } finally {
      setLoading(false);
    }

    // Remove accidental blank assistant bubble if no content was streamed.
    setMessages((prev) =>
      prev.filter((message, index) => {
        if (message.role !== 'assistant') return true;
        if (message.content.trim().length > 0) return true;
        return index !== prev.length - 1;
      })
    );
  };

  const clearThread = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          "I'm Penny. Ask about spending patterns, categories, or where to cut this month.",
      },
    ]);
  };

  const trigger =
    variant === 'icon' ? (
      <Pressable onPress={() => setOpen(true)} style={styles.iconButton}>
        <Ionicons name="chatbubble-outline" size={22} color={colors.chromeText} />
      </Pressable>
    ) : (
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.fab, { bottom: bottomOffset }]}
      >
        <Ionicons name="chatbubble-ellipses" size={20} color={colors.background} />
      </Pressable>
    );

  return (
    <>
      {trigger}

      <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setOpen(false)}>
        <View style={styles.chatScreen}>
          <KeyboardAvoidingView
            style={styles.chatScreen}
            behavior={Platform.select({ ios: 'padding', android: undefined })}
          >
            <View style={[styles.chatHeader, { paddingTop: Math.max(insets.top, 10) }]}>
              <Pressable style={styles.chatHeaderIcon} onPress={() => setOpen(false)}>
                <Ionicons name="chevron-down" size={22} color={colors.chromeText} />
              </Pressable>
              <View style={styles.chatHeaderCenter}>
                <Text style={styles.title}>Penny</Text>
                <Text style={styles.subtitle}>Ask anything about your finances.</Text>
              </View>
              <Pressable style={styles.clearButton} onPress={clearThread}>
                <Text style={styles.clearLabel}>Clear</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={messagesRef}
              style={styles.messages}
              contentContainerStyle={[styles.messagesContent, { paddingBottom: Math.max(insets.bottom, 10) }]}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => messagesRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((message, index) => (
                <View
                  key={`${message.role}-${index}`}
                  style={[
                    styles.bubble,
                    message.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      message.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                    ]}
                  >
                    {parseBoldSegments(message.content).map((segment, segmentIndex) => (
                      <Text
                        key={`${index}-${segmentIndex}`}
                        style={segment.bold ? styles.bubbleTextBold : undefined}
                      >
                        {segment.text}
                      </Text>
                    ))}
                  </Text>
                </View>
              ))}
              {loading ? <Text style={styles.loadingText}>Thinking...</Text> : null}
            </ScrollView>

            <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Where can I cut spending this month?"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                multiline
              />
              <Pressable onPress={send} disabled={loading} style={styles.sendButton}>
                <Text style={styles.sendLabel}>{loading ? '...' : 'Send'}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.chromeButtonBorder,
    backgroundColor: colors.chromeButtonBg,
  },
  chatScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.chrome,
  },
  chatHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.chromeButtonBorder,
    backgroundColor: colors.chromeButtonBg,
  },
  chatHeaderCenter: {
    flex: 1,
    paddingHorizontal: 10,
  },
  title: {
    color: colors.chromeText,
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.chromeText,
    fontSize: 12,
    opacity: 0.85,
    marginTop: 4,
    marginBottom: 0,
  },
  clearButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.elevated,
  },
  clearLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  messages: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  messagesContent: {
    gap: 8,
  },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: colors.userBubble,
    alignSelf: 'flex-end',
    maxWidth: '86%',
  },
  bubbleAssistant: {
    backgroundColor: colors.assistantBubble,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bubbleTextUser: {
    color: colors.text,
  },
  bubbleTextAssistant: {
    color: colors.text,
  },
  bubbleTextBold: {
    fontWeight: '700',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.chrome,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },
  sendButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary,
  },
  sendLabel: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 12,
  },
});
