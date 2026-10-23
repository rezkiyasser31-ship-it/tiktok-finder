import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { HistoryItem } from '../types';

interface HistoryListProps {
  history: HistoryItem[];
  onSelectItem: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  onSelectItem,
  onClearHistory,
}) => {
  if (history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No search history yet</Text>
        <Text style={styles.emptySubtitle}>
          Searches from paste or Android share sheet will be saved here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>RECENT SEARCHES</Text>
        <TouchableOpacity onPress={onClearHistory}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {history.map((item) => {
        const topVideo = item.topResult;
        const thumbUrl = item.tiktokMeta?.thumbnailUrl || topVideo?.thumbnailUrl;
        const title =
          item.tiktokMeta?.caption ||
          (item.detectedQueries.length > 0 ? item.detectedQueries[0] : 'Search');

        return (
          <TouchableOpacity
            key={item.id}
            style={styles.itemCard}
            onPress={() => onSelectItem(item)}
          >
            {thumbUrl ? (
              <Image source={{ uri: thumbUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbPlaceholderText}>▶</Text>
              </View>
            )}

            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>

              {topVideo ? (
                <Text style={styles.matchSubtext} numberOfLines={1}>
                  Top match: {topVideo.title} ({Math.round(topVideo.confidence * 100)}%)
                </Text>
              ) : (
                <Text style={styles.matchSubtext}>No top match</Text>
              )}

              <Text style={styles.timeText}>{formatRelativeTime(item.timestamp)}</Text>
            </View>

            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a1a1aa',
    letterSpacing: 0.8,
  },
  clearText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 10,
  },
  thumb: {
    width: 44,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#27272a',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    color: '#71717a',
    fontSize: 14,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 2,
  },
  matchSubtext: {
    fontSize: 11,
    color: '#a1a1aa',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 10,
    color: '#71717a',
  },
  arrow: {
    fontSize: 18,
    color: '#71717a',
  },
  emptyContainer: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#71717a',
    textAlign: 'center',
  },
});
