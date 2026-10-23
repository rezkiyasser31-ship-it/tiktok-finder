import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { RankedYouTubeVideo, TikTokMeta } from '../types';
import { openYouTubeVideo, openYouTubeSearch } from '../utils/linking';

interface ResultViewProps {
  tiktokMeta?: TikTokMeta;
  ocrText?: string;
  rawOcrText?: string;
  partMarker?: string;
  detectedQueries: string[];
  initialActiveQuery: string;
  videos: RankedYouTubeVideo[];
  needsManualTitle?: boolean;
  manualTitleReason?: string;
  onRerunSearch: (newQuery: string) => Promise<void>;
  onPickScreenshot?: () => Promise<void>;
  onResetSearch?: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  tiktokMeta,
  ocrText,
  rawOcrText,
  partMarker,
  detectedQueries,
  initialActiveQuery,
  videos,
  needsManualTitle,
  manualTitleReason,
  onRerunSearch,
  onPickScreenshot,
  onResetSearch,
}) => {
  const [activeQuery, setActiveQuery] = useState(initialActiveQuery);
  const [queryInput, setQueryInput] = useState(initialActiveQuery);
  const [isReSearching, setIsReSearching] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showAllMatches, setShowAllMatches] = useState(false);

  const displayedVideos = showAllMatches ? videos.slice(0, 6) : videos.slice(0, 3);

  const handleQuerySubmit = async (queryToRun: string) => {
    if (!queryToRun.trim() || isReSearching) return;
    setIsReSearching(true);
    setActiveQuery(queryToRun.trim());
    setQueryInput(queryToRun.trim());
    try {
      await onRerunSearch(queryToRun.trim());
    } finally {
      setIsReSearching(false);
    }
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.8) return '#22c55e'; // green
    if (confidence >= 0.5) return '#eab308'; // amber
    return '#f97316'; // orange (low confidence)
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. TikTok Source Preview Card */}
      <View style={styles.sourceCard}>
        <View style={styles.sourceCardHeader}>
          <Text style={styles.sectionHeading}>SOURCE PREVIEW</Text>
          {onResetSearch ? (
            <TouchableOpacity onPress={onResetSearch} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>✕ New Search</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.sourceRow}>
          {tiktokMeta?.thumbnailUrl ? (
            <Image
              source={{ uri: tiktokMeta.thumbnailUrl }}
              style={styles.tiktokThumb}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.tiktokThumb, styles.tiktokThumbPlaceholder]}>
              <Text style={styles.thumbPlaceholderText}>
                {tiktokMeta ? 'TikTok' : 'Image OCR'}
              </Text>
            </View>
          )}

          <View style={styles.sourceDetails}>
            {tiktokMeta?.authorName ? (
              <Text style={styles.authorName}>@{tiktokMeta.authorName}</Text>
            ) : null}
            <Text style={styles.captionText} numberOfLines={3}>
              {tiktokMeta?.caption || (ocrText ? `OCR: ${ocrText}` : 'Shared screenshot')}
            </Text>
            <View style={styles.metaBadgesRow}>
              {ocrText ? (
                <View style={styles.ocrBadge}>
                  <Text style={styles.ocrBadgeText}>📷 OCR Title Found</Text>
                </View>
              ) : null}
              {partMarker ? (
                <View style={styles.partBadge}>
                  <Text style={styles.partBadgeText}>🎬 {partMarker}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {/* 2. Empty-Caption / Manual Title Prompt Card */}
      {needsManualTitle ? (
        <View style={styles.manualPromptCard}>
          <Text style={styles.manualPromptTitle}>⚠️ No Title in Caption</Text>
          <Text style={styles.manualPromptBody}>
            {manualTitleReason ||
              'No title in the caption. Share a screenshot of the video, or type the title.'}
          </Text>

          {onPickScreenshot ? (
            <TouchableOpacity style={styles.pickImageButton} onPress={onPickScreenshot}>
              <Text style={styles.pickImageButtonText}>📷 Pick Screenshot from Gallery</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.manualInputLabel}>OR TYPE THE VIDEO TITLE:</Text>
          <View style={styles.queryInputRow}>
            <TextInput
              style={styles.queryInput}
              value={queryInput}
              onChangeText={setQueryInput}
              placeholder="e.g. Why Every Witcher School Sucks"
              placeholderTextColor="#71717a"
              returnKeyType="search"
              onSubmitEditing={() => handleQuerySubmit(queryInput)}
            />
            <TouchableOpacity
              style={[styles.searchButton, isReSearching && styles.searchButtonDisabled]}
              onPress={() => handleQuerySubmit(queryInput)}
              disabled={isReSearching}
            >
              {isReSearching ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.searchButtonText}>Find</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* 3. Detected Query & Edit Bar */}
      {!needsManualTitle ? (
        <View style={styles.queryCard}>
          <Text style={styles.sectionHeading}>DETECTED YOUTUBE SEARCH</Text>
          <View style={styles.queryInputRow}>
            <TextInput
              style={styles.queryInput}
              value={queryInput}
              onChangeText={setQueryInput}
              placeholder="Edit search query..."
              placeholderTextColor="#71717a"
              returnKeyType="search"
              onSubmitEditing={() => handleQuerySubmit(queryInput)}
            />
            <TouchableOpacity
              style={[styles.searchButton, isReSearching && styles.searchButtonDisabled]}
              onPress={() => handleQuerySubmit(queryInput)}
              disabled={isReSearching}
            >
              {isReSearching ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.searchButtonText}>Re-Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Candidate query chips */}
          {detectedQueries.length > 1 ? (
            <View style={styles.chipsRow}>
              <Text style={styles.chipsLabel}>Suggested:</Text>
              {detectedQueries.map((q, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.chip,
                    q.toLowerCase() === activeQuery.toLowerCase() && styles.activeChip,
                  ]}
                  onPress={() => handleQuerySubmit(q)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      q.toLowerCase() === activeQuery.toLowerCase() && styles.activeChipText,
                    ]}
                    numberOfLines={1}
                  >
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Direct Manual YouTube Search button */}
          <TouchableOpacity
            style={styles.manualSearchButton}
            onPress={() => openYouTubeSearch(activeQuery)}
          >
            <Text style={styles.manualSearchText}>🔍 Search YouTube App Directly</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 4. Ranked Matches List */}
      {!needsManualTitle ? (
        <View style={styles.matchesSection}>
          <View style={styles.matchesHeader}>
            <Text style={styles.sectionHeading}>TOP MATCHES ({videos.length})</Text>
            <Text style={styles.subtext}>Ranked by similarity & full duration</Text>
          </View>

          {videos.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No exact YouTube matches found</Text>
              <Text style={styles.emptyText}>
                Try editing the query above, pick a screenshot, or search YouTube directly.
              </Text>
              <TouchableOpacity
                style={styles.manualSearchButton}
                onPress={() => openYouTubeSearch(activeQuery)}
              >
                <Text style={styles.manualSearchText}>Search YouTube for "{activeQuery}"</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {displayedVideos.map((video, index) => {
                const badgeColor = getConfidenceBadgeColor(video.confidence);
                const percentMatch = Math.round(video.confidence * 100);
                const isUnder80 = video.confidence < 0.8;

                return (
                  <View key={video.id} style={styles.videoCard}>
                    {/* Thumbnail with duration overlay */}
                    <View style={styles.thumbWrapper}>
                      <Image source={{ uri: video.thumbnailUrl }} style={styles.videoThumb} />
                      <View style={styles.durationPill}>
                        <Text style={styles.durationText}>{video.duration}</Text>
                      </View>
                      <View style={styles.rankPill}>
                        <Text style={styles.rankPillText}>#{index + 1}</Text>
                      </View>
                    </View>

                    {/* Video Info */}
                    <View style={styles.videoInfo}>
                      <View style={styles.titleRow}>
                        <Text style={styles.videoTitle} numberOfLines={2}>
                          {video.title}
                        </Text>
                      </View>

                      <Text style={styles.channelTitle} numberOfLines={1}>
                        {video.channelTitle}
                      </Text>

                      {/* Confidence Badge */}
                      <View style={styles.badgeRow}>
                        <View style={[styles.confidenceBadge, { borderColor: badgeColor }]}>
                          <View style={[styles.dot, { backgroundColor: badgeColor }]} />
                          <Text style={[styles.confidenceText, { color: badgeColor }]}>
                            {isUnder80
                              ? 'Possible match, title may differ'
                              : `${percentMatch}% Match`}
                          </Text>
                        </View>
                      </View>

                      {/* Match reasons */}
                      {video.matchReasons && video.matchReasons.length > 0 ? (
                        <View style={styles.reasonsContainer}>
                          {video.matchReasons.map((reason, rIdx) => (
                            <View key={rIdx} style={styles.reasonTag}>
                              <Text style={styles.reasonText}>{reason}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {/* Open in YouTube Action Button */}
                      <TouchableOpacity
                        style={styles.watchButton}
                        onPress={() => openYouTubeVideo(video.id)}
                      >
                        <Text style={styles.watchButtonText}>▶ Open on YouTube</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {videos.length > 3 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowAllMatches(!showAllMatches)}
                  accessibilityRole="button"
                >
                  <Text style={styles.showMoreText}>
                    {showAllMatches
                      ? '▲ Show fewer matches'
                      : `▼ Show more matches (${Math.min(videos.length, 6) - 3} more)`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      ) : null}

      {/* 5. Detected Text / Debug Panel */}
      <View style={styles.debugCard}>
        <TouchableOpacity
          style={styles.debugToggleHeader}
          onPress={() => setShowDebugPanel(!showDebugPanel)}
        >
          <Text style={styles.debugToggleText}>
            {showDebugPanel ? '▼ Hide OCR & Query Debug Details' : '▶ Show Detected Text / Debug Details'}
          </Text>
        </TouchableOpacity>

        {showDebugPanel ? (
          <View style={styles.debugBody}>
            <Text style={styles.debugLabel}>CHOSEN QUERY:</Text>
            <Text style={styles.debugValue}>{activeQuery || '(None)'}</Text>

            {partMarker ? (
              <>
                <Text style={styles.debugLabel}>DETECTED PART MARKER:</Text>
                <Text style={styles.debugValue}>{partMarker} (excluded from query)</Text>
              </>
            ) : null}

            <Text style={styles.debugLabel}>RAW OCR TEXT:</Text>
            <Text style={styles.debugRawText}>
              {rawOcrText ? rawOcrText.trim() : '(No on-screen OCR text extracted)'}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  sourceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetButtonText: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 0.8,
  },
  sourceCard: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  tiktokThumb: {
    width: 60,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  tiktokThumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholderText: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '600',
  },
  sourceDetails: {
    flex: 1,
    gap: 4,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#06b6d4',
  },
  captionText: {
    fontSize: 13,
    color: '#e4e4e7',
    lineHeight: 18,
  },
  metaBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  ocrBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2e1065',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  ocrBadgeText: {
    fontSize: 11,
    color: '#c4b5fd',
    fontWeight: '600',
  },
  partBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  partBadgeText: {
    fontSize: 11,
    color: '#7dd3fc',
    fontWeight: '600',
  },
  manualPromptCard: {
    backgroundColor: '#271c11',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
    gap: 12,
  },
  manualPromptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fbbf24',
  },
  manualPromptBody: {
    fontSize: 14,
    color: '#fef3c7',
    lineHeight: 20,
  },
  pickImageButton: {
    backgroundColor: '#854d0e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  pickImageButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  manualInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
    letterSpacing: 0.8,
    marginTop: 6,
  },
  queryCard: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 10,
  },
  queryInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  queryInput: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  searchButton: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chipsLabel: {
    fontSize: 11,
    color: '#71717a',
  },
  chip: {
    backgroundColor: '#27272a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  activeChip: {
    backgroundColor: '#3b0764',
    borderColor: '#a855f7',
  },
  chipText: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  activeChipText: {
    color: '#e9d5ff',
    fontWeight: '600',
  },
  manualSearchButton: {
    backgroundColor: '#27272a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  manualSearchText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  matchesSection: {
    gap: 12,
  },
  matchesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  subtext: {
    fontSize: 11,
    color: '#71717a',
  },
  emptyCard: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyText: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  videoCard: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  thumbWrapper: {
    position: 'relative',
    width: '100%',
    height: 180,
    backgroundColor: '#27272a',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  durationPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  rankPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rankPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  videoInfo: {
    padding: 14,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 20,
  },
  channelTitle: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reasonTag: {
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reasonText: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  watchButton: {
    backgroundColor: '#ff0000',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  watchButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  showMoreButton: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  showMoreText: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '600',
  },
  debugCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    overflow: 'hidden',
    marginTop: 8,
  },
  debugToggleHeader: {
    padding: 12,
    backgroundColor: '#27272a',
  },
  debugToggleText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  debugBody: {
    padding: 14,
    gap: 8,
  },
  debugLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 0.5,
  },
  debugValue: {
    fontSize: 13,
    color: '#38bdf8',
    fontWeight: '600',
  },
  debugRawText: {
    fontSize: 11,
    color: '#d4d4d8',
    fontFamily: 'monospace',
    backgroundColor: '#09090b',
    padding: 8,
    borderRadius: 6,
    lineHeight: 16,
  },
});
