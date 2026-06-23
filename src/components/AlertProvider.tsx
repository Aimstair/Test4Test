import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export type CustomAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertOptions = {
  title: string;
  message?: string;
  buttons?: CustomAlertButton[];
};

interface AlertContextType {
  showAlert: (title: string, message?: string, buttons?: CustomAlertButton[]) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [alertData, setAlertData] = useState<AlertOptions | null>(null);
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const showAlert = (title: string, message?: string, buttons?: CustomAlertButton[]) => {
    setAlertData({ title, message, buttons });
    setVisible(true);
  };

  const closeAlert = () => {
    setVisible(false);
    setTimeout(() => setAlertData(null), 300); // clear after fade out
  };

  const handlePress = (onPress?: () => void) => {
    closeAlert();
    if (onPress) {
      setTimeout(() => onPress(), 100); // Slight delay for smoother UI exit
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.card}>
            {alertData?.title && <Text style={styles.title}>{alertData.title}</Text>}
            {alertData?.message && <Text style={styles.message}>{alertData.message}</Text>}
            
            <View style={styles.buttonContainer}>
              {alertData?.buttons && alertData.buttons.length > 0 ? (
                alertData.buttons.map((btn, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      btn.style === 'cancel' && styles.buttonCancel,
                      btn.style === 'destructive' && styles.buttonDestructive,
                    ]}
                    onPress={() => handlePress(btn.onPress)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.buttonText,
                      btn.style === 'cancel' && styles.buttonTextCancel,
                      btn.style === 'destructive' && styles.buttonTextDestructive,
                    ]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <TouchableOpacity style={styles.button} onPress={() => handlePress()} activeOpacity={0.8}>
                  <Text style={styles.buttonText}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

export const useCustomAlert = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useCustomAlert must be used within AlertProvider');
  return context;
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonCancel: {
    backgroundColor: colors.border,
  },
  buttonTextCancel: {
    color: colors.text,
  },
  buttonDestructive: {
    backgroundColor: isDark ? 'rgba(229, 57, 53, 0.2)' : '#FFEBEE',
  },
  buttonTextDestructive: {
    color: colors.danger,
  },
});
