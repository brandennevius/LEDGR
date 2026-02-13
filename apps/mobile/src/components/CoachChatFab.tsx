import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModalSheet from './ModalSheet';
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

export function CoachChatFab() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "I'm your coach. Ask about spending patterns, categories, or where to cut this month.",
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
          "I'm your coach. Ask about spending patterns, categories, or where to cut this month.",
      },
    ]);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.fab, { bottom: bottomOffset }]}
      >
        <Ionicons name="chatbubble-ellipses" size={20} color={colors.background} />
      </Pressable>

      <ModalSheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>AI Coach</Text>
            <Text style={styles.subtitle}>Ask anything about your finances.</Text>
          </View>
          <Pressable style={styles.clearButton} onPress={clearThread}>
            <Text style={styles.clearLabel}>Clear</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
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

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Where can I cut spending this month?"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Pressable onPress={send} disabled={loading} style={styles.sendButton}>
            <Text style={styles.sendLabel}>{loading ? '...' : 'Send'}</Text>
          </Pressable>
        </View>
      </ModalSheet>
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
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clearButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  clearLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  messages: {
    maxHeight: 360,
    marginBottom: 10,
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
    backgroundColor: 'rgba(114, 92, 255, 0.25)',
    alignSelf: 'flex-end',
    maxWidth: '86%',
  },
  bubbleAssistant: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: 'rgba(9, 13, 27, 0.7)',
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
