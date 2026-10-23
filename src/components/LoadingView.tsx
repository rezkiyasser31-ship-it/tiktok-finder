import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { PipelineProgress } from '../services/finderPipeline';

interface LoadingViewProps {
  progress: PipelineProgress;
}

export const LoadingView: React.FC<LoadingViewProps> = ({ progress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#ef4444" style={styles.spinner} />
        <Text style={styles.title}>Locating Source Video</Text>
        <Text style={styles.message}>{progress.message || 'Processing TikTok...'}</Text>
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            💡 Tip: We clean part numbers, emojis, and hashtags to find the uncut original.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  spinner: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 16,
  },
  tipBox: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  tipText: {
    fontSize: 12,
    color: '#d4d4d8',
    textAlign: 'center',
    lineHeight: 16,
  },
});
