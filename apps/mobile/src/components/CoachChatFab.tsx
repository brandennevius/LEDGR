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
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

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

    try {
      const response = await apiRequest<{ answer?: string }>('/api/insights/chat', {
        method: 'POST',
        body: { messages: next.slice(-10) },
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.answer ?? 'No insight available yet.' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I couldn't fetch insights right now. Try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.title}>AI Coach</Text>
        <Text style={styles.subtitle}>Ask anything about your finances.</Text>

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
                {message.content}
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
