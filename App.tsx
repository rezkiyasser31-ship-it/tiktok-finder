import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useShareIntent } from 'expo-share-intent';
import * as ImagePicker from 'expo-image-picker';

import { Header } from './src/components/Header';
import { LoadingView } from './src/components/LoadingView';
import { ErrorView } from './src/components/ErrorView';
import { ResultView } from './src/components/ResultView';
import { HistoryList } from './src/components/HistoryList';

import {
  runTikTokFinderPipeline,
  runImageFinderPipeline,
  rerunQuerySearch,
  PipelineProgress,
  PipelineResult,
} from './src/services/finderPipeline';
import {
  getHistory,
  saveHistoryItem,
  clearHistory,
} from './src/services/historyStorage';
import { HistoryItem } from './src/types';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'loading' | 'results' | 'error'>('home');
  const [inputText, setInputText] = useState('');
  const [progress, setProgress] = useState<PipelineProgress>({
    stage: 'idle',
    message: '',
  });
  const [activeResult, setActiveResult] = useState<PipelineResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Share intent hook from expo-share-intent
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  // Load history on mount
  const refreshHistory = useCallback(async () => {
    const items = await getHistory();
    setHistory(items);
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Execute URL search pipeline
  const handleProcessUrl = useCallback(
    async (urlOrText: string) => {
      if (!urlOrText || !urlOrText.trim()) {
        Alert.alert('Please provide a link', 'Paste a TikTok video link or share one from TikTok.');
        return;
      }

      setCurrentView('loading');
      setErrorMessage('');

      try {
        const result = await runTikTokFinderPipeline(urlOrText.trim(), (p) => setProgress(p));
        setActiveResult(result);
        setCurrentView('results');

        // Save to search history if matches were found
        if (result.rankedVideos && result.rankedVideos.length > 0) {
          const historyItem: HistoryItem = {
            id: `hist_${Date.now()}`,
            timestamp: Date.now(),
            inputUrl: urlOrText.trim(),
            inputType: 'url',
            tiktokMeta: result.tiktokMeta,
            detectedQueries: result.detectedQueries,
            topResult: result.rankedVideos[0],
            allResults: result.rankedVideos,
          };
          await saveHistoryItem(historyItem);
          await refreshHistory();
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to process TikTok video');
        setCurrentView('error');
      }
    },
    [refreshHistory]
  );

  // Execute Image/Screenshot search pipeline
  const handleProcessImage = useCallback(
    async (imageUri: string) => {
      if (!imageUri) return;

      setCurrentView('loading');
      setErrorMessage('');

      try {
        const result = await runImageFinderPipeline(imageUri, (p) => setProgress(p));
        setActiveResult(result);
        setCurrentView('results');

        if (result.rankedVideos && result.rankedVideos.length > 0) {
          const historyItem: HistoryItem = {
            id: `hist_${Date.now()}`,
            timestamp: Date.now(),
            inputType: 'image',
            tiktokMeta: result.tiktokMeta,
            detectedQueries: result.detectedQueries,
            topResult: result.rankedVideos[0],
            allResults: result.rankedVideos,
          };
          await saveHistoryItem(historyItem);
          await refreshHistory();
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to recognize text in shared screenshot');
        setCurrentView('error');
      }
    },
    [refreshHistory]
  );

  // Pick screenshot from gallery
  const handlePickScreenshot = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Needed',
          'Please allow access to your photos so you can select a TikTok screenshot.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleProcessImage(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Failed to select image from gallery.');
    }
  }, [handleProcessImage]);

  // Re-run search with modified query
  const handleRerunSearch = useCallback(
    async (newQuery: string) => {
      if (!activeResult) return;
      try {
        const updatedVideos = await rerunQuerySearch(newQuery, activeResult.detectedQueries);
        setActiveResult((prev) =>
          prev
            ? {
                ...prev,
                activeQuery: newQuery,
                rankedVideos: updatedVideos,
                needsManualTitle: false,
              }
            : null
        );
      } catch (err: any) {
        Alert.alert('Search Error', err.message || 'Failed to search YouTube with this query.');
      }
    },
    [activeResult]
  );

  // React to Android Share Sheet Intents
  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      console.log('[ShareIntent] incoming:', JSON.stringify(shareIntent));
      if (shareIntent.type === 'weburl' || shareIntent.type === 'text') {
        const textValue = (shareIntent.text || shareIntent.webUrl || '').trim();
        if (textValue) {
          setInputText(textValue);
          resetShareIntent();
          handleProcessUrl(textValue);
        }
      } else if (shareIntent.type === 'media' || shareIntent.type === 'file' || (shareIntent.files && shareIntent.files.length > 0)) {
        const files = shareIntent.files || [];
        const imagePath = files.length > 0 ? (files[0].path || (files[0] as any).contentUri) : null;
        if (imagePath) {
          resetShareIntent();
          (async () => {
            if (imagePath.startsWith('content://')) {
              try {
                await ImagePicker.requestMediaLibraryPermissionsAsync();
              } catch {}
            }
            handleProcessImage(imagePath);
          })();
        }
      }
    }
  }, [hasShareIntent, shareIntent, resetShareIntent, handleProcessUrl, handleProcessImage]);

  // Open item from history
  const handleSelectHistoryItem = (item: HistoryItem) => {
    setActiveResult({
      tiktokMeta: item.tiktokMeta,
      detectedQueries: item.detectedQueries,
      activeQuery: item.detectedQueries[0] || '',
      rankedVideos: item.allResults,
    });
    setCurrentView('results');
  };

  // Clear history
  const handleClearHistory = async () => {
    await clearHistory();
    setHistory([]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <Header
          showBack={currentView !== 'home'}
          onBack={() => {
            setCurrentView('home');
            setErrorMessage('');
          }}
        />

        {currentView === 'loading' && <LoadingView progress={progress} />}

        {currentView === 'error' && (
          <ErrorView
            error={errorMessage}
            detectedQuery={activeResult?.activeQuery}
            onPickScreenshot={handlePickScreenshot}
            onRetry={() => {
              if (inputText.trim()) {
                handleProcessUrl(inputText);
              } else {
                setCurrentView('home');
              }
            }}
          />
        )}

        {currentView === 'results' && activeResult && (
          <ResultView
            tiktokMeta={activeResult.tiktokMeta}
            ocrText={activeResult.ocrText}
            rawOcrText={activeResult.rawOcrText}
            partMarker={activeResult.partMarker}
            detectedQueries={activeResult.detectedQueries}
            initialActiveQuery={activeResult.activeQuery}
            videos={activeResult.rankedVideos}
            needsManualTitle={activeResult.needsManualTitle}
            manualTitleReason={activeResult.manualTitleReason}
            onRerunSearch={handleRerunSearch}
            onPickScreenshot={handlePickScreenshot}
            onResetSearch={() => {
              setCurrentView('home');
              setActiveResult(null);
            }}
          />
        )}

        {currentView === 'home' && (
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* Input Card */}
            <View style={styles.inputCard}>
              <Text style={styles.inputCardTitle}>PASTE TIKTOK LINK</Text>
              <TextInput
                style={styles.textInput}
                placeholder="https://vm.tiktok.com/... or text with link"
                placeholderTextColor="#71717a"
                value={inputText}
                onChangeText={setInputText}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />

              <View style={styles.buttonRow}>
                {inputText.length > 0 ? (
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => setInputText('')}
                  >
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.primaryBtn, !inputText.trim() && styles.primaryBtnDisabled]}
                  onPress={() => handleProcessUrl(inputText)}
                  disabled={!inputText.trim()}
                >
                  <Text style={styles.primaryBtnText}>Find on YouTube</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pick Screenshot from Gallery Card */}
            <TouchableOpacity style={styles.galleryCard} onPress={handlePickScreenshot}>
              <Text style={styles.galleryCardIcon}>🖼️</Text>
              <View style={styles.galleryCardContent}>
                <Text style={styles.galleryCardTitle}>Pick Screenshot from Gallery</Text>
                <Text style={styles.galleryCardSub}>
                  Have a screenshot of the video title? Tap here to run instant on-device OCR.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Quick Share Feature Info Box */}
            <View style={styles.shareBanner}>
              <Text style={styles.shareBannerIcon}>📲</Text>
              <View style={styles.shareBannerTextContainer}>
                <Text style={styles.shareBannerTitle}>Android Share Sheet Ready</Text>
                <Text style={styles.shareBannerSubtitle}>
                  In TikTok, tap Share → More → select "TikTok Finder". Or share a screenshot directly!
                </Text>
              </View>
            </View>

            {/* Search History Section */}
            <HistoryList
              history={history}
              onSelectItem={handleSelectHistoryItem}
              onClearHistory={handleClearHistory}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  inputCard: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  inputCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a1a1aa',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#27272a',
    color: '#f4f4f5',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3f3f46',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#a1a1aa',
    fontWeight: '600',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  galleryCard: {
    flexDirection: 'row',
    backgroundColor: '#1e1b4b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#4338ca',
    alignItems: 'center',
    gap: 12,
  },
  galleryCardIcon: {
    fontSize: 26,
  },
  galleryCardContent: {
    flex: 1,
    gap: 2,
  },
  galleryCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c7d2fe',
  },
  galleryCardSub: {
    fontSize: 12,
    color: '#a5b4fc',
    lineHeight: 16,
  },
  shareBanner: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    gap: 12,
  },
  shareBannerIcon: {
    fontSize: 26,
  },
  shareBannerTextContainer: {
    flex: 1,
    gap: 2,
  },
  shareBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  shareBannerSubtitle: {
    fontSize: 12,
    color: '#71717a',
    lineHeight: 16,
  },
});
