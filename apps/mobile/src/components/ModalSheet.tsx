import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function ModalSheet({ visible, onClose, children }: ModalSheetProps) {
  return (
    <Modal transparent animationType="slide" presentationStyle="overFullScreen" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
  },
  sheet: {
    backgroundColor: colors.surface,
    padding: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: colors.cardBorderStrong,
    maxHeight: '85%',
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
  },
});
