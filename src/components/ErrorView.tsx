import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { openYouTubeSearch } from '../utils/linking';

interface ErrorViewProps {
  error: string;
  onRetry: () => void;
  detectedQuery?: string;
  onManualSearch?: () => void;
  onPickScreenshot?: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  error,
  onRetry,
  detectedQuery,
  onManualSearch,
  onPickScreenshot,
}) => {
  const isQuota =
    error.includes('quota') ||
    error.includes('Quota') ||
    error.includes('quotaExceeded');
  const isApiKeyMissing =
    error.includes('EXPO_PUBLIC_YOUTUBE_API_KEY') ||
    error.includes('API key is missing');
  const isNotFound = error.includes('not found') || error.includes('private');

  const getTitle = () => {
    if (isApiKeyMissing) return 'API Key Configuration Needed';
    if (isQuota) return 'YouTube API Quota Limit Reached';
    if (isNotFound) return 'Video Not Found';
    return 'Could Not Complete Search';
  };

  const getAdvice = () => {
    if (isApiKeyMissing) {
      return 'Add your YouTube Data API v3 key to the .env file as EXPO_PUBLIC_YOUTUBE_API_KEY and restart the app.';
    }
    if (isQuota) {
      return 'The free YouTube API tier allows ~100 search calls per day (10,000 units). You can still search directly in the YouTube app below!';
    }
    return error || 'An unexpected error occurred while locating the original video.';
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>⚠️</Text>
        </View>
        <Text style={styles.title}>{getTitle()}</Text>
        <Text style={styles.message}>{getAdvice()}</Text>

        {detectedQuery ? (
          <View style={styles.queryPreview}>
            <Text style={styles.queryLabel}>Detected search query:</Text>
            <Text style={styles.queryText}>"{detectedQuery}"</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {detectedQuery ? (
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => {
                if (onManualSearch) {
                  onManualSearch();
                } else {
                  openYouTubeSearch(detectedQuery);
                }
              }}
            >
              <Text style={styles.manualButtonText}>Search YouTube Manually</Text>
            </TouchableOpacity>
          ) : null}

          {onPickScreenshot ? (
            <TouchableOpacity
              style={[styles.manualButton, { backgroundColor: '#3b82f6', marginBottom: 10 }]}
              onPress={onPickScreenshot}
            >
              <Text style={styles.manualButtonText}>🖼️ Pick Screenshot from Gallery</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
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
    borderColor: '#3f3f46',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconText: {
    fontSize: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  queryPreview: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 10,
    width: '100%',
    marginBottom: 16,
  },
  queryLabel: {
    fontSize: 11,
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  queryText: {
    fontSize: 13,
    color: '#fafafa',
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    gap: 8,
  },
  manualButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  manualButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: '#27272a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#f4f4f5',
    fontWeight: '600',
    fontSize: 14,
  },
});
