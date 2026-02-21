import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  LEGAL_LAST_UPDATED,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
  type LegalDocType,
} from '../content/legal';
import { colors } from '../theme';

export function LegalDocumentModal({
  visible,
  type,
  onClose,
}: {
  visible: boolean;
  type: LegalDocType | null;
  onClose: () => void;
}) {
  const title = type === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
  const sections = type === 'privacy' ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <Modal visible={visible && !!type} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.updated}>Last updated: {LEGAL_LAST_UPDATED}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeLabel}>Done</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.body.map((line) => (
                  <Text key={`${section.title}-${line}`} style={styles.body}>
                    {line}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  updated: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
  },
  closeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 16,
    paddingBottom: 30,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
