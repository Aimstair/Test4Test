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
            
            <View style={alertData?.buttons?.length === 2 ? styles.buttonContainer : styles.buttonContainerVertical}>
              {alertData?.buttons && alertData.buttons.length > 0 ? (
                alertData.buttons.map((btn, index) => {
                  const isVertical = alertData.buttons!.length !== 2;
                  const isLast = index === alertData.buttons!.length - 1;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        isVertical ? styles.buttonVertical : styles.button,
                        !isVertical && isLast && { borderRightWidth: 0 },
                        isVertical && index === 0 && { borderTopWidth: StyleSheet.hairlineWidth }
                      ]}
                      onPress={() => handlePress(btn.onPress)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.buttonText,
                        btn.style === 'cancel' && styles.buttonTextBold,
                        btn.style === 'destructive' && styles.buttonTextDestructive,
                      ]}>
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.buttonContainer}>
                  <TouchableOpacity style={[styles.button, { borderRightWidth: 0 }]} onPress={() => handlePress()} activeOpacity={0.7}>
                    <Text style={styles.buttonTextBold}>OK</Text>
                  </TouchableOpacity>
                </View>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 270,
    backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: isDark ? '#FFF' : '#000',
    marginTop: 20,
    marginBottom: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  message: {
    fontSize: 13,
    color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
  },
  buttonContainerVertical: {
    flexDirection: 'column',
    width: '100%',
  },
  button: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
  },
  buttonVertical: {
    width: '100%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
  },
  buttonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '400',
  },
  buttonTextBold: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonTextDestructive: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '400',
  },
});
