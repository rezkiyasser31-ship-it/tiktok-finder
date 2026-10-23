import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

interface HeaderProps {
  onBack?: () => void;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onBack, showBack }) => {
  return (
    <View style={styles.container}>
      {showBack && onBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>▶</Text>
          </View>
          <View>
            <Text style={styles.title}>TikTok Finder</Text>
            <Text style={styles.subtitle}>Find Original YouTube Videos</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    backgroundColor: '#09090b',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f4f4f5',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 1,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderRadius: 6,
    backgroundColor: '#27272a',
  },
  backText: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
  },
});
