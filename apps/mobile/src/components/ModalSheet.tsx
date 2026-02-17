import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function ModalSheet({ visible, onClose, children }: ModalSheetProps) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>{children}</View>
      </View>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.cardBorder,
    maxHeight: '85%',
  },
});
